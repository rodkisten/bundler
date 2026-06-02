import { applyClassMap, applyStyleMap } from "@/maps";
import { readValue, stringifyValue } from "@/value";

/** Element event cache used by object props. */
const elementEvents = new WeakMap<Element, Map<string, EventListener>>();

/**
 * Applies object props to an element.
 *
 * @param element - Target element.
 * @param props - Props object.
 *
 * @example
 * ```ts
 * applyProps(button, { text: "Save", class: "primary", on: { click: save } });
 * ```
 */
export function applyProps(element: Element, props: Record<string, unknown>): void {
  for (const key in props) {
    const value = props[key];

    if (key === "text") {
      element.textContent = stringifyValue(readValue(value));
      continue;
    }

    if (key === "html" || key === "unsafeHTML") {
      element.innerHTML = stringifyValue(readValue(value));
      continue;
    }

    if (key === "class" || key === "className") {
      applyClassValue(element, value);
      continue;
    }

    if (key === "style") {
      applyStyleValue(element, value);
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

/**
 * Sets a property when safe, otherwise sets an attribute.
 *
 * @param element - Target element.
 * @param name - Property or attribute name.
 * @param value - Value.
 */
export function setPropertyOrAttribute(element: Element, name: string, value: unknown): void {
  if (value == null || value === false) {
    element.removeAttribute(name);

    if (name in element && typeof (element as unknown as Record<string, unknown>)[name] === "boolean") {
      (element as unknown as Record<string, unknown>)[name] = false;
    }

    return;
  }

  if (value === true) {
    element.setAttribute(name, "");

    if (name in element && typeof (element as unknown as Record<string, unknown>)[name] === "boolean") {
      (element as unknown as Record<string, unknown>)[name] = true;
    }

    return;
  }

  if (!name.startsWith("data-") && !name.startsWith("aria-") && name in element) {
    try {
      (element as unknown as Record<string, unknown>)[name] = value;
      return;
    } catch {
      element.setAttribute(name, String(value));
      return;
    }
  }

  element.setAttribute(name, String(value));
}

function applyClassValue(element: Element, value: unknown): void {
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
    return;
  }

  if (resolved && typeof resolved === "object" && resolved.constructor === Object) {
    applyClassMap(element, resolved as Record<string, unknown>, null);
    return;
  }

  if (resolved == null || resolved === false) {
    element.removeAttribute("class");
    return;
  }

  element.setAttribute("class", String(resolved));
}

function applyStyleValue(element: Element, value: unknown): void {
  const resolved = readValue(value);

  if (resolved && typeof resolved === "object" && resolved.constructor === Object) {
    applyStyleMap(element, resolved as Record<string, unknown>, null);
    return;
  }

  if (typeof resolved === "string") {
    element.setAttribute("style", resolved);
  }
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

  if (!(element instanceof HTMLElement) || !resolved || typeof resolved !== "object") {
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
    map = new Map<string, EventListener>();
    elementEvents.set(element, map);
  }

  const events = resolved as Record<string, unknown>;

  for (const eventName in events) {
    const handler = events[eventName];

    if (typeof handler !== "function") {
      continue;
    }

    const previous = map.get(eventName);

    if (previous) {
      element.removeEventListener(eventName, previous);
    }

    element.addEventListener(eventName, handler as EventListener);
    map.set(eventName, handler as EventListener);
  }
}
