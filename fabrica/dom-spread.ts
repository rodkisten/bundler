import { effect } from "@rodkisten/broto/reactivity";
import { registerCleanup } from "@rodkisten/fabrica/dom-cleanup";
import { bindEvent } from "@rodkisten/fabrica/events";
import { isDomElement } from "@rodkisten/fabrica/guards";
import { setPropertyOrAttribute } from "@rodkisten/fabrica/props";
import { stringifyAttributeValue } from "@rodkisten/fabrica/dom-payload";
import { hasReactiveValue, readValue } from "@rodkisten/fabrica/value";
import type { RenderValue } from "@rodkisten/fabrica/types";
import { applySpecialAttribute, createSpecialAttributeState } from "@rodkisten/fabrica/dom-special-attributes";

let spreadEventDiffVersion = 0;

export type SpreadBindingState = {
  keys: Set<string>;
  /**
   * Last applied raw values. Optional for compatibility with older tests and
   * external callers that created the state object manually before the diff
   * cache existed. `ensureSpreadBindingState` upgrades it in-place.
   */
  values?: Map<string, unknown>;
  events: Map<string, EventListener>;
  /** Cleanup handles returned by the shared automatic delegation runtime. */
  eventCleanups?: Map<string, () => void>;
  /**
   * Per-event diff version. Optional for compatibility with older manually
   * created states. `ensureSpreadBindingState` upgrades it in-place.
   */
  eventVersions?: Map<string, number>;
  refCleanup: (() => void) | null;
};

/**
 * Binds a spread props interpolation on a real DOM element.
 *
 * @remarks
 * This powers template syntax such as `<button ...${props}>`. The spread value
 * intentionally uses the same prop vocabulary as element payloads: `class`,
 * `className`, `style`, `attrs`, `dataset`, `ref`, `on`, `onClick`, regular DOM
 * properties and plain attributes. Event listeners are diffed and removed on
 * update or disposal so reactive spreads do not leak duplicate handlers.
 *
 * @param node - Target node.
 * @param value - Props object or reactive props object.
 * @returns void.
 *
 * @example
 * ```ts
 * html`<button ...${{ type: "button", onClick: save }}>Save</button>`
 * ```
 */
export function bindSpreadPart(node: Node, value: RenderValue | undefined): void {
  if (!isDomElement(node)) {
    return;
  }

  let state: SpreadBindingState = createSpreadBindingState();

  const update = (): void => {
    state = applySpreadValue(node, readValue(value) as unknown, state);
  };

  const dispose = hasReactiveValue(value) ? effect(update, { name: "fabrica.spreadBinding" }) : (update(), null);

  if (dispose) {
    registerCleanup(node, dispose);
  }

  registerCleanup(node, () => {
    cleanupSpreadState(node, state);
  });
}

export function applySpreadValue(element: Element, value: unknown, previous: SpreadBindingState): SpreadBindingState {
  previous = ensureSpreadBindingState(previous);

  if (!value || typeof value !== "object") {
    cleanupSpreadState(element, previous);
    previous.keys.clear();
    previous.values!.clear();
    return previous;
  }

  const props = value as Record<string, unknown>;
  const eventVersion = ++spreadEventDiffVersion;

  for (const key of previous.keys) {
    if (!(key in props)) {
      removeSpreadProperty(element, key, previous);
      previous.values!.delete(key);
      previous.keys.delete(key);
    }
  }

  for (const key in props) {
    const propValue = props[key];
    previous.keys.add(key);

    if (canSkipSpreadProperty(key) && Object.is(previous.values!.get(key), propValue)) {
      continue;
    }

    previous.values!.set(key, propValue);
    applySpreadProperty(element, key, propValue, previous, previous, eventVersion);
  }

  for (const [eventName, listener] of previous.events) {
    if (previous.eventVersions!.get(eventName) === eventVersion) continue;
    const cleanup = previous.eventCleanups!.get(eventName);
    if (cleanup) cleanup();
    else element.removeEventListener(eventName, listener);
    previous.events.delete(eventName);
    previous.eventCleanups!.delete(eventName);
    previous.eventVersions?.delete(eventName);
  }

  return previous;
}

export function cleanupSpreadState(element: Element, state: SpreadBindingState): void {
  state = ensureSpreadBindingState(state);

  for (const [eventName, listener] of state.events) {
    const cleanup = state.eventCleanups!.get(eventName);
    if (cleanup) cleanup();
    else element.removeEventListener(eventName, listener);
  }

  state.events.clear();
  state.eventCleanups!.clear();
  state.eventVersions!.clear();
  state.values!.clear();
  state.keys.clear();
  state.refCleanup?.();
  state.refCleanup = null;
}

