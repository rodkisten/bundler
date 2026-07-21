import { configure } from './config'
import type { Mutable, PreparedCssConfig } from './config-css/contracts'
import { clearPreparedCssConfigCache, getPreparedCssConfig } from './config-css/parse'
import { buildConfigTemplate, clearObject, mergeConfigPatch, mergeTheme, normalizeConfigName } from './config-css/shared'
import { insertCss } from './injection'
import { registerAlias } from './plugin-registry'
import { property } from './properties'
import { runtime } from './runtime'
import { theme } from './theme'
import type { CipoConfig, CipoCssConfigResult, CipoPropertyDefinition, CipoTheme, CipoWarning, RuntimeState } from './types'
import { warn } from './utils'

export type CipoConfigPreset = string | (() => string | void) | CipoConfig
export type CipoConfigPlugin = (api: CipoCssConfigureApi) => string | void

export interface CipoCssConfigureApi {
  configure(config: CipoConfig): void
  theme(tokens: CipoTheme): void
  alias(name: string, cssText: string): void
  property(name: string, definition: CipoPropertyDefinition): string
  css(cssText: string): void
}

interface AppliedCssConfig {
  readonly epoch: number
  readonly presetRegistryVersion: number
  readonly pluginRegistryVersion: number
  readonly configVersion: number
  readonly themeVersion: number
  readonly registryVersion: number
  readonly result: CipoCssConfigResult
}

export { compileCssConfigPayload } from './config-css/parse'
export type { CipoCssConfigResult } from './types'

const presetRegistry = new Map<string, CipoConfigPreset>()
const configPluginRegistry = new Map<string, CipoConfigPlugin>()
let appliedConfigCaches = new WeakMap<RuntimeState, Map<string, AppliedCssConfig>>()
let applicationEpoch = 0
let presetRegistryVersion = 0
let pluginRegistryVersion = 0

/** Registers a named CSS-first preset. */
export function registerPreset(name: string, preset: CipoConfigPreset): void {
  const key = normalizeConfigName(name)
  if (!key) return
  if (Object.is(presetRegistry.get(key), preset)) return
  presetRegistry.set(key, preset)
  presetRegistryVersion += 1
  appliedConfigCaches = new WeakMap()
}

/** Registers a named CSS-first plugin callable from `@plugin name;`. */
export function registerConfigPlugin(name: string, plugin: CipoConfigPlugin): void {
  const key = normalizeConfigName(name)
  if (!key) return
  if (Object.is(configPluginRegistry.get(key), plugin)) return
  configPluginRegistry.set(key, plugin)
  pluginRegistryVersion += 1
  appliedConfigCaches = new WeakMap()
}

/** Invalidates runtime application caches and optionally the pure parse-plan cache. */
export function invalidateCssConfigApplications(options: { readonly clearPlans?: boolean } = {}): void {
  applicationEpoch += 1
  appliedConfigCaches = new WeakMap()
  if (options.clearPlans) clearPreparedCssConfigCache()
}

function getAppliedConfigCache(state: RuntimeState): Map<string, AppliedCssConfig> {
  let cache = appliedConfigCaches.get(state)
  if (!cache) {
    cache = new Map()
    appliedConfigCaches.set(state, cache)
  }
  return cache
}

/** Applies a CSS-first configuration plan to the currently active runtime state. */
export function configureFromCss(input: string): CipoCssConfigResult {
  const source = String(input || '')
  const appliedConfigCache = getAppliedConfigCache(runtime)
  const applied = appliedConfigCache.get(source)

  if (
    applied &&
    applied.epoch === applicationEpoch &&
    applied.presetRegistryVersion === presetRegistryVersion &&
    applied.pluginRegistryVersion === pluginRegistryVersion &&
    applied.configVersion === runtime.configVersion &&
    applied.themeVersion === runtime.themeVersion &&
    applied.registryVersion === runtime.registryVersion
  ) {
    return applied.result
  }

  const prepared = getPreparedCssConfig(source)
  const result = applyPreparedCssConfig(prepared)
  appliedConfigCache.set(source, {
    epoch: applicationEpoch,
    presetRegistryVersion,
    pluginRegistryVersion,
    configVersion: runtime.configVersion,
    themeVersion: runtime.themeVersion,
    registryVersion: runtime.registryVersion,
    result,
  });

  return result
}

/** Tagged-template API: `Cipo.configure.css` / `configure.css`. */
export function configureCss(strings: TemplateStringsArray, ...values: readonly unknown[]): CipoCssConfigResult {
  return configureFromCss(buildConfigTemplate(strings, values))
}

export const setupFromCss = configureFromCss
export const configSheet = configureFromCss

function applyPreparedCssConfig(prepared: PreparedCssConfig): CipoCssConfigResult {
  const warnings: CipoWarning[] = []
  const appliedProperties: string[] = []
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

  for (const warning of prepared.warnings) {
    warn(runtime, warnings, warning.code, warning.message, warning.context)
  }

  for (const operation of prepared.operations) {
    if (operation.kind === 'config') {
      mergeConfigPatch(pendingConfig, operation.patch)
      hasPendingConfig = true
      continue
    }
    if (operation.kind === 'theme') {
      pendingTheme = mergeTheme(pendingTheme, operation.patch)
      hasPendingTheme = true
      continue
    }

    flushConfig()
    if (operation.kind === 'alias') registerAlias(operation.name, operation.cssText)
    else if (operation.kind === 'property') appliedProperties.push(property(operation.name, operation.definition))
    else if (operation.kind === 'layer') insertCss(operation.cssText)
    else if (operation.kind === 'preset') { flushTheme(); applyPreset(operation.name, warnings) }
    else if (operation.kind === 'plugin') { flushTheme(); applyPlugin(operation.name, warnings) }
  }

  flushConfig()
  flushTheme()
  return {
    config: prepared.config,
    theme: prepared.theme,
    warnings,
    appliedAliases: prepared.appliedAliases,
    appliedProperties,
    appliedPresets: prepared.appliedPresets,
    appliedPlugins: prepared.appliedPlugins,
  }
}

function applyPreset(name: string, warnings: CipoWarning[]): void {
  const key = normalizeConfigName(name)
  if (!key) return
  const preset = presetRegistry.get(key)
  if (!preset) {
    warn(runtime, warnings, 'cipo-config-preset-not-found', `Unknown Cipó preset: ${key}`)
    return
  }
  if (typeof preset === 'string') configureFromCss(preset)
  else if (typeof preset === 'function') {
    const result = preset()
    if (typeof result === 'string') configureFromCss(result)
  } else configure(preset)
}

function applyPlugin(name: string, warnings: CipoWarning[]): void {
  const key = normalizeConfigName(name)
  if (!key) return
  const plugin = configPluginRegistry.get(key)
  if (!plugin) {
    warn(runtime, warnings, 'cipo-config-plugin-not-found', `Unknown Cipó config plugin: ${key}`)
    return
  }
  const result = plugin(createConfigureApi())
  if (typeof result === 'string') configureFromCss(result)
}

function createConfigureApi(): CipoCssConfigureApi {
  return { configure, theme, alias: registerAlias, property, css: insertCss }
}
