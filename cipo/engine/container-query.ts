import { runtime } from '../runtime'
import { splitTopLevel } from '../utils'

/** Normalizes extended container shorthand into native @container text. */
export function normalizeContainerQuery(input: string): string {
  const source = input.trim()
  if (!source) return source

  const comparison = [
    '^',
    '([a-zA-Z][\\w-]*)?',
    '\\s*(>=|<=|>|<)\\s*',
    '([a-zA-Z][\\w-]*|[^\\s]+)',
    '$',
  ].join('')
  const match = new RegExp(comparison).exec(source)
  if (match) {
    const name = match[1] || ''
    const operator = match[2] || '>='
    const rawValue = match[3] || ''
    const configured = runtime.config.breakpoints[rawValue]
    const value = configured
      ? readBreakpointValue(configured)
      : rawValue
    const feature = operator === '<=' || operator === '<'
      ? 'max-width'
      : 'min-width'
    const query = `(${feature}: ${value})`
    return name ? `${name} ${query}` : query
  }

  return source
}

/**
 * Normalizes x:container(name, min:..., max:...) shorthand into query text.
 */
export function normalizeContainerContext(input: string): string {
  const parts = splitTopLevel(input, ',')
  const name = (parts.shift() || '').trim()
  const conditions: string[] = []

  for (const part of parts) {
    const colon = part.indexOf(':')
    if (colon <= 0) continue
    const key = part.slice(0, colon).trim()
    const rawValue = part.slice(colon + 1).trim()
    const configured = runtime.config.breakpoints[rawValue]
    const value = configured
      ? readBreakpointValue(configured)
      : rawValue
    if (!value) continue
    if (key === 'min') conditions.push(`(min-width: ${value})`)
    else if (key === 'max') conditions.push(`(max-width: ${value})`)
    else if (key === 'width') conditions.push(`(width: ${value})`)
  }

  if (conditions.length === 0) return normalizeContainerQuery(name)
  return `${name} ${conditions.join(' and ')}`.trim()
}

function readBreakpointValue(query: string): string {
  const match = /(?:min|max)-width\s*:\s*([^\)]+)/.exec(query)
  return match?.[1]?.trim() || query
}
