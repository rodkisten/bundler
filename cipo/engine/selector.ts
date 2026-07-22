import { runtime } from '../runtime'
import type { CipoRuleContext } from '../types'
import { canonicalizeCssForIdentity } from '../syntax/css-lexer'
import { normalizeFabricaSelectorSyntax } from './fabrica-selector-syntax'

/** Compiles an atomic selector, including pseudo and dark contexts. */
export function compileSelector(
  className: string,
  context: CipoRuleContext,
): string {
  let selector = `.${className}`
  if (context.pseudo) selector += context.pseudo
  if (context.dark) selector = `${runtime.config.darkSelector} ${selector}`
  return applyConfiguredScope(selector)
}

/** Wraps a rule with media/supports/container/layer contexts. */
export function wrapContext(rule: string, context: CipoRuleContext): string {
  let output = rule
  if (context.mediaQuery) output = `@media ${context.mediaQuery}{${output}}`
  if (context.notBreakpoint) {
    const query = runtime.config.breakpoints[context.notBreakpoint]
    if (query) output = `@media not all and ${query}{${output}}`
  }
  if (context.supports) output = `@supports ${context.supports}{${output}}`
  if (context.container) output = `@container ${context.container}{${output}}`
  if (context.layer) output = `@layer ${context.layer}{${output}}`
  if (context.startingStyle) output = `@starting-style{${output}}`
  return output
}

/** Resolves a nested selector against its generated scope and rule context. */
export function resolveScopedSelector(
  scopeClassName: string,
  selector: string,
  context: CipoRuleContext = {},
): string {
  const normalizedSelector = normalizeFabricaSelectorSyntax(selector)
  let localSelector = !normalizedSelector
    ? `.${scopeClassName}`
    : normalizedSelector.includes('&')
      ? normalizedSelector.replaceAll('&', `.${scopeClassName}`)
      : `.${scopeClassName} ${normalizedSelector}`

  if (context.pseudo) localSelector += context.pseudo
  if (context.dark) {
    localSelector = `${runtime.config.darkSelector} ${localSelector}`
  }

  return applyConfiguredScope(localSelector)
}

/** Applies the configured global scope with minimal specificity. */
export function applyConfiguredScope(selector: string): string {
  const scope = runtime.config.scope
  const prefix = scope.selector.trim()
  if (!prefix || scope.strategy === 'none') return selector
  if (scope.strategy === 'host') return `${prefix} ${selector}`
  if (scope.strategy === 'where') return `:where(${prefix}) ${selector}`
  return `${prefix} ${selector}`
}

/** Applies configured scoping to every selector in a selector list. */
export function applyConfiguredScopeToSelectors(
  selectors: readonly string[],
): string[] {
  return selectors.map((selector) => applyConfiguredScope(selector))
}

/** Stable identity for atomic rule cache entries. */
export function createAtomicRuleId(
  property: string,
  value: string,
  context: CipoRuleContext,
): string {
  return [
    canonicalizeCssForIdentity(property),
    canonicalizeCssForIdentity(value),
    context.mediaQuery ?? '',
    context.pseudo ?? '',
    context.dark ? 'dark' : '',
    context.notBreakpoint ?? '',
    context.supports ?? '',
    context.container ?? '',
    context.layer ?? '',
    context.startingStyle ? 'starting-style' : '',
  ].join('|')
}
