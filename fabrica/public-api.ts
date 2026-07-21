/**
 * Public instance-factory facade.
 *
 * Implementation lives under `api/` so package entrypoints do not become a
 * dependency hub for renderer, compiler, and installation internals.
 */
export {
  createDefaultFabricaApi,
  createFabrica,
  createFabricaApi,
  getOrCreateFabrica,
} from "./api/factory.js";
export { createComponentPack } from "./api/packs.js";
export type { FabricaApi } from "./api/types.js";

export {
  clearDefaultComponents,
  defaultComponent,
  listDefaultComponents,
  registerDefaultComponent,
  resolveDefaultComponent,
  unregisterDefaultComponent,
} from "./api/factory.js";

export type {
  DomBag,
  InstallOptions,
  RawHtml,
  RenderValue,
} from "./api/factory.js";
