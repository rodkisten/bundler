import { runtime } from './runtime'

/** Converts a dotted theme token path into its prefixed CSS custom property reference. */
export function toCssVar(tokenPath: string): string {
  const normalized = tokenPath.replaceAll('.', '-')
  return `var(--${runtime.config.prefix}-${normalized})`
}

/**
 * Resolves a theme reference with property and scale awareness without depending on theme mutation APIs.
 *
 * @remarks
 * Keeping lookup separate from `theme.ts` makes value normalization depend on a read-only token resolver
 * instead of the module that registers and injects themes. This removes the historical values/theme cycle.
 */
export function resolveThemeReferencesForValue(
  input: string,
  property = '',
  scale = 'none',
): string {
  const fallback = resolveThemeFallbackExpression(input, property, scale)
  if (fallback !== null) return fallback

  let output = ''

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char !== '$') {
      output += char
      continue
    }

    if (input[index + 1] === '$') {
      output += '$$'
      index += 1
      continue
    }

    const chain = readThemeFallbackChainAt(
      input,
      index,
      property,
      scale,
    )
    if (chain) {
      output += chain.value
      index = chain.end - 1
      continue
    }

    const next = input[index + 1] ?? ''
    if (!/[a-zA-Z_]/.test(next)) {
      output += char
      continue
    }

    let end = index + 1
    while (
      end < input.length
      && /[a-zA-Z0-9_.-]/.test(input[end] ?? '')
    ) {
      end += 1
    }

    const token = input.slice(index + 1, end)
    const resolved = resolveTokenPath(token, property, scale)
    output += resolved ? toCssVar(resolved) : `$${token}`
    index = end - 1
  }

  return output
}


interface ThemeFallbackChain {
  readonly value: string
  readonly end: number
}

function readThemeFallbackChainAt(
  input: string,
  start: number,
  property: string,
  scale: string,
): ThemeFallbackChain | null {
  const first = readThemeTokenAt(input, start)
  if (!first) return null

  const tokens = [first.token]
  let cursor = first.end

  while (cursor < input.length) {
    const separatorStart = skipThemeWhitespace(input, cursor)
    if (input.slice(separatorStart, separatorStart + 2) !== '??') break

    const tokenStart = skipThemeWhitespace(input, separatorStart + 2)
    const next = readThemeTokenAt(input, tokenStart)
    if (!next) break

    tokens.push(next.token)
    cursor = next.end
  }

  if (tokens.length < 2) return null

  let value = resolveThemeFallbackToken(
    tokens[tokens.length - 1]!,
    property,
    scale,
  )

  for (let index = tokens.length - 2; index >= 0; index -= 1) {
    const path = resolveThemeTokenPath(tokens[index]!, property, scale)
    value = `var(--${runtime.config.prefix}-${path}, ${value})`
  }

  return { value, end: cursor }
}

function readThemeTokenAt(
  input: string,
  start: number,
): { readonly token: string; readonly end: number } | null {
  if (input[start] !== '$' || input[start + 1] === '$') return null
  if (!/[a-zA-Z_]/.test(input[start + 1] ?? '')) return null

  let end = start + 1
  while (
    end < input.length
    && /[a-zA-Z0-9_.-]/.test(input[end] ?? '')
  ) {
    end += 1
  }

  return {
    token: input.slice(start + 1, end),
    end,
  }
}

function skipThemeWhitespace(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] ?? '')) {
    index += 1
  }
  return index
}

function resolveThemeFallbackToken(
  token: string,
  property: string,
  scale: string,
): string {
  return toCssVar(resolveThemeTokenPath(token, property, scale))
}

function resolveThemeTokenPath(
  token: string,
  property: string,
  scale: string,
): string {
  const resolved = resolveTokenPath(token, property, scale)
  if (resolved) return resolved

  const normalized = token.replaceAll('.', '-')
  if (token.includes('.')) return normalized

  const namespace = inferThemeNamespace(property, scale)
  return namespace ? `${namespace}-${normalized}` : normalized
}

/** Resolves a token name into a complete registered theme path. */
export function resolveTokenPath(token: string, property = '', scale = 'none'): string {
  if (!token) return ''
  if (token === 'spacing') return 'spacing'
  if (token.includes('.')) return token.replaceAll('.', '-')
  if (runtime.themeKeys.has(token)) return token

  const namespace = inferThemeNamespace(property, scale)
  if (namespace) {
    const namespaced = `${namespace}-${token}`
    if (runtime.themeKeys.has(namespaced)) return namespaced
  }

  return runtime.shortThemeTokens.get(token) ?? ''
}

/** Infers the most appropriate theme namespace for a property/value scale pair. */
export function inferThemeNamespace(property: string, scale = 'none'): string {
  if (scale === 'color') return 'colors'
  if (scale === 'radius') return 'radius'
  if (scale === 'shadow') return 'shadow'
  if (scale === 'text') return 'text'

  const normalized = property.toLowerCase()
  if (
    normalized === 'background' ||
    normalized === 'background-color' ||
    normalized === 'color' ||
    normalized === 'fill' ||
    normalized === 'stroke' ||
    normalized === 'caret-color' ||
    normalized === 'accent-color' ||
    normalized.endsWith('color')
  ) return 'colors'
  if (
    normalized === 'box-shadow' ||
    normalized === 'text-shadow' ||
    normalized === 'filter' ||
    normalized === 'backdrop-filter'
  ) return 'shadow'
  if (normalized === 'border-radius') return 'radius'
  if (normalized === 'font-size') return 'text'
  return ''
}


function resolveThemeFallbackExpression(
  input: string,
  property: string,
  scale: string,
): string | null {
  const parts = splitThemeFallbacks(input)
  if (parts.length < 2) return null

  const [first, ...rest] = parts
  const firstToken = readExactThemeToken(first ?? '')
  if (!firstToken) return null

  const firstPath = resolveThemeTokenPath(
    firstToken,
    property,
    scale,
  )
  const fallback = resolveThemeFallbackTail(rest, property, scale)
  return `var(--${runtime.config.prefix}-${firstPath}, ${fallback})`
}

function resolveThemeFallbackTail(
  parts: readonly string[],
  property: string,
  scale: string,
): string {
  const [first, ...rest] = parts
  const token = readExactThemeToken(first ?? '')
  const resolved = token
    ? toCssVar(
        resolveTokenPath(token, property, scale)
          || token.replaceAll('.', '-'),
      )
    : resolveThemeReferencesForValue(first ?? '', property, scale)

  if (rest.length === 0) return resolved
  if (!token) return resolved

  const path = resolveThemeTokenPath(token, property, scale)
  return [
    `var(--${runtime.config.prefix}-${path}, `,
    resolveThemeFallbackTail(rest, property, scale),
    ')',
  ].join('')
}

function readExactThemeToken(input: string): string {
  const source = input.trim()
  const match = /^\$([a-zA-Z_][a-zA-Z0-9_.-]*)$/.exec(source)
  return match?.[1] ?? ''
}

function splitThemeFallbacks(input: string): string[] {
  const output: string[] = []
  let start = 0
  let quote: string | null = null
  let depth = 0

  for (let index = 0; index < input.length - 1; index += 1) {
    const char = input[index] ?? ''
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (
      depth === 0
      && char === '?'
      && input[index + 1] === '?'
    ) {
      output.push(input.slice(start, index).trim())
      start = index + 2
      index += 1
    }
  }

  if (output.length === 0) return [input]
  output.push(input.slice(start).trim())
  return output
}
