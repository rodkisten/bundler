import { configure } from './config'
import { insertCss } from './injection'
import { registerAlias } from './plugin-registry'
import { property } from './properties'
import { theme, themeScope } from './theme'
import type { CipoConfig, CipoPropertyDefinition, CipoTheme, CipoWarning } from './types'
import { clearObject, mergeConfigPatch, mergeTheme } from './config-css/shared'

/** Compact operation codes used by build-time compiled Cipó configuration payloads. */
export const enum CipoCompiledConfigOpcode {
  Config = 0,
  Theme = 1,
  Alias = 2,
  Property = 3,
  Css = 4,
  ThemeScope = 5,
}

export type CipoCompiledConfigOperation =
  | readonly [CipoCompiledConfigOpcode.Config, Partial<CipoConfig>]
  | readonly [CipoCompiledConfigOpcode.Theme, CipoTheme]
  | readonly [CipoCompiledConfigOpcode.Alias, string, string]
  | readonly [CipoCompiledConfigOpcode.Property, string, CipoPropertyDefinition]
  | readonly [CipoCompiledConfigOpcode.Css, string]
  | readonly [
      CipoCompiledConfigOpcode.ThemeScope,
      string,
      string,
      CipoTheme,
    ]

/** Serializable runtime representation emitted by the Cipó build plugin. */
export interface CipoCompiledCssConfig {
  readonly operations: readonly CipoCompiledConfigOperation[]
}

export interface CipoCompiledCssConfigResult {
  readonly kind?: never
  readonly config: Partial<CipoConfig>
  readonly theme: CipoTheme
  readonly warnings: readonly CipoWarning[]
  readonly appliedAliases: readonly string[]
  readonly appliedProperties: readonly string[]
  readonly appliedPresets: readonly string[]
  readonly appliedPlugins: readonly string[]
}

import type { Mutable } from './config-css/contracts'

/**
 * Applies a parser-free configuration payload produced from `configureFromCss()` source.
 *
 * @remarks
 * Development can keep the readable CSS-first DSL and runtime parser. Production
 * builds replace eligible `configureFromCss(configSheet)` calls with this compact
 * representation, so theme/config semantics stay at runtime without shipping the
 * original DSL or its parser graph.
 */
export function configureCompiledCssConfig(payload: CipoCompiledCssConfig): CipoCompiledCssConfigResult {
  const warnings: CipoWarning[] = []
  const appliedAliases: string[] = []
  const appliedProperties: string[] = []
  const resultConfig: Partial<Mutable<CipoConfig>> = {}
  let resultTheme: CipoTheme = {}
  const pendingConfig: Partial<Mutable<CipoConfig>> = {}
  let pendingTheme: CipoTheme = {}
  let hasPendingConfig = false
  let hasPendingTheme = false

  const flushConfig = () => {
    if (!hasPendingConfig) return
    configure(pendingConfig as CipoConfig)
    clearObject(pendingConfig)
    hasPendingConfig = false
  }

  const flushTheme = () => {
    if (!hasPendingTheme) return
    theme(pendingTheme, warnings)
    pendingTheme = {}
    hasPendingTheme = false
  }

  for (let index = 0; index < payload.operations.length; index += 1) {
    const operation = payload.operations[index]!

    switch (operation[0]) {
      case CipoCompiledConfigOpcode.Config:
        mergeConfigPatch(pendingConfig, operation[1])
        mergeConfigPatch(resultConfig, operation[1])
        hasPendingConfig = true
        break
      case CipoCompiledConfigOpcode.Theme:
        pendingTheme = mergeTheme(pendingTheme, operation[1])
        resultTheme = mergeTheme(resultTheme, operation[1])
        hasPendingTheme = true
        break
      case CipoCompiledConfigOpcode.Alias:
        flushConfig()
        registerAlias(operation[1], operation[2])
        appliedAliases.push(operation[1])
        break
      case CipoCompiledConfigOpcode.Property:
        flushConfig()
        appliedProperties.push(property(operation[1], operation[2]))
        break
      case CipoCompiledConfigOpcode.Css:
        flushConfig()
        insertCss(operation[1])
        break
      case CipoCompiledConfigOpcode.ThemeScope:
        flushConfig()
        flushTheme()
        themeScope(
          operation[1],
          operation[3],
          operation[2] ? { extends: operation[2] } : {},
          warnings,
        )
        break
    }
  }

  flushConfig()
  flushTheme()

  return {
    config: resultConfig,
    theme: resultTheme,
    warnings,
    appliedAliases,
    appliedProperties,
    appliedPresets: [],
    appliedPlugins: [],
  }
}
