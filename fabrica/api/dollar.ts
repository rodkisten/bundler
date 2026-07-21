import { $, createDomBag } from "../bag.js";
import { batch, computed, effect, signal } from
  "@rodkisten/broto/reactivity";
import { defineComponent } from "../component.js";
import { boundary } from "../boundary.js";
import {
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
} from "../context.js";
import {
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
} from "../directives.js";
import { onDispose, onError, onMount, onUnmount } from
  "../lifecycle.js";
import { rawHtml, sanitizedHtml, trustedHtml, unsafeHtml } from
  "../raw.js";
import type { FabricaApi } from "./types.js";

/**
 * Binds one Fábrica instance to the legacy fluent `$` compatibility surface.
 *
 * The bridge is isolated from instance construction so the modern runtime can
 * evolve without making the compatibility object a dependency of core render
 * or compiler modules.
 */
export function attachDollarApi(api: FabricaApi): void {
  Object.assign($, {
    html: api.html,
    css: api.css,
    raw: rawHtml,
    sanitizedHtml,
    trustedHtml,
    unsafeHtml,
    component: api.component,
    defineComponent,
    signal,
    computed,
    effect,
    batch,
    registerComponent: api.registerComponent,
    unregisterComponent: api.unregisterComponent,
    resolveComponent: api.resolveComponent,
    listComponents: api.listComponents,
    clearComponents: api.clearComponents,
    boundary,
    onMount,
    onUnmount,
    onDispose,
    onError,
    createContext: createFabricaContext,
    createRequiredContext: createRequiredFabricaContext,
    createReactiveContext: createReactiveFabricaContext,
    createContextProvider,
    createReactiveContextProvider,
    provide,
    provideReactiveContext,
    useContext,
    requireContext,
    useRequiredContext,
    useReactiveContext,
    requireReactiveContext,
    hasContext,
    when,
    repeat,
    virtualRepeat,
    portal,
    suspense,
    bind,
    model,
    keyed,
    event: api.event,
    eventOptions,
    fragment,
    childrenToArray,
    slot,
    memoView,
    ref,
    classMap,
    styleMap,
    createDomBag,
  });
}
