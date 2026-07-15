import { appendValue, createHtmlResult, html, pruneInsignificantWhitespace } from "./dom";
import { invokeComponentLike } from "./dom-payload";
import {
  getCurrentFabricaRuntime,
  resolveRuntimeComponent,
  runWithCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "./runtime-context";
import { bindEvent } from "./events";
import { applyProps, setPropertyOrAttribute } from "./props";
import { readValue } from "./value";
import { isSignal } from "./guards";
import { bindSpecialAttribute } from "./dom-special-attributes";
import { collectCleanupNodes } from "./dom-cleanup";
import type { FabricaRuntimeContext, HtmlArtifact, HtmlResult, RenderValue } from "./types";
import {
  createElementForTag,
  FABRICA_SPREAD_PREFIX,
  FABRICA_SPREAD_SUFFIX,
  FABRICA_VALUE_PREFIX,
  FABRICA_VALUE_SUFFIX,
  isVoidTag,
  normalizeAttributeName,
  normalizeTemplateStrings,
  readSpreadMarker,
  readValueMarker,
  unquote,
} from "./compiler-utils";

export interface FabricaCompiledElementProps {
  readonly [key: string]: unknown;
}

/**
 * Creates a DOM element through the same runtime prop/event/child primitives used by Fábrica.
 *
 * The compiled path is intentionally tiny: it owns `document.createElement` and tree assembly,
 * while prop normalization, style/class maps, event modifiers, cleanup and child materialization
 * continue to live in the runtime modules (`applyProps`, `bindEvent`, `appendValue`).
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

/**
 * Runtime helper used by the build transform for dynamic templates.
 *
 * It parses the template once into a tiny compiled tree and hydrates every call with the current
 * interpolation values. Unsupported advanced forms safely fall back to `html```, preserving every
 * existing Fábrica feature instead of maintaining a second implementation.
 */
export function createCompiledTemplate(
  input: RuntimeCompiledTemplate | TemplateStringsArray | readonly string[],
  ...values: readonly RenderValue[]
): HtmlResult {
  return runWithCurrentFabricaRuntime(() => {
    const runtime = getCurrentFabricaRuntime();
    const runtimeDefinition = isRuntimeCompiledTemplate(input);
    const normalizedStrings = runtimeDefinition
      ? null
      : normalizeTemplateStrings(input);
    const compiled = runtimeDefinition
      ? input
      : getCachedCompiledRuntimeTemplate(normalizedStrings!);

    if (!compiled) {
      return html(normalizedStrings!, ...values);
    }

    try {
      const fragment = document.createDocumentFragment();
      const collected = collectCleanupNodes(() => {
        for (const node of compiled.nodes) {
          appendCompiledNode(fragment, node, values);
        }
      });

      pruneInsignificantWhitespace(fragment);

      return createHtmlResult(
        fragment,
        createCompiledHtmlArtifact(
          runtimeDefinition ? input : normalizedStrings!,
          values,
          runtime,
        ),
        {
          cleanupNodes: collected.nodes,
          dynamic: collected.nodes.length > 0,
        },
      );
    } catch (error) {
      // The compiled definition is an optimization, not a second source of truth. If an older
      // transform shape or browser edge case slips through, the normal html runtime remains the
      // semantic fallback for string-template inputs.
      if (!runtimeDefinition) {
        return html(normalizedStrings!, ...values);
      }
      throw error;
    }
  });
}

function createCompiledHtmlArtifact(
  input: RuntimeCompiledTemplate | TemplateStringsArray,
  values: readonly RenderValue[],
  runtime: FabricaRuntimeContext,
): HtmlArtifact {
  const capturedValues = Object.freeze(Array.from(values)) as readonly RenderValue[];
  const artifactStrings = Object.freeze(
    isRuntimeCompiledTemplate(input) ? [] : Array.from(input),
  );

  return Object.freeze({
    kind: "fabrica.html" as const,
    strings: artifactStrings,
    values: capturedValues,
    jsx: false,
    materialize: () =>
      runWithFabricaRuntime(runtime, () =>
        createCompiledTemplate(input, ...capturedValues),
      ),
  });
}

function isRuntimeCompiledTemplate(
  value: unknown,
): value is RuntimeCompiledTemplate {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as { nodes?: unknown }).nodes),
  );
}

