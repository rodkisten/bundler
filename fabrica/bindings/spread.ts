import { effect } from "@rodkisten/broto/reactivity";
import { applyRefBinding } from "./ref.js";
import { stringifyAttributeValue } from "./serialize.js";
import {
  applySpecialAttribute,
  clearSpecialAttributeState,
  createSpecialAttributeState,
  isSpecialAttributeName,
  type SpecialAttributeState,
} from "./special.js";
import { registerCleanup } from "../render/cleanup.js";
import { bindEvent } from "../events.js";
import { isDomElement } from "../guards.js";
import { setPropertyOrAttribute } from "./property-or-attribute.js";
import { hasReactiveValue, readValue } from "../core/value.js";
import type { RenderValue } from "../types.js";

let spreadEventDiffVersion = 0;

/** Stateful reconciliation data for a single spread binding. */
export type SpreadBindingState = {
  keys: Set<string>;
  values?: Map<string, unknown>;
  events: Map<string, EventListener>;
  eventCleanups?: Map<string, () => void>;
  eventVersions?: Map<string, number>;
  eventSources?: Map<string, string>;
  refCleanup: (() => void) | null;
  attrs?: Set<string>;
  dataset?: Set<string>;
  special?: Map<string, SpecialAttributeState>;
};

/**
 * Binds `<element ...${props}>` with reactive object-level reconciliation.
 *
 * The state tracks nested `attrs`, `dataset`, events, refs, and special
 * attributes. Removing a top-level spread key therefore reverses all DOM state
 * created by that key instead of leaving stale nested attributes behind.
 */
export function bindSpreadPart(
  node: Node,
  value: RenderValue | undefined,
): void {
  if (!isDomElement(node)) return;

  let state = createSpreadBindingState();
  const update = (): void => {
    state = applySpreadValue(node, readValue(value), state);
  };

  const dispose = hasReactiveValue(value)
    ? effect(update, {
        name: "fabrica.spreadBinding",
        scheduler: "sync",
      })
    : (update(), null);

  if (dispose) registerCleanup(node, dispose);
  registerCleanup(node, () => cleanupSpreadState(node, state));
}

/** Applies one spread snapshot and removes state absent from the next snapshot. */
export function applySpreadValue(
  element: Element,
  value: unknown,
  previous: SpreadBindingState,
): SpreadBindingState {
  const state = ensureSpreadBindingState(previous);

  if (!value || typeof value !== "object") {
    cleanupSpreadState(element, state);
    return state;
  }

  const props = value as Record<string, unknown>;
  const eventVersion = ++spreadEventDiffVersion;

  for (const key of Array.from(state.keys)) {
    if (key in props) continue;
    removeSpreadProperty(element, key, state);
    state.values!.delete(key);
    state.keys.delete(key);
  }

  for (const key in props) {
    const nextValue = props[key];
    state.keys.add(key);

    if (
      canSkipSpreadProperty(key) &&
      Object.is(state.values!.get(key), nextValue)
    ) {
      continue;
    }

    state.values!.set(key, nextValue);
    applySpreadProperty(
      element,
      key,
      nextValue,
      state,
      state,
      eventVersion,
    );
  }

  removeStaleSpreadEvents(element, state, eventVersion);
  return state;
}

/** Fully disposes the DOM state owned by a spread binding. */
export function cleanupSpreadState(
  element: Element,
  state: SpreadBindingState,
): void {
  state = ensureSpreadBindingState(state);

  for (const cleanup of state.eventCleanups!.values()) cleanup();
  state.events.clear();
  state.eventCleanups!.clear();
  state.eventVersions!.clear();
  state.eventSources!.clear();

  state.refCleanup?.();
  state.refCleanup = null;

  clearTrackedAttributes(element, state);
  clearTrackedDataset(element, state);

  for (const specialState of state.special!.values()) {
    clearSpecialAttributeState(element, specialState);
  }
  state.special!.clear();
  state.values!.clear();
  state.keys.clear();
}

