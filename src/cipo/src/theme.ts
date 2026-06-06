import { DEFAULT_SPACING_VALUE } from './constants'
import { runtime } from './runtime'
import type { CipoTheme, CipoThemeValue } from './types'
import { createDeclaration, isPlainObject } from './utils'
import { insertCss } from './injection'
import { wrapLayer } from './format'
import { normalizeValue } from './values'

/**
 * Registers theme tokens and injects them as CSS custom properties.
 *
 * @remarks
 * New API: `configure({ theme })` calls this internally. Old API: direct
 * `theme({...})` remains fully supported.
 *
 * Cipó also creates short `$token` aliases when they are unambiguous:
 * `$brand -> var(--cipo-colors-brand)`, `$xl -> var(--cipo-radius-xl)`.
 * Ambiguous short names are tracked and warned when used.
 *
 * @param tokens - Nested theme object.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * theme({ colors: { brand: '#f97316' }, radius: { xl: '24px' } })
 *
 * css`
 *   bg: $brand;
 *   rounded: $xl;
 * `
 * ```
 *
 * Output CSS:
 * ```css
 * :root {
 *   --cipo-colors-brand: #f97316;
 *   --cipo-radius-xl: 1.5rem;
 * }
 * ```
 */
export function theme(tokens: CipoTheme): void {
  registerThemeTokens(tokens)
  injectThemeTokens(tokens)
}

/**
 * Registers token lookup metadata without injecting CSS.
 *
 * @param tokens - Theme object.
 * @returns Nothing.
 */
export function registerThemeTokens(tokens: CipoTheme): void {
  const flattened = flattenTheme(tokens)

  for (const [fullName] of flattened) {
    runtime.themeKeys.add(fullName)
    const shortName = fullName.split('-').at(-1)
    if (!shortName) continue

    const existing = runtime.shortThemeTokens.get(shortName)
    if (existing && existing !== fullName) {
      runtime.ambiguousThemeTokens.set(shortName, [existing, fullName])
      runtime.shortThemeTokens.delete(shortName)
      continue
    }

    if (!runtime.ambiguousThemeTokens.has(shortName)) {
      runtime.shortThemeTokens.set(shortName, fullName)
    }
  }

  runtime.themeVersion += 1
}

/**
 * Injects the theme custom property declarations.
 *
 * @param tokens - Theme object.
 * @returns Nothing.
 */
export function injectThemeTokens(tokens: CipoTheme): void {
  const declarations = flattenTheme(tokens)
    .map(([name, value]) => createDeclaration(`--${runtime.config.prefix}-${name}`, normalizeValue('theme-token', String(value))))
    .join('')

  if (!declarations) return
  insertCss(wrapLayer('tokens', `${runtime.config.themeRootSelector}{${declarations}}`))
}

/**
 * Flattens a nested token object into dash-separated token names.
 *
 * @param tokens - Theme object.
 * @param path - Current token path.
 * @returns Flat token entries.
 *
 * @example
 * ```ts
 * flattenTheme({ colors: { brand: '#f97316' } })
 * // [['colors-brand', '#f97316']]
 * ```
 */
export function flattenTheme(tokens: CipoTheme, path: readonly string[] = []): Array<readonly [string, string | number]> {
  const output: Array<readonly [string, string | number]> = []

  for (const [key, value] of Object.entries(tokens)) {
    const nextPath = [...path, key]

    if (isThemeBranch(value)) {
      output.push(...flattenTheme(value, nextPath))
      continue
    }

    output.push([nextPath.join('-'), value])
  }

  return output
}

/**
 * Resolves `$token`, `$colors.brand`, `$radius.xl` and legacy `$theme.*`.
 *
 * @param input - CSS source.
 * @returns CSS source with CSS variables.
 *
 * @example
 * ```ts
 * resolveThemeReferences('bg: $brand;')
 * // 'bg: var(--cipo-colors-brand);'
 * ```
 */
export function resolveThemeReferences(input: string): string {
  return input
    .replace(/\$theme\.([a-zA-Z0-9._-]+)/g, (_match, tokenPath: string) => toCssVar(tokenPath))
    .replace(/\$([a-zA-Z][\w-]*)\.([a-zA-Z0-9._-]+)/g, (_match, namespace: string, path: string) => toCssVar(`${namespace}.${path}`))
    .replace(/\$([a-zA-Z][\w-]*)/g, (match, shortName: string) => {
      const explicit = runtime.themeKeys.has(shortName) ? shortName : runtime.shortThemeTokens.get(shortName)
      if (explicit) return toCssVar(explicit)
      if (shortName === 'spacing') return `var(--${runtime.config.prefix}-spacing, ${DEFAULT_SPACING_VALUE})`
      return match
    })
}

/**
 * Converts a dotted/dashed token path into a prefixed CSS variable.
 *
 * @param tokenPath - Token path.
 * @returns CSS var reference.
 */
export function toCssVar(tokenPath: string): string {
  const normalized = tokenPath.replaceAll('.', '-')
  return `var(--${runtime.config.prefix}-${normalized})`
}

function isThemeBranch(value: CipoThemeValue): value is CipoTheme {
  return isPlainObject(value)
}
