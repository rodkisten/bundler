import { toKebabCase } from "@/css";
import { readValue } from "@/value";

/** Previous map keys tracked by classMap/styleMap bindings. */
type MapState = {
  keys: Set<string>;
};

/**
 * Applies a class map with key diffing.
 *
 * @param element - Target element.
 * @param map - Class boolean map.
 * @param state - Previous state.
 * @returns Next state.
 *
 * @example
 * ```ts
 * state = applyClassMap(button, { active: true, muted: false }, state);
 * ```
 */
export function applyClassMap(element: Element, map: Record<string, unknown>, state: MapState | null): MapState {
  const previousKeys = state?.keys ?? new Set<string>();
  const nextKeys = new Set<string>();

  for (const className in map) {
    nextKeys.add(className);
  }

  for (const className of previousKeys) {
    if (!nextKeys.has(className)) {
      element.classList.remove(className);
    }
  }

  for (const className of nextKeys) {
    element.classList.toggle(className, Boolean(readValue(map[className])));
  }

  return { keys: nextKeys };
}

/**
 * Applies a style map with key diffing.
 *
 * @param element - Target element.
 * @param map - Style value map.
 * @param state - Previous state.
 * @returns Next state.
 *
 * @example
 * ```ts
 * state = applyStyleMap(card, { opacity: "0.8" }, state);
 * ```
 */
export function applyStyleMap(element: Element, map: Record<string, unknown>, state: MapState | null): MapState {
  const style = (element as HTMLElement).style;
  const previousKeys = state?.keys ?? new Set<string>();
  const nextKeys = new Set<string>();

  for (const property in map) {
    nextKeys.add(property);
  }

  for (const property of previousKeys) {
    if (!nextKeys.has(property)) {
      style.removeProperty(toKebabCase(property));
    }
  }

  for (const property of nextKeys) {
    const cssName = toKebabCase(property);
    const value = readValue(map[property]);

    if (value == null || value === false) {
      style.removeProperty(cssName);
      continue;
    }

    style.setProperty(cssName, String(value));
  }

  return { keys: nextKeys };
}
