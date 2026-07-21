import { effect } from "@rodkisten/broto/reactivity";
import { hasReactiveValue, readValue } from "../core/value.js";
import { registerCleanup } from "../render/cleanup.js";

/**
 * Applies the object-prop convention used by Fábrica payloads and prop patches.
 *
 * Native properties win when they exist on the target element. Data/ARIA names
 * always remain attributes, while boolean properties mirror their presence to
 * the corresponding attribute for predictable DOM serialization.
 */
export function setPropertyOrAttribute(
  element: Element,
  name: string,
  value: unknown,
): void {
  if (name.startsWith("data-") || name.startsWith("aria-")) {
    if (value == null || value === false) element.removeAttribute(name);
    else element.setAttribute(name, String(value));
    return;
  }

  if (value == null || value === false) {
    element.removeAttribute(name);
    resetBooleanProperty(element, name, false);
    return;
  }

  if (value === true) {
    element.setAttribute(name, "");
    resetBooleanProperty(element, name, true);
    return;
  }

  if (name in element) {
    try {
      (element as unknown as Record<string, unknown>)[name] = value;
      return;
    } catch {
      // Some host objects expose readonly or throwing setters. Attribute
      // fallback preserves the permissive DOM-prop behavior expected here.
    }
  }

  element.setAttribute(name, String(value));
}

/**
 * Reactively applies a property-or-attribute value owned by an element.
 *
 * Event handlers and refs must be dispatched before this function because an
 * ordinary function is intentionally treated as a reactive expression here.
 */
export function bindPropertyOrAttributeValue(
  element: Element,
  name: string,
  value: unknown,
): void {
  const update = (): void => {
    setPropertyOrAttribute(element, name, readValue(value));
  };

  if (!hasReactiveValue(value)) {
    update();
    return;
  }

  registerCleanup(
    element,
    effect(update, {
      name: `fabrica.propertyOrAttribute.${name}`,
      scheduler: "sync",
    }),
  );
}

function resetBooleanProperty(
  element: Element,
  name: string,
  value: boolean,
): void {
  if (!(name in element)) return;

  const record = element as unknown as Record<string, unknown>;
  if (typeof record[name] !== "boolean") return;
  record[name] = value;
}
