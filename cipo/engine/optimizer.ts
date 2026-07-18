import { manglePrivateCustomPropertiesSafe, minifyCssText } from '../syntax/css-lexer'
import { findMatchingBrace } from '../utils'

export interface OptimizeCompiledCssOptions {
  readonly minify?: boolean
  readonly mergeEquivalentRules?: boolean
  readonly mergeEquivalentAtRules?: boolean
  readonly privateCustomPropertyPattern?: RegExp
}

interface CssRuleListNode {
  readonly prelude: string
  readonly body: string | null
  readonly terminator: '' | ';'
  readonly atRuleName: string | null
}

const GROUPABLE_AT_RULES = new Set([
  'media',
  'supports',
  'container',
])

const RECURSIVE_RULE_LIST_AT_RULES = new Set([
  ...GROUPABLE_AT_RULES,
  'layer',
  'scope',
])

/**
 * Applies production-safe CSS compaction after Cipó has finished semantic
 * compilation. The optimizer deliberately avoids changing public custom
 * properties or declaration order.
 */
export function optimizeCompiledCss(
  css: string,
  options: OptimizeCompiledCssOptions = {},
): string {
  if (!css.trim()) return ''

  let output = options.minify === false ? css.trim() : minifyCssText(css)

  if (options.privateCustomPropertyPattern) {
    output = manglePrivateCustomPropertiesSafe(output, options.privateCustomPropertyPattern)
  }

  const shouldMergeEquivalentAtRules =
    options.mergeEquivalentAtRules ?? options.minify !== false

  if (shouldMergeEquivalentAtRules) {
    output = mergeAdjacentEquivalentAtRules(output)
  }

  if (options.mergeEquivalentRules !== false) {
    output = mergeEquivalentTopLevelRules(output)
  }

  return output
}

/**
 * Coalesces adjacent equivalent grouping at-rules without reordering cascade
 * segments. Only consecutive `@media`, `@supports`, and `@container` blocks
 * with the same normalized prelude are merged.
 *
 * Rule-list wrappers such as `@layer` and `@scope` are traversed recursively so
 * equivalent media queries generated inside the same wrapper can also share a
 * single block. Style-rule bodies are deliberately left opaque because modern
 * CSS nesting allows declarations and nested rules to coexist there.
 */
function mergeAdjacentEquivalentAtRules(css: string): string {
  const nodes = parseRuleList(css)
  if (!nodes || nodes.length === 0) return css

  const merged: CssRuleListNode[] = []

  for (const node of nodes) {
    const previous = merged.at(-1)

    if (
      previous
      && isGroupableAtRule(previous)
      && isGroupableAtRule(node)
      && atRuleMergeKey(previous) === atRuleMergeKey(node)
    ) {
      merged[merged.length - 1] = {
        ...previous,
        body: `${previous.body ?? ''}${node.body ?? ''}`,
      }
      continue
    }

    merged.push(node)
  }

  return merged.map(serializeRuleListNode).join('')
}

function parseRuleList(css: string): CssRuleListNode[] | null {
  const nodes: CssRuleListNode[] = []
  let index = 0

  while (index < css.length) {
    index = skipWhitespaceAndComments(css, index)
    if (index >= css.length) break

    const start = index
    const boundary = findRuleBoundary(css, start)
    if (!boundary) return null

    const prelude = css.slice(start, boundary.index).trim()
    if (!prelude) return null

    if (boundary.kind === ';') {
      nodes.push({
        prelude,
        body: null,
        terminator: ';',
        atRuleName: readAtRuleName(prelude),
      })
      index = boundary.index + 1
      continue
    }

    const close = findMatchingBrace(css, boundary.index)
    if (close < 0) return null

    nodes.push({
      prelude,
      body: css.slice(boundary.index + 1, close),
      terminator: '',
      atRuleName: readAtRuleName(prelude),
    })

    index = close + 1
  }

  return nodes
}

function serializeRuleListNode(node: CssRuleListNode): string {
  if (node.body == null) {
    return `${node.prelude}${node.terminator}`
  }

  const body = node.atRuleName
    && RECURSIVE_RULE_LIST_AT_RULES.has(node.atRuleName)
    ? mergeAdjacentEquivalentAtRules(node.body)
    : node.body

  return `${node.prelude}{${body}}`
}

function isGroupableAtRule(node: CssRuleListNode): boolean {
  return Boolean(
    node.body != null
    && node.atRuleName
    && GROUPABLE_AT_RULES.has(node.atRuleName),
  )
}

function atRuleMergeKey(node: CssRuleListNode): string {
  return minifyCssText(node.prelude)
}

function readAtRuleName(prelude: string): string | null {
  const match = prelude.match(/^@([A-Za-z-]+)/)
  return match?.[1]?.toLowerCase() ?? null
}

function skipWhitespaceAndComments(css: string, start: number): number {
  let index = start

  while (index < css.length) {
    if (/\s/.test(css[index]!)) {
      index += 1
      continue
    }

    if (css[index] === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2)
      if (end < 0) return css.length
      index = end + 2
      continue
    }

    break
  }

  return index
}

function findRuleBoundary(
  css: string,
  start: number,
): { readonly index: number; readonly kind: '{' | ';' } | null {
  let quote = ''
  let escaped = false
  let parentheses = 0
  let brackets = 0

  for (let index = start; index < css.length; index += 1) {
    const char = css[index]!
    const next = css[index + 1] ?? ''

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === '/' && next === '*') {
      const end = css.indexOf('*/', index + 2)
      if (end < 0) return null
      index = end + 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '(') {
      parentheses += 1
      continue
    }

    if (char === ')') {
      parentheses = Math.max(0, parentheses - 1)
      continue
    }

    if (char === '[') {
      brackets += 1
      continue
    }

    if (char === ']') {
      brackets = Math.max(0, brackets - 1)
      continue
    }

    if (parentheses === 0 && brackets === 0) {
      if (char === '{') return { index, kind: '{' }
      if (char === ';') return { index, kind: ';' }
    }
  }

  return null
}


/**
 * Merges only adjacent flat top-level style rules with identical declaration
 * bodies. Adjacency is required to preserve cascade order.
 */
function mergeEquivalentTopLevelRules(css: string): string {
  const nodes = parseRuleList(css)
  if (!nodes || nodes.length < 2) return css

  const merged: CssRuleListNode[] = []
  for (const node of nodes) {
    const previous = merged.at(-1)
    if (
      previous
      && previous.atRuleName === null
      && node.atRuleName === null
      && previous.body !== null
      && node.body !== null
      && canonicalRuleBody(previous.body) === canonicalRuleBody(node.body)
    ) {
      merged[merged.length - 1] = {
        ...previous,
        prelude: `${previous.prelude},${node.prelude}`,
      }
      continue
    }
    merged.push(node)
  }

  return merged.map(serializeRuleListNode).join('')
}

function canonicalRuleBody(body: string): string {
  return minifyCssText(body)
}
