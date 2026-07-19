import type { CipoWarning } from '../types'
import { splitTopLevel, toKebabMixed } from '../utils'
import { normalizeRuntimeExpression } from './math'
import {
  findMatching,
  findTopLevelChar,
  isEscapedAt,
  isIdentifierStart,
  readIdentifierEnd,
  skipSpaces,
} from './shared'

export function expandRuntimeTokenObjects(input: string, warnings: CipoWarning[]): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const start = findTokenObjectStart(input, index)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)
    const nameEnd = readIdentifierEnd(input, start + 1)
    const name = input.slice(start + 1, nameEnd)
    const open = skipSpaces(input, nameEnd)
    const close = findMatching(input, open, '(', ')')

    if (close < 0) {
      warnings.push({
        code: 'cipo-token-object-unclosed',
        message: `Unclosed token object: ${name}`,
      })
      output += input.slice(start)
      break
    }

    output += renderTokenObject(toKebabMixed(name), input.slice(open + 1, close), warnings)
    index = close + 1
  }

  return output
}

function findTokenObjectStart(input: string, startIndex: number): number {
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

    if (char !== '$') continue
    if (input[index + 1] === '$') {
      index += 1
      continue
    }
    if (!isIdentifierStart(input[index + 1] ?? '')) continue

    const nameEnd = readIdentifierEnd(input, index + 1)
    const open = skipSpaces(input, nameEnd)
    if (input[open] === '(') return index
    index = nameEnd - 1
  }

  return -1
}

function renderTokenObject(name: string, body: string, warnings: CipoWarning[]): string {
  const declarations: string[] = []
  const entries = parseObjectEntries(body, warnings)
  flattenTokenEntries(name, entries, declarations)
  return declarations.join('\n')
}

type ObjectEntry = { key: string; value: string | ObjectEntry[] }

function parseObjectEntries(body: string, warnings: CipoWarning[]): ObjectEntry[] {
  const parts = splitTopLevel(body, ',')
  const output: ObjectEntry[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] ?? '').trim().replace(/;$/, '').trim()
    if (!part) continue

    const colon = findTopLevelChar(part, ':')
    if (colon <= 0) continue

    const key = unquoteObjectKey(part.slice(0, colon).trim().replace(/^[$]+/, ''))
    const value = part.slice(colon + 1).trim()
    if (!key) continue

    if (value.startsWith('(')) {
      const close = findMatching(value, 0, '(', ')')
      if (close < 0 || close !== value.length - 1) {
        warnings.push({
          code: 'cipo-token-object-malformed-nesting',
          message: `Malformed nested token object value for "${key}".`,
        })
        continue
      }

      output.push({ key, value: parseObjectEntries(value.slice(1, -1), warnings) })
      continue
    }

    output.push({ key, value })
  }

  return output
}

function unquoteObjectKey(key: string): string {
  if (key.length < 2) return key
  const first = key[0]
  const last = key.at(-1)
  return first === last && (first === '"' || first === "'") ? key.slice(1, -1) : key
}

function flattenTokenEntries(prefix: string, entries: readonly ObjectEntry[], out: string[]): void {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!
    const nextPrefix = `${prefix}-${toKebabMixed(entry.key)}`

    if (Array.isArray(entry.value)) {
      flattenTokenEntries(nextPrefix, entry.value, out)
      continue
    }

    out[out.length] = `$$${nextPrefix}: ${normalizeRuntimeExpression(entry.value)}`
  }
}
