/**
 * @tool Cipo
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
import { hydrateDocumentStartStyles } from './cipo/src/document-start-hydration'

hydrateDocumentStartStyles()

export * from "./cipo/src/index";
