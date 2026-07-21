import type {
  batch,
  computed,
  effect,
  signal,
} from "@rodkisten/broto/reactivity";
import type { $ } from "../bag.js";
import type { boundary } from "../boundary.js";
import type { defineComponent } from "../component.js";
import type { createComponentRegistry } from
  "../component-registry.js";
import type {
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
import type { css } from "../css.js";
import type { event } from "../event-typing.js";
import type {
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
import type { defineElement, elements } from "../elements.js";
import type { config } from "../install-state.js";
import type { onDispose, onError, onMount, onUnmount } from
  "../lifecycle.js";
import type {
  mount,
  mountPreservingChildren,
  render,
} from "../render/dom.js";
import type { createComponentPack } from "./packs.js";
import type {
  Component,
  ComponentDefinitionOptions,
  ComponentFactory,
  ComponentLike,
  ComponentPack,
  ComponentProps,
  ComponentRegistry,
  ComponentUseOptions,
  DebugListener,
  DebugRecord,
  DebugSnapshot,
  FabricaInstanceOptions,
  InstallOptions,
  RawHtml,
  RegistryImportMode,
  HtmlTag,
  HtmlTemplateTag,
} from "../types.js";

export type HtmlApi = HtmlTag & {
  raw(value: string): RawHtml;
  sanitized(value: string): RawHtml;
  trusted(value: string): RawHtml;
  unsafe(value: string): RawHtml;
};

/** Public instance API. Every renderer function is bound to one registry. */
export type FabricaApi = {
  readonly __kind: "fabricaInstance";
  readonly id: string;
  readonly name: string;
  readonly registry: ComponentRegistry;
  html: HtmlApi;
  render: typeof render;
  mount: typeof mount;
  mountPreservingChildren: typeof mountPreservingChildren;
  jsx: { html: HtmlTemplateTag };
  component: {
    <Props extends object = ComponentProps>(factory: ComponentFactory<Props>): Component<Props>;
    <Props extends object = ComponentProps>(name: string, factory: ComponentFactory<Props>, options?: ComponentDefinitionOptions): Component<Props>;
  };
  defineComponent: typeof defineComponent;
  signal: typeof signal;
  computed: typeof computed;
  effect: typeof effect;
  batch: typeof batch;
  /** @deprecated Use `component(name, factory)`, `use()` or `registry.register()`. */
  registerComponent(name: string, component: ComponentLike): ComponentLike;
  unregisterComponent(name: string): boolean;
  resolveComponent(name: string): ComponentLike | undefined;
  listComponents(): Map<string, ComponentLike>;
  clearComponents(): void;
  use<T extends ComponentLike | ComponentPack>(value: T, options?: ComponentUseOptions): T;
  importRegistry(source: FabricaApi | ComponentRegistry, options?: { mode?: RegistryImportMode; collision?: ComponentUseOptions["collision"]; namespace?: string }): FabricaApi;
  fork(options?: Omit<FabricaInstanceOptions, "registry"> & { registry?: ComponentRegistry | RegistryImportMode }): FabricaApi;
  run<T>(callback: () => T): T;
  create(options?: FabricaInstanceOptions): FabricaApi;
  getOrCreate(key: string, options?: FabricaInstanceOptions): FabricaApi;
  createRegistry: typeof createComponentRegistry;
  createComponentPack: typeof createComponentPack;
  boundary: typeof boundary;
  onMount: typeof onMount;
  onUnmount: typeof onUnmount;
  onDispose: typeof onDispose;
  onError: typeof onError;
  createContext: typeof createFabricaContext;
  createRequiredContext: typeof createRequiredFabricaContext;
  createReactiveContext: typeof createReactiveFabricaContext;
  createContextProvider: typeof createContextProvider;
  createReactiveContextProvider: typeof createReactiveContextProvider;
  provide: typeof provide;
  provideReactiveContext: typeof provideReactiveContext;
  useContext: typeof useContext;
  requireContext: typeof requireContext;
  useRequiredContext: typeof useRequiredContext;
  useReactiveContext: typeof useReactiveContext;
  requireReactiveContext: typeof requireReactiveContext;
  hasContext: typeof hasContext;
  when: typeof when;
  repeat: typeof repeat;
  virtualRepeat: typeof virtualRepeat;
  portal: typeof portal;
  suspense: typeof suspense;
  bind: typeof bind;
  model: typeof model;
  keyed: typeof keyed;
  event: typeof event;
  eventOptions: typeof eventOptions;
  fragment: typeof fragment;
  childrenToArray: typeof childrenToArray;
  slot: typeof slot;
  memoView: typeof memoView;
  ref: typeof ref;
  classMap: typeof classMap;
  styleMap: typeof styleMap;
  css: typeof css;
  elements: typeof elements;
  defineElement: typeof defineElement;
  $: typeof $;
  config: typeof config;
  install(options?: InstallOptions): FabricaApi;
  noConflict(): FabricaApi;
  setDebug(enabled: boolean): void;
  debug(): Readonly<DebugSnapshot>;
  debugRecords(): readonly DebugRecord[];
  clearDebugRecords(): void;
  subscribeDebug(listener: DebugListener): () => void;
};

