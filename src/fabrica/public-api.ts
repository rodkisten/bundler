import { $, createDomBag } from "./bag";
import { batch, computed, effect, signal } from "../broto/reactivity";
import {
  clearComponents as clearDefaultComponents,
  component as defaultComponent,
  createRuntimeComponent,
  defineComponent,
  listComponents as listDefaultComponents,
  registerComponent as registerDefaultComponent,
  resolveComponent as resolveDefaultComponent,
  unregisterComponent as unregisterDefaultComponent,
} from "./component";
import {
  createComponentRegistry,
  defaultComponentRegistry,
  normalizeComponentName,
  resolveRegistry,
} from "./component-registry";
import { warnDeprecated } from "./deprecations";
import { boundary } from "./boundary";
import { createFabricaContext, provide, useContext } from "./context";
import { css } from "./css";
import { debug, setDebug } from "./debug";
import { bind, childrenToArray, classMap, eventOptions, fragment, keyed, memoView, model, portal, ref, repeat, slot, styleMap, suspense, virtualRepeat, when } from "./directives";
import { html as baseHtml, hydrate as baseHydrate, jsx as baseJsx, mount as baseMount, render as baseRender } from "./dom";
import { onDispose, onError, onMount, onUnmount } from "./lifecycle";
import { defineElement, elements } from "./elements";
import { install as installGlobal, noConflict as restoreGlobals } from "./install";
import { config } from "./install-state";
import { rawHtml, sanitizedHtml, trustedHtml, unsafeHtml } from "./raw";
import {
  runWithFabricaRuntime,
  setDefaultFabricaRuntime,
} from "./runtime-context";
import type {
  Component,
  ComponentDefinitionOptions,
  ComponentFactory,
  ComponentLike,
  ComponentPack,
  ComponentProps,
  ComponentRegistry,
  ComponentUseOptions,
  DebugSnapshot,
  DomBag,
  FabricaInstanceOptions,
  FabricaRuntimeContext,
  InstallOptions,
  RawHtml,
  RegistryImportMode,
  RenderValue,
} from "./types";

const INSTANCE_MAP = Symbol.for("rod.fabrica.instances");
const INSTANCE_COUNTER = Symbol.for("rod.fabrica.instance-counter");
let cachedGlobalInstances: Map<string, FabricaApi> | null = null;

type GlobalInstanceState = typeof globalThis & Record<PropertyKey, unknown>;

Object.assign(baseHtml, {
  raw: rawHtml,
  sanitized: sanitizedHtml,
  trusted: trustedHtml,
  unsafe: unsafeHtml,
});

type HtmlApi = typeof baseHtml & {
  jsx: typeof baseHtml;
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
  render: typeof baseRender;
  mount: typeof baseMount;
  hydrate: typeof baseHydrate;
  jsx: { html: typeof baseHtml };
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
  provide: typeof provide;
  useContext: typeof useContext;
  when: typeof when;
  repeat: typeof repeat;
  virtualRepeat: typeof virtualRepeat;
  portal: typeof portal;
  suspense: typeof suspense;
  bind: typeof bind;
  model: typeof model;
  keyed: typeof keyed;
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
};

/** Creates a portable named pack without registering it anywhere. */
export function createComponentPack(
  name: string,
  components: Record<string, ComponentLike> | ReadonlyMap<string, ComponentLike>,
): ComponentPack {
  const normalizedName = normalizeComponentName(name);
  if (!normalizedName) throw new Error("[Fabrica] createComponentPack() needs a non-empty name.");

  const entries = components instanceof Map
    ? components
    : new Map(Object.entries(components));

  for (const [componentName, component] of entries) {
    if (!normalizeComponentName(componentName) || typeof component !== "function") {
      throw new TypeError("[Fabrica] Component packs require named function components.");
    }
  }

  return Object.freeze({
    __kind: "componentPack" as const,
    name: normalizedName,
    components: new Map(entries),
  });
}

/** Creates a fully isolated Fabrica instance unless a registry is supplied. */
export function createFabrica(options: FabricaInstanceOptions = {}): FabricaApi {
  return createFabricaApi(options);
}

/** Returns one realm-wide named instance, creating it on first access. */
export function getOrCreateFabrica(
  key: string,
  options: FabricaInstanceOptions = {},
): FabricaApi {
  const normalizedKey = normalizeInstanceKey(key);
  if (!normalizedKey) throw new Error("[Fabrica] getOrCreate() needs a non-empty key.");

  const instances = getGlobalInstanceMap();
  const existing = instances.get(normalizedKey);
  if (existing) return existing;

  const created = createFabricaApi({
    ...options,
    name: options.name || normalizedKey,
  });
  instances.set(normalizedKey, created);
  return created;
}

