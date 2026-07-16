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
} from "@rodkisten/fabrica/public-api";
export type { FabricaApi } from "@rodkisten/fabrica/public-api";
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
} from "@rodkisten/fabrica/context";
export type { FabricaContext, ReactiveFabricaContext, ContextProviderProps } from "@rodkisten/fabrica/context";
export {
  clearDebugRecords,
  debug,
  debugRecords,
  setDebug,
  subscribeDebug,
} from "@rodkisten/fabrica/debug";
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
} from "@rodkisten/fabrica/types";
