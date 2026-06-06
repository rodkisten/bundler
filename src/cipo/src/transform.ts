import { runtime } from './runtime'
import type { CipoStyleObject, CipoWarning } from './types'
import { resolveThemeReferences } from './theme'
import { resolveHelpers } from './values'
import { isPlainObject, parseFunctionCall, splitTopLevel, warn } from './utils'
import { styleObjectToCss } from './style-object'

/**
 * Builds a CSS source string from template strings and interpolations.
 *
 * @param strings - Template strings.
 * @param values - Template values.
 * @returns Raw CSS.
 *
 * @example
 * ```ts
 * buildCss(['color:', ';'] as any, ['red'])
 * // 'color:red;'
 * ```
 */
export function buildCss(strings: TemplateStringsArray, values: readonly unknown[]): string {
  let output = ''

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index]
    if (index >= values.length) continue

    const value = values[index]
    if (isCssLikeArtifact(value)) output += value.rawCss
    else if (isPlainObject(value)) output += styleObjectToCss(value as CipoStyleObject)
    else output += String(value ?? '')
  }

  return output
}

/**
 * Runs the full source-level transform pipeline.
 *
 * @param input - Raw CSS source.
 * @param warnings - Warning sink.
 * @returns Transformed CSS source.
 *
 * @example
 * ```ts
 * transformCss('glass; bg: alpha($brand / 20%);', [])
 * // Expands aliases, tokens and helpers before parsing.
 * ```
 */
export function transformCss(input: string, warnings: CipoWarning[]): string {
  const withoutComments = stripComments(input)
  const expandedAliases = expandStandaloneAliases(withoutComments, warnings)
  const compatWith = expandWithCompat(expandedAliases, warnings)
  const themed = resolveThemeReferences(compatWith)
  return resolveHelpers(themed)
}

/**
 * Removes block and line comments.
 *
 * @param input - CSS source.
 * @returns CSS without comments.
 */
export function stripComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * Expands standalone identifier aliases such as `glass;` and `buttonBase;`.
 *
 * @param input - CSS source.
 * @param warnings - Warning sink.
 * @returns CSS with aliases expanded.
 */
export function expandStandaloneAliases(input: string, warnings: CipoWarning[]): string {
  const chunks = splitTopLevel(input, ';')
  let output = ''

  for (const chunk of chunks) {
    const source = chunk.trim()
    if (!source) continue

    if (/^[a-zA-Z_][\w-]*$/.test(source) && runtime.aliasRegistry.has(source)) {
      output += stringifyAlias(source, warnings)
      if (!output.endsWith(';') && !output.endsWith('}')) output += ';'
      continue
    }

    output += source
    if (!source.endsWith('}')) output += ';'
  }

  return output
}

/**
 * Keeps old `@with(bg(...), px(...))` working by converting it to the new DSL.
 *
 * @param input - CSS source.
 * @param warnings - Warning sink.
 * @returns Converted CSS source.
 */
export function expandWithCompat(input: string, warnings: CipoWarning[]): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const atIndex = input.indexOf('@with', index)
    if (atIndex < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, atIndex)
    const openIndex = input.indexOf('(', atIndex)
    if (openIndex < 0) {
      output += input.slice(atIndex)
      break
    }

    const closeIndex = findMatchingParen(input, openIndex)
    if (closeIndex < 0) {
      warn(runtime, warnings, 'invalid-with', '@with(...) is missing a closing parenthesis.', input.slice(atIndex))
      output += input.slice(atIndex)
      break
    }

    const args = input.slice(openIndex + 1, closeIndex)
    output += expandWithArguments(args, warnings)

    let next = closeIndex + 1
    if (input[next] === ';') next += 1
    index = next
  }

  return output
}

function expandWithArguments(args: string, warnings: CipoWarning[]): string {
  return splitTopLevel(args, ',').map(source => {
    const trimmed = source.trim()
    if (!trimmed) return ''
    const call = parseFunctionCall(trimmed)

    if (!call) {
      if (runtime.aliasRegistry.has(trimmed)) return stringifyAlias(trimmed, warnings)
      return `${trimmed};`
    }

    return `${call.name}:${call.args.join(',')};`
  }).join('')
}

function stringifyAlias(name: string, warnings: CipoWarning[]): string {
  const value = runtime.aliasRegistry.get(name)
  if (value === undefined) return ''
  const resolved = typeof value === 'function' ? value() : value
  if (typeof resolved === 'string') return expandStandaloneAliases(resolved, warnings)
  return styleObjectToCss(resolved)
}

function isCssLikeArtifact(value: unknown): value is { readonly rawCss: string } {
  return isPlainObject(value) && typeof value.rawCss === 'string'
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
