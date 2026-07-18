import * as ts from 'typescript'
import type { Plugin } from 'vite'
import { compileCipoSourceBuild, type CipoCompiledBuildManifestEntry, type CipoCompiledBuildResult } from '../../compiler/build/compile'
import { compileCipoSourceInline, type CipoCompiledInlineSourceResult } from '../../compiler/inline/source-compile'
import { optimizeCompiledCss } from '../../engine/optimizer'
import { compileGlobalAtomicStyles } from '../../compiler/atomic/global'
import { compileCssConfigPayload } from '../../config-css/parse'
import type { CipoCompiledCssConfig } from '../../compiled-config'
import { hashString64 } from '../../utils'
import {
  applyEdits,
  ensureNamedImportBinding,
  findIdentifierCalls,
  findImportedBindings,
  getAvailableBindingName,
  removeUnusedNamedImports,
  type SourceEdit,
} from '../../compiler/source/index'
import { createLineSourceMap, type CipoSourceMap } from '../../compiler/source-map'
import { createCipoViteBuildState, resetCipoViteBuildState } from './build-state'
import { replaceCompiledClassLiterals } from './chunk-rewrite'

export interface CipoViteCompiledInlineOptions {
  readonly include?: RegExp | readonly RegExp[]
  readonly exclude?: RegExp | readonly RegExp[]
  /** @deprecated Runtime helpers now resolve through package entrypoints, not repository layout. */
  readonly root?: string
  readonly mode?: 'build' | 'inline'
  /** @deprecated Prefer CSS-first `@cipo { prefix: ... }` configuration. */
  readonly classPrefix?: string
  /** @deprecated Prefer CSS-first `@cipo { debug: true|false }` configuration. */
  readonly classNameMode?: 'readable' | 'compact'
  /** @deprecated Prefer CSS-first `@cipo { minify: true|false }` configuration. */
  readonly minifyCss?: boolean
  readonly mergeEquivalentRules?: boolean
  readonly privateCustomPropertyPattern?: RegExp
  readonly cssFileName?: string
  readonly manifestFileName?: string
  readonly cssDelivery?: 'style-tag' | 'asset'
  readonly transformCssTag?: boolean
  readonly compileFabrica?: boolean
  readonly directComponentReferences?: boolean
  readonly enabled?: boolean
  readonly evaluateStaticCss?: boolean
  readonly configCss?: string
  /** Identifier bindings that are known to contain exactly `configCss` and may be lowered safely. */
  readonly configRuntimeBindings?: readonly string[]
  /** Isolates compact class names across independently deployed bundles/microfrontends. */
  readonly buildNamespace?: string
}

export interface CipoViteFabricaCompileResult {
  readonly code: string
  readonly changed: boolean
  readonly manifest: readonly unknown[]
}

export interface CipoViteTransformResult {
  readonly code: string
  readonly map: CipoSourceMap
  readonly meta: {
    readonly cipo?: CipoCompiledBuildResult | CipoCompiledInlineSourceResult
    readonly fabrica?: CipoViteFabricaCompileResult
  }
}

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?$/
const DEFAULT_EXCLUDE = /(?:^|[/\\])node_modules(?:[/\\]|$)/
const VIRTUAL_CSS_ID = '\0cipo:compiled-style-tag.js'
const VIRTUAL_CSS_ASSET_ID = '\0cipo:compiled.css'
const GLOBAL_STYLESHEET_SENTINEL = '__CIPO_COMPILED_GLOBAL_STYLESHEET__'
const CIPO_COMPILED_RUNTIME = '@rodkisten/cipo/compiled-runtime'
const CIPO_COMPILER = '@rodkisten/cipo/compiler'
const FABRICA_COMPILER_RUNTIME = '@rodkisten/fabrica/compiler-runtime'
const CONFIG_IMPORT_MODULES = new Set(['@rodkisten/cipo'])

