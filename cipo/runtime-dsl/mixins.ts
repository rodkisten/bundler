import type { CipoWarning } from '../types'
import { splitTopLevel } from '../utils'
import {
  findMatching,
  findTopLevelChar,
  isEscapedAt,
  isIdentifierPart,
  isIdentifierStart,
  isParamBoundary,
  readIdentifierEnd,
  skipSpaces,
} from './shared'

type RuntimeMixin = {
  readonly name: string
  readonly params: readonly RuntimeMixinParam[]
  readonly body: string
}

type RuntimeMixinParam = {
  readonly name: string
  readonly type: string
  readonly fallback: string
}

type RuntimeMixinState = {
  readonly source: string
  readonly mixins: Record<string, RuntimeMixin>
}

export function extractRuntimeMixins(input: string, warnings: CipoWarning[]): RuntimeMixinState {
  let output = ''
  const mixins: Record<string, RuntimeMixin> = Object.create(null)
  let index = 0

  while (index < input.length) {
    const start = findNextMixinDefinition(input, index)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)

    const nameStart = start + 2
    if (!isIdentifierStart(input[nameStart] ?? '')) {
      output += '$$'
      index = nameStart
      continue
    }

    const nameEnd = readIdentifierEnd(input, nameStart)
    const name = input.slice(nameStart, nameEnd)
    let cursor = skipSpaces(input, nameEnd)

    if (input[cursor] !== '(') {
      output += input.slice(start, nameEnd)
      index = nameEnd
      continue
    }

    const closeParen = findMatching(input, cursor, '(', ')')
    if (closeParen < 0) {
      output += input.slice(start)
      break
    }

    cursor = skipSpaces(input, closeParen + 1)
    if (input[cursor] !== '{') {
      output += input.slice(start, closeParen + 1)
      index = closeParen + 1
      continue
    }

    const closeBrace = findMatching(input, cursor, '{', '}')
    if (closeBrace < 0) {
      warnings.push({
        code: 'cipo-mixin-unclosed',
        message: `Unclosed runtime mixin: ${name}`,
      })
      output += input.slice(start)
      break
    }

    const openParen = input.indexOf('(', nameEnd)
    mixins[name] = {
      name,
      params: parseMixinParams(input.slice(openParen + 1, closeParen)),
      body: input.slice(cursor + 1, closeBrace),
    }
    index = closeBrace + 1
  }

  return { source: output, mixins }
}

function findNextMixinDefinition(input: string, startIndex: number): number {
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = startIndex; index < input.length - 1; index += 1) {
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

    if (char === '$' && next === '$') return index
  }

  return -1
}

function parseMixinParams(raw: string): RuntimeMixinParam[] {
  const parts = splitTopLevel(raw, ',')
  const params: RuntimeMixinParam[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] ?? '').trim()
    if (!part) continue

    const colon = findTopLevelChar(part, ':')
    const equals = findTopLevelChar(part, '=')
    const nameEnd = colon > 0 ? colon : equals > 0 ? equals : part.length
    const name = part.slice(0, nameEnd).trim().replace(/^[$*]+/, '')
    const type = colon > 0
      ? part.slice(colon + 1, equals > colon ? equals : part.length).trim()
      : ''
    const fallback = equals > 0 ? part.slice(equals + 1).trim() : ''

    if (name) params.push({ name, type, fallback })
  }

  return params
}

export function expandRuntimeMixinCalls(
  input: string,
  mixins: Record<string, RuntimeMixin>,
  warnings: CipoWarning[],
): string {
  let current = input

  for (let pass = 0; pass < 8; pass += 1) {
    const next = expandRuntimeMixinCallsOnePass(current, mixins, warnings)
    if (next === current) return next
    current = next
  }

  const next = expandRuntimeMixinCallsOnePass(current, mixins, warnings)
  if (next !== current) {
    warnings.push({
      code: 'cipo-mixin-expansion-limit',
      message: 'Runtime mixin expansion reached the eight-pass safety limit.',
    })
  }

  return current
}

function expandRuntimeMixinCallsOnePass(
  input: string,
  mixins: Record<string, RuntimeMixin>,
  warnings: CipoWarning[],
): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const start = findNextMixinCall(input, index, mixins)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)
    const nameEnd = readIdentifierEnd(input, start)
    const name = input.slice(start, nameEnd)
    const open = skipSpaces(input, nameEnd)
    const close = findMatching(input, open, '(', ')')

    if (close < 0) {
      warnings.push({
        code: 'cipo-mixin-call-unclosed',
        message: `Unclosed runtime mixin call: ${name}`,
      })
      output += input.slice(start)
      break
    }

    output += renderRuntimeMixin(mixins[name]!, input.slice(open + 1, close))
    index = close + 1
  }

  return output
}

