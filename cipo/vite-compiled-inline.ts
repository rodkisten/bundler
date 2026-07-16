import type { Plugin } from 'vite'
import { compileCipoSourceBuild, type CipoCompiledBuildManifestEntry, type CipoCompiledBuildResult } from '@rodkisten/cipo/compiler-compiled-build'
import { compileCipoSourceInline, type CipoCompiledInlineSourceResult } from '@rodkisten/cipo/compiler-compiled-inline'
import { compileGlobalAtomicStyles } from '@rodkisten/cipo/compiler-global-atomic'
import { optimizeCompiledCss } from '@rodkisten/cipo/compiler-compiled-css-optimizer'
import { compileFabricaSource, type FabricaCompileSourceResult } from '@rodkisten/fabrica/compiler'
import { installBuiltInAliases } from '@rodkisten/cipo/aliases'
import { installBuiltInHelpers } from '@rodkisten/cipo/helpers'
import { installNativePropertyGuards } from '@rodkisten/cipo/native-property-guards'
import { compileCssConfigPayload } from '@rodkisten/cipo/config-css'
import { runtime } from '@rodkisten/cipo/runtime'

export interface CipoViteCompiledInlineOptions {
  readonly include?: RegExp | readonly RegExp[]
  readonly exclude?: RegExp | readonly RegExp[]
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
  /** Default keeps one compiled stylesheet inside the JS bundle and injects it through Cipó's runtime style tag. */
  readonly cssDelivery?: 'style-tag' | 'asset'
  readonly transformCssTag?: boolean
  readonly compileFabrica?: boolean
  readonly enabled?: boolean
  readonly evaluateStaticCss?: boolean
  /** Authoritative CSS-first Cipó configuration applied before static compilation. */
  readonly configCss?: string
}

export interface CipoViteTransformResult {
  readonly code: string
  readonly map: null
  readonly meta: {
    readonly cipo?: CipoCompiledBuildResult | CipoCompiledInlineSourceResult
    readonly fabrica?: FabricaCompileSourceResult
  }
}

const BUILTINS_FLAG = '__cipoBuiltinsInstalled__'
const target = globalThis as unknown as Record<string, unknown>
if (!target[BUILTINS_FLAG]) {
  target[BUILTINS_FLAG] = true
  installBuiltInHelpers()
  installBuiltInAliases()
  installNativePropertyGuards()
}

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?$/
const DEFAULT_EXCLUDE = /(?:^|[/\\])node_modules(?:[/\\]|$)/
const VIRTUAL_CSS_ID = '\0cipo:compiled-style-tag.js'
const VIRTUAL_CSS_ASSET_ID = '\0cipo:compiled.css'
const GLOBAL_STYLESHEET_SENTINEL = '__CIPO_COMPILED_GLOBAL_STYLESHEET__'