/** Vite adapter for Cipó/Fábrica compiled mode with per-build lifecycle state. */
export function cipoVite(options: CipoViteCompiledInlineOptions = {}): Plugin {
  const mode = options.mode ?? 'build'
  const wholeBuildAtomic = mode === 'build' && Boolean(options.configCss)
  const state = createCipoViteBuildState()
  const compiledConfigPayload = options.configCss ? compileCssConfigPayload(options.configCss) : null
  const buildNamespace = createBuildNamespace(options)

  const getFinalized = () => {
    if (!state.finalized) state.finalized = finalizeBuildStyles(state.atomicEntries, state.cssChunks, options, buildNamespace)
    return state.finalized
  }

  return {
    name: mode === 'build' ? 'cipo:compiled-build' : 'cipo:compiled-inline',
    enforce: 'pre',

    buildStart() {
      resetCipoViteBuildState(state)
    },

    resolveId(id) {
      if (id === VIRTUAL_CSS_ID) return { id: VIRTUAL_CSS_ID, moduleSideEffects: true }
      if (id === VIRTUAL_CSS_ASSET_ID) return { id: VIRTUAL_CSS_ASSET_ID, moduleSideEffects: true }
      return null
    },

    load(id) {
      if (id === VIRTUAL_CSS_ID) {
        return `import { insertCss } from ${JSON.stringify(CIPO_COMPILED_RUNTIME)};\ninsertCss(${JSON.stringify(GLOBAL_STYLESHEET_SENTINEL)});\n`
      }
      if (id === VIRTUAL_CSS_ASSET_ID) return wholeBuildAtomic ? '' : dedupeCssChunks(state.cssChunks)
      return null
    },

    transform(code, id) {
      if (options.enabled === false) return null
      const filename = cleanViteId(id)
      if (!matches(filename, options.include ?? DEFAULT_INCLUDE)) return null
      if (matches(filename, options.exclude ?? DEFAULT_EXCLUDE)) return null

      if (mode === 'inline') {
        const result = compileCipoSourceInline(code, {
          filename,
          importPath: CIPO_COMPILER,
          evaluateStaticCss: options.evaluateStaticCss ?? false,
        })
        if (!result.changed) return null
        state.manifests.push(...result.manifest)
        return {
          code: result.code,
          map: createLineSourceMap(code, result.code, filename),
          meta: { cipo: result },
        } satisfies CipoViteTransformResult
      }

      const runtimeConfig = compileRuntimeConfigCalls(
        code,
        compiledConfigPayload,
        filename,
        options.configRuntimeBindings ?? ['appConfigCss'],
      )

      const cipo = compileCipoSourceBuild(runtimeConfig.code, {
        filename,
        classPrefix: options.classPrefix,
        buildNamespace,
        classNameMode: options.classNameMode,
        minifyCss: options.minifyCss,
        mergeEquivalentRules: options.mergeEquivalentRules,
        privateCustomPropertyPattern: options.privateCustomPropertyPattern,
        deferAtomicCss: wholeBuildAtomic,
        coupleStyledCss: !wholeBuildAtomic && options.cssDelivery !== 'asset',
        styledCssHelperImportPath: CIPO_COMPILED_RUNTIME,
        cssImportId: wholeBuildAtomic ? VIRTUAL_CSS_ID : VIRTUAL_CSS_ASSET_ID,
        injectCssImport: wholeBuildAtomic ? options.cssDelivery !== 'asset' : options.cssDelivery === 'asset',
        transformCssTag: options.transformCssTag ?? true,
        configCss: options.configCss,
      })

      let nextCode = cipo.code
      if (!wholeBuildAtomic && cipo.css && options.cssDelivery !== 'asset') {
        nextCode = prependStyleTagInjection(nextCode, cipo.css)
      }

      const finalizeTransform = (fabrica?: CipoViteFabricaCompileResult): CipoViteTransformResult | null => {
        const finalCode = fabrica?.code ?? nextCode
        if (cipo.css) state.cssChunks.push(cipo.css)
        if (cipo.changed) {
          state.manifests.push(...cipo.manifest)
          if (wholeBuildAtomic) {
            for (const entry of cipo.manifest) {
              if (entry.kind === 'styled-css' || entry.kind === 'css-tag') state.atomicEntries.push(entry)
            }
            state.finalized = undefined
          }
        }
        if (fabrica?.changed) state.manifests.push(...fabrica.manifest)

        if (!runtimeConfig.changed && !cipo.changed && !fabrica?.changed) return null
        return {
          code: finalCode,
          map: createLineSourceMap(code, finalCode, filename),
          meta: { cipo, ...(fabrica ? { fabrica } : {}) },
        }
      }

      if (options.compileFabrica === false) return finalizeTransform()

      // Fábrica is an optional peer for runtime-only Cipó consumers. Load its compiler only
      // when this integration is actually requested, so importing `@rodkisten/cipo/vite`
      // remains valid without eagerly resolving the peer.
      return import('@rodkisten/fabrica/compiler').then(({ compileFabricaSource }) => {
        const fabrica = compileFabricaSource(nextCode, {
          filename,
          importPath: FABRICA_COMPILER_RUNTIME,
          directComponentReferences: options.directComponentReferences ?? false,
        }) as CipoViteFabricaCompileResult
        return finalizeTransform(fabrica)
      })
    },

    renderChunk(code, chunk) {
      if (!wholeBuildAtomic) return null
      const result = getFinalized()
      let nextCode = replaceCompiledClassLiterals(code, result.classNames, chunk.fileName)
      nextCode = replaceStylesheetSentinel(nextCode, result.css)
      if (nextCode === code) return null
      return {
        code: nextCode,
        map: createLineSourceMap(code, nextCode, chunk.fileName),
      }
    },

    generateBundle(_outputOptions, bundle) {
      if (!wholeBuildAtomic) {
        const css = dedupeCssChunks(state.cssChunks)
        if (options.cssDelivery === 'asset' && css.trim()) {
          this.emitFile({ type: 'asset', fileName: options.cssFileName ?? 'cipo.compiled.css', source: `${css.trim()}\n` })
        }
        if (state.manifests.length > 0) {
          this.emitFile({
            type: 'asset',
            fileName: options.manifestFileName ?? 'cipo.compiled.manifest.json',
            source: `${JSON.stringify({ mode, entries: state.manifests }, null, 2)}\n`,
          })
        }
        return
      }

      const result = getFinalized()
      for (const fileName in bundle) {
        const item = bundle[fileName]
        if (!item || item.type !== 'chunk' || typeof item.code !== 'string') continue
        item.code = replaceStylesheetSentinel(
          replaceCompiledClassLiterals(item.code, result.classNames, fileName),
          result.css,
        )
      }

      if (options.cssDelivery === 'asset' && result.css.trim()) {
        this.emitFile({ type: 'asset', fileName: options.cssFileName ?? 'cipo.compiled.css', source: `${result.css.trim()}\n` })
      }
      if (state.manifests.length > 0) {
        const entries = state.manifests.map((entry) => rewriteManifestClassName(entry, result.classNames))
        this.emitFile({
          type: 'asset',
          fileName: options.manifestFileName ?? 'cipo.compiled.manifest.json',
          source: `${JSON.stringify({ mode, entries }, null, 2)}\n`,
        })
      }
    },
  }
}

