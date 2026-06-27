export {
  createDefaultFabricaApi,
  createFabrica,
  createFabrica as create,
  createFabricaApi,
  createComponentPack,
  getOrCreateFabrica,
  getOrCreateFabrica as getOrCreate,
} from "./public-api";
export type { FabricaApi } from "./public-api";
export type {
  Cleanup,
  Component,
  ComponentFactory,
  ComponentPack,
  ComponentRegistry,
  ComponentUseOptions,
  BoundaryOptions,
  ComponentContext,
  DebugSnapshot,
  Directive,
  DomBag,
  FabricaInstanceOptions,
  InstallOptions,
  RawHtml,
  RegistryCollision,
  RegistryImportMode,
  RenderValue,
  RepeatContext,
  VirtualRepeatOptions,
} from "./types";

export { $ } from "./bag";
export { css } from "./css";
export {
  clearComponents,
  component,
  defineComponent,
  listComponents,
  registerComponent,
  resolveComponent,
  unregisterComponent,
} from "./component";
export {
  createComponentRegistry as createRegistry,
  defaultComponentRegistry,
  FabricaComponentRegistry,
} from "./component-registry";
export { boundary } from "./boundary";
export { onDispose, onError, onMount, onUnmount } from "./lifecycle";
export { createFabricaContext, provide, useContext } from "./context";
export { debug, setDebug } from "./debug";
export {
  bind,
  childrenToArray,
  classMap,
  eventOptions,
  fragment,
  keyed,
  memoView,
  model,
  portal,
  ref,
  repeat,
  slot,
  styleMap,
  suspense,
  virtualRepeat,
  when,
} from "./directives";
export { html, hydrate, jsx, mount, render } from "./dom";
export { batch, computed, effect, signal } from "../broto/reactivity";
export { defineElement, elements } from "./elements";
export { rawHtml, sanitizedHtml, trustedHtml, unsafeHtml } from "./raw";

import { createDefaultFabricaApi } from "./public-api";

/** Default singleton API kept for browser-global and package compatibility. */
const Fabrica = createDefaultFabricaApi();

if (typeof globalThis !== "undefined") {
  Fabrica.install();
}

export default Fabrica;

declare global {
  // eslint-disable-next-line no-var
  var Fabrica: import("./public-api").FabricaApi | undefined;
  // eslint-disable-next-line no-var
  var $: unknown;
  // eslint-disable-next-line no-var
  var $el: unknown;
}
