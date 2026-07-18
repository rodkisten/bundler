import type { CipoTheme, CipoTypedThemeOptions, CipoTypedThemeValue } from './types'
import { toKebabMixed } from './utils'

/** Creates an immutable typed-theme value without consulting or mutating runtime registries. */
export function typedTheme(
  type: string,
  value: string | number | CipoTheme,
  options: CipoTypedThemeOptions = {},
): CipoTypedThemeValue {
  return {
    kind: 'cipo.theme.typed',
    type: normalizeThemeTypeName(type),
    value,
    register: options.register ?? 'auto',
    inherits: options.inherits,
    initialValue: options.initialValue,
    validation: options.validation,
  }
}

/** Canonicalizes semantic type names at the data boundary. */
export function normalizeThemeTypeName(name: string): string {
  const source = String(name || '').trim().replace(/^<|>$/g, '')
  return toKebabMixed(source)
}
