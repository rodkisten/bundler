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
 * @remarks
 * The transform layer must stay cheap because it runs on every `css`` ` call.
 * The order is tuned to avoid corruption:
 *
 * 1. comments are removed;
 * 2. standalone aliases are expanded in a single pass;
 * 3. legacy `@with(...)` is lowered to property declarations;
 * 4. theme tokens are resolved;
 * 5. value helpers are resolved with balanced-parentheses scanning.
 *
 * Runtime contexts such as `x:md {}` and `x:hover {}` are intentionally left as
 * block names. They are parsed later by the AST compiler.
 *
 * @param input - Raw CSS source.
 * @param warnings - Warning sink.
 * @returns Transformed CSS source.
 *
 * @example
 * ```ts
 * transformCss('glass\nbg: alpha($brand / 20%)', [])
 * // Expands glass, resolves $brand and alpha(...), preserves x:* blocks.
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
 * @remarks
 * Line comments are removed only when they are not part of a URL-like token.
 *
 * @param input - CSS source.
 * @returns CSS without comments.
 */
export function stripComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * Expands standalone identifier aliases such as `glass` and `buttonBase`.
 *
 * @remarks
 * This implementation is deliberately single-pass and line-aware. The previous
 * split/join recursion could become O(n²) when aliases expanded into aliases or
 * when a stylesheet omitted semicolons. This scanner only expands identifiers
 * that appear as standalone statements, and it never treats declarations such as
 * `bg: $brand` as alias names.
 *
 * @param input - CSS source.
 * @param warnings - Warning sink.
 * @returns CSS with aliases expanded.
 *
 * @example
 * ```ts
 * expandStandaloneAliases('glass\npx: 4', [])
 * // 'bg: alpha(...);border:...;\npx: 4'
 * ```
 */
export function expandStandaloneAliases(input: string, warnings: CipoWarning[]): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const statement = readTopLevelStatement(input, index)
    const raw = statement.text
    const trimmed = raw.trim()

    const aliasName = getStandaloneAliasName(trimmed)

    if (aliasName && runtime.aliasRegistry.has(aliasName)) {
      output += preserveLeadingWhitespace(raw) + stringifyAlias(aliasName, warnings)
      if (!output.endsWith('\n')) output += '\n'
    } else {
      output += raw
    }

    index = statement.nextIndex
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

/**
 * Reads a single top-level statement without recursing.
 *
 * @param input - Source string.
 * @param startIndex - Start index.
 * @returns Statement text and next index.
 */
function readTopLevelStatement(input: string, startIndex: number): { readonly text: string; readonly nextIndex: number } {
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)

    if (char === ';' && depth === 0) {
      return { text: input.slice(startIndex, index + 1), nextIndex: index + 1 }
    }

    if ((char === '\n' || char === '\r') && depth === 0) {
      return { text: input.slice(startIndex, index + 1), nextIndex: index + 1 }
    }
  }

  return { text: input.slice(startIndex), nextIndex: input.length }
}

/**
 * Checks whether a statement is a standalone alias identifier.
 *
 * @param source - Trimmed statement.
 * @returns Whether it is alias-like.
 */
function isStandaloneAliasName(source: string): boolean {
  return getStandaloneAliasName(source) !== ''
}

/**
 * Reads a standalone alias name. `$alias` is accepted because `$` already means
 * "resolve from Cipó registries/theme" in user-facing CSS.
 *
 * @param source - Trimmed statement.
 * @returns Alias name without `$`, or empty string.
 */
function getStandaloneAliasName(source: string): string {
  let normalized = source.endsWith(';') ? source.slice(0, -1).trim() : source.trim()
  if (normalized[0] === '$') normalized = normalized.slice(1)
  return /^[a-zA-Z_][\w-]*$/.test(normalized) ? normalized : ''
}

/**
 * Preserves indentation when expanding aliases inside nested blocks.
 *
 * @param input - Raw statement.
 * @returns Leading whitespace.
 */
function preserveLeadingWhitespace(input: string): string {
  return input.match(/^\s*/)?.[0] ?? ''
}

/**
 * Expands legacy @with arguments into declaration syntax.
 *
 * @param args - Function argument body.
 * @param warnings - Warning sink.
 * @returns CSS declarations.
 */
function expandWithArguments(args: string, warnings: CipoWarning[]): string {
  const parts = splitTopLevel(args, ',')
  let output = ''

  for (let index = 0; index < parts.length; index += 1) {
    const trimmed = (parts[index] ?? '').trim()
    if (!trimmed) continue

    const aliasName = getStandaloneAliasName(trimmed)
    const call = parseFunctionCall(trimmed)

    if (!call) {
      output += aliasName && runtime.aliasRegistry.has(aliasName) ? stringifyAlias(aliasName, warnings) : `${trimmed};`
      continue
    }

    output += `${call.name}:${call.args.join(',')};`
  }

  return output
}

/**
 * Expands an alias while avoiding unbounded recursive explosions.
 *
 * @param name - Alias name.
 * @param warnings - Warning sink.
 * @returns CSS source.
 */
function stringifyAlias(name: string, warnings: CipoWarning[]): string {
  return stringifyAliasWithStack(name, warnings, new Set<string>())
}

/**
 * Expands an alias with cycle protection.
 *
 * @param name - Alias name.
 * @param warnings - Warning sink.
 * @param stack - Active alias stack.
 * @returns CSS source.
 */
function stringifyAliasWithStack(name: string, warnings: CipoWarning[], stack: Set<string>): string {
  if (stack.has(name)) {
    warn(runtime, warnings, 'cyclic-alias', `Alias "${name}" expands into itself.`, name)
    return ''
  }

  const value = runtime.aliasRegistry.get(name)
  if (value === undefined) return ''

  stack.add(name)
  const resolved = typeof value === 'function' ? value() : value
  const cssText = typeof resolved === 'string' ? resolved : styleObjectToCss(resolved)
  const expanded = expandAliasesInString(cssText, warnings, stack)
  stack.delete(name)

  return expanded
}

/**
 * Expands aliases inside another alias value using the same single-pass reader.
 *
 * @param input - Alias CSS body.
 * @param warnings - Warning sink.
 * @param stack - Active alias stack.
 * @returns Expanded CSS.
 */
function expandAliasesInString(input: string, warnings: CipoWarning[], stack: Set<string>): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const statement = readTopLevelStatement(input, index)
    const raw = statement.text
    const trimmed = raw.trim().replace(/;$/, '').trim()
    const aliasName = getStandaloneAliasName(trimmed)

    if (aliasName && runtime.aliasRegistry.has(aliasName)) {
      output += preserveLeadingWhitespace(raw) + stringifyAliasWithStack(aliasName, warnings, stack)
      if (!output.endsWith('\n')) output += '\n'
    } else {
      output += raw
      if (raw.trim() && !raw.trim().endsWith(';') && !raw.trim().endsWith('}')) output += ';'
    }

    index = statement.nextIndex
  }

  return output
}

/**
 * Detects CSS-like artifacts used as interpolations.
 *
 * @param value - Interpolated value.
 * @returns Whether it has raw CSS.
 */
function isCssLikeArtifact(value: unknown): value is { readonly rawCss: string } {
  return isPlainObject(value) && typeof value.rawCss === 'string'
}

/**
 * Finds a matching closing parenthesis.
 *
 * @param input - Source string.
 * @param openIndex - Opening parenthesis index.
 * @returns Closing index or -1.
 */
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
