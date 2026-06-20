import type {
  ClassMapDirective,
  Directive,
  RefDirective,
  RenderValue,
  RepeatContext,
  RepeatDirective,
  RepeatOptions,
  Signal,
  StyleMapDirective,
  VirtualRepeatDirective,
  VirtualRepeatOptions,
  WhenDirective,
  PortalDirective,
  SuspenseDirective,
  BindDirective,
  KeyedDirective,
  EventOptionsDirective,
} from "./types";

/**
 * Creates a conditional rendering directive.
 *
 * @param condition - Boolean-ish value, signal, or expression.
 * @param truthy - Renderer used when condition is truthy.
 * @param falsy - Renderer used when condition is falsy.
 * @returns When directive.
 *
 * @example
 * ```ts
 * html`${when(open, () => html`<p>Open</p>`, () => html`<p>Closed</p>`)}`;
 * ```
 */
export function when(
  condition: unknown | Signal<unknown> | (() => unknown),
  truthy: () => RenderValue,
  falsy?: () => RenderValue,
): WhenDirective {
  const directive = falsy ? { kind: "when" as const, condition, truthy, falsy } : { kind: "when" as const, condition, truthy };
  return createDirective(directive);
}

/**
 * Creates a keyed list rendering directive.
 *
 * @param items - Items array, signal, or expression.
 * @param key - Stable key getter.
 * @param renderItem - Item renderer.
 * @param options - Repeat options.
 * @returns Repeat directive.
 *
 * @example
 * ```ts
 * repeat(users, (user) => user.id, ({ item }) => html`<li>${() => item().name}</li>`);
 * ```
 */
export function repeat<Item, Key extends PropertyKey>(
  items: readonly Item[] | Signal<readonly Item[]> | (() => readonly Item[]),
  key: (item: Item, index: number) => Key,
  renderItem: (context: RepeatContext<Item, Key>) => RenderValue,
  options: RepeatOptions = {},
): RepeatDirective<Item, Key> {
  const directive = options.empty
    ? { kind: "repeat" as const, items, key, render: renderItem, empty: options.empty, strategy: options.strategy }
    : { kind: "repeat" as const, items, key, render: renderItem, strategy: options.strategy };

  return createDirective(directive);
}


/**
 * Creates a viewport-windowed keyed list directive for very large collections.
 *
 * @param items - Items array, signal, or expression.
 * @param key - Stable key getter.
 * @param renderItem - Item renderer.
 * @param options - Virtualization options.
 * @returns Virtual repeat directive.
 *
 * @example Render a large log list without mounting every row
 * ```ts
 * virtualRepeat(logs, (log) => log.id, ({ item }) => html`<article>${() => item().message}</article>`, {
 *   itemHeight: 34,
 *   overscan: 8,
 *   height: 420,
 * });
 * ```
 */
export function virtualRepeat<Item, Key extends PropertyKey>(
  items: readonly Item[] | Signal<readonly Item[]> | (() => readonly Item[]),
  key: (item: Item, index: number) => Key,
  renderItem: (context: RepeatContext<Item, Key>) => RenderValue,
  options: VirtualRepeatOptions = {},
): VirtualRepeatDirective<Item, Key> {
  const directive = options.empty
    ? {
        kind: "virtualRepeat" as const,
        items,
        key,
        render: renderItem,
        empty: options.empty,
        itemHeight: options.itemHeight ?? 32,
        overscan: options.overscan ?? 8,
        height: options.height ?? 360,
      }
    : {
        kind: "virtualRepeat" as const,
        items,
        key,
        render: renderItem,
        itemHeight: options.itemHeight ?? 32,
        overscan: options.overscan ?? 8,
        height: options.height ?? 360,
      };

  return createDirective(directive);
}


/**
 * Renders content into another DOM root while the current template owns cleanup.
 *
 * @param target - Portal target or target getter.
 * @param value - Value to render into the target.
 * @returns Portal directive.
 *
 * @example
 * ```ts
 * html`${portal(document.body, html`<div role="dialog">Hi</div>`)}`
 * ```
 */
export function portal(
  target: PortalDirective["target"],
  value: PortalDirective["value"],
): PortalDirective {
  return createDirective({ kind: "portal" as const, target, value });
}

/**
 * Creates a small resource suspense directive.
 *
 * @param source - Resource-like signal/object with loading, value and error.
 * @param resolved - Renderer for resolved values.
 * @param pending - Pending fallback.
 * @param rejected - Optional error fallback.
 * @returns Suspense directive.
 */
