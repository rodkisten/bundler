import { appendValue } from "@rodkisten/fabrica/dom";
import { invokeComponentLike } from "@rodkisten/fabrica/dom-payload";
import { bindEvent } from "@rodkisten/fabrica/events";
import { applyProps, setPropertyOrAttribute } from "@rodkisten/fabrica/props";
import { readValue } from "@rodkisten/fabrica/value";
import { isSignal } from "@rodkisten/fabrica/guards";
import { bindSpecialAttribute } from "@rodkisten/fabrica/dom-special-attributes";
import type { RenderValue } from "@rodkisten/fabrica/types";
import {
  EVENT_PROP_CAMEL_RE,
  EVENT_PROP_LEGACY_RE,
} from "@rodkisten/fabrica/compiler-constants";
import { createElementForTag } from "@rodkisten/fabrica/compiler-utils";
import type {
  FabricaCompiledElementProps,
} from "@rodkisten/fabrica/compiler-runtime-types";

/**
 * Creates a DOM element through the same runtime prop/event/child primitives used by Fábrica.
 *
 * Owns `document.createElement` and tree assembly while prop normalization, events,
 * cleanup and child materialization stay in the shared runtime modules.
 */
export function createCompiledElement(
  tag: string | ((props: FabricaCompiledElementProps) => RenderValue),
  props: FabricaCompiledElementProps | null,
  ...children: readonly RenderValue[]
): RenderValue {
  if (typeof tag === "function") {
    return invokeComponentLike(tag, { ...(props ?? {}), children }) as RenderValue;
  }

  const element = createElementForTag(tag);
  applyCompiledProps(element, props);
  for (const child of children) appendValue(element, child);
  return element;
}

/** Creates a document fragment from already compiled children. */
export function createCompiledFragment(
  ...children: readonly RenderValue[]
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const child of children) appendValue(fragment, child);
  return fragment;
}

/** Applies compiled props and event listeners using shared runtime semantics. */
export function applyCompiledProps(
  element: Element,
  props: FabricaCompiledElementProps | null | undefined,
): void {
  if (!props) return;

  const plainProps: Record<string, unknown> = {};

  for (const [rawName, rawValue] of Object.entries(props)) {
    if (rawName === "children") continue;

    if (rawName === "ref") {
      const callback =
        typeof rawValue === "function"
          ? rawValue
          : rawValue &&
              typeof rawValue === "object" &&
              (rawValue as { kind?: unknown }).kind === "ref"
            ? (rawValue as { callback?: unknown }).callback
            : null;

      if (typeof callback === "function") {
        (callback as (node: Element) => void | (() => void))(element);
      } else if (rawValue && typeof rawValue === "object" && "current" in rawValue) {
        (rawValue as { current: Element | null }).current = element;
      }
      continue;
    }

    if (rawName.startsWith("@")) {
      bindEvent(element, rawName.slice(1), rawValue as RenderValue);
      continue;
    }

    if (isEventPropName(rawName)) {
      bindEvent(element, eventNameFromProp(rawName), rawValue as RenderValue);
      continue;
    }

    if (rawName.startsWith(".")) {
      // Dot bindings assign properties. Signals resolve; plain functions stay callbacks.
      const propertyValue = isSignal(rawValue) ? rawValue() : rawValue;
      setCompiledProperty(element, rawName.slice(1), propertyValue);
      continue;
    }

    if (bindSpecialAttribute(element, rawName, rawValue)) continue;

    const value = readValue(rawValue);
    if (value == null || value === false) continue;

    if (rawName.startsWith("?")) {
      setPropertyOrAttribute(element, rawName.slice(1), Boolean(value));
      continue;
    }

    plainProps[rawName === "className" ? "class" : rawName] = value;
  }

  applyProps(element, plainProps);
}

function setCompiledProperty(
  element: Element,
  name: string,
  value: unknown,
): void {
  if (!name) return;

  try {
    (element as unknown as Record<string, unknown>)[name] = value;
  } catch (error) {
    throw new TypeError(
      `[Fabrica] Unable to assign property ".${name}" on <${element.tagName.toLowerCase()}>: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function isEventPropName(name: string): boolean {
  return EVENT_PROP_CAMEL_RE.test(name) || EVENT_PROP_LEGACY_RE.test(name);
}

function eventNameFromProp(name: string): string {
  const raw = name.startsWith("on") ? name.slice(2) : name;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}