/** Applies compiled props and event listeners to an element using runtime semantics. */
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
        const cleanup = (callback as (node: Element) => void | (() => void))(element);
        if (typeof cleanup === "function") {
          // Compiled templates call refs synchronously during DOM creation. The owned runtime path
          // still manages subtree disposal; this direct path intentionally avoids importing owner
          // internals so compiled build remains small and side-effect free.
        }
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
      // A dot binding is an explicit property assignment. Plain functions are
      // valid callback values and must not be executed as reactive expressions.
      // Signals are the only function-like values resolved at this boundary.
      const propertyValue = isSignal(rawValue) ? rawValue() : rawValue;
      setCompiledProperty(element, rawName.slice(1), propertyValue);
      continue;
    }

    // Special attributes own their own null/false/string semantics and must
    // be bound before the generic attribute path drops falsey values.
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


function setCompiledProperty(element: Element, name: string, value: unknown): void {
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

export interface RuntimeCompiledTemplate {
  readonly nodes: readonly RuntimeNode[];
}
export interface RuntimeElementNode {
  readonly type: "element";
  readonly tag: string;
  readonly props: readonly RuntimeProp[];
  readonly children: RuntimeNode[];
}
export interface RuntimeTextNode {
  readonly type: "text";
  readonly value: string;
}
export interface RuntimeValueNode {
  readonly type: "value";
  readonly index: number;
}
export type RuntimeNode =
  RuntimeElementNode | RuntimeTextNode | RuntimeValueNode;
export type RuntimeProp =
  | {
      readonly type: "static";
      readonly name: string;
      readonly value: string | true;
    }
  | { readonly type: "value"; readonly name: string; readonly index: number }
  | {
      readonly type: "compound";
      readonly name: string;
      readonly strings: readonly string[];
      readonly indices: readonly number[];
    }
  | { readonly type: "spread"; readonly index: number };

const runtimeTemplateCache = new Map<string, RuntimeCompiledTemplate | null>();

function getCachedCompiledRuntimeTemplate(
  strings: readonly string[],
): RuntimeCompiledTemplate | null {
  const key = strings.join("\u001f");
  if (runtimeTemplateCache.has(key))
    return runtimeTemplateCache.get(key) ?? null;
  const compiled = compileRuntimeTemplate(strings);
  runtimeTemplateCache.set(key, compiled);
  return compiled;
}

function compileRuntimeTemplate(
  strings: readonly string[],
): RuntimeCompiledTemplate | null {
  if (containsUnsupportedTemplateShape(strings)) return null;
  const source = buildCompiledRuntimeSource(strings);
  const roots = parseRuntimeNodes(source);
  return roots ? { nodes: roots } : null;
}

function containsUnsupportedTemplateShape(strings: readonly string[]): boolean {
  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? "";
    if (chunk.endsWith("<") || chunk.endsWith("</")) return true;
  }
  return false;
}

function buildCompiledRuntimeSource(strings: readonly string[]): string {
  let output = "";
  let inTag = false;
  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? "";
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === "<") inTag = true;
      else if (chunk[i] === ">") inTag = false;
    }
    const nextChunk = strings[index + 1] ?? "";
    const explicitSpread = /\.\.\.\s*$/.test(chunk) && inTag;
    const implicitSpread = isImplicitSpreadSlot(chunk, nextChunk, inTag);
    if (index < strings.length - 1 && (explicitSpread || implicitSpread)) {
      output += explicitSpread ? chunk.replace(/\.\.\.\s*$/, "") : chunk;
      output += ` ${FABRICA_SPREAD_PREFIX}${index}${FABRICA_SPREAD_SUFFIX}`;
      continue;
    }
    output += chunk;
    if (index < strings.length - 1)
      output += `${FABRICA_VALUE_PREFIX}${index}${FABRICA_VALUE_SUFFIX}`;
  }
  return output;
}

