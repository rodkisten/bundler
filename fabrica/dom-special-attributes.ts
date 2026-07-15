import { effect } from "@rodkisten/broto/reactivity";
import { compileInlineCss } from "@rodkisten/cipo/compiler-inline-compile";
import { registerCleanup } from "@rodkisten/fabrica/dom-cleanup";
import { hasReactiveValue, readValue } from "@rodkisten/fabrica/value";

const LITERAL_DATA_ATTRIBUTE_PREFIX = "__fabrica_literal_data__";

export type SpecialAttributeState = {
  dataNames: Set<string>;
  styleNames: Set<string>;
};

export function createSpecialAttributeState(): SpecialAttributeState {
  return { dataNames: new Set(), styleNames: new Set() };
}

export function isSpecialAttributeName(name: string): boolean {
  return name === "$css" || name === "$style" || name.startsWith(":") || (name.startsWith("[") && name.endsWith("]"));
}

export function bindSpecialAttribute(element: Element, name: string, value: unknown): boolean {
  if (!isSpecialAttributeName(name)) return false;

  const state = createSpecialAttributeState();
  const update = (): void => {
    applySpecialAttribute(element, name, readValueDeep(value), state);
  };
  let dispose: (() => void) | null = null;
  if (hasDeepReactiveValue(value)) {
    dispose = effect(update, { name: `fabrica.specialAttribute.${name}`, scheduler: "sync" });
  } else {
    update();
  }

  if (dispose) registerCleanup(element, dispose);
  registerCleanup(element, () => clearSpecialAttribute(element, state));
  return true;
}

export function applySpecialAttribute(
  element: Element,
  name: string,
  value: unknown,
  state: SpecialAttributeState = createSpecialAttributeState(),
): boolean {
  // Never resolve ordinary props here. Event handlers, refs and callbacks are
  // functions too, and resolving them as reactive expressions invokes them
  // during render with no Event/Node argument. Only special attributes own the
  // deep-value semantics implemented by this module.
  if (!isSpecialAttributeName(name)) return false;

  value = readValueDeep(value);

  if (name === "$css" || name === "$style") {
    applyCipoInlineStyle(element, value);
    return true;
  }

  if (name.startsWith(":")) {
    applyDataAttribute(element, name.slice(1), value, state);
    return true;
  }

  if (name.startsWith("[") && name.endsWith("]")) {
    applyStyleProperty(element, name.slice(1, -1), value, state);
    return true;
  }

  return false;
}

export function normalizeStaticSpecialAttributes(root: ParentNode): void {
  const elements = root.querySelectorAll("*");
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index]!;
    const attributes = Array.from(element.attributes);

    for (const attribute of attributes) {
      if (!isSpecialAttributeName(attribute.name) || attribute.value.includes("__fabrica_attr_")) continue;
      applySpecialAttribute(element, attribute.name, attribute.value);
      element.removeAttribute(attribute.name);
    }
  }
}

export function toDataAttributeName(name: string): string {
  const decodedName = decodeLiteralDataAttributeName(name);
  const withoutPrefix = decodedName.value.replace(/^data-?/, "");
  return `data-${decodedName.literal ? withoutPrefix : toKebabCase(withoutPrefix)}`;
}

/** Encodes quoted data names into an HTML-parser-safe attribute name. */
export function encodeLiteralDataAttributeName(name: string): string {
  return `:${LITERAL_DATA_ATTRIBUTE_PREFIX}${Array.from(name, (char) => char.codePointAt(0)!.toString(16).padStart(6, "0")).join("")}`;
}

