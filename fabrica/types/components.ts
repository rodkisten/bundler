import type {
  Cleanup,
  ContextToken,
  Owner,
  ReactiveContextToken,
  Signal,
} from "@rodkisten/broto/types";
import type {
  RefCallback,
  RefDirective,
} from "./directives.js";
import type {
  HtmlTag,
  HtmlTemplateTag,
  PropsBag,
  RenderValue,
} from "./render.js";

/** Registry collision policy used by instance and pack installation APIs. */
export type RegistryCollision =
  | "replace"
  | "keep"
  | "warn"
  | "error";

/** Open component-like function accepted by registries and adapters. */
export type ComponentLike =
  | Component<any>
  | ((props?: any) => unknown);

/** Registration options shared by registries, instances, and packs. */
export type RegistryRegistrationOptions = {
  collision?: RegistryCollision;
  onWarning?: (message: string) => void;
};

/** Construction options for a component registry. */
export type ComponentRegistryOptions = {
  name?: string;
  parent?: ComponentRegistry;
  entries?: Iterable<readonly [string, ComponentLike]>;
};

/** Instance-local component registry contract. */
export type ComponentRegistry = {
  readonly name: string;
  readonly size: number;
  readonly version: number;
  readonly parent?: ComponentRegistry;
  register<T extends ComponentLike>(
    name: string,
    component: T,
    options?: RegistryRegistrationOptions,
  ): T;
  unregister(name: string): boolean;
  resolve(name: string): ComponentLike | undefined;
  has(name: string, ownOnly?: boolean): boolean;
  list(options?: {
    inherited?: boolean;
  }): Map<string, ComponentLike>;
  clear(options?: { inherited?: boolean }): void;
  import(
    source: ComponentRegistry,
    options?: RegistryRegistrationOptions & {
      namespace?: string;
    },
  ): number;
  fork(name?: string): ComponentRegistry;
  snapshot(name?: string): ComponentRegistry;
  setParent(parent: ComponentRegistry | undefined): void;
  /** @deprecated Use `register()`. */
  registerComponent<T extends ComponentLike>(
    name: string,
    component: T,
  ): T;
  /** @deprecated Use `unregister()`. */
  unregisterComponent(name: string): boolean;
  /** @deprecated Use `resolve()`. */
  resolveComponent(name: string): ComponentLike | undefined;
  /** @deprecated Use `list()`. */
  listComponents(): Map<string, ComponentLike>;
  /** @deprecated Use `clear()`. */
  clearComponents(): void;
};

/** Named reusable group of portable component definitions. */
export type ComponentPack = {
  readonly __kind: "componentPack";
  readonly name: string;
  readonly components: ReadonlyMap<string, ComponentLike>;
};

/** Options accepted by `instance.use()`. */
export type ComponentUseOptions =
  RegistryRegistrationOptions & {
    name?: string;
    namespace?: string;
    include?: readonly string[];
    exclude?: readonly string[];
  };

/** Registry sharing mode used by forks and imports. */
export type RegistryImportMode =
  | "reference"
  | "snapshot"
  | "fork"
  | "isolated";

/** Fábrica instance construction options. */
export type FabricaInstanceOptions = {
  name?: string;
  registry?: ComponentRegistry;
  isolated?: boolean;
  attachDollar?: boolean;
  /** Makes this instance the fallback for pre-materialized templates. */
  setAsDefault?: boolean;
};

/** Internal render runtime captured by reactive DOM parts. */
export type FabricaRuntimeContext = {
  readonly id: string;
  readonly name: string;
  registry: ComponentRegistry;
  api?: unknown;
};

/** Component definition options. */
export type ComponentDefinitionOptions =
  RegistryRegistrationOptions & {
    register?: boolean;
  };

/** Component context injected into every component factory. */
export type ComponentContext = {
  name: string;
  instance: unknown;
  registry: ComponentRegistry;
  html: HtmlTag;
  jsx: { html: HtmlTemplateTag };
  component: <Props extends object = ComponentProps>(
    name: string,
    factory: ComponentFactory<Props>,
    options?: ComponentDefinitionOptions,
  ) => Component<Props>;
  owner: Owner;
  id: string;
  signal: typeof import("@rodkisten/broto/reactivity").signal;
  effect: typeof import("@rodkisten/broto/reactivity").effect;
  computed: typeof import("@rodkisten/broto/reactivity").computed;
  memo: typeof import("@rodkisten/broto/reactivity").memo;
  batch: typeof import("@rodkisten/broto/reactivity").batch;
  untrack: typeof import("@rodkisten/broto/reactivity").untrack;
  resource: typeof import("@rodkisten/broto/resources").resource;
  onMount(callback: () => void | Cleanup): void;
  onUnmount(callback: Cleanup): void;
  onDispose(callback: Cleanup): void;
  provide<Value>(
    context: ContextToken<Value>,
    value: Value,
  ): Value;
  useContext<Value>(context: ContextToken<Value>): Value;
  requireContext<Value>(context: ContextToken<Value>): Value;
  useRequiredContext<Value>(context: ContextToken<Value>): Value;
  provideReactiveContext<Value>(
    context: ReactiveContextToken<Value>,
    value: Value | Signal<Value>,
  ): Signal<Value>;
  useReactiveContext<Value>(
    context: ReactiveContextToken<Value>,
  ): Signal<Value>;
  requireReactiveContext<Value>(
    context: ReactiveContextToken<Value>,
  ): Signal<Value>;
  ref<T extends Element = Element>(
    callback: RefCallback<T>,
  ): RefDirective<T>;
};

/** Error boundary options. */
export type BoundaryOptions = {
  children: () => RenderValue;
  fallback: (
    error: unknown,
    retry: () => void,
  ) => RenderValue;
  onError?: (error: unknown) => void;
};

/** Reusable component children. */
export type ComponentChildren =
  | RenderValue
  | readonly RenderValue[];

/** Component props accepted by open component surfaces. */
export type ComponentProps = PropsBag;

/** Reusable component setup function. */
export type ComponentFactory<
  Props extends object = ComponentProps,
> = (
  props: Props & { children?: ComponentChildren },
  context: ComponentContext,
) => RenderValue;

/** Deferred component invocation used by tags and direct composition. */
export type ComponentRenderRequest<
  Props extends object = ComponentProps,
> = {
  readonly __kind: "componentRender";
  readonly component: Component<Props>;
  readonly props: Props & {
    children?: ComponentChildren;
  };
};

/** Reusable component function. */
export type Component<
  Props extends object = ComponentProps,
> = ((
  props?: Props & { children?: ComponentChildren },
) => ComponentRenderRequest<Props>) & {
  readonly __kind: "component";
  readonly displayName?: string;
  readonly registryName?: string;
  readonly portable?: boolean;
  readonly factory?: ComponentFactory<Props>;
  register(
    target?: unknown,
    options?: ComponentUseOptions,
  ): Component<Props>;
  unregister(target?: unknown, name?: string): boolean;
};

/** Plain element payload emitted by framework adapters. */
export type ElementPayload = {
  readonly tag: string;
  readonly props?: ComponentProps | null;
};

/** Plain component payload emitted by framework adapters. */
export type ComponentPayload = {
  readonly component: unknown;
  readonly props?: ComponentProps | null;
};