/** Vite adapter for Cipó/Fábrica compiled mode. */
export function cipoVite(options: CipoViteCompiledInlineOptions = {}): Plugin {
  const root = options.root ?? safeCwd()
  const mode = options.mode ?? 'build'
  // Whole-build promotion is driven by a CSS-first config sheet. Integrations
  // without one keep the isolated legacy path for backwards compatibility.
  const wholeBuildAtomic = mode === 'build' && Boolean(options.configCss)
  const cssChunks: string[] = []
  const manifests: unknown[] = []
  const atomicEntries: CipoCompiledBuildManifestEntry[] = []
  const compiledConfigPayload = options.configCss ? compileCssConfigPayload(options.configCss) : null
  let finalized: ReturnType<typeof finalizeBuildStyles> | undefined

  const getFinalized = () => (
    finalized ?? (finalized = finalizeBuildStyles(atomicEntries, cssChunks, options))
  )

  return {
    name: mode === 'build' ? 'cipo:compiled-build' : 'cipo:compiled-inline',
    enforce: 'pre',

    resolveId(id) {
      if (id === VIRTUAL_CSS_ID) return { id: VIRTUAL_CSS_ID, moduleSideEffects: true }
      if (id === VIRTUAL_CSS_ASSET_ID) return { id: VIRTUAL_CSS_ASSET_ID, moduleSideEffects: true }
      return null
    },

    load(id) {
      if (id === VIRTUAL_CSS_ID) {
        const injectionPath = normalizePath(joinPath(root, 'cipo/injection.ts'))
        return `import { insertCss } from ${JSON.stringify(injectionPath)};\ninsertCss(${JSON.stringify(GLOBAL_STYLESHEET_SENTINEL)});\n`
      }
      if (id === VIRTUAL_CSS_ASSET_ID) return wholeBuildAtomic ? '' : dedupeCss(cssChunks.join('\n'))
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
          importPath: createImportPath(filename, joinPath(root, 'cipo/compiler-compiled-inline.ts')),
          evaluateStaticCss: options.evaluateStaticCss ?? false,
        })
        if (!result.changed) return null
        manifests.push(...result.manifest)
        return { code: result.code, map: null, meta: { cipo: result } } satisfies CipoViteTransformResult
      }

      const runtimeConfig = compiledConfigPayload
        ? compileRuntimeConfigCalls(
            code,
            compiledConfigPayload,
            createImportPath(filename, joinPath(root, 'cipo/compiled-config.ts')),
          )
        : { code, changed: false }

      const cipo = compileCipoSourceBuild(runtimeConfig.code, {
        filename,
        classPrefix: options.classPrefix,
        classNameMode: options.classNameMode,
        minifyCss: options.minifyCss,
        mergeEquivalentRules: options.mergeEquivalentRules,
        privateCustomPropertyPattern: options.privateCustomPropertyPattern,
        deferAtomicCss: wholeBuildAtomic,
        coupleStyledCss: !wholeBuildAtomic && options.cssDelivery !== 'asset',
        styledCssHelperImportPath: createImportPath(filename, joinPath(root, 'cipo/compiler-compiled-style-runtime.ts')),
        cssImportId: wholeBuildAtomic ? VIRTUAL_CSS_ID : VIRTUAL_CSS_ASSET_ID,
        injectCssImport: wholeBuildAtomic ? options.cssDelivery !== 'asset' : options.cssDelivery === 'asset',
        transformCssTag: options.transformCssTag ?? true,
        configCss: options.configCss,
      })

      let nextCode = cipo.code
      if (!wholeBuildAtomic && cipo.css && options.cssDelivery !== 'asset') {
        nextCode = prependStyleTagInjection(
          nextCode,
          cipo.css,
          createImportPath(filename, joinPath(root, 'cipo/injection.ts')),
        )
      }

      let fabrica: FabricaCompileSourceResult | undefined
      if (options.compileFabrica !== false) {
        fabrica = compileFabricaSource(nextCode, {
          filename,
          importPath: createImportPath(filename, joinPath(root, 'fabrica/compiler-runtime.ts')),
          directComponentReferences: true,
        })
        nextCode = fabrica.code
      }

      if (cipo.css) cssChunks.push(cipo.css)
      if (cipo.changed) {
        manifests.push(...cipo.manifest)
        if (wholeBuildAtomic) {
          for (let index = 0; index < cipo.manifest.length; index += 1) {
            const entry = cipo.manifest[index]!
            if (entry.kind === 'styled-css' || entry.kind === 'css-tag') atomicEntries.push(entry)
          }
          finalized = undefined
        }
      }
      if (fabrica?.changed) manifests.push(...fabrica.manifest)

      if (!runtimeConfig.changed && !cipo.changed && !fabrica?.changed) return null
      return { code: nextCode, map: null, meta: { cipo, ...(fabrica ? { fabrica } : {}) } } satisfies CipoViteTransformResult
    },

    renderChunk(code) {
      if (!wholeBuildAtomic) return null
      const result = getFinalized()
      let nextCode = code

      for (const [temporaryClassName, finalClassName] of result.classNames) {
        if (temporaryClassName === finalClassName || !nextCode.includes(temporaryClassName)) continue
        nextCode = nextCode.split(temporaryClassName).join(finalClassName)
      }

      if (nextCode.includes(GLOBAL_STYLESHEET_SENTINEL)) {
        nextCode = replaceStylesheetSentinel(nextCode, result.css)
      }

      return nextCode === code ? null : { code: nextCode, map: null }
    },

    generateBundle(_outputOptions, bundle) {
      if (!wholeBuildAtomic) {
        const css = dedupeCss(cssChunks.join('\n'))
        if (options.cssDelivery === 'asset' && css.trim()) {
          this.emitFile({ type: 'asset', fileName: options.cssFileName ?? 'cipo.compiled.css', source: `${css.trim()}\n` })
        }
        if (manifests.length > 0) {
          this.emitFile({ type: 'asset', fileName: 'cipo.compiled.manifest.json', source: `${JSON.stringify({ mode, entries: manifests }, null, 2)}\n` })
        }
        return
      }

      const result = getFinalized()

      // Safety net for output plugins that bypass renderChunk on synthetic chunks.
      for (const fileName in bundle) {
        const item = bundle[fileName]
        if (!item || item.type !== 'chunk') continue
        let code = item.code
        for (const [temporaryClassName, finalClassName] of result.classNames) {
          if (temporaryClassName !== finalClassName && code.includes(temporaryClassName)) {
            code = code.split(temporaryClassName).join(finalClassName)
          }
        }
        if (code.includes(GLOBAL_STYLESHEET_SENTINEL)) code = replaceStylesheetSentinel(code, result.css)
        item.code = code
      }

      if (options.cssDelivery === 'asset' && result.css.trim()) {
        this.emitFile({ type: 'asset', fileName: options.cssFileName ?? 'cipo.compiled.css', source: `${result.css.trim()}\n` })
      }
      if (manifests.length > 0) {
        const entries = manifests.map((entry) => rewriteManifestClassName(entry, result.classNames))
        this.emitFile({ type: 'asset', fileName: 'cipo.compiled.manifest.json', source: `${JSON.stringify({ mode, entries }, null, 2)}\n` })
      }
    },
  }
}

