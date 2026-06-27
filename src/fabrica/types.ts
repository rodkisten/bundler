import type { Cleanup, CleanupRegistrar, ContextToken, Owner, ReactiveExpression, Signal } from "../broto/types";
export type { Cleanup, CleanupRegistrar, ContextToken, Owner, ReactiveExpression, Signal } from "../broto/types";

/**
 * Shared public and internal types used by FabricaDOM.
 *
 * @remarks
 * This file is intentionally boring and explicit. The runtime is small, but the
 * type surface is the contract people will build on top of. Keeping the shapes
 * here avoids circular imports and keeps each implementation file focused on one
 * job instead of becoming a kitchen drawer.
 */

/** Values accepted by the DOM renderer use Broto reactive primitives when needed. */
/** Values accepted by the DOM renderer. */
export type RenderValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Node
  | DocumentFragment
  | readonly RenderValue[]
  | Signal<unknown>
  | ReactiveExpression<unknown>
  | Directive
  | RawHtml
  | DomBag
  | ElementPayload
  | ComponentPayload
  | Component
  | ComponentRenderRequest;

/** Runtime debug counters. */
export type DebugSnapshot = {
  enabled: boolean;
  templates: number;
  parts: number;
  effects: number;
  flushes: number;
  updates: number;
  components: number;
  delegatedEvents: number;
  reconciliations: number;
  virtualWindows: number;
};

/** A trusted raw HTML wrapper. */
export type RawHtml = {
  readonly __kind: "rawHtml";
  readonly value: string;
};

/** Base directive contract. */
export type Directive = {
  readonly __kind: "directive";
  readonly kind: string;
};

/** Conditional directive. */
export type WhenDirective = Directive & {
  readonly kind: "when";
  condition: unknown | Signal<unknown> | ReactiveExpression<unknown>;
  truthy: () => RenderValue;
  falsy?: () => RenderValue;
};

/** Portal directive that renders children into an external target. */
export type PortalDirective = Directive & {
  readonly kind: "portal";
  target: Element | DocumentFragment | ShadowRoot | (() => Element | DocumentFragment | ShadowRoot | null);
  value: RenderValue | (() => RenderValue);
};

/** Suspense directive for resource-like values. */
export type SuspenseDirective = Directive & {
  readonly kind: "suspense";
  source: unknown;
  pending: () => RenderValue;
  resolved: (value: unknown) => RenderValue;
  rejected?: (error: unknown) => RenderValue;
};

/** Two-way binding directive for form controls. */
export type BindDirective<Value = unknown> = Directive & {
  readonly kind: "bind";
  signal: Signal<Value>;
  event?: string;
  from?: (element: Element) => Value;
  to?: (value: Value) => unknown;
};

/** Keyed child directive that remounts content when the key changes. */
export type KeyedDirective = Directive & {
  readonly kind: "keyed";
  key: unknown | Signal<unknown> | ReactiveExpression<unknown>;
  render: () => RenderValue;
};

/** Event handler object with explicit listener options. */
export type EventOptionsDirective = Directive & {
  readonly kind: "eventOptions";
  handler: EventListener;
  options: AddEventListenerOptions;
};


/** Keyed repeat directive. */
export type RepeatDirective<Item, Key extends PropertyKey> = Directive & {
  readonly kind: "repeat";
  items: readonly Item[] | Signal<readonly Item[]> | ReactiveExpression<readonly Item[]>;
  key: (item: Item, index: number) => Key;
  render: (context: RepeatContext<Item, Key>) => RenderValue;
  empty?: () => RenderValue;
  /** Diff strategy. append-only is optimized for logs/timelines that only grow. */
  strategy?: "keyed" | "append-only" | "indexed";
};

/** Per-item context passed to keyed repeat renderers. */
export type RepeatContext<Item, Key extends PropertyKey> = {
  item: Signal<Item>;
  index: Signal<number>;
  key: Signal<Key>;
};

/** Repeat options. */
export type RepeatOptions = {
  empty?: () => RenderValue;
  /** Diff strategy. append-only is optimized for logs/timelines that only grow. */
  strategy?: "keyed" | "append-only" | "indexed";
};

/** Virtual repeat options for large lists. */
export type VirtualRepeatOptions = RepeatOptions & {
  itemHeight?: number;
  overscan?: number;
  height?: number | string;
};

/** Element ref directive. */
export type RefDirective = Directive & {
  readonly kind: "ref";
  callback: (node: Element) => void | Cleanup;
};

/** Class map directive. */
export type ClassMapDirective = Directive & {
  readonly kind: "classMap";
  value: Record<string, unknown>;
};

/** Style map directive. */
export type StyleMapDirective = Directive & {
  readonly kind: "styleMap";
  value: Record<string, unknown>;
};

