export interface OptimizeCompiledCssOptions {
  readonly minify?: boolean
  readonly mergeEquivalentRules?: boolean
  readonly privateCustomPropertyPattern?: RegExp
}

/**
 * Applies production-safe CSS compaction after Cipó has finished semantic compilation.
 * The optimizer deliberately avoids changing public custom properties or declaration order.
 */
export function optimizeCompiledCss(
  css: string,
  options: OptimizeCompiledCssOptions = {},
): string {
  if (!css.trim()) return ''

  let output = options.minify === false ? css.trim() : minifyCss(css)
  if (options.privateCustomPropertyPattern) {
    output = manglePrivateCustomProperties(output, options.privateCustomPropertyPattern)
  }
  if (options.mergeEquivalentRules !== false) output = mergeEquivalentTopLevelRules(output)
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
      if (previous && !/[{}:;,>~]/.test(previous) && following && !/[{}:;,>~]/.test(following)) output += ' '
      index = cursor
      continue
    }

    if (char === '0' && next === '.' && (!output || /[\s(:,]/.test(output.at(-1)!))) {
      index += 1
      continue
    }

    if (char === '}' && output.endsWith(';')) output = output.slice(0, -1)
    output += char
    index += 1
  }

  return output.trim()
}

function manglePrivateCustomProperties(css: string, pattern: RegExp): string {
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

/** Merges only flat top-level rules with identical bodies; nested at-rules remain untouched. */
function mergeEquivalentTopLevelRules(css: string): string {
  if (css.includes('@')) return css

  const rules: Array<{ selector: string; body: string }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(css))) {
    if (match.index !== cursor) return css
    rules.push({ selector: match[1]!.trim(), body: match[2]!.trim() })
    cursor = re.lastIndex
  }
  if (cursor !== css.length || rules.length < 2) return css

  const byBody = new Map<string, string[]>()
  for (const rule of rules) {
    const selectors = byBody.get(rule.body)
    if (selectors) selectors.push(rule.selector)
    else byBody.set(rule.body, [rule.selector])
  }

  return [...byBody].map(([body, selectors]) => `${selectors.join(',')}{${body}}`).join('')
}
