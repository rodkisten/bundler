import { compileScopedSheetCss } from './sheet-compile'
import { hashString } from '../utils'

export interface CipoCompiledBuildOptions {
  readonly filename?: string
  readonly classPrefix?: string
  readonly transformCssTag?: boolean
  readonly injectCssImport?: boolean
  readonly cssImportId?: string
}

export interface CipoCompiledBuildManifestEntry {
  readonly id: string
  readonly filename?: string
  readonly start: number
  readonly end: number
  readonly kind: 'styled-css' | 'css-tag'
  readonly receiver?: string
  readonly className: string
  readonly rawCss: string
  readonly cssText: string
}

export interface CipoCompiledBuildResult {
  readonly code: string
  readonly css: string
  readonly changed: boolean
  readonly manifest: readonly CipoCompiledBuildManifestEntry[]
}

const DEFAULT_CLASS_PREFIX = 'cp'
const DEFAULT_CSS_IMPORT_ID = '\0cipo:compiled.css'

/**
 * Compiles static Cipó templates to real CSS classes for build tools.
 *
 * This deliberately reuses the existing Cipó stylesheet compiler. The build
 * compiler only owns source extraction, deterministic class naming and source
 * rewriting; aliases, helpers, nesting, variants, tokens and formatting still
 * come from the runtime compiler that already powers Cipó today.
 */
export function compileCipoSourceBuild(source: string, options: CipoCompiledBuildOptions = {}): CipoCompiledBuildResult {
  const edits: SourceEdit[] = []
  const entries: CipoCompiledBuildManifestEntry[] = []
  const prefix = sanitizeClassPrefix(options.classPrefix ?? DEFAULT_CLASS_PREFIX)

  for (const hit of findStyledCssTemplates(source)) {
    if (hasTemplateInterpolation(source, hit.templateStart, hit.templateEnd)) continue
    const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)
    const className = createCompiledClassName(prefix, options.filename, rawCss, hit.receiver)
    const cssText = compileRawCssForClass(className, rawCss)
    entries.push(createManifestEntry('styled-css', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename, hit.receiver))
    edits.push({ start: hit.start, end: hit.templateEnd + 1, value: `${hit.receiver}(${JSON.stringify(className)})` })
  }

  if (options.transformCssTag === true) {
    for (const hit of findBareCssTemplates(source, edits)) {
      if (hasTemplateInterpolation(source, hit.templateStart, hit.templateEnd)) continue
      const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)
      const className = createCompiledClassName(prefix, options.filename, rawCss, 'css')
      const cssText = compileRawCssForClass(className, rawCss)
      entries.push(createManifestEntry('css-tag', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename))
      edits.push({ start: hit.start, end: hit.templateEnd + 1, value: JSON.stringify(className) })
    }
  }

  if (edits.length === 0) return { code: source, css: '', changed: false, manifest: [] }

  const sorted = edits.slice().sort((left, right) => left.start - right.start)
  let code = applyEdits(source, sorted)
  if (options.injectCssImport !== false) code = ensureCssImport(code, options.cssImportId ?? DEFAULT_CSS_IMPORT_ID)

  return {
    code,
    css: entries.map((entry) => entry.cssText).filter(Boolean).join('\n'),
    changed: true,
    manifest: entries,
  }
}

interface SourceEdit { readonly start: number; readonly end: number; readonly value: string }
interface StyledCssTemplateHit { readonly start: number; readonly receiver: string; readonly templateStart: number; readonly templateEnd: number }
interface CssTemplateHit { readonly start: number; readonly templateStart: number; readonly templateEnd: number }

function compileRawCssForClass(className: string, rawCss: string): string {
  try {
    return String(compileScopedSheetCss(`.${className}`, [rawCss] as unknown as TemplateStringsArray, [], false))
  } catch {
    return `.${className}{${rawCss}}`
  }
}

function createManifestEntry(
  kind: CipoCompiledBuildManifestEntry['kind'],
  start: number,
  end: number,
  rawCss: string,
  cssText: string,
  className: string,
  filename?: string,
  receiver?: string,
): CipoCompiledBuildManifestEntry {
  return {
    id: `cipo-build-${hashString(`${filename ?? ''}|${start}|${rawCss}`)}`,
    ...(filename ? { filename } : {}),
    start,
    end,
    kind,
    ...(receiver ? { receiver } : {}),
    className,
    rawCss,
    cssText,
  }
}

