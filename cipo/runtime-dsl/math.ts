import { runtime } from '../runtime'
import { toKebabMixed } from '../utils'
import {
  findTopLevelChar,
  isEscapedAt,
  isIdentifierStart,
  readIdentifierEnd,
} from './shared'

export function normalizeRuntimeVariableMath(input: string): string {
  let output = ''
  let start = 0
  const stack: string[] = []
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = 0; index < input.length; index += 1) {
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
    else if ((char === ')' || char === ']') && stack.at(-1) === char) {
      stack.pop()
    }

    if (stack.length > 0) continue

    if (char === '{') {
      output += input.slice(start, index + 1)
      start = index + 1
      continue
    }

    if (char === '}') {
      output += normalizeRuntimeDeclarationChunk(input.slice(start, index))
      output += char
      start = index + 1
      continue
    }

    if (char === ';' || char === '\n' || char === '\r') {
      output += normalizeRuntimeDeclarationChunk(input.slice(start, index))
      output += char
      start = index + 1
    }
  }

  output += normalizeRuntimeDeclarationChunk(input.slice(start))
  return output
}

function normalizeRuntimeDeclarationChunk(chunk: string): string {
  const colon = findTopLevelChar(chunk, ':')
  if (colon <= 0) return chunk

  const property = chunk.slice(0, colon).trim()
  if (!isRuntimeDeclarationProperty(property)) return chunk

  const before = chunk.slice(0, colon + 1)
  const value = chunk.slice(colon + 1).trim()
  if (!value) return chunk
  return `${before} ${normalizeRuntimeExpression(value)}`
}

/**
 * Distinguishes declaration names from selectors that contain a colon.
 *
 * @remarks
 * Full stylesheet input can contain indented pseudo-selectors such as `:host`
 * and `.button:hover`. Treating those chunks as declarations makes operators
 * inside selector lists look like arithmetic and can corrupt them into values
 * such as `:calc(host *,)`. Only native/custom property-shaped names are valid
 * declaration prefixes here.
 */
function isRuntimeDeclarationProperty(property: string): boolean {
  if (!property) return false
  if (/^\$\$[A-Za-z_][A-Za-z0-9_.-]*$/.test(property)) return true
  if (/^--[A-Za-z0-9_-]+$/.test(property)) return true
  return /^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(property)
}

export function normalizeRuntimeExpression(value: string): string {
  const withVars = replaceRuntimeVars(value.trim())
  if (withVars.startsWith('calc(')) return withVars
  if (!hasTopLevelMath(withVars)) return withVars
  return `calc(${withVars})`
}

function replaceRuntimeVars(value: string): string {
  let output = ''
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? ''
    const next = value[index + 1] ?? ''

    if (blockComment) {
      output += char
      if (char === '*' && next === '/') {
        output += next
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      output += char
      if (char === quote && !isEscapedAt(value, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      output += '/*'
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      continue
    }

    if (
      char === '$' &&
      next === '$' &&
      isIdentifierStart(value[index + 2] ?? '')
    ) {
      const start = index + 2
      const end = readIdentifierEnd(value, start)
      const name = toKebabMixed(value.slice(start, end).replace(/[._]+/g, '-'))
      output += `var(--${runtime.config.prefix}-${name})`
      index = end - 1
      continue
    }

    output += char
  }

  return output
}

function hasTopLevelMath(value: string): boolean {
  const stack: string[] = []
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? ''
    const next = value[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (char === quote && !isEscapedAt(value, index)) quote = null
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

    if (char === '(') {
      stack.push(')')
      continue
    }

    if (char === '[') {
      stack.push(']')
      continue
    }

    if ((char === ')' || char === ']') && stack.at(-1) === char) {
      stack.pop()
      continue
    }

    if (stack.length > 0) continue
    if (char === '+' || char === '*' || char === '/') return true
    if (char === '-' && isBinarySubtraction(value, index)) return true
  }

  return false
}

function isBinarySubtraction(value: string, index: number): boolean {
  let left = index - 1
  let right = index + 1

  while (left >= 0 && /\s/.test(value[left] ?? '')) left -= 1
  while (right < value.length && /\s/.test(value[right] ?? '')) right += 1

  const before = value[left] ?? ''
  const after = value[right] ?? ''
  if (!before || !after) return false
  if (before === '-' || after === '-') return false
  if (/[a-zA-Z_]$/.test(before) && /^[a-zA-Z_]/.test(after)) return false
  return /[0-9.%\])]/.test(before) && /[0-9.(a-zA-Z_$]/.test(after)
}
