import { runtime } from '../runtime'
import type { CipoAtomicRule, CipoDeclarationNode, CipoRuleContext } from '../types'
import { splitTopLevel } from '../utils'
import { createAtomicRule } from './atomic/rule'

/** Collects one declaration, expanding responsive `x:bp(value)` values when present. */
export function collectDeclaration(declaration: CipoDeclarationNode, context: CipoRuleContext, atoms: CipoAtomicRule[], forceImportant = false): void {
  const responsive = expandResponsiveDeclaration(declaration)
  if (!responsive) {
    atoms.push(createAtomicRule(declaration, context, forceImportant))
    return
  }

  for (const item of responsive) {
    atoms.push(createAtomicRule({ ...declaration, value: item.value, source: `${declaration.property}:${item.value}` }, resolveBreakpointContext(context, item.breakpoint), forceImportant))
  }
}

/** Expands a declaration value like `x:md(2rem), 1rem` into breakpoint values. */
export function expandResponsiveDeclaration(declaration: CipoDeclarationNode): Array<{ readonly breakpoint: string; readonly value: string }> | null {
  const parts = splitTopLevel(declaration.value, ',')
  const output: Array<{ readonly breakpoint: string; readonly value: string }> = []
  let hasResponsive = false

  for (const part of parts) {
    const responsive = parseResponsiveValue(part.trim())
    if (!responsive || !(responsive.breakpoint in runtime.config.breakpoints)) {
      output.push({ breakpoint: 'base', value: part.trim() })
      continue
    }
    hasResponsive = true
    output.push(responsive)
  }

  return hasResponsive ? output : null
}

/** Parses one exact `x:breakpoint(value)` wrapper without accepting trailing tokens. */
function parseResponsiveValue(input: string): { readonly breakpoint: string; readonly value: string } | null {
  const prefix = /^x:([a-zA-Z][\w-]*)\(/.exec(input)
  if (!prefix || prefix[1] === undefined) return null

  const openIndex = prefix[0].length - 1
  let depth = 1
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let index = openIndex + 1; index < input.length; index += 1) {
    const char = input[index]!
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) {
        if (input.slice(index + 1).trim()) return null
        return {
          breakpoint: prefix[1],
          value: input.slice(openIndex + 1, index).trim(),
        }
      }
    }
  }

  return null
}

/** Applies a configured breakpoint to an atomic rule context. */
export function resolveBreakpointContext(context: CipoRuleContext, breakpoint: string): CipoRuleContext {
  const mediaQuery = runtime.config.breakpoints[breakpoint]
  return mediaQuery ? { ...context, breakpoint, mediaQuery } : context
}
