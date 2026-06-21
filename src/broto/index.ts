/**
 * @tool Broto
 * @global Broto
 * @package broto
 * @tags reactive signals scheduler resources browser
 * @description Small reactive runtime extracted from Fábrica.
 *
 * @remarks
 * Broto owns state and reactivity so Fábrica can focus on HTML/UI.
 * It provides signals, computed values, effects, batching, stores, graph helpers,
 * scheduler configuration and async resources.
 *
 * @example Signals and effects
 * ```ts
 * const count = signal(0);
 * const doubled = computed(() => count() * 2);
 * const stop = effect(() => console.log(doubled()));
 * count.set(2);
 * stop();
 * ```
 *
 * @example Store and resource
 * ```ts
 * const user = store({ name: "Rod" });
 * user.name.set("Rodolfo");
 *
 * const profile = resource(() => fetch("/me").then((r) => r.json()));
 * profile.reload();
 * ```
 */
export type {
  BrotoDebugOptions,
  BrotoDebugSnapshot,
  BrotoLeakRecord,
  BrotoLeakSnapshot,
  Cleanup,
  CleanupRegistrar,
  EffectOptions,
  EffectRunner,
  GraphEdge,
  ReactiveExpression,
  Resource,
  ResourceState,
  ResourceLoader,
  SchedulerMode,
  SchedulerPriority,
  ContextToken,
  Owner,
  OwnerOptions,
  OwnerGraphSnapshot,
  Signal,
  SignalOptions,
  SignalDebugSnapshot,
  EffectDebugSnapshot,
  SchedulerDebugSnapshot,
  BrotoRuntimeSnapshot,
} from "./types";

export { configureDebug, debug, setDebug } from "./debug";
export { batch, computed, configureScheduler, effect, effectScope, flushSync, hasReactiveValue, inspectEffects, inspectScheduler, inspectSignals, memo, onCleanup, readReactiveValue, scheduleTask, signal, untrack } from "./reactivity";
export { cleanupOwner, createContext, createOwner, createRoot, disposeOwner, getOwner, getOwnerRoots, handleOwnerError, inspectGraph, inspectOwnerGraph, onOwnerCleanup, onOwnerError, provide, runWithOwner, useContext } from "./owner";
export { graph, Graph } from "./graph";
export { resource } from "./resources";
export { createDeepStore, store, type DeepPartial, type DeepStore, type Store, type StorePatchEvent, type StorePatchMeta, type StorePath, type StorePathSignal, type StoreSelector, type StoreSubscriber, type StoreUnsubscribe, type StoreView } from "./store";

import * as BrotoApi from "./public-api";
export default BrotoApi;

export { flattenOwnerGraph, inspectLeaks, inspectRuntime } from "./devtools";