function finalizeBuildStyles(
  atomicEntries: readonly CipoCompiledBuildManifestEntry[],
  cssChunks: readonly string[],
  options: CipoViteCompiledInlineOptions,
  buildNamespace: string,
) {
  const atomic = compileGlobalAtomicStyles(
    atomicEntries.map((entry) => ({
      key: entry.id,
      className: entry.className,
      rawCss: entry.rawCss,
      filename: entry.filename,
      receiver: entry.receiver,
    })),
    { configCss: options.configCss, buildNamespace },
  )

  const css = optimizeCompiledCss(
    [atomic.css, ...cssChunks].filter(Boolean).join('\n'),
    {
      minify: options.minifyCss ?? atomic.minifyCss,
      mergeEquivalentRules: options.mergeEquivalentRules ?? true,
      privateCustomPropertyPattern: options.privateCustomPropertyPattern,
    },
  )

  return { css, classNames: atomic.classNames }
}

function prependStyleTagInjection(code: string, cssText: string): string {
  return [
    `import { insertCss as __cipoInsertCompiledCss } from ${JSON.stringify(CIPO_COMPILED_RUNTIME)};`,
    `__cipoInsertCompiledCss(${JSON.stringify(cssText)});`,
    code,
  ].join('\n')
}

function replaceStylesheetSentinel(code: string, css: string): string {
  return replaceCompiledClassLiterals(code, new Map([[GLOBAL_STYLESHEET_SENTINEL, css]]))
}

