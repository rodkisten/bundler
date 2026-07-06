import { hashString } from '../utils'
import { compileScopedSheetCss } from './sheet-compile'
import { applyEdits, findBareCssTemplates, findStyledCssTemplates, hasTemplateInterpolation, type SourceEdit } from './source'

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

function ensureCssImport(source: string, cssImportId: string): string {
  const quoted = cssImportId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`import\\s+['"]${quoted}['"]`).test(source)) return source
  return `import ${JSON.stringify(cssImportId)};\n${source}`
}
