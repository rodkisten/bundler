import { computed } from "@rodkisten/broto/reactivity";
import { appendValue } from "../../render/dom.js";
import {
  mergeComponentDataProps,
  mergeComponentSpreadProps,
  normalizeComponentPropName,
} from "../../bindings/component-props.js";
import { bindSpreadPart } from "../../bindings/spread.js";
import { isSignal } from "../../guards.js";
import { resolveRuntimeComponent } from "../../core/runtime-context.js";
import { hasReactiveValue, readValue } from "../../core/value.js";
import type { RenderValue } from "../../types.js";
import {
  NODE_TEXT,
  NODE_VALUE,
  PROP_COMPOUND,
  PROP_SPREAD,
  PROP_STATIC,
  PROP_VALUE,
  UPPERCASE_TAG_RE,
} from "../constants.js";
import { createElementForTag } from "../utils.js";
import {
  applyCompiledProps,
  createCompiledElement,
} from "./element.js";
import { decodeHtmlEntities } from "./entities.js";
import type {
  CompactRuntimeNode,
  CompactRuntimeProp,
  FabricaCompiledElementProps,
  RuntimeComponent,
  RuntimeNode,
  RuntimeProp,
} from "./types.js";

export function normalizeCompactNode(node: CompactRuntimeNode): RuntimeNode {
  if (node[0] === NODE_TEXT) return { type: "text", value: node[1] };
  if (node[0] === NODE_VALUE) return { type: "value", index: node[1] };
  return {
    type: "element",
    tag: node[1],
    props: node[2].map(normalizeCompactProp),
    children: node[3].map(normalizeCompactNode),
  };
}

function normalizeCompactProp(prop: CompactRuntimeProp): RuntimeProp {
  if (prop[0] === PROP_SPREAD) return { type: "spread", index: prop[1] };
  if (prop[0] === PROP_VALUE) {
    return { type: "value", name: prop[1], index: prop[2] };
  }
  if (prop[0] === PROP_COMPOUND) {
    return {
      type: "compound",
      name: prop[1],
      strings: prop[2],
      indices: prop[3],
    };
  }
  if (prop[0] === PROP_STATIC) {
    return { type: "static", name: prop[1], value: prop[2] };
  }
  return { type: "static", name: prop[1], value: prop[2] };
}

export function appendCompiledNode(
  parent: Node,
  node: RuntimeNode,
  values: readonly RenderValue[],
): void {
  if (node.type === "text") {
    appendValue(parent, decodeHtmlEntities(node.value));
    return;
  }
  if (node.type === "value") {
    appendValue(parent, values[node.index]);
    return;
  }

  const component = resolveCompiledComponentTag(node.tag);
  if (component) {
    appendValue(
      parent,
      createCompiledComponentRenderValue(node, component, values),
    );
    return;
  }

  const element = createElementForTag(node.tag as string);
  const props: Record<string, unknown> = {};

  for (const prop of node.props) {
    if (prop.type === "spread") {
      bindSpreadPart(element, values[prop.index]);
      continue;
    }
    props[prop.name] = readCompiledAttributeBindingValue(prop, values);
  }

  applyCompiledProps(element, props);
  for (const child of node.children) appendCompiledNode(element, child, values);
  parent.appendChild(element);
}

function createCompiledComponentRenderValue(
  node: Extract<RuntimeNode, { readonly type: "element" }>,
  component: RuntimeComponent,
  values: readonly RenderValue[],
): RenderValue {
  const render = (): RenderValue =>
    createCompiledElement(
      component,
      readCompiledComponentProps(node.props, values, component),
      ...collectCompiledChildValues(node.children, values),
    ) as RenderValue;

  // Match the runtime html`` path: component factories are re-invoked when a
  // dynamic prop reads a signal or reactive expression. This is especially
  // important for styled intrinsic components, whose DOM attributes are created
  // inside the component factory rather than bound by the parent template.
  return hasReactiveCompiledComponentInputs(node.props, values)
    ? computed(render, { name: `fabrica.compiledComponent.${component.name || "anonymous"}` })
    : render();
}

function hasReactiveCompiledComponentInputs(
  props: readonly RuntimeProp[],
  values: readonly RenderValue[],
): boolean {
  for (const prop of props) {
    if (prop.type === "spread") {
      const spread = values[prop.index];
      if (hasReactiveValue(spread) || hasReactiveRecordValue(spread)) return true;
      continue;
    }

    if (prop.type === "value") {
      if (hasReactiveValue(values[prop.index])) return true;
      continue;
    }

    if (prop.type === "compound") {
      for (const index of prop.indices) {
        if (hasReactiveValue(values[index])) return true;
      }
    }
  }
  return false;
}

function hasReactiveRecordValue(value: unknown): boolean {
  const resolved = readValue(value);
  if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) return false;

  for (const item of Object.values(resolved as Record<string, unknown>)) {
    if (hasReactiveValue(item)) return true;
  }
  return false;
}

