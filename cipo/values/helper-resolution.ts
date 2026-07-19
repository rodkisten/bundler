import { normalizePxValues } from '../helpers'
import { runtime } from '../runtime'
import type { CipoHelperContext } from '../types'
import {
  findMatching,
  isEscapedAt,
  isIdentifierPart,
  isIdentifierStart,
  readIdentifierEnd,
  skipSpaces,
} from '../runtime-dsl/shared'
import type { ValueNormalizer } from './contracts'

const MAX_HELPER_PASSES = 12

type HelperMatch = {
  readonly start: number
  readonly name: string
  readonly openIndex: number
}

/** Creates the bounded helper resolver once per value-normalization pipeline. */
export function createHelperResolver(normalizeValue: ValueNormalizer): (input: string) => string {
  function resolveHelpers(input: string): string {
    let current = input

    for (let pass = 0; pass < MAX_HELPER_PASSES; pass += 1) {
      const next = resolveHelpersOnePass(current)
      if (next === current) return normalizePxValues(next)
      current = next
    }

    const next = resolveHelpersOnePass(current)
    if (next !== current) {
      runtime.warningSink.push({
        code: 'cipo-helper-expansion-limit',
        message: `Helper expansion reached the ${MAX_HELPER_PASSES}-pass safety limit.`,
      })
    }

    return normalizePxValues(current)
  }

  function resolveHelpersOnePass(input: string): string {
    let output = ''
    let index = 0
    let changed = false

    while (index < input.length) {
      const match = findHelperStart(input, index)

      if (!match) {
        output += input.slice(index)
        break
      }

      output += input.slice(index, match.start)
      const closeIndex = findMatching(input, match.openIndex, '(', ')')

      if (closeIndex < 0) {
        output += input.slice(match.start)
        break
      }

      const helper = runtime.helperRegistry.get(match.name)
      if (!helper) {
        output += input.slice(match.start, closeIndex + 1)
        index = closeIndex + 1
        continue
      }

      const args = input.slice(match.openIndex + 1, closeIndex)
      const context: CipoHelperContext = {
        name: match.name,
        raw: args,
        config: runtime.config,
        resolveValue(value: string, property = 'helper') {
          return normalizeValue(property, value)
        },
      }

      output += helper(args, context)
      changed = true
      index = closeIndex + 1
    }

    return changed ? output : input
  }

  function findHelperStart(input: string, fromIndex: number): HelperMatch | null {
    let quote: '"' | "'" | null = null
    let blockComment = false

    for (let index = fromIndex; index < input.length; index += 1) {
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

      const legacy = readLegacyHelperMatch(input, index)
      if (legacy) return legacy

      if (!isIdentifierStart(char)) continue
      if (index > 0 && isIdentifierPart(input[index - 1] ?? '')) continue

      const nameEnd = readIdentifierEnd(input, index)
      const name = input.slice(index, nameEnd)
      const openIndex = skipSpaces(input, nameEnd)

      if (input[openIndex] === '(' && runtime.helperRegistry.has(name)) {
        return { start: index, name, openIndex }
      }

      index = nameEnd - 1
    }

    return null
  }

  function readLegacyHelperMatch(input: string, start: number): HelperMatch | null {
    if (input[start] !== 'x' || input[start + 1] !== ':') return null
    if (start > 0 && isIdentifierPart(input[start - 1] ?? '')) return null

    const nameStart = skipSpaces(input, start + 2)
    if (!isIdentifierStart(input[nameStart] ?? '')) return null

    const nameEnd = readIdentifierEnd(input, nameStart)
    const name = input.slice(nameStart, nameEnd)
    const openIndex = skipSpaces(input, nameEnd)

    if (input[openIndex] !== '(' || !runtime.helperRegistry.has(name)) return null
    return { start, name, openIndex }
  }

  return resolveHelpers
}