/** Applies one spread prop using the shared Fábrica prop vocabulary. */
export function applySpreadProperty(
  element: Element,
  key: string,
  propValue: unknown,
  previous: SpreadBindingState,
  next: SpreadBindingState,
  eventVersion = spreadEventDiffVersion,
): void {
  previous = ensureSpreadBindingState(previous);
  next = ensureSpreadBindingState(next);

  if (key === "children") return;

  if (isSpecialAttributeName(key)) {
    const specialState =
      next.special!.get(key) ?? createSpecialAttributeState();
    next.special!.set(key, specialState);
    applySpecialAttribute(element, key, propValue, specialState);
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

  if (key === "attrs") {
    reconcileSpreadAttributes(element, propValue, next);
    return;
  }

  if (key === "dataset") {
    reconcileSpreadDataset(element, propValue, next);
    return;
  }

  if (key === "ref") {
    previous.refCleanup?.();
    next.refCleanup = applyRefBinding(element, propValue);
    return;
  }

  if (key === "on") {
    reconcileEventMap(
      element,
      propValue,
      previous,
      next,
      eventVersion,
    );
    return;
  }

  if (key.startsWith("@")) {
    setSpreadEvent(
      element,
      key.slice(1),
      propValue,
      previous,
      next,
      eventVersion,
      key,
    );
    return;
  }

  if (key.startsWith("on") && key.length > 2) {
    setSpreadEvent(
      element,
      key.slice(2).toLowerCase(),
      propValue,
      previous,
      next,
      eventVersion,
      key,
    );
    return;
  }

  setPropertyOrAttribute(element, key, propValue);
}

/** Reconciles a single spread event listener. */
export function setSpreadEvent(
  element: Element,
  rawEventName: string,
  listener: unknown,
  previous: SpreadBindingState,
  next: SpreadBindingState,
  eventVersion = spreadEventDiffVersion,
  source = rawEventName,
): void {
  previous = ensureSpreadBindingState(previous);
  next = ensureSpreadBindingState(next);

  const bindingKey = `${source}\u0000${rawEventName}`;
  const previousListener = previous.events.get(bindingKey);

  if (typeof listener !== "function") {
    previous.eventCleanups!.get(bindingKey)?.();
    next.events.delete(bindingKey);
    next.eventCleanups!.delete(bindingKey);
    next.eventVersions!.delete(bindingKey);
    next.eventSources!.delete(bindingKey);
    return;
  }

  const nextListener = listener as EventListener;
  if (previousListener !== nextListener) {
    previous.eventCleanups!.get(bindingKey)?.();
    next.eventCleanups!.set(
      bindingKey,
      bindEvent(
        element,
        rawEventName,
        nextListener as unknown as RenderValue,
        false,
      ),
    );
  }

  next.events.set(bindingKey, nextListener);
  next.eventVersions!.set(bindingKey, eventVersion);
  next.eventSources!.set(bindingKey, source);
}

/** Removes a top-level spread prop and all nested state owned by that prop. */
export function removeSpreadProperty(
  element: Element,
  key: string,
  previous: SpreadBindingState,
): void {
  previous = ensureSpreadBindingState(previous);

  if (key === "class" || key === "className") {
    element.removeAttribute("class");
    return;
  }

  if (key === "style") {
    element.removeAttribute("style");
    return;
  }

  if (key === "attrs") {
    clearTrackedAttributes(element, previous);
    return;
  }

  if (key === "dataset") {
    clearTrackedDataset(element, previous);
    return;
  }

  if (key === "ref") {
    previous.refCleanup?.();
    previous.refCleanup = null;
    return;
  }

  if (isSpecialAttributeName(key)) {
    const state = previous.special!.get(key);
    if (state) clearSpecialAttributeState(element, state);
    previous.special!.delete(key);
    return;
  }

  if (key === "on" || key.startsWith("on") || key.startsWith("@")) {
    removeEventsFromSource(previous, key);
    return;
  }

  if (
    !key.startsWith("data-") &&
    !key.startsWith("aria-") &&
    key in element &&
    typeof (element as unknown as Record<string, unknown>)[key] === "boolean"
  ) {
    (element as unknown as Record<string, unknown>)[key] = false;
  }

  element.removeAttribute(key);
}

function createSpreadBindingState(): SpreadBindingState {
  return ensureSpreadBindingState({
    keys: new Set<string>(),
    events: new Map<string, EventListener>(),
    refCleanup: null,
  });
}

function ensureSpreadBindingState(
  state: SpreadBindingState,
): SpreadBindingState {
  state.values ??= new Map<string, unknown>();
  state.eventCleanups ??= new Map<string, () => void>();
  state.eventVersions ??= new Map<string, number>();
  state.eventSources ??= new Map<string, string>();
  state.attrs ??= new Set<string>();
  state.dataset ??= new Set<string>();
  state.special ??= new Map<string, SpecialAttributeState>();
  return state;
}

function reconcileSpreadAttributes(
  element: Element,
  value: unknown,
  state: SpreadBindingState,
): void {
  const nextNames = new Set<string>();
  if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      nextNames.add(name);
      setPropertyOrAttribute(element, name, readValue(item));
    }
  }

  for (const name of state.attrs!) {
    if (!nextNames.has(name)) removeNestedAttribute(element, name);
  }
  state.attrs = nextNames;
}

