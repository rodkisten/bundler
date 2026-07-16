import { insertCss } from '@rodkisten/cipo/injection'
import type { CipoCssArtifact } from '@rodkisten/cipo/types'

const EMPTY_LIST = Object.freeze([]) as readonly never[]

/**
 * Creates the lightweight runtime artifact used by build-compiled styled components.
 *
 * @remarks
 * Build mode has already done the expensive parsing, AST construction and rule
 * compilation. Recreating those structures in the browser would erase the size
 * and startup gains of compilation, so the runtime artifact keeps only the
 * metadata required by styled registries, style injection and public artifact
 * consumers.
 */
export function createCompiledCssArtifact(className: string, cssText: string): CipoCssArtifact {
  const debug = Object.freeze({
    id: `cipo-compiled-${className}`,
    ast: EMPTY_LIST,
    atoms: EMPTY_LIST,
    scopedRules: EMPTY_LIST,
    warnings: EMPTY_LIST,
  })

  return Object.freeze({
    kind: 'cipo.css' as const,
    className,
    scopeClassName: className,
    atoms: EMPTY_LIST,
    scopedRules: EMPTY_LIST,
    rawCss: '',
    transformedCss: '',
    compiledCss: cssText,
    debug,
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: 'CipoCssArtifact',
  })
}

/**
 * Couples a statically compiled styled component to its CSS side effect and
 * preserves the compiled artifact on the component metadata/registry.
 *
 * A PURE-annotated call can be removed together with an unused component,
 * while retained components still install their stylesheet exactly once.
 */
export function attachCompiledCss<T>(
  builder: (artifact: CipoCssArtifact) => T,
  className: string,
  cssText: string,
): T {
  insertCss(cssText)
  return builder(createCompiledCssArtifact(className, cssText))
}
