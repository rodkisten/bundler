import { runtime } from './runtime'
import type {
  CipoTheme,
  CipoThemeValue,
  CipoTypedThemeValue,
  CipoTypedValue,
  CipoWarning,
} from './types'
import { createDeclaration, isPlainObject, warn } from './utils'
import { insertCss } from './injection'
import { wrapLayer } from './format'
import { normalizeValue } from './values'
import { normalizeRuntimeExpression } from './runtime-dsl/math'
import { mergeTheme } from './config-css/shared'
import {
  resolveThemeReferencesForValue as resolveThemeValueReferences,
  resolveTokenPath,
  toCssVar,
} from './theme-reference'
export { inferThemeNamespace, resolveThemeReferencesForValue, resolveTokenPath, toCssVar } from './theme-reference'
import { getTypedInitialValue, isTypedValue, property } from './properties'
import {
  getThemeType,
  isTypedThemeValue,
  typedTheme,
  validateThemeValue,
} from './theme-types'

/**
 * Registers theme tokens and injects them as CSS custom properties.
 *
 * @remarks
 * CSS-first typed groups such as `radius<length>: (...)` arrive here as typed
 * theme nodes. Every leaf is validated once, receives precise warnings and is
 * registered through `@property` only when its semantic type has a valid browser
 * syntax.
 */
export type FlattenedThemeValue = string | number | CipoTypedValue | CipoTypedThemeValue
export type FlattenedThemeEntry = readonly [string, FlattenedThemeValue]

const themeValueSignatures = new Map<string, string>()
const namedThemes = new Map<string, CipoTheme>()

export function theme(tokens: CipoTheme, warnings: CipoWarning[] = []): void {
  const flattened = flattenTheme(tokens)
  registerThemeEntries(flattened)
  injectThemeEntries(
    flattened,
    warnings,
    runtime.config.themeRootSelector,
  )
}

/** Registers token lookup metadata without injecting CSS. */
export function registerThemeTokens(tokens: CipoTheme): void {
  registerThemeEntries(flattenTheme(tokens))
}

/** Injects the theme custom property declarations. */
export function injectThemeTokens(tokens: CipoTheme, warnings: CipoWarning[] = []): void {
  injectThemeEntries(
    flattenTheme(tokens),
    warnings,
    runtime.config.themeRootSelector,
  )
}



export interface CipoThemeScopeOptions {
  readonly extends?: string
  readonly selector?: string
}

/**
 * Registers a named theme scope and emits its variables under a data-theme
 * selector. Parent scopes are merged eagerly so a scope is self-contained even
 * when it is mounted without an ancestor theme element.
 */
export function themeScope(
  name: string,
  tokens: CipoTheme,
  options: CipoThemeScopeOptions = {},
  warnings: CipoWarning[] = [],
): void {
  const key = normalizeThemeScopeName(name)
  if (!key) return

  const parentName = normalizeThemeScopeName(options.extends ?? '')
  const parent = parentName ? namedThemes.get(parentName) : undefined
  if (parentName && !parent) {
    warn(
      runtime,
      warnings,
      'cipo-theme-scope-parent-missing',
      `Theme scope "${key}" extends unknown theme "${parentName}".`,
      { name: key, extends: parentName },
    )
  }

  const merged = parent ? mergeTheme(parent, tokens) : tokens
  namedThemes.set(key, merged)
  const flattened = flattenTheme(merged)
  registerThemeEntries(flattened)
  injectThemeEntries(
    flattened,
    warnings,
    options.selector ?? `[data-theme="${escapeThemeSelector(key)}"]`,
  )
}

/** Returns a registered named theme for tooling and compiler integration. */
export function getThemeScope(name: string): CipoTheme | undefined {
  return namedThemes.get(normalizeThemeScopeName(name))
}

/** Clears named theme scope metadata during a public runtime reset. */
export function resetThemeScopes(): void {
  namedThemes.clear()
  themeValueSignatures.clear()
}

