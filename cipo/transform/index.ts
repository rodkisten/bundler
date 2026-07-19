import { prepareCoreCssInput, finalizeCoreCssOutput } from './safety'
import { runtime } from '../runtime'
import { expandRuntimeDsl } from '../runtime-dsl'
import type { CipoStyleObject, CipoWarning } from '../types'
import { resolveThemeReferences } from '../theme'
import { resolveHelpers } from '../values'
import { isPlainObject, parseFunctionCall, splitTopLevel, warn } from '../utils'
import { styleObjectToCss } from '../style-object'
import { getTypedInitialValue, isTypedValue } from '../properties'
import { minifyCssText, stripCipoComments } from '../syntax/css-lexer'
import { findMatching, isEscapedAt, isIdentifierPart } from '../runtime-dsl/shared'

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
    if (index >= strings.length - 1 || index >= values.length) continue

    const value = values[index]
    if (isCssLikeArtifact(value)) output += value.rawCss
    else if (isTypedValue(value)) output += getTypedInitialValue(value)
    else if (isStyleObjectInterpolation(value)) output += styleObjectToCss(value as CipoStyleObject)
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
 * 2. source constructs that must survive runtime parsing are protected;
 * 3. runtime-only design-language features are expanded;
 * 4. standalone aliases are expanded in a single pass;
 * 5. legacy `@with(...)` is lowered to property declarations;
 * 6. theme tokens are resolved;
 * 7. value helpers are resolved with balanced-parentheses scanning;
 * 8. protected CSS syntax and deferred runtime references are restored.
 *
 * Runtime contexts such as `x:md {}` and `x:hover {}` are intentionally left as
 * block names. They are parsed later by the AST compiler. Protection and
 * restoration are deliberately placed around runtime expansion so native CSS
 * shorthand grammar is never mistaken for Cipó arithmetic.
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
  const prepared = prepareCoreCssInput(withoutComments)
  const runtimeExpanded = expandRuntimeDsl(prepared, warnings)
  const expandedAliases = expandStandaloneAliases(runtimeExpanded, warnings)
  const compatWith = expandWithCompat(expandedAliases, warnings)
  const themed = resolveThemeReferences(compatWith)
  const resolved = resolveHelpers(themed)
  return finalizeCoreCssOutput(resolved)
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
  return stripCipoComments(input)
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
    const atIndex = findNextWithDirective(input, index)
    if (atIndex < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, atIndex)
    let openIndex = atIndex + '@with'.length
    while (openIndex < input.length && /\s/.test(input[openIndex] ?? '')) openIndex += 1

    if (input[openIndex] !== '(') {
      output += input.slice(atIndex, openIndex)
      index = openIndex
      continue
    }

    const closeIndex = findMatching(input, openIndex, '(', ')')
    if (closeIndex < 0) {
      warn(
        runtime,
        warnings,
        'invalid-with',
        '@with(...) is missing a closing parenthesis.',
        input.slice(atIndex),
      )
      output += input.slice(atIndex)
      break
    }

    output += expandWithArguments(input.slice(openIndex + 1, closeIndex), warnings)

    let next = closeIndex + 1
    if (input[next] === ';') next += 1
    index = next
  }

  return output
}

function findNextWithDirective(input: string, startIndex: number): number {
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (!input.startsWith('@with', index)) continue
    const before = input[index - 1] ?? ''
    const after = input[index + '@with'.length] ?? ''
    if ((before && isIdentifierPart(before)) || (after && isIdentifierPart(after))) continue
    return index
  }

  return -1
}

/**
 * Reads a single top-level statement without recursing.
 *
 * @param input - Source string.
 * @param startIndex - Start index.
 * @returns Statement text and next index.
 */
function readTopLevelStatement(
  input: string,
  startIndex: number,
): { readonly text: string; readonly nextIndex: number } {
  const stack: string[] = []
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '(') stack.push(')')
    else if (char === '[') stack.push(']')
    else if ((char === ')' || char === ']') && stack.at(-1) === char) stack.pop()
    else if (char === '{' && stack.length === 0) {
      const close = findMatching(input, index, '{', '}')
      if (close < 0) return { text: input.slice(startIndex), nextIndex: input.length }
      return { text: input.slice(startIndex, close + 1), nextIndex: close + 1 }
    }

    if (stack.length > 0) continue

    if (char === ';' || char === '\n' || char === '\r') {
      return { text: input.slice(startIndex, index + 1), nextIndex: index + 1 }
    }
  }

  return { text: input.slice(startIndex), nextIndex: input.length }
}

/**
 * Reads a standalone alias name. `$alias` is accepted because `$` already means
 * "resolve from Cipó registries/theme" in user-facing CSS.
 *
 * @param source - Trimmed statement.
 * @returns Alias name without `$`, or empty string.
 */
export function getStandaloneAliasName(source: string): string {
  const trimmed = source.trim()
  let normalized = trimmed.endsWith(';') ? trimmed.slice(0, -1).trim() : trimmed
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

    output += `${call.name}:${minifyCssText(call.args.join(','))};`
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
export function stringifyAlias(name: string, warnings: CipoWarning[]): string {
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
      const expanded = stringifyAliasWithStack(aliasName, warnings, stack)
      if (expanded) {
        output += preserveLeadingWhitespace(raw) + expanded
        if (!output.endsWith('\n')) output += '\n'
      }
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
function isStyleObjectInterpolation(value: unknown): value is CipoStyleObject {
  if (!isPlainObject(value)) return false
  return !Object.prototype.hasOwnProperty.call(value, 'toString')
}

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
  return findMatching(input, openIndex, '(', ')')
}
