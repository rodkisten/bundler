import { effect } from "../broto/reactivity";
import { registerCleanup } from "./dom-cleanup";
import { isDomElement } from "./guards";
import { setPropertyOrAttribute } from "./props";
import { stringifyAttributeValue } from "./dom-payload";
import { hasReactiveValue, readValue } from "./value";
import type { RenderValue } from "./types";

let spreadEventDiffVersion = 0;

export type SpreadBindingState = {
  keys: Set<string>;
  values: Map<string, unknown>;
  events: Map<string, EventListener>;
  eventVersions: Map<string, number>;
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
  if (!value || typeof value !== "object") {
    cleanupSpreadState(element, previous);
    previous.keys.clear();
    previous.values.clear();
    return previous;
  }

  const props = value as Record<string, unknown>;
  const eventVersion = ++spreadEventDiffVersion;

  for (const key of previous.keys) {
    if (!(key in props)) {
      removeSpreadProperty(element, key, previous);
      previous.values.delete(key);
      previous.keys.delete(key);
    }
  }

  for (const key in props) {
    const propValue = props[key];
    previous.keys.add(key);

    if (canSkipSpreadProperty(key) && Object.is(previous.values.get(key), propValue)) {
      continue;
    }

    previous.values.set(key, propValue);
    applySpreadProperty(element, key, propValue, previous, previous, eventVersion);
  }

  for (const [eventName, listener] of previous.events) {
    if (previous.eventVersions.get(eventName) === eventVersion) continue;
    element.removeEventListener(eventName, listener);
    previous.events.delete(eventName);
    previous.eventVersions.delete(eventName);
  }

  return previous;
}

export function cleanupSpreadState(element: Element, state: SpreadBindingState): void {
  for (const [eventName, listener] of state.events) {
    element.removeEventListener(eventName, listener);
  }

  state.events.clear();
  state.eventVersions.clear();
  state.values.clear();
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
    if (previousListener) element.removeEventListener(eventName, previousListener);
    next.events.delete(eventName);
    next.eventVersions.delete(eventName);
    return;
  }

  const nextListener = listener as EventListener;

  if (previousListener !== nextListener) {
    if (previousListener) element.removeEventListener(eventName, previousListener);
    element.addEventListener(eventName, nextListener);
  }

  next.events.set(eventName, nextListener);
  next.eventVersions.set(eventName, eventVersion);
}

function createSpreadBindingState(): SpreadBindingState {
  return {
    keys: new Set<string>(),
    values: new Map<string, unknown>(),
    events: new Map<string, EventListener>(),
    eventVersions: new Map<string, number>(),
    refCleanup: null,
  };
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

  if (key.startsWith("on")) {
    const eventName = key.slice(2).toLowerCase();
    const listener = previous.events.get(eventName);
    if (listener) element.removeEventListener(eventName, listener);
    previous.events.delete(eventName);
    previous.eventVersions.delete(eventName);
    return;
  }

  if (!key.startsWith("data-") && !key.startsWith("aria-") && key in element && typeof (element as unknown as Record<string, unknown>)[key] === "boolean") {
    (element as unknown as Record<string, unknown>)[key] = false;
  }

  element.removeAttribute(key);
}