function rewriteManifestClassName(entry: unknown, classNames: ReadonlyMap<string, string>): unknown {
  if (!entry || typeof entry !== 'object') return entry
  const record = entry as Record<string, unknown>
  const className = typeof record.className === 'string' ? record.className : undefined
  const finalClassName = className ? classNames.get(className) : undefined
  return finalClassName ? { ...record, className: finalClassName } : entry
}

function dedupeCssChunks(chunks: readonly string[]): string {
  const seen = new Set<string>()
  const output: string[] = []
  for (const chunk of chunks) {
    const clean = chunk.trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    output.push(clean)
  }
  return output.join('\n')
}

function matches(value: string, pattern: RegExp | readonly RegExp[]): boolean {
  const test = (re: RegExp) => {
    if (re.global || re.sticky) re.lastIndex = 0
    return re.test(value)
  }
  return Array.isArray(pattern) ? pattern.some(test) : test(pattern as RegExp)
}

function cleanViteId(id: string): string {
  const queryIndex = id.indexOf('?')
  const file = queryIndex >= 0 ? id.slice(0, queryIndex) : id
  if (!file) return id
  if (file.startsWith('file://')) return decodeURIComponent(file.replace(/^file:\/\//, ''))
  return file
}

function compileRuntimeConfigCalls(
  source: string,
  configuredPayload: CipoCompiledCssConfig | null,
  filename: string,
  configuredBindingNames: readonly string[],
): { readonly code: string; readonly changed: boolean } {
  const configureBindings = findImportedBindings(source, 'configureFromCss', CONFIG_IMPORT_MODULES, filename)
  if (configureBindings.size === 0) return { code: source, changed: false }

  const calls = findIdentifierCalls(source, configureBindings, filename)
  const helperLocalName = getAvailableBindingName(source, '__cipoConfigureCompiledCss', filename)
  const configuredBindings = new Set(configuredBindingNames)
  const edits: SourceEdit[] = []
  const removableBindings = new Set<string>(configureBindings)

  for (const call of calls) {
    if (call.arguments.length !== 1) continue
    const argument = call.arguments[0]!
    let payload: CipoCompiledCssConfig | null = null

    // Literal calls are self-contained and can always be lowered from their exact source value.
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      payload = compileCssConfigPayload(argument.text)
    } else if (
      ts.isIdentifier(argument) &&
      configuredPayload &&
      configuredBindings.has(argument.text)
    ) {
      // Identifier calls are lowered only when the caller explicitly declares that the binding
      // represents the same source supplied through `configCss`. This avoids replacing unrelated
      // runtime configuration merely because it happens to call the same API.
      payload = configuredPayload
      removableBindings.add(argument.text)
    }

    if (!payload) continue
    edits.push({
      start: call.getStart(),
      end: call.getEnd(),
      value: `${helperLocalName}(${JSON.stringify(payload)})`,
    })
  }

  if (edits.length === 0) return { code: source, changed: false }

  let code = applyEdits(source, edits)
  code = removeUnusedNamedImports(code, removableBindings, filename)
  code = ensureNamedImportBinding(
    code,
    'configureCompiledCssConfig',
    CIPO_COMPILED_RUNTIME,
    helperLocalName,
    filename,
  ).code
  return { code, changed: true }
}

function createBuildNamespace(options: CipoViteCompiledInlineOptions): string {
  const source = options.buildNamespace ?? options.configCss ?? options.root ?? options.classPrefix ?? 'cipo'
  return hashString64(String(source)).slice(0, 6)
}