function finalizeBuildStyles(
  atomicEntries: readonly CipoCompiledBuildManifestEntry[],
  cssChunks: readonly string[],
  options: CipoViteCompiledInlineOptions,
) {
  const atomic = compileGlobalAtomicStyles(
    atomicEntries.map((entry) => ({
      key: entry.id,
      className: entry.className,
      rawCss: entry.rawCss,
      filename: entry.filename,
      receiver: entry.receiver,
    })),
    { configCss: options.configCss },
  )

  const css = optimizeCompiledCss(
    [atomic.css, ...cssChunks].filter(Boolean).join('\n'),
    {
      // When configCss exists it is authoritative. Legacy plugin flags remain a
      // fallback only for integrations that have not migrated to CSS-first config.
      minify: options.configCss ? runtime.config.minify : options.minifyCss ?? runtime.config.minify,
      mergeEquivalentRules: options.mergeEquivalentRules ?? true,
      privateCustomPropertyPattern: options.privateCustomPropertyPattern,
    },
  )

  return { css, classNames: atomic.classNames }
}

function prependStyleTagInjection(
  code: string,
  cssText: string,
  injectionImportPath: string,
): string {
  return [
    `import { insertCss as __cipoInsertCompiledCss } from ${JSON.stringify(injectionImportPath)};`,
    `__cipoInsertCompiledCss(${JSON.stringify(cssText)});`,
    code,
  ].join('\n')
}

function replaceStylesheetSentinel(code: string, css: string): string {
  const doubleQuoted = JSON.stringify(GLOBAL_STYLESHEET_SENTINEL)
  if (code.includes(doubleQuoted)) return code.split(doubleQuoted).join(JSON.stringify(css))

  const singleQuoted = `'${GLOBAL_STYLESHEET_SENTINEL}'`
  if (code.includes(singleQuoted)) return code.split(singleQuoted).join(JSON.stringify(css))

  return code
}

