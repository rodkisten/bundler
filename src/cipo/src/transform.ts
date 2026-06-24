import { prepareCoreCssInput, finalizeCoreCssOutput } from './core-transform-safety'
import { runtime } from './runtime'
import { expandRuntimeDsl } from './runtime-dsl'
import type { CipoStyleObject, CipoWarning } from './types'
import { resolveThemeReferences } from './theme'
import { resolveHelpers } from './values'
import { isPlainObject, parseFunctionCall, splitTopLevel, warn } from './utils'
import { styleObjectToCss } from './style-object'
import { getTypedInitialValue, isTypedValue } from './properties'

/** Builds a CSS source string from template strings and interpolations. */
export function buildCss(strings: TemplateStringsArray, values: readonly unknown[]): string {
  let output = ''

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index]
    if (index >= values.length) continue

    const value = values[index]
    if (isCssLikeArtifact(value)) output += value.rawCss
    else if (isTypedValue(value)) output += getTypedInitialValue(value)
    else if (isPlainObject(value)) output += styleObjectToCss(value as CipoStyleObject)
    else output += String(value ?? '')
  }

  return output
}

/** Runs the source-level transform pipeline shared by every Cipó CSS mode. */
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

/** Removes block comments and safe line/hash comments. */
export function stripComments(input: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let lineOnlyWhitespace = true

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1] ?? ''

    if (quote) {
      output += char
      if (char === quote && input[index - 1] !== '\\') quote = null
      if (char === '\n' || char === '\r') lineOnlyWhitespace = true
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      lineOnlyWhitespace = false
      continue
    }

    if (char === '/' && next === '*') {
      index = skipBlockComment(input, index + 2)
      continue
    }

    if (char === '*' && next === '/') {
      index += 1
      continue
    }

    if (char === '/' && next === '/' && input[index - 1] !== ':') {
      index = skipLineComment(input, index + 2)
      output += '\n'
      lineOnlyWhitespace = true
      continue
    }

    if (char === '#' && isHashComment(input, index, lineOnlyWhitespace)) {
      index = skipLineComment(input, index + 1)
      output += '\n'
      lineOnlyWhitespace = true
      continue
    }

    output += char
    if (char === '\n' || char === '\r') lineOnlyWhitespace = true
    else if (!/\s/.test(char)) lineOnlyWhitespace = false
  }

  return output
}

/** Expands standalone aliases such as `glass` and `centerGrid`. */
export function expandStandaloneAliases(input: string, warnings: CipoWarning[]): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const statement = readTopLevelStatement(input, index)
    const raw = statement.text
    const aliasName = getStandaloneAliasName(raw.trim())

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

/** Keeps the legacy `@with(...)` declaration syntax working. */
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

    output += expandWithArguments(input.slice(openIndex + 1, closeIndex), warnings)
    let next = closeIndex + 1
    if (input[next] === ';') next += 1
    index = next
  }

  return output
}

function skipBlockComment(input: string, start: number): number {
  for (let index = start; index < input.length - 1; index += 1) {
    if (input[index] === '*' && input[index + 1] === '/') return index + 1
  }
  return input.length - 1
}

function skipLineComment(input: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === '\n' || input[index] === '\r') return index
  }
  return input.length - 1
}

function isHashComment(input: string, index: number, lineOnlyWhitespace: boolean): boolean {
  const previous = input[index - 1] ?? ''
  const next = input[index + 1] ?? ''

  if (lineOnlyWhitespace) {
    if (next === ' ' || next === '\t' || next === '') return true

    let cursor = index + 1
    while (cursor < input.length && /[a-zA-Z0-9_-]/.test(input[cursor] ?? '')) cursor += 1
    while (cursor < input.length && /\s/.test(input[cursor] ?? '') && input[cursor] !== '\n' && input[cursor] !== '\r') cursor += 1

    if (input[cursor] === ':') return false
    if (input[cursor] === '{' || input[cursor] === ',' || input[cursor] === '>' || input[cursor] === '+' || input[cursor] === '~') return false
  }

  if (/[0-9a-fA-F]/.test(next)) return false
  return previous === ' ' || previous === '\t' || lineOnlyWhitespace
}

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

function getStandaloneAliasName(source: string): string {
  let normalized = source.endsWith(';') ? source.slice(0, -1).trim() : source.trim()
  if (normalized[0] === '$') normalized = normalized.slice(1)
  return /^[a-zA-Z_][\w-]*$/.test(normalized) ? normalized : ''
}

function preserveLeadingWhitespace(input: string): string {
  return input.match(/^\s*/)?.[0] ?? ''
}

function expandWithArguments(args: string, warnings: CipoWarning[]): string {
  const parts = splitTopLevel(args, ',')
  let output = ''

  for (let index = 0; index < parts.length; index += 1) {
    const trimmed = (parts[index] ?? '').trim()
    if (!trimmed) continue

    const aliasName = getStandaloneAliasName(trimmed)
    const call = parseFunctionCall(trimmed)

    if (!call) {
      output += aliasName && runtime.aliasRegistry.has(aliasName)
        ? stringifyAlias(aliasName, warnings)
        : `${trimmed};`
      continue
    }

    output += `${call.name}:${call.args.join(',')};`
  }

  return output
}

function stringifyAlias(name: string, warnings: CipoWarning[]): string {
  return stringifyAliasWithStack(name, warnings, new Set<string>())
}

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
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    if (depth === 0) return index
  }

  return -1
}
