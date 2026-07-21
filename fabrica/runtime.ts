/**
 * Runtime-only Fábrica entry point for browser bundles.
 *
 * Build/compiler APIs intentionally live in `./compiler` so applications that
 * only render UI do not pull source scanners or compiler helpers into the graph.
 */
export {
  createDefaultFabricaApi,
  createFabrica,
  createFabrica as create,
  createFabricaApi,
  createComponentPack,
  getOrCreateFabrica,
  getOrCreateFabrica as getOrCreate,
} from "./public-api.js";
export type { FabricaApi } from "./public-api.js";
export {
  createContextProvider,
  createFabricaContext,
  createReactiveContextProvider,
  createReactiveFabricaContext,
  createRequiredFabricaContext,
  hasContext,
  provide,
  provideReactiveContext,
  requireContext,
  requireReactiveContext,
  useContext,
  useReactiveContext,
  useRequiredContext,
} from "./context.js";
export type { FabricaContext, ReactiveFabricaContext, ContextProviderProps } from "./context.js";
export {
  clearDebugRecords,
  debug,
  debugRecords,
  setDebug,
  subscribeDebug,
} from "./debug.js";
export type {
  Cleanup,
  Component,
  DebugEventMode,
  DebugEventRecord,
  DebugListener,
  DebugRecord,
  DebugSnapshot,
  RefDirective,
  RenderValue,
  RefCallback,
  RefObject,
  RefValue,
} from "./types.js";
