import type {
  Cleanup,
  ReactiveExpression,
  Signal,
} from "@rodkisten/broto/types";
import type { RenderValue } from "./render.js";

/** Base directive contract. */
export type Directive = {
  readonly __kind: "directive";
  readonly kind: string;
};

/** Conditional directive. */
export type WhenDirective = Directive & {
  readonly kind: "when";
  condition:
    | unknown
    | Signal<unknown>
    | ReactiveExpression<unknown>;
  truthy: () => RenderValue;
  falsy?: () => RenderValue;
};

/** Portal directive that renders children into an external target. */
export type PortalDirective = Directive & {
  readonly kind: "portal";
  target:
    | Element
    | DocumentFragment
    | ShadowRoot
    | (() => Element | DocumentFragment | ShadowRoot | null);
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

/** Keyed child directive that remounts content when its key changes. */
export type KeyedDirective = Directive & {
  readonly kind: "keyed";
  key:
    | unknown
    | Signal<unknown>
    | ReactiveExpression<unknown>;
  render: () => RenderValue;
};

/** Event handler object with explicit listener options. */
export type EventOptionsDirective = Directive & {
  readonly kind: "eventOptions";
  handler: EventListener;
  options: AddEventListenerOptions;
};

/** Keyed repeat directive. */
export type RepeatDirective<
  Item,
  Key extends PropertyKey,
> = Directive & {
  readonly kind: "repeat";
  items:
    | readonly Item[]
    | Signal<readonly Item[]>
    | ReactiveExpression<readonly Item[]>;
  key: (item: Item, index: number) => Key;
  render: (context: RepeatContext<Item, Key>) => RenderValue;
  empty?: () => RenderValue;
  strategy?: "keyed" | "append-only" | "indexed";
};

/** Per-item context passed to keyed repeat renderers. */
export type RepeatContext<
  Item,
  Key extends PropertyKey,
> = {
  item: Signal<Item>;
  index: Signal<number>;
  key: Signal<Key>;
};

/** Repeat options. */
export type RepeatOptions = {
  empty?: () => RenderValue;
  strategy?: "keyed" | "append-only" | "indexed";
};

/** Virtual repeat options for large lists. */
export type VirtualRepeatOptions = RepeatOptions & {
  itemHeight?: number;
  overscan?: number;
  height?: number | string;
};

/** Element ref callback whose return value becomes owned cleanup. */
export type RefCallback<T extends Element = Element> = (
  node: T,
) => void | Cleanup;

/** Mutable object ref populated on mount and reset on disposal. */
export type RefObject<T extends Element = Element> = {
  current: T | null;
};

/** Every ref shape accepted by native and component attributes. */
export type RefValue<T extends Element = Element> =
  | RefCallback<T>
  | RefObject<T>
  | RefDirective<T>
  | null
  | undefined;

export type RefDirective<T extends Element = Element> = Directive & {
  readonly kind: "ref";
  callback: RefCallback<T>;
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
export type VirtualRepeatDirective<
  Item,
  Key extends PropertyKey,
> = Directive & {
  readonly kind: "virtualRepeat";
  items:
    | readonly Item[]
    | Signal<readonly Item[]>
    | ReactiveExpression<readonly Item[]>;
  key: (item: Item, index: number) => Key;
  render: (context: RepeatContext<Item, Key>) => RenderValue;
  empty?: () => RenderValue;
  itemHeight: number;
  overscan: number;
  height: number | string;
};

/** All supported map directives. */
export type MapDirective =
  | ClassMapDirective
  | StyleMapDirective;

/** Directive controller mounted inside one child part. */
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
  version?: number;
  order?: number;
};
