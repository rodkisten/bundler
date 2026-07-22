import { runtime } from '../runtime'
import { findTopLevelColon, splitTopLevel } from '../utils'
import { findMatching, isEscapedAt } from './shared'

/**
 * Lowers object-like responsive values before the tiny CSS parser sees braces.
 *
 * Property values become the existing `base, x:md(value)` representation.
 * Objects nested inside helper calls are wrapped in `responsive(...)` so the
 * helper can keep the responsive value associated with its named argument.
 */
export function expandResponsiveValueObjects(input: string): string {
  let output = ''
  let cursor = 0
  let index = 0
  let quote: '"' | "'" | null = null
  let parenDepth = 0
  let bracketDepth = 0

  while (index < input.length) {
    const char = input[index] ?? ''

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      index += 1
      continue
    }

    if (char === '(') parenDepth += 1
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1)
    else if (char === '[') bracketDepth += 1
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1)

    if (char !== '{' || bracketDepth > 0) {
      index += 1
      continue
    }

    const close = findMatching(input, index, '{', '}')
    if (close < 0) break
    const responsive = parseResponsiveObject(input.slice(index + 1, close))

    if (!responsive) {
      index += 1
      continue
    }

    output += input.slice(cursor, index)
    const encoded = encodeResponsiveEntries(responsive)
    output += parenDepth > 0
      ? `responsive(${encoded})`
      : encoded
    cursor = close + 1
    index = close + 1
  }

  return output + input.slice(cursor)
}

/** Decodes a responsive(...) value into the atomic responsive list syntax. */
export function decodeResponsiveValue(input: string): string {
  const source = input.trim()
  if (!source.startsWith('responsive(') || !source.endsWith(')')) {
    return input
  }
  return source.slice('responsive('.length, -1).trim()
}

function parseResponsiveObject(
  body: string,
): Array<readonly [string, string]> | null {
  const entries = splitResponsiveEntries(body)
  if (entries.length === 0) return null
  const output: Array<readonly [string, string]> = []

  for (const entry of entries) {
    const colon = findTopLevelColon(entry)
    if (colon <= 0) return null
    const key = entry.slice(0, colon).trim()
    const value = entry.slice(colon + 1).trim()
    if (!value) return null
    if (key !== 'base' && !(key in runtime.config.breakpoints)) return null
    output.push([key, value])
  }

  return output
}

function splitResponsiveEntries(body: string): string[] {
  const commaParts = splitTopLevel(body, ',')
  if (commaParts.length > 1) return commaParts

  const output: string[] = []
  let buffer = ''
  let quote: string | null = null
  let depth = 0

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index] ?? ''
    if (quote) {
      buffer += char
      if (char === quote && body[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1

    if ((char === '\n' || char === '\r') && depth === 0) {
      if (buffer.trim()) output.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += char
  }

  if (buffer.trim()) output.push(buffer.trim())
  return output
}

function encodeResponsiveEntries(
  entries: readonly (readonly [string, string])[],
): string {
  const base = entries.find(([key]) => key === 'base')?.[1]
  const output: string[] = []
  if (base) output.push(base)

  for (const [key, value] of entries) {
    if (key === 'base') continue
    output.push(`x:${key}(${value})`)
  }

  return output.join(', ')
}

/** Maps values inside responsive(...) or x:bp(...) and preserves shape. */
export function mapResponsiveValue(
  input: string,
  mapper: (value: string) => string,
): string {
  const decoded = decodeResponsiveValue(input)
  const parts = splitTopLevel(decoded, ',')
  const output: string[] = []

  for (const part of parts) {
    const source = part.trim()
    const match = /^x:([a-zA-Z][\w-]*)\(([\s\S]*)\)$/.exec(source)
    if (match) {
      output.push(`x:${match[1]}(${mapper(match[2]!.trim())})`)
    } else if (source) {
      output.push(mapper(source))
    }
  }

  return output.join(', ')
}
