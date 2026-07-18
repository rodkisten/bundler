import type { CipoRuleContext } from '../types'

/** Compiler intermediate representation for one normalized CSS declaration. */
export interface CipoCompiledDeclaration {
  readonly property: string
  readonly value: string
}

/**
 * Compiler intermediate representation for a style rule.
 *
 * @remarks
 * Optimizers and emitters operate on this structure instead of reparsing strings whenever the
 * compiler owns the rule. Arbitrary user stylesheets can still enter as source text, but generated
 * atomic/scoped output remains structural until final serialization.
 */
export interface CipoCompiledRule {
  readonly selectors: readonly string[]
  readonly declarations: readonly CipoCompiledDeclaration[]
  readonly context: Readonly<CipoRuleContext>
}

/** Creates an immutable rule IR node. */
export function createCompiledRule(
  selectors: readonly string[],
  declarations: readonly CipoCompiledDeclaration[],
  context: Readonly<CipoRuleContext> = {},
): CipoCompiledRule {
  return Object.freeze({
    selectors: Object.freeze([...selectors]),
    declarations: Object.freeze(declarations.map((declaration) => Object.freeze({ ...declaration }))),
    context: Object.freeze({ ...context }),
  })
}