function isImplicitSpreadSlot(chunk: string, nextChunk: string, inTag: boolean): boolean {
  if (!inTag || !/\s$/.test(chunk)) return false;
  if (/([.?@:a-zA-Z_][\w:.-]*)\s*=\s*(?:"[^"]*|'[^']*)?$/.test(chunk)) return false;
  if (/^\s*$/.test(nextChunk)) return true;
  return /^\s*(?:\/?>|[.?@:a-zA-Z_][\w:.-]*\s*=|[a-zA-Z_][\w:.-]*(?:\s|\/?>))/.test(nextChunk);
}

function appendCompiledNode(
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

  const element = createElementForTag(node.tag);
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
    const preservedProps = (componentValue as { preserveSignalProps?: ReadonlySet<string> } | null)?.preserveSignalProps;
    const value = prop.type === "value" && isSignal(rawValue) && !preservedProps?.has(name)
      ? rawValue()
      : readCompiledPropValue(prop, values);
    if (name === "props") {
      mergeCompiledComponentSpreadProps(output, value);
    } else {
      output[name] = value;
    }
  }

  return output;
}

function mergeCompiledComponentSpreadProps(target: Record<string, unknown>, value: unknown): void {
  const resolved = readValue(value);
  if (!resolved || typeof resolved !== "object") return;

  for (const [name, item] of Object.entries(resolved as Record<string, unknown>)) {
    target[normalizeCompiledComponentPropName(name)] = isSignal(item) ? item() : item;
  }
}

function normalizeCompiledComponentPropName(name: string): string {
  if (name.startsWith("@")) return compiledEventAttributeToPropName(name.slice(1));
  if (name.startsWith(".")) return name.slice(1);
  if (name.startsWith("?")) return name.slice(1);
  if (name.startsWith(":")) return name.slice(1);
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
    return typeof prop.value === "string" ? decodeHtmlEntities(prop.value) : prop.value;
  }

  let output = "";
  for (let index = 0; index < prop.indices.length; index += 1) {
    output += prop.strings[index] ?? "";
    const segment = readValue(values[prop.indices[index]!] ?? "");
    if (segment == null || segment === false) continue;
    if (segment === true) output += "true";
    else if (segment && typeof segment === "object" && "nodeType" in (segment as object))
      output += (segment as Node).textContent ?? "";
    else output += String(segment);
  }
  return output;
}


const htmlEntityCache = new Map<string, string>();

/** Mirrors browser HTML parsing for static text and attribute chunks in compiled templates. */
function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  const cached = htmlEntityCache.get(value);
  if (cached != null) return cached;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  const decoded = textarea.value;
  htmlEntityCache.set(value, decoded);
  return decoded;
}

function parseRuntimeNodes(source: string): RuntimeNode[] | null {
  const root: RuntimeElementNode = {
    type: "element",
    tag: "#fragment",
    props: [],
    children: [],
  };
  const stack: RuntimeElementNode[] = [root];
  let index = 0;

  while (index < source.length) {
    const lt = source.indexOf("<", index);
    if (lt < 0) {
      pushRuntimeText(source.slice(index));
      break;
    }
    pushRuntimeText(source.slice(index, lt));
    const gt = source.indexOf(">", lt + 1);
    if (gt < 0) return null;
    const token = source.slice(lt + 1, gt).trim();
    if (!token || token.startsWith("!") || token.startsWith("?")) return null;

    if (token.startsWith("/")) {
      const closing = token.slice(1).trim().toLowerCase();
      const node = stack.pop();
      if (!node || node === root || node.tag.toLowerCase() !== closing)
        return null;
    } else {
      const selfClosing = token.endsWith("/");
      const open = selfClosing ? token.slice(0, -1).trim() : token;
      const parsed = parseRuntimeOpenTag(open);
      if (!parsed) return null;
      stack[stack.length - 1]!.children.push(parsed);
      if (!selfClosing && !isVoidTag(parsed.tag)) stack.push(parsed);
    }
    index = gt + 1;
  }

  if (stack.length !== 1) return null;
  return root.children;

  function pushRuntimeText(value: string): void {
    if (!value) return;
    const current = stack[stack.length - 1]!;
    let cursor = 0;
    const markerRe = /%%fabrica_value_(\d+)%%/g;
    let match: RegExpExecArray | null;
    while ((match = markerRe.exec(value))) {
      const before = value.slice(cursor, match.index);
      if (before) current.children.push({ type: "text", value: before });
      current.children.push({ type: "value", index: Number(match[1]) });
      cursor = markerRe.lastIndex;
    }
    const tail = value.slice(cursor);
    if (tail) current.children.push({ type: "text", value: tail });
  }
}

