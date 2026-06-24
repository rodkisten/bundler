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
import { safeAtomic } from './cipo/src/safe-atomic'
import { safeCss } from './cipo/src/safe-css'
import { safeInline } from './cipo/src/safe-inline'
import { safeSheet } from './cipo/src/safe-sheet'

installNativePropertyGuards()
hydrateDocumentStartStyles()
Object.assign(coreCipo, {
  css: safeCss,
  atomic: safeAtomic,
  inline: safeInline,
  sheet: safeSheet,
})

export * from './cipo/src/index'
export {
  coreCipo as cipo,
  coreStyled as styled,
  safeAtomic as atomic,
  safeCss as css,
  safeInline as inline,
  safeSheet as sheet,
}