function rewriteManifestClassName(entry: unknown, classNames: ReadonlyMap<string, string>): unknown {
  if (!entry || typeof entry !== 'object') return entry
  const record = entry as Record<string, unknown>
  const className = typeof record.className === 'string' ? record.className : undefined
  const finalClassName = className ? classNames.get(className) : undefined
  return finalClassName ? { ...record, className: finalClassName } : entry
}

function dedupeCss(css: string): string {
  const seen = new Set<string>()
  const chunks = css.split(/\n(?=\.)/g)
  let output = ''
  for (const chunk of chunks) {
    const clean = chunk.trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    output += output ? `\n${clean}` : clean
  }
  return output
}

function matches(value: string, pattern: RegExp | readonly RegExp[]): boolean {
  const test = (re: RegExp) => {
    if (re.global || re.sticky) re.lastIndex = 0
    return re.test(value)
  }
  return isRegExpList(pattern) ? pattern.some(test) : test(pattern)
}

function isRegExpList(pattern: RegExp | readonly RegExp[]): pattern is readonly RegExp[] {
  return Array.isArray(pattern)
}

function cleanViteId(id: string): string {
  const queryIndex = id.indexOf('?')
  const file = queryIndex >= 0 ? id.slice(0, queryIndex) : id
  if (!file) return id
  if (file.startsWith('file://')) return decodeURIComponent(file.replace(/^file:\/\//, ''))
  return file
}

function createImportPath(filename: string, targetPath: string): string {
  if (filename.startsWith('\0')) return `file://${targetPath}`
  const fromDirectory = dirname(filename)
  let relative = relativePath(fromDirectory, targetPath).replace(/\\/g, '/')
  relative = relative.replace(/\.(?:mts|cts|ts|tsx|mjs|cjs|js|jsx)$/, '')
  if (!relative.startsWith('.')) relative = `./${relative}`
  return relative
}

function joinPath(...parts: readonly string[]): string {
  return normalizePath(parts.filter(Boolean).join('/'))
}

function dirname(value: string): string {
  const normalized = normalizePath(value)
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

function relativePath(from: string, to: string): string {
  const fromParts = normalizePath(from).split('/').filter(Boolean)
  const toParts = normalizePath(to).split('/').filter(Boolean)
  while (fromParts.length > 0 && toParts.length > 0 && fromParts[0] === toParts[0]) {
    fromParts.shift(); toParts.shift()
  }
  return [...fromParts.map(() => '..'), ...toParts].join('/') || '.'
}

function normalizePath(value: string): string {
  const absolute = value.startsWith('/')
  const parts: string[] = []
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `${absolute ? '/' : ''}${parts.join('/')}`
}

function safeCwd(): string {
  try { return (globalThis as unknown as { process?: { cwd?: () => string } }).process?.cwd?.() ?? '.' } catch { return '.' }
}

function compileRuntimeConfigCalls(
  source: string,
  payload: import('@rodkisten/cipo/compiled-config').CipoCompiledCssConfig,
  compiledConfigImportPath: string,
): { readonly code: string; readonly changed: boolean } {
  // A build-level config sheet is the authoritative source for these calls. The
  // identifier argument intentionally stays generic so consumers can name their
  // imported config constant freely without duplicating the CSS string in options.
  const callPattern = /\bconfigureFromCss\s*\(\s*[A-Za-z_$][\w$]*\s*\)/g
  if (!callPattern.test(source)) return { code: source, changed: false }

  const helper = '__cipoConfigureCompiledCss'
  const replaced = source.replace(callPattern, `${helper}(${JSON.stringify(payload)})`)
  const code = `import { configureCompiledCssConfig as ${helper} } from ${JSON.stringify(compiledConfigImportPath)};\n${replaced}`
  return { code, changed: true }
}
