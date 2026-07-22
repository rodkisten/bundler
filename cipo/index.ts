/**
 * @tool Cipó
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
import { STYLE_ELEMENT_ID } from './constants'
import { createCipoCallable, type CipoStyledFactoryOptions } from './adapters'
import { installBuiltInAliases } from './aliases'
import { configure, setup } from './config'
import { assertAtomicCssArtifact, atomic, css, isAtomicCssArtifact, isStylesheetArtifact, sheet } from './css'
import { benchmark, explain, explainCss, explainDetailed, inspect, validateCss } from './debug'
import { getDebugOverlayStats, installDebugOverlay } from './debug-overlay'
import { getCssText, injectStyle, resetInjectionState, setRuntimeStyleTarget } from './injection'
import { inline } from './inline'
import { injectGlobal } from './global'
import { registerAlias, registerHelper, registerNativeFunction, registerProperty, registerVariant, recipe } from './plugins'
import { properties, property, typed, typedProperty } from './properties'
import { runtime } from './runtime'
import { resetThemeScopes, theme, themeScope } from './theme'
import { defineThemeType, getThemeType, listThemeTypes, typedTheme, validateThemeValue } from './theme-types'
import { installBuiltInHelpers } from './helpers'
import { configSheet, configureCss, configureFromCss, invalidateCssConfigApplications, registerConfigPlugin, registerPreset, setupFromCss } from './config-css'
import { installNativePropertyGuards } from './native-property-guards'
import { resetWarningDedupe } from './utils'

Object.assign(css, { configure: configureCss })
Object.assign(configure, { css: configureCss })
Object.assign(setup, { css: configureCss })

export * from './types'
export { STYLE_ELEMENT_ID } from './constants'
export type { CipoCallableRuntime, CipoStyledFactoryOptions, CipoStyledRegistry } from './adapters'
export { configure, setup } from './config'
export { configSheet, configureCss, configureFromCss, registerConfigPlugin, registerPreset, setupFromCss } from './config-css'
export { configureCompiledCssConfig } from './compiled-config'
export type { CipoCompiledConfigOperation, CipoCompiledCssConfig, CipoCompiledCssConfigResult } from './compiled-config'
export type { CipoConfigPlugin, CipoConfigPreset, CipoCssConfigureApi, CipoCssConfigResult } from './config-css'
export { getThemeScope, theme, themeScope } from './theme'
export { defineThemeType, getThemeType, listThemeTypes, typedTheme, validateThemeValue } from './theme-types'
export { assertAtomicCssArtifact, atomic, css, isAtomicCssArtifact, isStylesheetArtifact, sheet } from './css'
export { inline } from './inline'
export { injectGlobal } from './global'
export { injectStyle, getCssText, setRuntimeStyleTarget } from './injection'
export { registerAlias, registerHelper, registerNativeFunction, registerProperty, registerVariant, recipe } from './plugins'
export { compilePropertyRule, customPropertyReference, normalizeCustomPropertyName, properties, property, typed, typedProperty } from './properties'
export { benchmark, explain, explainCss, explainDetailed, inspect, validateCss } from './debug'
export { getDebugOverlayStats, installDebugOverlay } from './debug-overlay'

/**
 * Compatibility HTML tag.
 *
 * @remarks
 * Fábrica owns real rendering. This helper remains for compatibility with the
 * old Cipó file and for simple string interpolation in demos.
 *
 * @param strings - Template strings.
 * @param values - Values.
 * @returns HTML string.
 *
 * @example
 * ```ts
 * html`<div class="${css`color:red;`}">Hello</div>`
 * ```
 */
export function html(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  let output = ''
  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index]
    if (index < values.length) output += Array.isArray(values[index]) ? (values[index] as readonly unknown[]).join('') : String(values[index] ?? '')
  }
  return output
}

/**
 * Resets all generated styles and caches.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * reset()
 * getCssText()
 * // ''
 * ```
 */
export function reset(): void {
  setRuntimeStyleTarget(undefined)
  resetInjectionState()
  runtime.sheet = null
  runtime.insertedCss.clear()
  runtime.atomicCache.clear()
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
  runtime.debugAtoms.clear()
  runtime.warningSink = []
  resetWarningDedupe()
  resetThemeScopes()
  runtime.generatedCssText = ''
  runtime.registeredProperties.clear()
  runtime.atomicUsageCounts.clear()
  runtime.atomicSingleUseFallbacks.clear()
  runtime.propertyDefinitions.clear()
  runtime.layerHeaderInserted = false
  invalidateCssConfigApplications()
  if (typeof document !== 'undefined') document.getElementById(STYLE_ELEMENT_ID)?.remove()
}

