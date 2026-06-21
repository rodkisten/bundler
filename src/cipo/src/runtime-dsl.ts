import { runtime } from './runtime'
import type { CipoWarning } from './types'
import { splitTopLevel, toKebabMixed } from './utils'

/**
 * Runtime-only Cipó design-language expansion.
 *
 * @remarks
 * This module intentionally stays string-first and single-pass friendly. It is
 * allowed in the browser runtime because it only expands bounded tokens,
 * mixins, custom-property math and generated color utilities into static CSS.
 * Heavy generators, deep type-checking and loops remain build-time concerns.
 *
 * Supported runtime features:
 * - `$dock(...)` token objects that flatten into `$$dock-*` variables.
 * - `$$mixin(name: type) { ... }` declaration mixins.
 * - `mixin(value)` calls with small `if param = value { ... }` macro blocks.
 * - `$$var: $$other - 1px` and declaration math that compiles to `calc(...)`.
 * - Tailwind-like OKLCH color utilities: `color-amber-245`, `bg-sky-200`.
 */
export function expandRuntimeDsl(input: string, warnings: CipoWarning[]): string {
  const mixinState = extractRuntimeMixins(input, warnings)
  let output = mixinState.source
  output = expandRuntimeTokenObjects(output, warnings)
  output = expandRuntimeMixinCalls(output, mixinState.mixins, warnings)
  output = expandRuntimeColorUtilities(output)
  output = normalizeRuntimeVariableMath(output)
  return output
}

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

function extractRuntimeMixins(input: string, warnings: CipoWarning[]): RuntimeMixinState {
  let output = ''
  const mixins: Record<string, RuntimeMixin> = Object.create(null)
  let index = 0

  while (index < input.length) {
    const start = input.indexOf('$$', index)
    if (start < 0) {
      output += input.slice(index)
      break
    }

    output += input.slice(index, start)

    const nameStart = start + 2
    const nameEnd = readIdentifierEnd(input, nameStart)
    const name = input.slice(nameStart, nameEnd)
    let cursor = skipSpaces(input, nameEnd)

    if (!name || input[cursor] !== '(') {
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
      warnings.push({ code: 'cipo-mixin-unclosed', message: `Unclosed runtime mixin: ${name}` })
      output += input.slice(start)
      break
    }

    mixins[name] = {
      name,
      params: parseMixinParams(input.slice(cursor === -1 ? closeParen + 1 : start, closeParen + 1), input.slice(closeParen - (closeParen - cursor), closeParen)),
      body: input.slice(cursor + 1, closeBrace),
    }
    // parse params directly from the parenthesized content to avoid allocations in hot paths above.
    mixins[name] = { ...mixins[name], params: parseMixinParams(name, input.slice(input.indexOf('(', start) + 1, closeParen)) }
    index = closeBrace + 1
  }

  return { source: output, mixins }
}

function parseMixinParams(_name: string, raw: string): RuntimeMixinParam[] {
  const parts = splitTopLevel(raw, ',')
  const params: RuntimeMixinParam[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] || '').trim()
    if (!part) continue
    const colon = findTopLevelChar(part, ':')
    const equals = findTopLevelChar(part, '=')
    const nameEnd = colon > 0 ? colon : equals > 0 ? equals : part.length
    const name = part.slice(0, nameEnd).trim().replace(/^[$*]+/, '')
    const type = colon > 0 ? part.slice(colon + 1, equals > colon ? equals : part.length).trim() : ''
    const fallback = equals > 0 ? part.slice(equals + 1).trim() : ''
    if (name) params.push({ name, type, fallback })
  }

  return params
}

function expandRuntimeMixinCalls(input: string, mixins: Record<string, RuntimeMixin>, warnings: CipoWarning[]): string {
  let current = input

  for (let pass = 0; pass < 8; pass += 1) {
    const next = expandRuntimeMixinCallsOnePass(current, mixins, warnings)
    if (next === current) return next
    current = next
  }

  return current
}

function expandRuntimeMixinCallsOnePass(input: string, mixins: Record<string, RuntimeMixin>, warnings: CipoWarning[]): string {
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
      warnings.push({ code: 'cipo-mixin-call-unclosed', message: `Unclosed runtime mixin call: ${name}` })
      output += input.slice(start)
      break
    }

    output += renderRuntimeMixin(mixins[name]!, input.slice(open + 1, close))
    index = close + 1
  }

  return output
}

