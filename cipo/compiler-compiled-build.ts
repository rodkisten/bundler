import { createAtomicArtifact } from '@rodkisten/cipo/compiler-atomic-compile'
import { finalizeAtomicArtifacts } from '@rodkisten/cipo/compiler-atomic-program'
import { optimizeCompiledCss } from '@rodkisten/cipo/compiler-compiled-css-optimizer'
import { compileSheetCss } from '@rodkisten/cipo/compiler-sheet-compile'
import { applyEdits, ensureNamedImport, findBareCssTemplates, findStyledCssTemplates, hasTemplateInterpolation, type SourceEdit } from '@rodkisten/cipo/compiler-source'
import { configureFromCss } from '@rodkisten/cipo/config-css'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { runtime } from '@rodkisten/cipo/runtime'
import { transformCss } from '@rodkisten/cipo/transform'
import type { CipoCssArtifact, CipoWarning } from '@rodkisten/cipo/types'
import { hashString } from '@rodkisten/cipo/utils'

export interface CipoCompiledBuildOptions {
  readonly filename?: string
  readonly classPrefix?: string
  readonly transformCssTag?: boolean
  readonly injectCssImport?: boolean
  readonly cssImportId?: string
  /** Optional Cipó configuration CSS applied before compiling each static template. */
  readonly configCss?: string
  /** @deprecated Prefer CSS-first `@cipo { debug: ... }`. */
  readonly classNameMode?: 'readable' | 'compact'
  /** @deprecated Prefer CSS-first `@cipo { minify: ... }`. */
  readonly minifyCss?: boolean
  readonly mergeEquivalentRules?: boolean
  readonly privateCustomPropertyPattern?: RegExp
  /** Couples retained styled JS to compact atomic metadata for runtime-wide promotion. */
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

type AtomicEdit = {
  readonly editIndex: number
  readonly receiver?: string
  readonly artifact: CipoCssArtifact
  readonly coupled: boolean
}

/**
 * Compiles static Cipó templates for build tools.
 *
 * Styled declarations are compiled into atomic candidate metadata, not one CSS
 * rule block per component. In coupled mode the PURE helper registers retained
 * components into the runtime-wide atomic program. Unused components therefore
 * remain tree-shakeable while all retained components share one stylesheet.
 */
export function compileCipoSourceBuild(source: string, options: CipoCompiledBuildOptions = {}): CipoCompiledBuildResult {
  if (options.configCss) configureFromCss(options.configCss)

  const edits: SourceEdit[] = []
  const entries: CipoCompiledBuildManifestEntry[] = []
  const atomicEdits: AtomicEdit[] = []
  const standaloneArtifacts: CipoCssArtifact[] = []
  const prefix = sanitizeClassPrefix(options.classPrefix ?? runtime.config.prefix ?? DEFAULT_CLASS_PREFIX)
  const classNameMode = options.classNameMode ?? (
    runtime.config.debug && runtime.config.debugOptions.readableClassNames ? 'readable' : 'compact'
  )
  const coupledStyled = options.coupleStyledCss === true

  for (const hit of findStyledCssTemplates(source)) {
    if (hasTemplateInterpolation(source, hit.templateStart, hit.templateEnd)) continue
    const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)
    const receiverName = hit.receiver.replace(/\s+/g, '')

    if (receiverName === 'sheet') {
      const cssText = compileRawSheetCss(rawCss, options.configCss)
      const className = createCompiledClassName(prefix, options.filename, rawCss, hit.receiver, classNameMode)
      entries.push(createManifestEntry('sheet-css', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename, hit.receiver))
      edits.push({ start: hit.start, end: hit.templateEnd + 1, value: createStylesheetArtifactLiteral(cssText) })
      continue
    }

    const scopeClassName = createCompiledClassName(prefix, options.filename, rawCss, hit.receiver, classNameMode)
    const artifact = compileRawAtomicArtifact(scopeClassName, rawCss)
    const editIndex = edits.length
    edits.push({ start: hit.start, end: hit.templateEnd + 1, value: '' })
    atomicEdits.push({ editIndex, receiver: hit.receiver, artifact, coupled: coupledStyled })

    entries.push(createManifestEntry(
      'styled-css',
      hit.start,
      hit.templateEnd + 1,
      rawCss,
      '',
      artifact.className,
      options.filename,
      hit.receiver,
    ))

    if (!coupledStyled) standaloneArtifacts.push(artifact)
  }