function normalizeInstanceKey(key: string): string {
  if (typeof key === "string") {
    const length = key.length;
    if (length > 0 && key.charCodeAt(0) > 32 && key.charCodeAt(length - 1) > 32) {
      return key;
    }
  }

  return String(key || "").trim();
}

function getGlobalInstanceMap(): Map<string, FabricaApi> {
  if (cachedGlobalInstances) return cachedGlobalInstances;

  const target = globalThis as GlobalInstanceState;
  let instances = target[INSTANCE_MAP] as Map<string, FabricaApi> | undefined;

  if (!instances) {
    instances = new Map<string, FabricaApi>();
    Object.defineProperty(target, INSTANCE_MAP, {
      configurable: true,
      enumerable: false,
      value: instances,
    });
  }

  cachedGlobalInstances = instances;
  return instances;
}

/** Creates the default singleton used by package-level compatibility exports. */
export function createDefaultFabricaApi(): FabricaApi {
  return createFabricaApi({
    name: "default",
    registry: defaultComponentRegistry,
    attachDollar: true,
  }, true);
}

/** Creates one frozen instance API around a mutable lightweight runtime record. */
export function createFabricaApi(
  options: FabricaInstanceOptions = {},
  defaultInstance = false,
): FabricaApi {
  const name = String(options.name || (defaultInstance ? "default" : "instance")).trim() || "instance";
  const runtime: FabricaRuntimeContext = {
    id: createInstanceId(name),
    name,
    registry: options.isolated
      ? createComponentRegistry({ name: `${name}:registry` })
      : options.registry ?? createComponentRegistry({ name: `${name}:registry` }),
  };

  const instanceHtml = ((strings: TemplateStringsArray, ...values: RenderValue[]) =>
    runWithFabricaRuntime(runtime, () => baseHtml(strings, ...values))) as HtmlApi;

  instanceHtml.jsx = (strings: TemplateStringsArray, ...values: RenderValue[]) =>
    runWithFabricaRuntime(runtime, () => baseJsx.html(strings, ...values));
  instanceHtml.raw = rawHtml;
  instanceHtml.sanitized = sanitizedHtml;
  instanceHtml.trusted = trustedHtml;
  instanceHtml.unsafe = unsafeHtml;

  const instanceJsx = Object.freeze({ html: instanceHtml.jsx });
  const instanceRender = ((container, value) =>
    runWithFabricaRuntime(runtime, () => baseRender(container, value))) as typeof baseRender;
  const instanceMount = ((container, value) =>
    runWithFabricaRuntime(runtime, () => baseMount(container, value))) as typeof baseMount;
  const instanceHydrate = ((container, value) =>
    runWithFabricaRuntime(runtime, () => baseHydrate(container, value))) as typeof baseHydrate;

  const instanceComponent = ((
    nameOrFactory: string | ComponentFactory,
    maybeFactory?: ComponentFactory,
    componentOptions?: ComponentDefinitionOptions,
  ) => runWithFabricaRuntime(runtime, () =>
    createRuntimeComponent(runtime, nameOrFactory, maybeFactory, componentOptions),
  )) as FabricaApi["component"];

  let api!: FabricaApi;

  const use = <T extends ComponentLike | ComponentPack>(
    value: T,
    useOptions: ComponentUseOptions = {},
  ): T => {
    const include = useOptions.include ? new Set(useOptions.include) : null;
    const exclude = useOptions.exclude ? new Set(useOptions.exclude) : null;
    const namespace = normalizeComponentName(useOptions.namespace);

    if (isComponentPack(value)) {
      for (const [name, component] of value.components) {
        if (include && !include.has(name)) continue;
        if (exclude?.has(name)) continue;
        runtime.registry.register(namespace ? `${namespace}${name}` : name, component, useOptions);
      }
      return value;
    }

    const componentName = normalizeComponentName(
      useOptions.name || (value as Component).registryName || (value as Component).displayName,
    );
    if (!componentName) {
      throw new Error("[Fabrica] instance.use() needs a named component or options.name.");
    }
    runtime.registry.register(namespace ? `${namespace}${componentName}` : componentName, value, useOptions);
    return value;
  };

  const importRegistry = (
    source: FabricaApi | ComponentRegistry,
    importOptions: { mode?: RegistryImportMode; collision?: ComponentUseOptions["collision"]; namespace?: string } = {},
  ): FabricaApi => {
    const sourceRegistry = resolveRegistry(source);
    if (!sourceRegistry) throw new TypeError("[Fabrica] importRegistry() expects a Fabrica instance or component registry.");

    const mode = importOptions.mode ?? "snapshot";
    if (mode === "reference") runtime.registry = sourceRegistry;
    else if (mode === "fork") runtime.registry = sourceRegistry.fork(`${name}:registry`);
    else if (mode === "isolated") runtime.registry = createComponentRegistry({ name: `${name}:registry` });
    else runtime.registry.import(sourceRegistry, importOptions);

    return api;
  };

  const fork = (
    forkOptions: Omit<FabricaInstanceOptions, "registry"> & { registry?: ComponentRegistry | RegistryImportMode } = {},
  ): FabricaApi => {
    const mode = typeof forkOptions.registry === "string" ? forkOptions.registry : "fork";
    let registry: ComponentRegistry;

    if (typeof forkOptions.registry === "object") registry = forkOptions.registry;
    else if (mode === "reference") registry = runtime.registry;
    else if (mode === "snapshot") registry = runtime.registry.snapshot(`${forkOptions.name || name}:registry`);
    else if (mode === "isolated") registry = createComponentRegistry({ name: `${forkOptions.name || name}:registry` });
    else registry = runtime.registry.fork(`${forkOptions.name || name}:registry`);

    return createFabricaApi({
      ...forkOptions,
      name: forkOptions.name || `${name}:fork`,
      registry,
      attachDollar: false,
    });
  };

  api = {
    __kind: "fabricaInstance",
    id: runtime.id,
    name: runtime.name,
    get registry() {
      return runtime.registry;
    },
    html: instanceHtml,
    render: instanceRender,
    mount: instanceMount,
    hydrate: instanceHydrate,
    jsx: instanceJsx,
    component: instanceComponent,
    defineComponent,
    signal,
    computed,
    effect,
    batch,
    registerComponent(name, componentValue) {
      warnDeprecated(
        `instance.registerComponent:${runtime.id}`,
        "[Fabrica] instance.registerComponent(name, component) is deprecated. Use instance.component(\"Name\", factory), instance.use(definition), or instance.registry.register(name, component).",
      );
      return runtime.registry.register(name, componentValue);
    },
    unregisterComponent(name) {
      return runtime.registry.unregister(name);
    },
    resolveComponent(name) {
      return runtime.registry.resolve(name);
    },
    listComponents() {
      return runtime.registry.list();
    },
    clearComponents() {
      runtime.registry.clear();
    },
    use,
    importRegistry,
    fork,
    run(callback) {
      return runWithFabricaRuntime(runtime, callback);
    },
    create: createFabrica,
    getOrCreate: getOrCreateFabrica,
    createRegistry: createComponentRegistry,
    createComponentPack,
    boundary,
    onMount,
    onUnmount,
    onDispose,
    onError,
    createContext: createFabricaContext,
    provide,
    useContext,
    when,
    repeat,
    virtualRepeat,
    portal,
    suspense,
    bind,
    model,
    keyed,
    eventOptions,
    fragment,
    childrenToArray,
    slot,
    memoView,
    ref,
    classMap,
    styleMap,
    css,
    elements,
    defineElement,
    $,
    config,
    install(installOptions?: InstallOptions): FabricaApi {
      return installGlobal(api, installOptions);
    },
    noConflict(): FabricaApi {
      return restoreGlobals(api);
    },
    setDebug,
    debug,
  };

  runtime.api = api;

  if (defaultInstance) setDefaultFabricaRuntime(runtime);
  if (options.attachDollar || defaultInstance) attachDollarApi(api);

  return Object.freeze(api);
}

function attachDollarApi(api: FabricaApi): void {
  Object.assign($, {
    html: api.html,
    css,
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
    provide,
    useContext,
    when,
    repeat,
    virtualRepeat,
    portal,
    suspense,
    bind,
    model,
    keyed,
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

function isComponentPack(value: unknown): value is ComponentPack {
  return Boolean(value && typeof value === "object" && (value as ComponentPack).__kind === "componentPack");
}

function createInstanceId(name: string): string {
  const target = globalThis as GlobalInstanceState;
  const next = Number(target[INSTANCE_COUNTER] || 0) + 1;
  target[INSTANCE_COUNTER] = next;
  return `fabrica:${name}:${next}`;
}

/** Compatibility aliases used by existing imports. */
export {
  defaultComponent,
  registerDefaultComponent,
  unregisterDefaultComponent,
  resolveDefaultComponent,
  listDefaultComponents,
  clearDefaultComponents,
};

/** Convenience public aliases used in examples. */
export type { DomBag, InstallOptions, RawHtml, RenderValue };
