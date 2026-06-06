import { runtime } from './runtime'
import type { AliasScale, CipoDeclarationNode, CipoHelperContext } from './types'
import { resolveThemeReferences } from './theme'
import { createDeclaration, isPlainNumber, parseFunctionCall, splitTopLevel, warn } from './utils'
import { normalizePxValues } from './helpers'

const TEXT_SIZE_TOKENS = new Set(['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'])
const RADIUS_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full', 'pill'])
const SHADOW_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'glow', 'panel', 'neon'])

/**
 * Normalizes a property/value pair into one or more real CSS declarations.
 *
 * @param rawProperty - DSL or real CSS property.
 * @param rawValue - CSS value.
 * @returns Declaration nodes.
 *
 * @example
 * ```ts
 * normalizePropertyDeclaration('px', '4')
 * // [{ property: 'padding-inline', value: 'calc(var(--cipo-spacing) * 4)' }]
 * ```
 */
export function normalizePropertyDeclaration(rawProperty: string, rawValue: string): CipoDeclarationNode[] {
  if (rawProperty === 'text') {
    return parseGeneratedDeclarations(expandText(rawValue))
  }

  const alias = runtime.propertyAliasRegistry.get(rawProperty)
  const property = alias?.property ?? rawProperty
  const scale = alias?.scale ?? 'none'
  const value = normalizeValue(property, rawValue, scale)

  return [{ type: 'declaration', property, value, source: `${rawProperty}:${rawValue}` }]
}

/**
 * Resolves theme tokens, helpers, REM conversion and scale shortcuts.
 *
 * @param property - Final CSS property.
 * @param rawValue - Raw value.
 * @param scale - Value scale hint.
 * @returns Normalized CSS value.
 */
export function normalizeValue(property: string, rawValue: string, scale: AliasScale = 'none'): string {
  const value = resolveHelpers(resolveThemeReferences(rawValue.trim()))

  if (scale === 'spacing' && isPlainNumber(value)) return `calc(var(--${runtime.config.prefix}-spacing, 0.25rem) * ${value})`
  if (scale === 'radius' && RADIUS_TOKENS.has(value)) return `var(--${runtime.config.prefix}-radius-${value})`
  if (scale === 'shadow' && SHADOW_TOKENS.has(value)) return `var(--${runtime.config.prefix}-shadow-${value})`
  if (scale === 'text' && TEXT_SIZE_TOKENS.has(value)) return `var(--${runtime.config.prefix}-text-${value})`

  return normalizePxValues(value)
}

/**
 * Resolves helper calls by scanning balanced parentheses instead of regex.
 *
 * @param input - CSS value.
 * @returns Value with helper calls expanded.
 *
 * @example
 * ```ts
 * resolveHelpers('alpha(var(--x) / 20%)')
 * // 'color-mix(in oklch, var(--x) 20%, transparent)'
 * ```
 */
export function resolveHelpers(input: string): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const start = findHelperStart(input, index)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)
    const nameStart = input[start] === 'x' && input[start + 1] === ':' ? start + 2 : start
    const openIndex = input.indexOf('(', nameStart)
    if (openIndex < 0) {
      output += input.slice(start)
      break
    }

    const name = input.slice(nameStart, openIndex)
    const closeIndex = findMatchingParen(input, openIndex)
    if (closeIndex < 0) {
      output += input.slice(start)
      break
    }

    const args = input.slice(openIndex + 1, closeIndex)
    const helper = runtime.helperRegistry.get(name)

    if (!helper) {
      output += input.slice(start, closeIndex + 1)
    } else {
      const context: CipoHelperContext = {
        name,
        raw: args,
        config: runtime.config,
        resolveValue(value: string, property = 'helper') {
          return normalizeValue(property, value)
        },
      }
      output += helper(args, context)
    }

    index = closeIndex + 1
  }

  return output === input ? normalizePxValues(input) : resolveHelpers(output)
}

