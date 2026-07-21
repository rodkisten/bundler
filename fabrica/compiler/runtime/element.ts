import { bindTemplateAttribute } from "../../bindings/attribute.js";
import { appendValue } from "../../render/dom.js";
import { invokeComponentLike } from "../../render/payload.js";
import { createElementForTag } from "../utils.js";
import type { RenderValue } from "../../types.js";
import type {
  FabricaCompiledElementProps,
} from "./types.js";

/**
 * Creates an element through the canonical Fábrica binding kernel.
 *
 * Compiled templates are an execution optimization, not a second renderer.
 * Every prop therefore flows through `bindTemplateAttribute`, exactly like an
 * interpreted `html`` ` template, preserving reactivity and cleanup behavior.
 */
export function createCompiledElement(
  tag: string | ((props: FabricaCompiledElementProps) => RenderValue),
  props: FabricaCompiledElementProps | null,
  ...children: readonly RenderValue[]
): RenderValue {
  if (typeof tag === "function") {
    return invokeComponentLike(
      tag,
      { ...(props ?? {}), children },
    ) as RenderValue;
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

/**
 * Applies compiled template props through the same attribute binder as the
 * interpreted renderer.
 */
export function applyCompiledProps(
  element: Element,
  props: FabricaCompiledElementProps | null | undefined,
): void {
  if (!props) return;

  for (const [name, value] of Object.entries(props)) {
    if (name === "children") continue;
    bindTemplateAttribute(element, name, value as RenderValue);
  }
}
