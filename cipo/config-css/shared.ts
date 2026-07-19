import type { CipoConfig, CipoTheme } from '../types'
import type { Mutable } from './contracts'

/** Merges a config patch while preserving breakpoint subkeys. */
export function mergeConfigPatch(
  target: Partial<Mutable<CipoConfig>>,
  patch: Partial<Mutable<CipoConfig>>,
): void {
  for (const key in patch) {
    const typedKey = key as keyof CipoConfig
    if (typedKey === 'breakpoints') {
      target.breakpoints = { ...(target.breakpoints ?? {}), ...(patch.breakpoints ?? {}) }
      continue
    }
    if (typedKey === 'scope' && typeof patch.scope === 'object' && patch.scope) {
      target.scope = {
        ...(typeof target.scope === 'object' && target.scope ? target.scope : {}),
        ...patch.scope,
      }
      continue
    }
    ;(target as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key]
  }
}

/** Recursively merges theme objects without treating typed theme values as maps. */
export function mergeTheme(left: CipoTheme, right: CipoTheme): CipoTheme {
  const output: Record<string, import('../types').CipoThemeValue> = { ...left }
  for (const key in right) {
    const value = right[key]
    if (value === undefined) continue
    const previous = output[key]
    if (isThemeObject(previous) && isThemeObject(value)) output[key] = mergeTheme(previous, value)
    else output[key] = value
  }
  return output
}

export function normalizeConfigName(name: string): string {
  return String(name || '').trim().replace(/^['"]|['"]$/g, '')
}

export function buildConfigTemplate(strings: TemplateStringsArray, values: readonly unknown[]): string {
  let output = ''
  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index] ?? ''
    if (index < strings.length - 1 && index < values.length) output += String(values[index] ?? '')
  }
  return output
}

function isThemeObject(value: unknown): value is CipoTheme {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !(value as { kind?: unknown }).kind)
}

/** Clears all enumerable own keys from a mutable config accumulator. */
export function clearObject(target: object): void {
  const record = target as Record<string, unknown>
  for (const key in record) delete record[key]
}