export function applySpreadProperty(
  element: Element,
  key: string,
  propValue: unknown,
  previous: SpreadBindingState,
  next: SpreadBindingState,
  eventVersion = spreadEventDiffVersion,
): void {
  if (key === "children") {
    return;
  }

  if (applySpecialAttribute(element, key, propValue, createSpecialAttributeState())) {
    return;
  }

  if (key === "class" || key === "className") {
    const className = stringifyAttributeValue("class", propValue);
    if (className) element.setAttribute("class", className);
    else element.removeAttribute("class");
    return;
  }

  if (key === "style") {
    const styleText = stringifyAttributeValue("style", propValue);
    if (styleText) element.setAttribute("style", styleText);
    else element.removeAttribute("style");
    return;
  }

  if (key === "attrs" && propValue && typeof propValue === "object") {
    const attrs = propValue as Record<string, unknown>;
    for (const attrName in attrs) setPropertyOrAttribute(element, attrName, attrs[attrName]);
    return;
  }

  if (key === "dataset" && propValue && typeof propValue === "object" && element instanceof HTMLElement) {
    const dataset = propValue as Record<string, unknown>;
    for (const dataName in dataset) {
      const item = dataset[dataName];
      if (item == null) delete element.dataset[dataName];
      else element.dataset[dataName] = String(item);
    }
    return;
  }

  if (key === "ref") {
    previous.refCleanup?.();
    previous.refCleanup = null;

    if (typeof propValue === "function") {
      const cleanup = (propValue as (node: Element) => void | (() => void))(element);
      next.refCleanup = typeof cleanup === "function" ? cleanup : null;
    } else if (propValue && typeof propValue === "object" && "current" in (propValue as Record<string, unknown>)) {
      (propValue as { current: Element | null }).current = element;
    }
    return;
  }

  if (key === "on" && propValue && typeof propValue === "object") {
    const events = propValue as Record<string, unknown>;
    for (const eventName in events) setSpreadEvent(element, eventName, events[eventName], previous, next, eventVersion);
    return;
  }

  if (key.startsWith("@")) {
    setSpreadEvent(element, key.slice(1), propValue, previous, next, eventVersion);
    return;
  }

  if (key.startsWith("on") && typeof propValue === "function") {
    setSpreadEvent(element, key.slice(2).toLowerCase(), propValue, previous, next, eventVersion);
    return;
  }

  setPropertyOrAttribute(element, key, propValue);
}

export function setSpreadEvent(
  element: Element,
  rawEventName: string,
  listener: unknown,
  previous: SpreadBindingState,
  next: SpreadBindingState,
  eventVersion = spreadEventDiffVersion,
): void {
  const dotIndex = rawEventName.indexOf(".");
  const eventName = dotIndex < 0 ? rawEventName : rawEventName.slice(0, dotIndex);
  const previousListener = previous.events.get(eventName);

  if (typeof listener !== "function") {
    const cleanup = previous.eventCleanups!.get(eventName);
    if (cleanup) cleanup();
    else if (previousListener) element.removeEventListener(eventName, previousListener);
    next.events.delete(eventName);
    next.eventCleanups!.delete(eventName);
    next.eventVersions!.delete(eventName);
    return;
  }

  const nextListener = listener as EventListener;

  if (previousListener !== nextListener) {
    const cleanup = previous.eventCleanups!.get(eventName);
    if (cleanup) cleanup();
    else if (previousListener) element.removeEventListener(eventName, previousListener);
    next.eventCleanups!.set(
      eventName,
      bindEvent(element, rawEventName, nextListener as unknown as RenderValue, false),
    );
  }

  next.events.set(eventName, nextListener);
  next.eventVersions!.set(eventName, eventVersion);
}

function createSpreadBindingState(): SpreadBindingState {
  return {
    keys: new Set<string>(),
    values: new Map<string, unknown>(),
    events: new Map<string, EventListener>(),
    eventCleanups: new Map<string, () => void>(),
    eventVersions: new Map<string, number>(),
    refCleanup: null,
  };
}

function ensureSpreadBindingState(state: SpreadBindingState): SpreadBindingState {
  state.values ??= new Map<string, unknown>();
  state.eventCleanups ??= new Map<string, () => void>();
  state.eventVersions ??= new Map<string, number>();
  return state;
}

function canSkipSpreadProperty(key: string): boolean {
  return key !== "ref" && key !== "attrs" && key !== "dataset" && key !== "on" && !key.startsWith("@") && !(key.startsWith("on") && key.length > 2);
}

export function removeSpreadProperty(element: Element, key: string, previous: SpreadBindingState): void {
  if (key === "class" || key === "className") {
    element.removeAttribute("class");
    return;
  }

  if (key === "style") {
    element.removeAttribute("style");
    return;
  }

  if (key === "ref") {
    previous.refCleanup?.();
    previous.refCleanup = null;
    return;
  }

  if (key.startsWith("on") || key.startsWith("@")) {
    const rawEventName = key.startsWith("@") ? key.slice(1) : key.slice(2).toLowerCase();
    const dotIndex = rawEventName.indexOf(".");
    const eventName = dotIndex < 0 ? rawEventName : rawEventName.slice(0, dotIndex);
    const listener = previous.events.get(eventName);
    const cleanup = previous.eventCleanups?.get(eventName);
    if (cleanup) cleanup();
    else if (listener) element.removeEventListener(eventName, listener);
    previous.events.delete(eventName);
    previous.eventCleanups?.delete(eventName);
    previous.eventVersions?.delete(eventName);
    return;
  }

  if (!key.startsWith("data-") && !key.startsWith("aria-") && key in element && typeof (element as unknown as Record<string, unknown>)[key] === "boolean") {
    (element as unknown as Record<string, unknown>)[key] = false;
  }

  element.removeAttribute(key);
}

