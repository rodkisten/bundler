import { readValue, stringifyValue } from "../core/value.js";
import { bindEvent } from "../events.js";
import { isRawHtml } from "../guards.js";
import type { RenderValue } from "../types.js";
import {
  applyClassMap,
  applyStyleMap,
  type MapState,
} from "./maps.js";
import {
  setPropertyOrAttribute,
} from "./property-or-attribute.js";
import {
  applySpecialAttribute,
  createSpecialAttributeState,
  isSpecialAttributeName,
  type SpecialAttributeState,
} from "./special.js";

type PropsEventBinding = {
  listener: EventListener;
  cleanup: () => void;
};

type PropsBindingState = {
  classMap: MapState | null;
  styleMap: MapState | null;
  special: Map<string, SpecialAttributeState>;
};

/** Element event cache used by object props. */
const elementEvents = new WeakMap<Element, Map<string, PropsEventBinding>>();

/**
 * Stateful binding metadata for repeated `applyProps()` patches.
 *
 * Weak ownership is intentional: applying object props must not extend an
 * element's lifetime. The DOM node owns the observable state and garbage
 * collection releases the bookkeeping with it.
 */
const elementPropsState = new WeakMap<Element, PropsBindingState>();

/**
 * Applies a patch of object props to an element.
 *
 * Omitted top-level keys are intentionally left unchanged. This is a patch
 * API, not a full props reconciler. Values supplied for stateful keys such as
 * `class`, `style`, and special attributes are reconciled against the previous
 * value for that key. Template spreads use the dedicated spread reconciler,
 * which also owns removal of omitted top-level keys.
 *
 * @param element - Target element.
 * @param props - Props patch.
 *
 * @example
 * ```ts
 * applyProps(button, {
 *   text: "Save",
 *   class: { primary: true },
 *   on: { click: save },
 * });
 * ```
 */
export function applyProps(
  element: Element,
  props: Record<string, unknown>,
): void {
  const state = getPropsBindingState(element);

  for (const key in props) {
    const value = props[key];

    if (isSpecialAttributeName(key)) {
      const specialState = getSpecialAttributeState(state, key);

      if (applySpecialAttribute(element, key, value, specialState)) {
        continue;
      }
    }

    if (key === "text") {
      element.textContent = stringifyValue(readValue(value));
      continue;
    }

    if (key === "html" || key === "unsafeHTML") {
      const resolved = readValue(value);

      if (!isRawHtml(resolved)) {
        throw new TypeError(
          "[Fabrica] HTML props require rawHtml(), trustedHtml(), " +
            "sanitizedHtml(), or unsafeHtml().",
        );
      }

      element.innerHTML = resolved.value;
      continue;
    }

    if (key === "class" || key === "className") {
      state.classMap = applyClassValue(
        element,
        value,
        state.classMap,
      );
      continue;
    }

    if (key === "style") {
      state.styleMap = applyStyleValue(
        element,
        value,
        state.styleMap,
      );
      continue;
    }

    if (key === "attrs") {
      applyAttrs(element, value);
      continue;
    }

    if (key === "dataset") {
      applyDataset(element, value);
      continue;
    }

    if (key === "on") {
      applyEvents(element, value);
      continue;
    }

    setPropertyOrAttribute(element, key, readValue(value));
  }
}

/** Backward-compatible internal export for object prop consumers. */
export { setPropertyOrAttribute };

function getPropsBindingState(element: Element): PropsBindingState {
  let state = elementPropsState.get(element);

  if (!state) {
    state = {
      classMap: null,
      styleMap: null,
      special: new Map<string, SpecialAttributeState>(),
    };
    elementPropsState.set(element, state);
  }

  return state;
}

function getSpecialAttributeState(
  state: PropsBindingState,
  name: string,
): SpecialAttributeState {
  let specialState = state.special.get(name);

  if (!specialState) {
    specialState = createSpecialAttributeState();
    state.special.set(name, specialState);
  }

  return specialState;
}

function applyClassValue(
  element: Element,
  value: unknown,
  state: MapState | null,
): MapState | null {
  const resolved = readValue(value);

  if (Array.isArray(resolved)) {
    let classText = "";

    for (let index = 0; index < resolved.length; index += 1) {
      const item = resolved[index];

      if (item) {
        classText += classText ? ` ${String(item)}` : String(item);
      }
    }

    element.setAttribute("class", classText);
    return null;
  }

  if (
    resolved &&
    typeof resolved === "object" &&
    resolved.constructor === Object
  ) {
    return applyClassMap(
      element,
      resolved as Record<string, unknown>,
      state,
    );
  }

  if (resolved == null || resolved === false) {
    element.removeAttribute("class");
    return null;
  }

  element.setAttribute("class", String(resolved));
  return null;
}

function applyStyleValue(
  element: Element,
  value: unknown,
  state: MapState | null,
): MapState | null {
  const resolved = readValue(value);

  if (
    resolved &&
    typeof resolved === "object" &&
    resolved.constructor === Object
  ) {
    return applyStyleMap(
      element,
      resolved as Record<string, unknown>,
      state,
    );
  }

  if (typeof resolved === "string") {
    element.setAttribute("style", resolved);
    return null;
  }

  if (resolved == null || resolved === false) {
    element.removeAttribute("style");
  }

  return null;
}

function applyAttrs(element: Element, value: unknown): void {
  const resolved = readValue(value);

  if (!resolved || typeof resolved !== "object") {
    return;
  }

  const attrs = resolved as Record<string, unknown>;

  for (const name in attrs) {
    setPropertyOrAttribute(element, name, readValue(attrs[name]));
  }
}

function applyDataset(element: Element, value: unknown): void {
  const resolved = readValue(value);

  if (
    !(element instanceof HTMLElement) ||
    !resolved ||
    typeof resolved !== "object"
  ) {
    return;
  }

  const dataset = resolved as Record<string, unknown>;

  for (const name in dataset) {
    const next = readValue(dataset[name]);

    if (next == null) {
      delete element.dataset[name];
    } else {
      element.dataset[name] = String(next);
    }
  }
}

function applyEvents(element: Element, value: unknown): void {
  const resolved = readValue(value);

  if (!resolved || typeof resolved !== "object") {
    return;
  }

  let map = elementEvents.get(element);

  if (!map) {
    map = new Map<string, PropsEventBinding>();
    elementEvents.set(element, map);
  }

  const events = resolved as Record<string, unknown>;

  for (const eventName in events) {
    const handler = events[eventName];
    const previous = map.get(eventName);

    if (typeof handler !== "function") {
      previous?.cleanup();
      map.delete(eventName);
      continue;
    }

    if (previous?.listener === handler) {
      continue;
    }

    previous?.cleanup();

    const listener = handler as EventListener;
    map.set(eventName, {
      listener,
      cleanup: bindEvent(
        element,
        eventName,
        listener as unknown as RenderValue,
      ),
    });
  }
}
