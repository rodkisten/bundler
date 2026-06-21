import { runtime } from './runtime'
import type { AliasScale, CipoDeclarationNode, CipoHelperContext } from './types'
import { resolveThemeReferencesForValue } from './theme'
import { createDeclaration, findTopLevelColon, isPlainNumber, parseFunctionCall, splitTopLevel, toKebabMixed } from './utils'
import { getTypedInitialValue, normalizeCustomPropertyName, normalizeTypedCssValue, property as registerCssProperty } from './properties'
import { normalizePxValues } from './helpers'

const TEXT_SIZE_TOKENS = new Set(['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'])
const RADIUS_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full', 'pill'])
const SHADOW_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'glow', 'panel', 'neon'])
const MAX_HELPER_PASSES = 12

/**
 * Normalizes a property/value pair into one or more real CSS declarations.
 *
 * @remarks
 * Property aliases are resolved here, not in the parser, so the parser can stay
 * a very small tokenizer. A leading `#` is accepted as an escape hatch for raw
 * CSS properties in the DSL. This makes examples such as
 * `#box-shadow: outlineGlow($brand)` work even when a shortcut with the same
 * semantic name exists now or later.
 *
 * @param rawProperty - DSL or real CSS property.
 * @param rawValue - CSS value.
 * @returns Declaration nodes.
 *
 * @example Optional semicolons
 * ```ts
 * css`
 *   px: 4
 *   py: 2
 *   bg: $brand
 * `
 * ```
 *
 * Output CSS contains:
 * ```css
 * padding-inline: calc(var(--cipo-spacing, 0.25rem) * 4);
 * padding-block: calc(var(--cipo-spacing, 0.25rem) * 2);
 * background: var(--cipo-colors-brand);
 * ```
 *
 * @example Raw property escape
 * ```ts
 * css`
 *   #box-shadow: outlineGlow($brand)
 * `
 * ```
 *
 * Output CSS contains:
 * ```css
 * box-shadow: 0 0 0 3px color-mix(...);
 * ```
 */
export function normalizePropertyDeclaration(rawProperty: string, rawValue: string): CipoDeclarationNode[] {
  let propertyKey = rawProperty.trim()
  let forceRawProperty = false

  if (propertyKey[0] === '#') {
    forceRawProperty = true
    propertyKey = propertyKey.slice(1).trim()
  }

  if (propertyKey.startsWith('$$')) {
    const customProperty = normalizeCustomPropertyName(propertyKey)
    const typedValue = normalizeTypedCssValue(rawValue)
    if (typedValue) {
      registerCssProperty(customProperty, {
        syntax: typedValue.syntax,
        inherits: typedValue.inherits,
        initialValue: typedValue.initialValue,
      })
      return [{ type: 'declaration', property: customProperty, value: getTypedInitialValue(typedValue), source: `${rawProperty}:${rawValue}` }]
    }
    return [{ type: 'declaration', property: customProperty, value: normalizeValue('theme-token', rawValue), source: `${rawProperty}:${rawValue}` }]
  }

  if (propertyKey === 'text') {
    return parseGeneratedDeclarations(expandText(rawValue))
  }

  const lookupKey = runtime.propertyAliasRegistry.has(propertyKey) ? propertyKey : propertyKey.toLowerCase()
  const alias = forceRawProperty ? undefined : runtime.propertyAliasRegistry.get(lookupKey)
  const property = alias?.property ?? propertyKey
  const scale = alias?.scale ?? 'none'
  const value = normalizeValue(property, rawValue, scale)

  return [{ type: 'declaration', property, value, source: `${rawProperty}:${rawValue}` }]
}

/**
 * Resolves theme tokens, helpers, REM conversion and scale shortcuts.
 *
 * @remarks
 * This is hot code. It avoids recursive helper expansion because recursive
 * expansion made nested helpers such as `outlineGlow($brand)` → `alpha(...)`
 * capable of hammering mobile Safari. Helpers now run through a bounded,
 * iterative scanner.
 *
 * @param property - Final CSS property.
 * @param rawValue - Raw value.
 * @param scale - Value scale hint.
 * @returns Normalized CSS value.
 */
export function normalizeValue(property: string, rawValue: string, scale: AliasScale = 'none'): string {
  const resolved = resolveHelpers(resolveThemeReferencesForValue(rawValue.trim(), property, scale))

  if (scale === 'spacing' && isPlainNumber(resolved)) return `calc(var(--${runtime.config.prefix}-spacing, 0.25rem) * ${resolved})`
  if (scale === 'radius' && RADIUS_TOKENS.has(resolved)) return `var(--${runtime.config.prefix}-radius-${resolved})`
  if (scale === 'shadow' && SHADOW_TOKENS.has(resolved)) return `var(--${runtime.config.prefix}-shadow-${resolved})`
  if (scale === 'text' && TEXT_SIZE_TOKENS.has(resolved)) return `var(--${runtime.config.prefix}-text-${resolved})`

  return normalizePxValues(resolved)
}

