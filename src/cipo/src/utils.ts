import { HASH_MASK, HASH_SEED } from './constants'
import type { CipoWarning, RuntimeState } from './types'

const emittedWarningKeys = new Set<string>()

/** Clears warning dedupe state when the public runtime is reset. */
export function resetWarningDedupe(): void {
  emittedWarningKeys.clear()
}

/**
 * Creates a stable, tiny hash used in generated class names and JIT cache keys.
 *
 * @remarks
 * DJB2-style hashing is intentionally used here because it is tiny, stable and
 * fast enough for browser runtime generation. It is not cryptographic, and that
 * is perfect for class names.
 *
 * @param input - Any stable source string.
 * @returns Base36 unsigned hash.
 *
 * @example
 * ```ts
 * hashString('color:red')
 * // '1x8f3ab' style output
 * ```
 */
export function hashString(input: string): string {
  let hash = HASH_SEED

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) & HASH_MASK
  }

  return (hash >>> 0).toString(36)
}

/**
 * Converts camelCase object keys to CSS kebab-case names.
 *
 * @param input - JS-style property name.
 * @returns CSS-style property name.
 *
 * @example
 * ```ts
 * toKebabCase('backgroundColor')
 * // 'background-color'
 * ```
 */
export function toKebabCase(input: string): string {
  return input.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

export function toKebabMixed(str: string): string {
  return str.replace(/[_\s]+|(?<=[a-z0-9])(?=[A-Z])/g, '-').toLowerCase();
}

/**
 * Removes noisy whitespace so CSS rules can be deduped reliably.
 *
 * @param input - CSS text.
 * @returns Normalized CSS text.
 *
 * @example
 * ```ts
 * normalizeCss('.a { color : red ; }')
 * // '.a{color:red;}'
 * ```
 */
export function normalizeCss(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/\s*([{}:;,>+~])\s*/g, '$1').trim()
}

/**
 * Checks whether a value is a plain object created by object literal or null prototype.
 *
 * @param value - Unknown value.
 * @returns Whether it is a plain object.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Emits a runtime warning and stores it in the shared warning sink.
 *
 * @param runtime - Runtime state.
 * @param target - Local warning list, usually the artifact debug list.
 * @param code - Machine-readable warning code.
 * @param message - Human-readable message.
 * @param context - Optional debug payload.
 * @returns Nothing.
 */
export function warn(runtime: RuntimeState, target: CipoWarning[], code: string, message: string, context?: unknown): void {
  const warning: CipoWarning = context === undefined ? { code, message } : { code, message, context }
  const key = `${code}|${message}|${String(context ?? '')}`

  /**
   * Warnings used to be emitted repeatedly for every failed parser pass. On
   * mobile Safari that turns a recoverable parser issue into a page freeze. The
   * sink still receives the first occurrence for debugging, but duplicate console
   * spam is suppressed.
   */
  if (!emittedWarningKeys.has(key)) {
    target.push(warning)
    runtime.warningSink.push(warning)
    runtime.config.onWarning?.(warning)

    if (runtime.config.debug) {
      console.warn(`[Cipó:${code}] ${message}`, context ?? '')
    }

    emittedWarningKeys.add(key)
  }
}

/**
 * Splits a string at top-level separators while respecting nested functions,
 * brackets and quoted strings.
 *
 * @param input - Source text.
 * @param separator - Single-character separator.
 * @returns Top-level chunks.
 *
 * @example
 * ```ts
 * splitTopLevel('a, gradient(red, blue), c', ',')
 * // ['a', 'gradient(red, blue)', 'c']
 * ```
 */
export function splitTopLevel(input: string, separator: string): string[] {
  const output: string[] = []
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      buffer += char
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }

    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1

    if (char === separator && depth === 0) {
      if (buffer.trim()) output.push(buffer.trim())
      buffer = ''
      continue
    }

    buffer += char
  }

  if (buffer.trim()) output.push(buffer.trim())
  return output
}

/**
 * Finds a top-level colon, ignoring function arguments and strings.
 *
 * @param input - Declaration candidate.
 * @returns Colon index or -1.
 */
export function findTopLevelColon(input: string): number {
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
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
    else if (char === ')' || char === ']') depth -= 1
    else if (char === ':' && depth === 0) return index
  }

  return -1
}

/**
 * Finds a matching closing brace for a block body.
 *
 * @param input - CSS text.
 * @param startIndex - Index of the opening brace.
 * @returns Closing brace index or -1.
 */
export function findMatchingBrace(input: string, startIndex: number): number {
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

    if (char === '{') depth += 1
    else if (char === '}') depth -= 1

    if (depth === 0) return index
  }

  return -1
}

/**
 * Parses `name(args)` without regex so nested calls remain intact.
 *
 * @param input - Function-like source.
 * @returns Function name and args or null.
 *
 * @example
 * ```ts
 * parseFunctionCall('alpha(var(--x) / 20%)')?.args
 * // ['var(--x) / 20%']
 * ```
 */
export function parseFunctionCall(input: string): null | { readonly name: string; readonly args: readonly string[] } {
  const trimmed = input.trim()
  const openIndex = trimmed.indexOf('(')
  if (openIndex <= 0 || !trimmed.endsWith(')')) return null

  const name = trimmed.slice(0, openIndex).trim()
  if (!/^[a-zA-Z_][\w-]*$/.test(name)) return null

  return {
    name,
    args: splitTopLevel(trimmed.slice(openIndex + 1, -1), ','),
  }
}

/**
 * Converts `key: value` argument lists into a record.
 *
 * @param input - Function argument source.
 * @returns Typed argument map.
 */
export function parseTypedArguments(input: string): Record<string, string> {
  const output: Record<string, string> = {}

  for (const part of splitTopLevel(input, ',')) {
    const index = findTopLevelColon(part)
    if (index <= 0) continue
    output[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  }

  return output
}

/**
 * Creates a CSS declaration without formatting decisions.
 *
 * @param property - CSS property.
 * @param value - CSS value.
 * @returns Compact declaration.
 */
export function createDeclaration(property: string, value: string): string {
  return `${property}:${value};`
}

/**
 * Detects numbers that should be interpreted through spacing scale.
 *
 * @param value - CSS DSL value.
 * @returns Whether the value is a plain number.
 */
export function isPlainNumber(value: string): boolean {
  return /^-?\d*\.?\d+$/.test(value.trim())
}
