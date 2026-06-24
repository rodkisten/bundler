import { runtime } from './runtime'
import { toKebabMixed } from './utils'

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
