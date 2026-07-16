import { insertCss, registerAtomicArtifact } from '@rodkisten/cipo/injection'
import type { CipoAtomicRule, CipoCssArtifact, CipoRuleContext, CipoScopedRule } from '@rodkisten/cipo/types'

const EMPTY_LIST = Object.freeze([]) as readonly never[]

/** Compact build payload for one compiled atomic rule. */
export type CipoCompiledAtomicRule = readonly [
  id: string,
  className: string,
  property: string,
  value: string,
  context: CipoRuleContext,
]

/** Compact build payload for one scoped declaration. */
export type CipoCompiledDeclaration = readonly [property: string, value: string]

/** Compact build payload for one scoped rule. */
export type CipoCompiledScopedRule = readonly [
  selector: string,
  declarations: readonly CipoCompiledDeclaration[],
  context: CipoRuleContext,
]

/** Parser-free payload emitted for a build-compiled styled component. */
export type CipoCompiledStylePayload = readonly [
  className: string,
  scopeClassName: string,
  atoms: readonly CipoCompiledAtomicRule[],
  scopedRules: readonly CipoCompiledScopedRule[],
]

/**
 * Rehydrates the lightweight atomic metadata produced by the build compiler.
 *
 * No CSS parser, AST or source stylesheet is shipped. The metadata is just enough
 * for the shared runtime atomic program to count cross-component reuse and emit
 * one final stylesheet.
 */
export function createCompiledCssArtifact(payload: CipoCompiledStylePayload): CipoCssArtifact
/** @deprecated Compatibility overload for older pre-shared compiled output. */
export function createCompiledCssArtifact(className: string, cssText: string): CipoCssArtifact
export function createCompiledCssArtifact(
  payloadOrClassName: CipoCompiledStylePayload | string,
  cssText = '',
): CipoCssArtifact {
  if (typeof payloadOrClassName === 'string') {
    const className = payloadOrClassName
    return Object.freeze({
      kind: 'cipo.css' as const,
      className,
      scopeClassName: className,
      atoms: EMPTY_LIST,
      scopedRules: EMPTY_LIST,
      rawCss: '',
      transformedCss: '',
      compiledCss: cssText,
      debug: Object.freeze({
        id: `cipo-compiled-${className}`,
        ast: EMPTY_LIST,
        atoms: EMPTY_LIST,
        scopedRules: EMPTY_LIST,
        warnings: EMPTY_LIST,
      }),
      toString: () => className,
      [Symbol.toPrimitive]: () => className,
      [Symbol.toStringTag]: 'CipoCssArtifact',
    })
  }

  const [className, scopeClassName, atomTuples, scopedTuples] = payloadOrClassName
  const atoms: CipoAtomicRule[] = atomTuples.map(([id, atomClassName, property, value, context]) => ({
    id,
    className: atomClassName,
    property,
    value,
    context,
    source: '',
  }))
  const scopedRules: CipoScopedRule[] = scopedTuples.map(([selector, declarations, context]) => ({
    selector,
    declarations: declarations.map(([property, value]) => ({
      type: 'declaration' as const,
      property,
      value,
      source: '',
    })),
    context,
  }))

  const artifact: CipoCssArtifact = Object.freeze({
    kind: 'cipo.css' as const,
    className,
    scopeClassName,
    atoms: Object.freeze(atoms),
    scopedRules: Object.freeze(scopedRules),
    rawCss: '',
    transformedCss: '',
    compiledCss: '',
    debug: Object.freeze({
      id: `cipo-compiled-${scopeClassName}`,
      ast: EMPTY_LIST,
      atoms: Object.freeze(atoms),
      scopedRules: Object.freeze(scopedRules),
      warnings: EMPTY_LIST,
    }),
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: 'CipoCssArtifact',
  })

  return artifact
}

/**
 * Couples a statically compiled styled component to the shared atomic registry.
 *
 * A PURE-annotated call can still be removed together with unused component JS.
 * Retained components register only compact rule metadata; the runtime emits one
 * stylesheet and promotes atoms according to the CSS-first `atomic-min-uses`
 * configuration.
 */
export function attachCompiledCss<T>(
  builder: (artifact: CipoCssArtifact) => T,
  payload: CipoCompiledStylePayload,
): T
/** @deprecated Compatibility overload for older generated bundles. */
export function attachCompiledCss<T>(
  builder: (artifact: CipoCssArtifact) => T,
  className: string,
  cssText: string,
): T
export function attachCompiledCss<T>(
  builder: (artifact: CipoCssArtifact) => T,
  payloadOrClassName: CipoCompiledStylePayload | string,
  cssText = '',
): T {
  if (typeof payloadOrClassName === 'string') {
    insertCss(cssText)
    return builder(createCompiledCssArtifact(payloadOrClassName, cssText))
  }

  const artifact = createCompiledCssArtifact(payloadOrClassName)
  registerAtomicArtifact(artifact)
  return builder(artifact)
}
