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
  installBrowserGlobal,
} from './index'
import { hydrateDocumentStartStyles } from './document-start-hydration'

hydrateDocumentStartStyles()
installBrowserGlobal(globalThis)

export * from './index'
export {
  coreAtomic as atomic,
  coreCipo as cipo,
  coreCss as css,
  coreInline as inline,
  coreSheet as sheet,
  coreStyled as styled,
}
