import { compileCipoSourceInline, type CipoCompiledInlineSourceResult } from '../compiler/compiled-inline'

export interface CipoViteCompiledInlineOptions {
  readonly include?: RegExp | readonly RegExp[]
  readonly exclude?: RegExp | readonly RegExp[]
  readonly filenameImportPath?: string
}

export interface CipoViteTransformResult {
  readonly code: string
  readonly map: null
  readonly meta: { readonly cipo: CipoCompiledInlineSourceResult }
}

export interface CipoViteLikePlugin {
  readonly name: string
  readonly enforce: 'pre'
  transform(code: string, id: string): CipoViteTransformResult | null
}

const DEFAULT_INCLUDE = /\.[cm]?[jt]sx?$/
const DEFAULT_EXCLUDE = /(?:^|\/)node_modules\//

/** Vite adapter for the first Cipó compiled inline playground. */
export function cipoVite(options: CipoViteCompiledInlineOptions = {}): CipoViteLikePlugin {
  return {
    name: 'cipo:compiled-inline',
    enforce: 'pre',
    transform(code, id) {
      if (!matches(id, options.include ?? DEFAULT_INCLUDE)) return null
      if (matches(id, options.exclude ?? DEFAULT_EXCLUDE)) return null
      const result = compileCipoSourceInline(code, { filename: id, importPath: options.filenameImportPath })
      if (!result.changed) return null
      return { code: result.code, map: null, meta: { cipo: result } }
    },
  }
}

function matches(value: string, pattern: RegExp | readonly RegExp[]): boolean {
  const test = (re: RegExp) => {
    if (re.global || re.sticky) re.lastIndex = 0
    return re.test(value)
  }
  return Array.isArray(pattern) ? pattern.some(test) : test(pattern)
}
