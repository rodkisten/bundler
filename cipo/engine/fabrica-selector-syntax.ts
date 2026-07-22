import { toKebabMixed } from '../utils'

const FABRICA_DATA_OBJECT_NAME = 'data'

const NATIVE_PSEUDO_NAMES = new Set([
  'active',
  'after',
  'any-link',
  'autofill',
  'backdrop',
  'before',
  'checked',
  'cue',
  'default',
  'defined',
  'dir',
  'disabled',
  'empty',
  'enabled',
  'file-selector-button',
  'first',
  'first-child',
  'first-letter',
  'first-line',
  'first-of-type',
  'focus',
  'focus-visible',
  'focus-within',
  'fullscreen',
  'future',
  'has',
  'host',
  'host-context',
  'hover',
  'in-range',
  'indeterminate',
  'invalid',
  'is',
  'lang',
  'last-child',
  'last-of-type',
  'left',
  'link',
  'local-link',
  'marker',
  'modal',
  'not',
  'nth-child',
  'nth-col',
  'nth-last-child',
  'nth-last-col',
  'nth-last-of-type',
  'nth-of-type',
  'only-child',
  'only-of-type',
  'optional',
  'out-of-range',
  'part',
  'past',
  'paused',
  'picture-in-picture',
  'placeholder',
  'placeholder-shown',
  'playing',
  'read-only',
  'read-write',
  'required',
  'right',
  'root',
  'scope',
  'selection',
  'slotted',
  'state',
  'target',
  'target-within',
  'user-invalid',
  'user-valid',
  'valid',
  'visited',
  'where',
])

/**
 * Lowers Fábrica-style state selectors into native CSS selectors.
 *
 * @remarks
 * This intentionally mirrors Fábrica's public attribute contract without
 * importing Fábrica at runtime. Cipó is a dependency of Fábrica, so importing
 * back from Cipó would create a package cycle.
 *
 * Supported forms:
 *
 * - `:state='open'` -> `[data-state="open"]`
 * - `:panelState` -> `[data-panel-state]`
 * - `?disabled` -> `[disabled]`
 *
 * Native pseudo-classes and pseudo-elements remain untouched.
 */
export function normalizeFabricaSelectorSyntax(selector: string): string {
  let output = ''
  let index = 0
  let quote: QuoteState | null = null
  let attributeDepth = 0

  while (index < selector.length) {
    const char = selector[index] ?? ''

    if (quote) {
      output += char
      if (char === quote.close && !isEscaped(selector, index)) quote = null
      index += 1
      continue
    }

    const quoteState = getQuoteState(char)
    if (quoteState) {
      quote = quoteState
      output += char
      index += 1
      continue
    }

    if (char === '[') {
      attributeDepth += 1
      output += char
      index += 1
      continue
    }

    if (char === ']') {
      attributeDepth = Math.max(0, attributeDepth - 1)
      output += char
      index += 1
      continue
    }

    if (attributeDepth === 0 && char === '?') {
      const boolean = readBooleanAttribute(selector, index)
      if (boolean) {
        output += `[${boolean.name}]`
        index = boolean.end
        continue
      }
    }

    if (attributeDepth === 0 && char === ':') {
      const data = readDataAttribute(selector, index)
      if (data) {
        output += data.selector
        index = data.end
        continue
      }
    }

    output += char
    index += 1
  }

  return output
}

type QuoteState = {
  readonly close: string
}

type SelectorRewrite = {
  readonly selector: string
  readonly end: number
}

function readBooleanAttribute(
  selector: string,
  start: number,
): { readonly name: string; readonly end: number } | null {
  const nameStart = start + 1
  const nameEnd = readIdentifierEnd(selector, nameStart)
  if (nameEnd === nameStart) return null

  return {
    name: selector.slice(nameStart, nameEnd),
    end: nameEnd,
  }
}

function readDataAttribute(
  selector: string,
  start: number,
): SelectorRewrite | null {
  if (selector[start - 1] === ':' || selector[start + 1] === ':') return null

  const nameStart = start + 1
  if (!/[A-Za-z_]/.test(selector[nameStart] ?? '')) return null
  const nameEnd = readIdentifierEnd(selector, nameStart)
  if (nameEnd === nameStart) return null

  const rawName = selector.slice(nameStart, nameEnd)
  let cursor = skipSpaces(selector, nameEnd)

  if (selector[cursor] === '(') return null

  const operator = readAttributeOperator(selector, cursor)
  if (!operator) {
    if (isNativePseudoName(rawName) || rawName === FABRICA_DATA_OBJECT_NAME) {
      return null
    }

    return {
      selector: `[${toFabricaDataAttributeName(rawName)}]`,
      end: nameEnd,
    }
  }

  cursor = skipSpaces(selector, operator.end)
  const value = readAttributeValue(selector, cursor)
  if (!value || rawName === FABRICA_DATA_OBJECT_NAME) return null

  return {
    selector: [
      '[',
      toFabricaDataAttributeName(rawName),
      operator.value,
      '"',
      escapeAttributeValue(value.value),
      '"]',
    ].join(''),
    end: value.end,
  }
}


function readAttributeOperator(
  selector: string,
  start: number,
): { readonly value: string; readonly end: number } | null {
  if (selector[start] === '=') {
    return { value: '=', end: start + 1 }
  }

  const prefix = selector[start] ?? ''
  if (!'~^$*|'.includes(prefix) || selector[start + 1] !== '=') {
    return null
  }

  return {
    value: `${prefix}=`,
    end: start + 2,
  }
}

function readAttributeValue(
  selector: string,
  start: number,
): { readonly value: string; readonly end: number } | null {
  const quote = getQuoteState(selector[start] ?? '')
  if (quote) {
    let index = start + 1
    let value = ''

    while (index < selector.length) {
      const char = selector[index] ?? ''
      if (char === quote.close && !isEscaped(selector, index)) {
        return { value, end: index + 1 }
      }
      value += char
      index += 1
    }

    return null
  }

  let end = start
  while (end < selector.length && isUnquotedValueChar(selector[end] ?? '')) {
    end += 1
  }

  if (end === start) return null
  return { value: selector.slice(start, end), end }
}

function toFabricaDataAttributeName(name: string): string {
  const withoutPrefix = name.replace(/^data-?/, '')
  return `data-${toKebabMixed(withoutPrefix)}`
}

function isNativePseudoName(name: string): boolean {
  return NATIVE_PSEUDO_NAMES.has(name.toLowerCase())
}

function readIdentifierEnd(input: string, start: number): number {
  let end = start
  while (end < input.length && /[A-Za-z0-9_.-]/.test(input[end] ?? '')) {
    end += 1
  }
  return end
}

function skipSpaces(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] ?? '')) index += 1
  return index
}

function isUnquotedValueChar(char: string): boolean {
  return /[A-Za-z0-9_-]/.test(char)
}

function getQuoteState(char: string): QuoteState | null {
  if (char === '"' || char === "'") return { close: char }
  if (char === '“') return { close: '”' }
  if (char === '‘') return { close: '’' }
  return null
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isEscaped(input: string, index: number): boolean {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (input[cursor] !== '\\') break
    slashCount += 1
  }
  return slashCount % 2 === 1
}
