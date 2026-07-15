import type { Plugin } from 'vite'
import { compileCipoSourceBuild, type CipoCompiledBuildResult } from '../compiler/compiled-build'
import { compileCipoSourceInline, type CipoCompiledInlineSourceResult } from '../compiler/compiled-inline'
import { compileFabricaSource, type FabricaCompileSourceResult } from '../../../fabrica/compiler'
import { installBuiltInAliases } from '../aliases'
import { installBuiltInHelpers } from '../helpers'
import { installNativePropertyGuards } from '../native-property-guards'

export interface CipoViteCompiledInlineOptions {
  readonly include?: RegExp | readonly RegExp[]
  readonly exclude?: RegExp | readonly RegExp[]
  readonly root?: string
  readonly mode?: 'build' | 'inline'
  readonly classPrefix?: string
  /** Production builds can emit compact hash-only class names instead of display-name labels. */
  readonly classNameMode?: 'readable' | 'compact'
  readonly minifyCss?: boolean
  readonly mergeEquivalentRules?: boolean
  readonly privateCustomPropertyPattern?: RegExp
  readonly cssFileName?: string
  /** Default keeps compiled CSS inside the JS bundle and injects it through Cipó's runtime style tag. */
  readonly cssDelivery?: 'style-tag' | 'asset'
  readonly transformCssTag?: boolean
  readonly compileFabrica?: boolean
  readonly enabled?: boolean
  readonly evaluateStaticCss?: boolean
  /** Optional Cipó configuration CSS applied before build-mode static CSS compilation. */
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

/** Vite adapter for Cipó/Fábrica compiled mode. */
export function cipoVite(options: CipoViteCompiledInlineOptions = {}): Plugin {
  const root = options.root ?? safeCwd()
  const mode = options.mode ?? 'build'
  const cssChunks: string[] = []
  const manifests: unknown[] = []

  return {
    name: mode === 'build' ? 'cipo:compiled-build' : 'cipo:compiled-inline',
    enforce: 'pre',

    resolveId(id) {
      if (id === VIRTUAL_CSS_ID) return VIRTUAL_CSS_ID
      if (id === VIRTUAL_CSS_ASSET_ID) return VIRTUAL_CSS_ASSET_ID
      return null
    },

    load(id) {
      if (id === VIRTUAL_CSS_ID) {
        const css = dedupeCss(cssChunks.join('\n'))
        const injectionPath = normalizePath(joinPath(root, 'src/cipo/src/injection.ts'))
        return `import { insertCss } from ${JSON.stringify(injectionPath)};\ninsertCss(${JSON.stringify(css)});\n`
      }
      if (id === VIRTUAL_CSS_ASSET_ID) return dedupeCss(cssChunks.join('\n'))
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
          importPath: createImportPath(filename, joinPath(root, 'src/cipo/src/compiler/compiled-inline.ts')),
          evaluateStaticCss: options.evaluateStaticCss ?? false,
        })
        if (!result.changed) return null
        manifests.push(...result.manifest)
        return { code: result.code, map: null, meta: { cipo: result } } satisfies CipoViteTransformResult
      }

      const cipo = compileCipoSourceBuild(code, {
        filename,
        classPrefix: options.classPrefix,
        classNameMode: options.classNameMode,
        minifyCss: options.minifyCss,
        mergeEquivalentRules: options.mergeEquivalentRules,
        privateCustomPropertyPattern: options.privateCustomPropertyPattern,
        coupleStyledCss: options.cssDelivery !== 'asset',
        styledCssHelperImportPath: createImportPath(filename, joinPath(root, 'src/cipo/src/compiler/compiled-style-runtime.ts')),
        cssImportId: VIRTUAL_CSS_ASSET_ID,
        injectCssImport: options.cssDelivery === 'asset',
        transformCssTag: options.transformCssTag ?? true,
        configCss: options.configCss,
      })

      let nextCode = cipo.code
      if (cipo.css && options.cssDelivery !== 'asset') {
        nextCode = prependStyleTagInjection(
          nextCode,
          cipo.css,
          createImportPath(filename, joinPath(root, 'src/cipo/src/injection.ts')),
        )
      }
      let fabrica: FabricaCompileSourceResult | undefined
      if (options.compileFabrica !== false) {
        fabrica = compileFabricaSource(nextCode, {
          filename,
          importPath: createImportPath(filename, joinPath(root, 'src/fabrica/compiler-runtime.ts')),
          directComponentReferences: true,
        })
        nextCode = fabrica.code
      }

      if (cipo.css) cssChunks.push(cipo.css)
      if (cipo.changed) manifests.push(...cipo.manifest)
      if (fabrica?.changed) manifests.push(...fabrica.manifest)

      if (!cipo.changed && !fabrica?.changed) return null
      return { code: nextCode, map: null, meta: { cipo, ...(fabrica ? { fabrica } : {}) } } satisfies CipoViteTransformResult
    },

    generateBundle() {
      const css = dedupeCss(cssChunks.join('\n'))
      if (options.cssDelivery === 'asset' && css.trim()) {
        this.emitFile({ type: 'asset', fileName: options.cssFileName ?? 'cipo.compiled.css', source: `${css.trim()}\n` })
      }
      if (manifests.length > 0) {
        this.emitFile({ type: 'asset', fileName: 'cipo.compiled.manifest.json', source: `${JSON.stringify({ mode, entries: manifests }, null, 2)}\n` })
      }
    },
  }
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
