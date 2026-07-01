import { createStyledFactory } from '../../../fabrica-elements'
import type { ElementsAdapter, ElementsAdapterName, ElementsRecord, ElementsResolvedStyle, StyledFactory, StyledRegistryCollision } from '../../../fabrica-elements'
import type { CipoCssInterpolation, CipoCssResult } from '../types'
import { inline } from '../inline'
import { runtime } from '../runtime'
import { insertCss } from '../injection'

/** Options for Cipó's compiled-inline surface. */
export interface CipoCompiledInlineOptions {
  /** Fábrica-compatible registry used by named styled components. */
  readonly fabrica?: unknown
  /** Explicit Fábrica-compatible registry. Wins over `fabrica` when provided. */
  readonly registry?: unknown
  /** Whether named components should be registered as they are created. */
  readonly autoRegister?: boolean
  /** Registry collision behavior. */
  readonly collision?: StyledRegistryCollision
  /** Optional warning sink used by DevTools/playgrounds. */
  readonly onWarning?: (message: string) => void
}

/** A transformed template captured by the source compiler and Vite plugin. */
export interface CipoCompiledInlineManifestEntry {
  readonly id: string
  readonly filename?: string
  readonly start: number
  readonly end: number
  readonly receiver: string
  readonly rawCss: string
  readonly cssText: string
  readonly static: boolean
}

/** Source compiler result used by Vite, tests and the DevTools playground. */
export interface CipoCompiledInlineSourceResult {
  readonly code: string
  readonly changed: boolean
  readonly manifest: readonly CipoCompiledInlineManifestEntry[]
}

/** Public alias for the inline compiled artifact kind used by styled compiled mode. */
export type CipoCompiledInlineArtifact = ReturnType<typeof compiledInlineCss>

/**
 * Compiles a tagged template or style object to an inline Cipó artifact.
 *
 * @remarks
 * This is intentionally a wrapper over the existing compiler, not a parallel
 * parser. The first compiled mode keeps CSS inline by default, so Fábrica,
 * Cipó, DevTools and Vite all consume the same `cipo.inline-css` artifact.
 */
export function compiledInlineCss(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) {
  return inline.css(strings, ...values)
}

/** Same as {@link compiledInlineCss}, but forces every declaration important. */
compiledInlineCss.withImportant = function compiledInlineCssWithImportant(
  strings: TemplateStringsArray,
  ...values: readonly CipoCssInterpolation[]
) {
  return inline.css.withImportant(strings, ...values)
}

/** Creates a Cipó styled factory whose template literals compile to inline style artifacts by default. */
export function createCompiledStyled(options: CipoCompiledInlineOptions = {}): StyledFactory<CipoCssResult> {
  const factory = createStyledFactory<CipoCssResult>({
    adapter: resolveElementsAdapter,
    autoRegister: options.autoRegister ?? true,
    collision: options.collision ?? 'warn',
    registry: (options.registry ?? options.fabrica) as never,
    onWarning: options.onWarning,
    createStyle(strings, values) {
      const artifact = compiledInlineCss(strings, ...(values as readonly CipoCssInterpolation[]))
      return resolveCompiledStyleInput(artifact)
    },
    resolveStyle(input, props) {
      return resolveCompiledStyleInput(input, props)
    },
  })

  return factory as StyledFactory<CipoCssResult>
}

/** Resolves compiled inline artifacts and compatibility Cipó artifacts for styled compiled mode. */
export function resolveCompiledStyleInput(input: unknown, _props: ElementsRecord = {}): ElementsResolvedStyle<CipoCssResult> {
  if (typeof input === 'string') return { className: input }
  if (!input || typeof input !== 'object') {
    throw new TypeError('[Cipó compiled] Expected a Cipó artifact, class string, array or style function.')
  }

  const artifact = input as CipoCssResult
  if ('kind' in artifact && artifact.kind === 'cipo.inline-css') {
    return {
      className: '',
      artifact,
      style: needsObjectStyleAdapter() ? inlineCssTextToObject(artifact.cssText) : artifact.cssText,
    }
  }

  if ('kind' in artifact && artifact.kind === 'cipo.css') return { className: artifact.className, artifact }
  if ('kind' in artifact && artifact.kind === 'cipo.stylesheet') {
    insertCss(artifact.cssText)
    return { className: '', artifact }
  }
  if ('config' in artifact && 'theme' in artifact) return { className: '', artifact }

  throw new TypeError('[Cipó compiled] Received an unknown style artifact.')
}

