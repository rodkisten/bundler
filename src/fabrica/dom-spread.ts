import { effect } from "../broto/reactivity";
import { registerCleanup } from "./dom-cleanup";
import { isDomElement } from "./guards";
import { setPropertyOrAttribute } from "./props";
import { stringifyAttributeValue } from "./dom-payload";
import { hasReactiveValue, readValue } from "./value";
import type { RenderValue } from "./types";

export type SpreadBindingState = {
  keys: Set<string>;
  events: Map<string, EventListener>;
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

  let state: SpreadBindingState = { keys: new Set<string>(), events: new Map<string, EventListener>(), refCleanup: null };

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
  const next: SpreadBindingState = { keys: new Set<string>(), events: new Map<string, EventListener>(), refCleanup: previous.refCleanup };

  if (!value || typeof value !== "object") {
    cleanupSpreadState(element, previous);
    return next;
  }

  const props = value as Record<string, unknown>;

  for (const key of previous.keys) {
    if (!(key in props)) {
      removeSpreadProperty(element, key, previous);
    }
  }

  for (const key in props) {
    next.keys.add(key);
    applySpreadProperty(element, key, props[key], previous, next);
  }

  for (const [eventName, listener] of previous.events) {
    if (!next.events.has(eventName)) {
      element.removeEventListener(eventName, listener);
    }
  }

  return next;
}

export function cleanupSpreadState(element: Element, state: SpreadBindingState): void {
  for (const [eventName, listener] of state.events) {
    element.removeEventListener(eventName, listener);
  }

  state.events.clear();
  state.refCleanup?.();
  state.refCleanup = null;
}

export function applySpreadProperty(
  element: Element,
  key: string,
  propValue: unknown,
  previous: SpreadBindingState,
  next: SpreadBindingState,
): void {
  if (key === "children") {
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
    for (const eventName in events) setSpreadEvent(element, eventName, events[eventName], previous, next);
    return;
  }

  if (key.startsWith("@")) {
    setSpreadEvent(element, key.slice(1), propValue, previous, next);
    return;
  }

  if (key.startsWith("on") && typeof propValue === "function") {
    setSpreadEvent(element, key.slice(2).toLowerCase(), propValue, previous, next);
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
): void {
  const eventName = rawEventName.split(".", 1)[0] || rawEventName;
  const previousListener = previous.events.get(eventName);

  if (typeof listener !== "function") {
    if (previousListener) element.removeEventListener(eventName, previousListener);
    return;
  }

  const nextListener = listener as EventListener;

  if (previousListener !== nextListener) {
    if (previousListener) element.removeEventListener(eventName, previousListener);
    element.addEventListener(eventName, nextListener);
  }

  next.events.set(eventName, nextListener);
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

  if (key.startsWith("on")) {
    const eventName = key.slice(2).toLowerCase();
    const listener = previous.events.get(eventName);
    if (listener) element.removeEventListener(eventName, listener);
    previous.events.delete(eventName);
    return;
  }

  if (!key.startsWith("data-") && !key.startsWith("aria-") && key in element && typeof (element as unknown as Record<string, unknown>)[key] === "boolean") {
    (element as unknown as Record<string, unknown>)[key] = false;
  }

  element.removeAttribute(key);
}

