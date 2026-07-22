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
export { FABRICA_HTML_ARTIFACT } from "./types.js";
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
  DebugRecord,
  DebugEventRecord,
  DebugEventMode,
  DebugListener,
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
} from "./types.js";

export { $ } from "./bag.js";
export { css } from "./css.js";
export {
  clearComponents,
  component,
  defineComponent,
  listComponents,
  registerComponent,
  resolveComponent,
  unregisterComponent,
} from "./component.js";
export {
  createComponentRegistry as createRegistry,
  defaultComponentRegistry,
  FabricaComponentRegistry,
} from "./component-registry.js";
export { boundary } from "./boundary.js";
export { onDispose, onError, onMount, onUnmount } from "./lifecycle.js";
export type { FabricaContext, ReactiveFabricaContext, ContextProviderProps } from "./context.js";
export { createContextProvider, createFabricaContext, createReactiveContextProvider, createReactiveFabricaContext, createRequiredFabricaContext, hasContext, provide, provideReactiveContext, requireContext, requireReactiveContext, useContext, useReactiveContext, useRequiredContext } from "./context.js";
export { clearDebugRecords, debug, debugRecords, setDebug, subscribeDebug } from "./debug.js";
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
} from "./directives.js";
export {
  getHtmlArtifact,
  html,
  isHtmlResult,
  jsx,
  mount,
  mountPreservingChildren,
  render,
} from "./render/dom.js";
export { createEventHelper, event } from "./event-typing.js";
export type { FabricaEvent, FabricaEventFor, FabricaEventHandler, FabricaEventHelper, FabricaEventName } from "./event-typing.js";
export { batch, computed, effect, flushSync, signal } from "@rodkisten/broto/reactivity";
export { defineElement, elements } from "./elements.js";
export { rawHtml, sanitizedHtml, trustedHtml, unsafeHtml } from "./raw.js";
import { createDefaultFabricaApi } from "./public-api.js";

/**
 * Default singleton runtime API. Importing the package is side-effect free;
 * browser-global installation lives exclusively in the `./browser` entrypoint.
 */
const Fabrica = createDefaultFabricaApi();

export default Fabrica;

declare global {
  // eslint-disable-next-line no-var
  var Fabrica: import("./public-api.js").FabricaApi | undefined;
  // eslint-disable-next-line no-var
  var $: unknown;
  // eslint-disable-next-line no-var
  var $el: unknown;
}