function findNextMixinCall(input: string, startIndex: number, mixins: Record<string, RuntimeMixin>): number {
  let quote: '"' | "'" | null = null

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (!isIdentifierStart(char || '')) continue
    if (index > 0 && isIdentifierPart(input[index - 1] || '')) continue

    const end = readIdentifierEnd(input, index)
    const name = input.slice(index, end)
    if (!mixins[name]) { index = end; continue }
    const open = skipSpaces(input, end)
    if (input[open] === '(') return index
    index = end
  }

  return -1
}

function renderRuntimeMixin(mixin: RuntimeMixin, rawArgs: string): string {
  const args = splitTopLevel(rawArgs, ',')
  const values: Record<string, string> = Object.create(null)

  for (let index = 0; index < mixin.params.length; index += 1) {
    const param = mixin.params[index]!
    values[param.name] = (args[index] || param.fallback || '').trim().replace(/^['"]|['"]$/g, '')
  }

  let body = stripRuntimeIfBlocks(mixin.body, values)

  for (let index = 0; index < mixin.params.length; index += 1) {
    const param = mixin.params[index]!
    const value = values[param.name] || ''
    body = replaceParam(body, param.name, value)
  }

  return body
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
  for (let index = startIndex; index < input.length - 1; index += 1) {
    if (input[index] !== 'i' || input[index + 1] !== 'f') continue
    const previous = input[index - 1] || ''
    const next = input[index + 2] || ''
    if ((previous && isIdentifierPart(previous)) || (next && isIdentifierPart(next))) continue
    return index
  }
  return -1
}


function findRuntimeIfBlockOpen(input: string, startIndex: number): number {
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') { depth += 1; continue }
    if (char === ')' || char === ']') { depth = Math.max(0, depth - 1); continue }
    if (char === '{' && depth === 0) return index
  }
  return -1
}

function evaluateRuntimeCondition(condition: string, values: Record<string, string>): boolean {
  const equals = findTopLevelChar(condition, '=')
  if (equals < 0) return false
  const left = condition.slice(0, equals).trim().replace(/^[$*]+/, '')
  const right = condition.slice(equals + 1).trim().replace(/^['"]|['"]$/g, '')
  return String(values[left] || '') === right
}

function replaceParam(input: string, name: string, value: string): string {
  let output = ''
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if ((char === '*' || char === '$') && input.slice(index + 1, index + 1 + name.length) === name) {
      const before = input[index - 1] || ''
      const after = input[index + 1 + name.length] || ''
      if (isParamBoundary(before) && isParamBoundary(after)) {
        output += value
        index += name.length
        continue
      }
    }
    output += char
  }
  return output
}

function expandRuntimeTokenObjects(input: string, warnings: CipoWarning[]): string {
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
      warnings.push({ code: 'cipo-token-object-unclosed', message: `Unclosed token object: ${name}` })
      output += input.slice(start)
      break
    }

    output += renderTokenObject(name, input.slice(open + 1, close))
    index = close + 1
  }

  return output
}

function findTokenObjectStart(input: string, startIndex: number): number {
  let quote: '"' | "'" | null = null
  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char !== '$' || input[index + 1] === '$') continue
    if (!isIdentifierStart(input[index + 1] || '')) continue
    const nameEnd = readIdentifierEnd(input, index + 1)
    const open = skipSpaces(input, nameEnd)
    if (input[open] === '(') return index
    index = nameEnd
  }
  return -1
}

function renderTokenObject(name: string, body: string): string {
  const declarations: string[] = []
  const entries = parseObjectEntries(body)
  flattenTokenEntries(name, entries, declarations)
  return declarations.join('\n')
}

type ObjectEntry = { key: string; value: string | ObjectEntry[] }

function parseObjectEntries(body: string): ObjectEntry[] {
  const parts = splitTopLevel(body, ',')
  const output: ObjectEntry[] = []

  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] || '').trim().replace(/;$/, '').trim()
    if (!part) continue
    const colon = findTopLevelChar(part, ':')
    if (colon <= 0) continue
    const key = part.slice(0, colon).trim().replace(/^[$]+/, '')
    let value = part.slice(colon + 1).trim()
    if (value.startsWith('(') && value.endsWith(')')) output.push({ key, value: parseObjectEntries(value.slice(1, -1)) })
    else output.push({ key, value })
  }

  return output
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

function expandRuntimeColorUtilities(input: string): string {
  let output = ''
  let line = ''

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index] || '\n'
    if (char !== '\n' && char !== '\r') {
      line += char
      continue
    }

    const expanded = expandColorUtilityLine(line)
    output += expanded + char
    line = ''
  }

  return output
}

