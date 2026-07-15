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
export { FABRICA_HTML_ARTIFACT } from "@rodkisten/fabrica/types";
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
} from "@rodkisten/fabrica/types";

export { $ } from "@rodkisten/fabrica/bag";
export { css } from "@rodkisten/fabrica/css";
export {
  clearComponents,
  component,
  defineComponent,
  listComponents,
  registerComponent,
  resolveComponent,
  unregisterComponent,
} from "@rodkisten/fabrica/component";
export {
  createComponentRegistry as createRegistry,
  defaultComponentRegistry,
  FabricaComponentRegistry,
} from "@rodkisten/fabrica/component-registry";
export { boundary } from "@rodkisten/fabrica/boundary";
export { onDispose, onError, onMount, onUnmount } from "@rodkisten/fabrica/lifecycle";
export type { FabricaContext, ReactiveFabricaContext, ContextProviderProps } from "@rodkisten/fabrica/context";
export { createContextProvider, createFabricaContext, createReactiveContextProvider, createReactiveFabricaContext, createRequiredFabricaContext, hasContext, provide, provideReactiveContext, requireContext, requireReactiveContext, useContext, useReactiveContext, useRequiredContext } from "@rodkisten/fabrica/context";
export { debug, setDebug } from "@rodkisten/fabrica/debug";
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
} from "@rodkisten/fabrica/directives";
export { getHtmlArtifact, html, hydrate, isHtmlResult, jsx, mount, render } from "@rodkisten/fabrica/dom";
export { createEventHelper, event } from "@rodkisten/fabrica/event-typing";
export type { FabricaEvent, FabricaEventFor, FabricaEventHandler, FabricaEventHelper, FabricaEventName } from "@rodkisten/fabrica/event-typing";
export { batch, computed, effect, flushSync, signal } from "@rodkisten/broto/reactivity";
export { defineElement, elements } from "@rodkisten/fabrica/elements";
export { rawHtml, sanitizedHtml, trustedHtml, unsafeHtml } from "@rodkisten/fabrica/raw";
export { applyCompiledProps, compileFabricaSource, createCompiledElement, createCompiledFragment, createCompiledTemplate } from "@rodkisten/fabrica/compiler";

import { createDefaultFabricaApi } from "@rodkisten/fabrica/public-api";

/** Default singleton API kept for browser-global and package compatibility. */
const Fabrica = createDefaultFabricaApi();

if (typeof globalThis !== "undefined") {
  Fabrica.install();
}

export default Fabrica;

declare global {
  // eslint-disable-next-line no-var
  var Fabrica: import("@rodkisten/fabrica/public-api").FabricaApi | undefined;
  // eslint-disable-next-line no-var
  var $: unknown;
  // eslint-disable-next-line no-var
  var $el: unknown;
}
