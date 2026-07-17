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

  let output = options.minify === false ? css.trim() : minifyCss(css)

  if (options.privateCustomPropertyPattern) {
    output = manglePrivateCustomProperties(
      output,
      options.privateCustomPropertyPattern,
    )
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

function minifyCss(css: string): string {
  let output = ''
  let quote = ''
  let escaped = false
  let index = 0

  while (index < css.length) {
    const char = css[index]!
    const next = css[index + 1] ?? ''

    if (quote) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      index += 1
      continue
    }

    if (char === '/' && next === '*') {
      const end = css.indexOf('*/', index + 2)
      index = end < 0 ? css.length : end + 2
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      output += char
      index += 1
      continue
    }

    if (/\s/.test(char)) {
      let cursor = index + 1
      while (cursor < css.length && /\s/.test(css[cursor]!)) cursor += 1
      const previous = output.at(-1) ?? ''
      const following = css[cursor] ?? ''
      if (
        previous
        && !/[{}:;,>~]/.test(previous)
        && following
        && !/[{}:;,>~]/.test(following)
      ) {
        output += ' '
      }
      index = cursor
      continue
    }

    if (
      char === '0'
      && next === '.'
      && (!output || /[\s(:,]/.test(output.at(-1)!))
    ) {
      index += 1
      continue
    }

    if (char === '}' && output.endsWith(';')) {
      output = output.slice(0, -1)
    }

    output += char
    index += 1
  }

  return output.trim()
}

function manglePrivateCustomProperties(
  css: string,
  pattern: RegExp,
): string {
  const names = new Map<string, string>()
  const flags = pattern.flags.replace(/[gy]/g, '')
  const safePattern = new RegExp(pattern.source, flags)
  const customProperty = /--[A-Za-z0-9_-]+/g

  for (const match of css.matchAll(customProperty)) {
    const name = match[0]
    safePattern.lastIndex = 0
    if (!safePattern.test(name) || names.has(name)) continue
    names.set(name, `--${encodeIdentifier(names.size)}`)
  }

  if (names.size === 0) return css
  return css.replace(customProperty, (name) => names.get(name) ?? name)
}

function encodeIdentifier(index: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const radix = alphabet.length
  let value = index
  let output = ''

  do {
    output = alphabet[value % radix]! + output
    value = Math.floor(value / radix) - 1
  } while (value >= 0)

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
  return minifyCss(node.prelude)
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

function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 1
  let quote = ''
  let escaped = false
  let parentheses = 0
  let brackets = 0

  for (let index = openIndex + 1; index < css.length; index += 1) {
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
      if (end < 0) return -1
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
      if (char === '{') {
        depth += 1
        continue
      }

      if (char === '}') {
        depth -= 1
        if (depth === 0) return index
      }
    }
  }

  return -1
}

/** Merges only flat top-level rules with identical bodies. */
function mergeEquivalentTopLevelRules(css: string): string {
  if (css.includes('@')) return css

  const rules: Array<{ selector: string; body: string }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(css))) {
    if (match.index !== cursor) return css
    rules.push({
      selector: match[1]!.trim(),
      body: match[2]!.trim(),
    })
    cursor = re.lastIndex
  }

  if (cursor !== css.length || rules.length < 2) return css

  const byBody = new Map<string, string[]>()

  for (const rule of rules) {
    const selectors = byBody.get(rule.body)
    if (selectors) selectors.push(rule.selector)
    else byBody.set(rule.body, [rule.selector])
  }

  return [...byBody]
    .map(([body, selectors]) => `${selectors.join(',')}{${body}}`)
    .join('')
}
