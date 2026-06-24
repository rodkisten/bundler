import { runtime } from '../runtime'
import type { CipoAtomicRule, CipoDeclarationNode, CipoRuleContext } from '../types'
import { splitTopLevel } from '../utils'
import { createAtomicRule } from './atomic-compile'

/** Collects one declaration, expanding responsive `x:bp(value)` values when present. */
export function collectDeclaration(declaration: CipoDeclarationNode, context: CipoRuleContext, atoms: CipoAtomicRule[]): void {
  const responsive = expandResponsiveDeclaration(declaration)
  if (!responsive) {
    atoms.push(createAtomicRule(declaration, context))
    return
  }

  for (const item of responsive) {
    atoms.push(createAtomicRule({ ...declaration, value: item.value, source: `${declaration.property}:${item.value}` }, resolveBreakpointContext(context, item.breakpoint)))
  }
}

/** Expands a declaration value like `x:md(2rem), 1rem` into breakpoint values. */
export function expandResponsiveDeclaration(declaration: CipoDeclarationNode): Array<{ readonly breakpoint: string; readonly value: string }> | null {
  const parts = splitTopLevel(declaration.value, ',')
  const output: Array<{ readonly breakpoint: string; readonly value: string }> = []
  let hasResponsive = false

  for (const part of parts) {
    const match = part.trim().match(/^x:([a-zA-Z][\w-]*)\(([\s\S]*)\)$/)
    if (!match || match[1] === undefined || match[2] === undefined || !(match[1] in runtime.config.breakpoints)) {
      output.push({ breakpoint: 'base', value: part.trim() })
      continue
    }
    hasResponsive = true
    output.push({ breakpoint: match[1], value: match[2].trim() })
  }

  return hasResponsive ? output : null
}

/** Applies a configured breakpoint to an atomic rule context. */
export function resolveBreakpointContext(context: CipoRuleContext, breakpoint: string): CipoRuleContext {
  const mediaQuery = runtime.config.breakpoints[breakpoint]
  return mediaQuery ? { ...context, breakpoint, mediaQuery } : context
}