/**
 * Resolves helper calls by scanning balanced parentheses instead of regex.
 *
 * @remarks
 * The scanner only looks at real identifier/function starts and bails out after
 * a small number of passes. It supports both the promoted syntax
 * `alpha($brand / 20%)` and the legacy `x:alpha($brand / 20%)` syntax.
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
  let current = input

  for (let pass = 0; pass < MAX_HELPER_PASSES; pass += 1) {
    const next = resolveHelpersOnePass(current)
    if (next === current) return normalizePxValues(next)
    current = next
  }

  return normalizePxValues(current)
}

function resolveHelpersOnePass(input: string): string {
  let output = ''
  let index = 0
  let changed = false

  while (index < input.length) {
    const start = findHelperStart(input, index)

    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)

    const hasLegacyPrefix = input[start] === 'x' && input[start + 1] === ':'
    const nameStart = hasLegacyPrefix ? start + 2 : start
    const openIndex = readIdentifierEnd(input, nameStart)

    if (input[openIndex] !== '(') {
      output += input[start]
      index = start + 1
      continue
    }

    const name = input.slice(nameStart, openIndex)
    const closeIndex = findMatchingParen(input, openIndex)

    if (closeIndex < 0) {
      output += input.slice(start)
      break
    }

    const helper = runtime.helperRegistry.get(name)

    if (!helper) {
      output += input.slice(start, closeIndex + 1)
      index = closeIndex + 1
      continue
    }

    const args = input.slice(openIndex + 1, closeIndex)
    const context: CipoHelperContext = {
      name,
      raw: args,
      config: runtime.config,
      resolveValue(value: string, property = 'helper') {
        return normalizeValue(property, value)
      },
    }

    output += helper(args, context)
    changed = true
    index = closeIndex + 1
  }

  return changed ? output : input
}

/**
 * Expands the typography helper into standard CSS declarations.
 *
 * @param args - text(...) arguments.
 * @returns CSS declarations.
 */
export function expandText(args: string): string {
  const parts = splitTopLevel(args, ',')
  const typed: Record<string, string> = {}
  let output = ''

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? ''
    const call = parseFunctionCall(part)
    const colonIndex = findTopLevelColon(part)

    if (colonIndex > 0 && !call) {
      typed[part.slice(0, colonIndex).trim()] = part.slice(colonIndex + 1).trim()
      continue
    }

    const token = part.trim()
    if (!token) continue

    if (token === 'underline') output += createDeclaration('text-decoration-line', 'underline')
    else if (token === 'no-underline') output += createDeclaration('text-decoration-line', 'none')
    else if (token === 'uppercase' || token === 'lowercase' || token === 'capitalize') output += createDeclaration('text-transform', token)
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
  const output: CipoDeclarationNode[] = []
  let start = 0

  for (let index = 0; index <= cssText.length; index += 1) {
    if (index < cssText.length && cssText[index] !== ';') continue

    const part = cssText.slice(start, index).trim()
    start = index + 1
    if (!part) continue

    const colonIndex = findTopLevelColon(part)
    if (colonIndex <= 0) continue

    output.push({
      type: 'declaration',
      property: part.slice(0, colonIndex).trim(),
      value: part.slice(colonIndex + 1).trim(),
      source: part,
    })
  }

  return output
}

/**
 * Checks whether a function name belongs to CSS itself rather than Cipó.
 *
 * @remarks
 * The function name is normalized to lowercase so authoring can use either
 * `rotateX(...)` or `rotatex(...)`. Cipó helpers remain case-sensitive by
 * design, but platform CSS functions are case-insensitive in practice.
 *
 * @param name - Function name without parentheses.
 * @returns Whether the name is registered as native CSS.
 */
export function isNativeCssFunction(name: string): boolean {
  return runtime.nativeFunctionRegistry.has(String(name || '').trim().toLowerCase())
}

function findHelperStart(input: string, fromIndex: number): number {
  for (let index = fromIndex; index < input.length; index += 1) {
    const char = input[index]

    if (char === 'x' && input[index + 1] === ':' && isIdentifierStart(input[index + 2] ?? '')) {
      const nameStart = index + 2
      const nameEnd = readIdentifierEnd(input, nameStart)
      const name = input.slice(nameStart, nameEnd)
      if (input[nameEnd] === '(' && runtime.helperRegistry.has(name) && !isNativeCssFunction(name)) return index
      index = nameEnd
      continue
    }

    if (!isIdentifierStart(char ?? '')) continue
    if (index > 0 && isIdentifierPart(input[index - 1] ?? '')) continue

    const nameEnd = readIdentifierEnd(input, index)
    const name = input.slice(index, nameEnd)
    if (input[nameEnd] === '(' && runtime.helperRegistry.has(name) && !isNativeCssFunction(name)) return index
    index = nameEnd
  }

  return -1
}

function readIdentifierEnd(input: string, start: number): number {
  let index = start
  while (index < input.length && isIdentifierPart(input[index] ?? '')) index += 1
  return index
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

function isIdentifierStart(value: string): boolean {
  return /[a-zA-Z_]/.test(value)
}

function isIdentifierPart(value: string): boolean {
  return /[a-zA-Z0-9_-]/.test(value)
}

function isColorLike(value: string): boolean {
  return value.startsWith('$') || value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || value.startsWith('oklch') || value.startsWith('oklab') || value === 'transparent' || value === 'currentColor'
}