function readCompiledComponentProps(
  props: readonly RuntimeProp[],
  values: readonly RenderValue[],
  componentValue?: unknown,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const prop of props) {
    if (prop.type === "spread") {
      mergeComponentSpreadProps(
        output,
        readValue(values[prop.index]),
        resolveComponentItemValue,
      );
      continue;
    }

    const name = normalizeComponentPropName(prop.name);
    const rawValue = prop.type === "value" ? values[prop.index] : undefined;
    const preservedProps = (
      componentValue as { preserveSignalProps?: ReadonlySet<string> } | null
    )?.preserveSignalProps;
    const value =
      prop.type === "value" &&
      isSignal(rawValue) &&
      !preservedProps?.has(name)
        ? rawValue()
        : readCompiledPropValue(prop, values);
    if (name === "props") {
      mergeComponentSpreadProps(
        output,
        readValue(value),
        resolveComponentItemValue,
      );
    } else if (name === ":data") {
      mergeComponentDataProps(
        output,
        readValue(value),
        resolveComponentItemValue,
      );
    } else {
      output[name] = value;
    }
  }

  return output;
}

function resolveComponentItemValue(value: unknown): unknown {
  return isSignal(value) ? value() : value;
}

/**
 * Preserves a dynamic attribute as a binding source instead of eagerly reading
 * it. Compound attributes receive a lazy expression only when one of their
 * segments is reactive, matching the interpreted template path.
 */
function readCompiledAttributeBindingValue(
  prop: Exclude<RuntimeProp, { readonly type: "spread" }>,
  values: readonly RenderValue[],
): RenderValue {
  if (prop.type === "value") {
    return values[prop.index] as RenderValue;
  }

  if (prop.type === "static") {
    if (prop.value === true) {
      return (prop.name.startsWith("?") ? true : "") as RenderValue;
    }
    return (typeof prop.value === "string"
      ? decodeHtmlEntities(prop.value)
      : prop.value) as RenderValue;
  }

  const reactive = prop.indices.some((index) =>
    hasReactiveValue(values[index]),
  );
  if (!reactive) return readCompiledPropValue(prop, values) as RenderValue;

  return (() => readCompiledPropValue(prop, values)) as RenderValue;
}

function readCompiledPropValue(
  prop: Exclude<RuntimeProp, { readonly type: "spread" }>,
  values: readonly RenderValue[],
): unknown {
  if (prop.type === "value") return values[prop.index];
  if (prop.type === "static") {
    return typeof prop.value === "string"
      ? decodeHtmlEntities(prop.value)
      : prop.value;
  }

  let output = "";
  for (let index = 0; index < prop.indices.length; index += 1) {
    output += prop.strings[index] ?? "";
    const segment = readValue(values[prop.indices[index]!] ?? "");
    if (segment == null || segment === false) continue;
    if (segment === true) output += "true";
    else if (
      segment &&
      typeof segment === "object" &&
      "nodeType" in (segment as object)
    ) {
      output += (segment as Node).textContent ?? "";
    } else {
      output += String(segment);
    }
  }
  return output;
}

function resolveCompiledComponentTag(
  tag: string | RuntimeComponent,
): RuntimeComponent | null {
  if (typeof tag === "function") return tag;
  if (!UPPERCASE_TAG_RE.test(tag)) return null;
  try {
    const component = resolveRuntimeComponent(tag);
    return typeof component === "function"
      ? (component as (props: FabricaCompiledElementProps) => RenderValue)
      : null;
  } catch {
    return null;
  }
}

function collectCompiledChildValues(
  children: readonly RuntimeNode[],
  values: readonly RenderValue[],
): RenderValue[] {
  const output: RenderValue[] = [];
  for (const child of children) {
    collectCompiledChildValue(child, values, output);
  }
  return output;
}

function collectCompiledChildValue(
  node: RuntimeNode,
  values: readonly RenderValue[],
  output: RenderValue[],
): void {
  if (node.type === "text") {
    if (node.value) output.push(decodeHtmlEntities(node.value));
    return;
  }
  if (node.type === "value") {
    output.push(values[node.index] as RenderValue);
    return;
  }

  const component = resolveCompiledComponentTag(node.tag);
  if (component) {
    output.push(createCompiledComponentRenderValue(node, component, values));
    return;
  }

  const element = createElementForTag(node.tag as string);
  const props: Record<string, unknown> = {};
  for (const prop of node.props) {
    if (prop.type === "spread") {
      bindSpreadPart(element, values[prop.index]);
      continue;
    }
    props[prop.name] = readCompiledAttributeBindingValue(prop, values);
  }
  applyCompiledProps(element, props);
  for (const child of node.children) appendCompiledNode(element, child, values);
  output.push(element);
}
