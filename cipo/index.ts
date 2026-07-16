/**
 * @tool Cipó
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
import { STYLE_ELEMENT_ID } from '@rodkisten/cipo/constants'
import { createCipoCallable, type CipoCallableRuntime, type CipoStyledFactoryOptions } from '@rodkisten/cipo/adapters'
import { installBuiltInAliases } from '@rodkisten/cipo/aliases'
import { configure, setup } from '@rodkisten/cipo/config'
import { assertAtomicCssArtifact, atomic, css, isAtomicCssArtifact, isStylesheetArtifact, sheet } from '@rodkisten/cipo/css'
import { benchmark, explain, explainCss, explainDetailed, inspect, validateCss } from '@rodkisten/cipo/debug'
import { getDebugOverlayStats, installDebugOverlay } from '@rodkisten/cipo/debug-overlay'
import { getCssText, injectStyle, resetInjectionState, setRuntimeStyleTarget } from '@rodkisten/cipo/injection'
import { inline } from '@rodkisten/cipo/inline'
import { compiledInlineCss, compileCipoSourceInline, createCompiledStyled } from '@rodkisten/cipo/compiler-compiled-inline'
import { compileCipoSourceBuild } from '@rodkisten/cipo/compiler-compiled-build'
import { cipoVite } from '@rodkisten/cipo/vite-compiled-inline'
import { injectGlobal } from '@rodkisten/cipo/global'
import { registerAlias, registerHelper, registerNativeFunction, registerProperty, registerVariant, recipe } from '@rodkisten/cipo/plugins'
import { properties, property, typed, typedProperty } from '@rodkisten/cipo/properties'
import { runtime } from '@rodkisten/cipo/runtime'
import { theme } from '@rodkisten/cipo/theme'
import { defineThemeType, getThemeType, listThemeTypes, typedTheme, validateThemeValue } from '@rodkisten/cipo/theme-types'
import { installBuiltInHelpers } from '@rodkisten/cipo/helpers'
import { compileCssConfigPayload, configSheet, configureCss, configureFromCss, invalidateCssConfigApplications, registerConfigPlugin, registerPreset, setupFromCss } from '@rodkisten/cipo/config-css'
import { installNativePropertyGuards } from '@rodkisten/cipo/native-property-guards'
import { resetWarningDedupe } from '@rodkisten/cipo/utils'

Object.assign(css, { configure: configureCss })

export * from '@rodkisten/cipo/types'
export type { CipoCallableRuntime, CipoStyledFactoryOptions, CipoStyledRegistry } from '@rodkisten/cipo/adapters'
export { configure, setup } from '@rodkisten/cipo/config'
export { compileCssConfigPayload, configSheet, configureCss, configureFromCss, registerConfigPlugin, registerPreset, setupFromCss } from '@rodkisten/cipo/config-css'
export { configureCompiledCssConfig } from '@rodkisten/cipo/compiled-config'
export type { CipoCompiledConfigOperation, CipoCompiledCssConfig, CipoCompiledCssConfigResult } from '@rodkisten/cipo/compiled-config'
export type { CipoConfigPlugin, CipoConfigPreset, CipoCssConfigureApi, CipoCssConfigResult } from '@rodkisten/cipo/config-css'
export { theme } from '@rodkisten/cipo/theme'
export { defineThemeType, getThemeType, listThemeTypes, typedTheme, validateThemeValue } from '@rodkisten/cipo/theme-types'
export { assertAtomicCssArtifact, atomic, css, isAtomicCssArtifact, isStylesheetArtifact, sheet } from '@rodkisten/cipo/css'
export { inline } from '@rodkisten/cipo/inline'
export { compiledInlineCss, compileCipoSourceInline, createCompiledStyled, inlineCssTextToObject, resolveCompiledStyleInput } from '@rodkisten/cipo/compiler-compiled-inline'
export { compileCipoSourceBuild } from '@rodkisten/cipo/compiler-compiled-build'
export type { CipoCompiledInlineArtifact, CipoCompiledInlineManifestEntry, CipoCompiledInlineOptions, CipoCompiledInlineSourceResult } from '@rodkisten/cipo/compiler-compiled-inline'
export type { CipoCompiledBuildManifestEntry, CipoCompiledBuildOptions, CipoCompiledBuildResult } from '@rodkisten/cipo/compiler-compiled-build'
export { cipoVite } from '@rodkisten/cipo/vite-compiled-inline'
export type { CipoViteCompiledInlineOptions, CipoViteTransformResult } from '@rodkisten/cipo/vite-compiled-inline'
export { injectGlobal } from '@rodkisten/cipo/global'
export { injectStyle, getCssText, setRuntimeStyleTarget } from '@rodkisten/cipo/injection'
export { registerAlias, registerHelper, registerNativeFunction, registerProperty, registerVariant, recipe } from '@rodkisten/cipo/plugins'
export { compilePropertyRule, customPropertyReference, normalizeCustomPropertyName, properties, property, typed, typedProperty } from '@rodkisten/cipo/properties'
export { benchmark, explain, explainCss, explainDetailed, inspect, validateCss } from '@rodkisten/cipo/debug'
export { getDebugOverlayStats, installDebugOverlay } from '@rodkisten/cipo/debug-overlay'

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
  html,
  inline,
  compiledInlineCss,
  compileCipoSourceInline,
  compileCipoSourceBuild,
  createCompiledStyled,
  cipoVite,
  theme,
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
    compiledInlineCss,
    compileCipoSourceInline,
    createCompiledStyled,
    cipoVite,
    theme,
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
  const output = target as T & Record<string, unknown>
  for (const key in source) output[key] = source[key]
}

installBuiltInHelpers()
installBuiltInAliases()
installNativePropertyGuards()

if (typeof window !== 'undefined') installBrowserGlobal(window)