/**
 * Expands the typography helper into standard CSS declarations.
 *
 * @param args - text(...) arguments.
 * @returns CSS declarations.
 *
 * @example
 * ```ts
 * expandText('size: lg, weight: 800, $brand, underline')
 * // 'font-size:var(--cipo-text-lg);font-weight:800;color:var(--...);text-decoration-line:underline;'
 * ```
 */
export function expandText(args: string): string {
  const parts = splitTopLevel(args, ',')
  const typed: Record<string, string> = {}
  let output = ''

  for (const part of parts) {
    const call = parseFunctionCall(part)
    const colonIndex = part.indexOf(':')

    if (colonIndex > 0 && !call) {
      typed[part.slice(0, colonIndex).trim()] = part.slice(colonIndex + 1).trim()
      continue
    }

    const token = part.trim()
    if (!token) continue

    if (token === 'underline') output += createDeclaration('text-decoration-line', 'underline')
    else if (token === 'no-underline') output += createDeclaration('text-decoration-line', 'none')
    else if (['uppercase', 'lowercase', 'capitalize'].includes(token)) output += createDeclaration('text-transform', token)
    else if (isColorLike(token)) output += createDeclaration('color', normalizeValue('color', token, 'color'))
    else if (token.startsWith('gradient(')) {
      output += createDeclaration('background-image', normalizeValue('background-image', token))
      output += createDeclaration('-webkit-background-clip', 'text')
      output += createDeclaration('background-clip', 'text')
      output += createDeclaration('color', 'transparent')
    }
  }

  if (typed.size) output += createDeclaration('font-size', TEXT_SIZE_TOKENS.has(typed.size) ? `var(--${runtime.config.prefix}-text-${typed.size})` : normalizeValue('font-size', typed.size))
  if (typed.lh || typed.leading) output += createDeclaration('line-height', typed.lh ?? typed.leading ?? '')
  if (typed.weight) output += createDeclaration('font-weight', typed.weight)
  if (typed.color) output += createDeclaration('color', normalizeValue('color', typed.color, 'color'))
  if (typed.align) output += createDeclaration('text-align', typed.align)
  if (typed.decoration) output += createDeclaration('text-decoration-line', typed.decoration)
  if (typed.shadow) output += createDeclaration('text-shadow', normalizeValue('text-shadow', typed.shadow, 'shadow'))
  if (typed.tracking) output += createDeclaration('letter-spacing', normalizeValue('letter-spacing', typed.tracking))
  if (typed.transform) output += createDeclaration('text-transform', typed.transform)
  if (typed.wrap) output += createDeclaration('text-wrap', typed.wrap)
  if (typed.fill) {
    output += createDeclaration('background-image', normalizeValue('background-image', typed.fill))
    output += createDeclaration('-webkit-background-clip', 'text')
    output += createDeclaration('background-clip', 'text')
    output += createDeclaration('color', 'transparent')
  }

  return output
}

export function parseGeneratedDeclarations(cssText: string): CipoDeclarationNode[] {
  return cssText.split(';').map(part => part.trim()).filter(Boolean).flatMap(part => {
    const colonIndex = part.indexOf(':')
    if (colonIndex <= 0) return []
    const property = part.slice(0, colonIndex).trim()
    const value = part.slice(colonIndex + 1).trim()
    return [{ type: 'declaration' as const, property, value, source: part }]
  })
}

function findHelperStart(input: string, fromIndex: number): number {
  for (let index = fromIndex; index < input.length; index += 1) {
    const char = input[index] ?? ''
    if (!/[a-zA-Z]/.test(char)) continue

    const maybePrefix = input.slice(index, index + 2) === 'x:' ? index + 2 : index
    const openIndex = input.indexOf('(', maybePrefix)
    if (openIndex < 0) return -1
    const name = input.slice(maybePrefix, openIndex)
    if (/^[a-zA-Z][\w-]*$/.test(name) && runtime.helperRegistry.has(name)) return index
  }

  return -1
}

function findMatchingParen(input: string, openIndex: number): number {
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    if (depth === 0) return index
  }

  return -1
}

function isColorLike(value: string): boolean {
  return value.startsWith('$') || value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || value.startsWith('oklch') || value.startsWith('oklab') || value === 'transparent' || value === 'currentColor'
}
