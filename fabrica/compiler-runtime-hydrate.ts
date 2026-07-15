import { appendValue } from "@rodkisten/fabrica/dom";
import { toDataAttributeName } from "@rodkisten/fabrica/dom-special-attributes";
import { isSignal } from "@rodkisten/fabrica/guards";
import { resolveRuntimeComponent } from "@rodkisten/fabrica/runtime-context";
import { readValue } from "@rodkisten/fabrica/value";
import type { RenderValue } from "@rodkisten/fabrica/types";
import {
  NODE_TEXT,
  NODE_VALUE,
  PROP_COMPOUND,
  PROP_SPREAD,
  PROP_STATIC,
  PROP_VALUE,
  UPPERCASE_TAG_RE,
} from "@rodkisten/fabrica/compiler-constants";
import { createElementForTag } from "@rodkisten/fabrica/compiler-utils";
import {
  applyCompiledProps,
  createCompiledElement,
} from "@rodkisten/fabrica/compiler-runtime-element";
import { decodeHtmlEntities } from "@rodkisten/fabrica/compiler-runtime-entities";
import type {
  CompactRuntimeNode,
  CompactRuntimeProp,
  FabricaCompiledElementProps,
  RuntimeComponent,
  RuntimeNode,
  RuntimeProp,
} from "@rodkisten/fabrica/compiler-runtime-types";

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
      createCompiledElement(
        component,
        readCompiledComponentProps(node.props, values, component),
        ...collectCompiledChildValues(node.children, values),
      ),
    );
    return;
  }

  const element = createElementForTag(node.tag as string);
  const props: Record<string, unknown> = {};

  for (const prop of node.props) {
    if (prop.type === "spread") {
      applyCompiledProps(
        element,
        values[prop.index] as FabricaCompiledElementProps,
      );
      continue;
    }
    props[prop.name] = readCompiledPropValue(prop, values);
  }

  applyCompiledProps(element, props);
  for (const child of node.children) appendCompiledNode(element, child, values);
  parent.appendChild(element);
}

function readCompiledComponentProps(
  props: readonly RuntimeProp[],
  values: readonly RenderValue[],
  componentValue?: unknown,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const prop of props) {
    if (prop.type === "spread") {
      mergeCompiledComponentSpreadProps(output, values[prop.index]);
      continue;
    }

    const name = normalizeCompiledComponentPropName(prop.name);
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
      mergeCompiledComponentSpreadProps(output, value);
    } else if (name === ":data") {
      mergeCompiledComponentDataProps(output, value);
    } else {
      output[name] = value;
    }
  }

  return output;
}

function mergeCompiledComponentSpreadProps(
  target: Record<string, unknown>,
  value: unknown,
): void {
  const resolved = readValue(value);
  if (!resolved || typeof resolved !== "object") return;

  for (const [name, item] of Object.entries(
    resolved as Record<string, unknown>,
  )) {
    target[normalizeCompiledComponentPropName(name)] = isSignal(item)
      ? item()
      : item;
  }
}

function mergeCompiledComponentDataProps(
  target: Record<string, unknown>,
  value: unknown,
): void {
  const resolved = readValue(value);
  if (!resolved || typeof resolved !== "object") return;
  const source = resolved as Record<string, unknown>;
  for (const key in source) {
    const literal = key.startsWith(":");
    const rawName = literal ? `"${key.slice(1)}"` : key;
    const item = source[key];
    target[toDataAttributeName(rawName)] = isSignal(item) ? item() : item;
  }
}

function normalizeCompiledComponentPropName(name: string): string {
  if (name.startsWith("@")) {
    return compiledEventAttributeToPropName(name.slice(1));
  }
  if (name.startsWith(".")) return name.slice(1);
  if (name.startsWith("?")) return name.slice(1);
  if (name === ":data") return name;
  if (name.startsWith(":")) return toDataAttributeName(name.slice(1));
  if (name === "classname") return "className";
  if (name === "htmlfor") return "htmlFor";
  if (name === "tabindex") return "tabIndex";
  if (name === "readonly") return "readOnly";
  return name;
}

function compiledEventAttributeToPropName(rawName: string): string {
  const dotIndex = rawName.indexOf(".");
  const eventName = dotIndex < 0 ? rawName : rawName.slice(0, dotIndex);
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
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
    output.push(
      createCompiledElement(
        component,
        readCompiledComponentProps(node.props, values, component),
        ...collectCompiledChildValues(node.children, values),
      ),
    );
    return;
  }

  const element = createElementForTag(node.tag as string);
  const props: Record<string, unknown> = {};
  for (const prop of node.props) {
    if (prop.type === "spread") {
      Object.assign(props, values[prop.index] as FabricaCompiledElementProps);
    } else {
      props[prop.name] = readCompiledPropValue(prop, values);
    }
  }
  applyCompiledProps(element, props);
  for (const child of node.children) appendCompiledNode(element, child, values);
  output.push(element);
}
