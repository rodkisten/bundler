export interface SourceEdit { readonly start: number; readonly end: number; readonly value: string }

export const FABRICA_VALUE_PREFIX = '%%fabrica_value_'
export const FABRICA_VALUE_SUFFIX = '%%'
export const FABRICA_SPREAD_PREFIX = '%%fabrica_spread_'
export const FABRICA_SPREAD_SUFFIX = '%%'

export function normalizeAttributeName(name: string): string {
  if (name === 'className') return 'class'
  return name
}

export function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1)
  return value
}

export function readValueMarker(value: string): number | null {
  const match = value.match(/^%%fabrica_value_(\d+)%%$/)
  return match ? Number(match[1]) : null
}

export function readSpreadMarker(value: string): number | null {
  const spread = value.match(/^%%fabrica_spread_(\d+)%%$/)
  if (spread) return Number(spread[1])

  const legacySpread = value.match(/^\.\.\.%%fabrica_value_(\d+)%%$/)
  return legacySpread ? Number(legacySpread[1]) : null
}

export function isVoidTag(tag: string): boolean {
  return /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tag)
}

export function isSvgTag(tag: string): boolean {
  return /^(svg|path|circle|rect|line|polyline|polygon|ellipse|g|defs|symbol|use|text|tspan|linearGradient|radialGradient|stop|clipPath|mask)$/i.test(tag)
}

export function createElementForTag(tag: string): Element {
  return isSvgTag(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag)
}

export function normalizeTemplateStrings(strings: TemplateStringsArray | readonly string[]): TemplateStringsArray {
  if (isTemplateStringsArray(strings)) return strings
  const cooked = strings.slice() as string[] & { raw?: readonly string[] }
  Object.defineProperty(cooked, 'raw', { configurable: false, enumerable: false, value: strings.slice() })
  return cooked as unknown as TemplateStringsArray
}

function isTemplateStringsArray(value: TemplateStringsArray | readonly string[]): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray((value as { raw?: unknown }).raw)
}

export function isTagBoundary(source: string, start: number): boolean {
  const before = source[start - 1] ?? ''
  return !/[$\w.]/.test(before)
}

export function countTemplateValues(source: string, templateStart: number, templateEnd: number): number {
  let count = 0
  for (let index = templateStart; index < templateEnd; index += 1) if (source[index] === '$' && source[index + 1] === '{') count += 1
  return count
}

export function findTemplateEnd(source: string, start: number): number {
  let escaped = false
  let expressionDepth = 0
  let quote = ''
  let templateExpressionDepth = 0

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!
    const next = source[index + 1]

    if (quote) {
      if (escaped) { escaped = false; continue }
      if (char === '\\') { escaped = true; continue }
      if (quote === '`' && char === '$' && next === '{') { templateExpressionDepth += 1; index += 1; continue }
      if (quote === '`' && char === '}' && templateExpressionDepth > 0) { templateExpressionDepth -= 1; continue }
      if (char === quote && templateExpressionDepth === 0) quote = ''
      continue
    }

    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }

    if (expressionDepth > 0) {
      if (char === '"' || char === "'" || char === '`') { quote = char; continue }
      if (char === '{') { expressionDepth += 1; continue }
      if (char === '}') { expressionDepth -= 1; continue }
      continue
    }

    if (char === '$' && next === '{') { expressionDepth = 1; index += 1; continue }
    if (char === '`') return index
  }
  return -1
}

export function applyEdits(source: string, edits: readonly SourceEdit[]): string {
  let output = ''
  let cursor = 0
  for (const edit of edits) {
    if (edit.start < cursor) continue
    output += source.slice(cursor, edit.start)
    output += edit.value
    cursor = edit.end
  }
  return output + source.slice(cursor)
}
