import { runtime } from '../runtime'
import type { CipoRuleContext } from '../types'
import { createDeclaration, normalizeCss } from '../utils'

/** Compiles the selector for an atomic rule, including pseudo and dark contexts. */
export function compileSelector(className: string, context: CipoRuleContext): string {
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
  return output
}

/** Resolves a nested selector against the generated scope class. */
export function resolveScopedSelector(scopeClassName: string, selector: string): string {
  const localSelector = !selector
    ? `.${scopeClassName}`
    : selector.includes('&')
      ? selector.replaceAll('&', `.${scopeClassName}`)
      : `.${scopeClassName} ${selector}`
  return applyConfiguredScope(localSelector)
}

/** Applies the configured global scope to a selector with minimal specificity. */
export function applyConfiguredScope(selector: string): string {
  const scope = runtime.config.scope
  const prefix = scope.selector.trim()
  if (!prefix || scope.strategy === 'none') return selector
  if (scope.strategy === 'host') return `${prefix} ${selector}`
  if (scope.strategy === 'where') return `:where(${prefix}) ${selector}`
  return `${prefix} ${selector}`
}

/** Applies configured scoping to every selector in a selector list. */
export function applyConfiguredScopeToSelectors(selectors: readonly string[]): string[] {
  return selectors.map((selector) => applyConfiguredScope(selector))
}

/** Stable identity for atomic rule cache entries. */
export function createAtomicRuleId(property: string, value: string, context: CipoRuleContext): string {
  return [normalizeCss(property), normalizeCss(value), context.mediaQuery ?? '', context.pseudo ?? '', context.dark ? 'dark' : '', context.notBreakpoint ?? '', context.supports ?? '', context.container ?? ''].join('|')
}

/** Emits a single CSS declaration. Kept here for selector/rule unit tests. */
export function emitDeclaration(property: string, value: string): string {
  return createDeclaration(property, value)
}
