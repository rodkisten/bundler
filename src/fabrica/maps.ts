import { toKebabCase } from "./css";
import { readValue } from "./value";

/** Previous map keys and values tracked by classMap/styleMap bindings. */
type MapState = {
  keys: Set<string>;
  values: Map<string, unknown>;
};

const kebabCache = new Map<string, string>();
const IMPORTANT_SUFFIX_RE = /\s*!important\s*$/i;

function getKebabName(property: string): string {
  let cssName = kebabCache.get(property);
  if (!cssName) {
    cssName = toKebabCase(property);
    kebabCache.set(property, cssName);
  }
  return cssName;
}

function createMapState(): MapState {
  return { keys: new Set<string>(), values: new Map<string, unknown>() };
}

/**
 * Applies a class map with key and value diffing.
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
  const nextState = state ?? createMapState();
  const keys = nextState.keys;
  const values = nextState.values;
  const classList = element.classList;

  for (const className of keys) {
    if (!(className in map)) {
      classList.remove(className);
      values.delete(className);
      keys.delete(className);
    }
  }

  for (const className in map) {
    const next = Boolean(readValue(map[className]));

    if (keys.has(className) && Object.is(values.get(className), next)) {
      continue;
    }

    keys.add(className);
    values.set(className, next);
    classList.toggle(className, next);
  }

  return nextState;
}

/**
 * Applies a style map with key/value diffing and !important support.
 *
 * @param element - Target element.
 * @param map - Style value map.
 * @param state - Previous state.
 * @returns Next state.
 *
 * @example
 * ```ts
 * state = applyStyleMap(card, { opacity: "0.8", width: "100px !important" }, state);
 * ```
 */
export function applyStyleMap(element: Element, map: Record<string, unknown>, state: MapState | null): MapState {
  const style = (element as HTMLElement).style;
  const nextState = state ?? createMapState();
  const keys = nextState.keys;
  const values = nextState.values;

  for (const property of keys) {
    if (!(property in map)) {
      style.removeProperty(getKebabName(property));
      values.delete(property);
      keys.delete(property);
    }
  }

  for (const property in map) {
    const value = readValue(map[property]);
    const normalized = normalizeStyleValue(value);
    const signature = normalized ? `${normalized.value}!${normalized.priority}` : null;

    if (keys.has(property) && Object.is(values.get(property), signature)) {
      continue;
    }

    keys.add(property);
    values.set(property, signature);

    const cssName = getKebabName(property);
    if (!normalized) {
      style.removeProperty(cssName);
      continue;
    }

    style.setProperty(cssName, normalized.value, normalized.priority);
  }

  return nextState;
}

/**
 * Normalizes style-map values into DOM setProperty pieces.
 *
 * @param value - Raw style value.
 * @returns Normalized value or null for removal.
 */
function normalizeStyleValue(value: unknown): { value: string; priority: "" | "important" } | null {
  if (value == null || value === false) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  if (IMPORTANT_SUFFIX_RE.test(text)) {
    return { value: text.replace(IMPORTANT_SUFFIX_RE, "").trim(), priority: "important" };
  }

  return { value: text, priority: "" };
}
