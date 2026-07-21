import { effect } from "@rodkisten/broto/reactivity";
import { bindModelPart } from "../directives/runtime.js";
import { registerCleanup } from "../render/cleanup.js";
import { bindEvent } from "../events.js";
import {
  isClassMapDirective,
  isDirective,
  isSignal,
  isStyleMapDirective,
} from "../guards.js";
import { applyClassMap, applyStyleMap } from "./maps.js";
import { bindSpecialAttribute } from "./special.js";
import { stringifyAttributeValue } from "./serialize.js";
import { bindRef } from "./ref.js";
import { hasReactiveValue, readValue } from "../core/value.js";
import type {
  BindDirective,
  RenderValue,
} from "../types.js";

/**
 * Canonical binding entrypoint for an attribute produced by an HTML template.
 *
 * Both interpreted and compiled templates call this function. Keeping the
 * dispatch here guarantees that compiler optimizations cannot silently change
 * ref cleanup, event semantics, property bindings, boolean attributes, class
 * toggles, special attributes, or reactive updates.
 */
export function bindTemplateAttribute(
  element: Element,
  rawName: string,
  value: RenderValue | undefined,
): void {
  if (isDirective(value) && value.kind === "bind") {
    bindModelPart(element, rawName, value as unknown as BindDirective);
    return;
  }

  if (rawName === "ref") {
    bindRef(element, value);
    return;
  }

  if (bindSpecialAttribute(element, rawName, value)) return;

  if (rawName.startsWith("@")) {
    bindEvent(element, rawName.slice(1), value as RenderValue);
    return;
  }

  if (isEventPropName(rawName)) {
    bindEvent(element, eventNameFromProp(rawName), value as RenderValue);
    return;
  }

  if (rawName.startsWith(".")) {
    bindPropertyValue(element, rawName.slice(1), value);
    return;
  }

  if (rawName.startsWith("?")) {
    bindBooleanAttributeValue(element, rawName.slice(1), value);
    return;
  }

  if (rawName.startsWith("class:")) {
    bindConditionalClassValue(
      element,
      rawName.slice("class:".length),
      value,
    );
    return;
  }

  bindPlainAttributeValue(
    element,
    rawName === "className" ? "class" : rawName,
    value,
  );
}

/** Binds a plain attribute and preserves class/style directive semantics. */
export function bindPlainAttributeValue(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  if (!hasReactiveValue(value)) {
    applyPlainAttributeValue(element, name, readValue(value));
    return;
  }

  let previous: unknown = INITIAL_VALUE;
  let mapState:
    | ReturnType<typeof applyClassMap>
    | ReturnType<typeof applyStyleMap>
    | null = null;

  const update = (): void => {
    const next = readValue(value);

    if (isClassMapDirective(next) && name === "class") {
      mapState = applyClassMap(element, next.value, mapState);
      return;
    }

    if (isStyleMapDirective(next) && name === "style") {
      mapState = applyStyleMap(element, next.value, mapState);
      return;
    }

    if (Object.is(previous, next)) return;
    previous = next;
    applyPlainAttributeValue(element, name, next);
  };

  registerCleanup(
    element,
    effect(update, {
      name: `fabrica.attribute.${name}`,
      scheduler: "sync",
    }),
  );
}

/** Binds a DOM property while treating ordinary functions as property values. */
export function bindPropertyValue(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  if (!name) return;

  if (!isSignal(value)) {
    setElementProperty(element, name, value);
    return;
  }

  let previous: unknown = INITIAL_VALUE;
  const update = (): void => {
    const next = readValue(value);
    if (Object.is(previous, next)) return;
    previous = next;
    setElementProperty(element, name, next);
  };

  registerCleanup(
    element,
    effect(update, {
      name: `fabrica.property.${name}`,
      scheduler: "sync",
    }),
  );
}

/** Binds a boolean attribute with the same semantics in every renderer. */
export function bindBooleanAttributeValue(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  if (!hasReactiveValue(value)) {
    applyBooleanAttributeValue(element, name, Boolean(readValue(value)));
    return;
  }

  let previous: boolean | null = null;
  const update = (): void => {
    const next = Boolean(readValue(value));
    if (previous === next) return;
    previous = next;
    applyBooleanAttributeValue(element, name, next);
  };

  registerCleanup(
    element,
    effect(update, {
      name: `fabrica.booleanAttribute.${name}`,
      scheduler: "sync",
    }),
  );
}

/** Binds `class:name=${value}` as a reactive class-list toggle. */
export function bindConditionalClassValue(
  element: Element,
  className: string,
  value: RenderValue | undefined,
): void {
  if (!hasReactiveValue(value)) {
    element.classList.toggle(className, Boolean(readValue(value)));
    return;
  }

  let previous: boolean | null = null;
  const update = (): void => {
    const next = Boolean(readValue(value));
    if (previous === next) return;
    previous = next;
    element.classList.toggle(className, next);
  };

  registerCleanup(
    element,
    effect(update, {
      name: `fabrica.classToggle.${className}`,
      scheduler: "sync",
    }),
  );
}

const INITIAL_VALUE = Symbol("fabrica.initial-binding-value");
const EVENT_PROP_RE = /^on[A-Z]|^on[a-z]+$/;

function applyPlainAttributeValue(
  element: Element,
  name: string,
  next: unknown,
): void {
  if (isClassMapDirective(next) && name === "class") {
    applyClassMap(element, next.value, null);
    return;
  }

  if (isStyleMapDirective(next) && name === "style") {
    applyStyleMap(element, next.value, null);
    return;
  }

  if (next == null || next === false) {
    if (name === "class") {
      if (element instanceof HTMLElement || element instanceof SVGElement) {
        element.removeAttribute("class");
      }
      return;
    }

    if (name === "style" && "style" in element) {
      (element as HTMLElement).style.cssText = "";
      return;
    }

    element.removeAttribute(name);
    return;
  }

  const stringValue = stringifyAttributeValue(name, next);

  if (name === "class") {
    element.setAttribute("class", stringValue);
    return;
  }

  if (name === "style" && "style" in element) {
    (element as HTMLElement).style.cssText = stringValue;
    return;
  }

  element.setAttribute(name, stringValue);
}

function applyBooleanAttributeValue(
  element: Element,
  name: string,
  enabled: boolean,
): void {
  if (enabled) element.setAttribute(name, "");
  else element.removeAttribute(name);
}

function setElementProperty(
  element: Element,
  name: string,
  value: unknown,
): void {
  try {
    (element as unknown as Record<string, unknown>)[name] = value;
  } catch (error) {
    const tag = element.tagName.toLowerCase();
    const detail = error instanceof Error ? error.message : String(error);
    throw new TypeError(
      `[Fabrica] Unable to assign property ".${name}" on <${tag}>: ` +
        detail,
    );
  }
}

function isEventPropName(name: string): boolean {
  return EVENT_PROP_RE.test(name) && name.length > 2;
}

function eventNameFromProp(name: string): string {
  const raw = name.slice(2);
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}
