import { hashString } from '../utils'
import { optimizeCompiledCss } from './compiled-css-optimizer'
import { compileScopedSheetCss, compileSheetCss } from './sheet-compile'
import { applyEdits, ensureNamedImport, findBareCssTemplates, findStyledCssTemplates, hasTemplateInterpolation, type SourceEdit } from './source'

export interface CipoCompiledBuildOptions {
  readonly filename?: string
  readonly classPrefix?: string
  readonly transformCssTag?: boolean
  readonly injectCssImport?: boolean
  readonly cssImportId?: string
  /** Optional Cipó configuration CSS applied before compiling each static template. */
  readonly configCss?: string
  /** Readable keeps component labels; compact emits hash-only production class names. */
  readonly classNameMode?: 'readable' | 'compact'
  /** Minifies emitted CSS after semantic compilation. Defaults to true in compact mode. */
  readonly minifyCss?: boolean
  /** Merges safe flat rules with identical declaration bodies. */
  readonly mergeEquivalentRules?: boolean
  /** Opt-in mangling for private custom properties only, for example /^--_cipo-/. */
  readonly privateCustomPropertyPattern?: RegExp
  /** Couples each styled component to its CSS so unused JS and CSS can tree-shake together. */
  readonly coupleStyledCss?: boolean
  /** Import used by coupled styled CSS mode. */
  readonly styledCssHelperImportPath?: string
}

export interface CipoCompiledBuildManifestEntry {
  readonly id: string
  readonly filename?: string
  readonly start: number
  readonly end: number
  readonly kind: 'styled-css' | 'css-tag' | 'sheet-css'
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
    const receiverName = hit.receiver.replace(/\s+/g, '')

    if (receiverName === 'sheet') {
      const cssText = compileRawSheetCss(rawCss, options.configCss)
      const className = createCompiledClassName(prefix, options.filename, rawCss, hit.receiver, options.classNameMode)
      entries.push(createManifestEntry('sheet-css', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename, hit.receiver))
      edits.push({ start: hit.start, end: hit.templateEnd + 1, value: createStylesheetArtifactLiteral(cssText) })
      continue
    }

    const className = createCompiledClassName(prefix, options.filename, rawCss, hit.receiver, options.classNameMode)
    const cssText = compileRawCssForClass(className, rawCss, options.configCss)
    entries.push(createManifestEntry('styled-css', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename, hit.receiver))
    const value = options.coupleStyledCss
      ? `/*#__PURE__*/attachCompiledCss(${hit.receiver},${JSON.stringify(className)},${JSON.stringify(optimizeCompiledCss(cssText, { minify: options.minifyCss ?? options.classNameMode === 'compact', mergeEquivalentRules: options.mergeEquivalentRules ?? options.classNameMode === 'compact', privateCustomPropertyPattern: options.privateCustomPropertyPattern }))})`
      : `/*#__PURE__*/${hit.receiver}(${JSON.stringify(className)})`
    edits.push({ start: hit.start, end: hit.templateEnd + 1, value })
  }

  if (options.transformCssTag === true) {
    for (const hit of findBareCssTemplates(source, edits)) {
      if (hasTemplateInterpolation(source, hit.templateStart, hit.templateEnd)) continue
      const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)

      if (shouldCompileAsSheetConfig(rawCss)) {
        const cssText = compileRawSheetCss(rawCss, options.configCss)
        const className = createCompiledClassName(prefix, options.filename, rawCss, 'css', options.classNameMode)
        entries.push(createManifestEntry('sheet-css', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename))
        edits.push({ start: hit.start, end: hit.templateEnd + 1, value: createStylesheetArtifactLiteral(cssText) })
        continue
      }

      const className = createCompiledClassName(prefix, options.filename, rawCss, 'css', options.classNameMode)
      const cssText = compileRawCssForClass(className, rawCss, options.configCss)
      entries.push(createManifestEntry('css-tag', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename))
      edits.push({ start: hit.start, end: hit.templateEnd + 1, value: JSON.stringify(className) })
    }
  }

  if (edits.length === 0) return { code: source, css: '', changed: false, manifest: [] }

  const sorted = edits.slice().sort((left, right) => left.start - right.start)
  let code = applyEdits(source, sorted)
  if (options.coupleStyledCss && entries.some((entry) => entry.kind === 'styled-css')) {
    code = ensureNamedImport(code, 'attachCompiledCss', options.styledCssHelperImportPath ?? './compiled-style-runtime')
  }
  if (options.injectCssImport !== false) code = ensureCssImport(code, options.cssImportId ?? DEFAULT_CSS_IMPORT_ID)

  const rawOutputCss = entries
    .filter((entry) => !options.coupleStyledCss || entry.kind !== 'styled-css')
    .map((entry) => entry.cssText)
    .filter(Boolean)
    .join('\n')
  const compact = options.classNameMode === 'compact'
  const css = optimizeCompiledCss(rawOutputCss, {
    minify: options.minifyCss ?? compact,
    mergeEquivalentRules: options.mergeEquivalentRules ?? compact,
    privateCustomPropertyPattern: options.privateCustomPropertyPattern,
  })

  return {
    code,
    css,
    changed: true,
    manifest: entries,
  }
}

function shouldCompileAsSheetConfig(rawCss: string): boolean {
  return /@cipo\b|@theme\b|@breakpoints\b|@alias\b/.test(rawCss)
}

function compileRawSheetCss(rawCss: string, configCss = ''): string {
  try {
    const cooked = rawCss.replace(/\\`/g, '`')
    const source = configCss ? `${configCss}\n${cooked}` : cooked
    const artifact = compileSheetCss([source] as unknown as TemplateStringsArray, [], false)
    return artifact.cssText
  } catch {
    return ''
  }
}

function createStylesheetArtifactLiteral(cssText: string): string {
  return `{kind:"cipo.stylesheet",cssText:${JSON.stringify(cssText)}}`
}

function compileRawCssForClass(className: string, rawCss: string, configCss = ''): string {
  try {
    const source = configCss ? `${configCss}\n${rawCss}` : rawCss
    return String(compileScopedSheetCss(`.${className}`, [source] as unknown as TemplateStringsArray, [], false))
  } catch {
    return ''
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

function createCompiledClassName(
  prefix: string,
  filename: string | undefined,
  rawCss: string,
  receiver: string,
  mode: 'readable' | 'compact' = 'readable',
): string {
  const hash = hashString(`${filename ?? ''}|${receiver}|${rawCss}`)
  if (mode === 'compact') return `${prefix}${hash}`
  const readable = receiver.match(/['"]([^'"]+)['"]/)?.[1]
  const label = readable ? `-${sanitizeClassPrefix(readable)}` : ''
  return `${prefix}${label}-${hash}`
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
