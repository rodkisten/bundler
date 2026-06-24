import { runtime } from './runtime'
import { toKebabMixed } from './utils'

/**
 * Normalizes declarative `@property $$name` headers before runtime variable parsing.
 *
 * @remarks
 * Runtime variable expansion treats `$$name` as a value reference. In an
 * `@property` header the same syntax names a custom property instead, so it must
 * be converted first. The scanner only consumes identifier characters after the
 * directive marker and leaves the block body unchanged.
 *
 * @param input - CSS source that may contain declarative typed-property blocks.
 * @returns CSS with directive names converted to prefixed custom-property names.
 *
 * @example
 * ```ts
 * normalizePropertyDirectiveNames('@property $$angle { syntax: "<angle>" }')
 * // '@property --cipo-angle { syntax: "<angle>" }'
 * ```
 */
export function normalizePropertyDirectiveNames(input: string): string {
  const marker = '@property $$'
  const parts = input.split(marker)
  if (parts.length === 1) return input

  let output = parts[0] || ''
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index] || ''
    let end = 0
    while (end < part.length && /[a-zA-Z0-9_.-]/.test(part[end] || '')) end += 1
    const name = toKebabMixed(part.slice(0, end).replace(/[._]+/g, '-'))
    output += `@property --${runtime.config.prefix}-${name}${part.slice(end)}`
  }
  return output
}