export interface CompileCipoSourceInlineOptions {
  readonly filename?: string
  /** Import specifier inserted when at least one template is transformed. */
  readonly importPath?: string
  /** Whether static templates should be evaluated for manifest cssText. Defaults to true. */
  readonly evaluateStaticCss?: boolean
}

/**
 * Rewrites common styled `.css\`...\`` templates to explicit inline artifact calls.
 *
 * @example
 * ```ts
 * styled.div('Panel').css`px(2)`
 * // becomes
 * styled.div('Panel')(compiledInlineCss`px(2)`)
 * ```
 */
export function compileCipoSourceInline(source: string, options: CompileCipoSourceInlineOptions = {}): CipoCompiledInlineSourceResult {
  const manifest: CipoCompiledInlineManifestEntry[] = []
  let output = ''
  let cursor = 0
  let counter = 0

  for (const hit of findStyledCssTemplates(source)) {
    const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)
    const shouldEvaluate = options.evaluateStaticCss ?? true
    const cssText = shouldEvaluate && !rawCss.includes('${') ? tryCompileRawTemplate(rawCss) : ''

    manifest.push({
      id: `cipo-inline-${++counter}`,
      ...(options.filename ? { filename: options.filename } : {}),
      start: hit.start,
      end: hit.templateEnd + 1,
      receiver: hit.receiver,
      rawCss,
      cssText,
      static: cssText.length > 0,
    })

    output += source.slice(cursor, hit.start)
    output += `${hit.receiver}(compiledInlineCss\`${rawCss}\`)`
    cursor = hit.templateEnd + 1
  }

  if (manifest.length === 0) return { code: source, changed: false, manifest }
  output += source.slice(cursor)

  return {
    code: ensureCompiledInlineImport(output, options.importPath),
    changed: true,
    manifest,
  }
}

interface StyledCssTemplateHit {
  readonly start: number
  readonly receiver: string
  readonly templateStart: number
  readonly templateEnd: number
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

function tryCompileRawTemplate(rawCss: string): string {
  try {
    const cooked = rawCss.replace(/\\`/g, '`')
    return String(compiledInlineCss([cooked] as unknown as TemplateStringsArray))
  } catch {
    return ''
  }
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

function ensureCompiledInlineImport(source: string, importPath = './compiler/compiled-inline'): string {
  if (/import\s+\{[^}]*\bcompiledInlineCss\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(source)) return source
  return `import { compiledInlineCss } from '${importPath}'\n${source}`
}

function needsObjectStyleAdapter(): boolean {
  return runtime.config.adapter === 'react' || runtime.config.adapter === 'preact'
}

function resolveElementsAdapter(): ElementsAdapterName | ElementsAdapter {
  return runtime.config.adapter as ElementsAdapterName | ElementsAdapter
}

/** Converts inline declaration text into a React/Preact-compatible style object. */
export function inlineCssTextToObject(cssText: string): ElementsRecord {
  const output: ElementsRecord = {}
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index <= cssText.length; index += 1) {
    const char = cssText[index] ?? ';'

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') { depth += 1; continue }
    if (char === ')' || char === ']') { depth = Math.max(0, depth - 1); continue }
    if (char !== ';' || depth !== 0) continue

    const declaration = cssText.slice(start, index).trim()
    start = index + 1
    if (!declaration) continue
    const colon = declaration.indexOf(':')
    if (colon <= 0) continue
    const property = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    if (property && value) output[toStylePropertyName(property)] = value
  }

  return output
}

function toStylePropertyName(property: string): string {
  if (property.startsWith('--')) return property
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}
