import type { CipoBlockNode } from '../../types'
import { isStylesheetAtRuleName } from '../at-rule-kinds'

/** Returns true when top-level text contains declarations instead of only blocks. */
export function hasTopLevelLooseStatements(input: string): boolean {
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      buffer += char
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; buffer += char; continue }
    if (char === '{') { if (depth === 0 && buffer.trim()) buffer = ''; depth += 1; continue }
    if (char === '}') { depth = Math.max(0, depth - 1); if (depth === 0) buffer = ''; continue }
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

/** Resolves nested selectors while preserving cartesian selector combinations. */
export function resolveNestedSelectors(parents: readonly string[], children: readonly string[]): readonly string[] {
  if (parents.length === 0) return children
  const output: string[] = []
  for (const parent of parents) {
    for (const child of children) output.push(child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`)
  }
  return output
}

/** Splits a selector list without breaking commas inside functions or attribute selectors. */
export function splitSelectorList(selector: string): readonly string[] {
  const output: string[] = []
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index]
    if (quote) {
      buffer += char
      if (char === quote && selector[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; buffer += char; continue }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      if (buffer.trim()) output.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += char
  }
  if (buffer.trim()) output.push(buffer.trim())
  return output
}

export function copyStrings(input: readonly string[]): string[] {
  const output = new Array<string>(input.length)
  for (let index = 0; index < input.length; index += 1) output[index] = input[index]!
  return output
}

export function splitRuntimeContextParts(input: string): string[] {
  const output: string[] = []
  let start = 0
  for (let index = 0; index <= input.length; index += 1) {
    if (index < input.length && input[index] !== ':') continue
    const part = input.slice(start, index).trim()
    if (part) output.push(part)
    start = index + 1
  }
  return output
}

export function prefixSelectors(prefix: string, selectors: readonly string[]): string[] {
  const output = new Array<string>(selectors.length)
  for (let index = 0; index < selectors.length; index += 1) output[index] = `${prefix} ${selectors[index]}`
  return output
}

export function appendPseudoToSelectors(selectors: readonly string[], pseudo: string): string[] {
  const output = new Array<string>(selectors.length)
  for (let index = 0; index < selectors.length; index += 1) output[index] = `${selectors[index]}:${pseudo}`
  return output
}

export function joinSelectors(selectors: readonly string[]): string {
  let output = ''
  for (let index = 0; index < selectors.length; index += 1) output += output ? `,${selectors[index]}` : selectors[index]
  return output
}

function isRootSelector(name: string): boolean {
  if (name.startsWith('.') || name.startsWith('#') || name.startsWith(':') || name.startsWith('[') || name.startsWith('*')) return true
  if (name.includes(',') || name.includes('>') || name.includes('+') || name.includes('~') || name.includes(' ')) return true
  return /^[a-z][a-z0-9-]*$/i.test(name)
}
