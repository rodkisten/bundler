import { bindPlainAttributeValue } from "../bindings/attribute.js";
import { bindPropertyOrAttributeValue } from
  "../bindings/property-or-attribute.js";
import { bindRef } from "../bindings/ref.js";
import { bindSpecialAttribute } from "../bindings/special.js";
import { bindEvent } from "../events.js";
import { readValue } from "../core/value.js";
import type {
  ComponentPayload,
  ElementPayload,
  RenderValue,
} from "../types.js";
import { toDataAttributeName } from "../data-attributes.js";

/** Callback used by payload materializers to append nested render values. */
export type AppendRenderValue = (
  parentNode: Node,
  value: RenderValue,
  beforeNode?: Node | null,
) => void;

/** Returns whether an unknown render value is an element payload. */
export function isElementPayload(value: unknown): value is ElementPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ElementPayload).tag === "string",
  );
}

/** Returns whether an unknown render value is a component payload. */
export function isComponentPayload(
  value: unknown,
): value is ComponentPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      "component" in (value as Record<string, unknown>),
  );
}

/** Materializes a fabrica-elements tag payload into a live DOM element. */
export function materializeElementPayload(
  payload: ElementPayload,
  appendValue: AppendRenderValue,
): Element {
  const element = document.createElement(payload.tag);
  applyPayloadProps(element, payload.props || {}, appendValue);
  return element;
}

/** Component-like value that can hand DOM ownership back to Fábrica. */
type RendererPayloadComponent = (
  (props?: Record<string, unknown>) => unknown
) & {
  renderPayload?: (props?: Record<string, unknown>) => unknown;
};

/**
 * Invokes a component while preferring a renderer-owned payload when available.
 *
 * Styled factories normally return a live element in standalone mode. Their
 * `renderPayload()` hook preserves dynamic children so Fábrica remains the
 * single owner responsible for mounting and disposal.
 */
export function invokeComponentLike(
  componentValue: unknown,
  props: Record<string, unknown>,
): unknown {
  if (typeof componentValue !== "function") return null;

  const component = componentValue as RendererPayloadComponent;
  return typeof component.renderPayload === "function"
    ? component.renderPayload(props)
    : component(props);
}

/** Materializes a component payload by invoking its component factory. */
export function materializeComponentPayload(
  payload: ComponentPayload,
): unknown {
  return invokeComponentLike(payload.component, payload.props || {});
}

/**
 * Applies fabrica-elements payload props through the canonical binding kernel.
 *
 * Payload syntax is an object-prop API rather than HTML-template syntax, but
 * both paths share class/style serialization, refs, special attributes, events,
 * and reactive property-or-attribute ownership.
 */
export function applyPayloadProps(
  element: Element,
  props: Record<string, unknown>,
  appendValue: AppendRenderValue,
): void {
  for (const key in props) {
    const propValue = props[key];

    if (key === "children") {
      appendValue(element, propValue as RenderValue);
      continue;
    }

    if (bindSpecialAttribute(element, key, propValue)) continue;

    if (key === "class" || key === "className") {
      bindPlainAttributeValue(element, "class", propValue as RenderValue);
      continue;
    }

    if (key === "style") {
      bindPlainAttributeValue(element, "style", propValue as RenderValue);
      continue;
    }

    if (key === "attrs") {
      bindPayloadAttributeMap(element, propValue);
      continue;
    }

    if (key === "dataset") {
      bindPayloadDataset(element, propValue);
      continue;
    }

    if (key === "ref") {
      bindRef(element, propValue);
      continue;
    }

    if (key === "on") {
      bindPayloadEventMap(element, propValue);
      continue;
    }

    if (key.startsWith("on") && typeof propValue === "function") {
      bindEvent(
        element,
        key.slice(2).toLowerCase(),
        propValue as unknown as RenderValue,
      );
      continue;
    }

    bindPropertyOrAttributeValue(element, key, propValue);
  }
}

/** Applies payload refs through the canonical Fábrica ref lifecycle. */
export function applyPayloadRef(element: Element, value: unknown): void {
  bindRef(element, value);
}

function bindPayloadAttributeMap(
  element: Element,
  value: unknown,
): void {
  const resolved = readValue(value);
  if (!resolved || typeof resolved !== "object") return;

  for (const [name, item] of Object.entries(
    resolved as Record<string, unknown>,
  )) {
    bindPropertyOrAttributeValue(element, name, item);
  }
}

function bindPayloadDataset(
  element: Element,
  value: unknown,
): void {
  const resolved = readValue(value);
  if (!(element instanceof HTMLElement)) return;
  if (!resolved || typeof resolved !== "object") return;

  for (const [name, item] of Object.entries(
    resolved as Record<string, unknown>,
  )) {
    bindPropertyOrAttributeValue(element, toDataAttributeName(name), item);
  }
}

function bindPayloadEventMap(
  element: Element,
  value: unknown,
): void {
  const resolved = readValue(value);
  if (!resolved || typeof resolved !== "object") return;

  for (const [eventName, listener] of Object.entries(
    resolved as Record<string, unknown>,
  )) {
    if (typeof listener !== "function") continue;
    bindEvent(
      element,
      eventName,
      listener as unknown as RenderValue,
    );
  }
}
