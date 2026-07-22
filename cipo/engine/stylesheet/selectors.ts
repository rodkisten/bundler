import { isEscapedAt } from '../../runtime-dsl/shared'
import type { CipoBlockNode } from '../../types'
import { isStylesheetAtRuleName } from '../at-rule-kinds'
import { normalizeFabricaSelectorSyntax } from
  '../fabrica-selector-syntax'

/** Returns whether top-level text has declarations instead of only blocks. */
export function hasTopLevelLooseStatements(input: string): boolean {
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = 0; index < input.length; index += 1) {
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
      buffer += char
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
      buffer += char
      continue
    }

    if (char === '{') {
      if (depth === 0 && buffer.trim()) buffer = ''
      depth += 1
      continue
    }

    if (char === '}') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) buffer = ''
      continue
    }

    if (depth === 0) {
      buffer += char
      if (char === ';' && buffer.trim()) return true
    }
  }

  return buffer.trim().length > 0
}

/** Classifies whether an AST root block is valid in full stylesheet mode. */
export function isStylesheetRootBlock(node: CipoBlockNode): boolean {
  const name = node.name.trim()
  if (!name || name.startsWith('x:') || name.startsWith('&')) return false
  if (isStylesheetAtRuleName(name)) return true
  return isRootSelector(name)
}

/** Resolves nested selectors while preserving cartesian combinations. */
export function resolveNestedSelectors(
  parents: readonly string[],
  children: readonly string[],
): readonly string[] {
  if (parents.length === 0) return children

  const output: string[] = []
  for (const parent of parents) {
    for (const child of children) {
      output.push(
        child.includes('&')
          ? child.replaceAll('&', parent)
          : `${parent} ${child}`,
      )
    }
  }
  return output
}

/** Splits selectors without breaking nested function or attribute commas. */
export function splitSelectorList(selector: string): readonly string[] {
  const output: string[] = []
  const stack: string[] = []
  let buffer = ''
  let quote: '"' | "'" | null = null
  let blockComment = false

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index] ?? ''
    const next = selector[index + 1] ?? ''

    if (blockComment) {
      buffer += char
      if (char === '*' && next === '/') {
        buffer += next
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      buffer += char
      if (char === quote && !isEscapedAt(selector, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      buffer += '/*'
      blockComment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }

    const close = closingDelimiterFor(char)
    if (close) stack.push(close)
    else if (isClosingDelimiter(char) && stack.at(-1) === char) stack.pop()

    if (char === ',' && stack.length === 0) {
      if (buffer.trim()) {
        output.push(normalizeFabricaSelectorSyntax(buffer.trim()))
      }
      buffer = ''
      continue
    }

    buffer += char
  }

  if (buffer.trim()) {
    output.push(normalizeFabricaSelectorSyntax(buffer.trim()))
  }
  return output
}

export function copyStrings(input: readonly string[]): string[] {
  const output = new Array<string>(input.length)
  for (let index = 0; index < input.length; index += 1) {
    output[index] = input[index]!
  }
  return output
}

/** Splits runtime contexts while preserving nested function/bracket colons. */
export function splitRuntimeContextParts(input: string): string[] {
  const output: string[] = []
  const stack: string[] = []
  let quote: '"' | "'" | null = null
  let start = 0

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index] ?? ''

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null
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

    if (index < input.length && (char !== ':' || stack.length > 0)) continue

    const part = input.slice(start, index).trim()
    if (part) output.push(part)
    start = index + 1
  }

  return output
}

export function prefixSelectors(
  prefix: string,
  selectors: readonly string[],
): string[] {
  const output = new Array<string>(selectors.length)
  for (let index = 0; index < selectors.length; index += 1) {
    output[index] = `${prefix} ${selectors[index]}`
  }
  return output
}

export function appendPseudoToSelectors(
  selectors: readonly string[],
  pseudo: string,
): string[] {
  const output = new Array<string>(selectors.length)
  for (let index = 0; index < selectors.length; index += 1) {
    output[index] = `${selectors[index]}:${pseudo}`
  }
  return output
}

export function joinSelectors(selectors: readonly string[]): string {
  let output = ''
  for (let index = 0; index < selectors.length; index += 1) {
    output += output ? `,${selectors[index]}` : selectors[index]
  }
  return output
}

function isRootSelector(name: string): boolean {
  const selectors = splitSelectorList(name)
  if (selectors.length === 0) return false
  return selectors.every(isValidRootSelectorBranch)
}

function isValidRootSelectorBranch(selector: string): boolean {
  const trimmed = selector.trim()
  if (!trimmed || /^[0-9_-]/.test(trimmed)) return false
  if (/^[>+~]|[>+~]$/.test(trimmed)) return false

  const stack: string[] = []
  let quote: '"' | "'" | null = null

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index] ?? ''

    if (quote) {
      if (char === quote && !isEscapedAt(trimmed, index)) quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    const close = closingDelimiterFor(char)
    if (close) stack.push(close)
    else if (isClosingDelimiter(char)) {
      if (stack.at(-1) !== char) return false
      stack.pop()
    }
  }

  if (quote || stack.length > 0) return false
  return /[.#:[*]|^[a-z]/i.test(trimmed)
}

function closingDelimiterFor(char: string): string | undefined {
  if (char === '(') return ')'
  if (char === '[') return ']'
  return undefined
}

function isClosingDelimiter(char: string): boolean {
  return char === ')' || char === ']'
}