function createCompiledClassName(prefix: string, filename: string | undefined, rawCss: string, receiver: string): string {
  const readable = receiver.match(/['"]([^'"]+)['"]/)?.[1]
  const label = readable ? `-${sanitizeClassPrefix(readable)}` : ''
  return `${prefix}${label}-${hashString(`${filename ?? ''}|${receiver}|${rawCss}`)}`
}

function sanitizeClassPrefix(value: string): string {
  const safe = String(value || DEFAULT_CLASS_PREFIX).replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+/, '')
  return safe || DEFAULT_CLASS_PREFIX
}

function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  let output = ''
  let cursor = 0
  for (const edit of edits) {
    if (edit.start < cursor) continue
    output += source.slice(cursor, edit.start)
    output += edit.value
    cursor = edit.end
  }
  output += source.slice(cursor)
  return output
}

function ensureCssImport(source: string, cssImportId: string): string {
  const quoted = cssImportId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`import\\s+['"]${quoted}['"]`).test(source)) return source
  return `import ${JSON.stringify(cssImportId)};\n${source}`
}

function findStyledCssTemplates(source: string): StyledCssTemplateHit[] {
  const hits: StyledCssTemplateHit[] = []
  const marker = '.css`'
  let searchFrom = 0
  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom)
    if (markerIndex < 0) break
    const receiverStart = findReceiverStart(source, markerIndex)
    const templateStart = markerIndex + '.css'.length
    const templateEnd = findTemplateEnd(source, templateStart)
    if (receiverStart >= 0 && templateEnd >= 0) {
      const receiver = source.slice(receiverStart, markerIndex)
      if (isCompilableReceiver(receiver)) {
        hits.push({ start: receiverStart, receiver, templateStart, templateEnd })
        searchFrom = templateEnd + 1
        continue
      }
    }
    searchFrom = markerIndex + marker.length
  }
  return hits
}

function findBareCssTemplates(source: string, existingEdits: readonly SourceEdit[]): CssTemplateHit[] {
  const hits: CssTemplateHit[] = []
  const marker = 'css`'
  let searchFrom = 0
  while (searchFrom < source.length) {
    const start = source.indexOf(marker, searchFrom)
    if (start < 0) break
    const before = source[start - 1] ?? ''
    if (/[$\w.]/.test(before) || overlapsAny(start, start + marker.length, existingEdits)) {
      searchFrom = start + marker.length
      continue
    }
    const templateStart = start + 'css'.length
    const templateEnd = findTemplateEnd(source, templateStart)
    if (templateEnd >= 0) hits.push({ start, templateStart, templateEnd })
    searchFrom = templateEnd >= 0 ? templateEnd + 1 : start + marker.length
  }
  return hits
}

function overlapsAny(start: number, end: number, edits: readonly SourceEdit[]): boolean {
  return edits.some((edit) => start < edit.end && end > edit.start)
}

function findReceiverStart(source: string, cssDotIndex: number): number {
  let index = cssDotIndex - 1
  let parenDepth = 0
  let bracketDepth = 0
  let quote = ''
  let escaped = false
  for (; index >= 0; index -= 1) {
    const char = source[index]!
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === ')') { parenDepth += 1; continue }
    if (char === '(') { parenDepth -= 1; continue }
    if (char === ']') { bracketDepth += 1; continue }
    if (char === '[') { bracketDepth -= 1; continue }
    if (parenDepth < 0 || bracketDepth < 0) return index + 1
    if (parenDepth === 0 && bracketDepth === 0 && !isReceiverChar(char)) return index + 1
  }
  return 0
}

function isReceiverChar(char: string): boolean {
  return /[A-Za-z0-9_$.[\]()'",\s:-]/.test(char)
}

function isCompilableReceiver(receiver: string): boolean {
  const compact = receiver.replace(/\s+/g, '')
  return /^(?:styled|cipo)(?:\.[A-Za-z_$][\w$]*|\(|\[)/.test(compact)
}

function hasTemplateInterpolation(source: string, templateStart: number, templateEnd: number): boolean {
  let escaped = false
  for (let index = templateStart + 1; index < templateEnd; index += 1) {
    const char = source[index]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '$' && source[index + 1] === '{') return true
  }
  return false
}

function findTemplateEnd(source: string, start: number): number {
  let escaped = false
  let expressionDepth = 0
  let quote = ''
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (expressionDepth > 0 && (char === '"' || char === "'")) { quote = char; continue }
    if (char === '$' && next === '{') { expressionDepth += 1; index += 1; continue }
    if (char === '}' && expressionDepth > 0) { expressionDepth -= 1; continue }
    if (char === '`' && expressionDepth === 0) return index
  }
  return -1
}
