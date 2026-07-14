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
export { FABRICA_HTML_ARTIFACT } from "./types";
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
  RefDirective,
  RefCallback,
  RefObject,
  RefValue,
  RegistryCollision,
  RegistryImportMode,
  RenderValue,
  HtmlArtifact,
  HtmlResult,
  HtmlTag,
  HtmlTemplateTag,
  RepeatContext,
  ReactiveContextToken,
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
export { createContextProvider, createFabricaContext, createReactiveContextProvider, createReactiveFabricaContext, createRequiredFabricaContext, hasContext, provide, provideReactiveContext, requireContext, requireReactiveContext, useContext, useReactiveContext } from "./context";
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
export { getHtmlArtifact, html, hydrate, isHtmlResult, jsx, mount, render } from "./dom";
export { createEventHelper, event } from "./event-typing";
export type { FabricaEvent, FabricaEventFor, FabricaEventHandler, FabricaEventHelper, FabricaEventName } from "./event-typing";
export { batch, computed, effect, signal } from "../broto/reactivity";
export { defineElement, elements } from "./elements";
export { rawHtml, sanitizedHtml, trustedHtml, unsafeHtml } from "./raw";
export { applyCompiledProps, compileFabricaSource, createCompiledElement, createCompiledFragment, createCompiledTemplate } from "./compiler";

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
