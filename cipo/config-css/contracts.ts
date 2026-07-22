import type { CipoConfig, CipoPropertyDefinition, CipoTheme, CipoWarning } from '../types'

export type Mutable<T> = { -readonly [K in keyof T]: T[K] }

export type PreparedOperation =
  | { readonly kind: 'config'; readonly patch: Partial<Mutable<CipoConfig>> }
  | { readonly kind: 'theme'; readonly patch: CipoTheme }
  | {
      readonly kind: 'theme-scope'
      readonly name: string
      readonly extends?: string
      readonly patch: CipoTheme
    }
  | { readonly kind: 'alias'; readonly name: string; readonly cssText: string }
  | { readonly kind: 'property'; readonly name: string; readonly definition: CipoPropertyDefinition }
  | { readonly kind: 'layer'; readonly cssText: string }
  | { readonly kind: 'preset'; readonly name: string }
  | { readonly kind: 'plugin'; readonly name: string }

export interface PreparedCssConfig {
  readonly source: string
  readonly operations: readonly PreparedOperation[]
  readonly config: Partial<Mutable<CipoConfig>>
  readonly theme: CipoTheme
  readonly warnings: readonly CipoWarning[]
  readonly appliedAliases: readonly string[]
  readonly appliedProperties: readonly string[]
  readonly appliedPresets: readonly string[]
  readonly appliedPlugins: readonly string[]
}