export const cipo = createCipoCallable()

/** Creates an independent styled factory bound to a Fabrica instance/registry. */
export function createStyled(options: CipoStyledFactoryOptions = {}) {
  return createCipoCallable(options)
}

/** Styled-components-like alias for the default callable Cipó component factory. */
export const styled = cipo

/** Named visual component facade backed by Fabrica Elements. */
export const component = cipo.component

/** Explicit registry bridge aliases for module and userscript integrations. */
export const connectFabrica = cipo.connectRegistry
export const disconnectFabrica = cipo.disconnectRegistry
export const configureFabricaRegistry = cipo.configureRegistry
export const flushFabricaRegistry = cipo.flushRegistry
export const pendingFabricaComponents = cipo.pendingComponents

assignPublicApi(cipo, {
  css,
  styled,
  createStyled,
  atomic,
  sheet,
  assertAtomicCssArtifact,
  isAtomicCssArtifact,
  isStylesheetArtifact,
  // Keep cipo.html as the styled <html> tag factory. The compatibility
  // template helper remains a named export and is exposed by
  // createBrowserGlobal().
  inline,
  theme,
  themeScope,
  configure,
  setup,
  injectGlobal,
  injectStyle,
  explain,
  explainCss,
  explainDetailed,
  benchmark,
  inspect,
  validateCss,
  getCssText,
  getDebugOverlayStats,
  installDebugOverlay,
  reset,
  registerAlias,
  registerHelper,
  registerNativeFunction,
  registerProperty,
  registerVariant,
  property,
  properties,
  typed,
  typedProperty,
  typedTheme,
  defineThemeType,
  getThemeType,
  listThemeTypes,
  validateThemeValue,
  recipe,
  configureCss,
  configureFromCss,
  setupFromCss,
  configSheet,
  registerPreset,
  registerConfigPlugin,
  createBrowserGlobal,
  installBrowserGlobal,
})

/**
 * Creates the browser global API object.
 *
 * @returns Global Cipó API.
 */
export function createBrowserGlobal() {
  return {
    cipo,
    css,
    styled,
    createStyled,
    component: cipo.component,
    connectFabrica: cipo.connectRegistry,
    disconnectFabrica: cipo.disconnectRegistry,
    configureFabricaRegistry: cipo.configureRegistry,
    flushFabricaRegistry: cipo.flushRegistry,
    pendingFabricaComponents: cipo.pendingComponents,
    atomic,
    sheet,
    assertAtomicCssArtifact,
    isAtomicCssArtifact,
    isStylesheetArtifact,
    html,
    inline,
    theme,
    themeScope,
    configure,
    setup,
    injectGlobal,
    injectStyle,
    explain,
    explainCss,
    explainDetailed,
    benchmark,
    inspect,
    validateCss,
    getCssText,
    getDebugOverlayStats,
    installDebugOverlay,
    reset,
    registerAlias,
    registerHelper,
    registerNativeFunction,
    registerProperty,
    registerVariant,
    property,
    properties,
    typed,
    typedProperty,
    typedTheme,
    defineThemeType,
    getThemeType,
    listThemeTypes,
    validateThemeValue,
    recipe,
    configureCss,
    configureFromCss,
    setupFromCss,
    configSheet,
    registerPreset,
    registerConfigPlugin,
    createBrowserGlobal,
    installBrowserGlobal,
  }
}

/**
 * Installs `window.Cipo` and, by default, `window.RodK`.
 */
export function installBrowserGlobal(target = globalThis, aliases: readonly string[] = ['RodK']): ReturnType<typeof createBrowserGlobal> {
  const api = createBrowserGlobal()
  ;(target as Record<string, unknown>).Cipo = api
  for (const alias of aliases) (target as Record<string, unknown>)[alias] = api
  return api
}

function assignPublicApi<T extends object>(target: T, source: Record<string, unknown>): void {
  const output = target as unknown as Record<string, unknown>
  for (const key in source) output[key] = source[key]
}

installBuiltInHelpers()
installBuiltInAliases()
installNativePropertyGuards()

