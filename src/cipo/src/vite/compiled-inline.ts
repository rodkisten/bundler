import type { Plugin } from 'vite'
import { compileCipoSourceInline, type CipoCompiledInlineSourceResult } from '../compiler/compiled-inline'

export interface CipoViteCompiledInlineOptions {
  readonly include?: RegExp | readonly RegExp[]
  readonly exclude?: RegExp | readonly RegExp[]
  /** Project root. Defaults to `process.cwd()` when available. */
  readonly root?: string
  /** Absolute compiler module path used for generated imports. */
  readonly compilerPath?: string
  /** Explicit import specifier. When omitted, a relative path is computed per file. */
  readonly importPath?: string
  /** Enables the transform. Defaults to true. */
  readonly enabled?: boolean
  /** Evaluate static CSS in transform metadata. Defaults to false for quiet production builds. */
  readonly evaluateStaticCss?: boolean
}

export interface CipoViteTransformResult {
  readonly code: string
  readonly map: null
  readonly meta: { readonly cipo: CipoCompiledInlineSourceResult }
}

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?$/
const DEFAULT_EXCLUDE = /(?:^|[/\\])node_modules(?:[/\\]|$)/

/**
 * Vite adapter for Cipó compiled-inline mode.
 *
 * @remarks
 * The plugin does not emit CSS files yet. It rewrites styled `.css` templates
 * to explicit `compiledInlineCss` artifact calls and lets the existing Cipó
 * inline compiler own parsing, helpers, aliases, theme variables and warnings.
 */
export function cipoVite(options: CipoViteCompiledInlineOptions = {}): Plugin {
  const root = options.root ?? safeCwd()
  const compilerPath = options.compilerPath ?? joinPath(root, 'src/cipo/src/compiler/compiled-inline.ts')

  return {
    name: 'cipo:compiled-inline',
    enforce: 'pre',
    transform(code, id) {
      if (options.enabled === false) return null
      const filename = cleanViteId(id)
      if (!matches(filename, options.include ?? DEFAULT_INCLUDE)) return null
      if (matches(filename, options.exclude ?? DEFAULT_EXCLUDE)) return null

      const result = compileCipoSourceInline(code, {
        filename,
        importPath: options.importPath ?? createImportPath(filename, compilerPath),
        evaluateStaticCss: options.evaluateStaticCss ?? false,
      })

      if (!result.changed) return null
      return { code: result.code, map: null, meta: { cipo: result } } satisfies CipoViteTransformResult
    },
  }
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

function createImportPath(filename: string, compilerPath: string): string {
  if (filename.startsWith('\0')) return `file://${compilerPath}`
  const fromDirectory = dirname(filename)
  let relative = relativePath(fromDirectory, compilerPath).replace(/\\/g, '/')
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
    fromParts.shift()
    toParts.shift()
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
  try { return process.cwd() } catch { return '.' }
}
