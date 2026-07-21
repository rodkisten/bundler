import { hasReactiveValue, readValue } from "../core/value.js";
import { isDomNode } from "../guards.js";
import type {
  RenderValue,
  TemplatePart,
} from "../types.js";

/**
 * Builds the runtime value consumed by an attribute binding descriptor.
 *
 * Compound attributes become lazy expressions only when one of their segments
 * is reactive. Static compounds are flattened once and avoid creating an
 * effect in the binding kernel.
 */
export function createAttributeBindingValue(
  part: Extract<TemplatePart, { type: "attribute" }>,
  values: readonly RenderValue[],
): RenderValue | undefined {
  if (part.raw) return values[part.index];

  for (let index = 0; index < part.indices.length; index += 1) {
    if (hasReactiveValue(values[part.indices[index]!] as unknown)) {
      return (() =>
        composeAttributeValue(
          part.indices,
          part.strings,
          values,
        )) as RenderValue;
    }
  }

  return composeAttributeValue(part.indices, part.strings, values);
}

/** Composes static and dynamic interpolation segments into one attribute text. */
export function composeAttributeValue(
  indices: readonly number[],
  strings: readonly string[],
  values: readonly RenderValue[],
): string {
  let output = strings[0] ?? "";

  for (let index = 0; index < indices.length; index += 1) {
    output += stringifyAttributeSegment(
      readValue(values[indices[index]!]),
    );
    output += strings[index + 1] ?? "";
  }

  return output;
}

/** Normalizes one interpolation segment using DOM-friendly text semantics. */
export function stringifyAttributeSegment(value: unknown): string {
  if (value == null || value === false) return "";
  if (value === true) return "true";
  if (isDomNode(value)) return value.textContent ?? "";
  return String(value);
}
