import { effect } from "@rodkisten/broto/reactivity";
import { hasReactiveValue, readValue } from "../core/value.js";
import { registerCleanup } from "../render/cleanup.js";

const BOOLEAN_PROPERTY_NAMES = new Set([
  "allowFullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "draggable",
  "formNoValidate",
  "hidden",
  "indeterminate",
  "inert",
  "loop",
  "multiple",
  "muted",
  "noModule",
  "noValidate",
  "open",
  "playsInline",
  "readOnly",
  "required",
  "reversed",
  "selected",
  "spellcheck",
  "translate",
]);

/**
 * Applies the object-prop convention used by Fábrica payloads and prop patches.
 *
 * Prefixed keys preserve the same semantics as template bindings so component
 * payloads and spreads cannot accidentally turn `.property`, `?boolean`, or
 * `class:*` instructions into literal DOM attribute names.
 */
export function setPropertyOrAttribute(
  element: Element,
  name: string,
  value: unknown,
): void {
  if (name.startsWith(".")) {
    setElementProperty(element, name.slice(1), value);
    return;
  }

  if (name.startsWith("?")) {
    const attributeName = name.slice(1);
    const enabled = readBooleanLike(value);
    if (enabled) element.setAttribute(attributeName, "");
    else element.removeAttribute(attributeName);
    resetBooleanProperty(element, attributeName, enabled);
    return;
  }

  if (name.startsWith("class:")) {
    element.classList.toggle(name.slice("class:".length), Boolean(value));
    return;
  }

  if (name.startsWith("data-") || name.startsWith("aria-")) {
    if (value == null) element.removeAttribute(name);
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

function setElementProperty(
  element: Element,
  name: string,
  value: unknown,
): void {
  if (!name) return;

  const record = element as unknown as Record<string, unknown>;
  const currentValue = record[name];
  const nextValue =
    typeof currentValue === "boolean" || BOOLEAN_PROPERTY_NAMES.has(name)
      ? readBooleanLike(value)
      : value;

  try {
    record[name] = nextValue;
  } catch {
    // Property instructions never degrade into a literal `.name` attribute.
    // A readonly host property is intentionally ignored, matching direct DOM
    // property assignment semantics without creating an invalid attribute.
  }
}

function readBooleanLike(value: unknown): boolean {
  if (value === "false") return false;
  if (value === "true") return true;
  return Boolean(value);
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