function parseRuntimeOpenTag(open: string): RuntimeElementNode | null {
  const match = open.match(/^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/);
  if (!match) return null;
  const tag = match[1]!;
  const props = parseRuntimeAttributes(match[2] ?? "");
  if (!props) return null;
  return { type: "element", tag, props, children: [] };
}

function parseRuntimeAttributes(source: string): RuntimeProp[] | null {
  const props: RuntimeProp[] = [];
  const re = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>`=]+))?/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    if (source.slice(cursor, match.index).trim()) return null;
    const rawName = match[1]!;
    const rawValue = match[2];
    const spread = readSpreadMarker(rawName);
    if (spread != null) props.push({ type: "spread", index: spread });
    else {
      const name = normalizeAttributeName(rawName);
      const value = rawValue == null ? true : unquote(rawValue);
      if (typeof value !== "string")
        props.push({ type: "static", name, value });
      else {
        const marker = readValueMarker(value);
        if (marker != null) props.push({ type: "value", name, index: marker });
        else {
          const compound = splitRuntimeCompoundValue(value);
          props.push(
            compound
              ? {
                  type: "compound",
                  name,
                  strings: compound.strings,
                  indices: compound.indices,
                }
              : { type: "static", name, value },
          );
        }
      }
    }
    cursor = re.lastIndex;
  }
  if (source.slice(cursor).trim()) return null;
  return props;
}

function splitRuntimeCompoundValue(
  value: string,
): { strings: string[]; indices: number[] } | null {
  const strings: string[] = [];
  const indices: number[] = [];
  let cursor = 0;
  const markerRe = /%%fabrica_value_(\d+)%%/g;
  let match: RegExpExecArray | null;
  while ((match = markerRe.exec(value))) {
    strings.push(value.slice(cursor, match.index));
    indices.push(Number(match[1]));
    cursor = markerRe.lastIndex;
  }
  if (indices.length === 0) return null;
  strings.push(value.slice(cursor));
  return { strings, indices };
}

function isEventPropName(name: string): boolean {
  return /^on[A-Z]/.test(name) || /^on[a-z]+(?:[.:_-]|$)/.test(name);
}

function eventNameFromProp(name: string): string {
  const raw = name.startsWith("on") ? name.slice(2) : name;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function resolveCompiledComponentTag(
  tag: string,
): string | ((props: FabricaCompiledElementProps) => RenderValue) | null {
  if (!/^[A-Z]/.test(tag)) return null;
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
  for (const child of children)
    collectCompiledChildValue(child, values, output);
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

  const element = createElementForTag(node.tag);
  const props: Record<string, unknown> = {};
  for (const prop of node.props) {
    if (prop.type === "spread")
      Object.assign(props, values[prop.index] as FabricaCompiledElementProps);
    else props[prop.name] = readCompiledPropValue(prop, values);
  }
  applyCompiledProps(element, props);
  for (const child of node.children) appendCompiledNode(element, child, values);
  output.push(element);
}