function findNextMixinCall(
  input: string,
  startIndex: number,
  mixins: Record<string, RuntimeMixin>,
): number {
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

    if (!isIdentifierStart(char)) continue
    if (index > 0 && isIdentifierPart(input[index - 1] ?? '')) continue

    const end = readIdentifierEnd(input, index)
    const name = input.slice(index, end)
    if (!mixins[name]) {
      index = end - 1
      continue
    }

    const open = skipSpaces(input, end)
    if (input[open] === '(') return index
    index = end - 1
  }

  return -1
}

function renderRuntimeMixin(mixin: RuntimeMixin, rawArgs: string): string {
  const args = splitTopLevel(rawArgs, ',')
  const values: Record<string, string> = Object.create(null)

  for (let index = 0; index < mixin.params.length; index += 1) {
    const param = mixin.params[index]!
    const rawValue = (args[index] ?? param.fallback ?? '').trim()
    values[param.name] = shouldPreserveOuterQuotes(param.type)
      ? rawValue
      : stripMatchingOuterQuotes(rawValue)
  }

  let body = stripRuntimeIfBlocks(mixin.body, values)

  for (let index = 0; index < mixin.params.length; index += 1) {
    const param = mixin.params[index]!
    body = replaceParam(body, param.name, values[param.name] ?? '')
  }

  return body
}

function shouldPreserveOuterQuotes(type: string): boolean {
  const normalized = type.trim().toLowerCase()
  return normalized === 'string' || normalized === '<string>' || normalized === 'css-string'
}

function stripMatchingOuterQuotes(value: string): string {
  if (value.length < 2) return value
  const first = value[0]
  return first === value.at(-1) && (first === '"' || first === "'") ? value.slice(1, -1) : value
}

function stripRuntimeIfBlocks(input: string, values: Record<string, string>): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const start = findIfKeyword(input, index)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)
    const conditionStart = skipSpaces(input, start + 2)
    const open = findRuntimeIfBlockOpen(input, conditionStart)

    if (open < 0) {
      output += input.slice(start)
      break
    }

    const close = findMatching(input, open, '{', '}')
    if (close < 0) {
      output += input.slice(start)
      break
    }

    const condition = input.slice(conditionStart, open).trim()
    if (evaluateRuntimeCondition(condition, values)) output += input.slice(open + 1, close)
    index = close + 1
  }

  return output
}

function findIfKeyword(input: string, startIndex: number): number {
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = startIndex; index < input.length - 1; index += 1) {
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

    if (char !== 'i' || next !== 'f') continue
    const previous = input[index - 1] ?? ''
    const after = input[index + 2] ?? ''
    if ((previous && isIdentifierPart(previous)) || (after && isIdentifierPart(after))) continue
    return index
  }

  return -1
}

function findRuntimeIfBlockOpen(input: string, startIndex: number): number {
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
    else if (char === '{' && stack.length === 0) return index
  }

  return -1
}

function evaluateRuntimeCondition(condition: string, values: Record<string, string>): boolean {
  const equals = findTopLevelChar(condition, '=')
  if (equals < 0) return false

  const left = condition.slice(0, equals).trim().replace(/^[$*]+/, '')
  const right = stripMatchingOuterQuotes(condition.slice(equals + 1).trim())
  return stripMatchingOuterQuotes(String(values[left] ?? '')) === right
}

function replaceParam(input: string, name: string, value: string): string {
  let output = ''
  let index = 0
  let quote: '"' | "'" | null = null
  let blockComment = false

  while (index < input.length) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (blockComment) {
      output += char
      if (char === '*' && next === '/') {
        output += next
        blockComment = false
        index += 2
      } else {
        index += 1
      }
      continue
    }

    if (quote) {
      output += char
      if (char === quote && !isEscapedAt(input, index)) quote = null
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      output += '/*'
      blockComment = true
      index += 2
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      index += 1
      continue
    }

    if (
      (char === '*' || char === '$') &&
      input.slice(index + 1, index + 1 + name.length) === name
    ) {
      const before = input[index - 1] ?? ''
      const after = input[index + 1 + name.length] ?? ''
      if (isParamBoundary(before) && isParamBoundary(after)) {
        output += value
        index += name.length + 1
        continue
      }
    }

    output += char
    index += 1
  }

  return output
}