/** Keyed repeat with viewport windowing. */
export type VirtualRepeatDirective<Item, Key extends PropertyKey> = Directive & {
  readonly kind: "virtualRepeat";
  items: readonly Item[] | Signal<readonly Item[]> | ReactiveExpression<readonly Item[]>;
  key: (item: Item, index: number) => Key;
  render: (context: RepeatContext<Item, Key>) => RenderValue;
  empty?: () => RenderValue;
  itemHeight: number;
  overscan: number;
  height: number | string;
};

/** All supported map directives. */
export type MapDirective = ClassMapDirective | StyleMapDirective;

/** Registry collision policy used by instance and pack installation APIs. */
export type RegistryCollision = "replace" | "keep" | "warn" | "error";

/** Open component-like function accepted by registries and adapters. */
export type ComponentLike = Component<any> | ((props?: any) => unknown);

/** Registration options shared by registries, instances and packs. */
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
  register<T extends ComponentLike>(name: string, component: T, options?: RegistryRegistrationOptions): T;
  unregister(name: string): boolean;
  resolve(name: string): ComponentLike | undefined;
  has(name: string, ownOnly?: boolean): boolean;
  list(options?: { inherited?: boolean }): Map<string, ComponentLike>;
  clear(options?: { inherited?: boolean }): void;
  import(source: ComponentRegistry, options?: RegistryRegistrationOptions & { namespace?: string }): number;
  fork(name?: string): ComponentRegistry;
  snapshot(name?: string): ComponentRegistry;
  setParent(parent: ComponentRegistry | undefined): void;
  /** @deprecated Use `register()`. */
  registerComponent<T extends ComponentLike>(name: string, component: T): T;
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
export type ComponentUseOptions = RegistryRegistrationOptions & {
  name?: string;
  namespace?: string;
  include?: readonly string[];
  exclude?: readonly string[];
};

/** Registry sharing mode used by forks/imports. */
export type RegistryImportMode = "reference" | "snapshot" | "fork" | "isolated";

/** Fabrica instance construction options. */
export type FabricaInstanceOptions = {
  name?: string;
  registry?: ComponentRegistry;
  isolated?: boolean;
  attachDollar?: boolean;
};

/** Internal render runtime captured by reactive DOM parts. */
export type FabricaRuntimeContext = {
  readonly id: string;
  readonly name: string;
  registry: ComponentRegistry;
  api?: unknown;
};

/** Component definition options. */
export type ComponentDefinitionOptions = RegistryRegistrationOptions & {
  register?: boolean;
};

/** Component context. */
export type ComponentContext = {
  /** Stable component name used by diagnostics and portable definitions. */
  name: string;
  /** Fabrica instance that materialized this component. */
  instance: unknown;
  /** Instance-local registry used by named component tags. */
  registry: ComponentRegistry;
  /** Instance-bound template tag. */
  html: ((strings: TemplateStringsArray, ...values: RenderValue[]) => DocumentFragment) & { jsx?: (strings: TemplateStringsArray, ...values: RenderValue[]) => DocumentFragment };
  /** Instance-bound JSX namespace. */
  jsx: { html: (strings: TemplateStringsArray, ...values: RenderValue[]) => DocumentFragment };
  /** Instance-bound component factory. */
  component: <Props extends object = ComponentProps>(name: string, factory: ComponentFactory<Props>, options?: ComponentDefinitionOptions) => Component<Props>;
  /** Component owner created by Broto. */
  owner: Owner;
  /** Stable component id useful for labels, aria and debug output. */
  id: string;
  /** Creates local reactive state for components. */
  signal: typeof import("../broto/reactivity").signal;
  /** Creates an effect owned by this component boundary. */
  effect: typeof import("../broto/reactivity").effect;
  computed: typeof import("../broto/reactivity").computed;
  memo: typeof import("../broto/reactivity").memo;
  batch: typeof import("../broto/reactivity").batch;
  untrack: typeof import("../broto/reactivity").untrack;
  resource: typeof import("../broto/resources").resource;
  onMount(callback: () => void | Cleanup): void;
  onUnmount(callback: Cleanup): void;
  onDispose(callback: Cleanup): void;
  provide<Value>(context: ContextToken<Value>, value: Value): Value;
  useContext<Value>(context: ContextToken<Value>): Value;
  ref(callback: (node: Element) => void | Cleanup): RefDirective;
};

/** Error boundary options. */
export type BoundaryOptions = {
  children: () => RenderValue;
  fallback: (error: unknown, retry: () => void) => RenderValue;
  onError?: (error: unknown) => void;
};

/** Reusable component children. */
export type ComponentChildren = RenderValue | readonly RenderValue[];