function decodeLiteralDataAttributeName(name: string): { literal: boolean; value: string } {
  const unquoted = readQuotedDataAttributeName(name);
  if (unquoted != null) return { literal: true, value: unquoted };

  const encodedPrefix = LITERAL_DATA_ATTRIBUTE_PREFIX;
  if (!name.startsWith(encodedPrefix)) return { literal: false, value: name };

  const encoded = name.slice(encodedPrefix.length);
  if (!encoded || encoded.length % 6 !== 0 || /[^0-9a-f]/i.test(encoded)) {
    return { literal: true, value: encoded };
  }

  let value = "";
  for (let index = 0; index < encoded.length; index += 6) {
    value += String.fromCodePoint(Number.parseInt(encoded.slice(index, index + 6), 16));
  }
  return { literal: true, value };
}

function readQuotedDataAttributeName(name: string): string | null {
  if (!name.startsWith('"') || !name.endsWith('"')) return null;
  return name.slice(1, -1);
}

function applyCipoInlineStyle(element: Element, value: unknown): void {
  const style = getStyle(element);
  if (!style) return;

  if (value == null || value === false) {
    style.cssText = "";
    return;
  }

  const cssText = readInlineCssText(value);
  style.cssText = cssText;
}

function readInlineCssText(value: unknown): string {
  if (value && typeof value === "object") {
    const artifact = value as { cssText?: unknown; kind?: unknown };
    if (artifact.kind === "cipo.inline-css" && typeof artifact.cssText === "string") return artifact.cssText;
    return compileInlineCss(resolveObject(value as Record<string, unknown>) as never, [], false).cssText;
  }

  const source = String(value ?? "");
  const strings = Object.assign([source], { raw: [source] }) as unknown as TemplateStringsArray;
  return compileInlineCss(strings, [], false).cssText;
}

function applyDataAttribute(element: Element, rawName: string, value: unknown, state: SpecialAttributeState): void {
  if (rawName === "data") {
    const nextNames = new Set<string>();
    if (value && typeof value === "object") {
      const record = resolveObject(value as Record<string, unknown>);
      for (const key in record) {
        const attributeName = toDataAttributeName(key.startsWith(":") ? `"${key.slice(1)}"` : key);
        nextNames.add(attributeName);
        setDataValue(element, attributeName, record[key]);
      }
    }

    for (const previousName of state.dataNames) {
      if (!nextNames.has(previousName)) element.removeAttribute(previousName);
    }
    state.dataNames = nextNames;
    return;
  }

  const attributeName = toDataAttributeName(rawName);
  state.dataNames.add(attributeName);
  setDataValue(element, attributeName, value);
}

function setDataValue(element: Element, name: string, value: unknown): void {
  if (value == null) element.removeAttribute(name);
  else element.setAttribute(name, String(value));
}

function applyStyleProperty(element: Element, property: string, value: unknown, state: SpecialAttributeState): void {
  const style = getStyle(element);
  if (!style) return;

  const propertyName = property.startsWith("--") ? property : toKebabCase(property);
  state.styleNames.add(propertyName);

  if (value == null || value === false) style.removeProperty(propertyName);
  else style.setProperty(propertyName, String(value));
}

function clearSpecialAttribute(element: Element, state: SpecialAttributeState): void {
  for (const name of state.dataNames) element.removeAttribute(name);
  const style = getStyle(element);
  if (style) for (const name of state.styleNames) style.removeProperty(name);
}

function getStyle(element: Element): CSSStyleDeclaration | null {
  return "style" in element ? (element as HTMLElement).style : null;
}

function readValueDeep(value: unknown): unknown {
  const resolved = readValue(value);
  if (Array.isArray(resolved)) return resolved.map(readValueDeep);
  if (!resolved || typeof resolved !== "object" || resolved.constructor !== Object) return resolved;
  return resolveObject(resolved as Record<string, unknown>);
}

function resolveObject(value: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const key in value) output[key] = readValueDeep(value[key]);
  return output;
}

function hasDeepReactiveValue(value: unknown): boolean {
  if (hasReactiveValue(value)) return true;
  if (!value || typeof value !== "object") return false;
  for (const key in value as Record<string, unknown>) {
    if (hasDeepReactiveValue((value as Record<string, unknown>)[key])) return true;
  }
  return false;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
