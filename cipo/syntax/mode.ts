import { findMatching, isEscapedAt } from '../runtime-dsl/shared'

/** Lightweight mode scanner for the polymorphic `Cipo.css` entry point. */
export type PolymorphicCssSource = {
  readonly css: string
  readonly configCss: string
  readonly inline: boolean
}

const CONFIG_DIRECTIVES: Record<string, 1> = {
  cipo: 1,
  config: 1,
  theme: 1,
  tokens: 1,
  breakpoints: 1,
  alias: 1,
  helper: 1,
  preset: 1,
  plugin: 1,
}

const DETECTION_CACHE_LIMIT = 512
const sourceDetectionCache = new Map<string, PolymorphicCssSource>()

/** Clears bounded source-shape detection cache. Intended for tests/benchmarks. */
export function clearPolymorphicDetectionCache(): void {
  sourceDetectionCache.clear()
}

/** Splits the polymorphic `Cipo.css` entry point into config, sheet, or inline source. */
export function splitPolymorphicCssSource(input: string): PolymorphicCssSource {
  const cached = sourceDetectionCache.get(input)
  if (cached) {
    // Cache hits refresh recency, making the bounded cache a true LRU instead of FIFO.
    sourceDetectionCache.delete(input)
    sourceDetectionCache.set(input, cached)
    return cached
  }

  const result = scanPolymorphicCssSource(input)
  sourceDetectionCache.set(input, result)

  if (sourceDetectionCache.size > DETECTION_CACHE_LIMIT) {
    const oldest = sourceDetectionCache.keys().next().value as string | undefined
    if (oldest !== undefined) sourceDetectionCache.delete(oldest)
  }

  return result
}

function scanPolymorphicCssSource(input: string): PolymorphicCssSource {
  const first = findFirstMeaningful(input)

  if (first >= 0 && startsWithDirective(input, first, 'inline')) {
    const afterName = skipWhitespace(input, first + '@inline'.length)

    if (input[afterName] === '{') {
      const close = findMatching(input, afterName, '{', '}')
      if (close >= 0) {
        return {
          css: `${input.slice(afterName + 1, close)}${input.slice(close + 1)}`,
          configCss: '',
          inline: true,
        }
      }
    }

    if (input[afterName] === ';') {
      return { css: input.slice(afterName + 1), configCss: '', inline: true }
    }
  }

  let configCss = ''
  let cssText = ''
  let index = 0
  let sawConfig = false

  while (index < input.length) {
    const next = findNextTopLevelAt(input, index)
    if (next < 0) {
      cssText += input.slice(index)
      break
    }

    cssText += input.slice(index, next)

    const nameStart = next + 1
    const nameEnd = readDirectiveNameEnd(input, nameStart)
    const directive = input.slice(nameStart, nameEnd).toLowerCase()
    const cursor = skipWhitespace(input, nameEnd)
    const namedBlock = readTopLevelNamedBlock(input, cursor)
    const shouldTreatAsConfig =
      CONFIG_DIRECTIVES[directive] === 1 || (directive === 'property' && sawConfig)

    if (!shouldTreatAsConfig) {
      cssText += input.slice(next, nameEnd)
      index = nameEnd
      continue
    }

    if (input[cursor] === '{' || namedBlock) {
      const open = namedBlock ? namedBlock.open : cursor
      const close = findMatching(input, open, '{', '}')
      if (close < 0) {
        cssText += input.slice(next)
        break
      }

      configCss += `${input.slice(next, close + 1)}\n`
      sawConfig = true
      index = close + 1
      continue
    }

    const end = findTopLevelStatementEnd(input, cursor)
    configCss += `${input.slice(next, end.contentEnd)}\n`
    sawConfig = true
    index = end.resumeAt
  }

  return { css: cssText, configCss, inline: false }
}

export function findFirstMeaningful(input: string): number {
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (/\s/.test(char)) continue

    if (char === '/' && next === '*') {
      const close = input.indexOf('*/', index + 2)
      if (close < 0) return -1
      index = close + 1
      continue
    }

    if (char === '/' && next === '/') {
      index = skipLineComment(input, index + 2)
      continue
    }

    return index
  }

  return -1
}

export function findNextTopLevelAt(input: string, start: number): number {
  const stack: string[] = []
  let quote: '"' | "'" | null = null
  let blockComment = false
  let lineComment = false

  for (let index = start; index < input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false
      continue
    }

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

    if (char === '/' && next === '/') {
      lineComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    const close = closingDelimiterFor(char)
    if (close) {
      stack.push(close)
      continue
    }

    if (isClosingDelimiter(char)) {
      if (stack.at(-1) === char) stack.pop()
      continue
    }

    if (stack.length === 0 && char === '@' && isDirectiveStart(input[index + 1] ?? '')) {
      return index
    }
  }

  return -1
}

function readDirectiveNameEnd(input: string, start: number): number {
  let index = start
  while (index < input.length && /[a-zA-Z0-9_-]/.test(input[index] ?? '')) index += 1
  return index
}

function skipWhitespace(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] ?? '')) index += 1
  return index
}

function readTopLevelNamedBlock(input: string, start: number): { readonly open: number } | null {
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = start; index < input.length; index += 1) {
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

    if (char === '{') return { open: index }
    if (char === ';' || char === '\n' || char === '\r' || char === '}') return null
  }

  return null
}

function findTopLevelStatementEnd(
  input: string,
  start: number,
): { readonly contentEnd: number; readonly resumeAt: number } {
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = start; index < input.length; index += 1) {
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

    if (char === ';') return { contentEnd: index + 1, resumeAt: index + 1 }

    if (char === '\n' || char === '\r') {
      const resumeAt = char === '\r' && next === '\n' ? index + 2 : index + 1
      return { contentEnd: index, resumeAt }
    }
  }

  return { contentEnd: input.length, resumeAt: input.length }
}

function startsWithDirective(input: string, index: number, name: string): boolean {
  const source = input.slice(index, index + name.length + 1).toLowerCase()
  return source === `@${name}` && isDirectiveBoundary(input[index + name.length + 1] ?? '')
}

function skipLineComment(input: string, start: number): number {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === '\n' || input[index] === '\r') return index
  }
  return input.length
}

function closingDelimiterFor(char: string): string | undefined {
  if (char === '(') return ')'
  if (char === '[') return ']'
  if (char === '{') return '}'
  return undefined
}

function isClosingDelimiter(char: string): boolean {
  return char === ')' || char === ']' || char === '}'
}

function isDirectiveStart(value: string): boolean {
  return /^[a-zA-Z]$/.test(value)
}

function isDirectiveBoundary(value: string): boolean {
  return !value || !/^[a-zA-Z0-9_-]$/.test(value)
}
