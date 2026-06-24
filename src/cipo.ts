/**
 * @tool Cipo
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
import {
  atomic as coreAtomic,
  cipo as coreCipo,
  css as coreCss,
  inline as coreInline,
  sheet as coreSheet,
  styled as coreStyled,
} from './cipo/src/index'
import { hydrateDocumentStartStyles } from './cipo/src/document-start-hydration'

hydrateDocumentStartStyles()

export * from './cipo/src/index'
export {
  coreAtomic as atomic,
  coreCipo as cipo,
  coreCss as css,
  coreInline as inline,
  coreSheet as sheet,
  coreStyled as styled,
}
