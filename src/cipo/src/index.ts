/**
 * @tool Cipó
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
import { STYLE_ELEMENT_ID } from './constants'
import { createCipoCallable } from './adapters'
import { installBuiltInAliases } from './aliases'
import { configure, setup } from './config'
import { assertAtomicCssArtifact, atomic, css, isAtomicCssArtifact, isStylesheetArtifact, sheet } from './css'
import { explain, inspect } from './debug'
import { getCssText, injectStyle } from './injection'
import { inline } from './inline'
import { injectGlobal } from './global'
import { registerAlias, registerHelper, registerProperty, registerVariant, recipe } from './plugins'
import { runtime } from './runtime'
import { theme } from './theme'
import { installBuiltInHelpers } from './helpers'

export * from './types'
export { configure, setup } from './config'
export { theme } from './theme'
export { assertAtomicCssArtifact, atomic, css, isAtomicCssArtifact, isStylesheetArtifact, sheet } from './css'
export { inline } from './inline'
export { injectGlobal } from './global'
export { injectStyle, getCssText } from './injection'
export { registerAlias, registerHelper, registerProperty, registerVariant, recipe } from './plugins'
export { explain, inspect } from './debug'

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
  runtime.sheet = null
  runtime.insertedCss.clear()
  runtime.atomicCache.clear()
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
  runtime.debugAtoms.clear()
  runtime.warningSink = []
  runtime.generatedCssText = ''
  runtime.layerHeaderInserted = false
  if (typeof document !== 'undefined') document.getElementById(STYLE_ELEMENT_ID)?.remove()
}

export const cipo = createCipoCallable()

Object.assign(cipo, {
  css,
  atomic,
  sheet,
  assertAtomicCssArtifact,
  isAtomicCssArtifact,
  isStylesheetArtifact,
  html,
  inline,
  theme,
  configure,
  setup,
  injectGlobal,
  injectStyle,
  explain,
  inspect,
  getCssText,
  reset,
  registerAlias,
  registerHelper,
  registerProperty,
  registerVariant,
  recipe,
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
    atomic,
    sheet,
    assertAtomicCssArtifact,
    isAtomicCssArtifact,
    isStylesheetArtifact,
    html,
    inline,
    theme,
    configure,
    setup,
    injectGlobal,
    injectStyle,
    explain,
    inspect,
    getCssText,
    reset,
    registerAlias,
    registerHelper,
    registerProperty,
    registerVariant,
    recipe,
    createBrowserGlobal,
    installBrowserGlobal,
  }
}

/**
 * Installs `window.Cipo` and, by default, `window.RodK`.
 *
 * @param globalName - Primary global name.
 * @returns Global API.
 */
export function installBrowserGlobal(globalName = 'Cipo') {
  const api = createBrowserGlobal()
  const target = globalThis as typeof globalThis & Record<string, unknown>
  target[globalName] = api
  if (globalName === 'Cipo') target.RodK = api
  return api
}

installBuiltInHelpers()
installBuiltInAliases()

if (typeof window !== 'undefined') {
  installBrowserGlobal('Cipo')
}