export function suspense(
  source: unknown,
  resolved: (value: unknown) => RenderValue,
  pending: () => RenderValue,
  rejected?: (error: unknown) => RenderValue,
): SuspenseDirective {
  return createDirective({ kind: "suspense" as const, source, resolved, pending, rejected });
}



/**
 * Creates a two-way binding directive for form controls.
 *
 * @param source - Writable signal to sync with the element.
 * @param options - Optional event and value mappers.
 * @returns Bind directive.
 *
 * @example
 * ```ts
 * const name = signal('Rod');
 * html`<input .value=${bind(name)} />`;
 * ```
 */
export function bind<Value>(source: Signal<Value>, options: { event?: string; from?: (element: Element) => Value; to?: (value: Value) => unknown } = {}): BindDirective<Value> {
  return createDirective({ kind: "bind" as const, signal: source, event: options.event, from: options.from, to: options.to });
}

/** Alias for bind(), useful for model-style APIs. */
export const model = bind;

/**
 * Creates a keyed child directive that remounts when the key changes.
 *
 * @param key - Key value or expression.
 * @param render - Renderer for the keyed branch.
 * @returns Keyed directive.
 */
export function keyed(key: unknown | Signal<unknown> | (() => unknown), render: () => RenderValue): KeyedDirective {
  return createDirective({ kind: "keyed" as const, key, render });
}

/**
 * Wraps an event handler with explicit addEventListener options.
 *
 * @param handler - Event listener.
 * @param options - Listener options.
 * @returns Event options directive.
 */
export function eventOptions(handler: EventListener, options: AddEventListenerOptions = {}): EventOptionsDirective {
  return createDirective({ kind: "eventOptions" as const, handler, options });
}

/** Creates a document fragment from render values. */
export function fragment(...children: readonly RenderValue[]): DocumentFragment {
  const node = document.createDocumentFragment();
  for (let index = 0; index < children.length; index += 1) appendFragmentValue(node, children[index]);
  return node;
}

/** Converts children into an array without flattening DOM nodes into text. */
export function childrenToArray(children: unknown): unknown[] {
  if (children == null || children === false || children === true) return [];
  return Array.isArray(children) ? children.slice() : [children];
}

/** Reads a named slot from a slot dictionary. */
export function slot(slots: unknown, name: string, fallback: RenderValue = null): RenderValue {
  if (!slots || typeof slots !== "object") return fallback;
  return Object.prototype.hasOwnProperty.call(slots, name) ? (slots as Record<string, RenderValue>)[name] : fallback;
}

/** Memoizes a view factory by strict dependency equality. */
export function memoView<Args extends readonly unknown[]>(factory: (...args: Args) => RenderValue): (...args: Args) => RenderValue {
  let hasValue = false;
  let previousArgs: readonly unknown[] = [];
  let previousValue: RenderValue = null;
  return (...args: Args): RenderValue => {
    if (hasValue && args.length === previousArgs.length) {
      let same = true;
      for (let index = 0; index < args.length; index += 1) {
        if (!Object.is(args[index], previousArgs[index])) { same = false; break; }
      }
      if (same) return previousValue;
    }
    previousArgs = args.slice();
    previousValue = factory(...args);
    hasValue = true;
    return previousValue;
  };
}

function appendFragmentValue(parent: DocumentFragment, value: RenderValue): void {
  if (value == null || value === false || value === true) return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) appendFragmentValue(parent, value[index]);
    return;
  }
  if (value instanceof Node) { parent.appendChild(value); return; }
  parent.appendChild(document.createTextNode(String(value)));
}

/**
 * Creates an element ref directive.
 *
 * @param callback - Ref callback. May return cleanup.
 * @returns Ref directive.
 *
 * @example
 * ```ts
 * html`<input ref=${ref((node) => node.focus())} />`;
 * ```
 */
export function ref(callback: (node: Element) => void | (() => void)): RefDirective {
  return createDirective({ kind: "ref", callback });
}

/**
 * Creates a class map directive with diffing.
 *
 * @param value - Class boolean map.
 * @returns Class map directive.
 */
export function classMap(value: Record<string, unknown>): ClassMapDirective {
  return createDirective({ kind: "classMap", value });
}

/**
 * Creates a style map directive with diffing.
 *
 * @param value - Style value map.
 * @returns Style map directive.
 */
export function styleMap(value: Record<string, unknown>): StyleMapDirective {
  return createDirective({ kind: "styleMap", value });
}

/**
 * Brands a directive object.
 *
 * @param directive - Directive data.
 * @returns Branded directive.
 */
export function createDirective<DirectiveShape extends { kind: string }>(
  directive: DirectiveShape,
): DirectiveShape & Directive {
  return Object.assign(directive, { __kind: "directive" as const });
}