function normalizeThemeScopeName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeThemeSelector(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function registerThemeEntries(flattened: readonly FlattenedThemeEntry[]): void {
  let changed = false

  for (let index = 0; index < flattened.length; index += 1) {
    const [fullName, value] = flattened[index]!
    const signature = themeValueSignature(value)

    if (themeValueSignatures.get(fullName) !== signature) {
      themeValueSignatures.set(fullName, signature)
      changed = true
    }

    runtime.themeKeys.add(fullName)
    const shortName = fullName.slice(fullName.lastIndexOf('-') + 1)
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

  if (changed) runtime.themeVersion += 1
}

function injectThemeEntries(
  flattened: readonly FlattenedThemeEntry[],
  warnings: CipoWarning[],
  selector: string,
): void {
  let declarations = ''

  for (let index = 0; index < flattened.length; index += 1) {
    const [name, value] = flattened[index]!
    const propertyName = `--${runtime.config.prefix}-${name}`

    if (isTypedValue(value)) {
      property(propertyName, {
        syntax: value.syntax,
        inherits: value.inherits,
        initialValue: value.initialValue,
      })
      declarations += createDeclaration(propertyName, getTypedInitialValue(value))
      continue
    }

    if (isTypedThemeValue(value)) {
      declarations += compileTypedThemeDeclaration(name, propertyName, value, warnings)
      continue
    }

    declarations += createDeclaration(
      propertyName,
      normalizeRuntimeExpression(
        normalizeValue('theme-token', String(value)),
      ),
    )
  }

  if (declarations) {
    insertCss(wrapLayer('tokens', `${selector}{${declarations}}`))
  }
}

function compileTypedThemeDeclaration(
  path: string,
  propertyName: string,
  token: CipoTypedThemeValue,
  warnings: CipoWarning[],
): string {
  const rawValue = String(token.value)
  const validationMode = token.validation ?? runtime.config.themeValidation
  const result = validationMode === 'off'
    ? { status: 'valid' as const, valid: true, type: token.type, value: rawValue }
    : validateThemeValue(token.type, rawValue, { path })

  if (result.status === 'invalid') {
    const message = `Invalid <${token.type}> theme token "${path}": ${result.reason ?? 'invalid CSS value'} Received: ${JSON.stringify(rawValue)}.`
    if (validationMode === 'strict') {
      throw new TypeError(`[Cipó:${result.code ?? 'cipo-theme-value-invalid'}] ${message}`)
    }
    if (validationMode === 'warn') {
      warn(
        runtime,
        warnings,
        result.code ?? 'cipo-theme-value-invalid',
        message,
        { path, type: token.type, value: rawValue },
      )
    }
  }

  registerTypedThemeProperty(path, propertyName, token, result.status, warnings)
  return createDeclaration(
    propertyName,
    normalizeRuntimeExpression(normalizeValue('theme-token', rawValue)),
  )
}

function registerTypedThemeProperty(
  path: string,
  propertyName: string,
  token: CipoTypedThemeValue,
  validationStatus: 'valid' | 'invalid' | 'deferred',
  warnings: CipoWarning[],
): void {
  const definition = getThemeType(token.type)
  if (!definition) return

  const requested = token.register
  const shouldAutoRegister =
    requested === 'auto' &&
    runtime.config.registerTypedThemeProperties &&
    definition.registrable !== false
  const shouldRegister = requested === true || shouldAutoRegister
  if (!shouldRegister) return

  if (!definition.registrable || !definition.cssSyntax) {
    if (requested === true) {
      warn(
        runtime,
        warnings,
        'cipo-theme-type-not-registrable',
        `Theme type <${token.type}> validates "${path}" but cannot be represented safely by CSS @property syntax.`,
        { path, type: token.type },
      )
    }
    return
  }

  if (validationStatus === 'invalid') return

  const initialValue = token.initialValue ?? definition.initialValue
  if (initialValue === undefined || String(initialValue).trim() === '') {
    warn(
      runtime,
      warnings,
      'cipo-theme-property-initial-missing',
      `Typed theme token "${path}" cannot emit @property because <${token.type}> has no safe initial value.`,
      { path, type: token.type },
    )
    return
  }

  const validationMode = token.validation ?? runtime.config.themeValidation
  if (validationMode !== 'off') {
    const initialValidation = validateThemeValue(token.type, initialValue, {
      path: `${path}.@property.initial`,
    })
    if (initialValidation.status !== 'valid') {
      const message = `Typed theme token "${path}" cannot emit @property because its initial value ${JSON.stringify(String(initialValue))} is not a static valid <${token.type}>: ${initialValidation.reason ?? initialValidation.status}`
      if (validationMode === 'strict') {
        throw new TypeError(`[Cipó:${initialValidation.code ?? 'cipo-theme-property-initial-invalid'}] ${message}`)
      }
      warn(
        runtime,
        warnings,
        initialValidation.code ?? 'cipo-theme-property-initial-invalid',
        message,
        { path, type: token.type, initialValue: String(initialValue) },
      )
      return
    }
  }

  property(propertyName, {
    syntax: definition.cssSyntax,
    inherits: token.inherits ?? definition.inherits ?? true,
    initialValue,
  })
}

/**
 * Flattens a nested token object into dash-separated token names.
 * Typed groups propagate their semantic type to every scalar leaf.
 */
export function flattenTheme(
  tokens: CipoTheme,
  path: readonly string[] = [],
): FlattenedThemeEntry[] {
  const output: FlattenedThemeEntry[] = []
  appendFlattenedTheme(tokens, path.join('-'), output)
  return output
}

function appendFlattenedTheme(
  tokens: CipoTheme,
  prefix: string,
  output: FlattenedThemeEntry[],
  inheritedType?: CipoTypedThemeValue,
): void {
  for (const key in tokens) {
    const value = tokens[key]
    if (value === undefined) continue
    const name = prefix ? `${prefix}-${key}` : key
    appendFlattenedThemeValue(value, name, output, inheritedType)
  }
}

function appendFlattenedThemeValue(
  value: CipoThemeValue,
  name: string,
  output: FlattenedThemeEntry[],
  inheritedType?: CipoTypedThemeValue,
): void {
  if (isTypedThemeValue(value)) {
    if (isThemeBranch(value.value)) {
      appendFlattenedTheme(value.value, name, output, value)
    } else {
      output.push([name, value])
    }
    return
  }

  if (isThemeBranch(value)) {
    appendFlattenedTheme(value, name, output, inheritedType)
    return
  }

  if (isTypedValue(value)) {
    output.push([name, value])
    return
  }

  if (inheritedType) {
    output.push([
      name,
      typedTheme(inheritedType.type, value, {
        register: inheritedType.register,
        inherits: inheritedType.inherits,
        initialValue: inheritedType.initialValue,
        validation: inheritedType.validation,
      }),
    ])
    return
  }

  output.push([name, value])
}

function themeValueSignature(value: FlattenedThemeValue): string {
  if (isTypedValue(value)) {
    return `typed:${value.syntax}:${value.inherits ? 1 : 0}:${value.initialValue}`
  }
  if (isTypedThemeValue(value)) {
    return [
      'theme-typed',
      value.type,
      value.register,
      value.inherits,
      value.initialValue,
      value.validation,
      String(value.value),
    ].join(':')
  }
  return `${typeof value}:${String(value)}`
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
  return resolveThemeValueReferences(input)
}

function isThemeBranch(value: CipoThemeValue): value is CipoTheme {
  return isPlainObject(value) && !isTypedValue(value)
}