/** Component props accepted by open component surfaces. */
export type ComponentProps = Record<string, unknown>;

/** Reusable component setup function. */
export type ComponentFactory<Props extends object = ComponentProps> = (
  props: Props & { children?: ComponentChildren },
  context: ComponentContext,
) => RenderValue;

/** A deferred component invocation used by component tags and direct composition. */
export type ComponentRenderRequest<Props extends object = ComponentProps> = {
  readonly __kind: "componentRender";
  readonly component: Component<Props>;
  readonly props: Props & { children?: ComponentChildren };
};

/** Reusable component function. */
export type Component<Props extends object = ComponentProps> = ((props?: Props & { children?: ComponentChildren }) => ComponentRenderRequest<Props>) & {
  readonly __kind: "component";
  readonly displayName?: string;
  readonly registryName?: string;
  readonly portable?: boolean;
  readonly factory?: ComponentFactory<Props>;
  register(target?: unknown, options?: ComponentUseOptions): Component<Props>;
  unregister(target?: unknown, name?: string): boolean;
};

/** Plain element payload emitted by framework adapters such as Cipó payload mode. */
export type ElementPayload = {
  readonly tag: string;
  readonly props?: ComponentProps | null;
};

/** Plain component payload emitted by framework adapters. */
export type ComponentPayload = {
  readonly component: unknown;
  readonly props?: ComponentProps | null;
};


/** CSS/class artifact emitted by companion libraries such as Cipó. */
export type CssLikeArtifact = {
  readonly cssText?: string;
  readonly compiledCss?: string;
  readonly className?: string;
  readonly classes?: string;
  readonly value?: string;
  readonly kind?: string;
  toString?: () => string;
};

/** Plain render payload emitted by adapter-style component factories. */
export type RenderablePayload = ElementPayload | ComponentPayload;

/** Template part compiled from an HTML template. */
export type TemplatePart =
  | {
      type: "child";
      index: number;
      path: number[];
    }
  | {
      type: "attribute";
      /** First interpolation index kept for compatibility and fast single-value bindings. */
      index: number;
      /** All interpolation indexes that participate in this attribute value. */
      indices: number[];
      /** Static text segments around each interpolation. Length is indices.length + 1. */
      strings: string[];
      /** True when the entire attribute value is exactly one interpolation. */
      raw: boolean;
      path: number[];
      name: string;
    }
  | {
      type: "spread";
      index: number;
      path: number[];
    }
  | {
      type: "component";
      index: number;
      path: number[];
      name?: string;
    };

/** Cached compiled template. */
export type CompiledTemplate = {
  template: HTMLTemplateElement;
  parts: TemplatePart[];
};

/** Event modifiers parsed from @click.prevent.passive syntax. */
export type EventBindingConfig = {
  name: string;
  prevent: boolean;
  stop: boolean;
  delegate: boolean;
  options: AddEventListenerOptions;
};

/** Directive controller mounted inside a child part. */
export type DirectiveController = {
  kind: string;
  update(directive: Directive): void;
  dispose(): void;
};

/** One keyed repeat DOM record. */
export type RepeatRecord = {
  item: Signal<unknown>;
  index: Signal<number>;
  key: Signal<PropertyKey>;
  start: Comment;
  end: Comment;
  fragment: DocumentFragment | null;
};

/** DOM bag options. */
export type DomBagOptions = {
  shadow: boolean;
  important: boolean;
};

/** Callable fluent DOM bag. */
export type DomBag = ((props?: Record<string, unknown>) => DomBag) & {
  readonly $$fabricaBag: true;
  readonly elements: Element[];
  readonly el: Element | null;
  readonly count: number;
  readonly size: number;
  readonly length: number;
  readonly shadow: DomBag;
  readonly important: DomBag;
  html(strings: TemplateStringsArray, ...values: RenderValue[]): DomBag;
  mount(value: RenderValue): Cleanup;
  css(input: CssInput, ...values: unknown[]): DomBag;
  appendTo(parent: ParentNode): DomBag;
  prependTo(parent: ParentNode): DomBag;
  remove(): DomBag;
  dispose(): DomBag;
};

/** CSS input accepted by css helpers. */
export type CssInput = TemplateStringsArray | string | Record<string, unknown>;


/** Mutable runtime config used by install and DOM bag helpers. */
export type RuntimeConfig = {
  exposeDollar: boolean;
  exposeDollarEl: boolean;
  dollarAlias: string;
  forceAlias: boolean;
  createWhenSelectorMisses: boolean;
};

/** Global installation options. */
export type InstallOptions = {
  exposeDollar?: boolean;
  exposeDollarEl?: boolean;
  dollarAlias?: string;
  forceAlias?: boolean;
  createWhenSelectorMisses?: boolean;
};