function reconcileSpreadDataset(
  element: Element,
  value: unknown,
  state: SpreadBindingState,
): void {
  if (!(element instanceof HTMLElement)) return;

  const nextNames = new Set<string>();
  if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      nextNames.add(name);
      const resolved = readValue(item);
      if (resolved == null) delete element.dataset[name];
      else element.dataset[name] = String(resolved);
    }
  }

  for (const name of state.dataset!) {
    if (!nextNames.has(name)) delete element.dataset[name];
  }
  state.dataset = nextNames;
}

function reconcileEventMap(
  element: Element,
  value: unknown,
  previous: SpreadBindingState,
  next: SpreadBindingState,
  eventVersion: number,
): void {
  if (!value || typeof value !== "object") {
    removeEventsFromSource(previous, "on");
    return;
  }

  for (const [eventName, listener] of Object.entries(
    value as Record<string, unknown>,
  )) {
    setSpreadEvent(
      element,
      eventName,
      listener,
      previous,
      next,
      eventVersion,
      "on",
    );
  }
}

function removeStaleSpreadEvents(
  element: Element,
  state: SpreadBindingState,
  eventVersion: number,
): void {
  void element;
  for (const key of Array.from(state.events.keys())) {
    if (state.eventVersions!.get(key) === eventVersion) continue;
    state.eventCleanups!.get(key)?.();
    state.events.delete(key);
    state.eventCleanups!.delete(key);
    state.eventVersions!.delete(key);
    state.eventSources!.delete(key);
  }
}

function removeEventsFromSource(
  state: SpreadBindingState,
  source: string,
): void {
  for (const [key, eventSource] of Array.from(state.eventSources!)) {
    if (eventSource !== source) continue;
    state.eventCleanups!.get(key)?.();
    state.events.delete(key);
    state.eventCleanups!.delete(key);
    state.eventVersions!.delete(key);
    state.eventSources!.delete(key);
  }
}

function clearTrackedAttributes(
  element: Element,
  state: SpreadBindingState,
): void {
  for (const name of state.attrs!) removeNestedAttribute(element, name);
  state.attrs!.clear();
}

function clearTrackedDataset(
  element: Element,
  state: SpreadBindingState,
): void {
  if (element instanceof HTMLElement) {
    for (const name of state.dataset!) delete element.dataset[name];
  }
  state.dataset!.clear();
}

function removeNestedAttribute(element: Element, name: string): void {
  if (
    !name.startsWith("data-") &&
    !name.startsWith("aria-") &&
    name in element &&
    typeof (element as unknown as Record<string, unknown>)[name] === "boolean"
  ) {
    (element as unknown as Record<string, unknown>)[name] = false;
  }
  element.removeAttribute(name);
}

function canSkipSpreadProperty(key: string): boolean {
  return (
    key !== "ref" &&
    key !== "attrs" &&
    key !== "dataset" &&
    key !== "on" &&
    !isSpecialAttributeName(key) &&
    !key.startsWith("@") &&
    !(key.startsWith("on") && key.length > 2)
  );
}
