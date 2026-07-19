import { createStyledFactory } from '@rodkisten/fabrica-elements'
import type { ElementsRecord, ElementsResolvedStyle, StyledFactory, StyledRegistryCollision } from '@rodkisten/fabrica-elements'
import type { CipoCssInterpolation, CipoCssResult } from '../../types'
import { inline } from '../../inline'
import { insertCss } from '../../injection'
import { inlineCssTextToObject, needsObjectStyleAdapter, resolveElementsAdapter } from '../../elements-style-adapter'
import { installBuiltInAliases } from '../../aliases'
import { createCompilerContext, runInCompilerContext } from '../context'
import { asCipoCompileError } from '../../engine/diagnostics'
import { applyEdits, ensureNamedImportBinding, findImportedBindings, findStyledCssTemplates, getAvailableBindingName, hasTemplateInterpolation, sourceLocationFromOffset, type SourceEdit } from '../source/index'
import { installBuiltInHelpers } from '../../helpers'
import { installNativePropertyGuards } from '../../native-property-guards'

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
  const filename = options.filename ?? 'source.tsx'
  const importPath = options.importPath ?? '@rodkisten/cipo/compiler'
  const existingHelperBinding = findImportedBindings(
    source,
    'compiledInlineCss',
    new Set([importPath]),
    filename,
  ).values().next().value
  const helperLocalName = existingHelperBinding
    ?? getAvailableBindingName(source, '__cipoCompiledInlineCss', filename)
  const manifest: CipoCompiledInlineManifestEntry[] = []
  const edits: SourceEdit[] = []
  const context = createCompilerContext({ id: `inline:${filename}` })
  let counter = 0

  return runInCompilerContext(context, () => {
    installBuiltInHelpers()
    installBuiltInAliases()
    installNativePropertyGuards()

    for (const hit of findStyledCssTemplates(source, filename)) {
      const rawCss = source.slice(hit.templateStart + 1, hit.templateEnd)
      const staticTemplate = !hasTemplateInterpolation(source, hit.templateStart, hit.templateEnd)
      const shouldEvaluate = options.evaluateStaticCss ?? true
      let cssText = ''

      if (shouldEvaluate && staticTemplate) {
        try {
          const cooked = rawCss.replace(/\\`/g, '`')
          cssText = String(compiledInlineCss([cooked] as unknown as TemplateStringsArray))
        } catch (error) {
          throw asCipoCompileError(
            error,
            'CIPO_INLINE_TEMPLATE_COMPILE_FAILED',
            `Failed to evaluate static inline template ${hit.receiver}.`,
            sourceLocationFromOffset(source, options.filename, hit.start, hit.templateEnd + 1),
          )
        }
      }

      manifest.push({
        id: `cipo-inline-${++counter}`,
        ...(options.filename ? { filename: options.filename } : {}),
        start: hit.start,
        end: hit.templateEnd + 1,
        receiver: hit.receiver,
        rawCss,
        cssText,
        static: staticTemplate,
      })

      edits.push({
        start: hit.start,
        end: hit.templateEnd + 1,
        value: `${hit.receiver}(${helperLocalName}\`${rawCss}\`)`,
      })
    }

    if (manifest.length === 0) return { code: source, changed: false, manifest }

    const transformed = applyEdits(source, edits)
    const code = ensureNamedImportBinding(
      transformed,
      'compiledInlineCss',
      importPath,
      helperLocalName,
      filename,
    ).code

    return { code, changed: true, manifest }
  })
}