  if (options.transformCssTag === true) {
    for (const hit of findBareCssTemplates(source, edits)) {
      if (hasTemplateInterpolation(source, hit.templateStart, hit.templateEnd)) continue
      const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)

      if (shouldCompileAsSheetConfig(rawCss)) {
        const cssText = compileRawSheetCss(rawCss, options.configCss)
        const className = createCompiledClassName(prefix, options.filename, rawCss, 'css', classNameMode)
        entries.push(createManifestEntry('sheet-css', hit.start, hit.templateEnd + 1, rawCss, cssText, className, options.filename))
        edits.push({ start: hit.start, end: hit.templateEnd + 1, value: createStylesheetArtifactLiteral(cssText) })
        continue
      }

      const scopeClassName = createCompiledClassName(prefix, options.filename, rawCss, 'css', classNameMode)
      const artifact = compileRawAtomicArtifact(scopeClassName, rawCss)
      const editIndex = edits.length
      edits.push({ start: hit.start, end: hit.templateEnd + 1, value: '' })
      atomicEdits.push({ editIndex, artifact, coupled: false })
      standaloneArtifacts.push(artifact)
      entries.push(createManifestEntry('css-tag', hit.start, hit.templateEnd + 1, rawCss, '', artifact.className, options.filename))
    }
  }

  if (edits.length === 0) return { code: source, css: '', changed: false, manifest: [] }

  const standaloneProgram = finalizeAtomicArtifacts(standaloneArtifacts, runtime.config.atomic.minUses)

  for (const atomicEdit of atomicEdits) {
    const { artifact, receiver, coupled } = atomicEdit
    const value = coupled && receiver
      ? `/*#__PURE__*/attachCompiledCss(${receiver},${serializeCompiledArtifact(artifact)})`
      : receiver
        ? `/*#__PURE__*/${receiver}(${JSON.stringify(standaloneProgram.classNames.get(artifact) ?? artifact.className)})`
        : JSON.stringify(standaloneProgram.classNames.get(artifact) ?? artifact.className)
    edits[atomicEdit.editIndex] = { ...edits[atomicEdit.editIndex]!, value }
  }

  const sorted = edits.slice().sort((left, right) => left.start - right.start)
  let code = applyEdits(source, sorted)
  if (coupledStyled && entries.some((entry) => entry.kind === 'styled-css')) {
    code = ensureNamedImport(code, 'attachCompiledCss', options.styledCssHelperImportPath ?? './compiler-compiled-style-runtime')
  }

  const sheetCss = entries
    .filter((entry) => entry.kind === 'sheet-css')
    .map((entry) => entry.cssText)
    .filter(Boolean)
    .join('\n')
  const rawOutputCss = [standaloneProgram.cssText, sheetCss].filter(Boolean).join('\n')
  const compact = classNameMode === 'compact'
  const css = optimizeCompiledCss(rawOutputCss, {
    minify: options.minifyCss ?? runtime.config.minify,
    mergeEquivalentRules: options.mergeEquivalentRules ?? compact,
    privateCustomPropertyPattern: options.privateCustomPropertyPattern,
  })

  if (css && options.injectCssImport !== false) {
    code = ensureCssImport(code, options.cssImportId ?? DEFAULT_CSS_IMPORT_ID)
  }

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

function compileRawAtomicArtifact(scopeClassName: string, rawCss: string): CipoCssArtifact {
  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  return createAtomicArtifact(rawCss, transformedCss, ast, warnings, false, {
    scopeClassName,
    register: false,
  })
}

function serializeCompiledArtifact(artifact: CipoCssArtifact): string {
  const atoms = artifact.atoms.map((atom) => [
    atom.id,
    atom.className,
    atom.property,
    atom.value,
    atom.context,
  ])
  const scopedRules = artifact.scopedRules.map((rule) => [
    rule.selector,
    rule.declarations.map((declaration) => [declaration.property, declaration.value]),
    rule.context,
  ])
  return JSON.stringify([
    artifact.className,
    artifact.scopeClassName,
    atoms,
    scopedRules,
  ])
}

function createStylesheetArtifactLiteral(cssText: string): string {
  return `{kind:"cipo.stylesheet",cssText:${JSON.stringify(cssText)}}`
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
