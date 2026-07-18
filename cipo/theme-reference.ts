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
export function resolveThemeReferencesForValue(input: string, property = '', scale = 'none'): string {
  let output = ''

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char !== '$') {
      output += char
      continue
    }

    const next = input[index + 1] ?? ''
    if (!/[a-zA-Z_]/.test(next)) {
      output += char
      continue
    }

    let end = index + 1
    while (end < input.length && /[a-zA-Z0-9_.-]/.test(input[end] ?? '')) end += 1

    const token = input.slice(index + 1, end)
    const resolved = resolveTokenPath(token, property, scale)
    output += resolved ? toCssVar(resolved) : `$${token}`
    index = end - 1
  }

  return output
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
