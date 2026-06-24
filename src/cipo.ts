/**
 * @tool Cipo
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
import { cipo as coreCipo, styled as coreStyled } from './cipo/src/index'
import { hydrateDocumentStartStyles } from './cipo/src/document-start-hydration'
import { installNativePropertyGuards } from './cipo/src/native-property-guards'
import { safeAtomicApi } from './cipo/src/safe-atomic-api'
import { safeCss } from './cipo/src/safe-css'
import { safeSheet } from './cipo/src/safe-sheet'

installNativePropertyGuards()
hydrateDocumentStartStyles()
Object.assign(coreCipo, { css: safeCss, sheet: safeSheet, atomic: safeAtomicApi })

const target = globalThis as typeof globalThis & Record<string, any>
if (target.Cipo) Object.assign(target.Cipo, { css: safeCss, sheet: safeSheet, atomic: safeAtomicApi })
if (target.RodK) Object.assign(target.RodK, { css: safeCss, sheet: safeSheet, atomic: safeAtomicApi })

export * from './cipo/src/index'
export {
  coreCipo as cipo,
  coreStyled as styled,
  safeAtomicApi as atomic,
  safeCss as css,
  safeSheet as sheet,
}