function expandColorUtilityLine(line: string): string {
  const indentSize = line.length - line.trimStart().length
  const indent = line.slice(0, indentSize)
  const trimmed = line.trim().replace(/;$/, '')
  if (!trimmed || trimmed.includes(':') || trimmed.includes('{') || trimmed.includes('}')) return line

  const match = /^(bg|color)-([a-z]+)-([0-9]{1,3})$/.exec(trimmed)
  if (!match) return line

  const property = match[1] === 'bg' ? 'background' : 'color'
  return `${indent}${property}: ${createOklchUtilityColor(match[2]!, Number(match[3]))}`
}

const HUE_BY_NAME: Record<string, number> = {
  slate: 260, gray: 260, zinc: 260, neutral: 260, stone: 60,
  red: 29, orange: 45, amber: 72, yellow: 92, lime: 125, green: 150,
  emerald: 162, teal: 185, cyan: 215, sky: 240, blue: 260, indigo: 278,
  violet: 300, purple: 315, fuchsia: 334, pink: 350, rose: 18, accent: 205,
}

export function createOklchUtilityColor(name: string, shade: number): string {
  const safeShade = Math.max(0, Math.min(999, Number.isFinite(shade) ? shade : 500))
  const t = safeShade / 999
  const hue = HUE_BY_NAME[name] ?? hashHue(name)
  const lightness = clamp(0.16 + (1 - t) * 0.76, 0.12, 0.96)
  const chroma = clamp(0.04 + Math.sin(Math.PI * t) * 0.24, 0.035, 0.28)
  return `oklch(${round(lightness)} ${round(chroma)} ${round(hue)})`
}

function hashHue(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  return hash % 360
}

function normalizeRuntimeVariableMath(input: string): string {
  let output = ''
  let start = 0

  for (let index = 0; index <= input.length; index += 1) {
    if (index < input.length && input[index] !== '\n' && input[index] !== ';') continue
    const chunk = input.slice(start, index)
    output += normalizeRuntimeDeclarationChunk(chunk) + (input[index] || '')
    start = index + 1
  }

  return output
}

function normalizeRuntimeDeclarationChunk(chunk: string): string {
  if (chunk.indexOf('{') >= 0 || chunk.indexOf('}') >= 0) return chunk
  const colon = findTopLevelChar(chunk, ':')
  if (colon <= 0) return chunk
  const before = chunk.slice(0, colon + 1)
  const value = chunk.slice(colon + 1).trim()
  if (!value) return chunk
  return `${before} ${normalizeRuntimeExpression(value)}`
}

function normalizeRuntimeExpression(value: string): string {
  const withVars = replaceRuntimeVars(value.trim())
  if (withVars.startsWith('calc(')) return withVars
  if (!hasTopLevelMath(withVars)) return withVars
  return `calc(${withVars})`
}

function replaceRuntimeVars(value: string): string {
  let output = ''
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '$' && value[index + 1] === '$' && isIdentifierStart(value[index + 2] || '')) {
      const start = index + 2
      const end = readIdentifierEnd(value, start)
      const name = toKebabMixed(value.slice(start, end).replace(/[._]+/g, '-'))
      output += `var(--${runtime.config.prefix}-${name})`
      index = end - 1
      continue
    }
    output += value[index]
  }
  return output
}

function hasTopLevelMath(value: string): boolean {
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') { depth += 1; continue }
    if (char === ')' || char === ']') { depth = Math.max(0, depth - 1); continue }
    if (depth === 0 && (char === '+' || char === '*' || char === '/')) return true
    if (depth === 0 && char === '-' && index > 0 && /\s/.test(value[index - 1] || '') && /\s/.test(value[index + 1] || '')) return true
  }
  return false
}

function findTopLevelChar(value: string, target: string): number {
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[' || char === '{') { depth += 1; continue }
    if (char === ')' || char === ']' || char === '}') { depth = Math.max(0, depth - 1); continue }
    if (depth === 0 && char === target) return index
  }
  return -1
}

function findMatching(input: string, openIndex: number, openChar: string, closeChar: string): number {
  if (input[openIndex] !== openChar) return -1
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === openChar) depth += 1
    else if (char === closeChar) depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function readIdentifierEnd(input: string, start: number): number {
  let index = start
  while (index < input.length && isIdentifierPart(input[index] || '')) index += 1
  return index
}

function skipSpaces(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] || '')) index += 1
  return index
}

function isIdentifierStart(value: string): boolean {
  return /[a-zA-Z_]/.test(value)
}

function isIdentifierPart(value: string): boolean {
  return /[a-zA-Z0-9_.-]/.test(value)
}


function isParamBoundary(value: string): boolean {
  return !value || !/[a-zA-Z0-9_.]/.test(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): string {
  return String(Math.round(value * 10000) / 10000)
}
