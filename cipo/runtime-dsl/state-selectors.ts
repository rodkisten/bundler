import { splitTopLevel, toKebabMixed } from '../utils'

export interface RuntimeStateCondition {
  readonly kind: 'data' | 'boolean'
  readonly name: string
  readonly value?: string
  readonly negate: boolean
}

/**
 * Parses one state expression used by state(), group(), peer() and compound().
 *
 * Supported forms intentionally mirror Fábrica's DOM authoring surface:
 * `active`, `:active`, `!disabled`, `?disabled`, `variant=primary` and
 * `size:[lg,xl]` when the caller expands arrays.
 */
export function parseRuntimeStateCondition(
  input: string,
): RuntimeStateCondition | null {
  let source = input.trim()
  if (!source) return null

  let negate = false
  if (source.startsWith('!')) {
    negate = true
    source = source.slice(1).trim()
  }

  if (source.startsWith('?')) {
    const name = sanitizeStateName(source.slice(1))
    return name
      ? { kind: 'boolean', name, negate }
      : null
  }

  if (source.startsWith(':')) source = source.slice(1).trim()

  const equal = findStateOperator(source, '=')
  const colon = findStateOperator(source, ':')
  const separator = equal >= 0 ? equal : colon

  if (separator < 0) {
    const name = sanitizeStateName(source)
    return name
      ? { kind: 'data', name, negate }
      : null
  }

  const name = sanitizeStateName(source.slice(0, separator))
  const value = stripStateQuotes(source.slice(separator + 1))
  if (!name || !value) return null

  return {
    kind: 'data',
    name,
    value,
    negate,
  }
}

/** Returns one native CSS selector fragment for a parsed state condition. */
export function renderRuntimeStateCondition(
  condition: RuntimeStateCondition,
): string {
  const attribute = condition.kind === 'boolean'
    ? `[${condition.name}]`
    : condition.value === undefined
      ? `[data-${condition.name}]`
      : `[data-${condition.name}="${escapeAttributeValue(condition.value)}"]`

  return condition.negate
    ? `:not(${attribute})`
    : attribute
}

/** Parses a comma-separated condition list. */
export function parseRuntimeStateConditions(
  input: string,
): RuntimeStateCondition[] {
  const output: RuntimeStateCondition[] = []

  for (const part of splitTopLevel(input, ',')) {
    const condition = parseRuntimeStateCondition(part)
    if (condition) output.push(condition)
  }

  return output
}

/** Expands an array-like state value into individual normalized values. */
export function parseRuntimeStateValues(input: string): string[] {
  const source = input.trim()
  if (!source.startsWith('[') || !source.endsWith(']')) {
    const value = stripStateQuotes(source)
    return value ? [toKebabMixed(value)] : []
  }

  return splitTopLevel(source.slice(1, -1), ',')
    .map(stripStateQuotes)
    .filter(Boolean)
    .map(toKebabMixed)
}

function sanitizeStateName(input: string): string {
  return toKebabMixed(
    input
      .trim()
      .replace(/^data-?/, '')
      .replace(/^[.$*#]+/, '')
      .replace(/[^a-zA-Z0-9_.-]+/g, '-'),
  ).replace(/^-+|-+$/g, '')
}

function stripStateQuotes(input: string): string {
  return input
    .trim()
    .replace(/^["'“‘]|["'”’]$/g, '')
}

function findStateOperator(input: string, operator: string): number {
  let quote: string | null = null
  let depth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? ''
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '[' || char === '(') depth += 1
    else if (char === ']' || char === ')') depth -= 1
    else if (char === operator && depth === 0) return index
  }

  return -1
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
