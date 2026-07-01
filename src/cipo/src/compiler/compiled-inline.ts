import { createStyledFactory } from '../../../fabrica-elements'
import type { ElementsAdapter, ElementsAdapterName, ElementsResolvedStyle, ElementsRecord, StyledFactory, StyledRegistryCollision } from '../../../fabrica-elements'
import type { CipoCssInterpolation, CipoCssResult } from '../types'
import { inline } from '../inline'
import { runtime } from '../runtime'
import { insertCss } from '../injection'

/** Options for Cipó's first compiled-mode surface. */
export interface CipoCompiledInlineOptions {
  /** Fabrica-compatible registry used by named styled components. */
  readonly fabrica?: unknown
  /** Explicit Fabrica-compatible registry. Wins over `fabrica` when provided. */
  readonly registry?: unknown
  /** Whether named components should be registered as they are created. */
  readonly autoRegister?: boolean
  /** Registry collision behavior. */
  readonly collision?: StyledRegistryCollision
  /** Optional warning sink used by DevTools/playgrounds. */
  readonly onWarning?: (message: string) => void
}

/** Metadata returned by source transforms and DevTools playground probes. */
export interface CipoCompiledInlineManifestEntry {
  readonly id: string
  readonly filename?: string
  readonly start: number
  readonly end: number
  readonly rawCss: string
  readonly cssText: string
}

/** Result returned by the lightweight source compiler used by the Vite adapter. */
export interface CipoCompiledInlineSourceResult {
  readonly code: string
  readonly changed: boolean
  readonly manifest: readonly CipoCompiledInlineManifestEntry[]
}

/** Public alias for the inline compiled artifact kind used by styled compiled mode. */
export type CipoCompiledInlineArtifact = ReturnType<typeof compiledInlineCss>

/**
 * Compiles a tagged template to an inline Cipó artifact.
 *
 * @remarks
 * This is deliberately a tiny wrapper over the existing inline compiler. The
 * compiled-mode contract starts as "inline by default" so the runtime, DevTools
 * and Vite transform can share the exact same artifact format without emitting
 * a generated CSS file yet.
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

/**
 * Rewrites common styled `.css\`...\`` templates to inline-artifact calls.
 *
 * @remarks
 * This intentionally starts conservative. It covers the current Fabrica/Cipó
 * styled shapes used by DevTools and tests:
 * `styled.div("Name").css\`...\`` -> `styled.div("Name")(compiledInlineCss\`...\`)`.
 * The runtime compiled factory already handles templates without a transform;
 * this source pass exists so Vite can become the playground/inspection layer.
 */
export function compileCipoSourceInline(source: string, options: { readonly filename?: string; readonly importPath?: string } = {}): CipoCompiledInlineSourceResult {
  const manifest: CipoCompiledInlineManifestEntry[] = []
  let importNeeded = false
  let counter = 0
  let output = ''
  let cursor = 0

  const matcher = /((?:styled|cipo)(?:\.[A-Za-z_$][\w$]*|\([^`]*?\))(?:\([^`]*?\))?)\.css`/g
  let match: RegExpExecArray | null
  while ((match = matcher.exec(source))) {
    const receiver = match[1]
    if (!receiver) continue
    const templateStart = matcher.lastIndex - 1
    const templateEnd = findTemplateEnd(source, templateStart)
    if (templateEnd < 0) continue

    const rawCss = source.slice(templateStart + 1, templateEnd)
    const cssText = tryCompileRawTemplate(rawCss)
    manifest.push({
      id: `cipo-inline-${++counter}`,
      ...(options.filename ? { filename: options.filename } : {}),
      start: match.index,
      end: templateEnd + 1,
      rawCss,
      cssText,
    })

    output += source.slice(cursor, match.index)
    output += `${receiver}(compiledInlineCss\`${rawCss}\`)`
    cursor = templateEnd + 1
    matcher.lastIndex = templateEnd + 1
    importNeeded = true
  }

  if (!importNeeded) return { code: source, changed: false, manifest }
  output += source.slice(cursor)
  return {
    code: ensureCompiledInlineImport(output, options.importPath),
    changed: true,
    manifest,
  }
}

function tryCompileRawTemplate(rawCss: string): string {
  if (rawCss.includes('${')) return ''
  const cooked = rawCss.replace(/\\`/g, '`')
  return String(compiledInlineCss([cooked] as unknown as TemplateStringsArray))
}

function findTemplateEnd(source: string, start: number): number {
  let escaped = false
  let expressionDepth = 0
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '$' && next === '{') { expressionDepth += 1; index += 1; continue }
    if (char === '}' && expressionDepth > 0) { expressionDepth -= 1; continue }
    if (char === '`' && expressionDepth === 0) return index
  }
  return -1
}

function ensureCompiledInlineImport(source: string, importPath = './compiler/compiled-inline'): string {
  if (/\bcompiledInlineCss\b/.test(source) && /from\s+['"][^'"]*compiled-inline['"]/.test(source)) return source
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
