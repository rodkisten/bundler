import {
  ATTR_MARKER_PREFIX,
  ATTR_MARKER_SUFFIX,
  TEXT_MARKER_PREFIX,
} from "../core/constants.js";
import { normalizeStaticComponentPropName } from
  "../bindings/component-props.js";
import type {
  ComponentPropPart,
  TemplatePart,
} from "../types.js";
import { ATTR_NAME_MARKER_SUFFIX } from "./source.js";

/**
 * Compiles child, attribute and component parts from a template root.
 *
 * @param root - Template content root.
 * @returns Template parts.
 */
export function compileParts(root: DocumentFragment): TemplatePart[] {
  const parts: TemplatePart[] = [];

  compileChildParts(root, parts);
  compileAttributeParts(root, parts);
  compileComponentParts(root, parts);

  return parts;
}

/**
 * Compiles child comment markers.
 *
 * @param root - Template root.
 * @param parts - Parts accumulator.
 */
function compileChildParts(root: DocumentFragment, parts: TemplatePart[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue ?? "";

    if (!value.startsWith(TEXT_MARKER_PREFIX)) {
      continue;
    }

    parts.push(withPartMeta({ type: "child", index: Number(value.slice(TEXT_MARKER_PREFIX.length)), path: getNodePath(root, node) }, parts.length));
  }
}

/**
 * Compiles attribute markers.
 *
 * @param root - Template root.
 * @param parts - Parts accumulator.
 */
function compileAttributeParts(root: DocumentFragment, parts: TemplatePart[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

  while (walker.nextNode()) {
    const element = walker.currentNode as Element;
    const attributesToRemove: string[] = [];

    for (let index = 0; index < element.attributes.length; index += 1) {
      const attribute = element.attributes[index];

      if (!attribute) {
        continue;
      }

      const markerState = readAttributeMarkers(attribute.value);

      if (!markerState) {
        continue;
      }

      attributesToRemove.push(attribute.name);

      if (attribute.name === "data-fabrica-spread") {
        parts.push(withPartMeta({ type: "spread", index: markerState.indices[0]!, path: getNodePath(root, element) }, parts.length));
        continue;
      }

      parts.push(withPartMeta({
        type: "attribute",
        index: markerState.indices[0]!,
        indices: markerState.indices,
        strings: markerState.strings,
        raw: markerState.raw,
        path: getNodePath(root, element),
        name: markerState.name || attribute.name,
      }, parts.length));
    }

    for (let index = 0; index < attributesToRemove.length; index += 1) {
      element.removeAttribute(attributesToRemove[index]!);
    }
  }
}

/**
 * Compiles component placeholders created by component-tag syntax.
 *
 * @param root - Template root.
 * @param parts - Parts accumulator.
 */
function compileComponentParts(root: DocumentFragment, parts: TemplatePart[]): void {
  const templates = root.querySelectorAll("template[data-fabrica-component], template[data-fabrica-component-name], template[data-fabrica-explicit-component]");

  for (let index = 0; index < templates.length; index += 1) {
    const element = templates[index] as HTMLTemplateElement;
    const rawIndex = element.getAttribute("data-fabrica-component");
    const rawName = element.getAttribute("data-fabrica-component-name") || element.getAttribute("name") || "";
    const componentIndex = rawIndex == null ? -1 : Number(rawIndex);

    if (rawIndex != null && !Number.isFinite(componentIndex)) {
      continue;
    }

    const childParts = compileParts(element.content);
    const orderedChildParts = childParts.length > 1
      ? childParts.slice().sort((left, right) => comparePathsReverse(left.path, right.path))
      : childParts;
    const componentPath = getNodePath(root, element);
    const componentPathKey = createPathKey(componentPath);
    const dynamicPropParts = compileDynamicComponentProps(componentPathKey, parts);

    parts.push(withPartMeta({
      type: "component",
      index: componentIndex,
      path: componentPath,
      name: rawName || undefined,
      staticProps: compileStaticComponentProps(element),
      childParts,
      orderedChildParts,
      hasChildComponents: childParts.some((childPart) => childPart.type === "component"),
      hasStaticChildren: hasMeaningfulStaticChildren(element.content),
      dynamicPropParts,
      hasDynamicPropParts: dynamicPropParts.length > 0,
    }, parts.length));
  }
}


function hasMeaningfulStaticChildren(fragment: DocumentFragment): boolean {
  const children = fragment.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child) continue;
    if (child.nodeType === Node.ELEMENT_NODE) return true;
    if (child.nodeType === Node.TEXT_NODE && (child.nodeValue ?? "").trim()) return true;
  }

  return false;
}

function compileDynamicComponentProps(pathKey: string, parts: TemplatePart[]): ComponentPropPart[] {
  const output: ComponentPropPart[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part || part.pathKey !== pathKey) continue;

    if (part.type === "spread") {
      part.componentProp = true;
      output[output.length] = { index: part.index, spread: true };
      continue;
    }

    if (part.type === "attribute") {
      part.componentProp = true;
      output[output.length] = {
        name: part.name,
        index: part.index,
        indices: part.indices,
        strings: part.strings,
        raw: part.raw,
      };
    }
  }

  return output;
}

function compileStaticComponentProps(template: HTMLTemplateElement): Record<string, unknown> | undefined {
  let props: Record<string, unknown> | null = null;

  for (let index = 0; index < template.attributes.length; index += 1) {
    const attribute = template.attributes[index];

    if (
      !attribute ||
      attribute.name === "data-fabrica-component" ||
      attribute.name === "data-fabrica-component-name" ||
      attribute.name === "data-fabrica-explicit-component" ||
      attribute.name === "name"
    ) {
      continue;
    }

    props ??= {};
    props[normalizeStaticComponentPropName(attribute.name)] = attribute.value;
  }

  return props ?? undefined;
}

/**
 * Reads a marker index from an attribute value.
 *
 * @param value - Attribute value.
 * @returns Marker index or -1.
 */
function readAttributeMarkers(value: string): {
  indices: number[];
  strings: string[];
  name: string;
  raw: boolean;
} | null {
  const indices: number[] = [];
  const strings: string[] = [];
  let name = "";
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf(ATTR_MARKER_PREFIX, cursor);
    if (start === -1) break;

    const indexStart = start + ATTR_MARKER_PREFIX.length;
    const suffix = value.indexOf(ATTR_MARKER_SUFFIX, indexStart);
    if (suffix === -1) break;

    const interpolationIndex = Number(value.slice(indexStart, suffix));
    if (!Number.isFinite(interpolationIndex)) {
      cursor = suffix + ATTR_MARKER_SUFFIX.length;
      continue;
    }

    strings.push(value.slice(cursor, start));
    indices.push(interpolationIndex);

    let markerEnd = suffix + ATTR_MARKER_SUFFIX.length;
    const nameEnd = value.indexOf(ATTR_NAME_MARKER_SUFFIX, markerEnd);

    if (nameEnd !== -1) {
      const encodedName = value.slice(markerEnd, nameEnd);
      if (encodedName && !name) {
        try {
          name = decodeURIComponent(encodedName);
        } catch {
          name = encodedName;
        }
      }
      markerEnd = nameEnd + ATTR_NAME_MARKER_SUFFIX.length;
    }

    cursor = markerEnd;
  }

  if (indices.length === 0) return null;

  strings.push(value.slice(cursor));
  const raw = indices.length === 1 && strings.length === 2 && strings[0] === "" && strings[1] === "";
  return { indices, strings, name, raw };
}


function withPartMeta<T extends Omit<TemplatePart, "pathKey" | "order">>(part: T, order: number): T & { pathKey: string; order: number } {
  return { ...part, pathKey: createPathKey(part.path), order };
}

function createPathKey(path: readonly number[]): string {
  let key = "";

  for (let index = 0; index < path.length; index += 1) {
    if (index > 0) key += ".";
    key += path[index];
  }

  return key;
}

/**
 * Builds a stable child-index path to a node.
 *
 * @param root - Root node.
 * @param node - Target node.
 * @returns Path indexes.
 */
export function getNodePath(root: Node, node: Node): number[] {
  const path: number[] = [];
  let current: Node | null = node;

  while (current && current !== root) {
    const parentNode: Node | null = current.parentNode;

    if (!parentNode) {
      break;
    }

    path.push(indexOfChild(parentNode, current));
    current = parentNode;
  }

  path.reverse();
  return path;
}

/**
 * Resolves a previously compiled node path inside a cloned fragment.
 *
 * @param root - Cloned root.
 * @param path - Child-index path.
 * @returns Resolved node or null.
 */
export function resolvePath(root: Node, path: readonly number[]): Node | null {
  let current: Node | null = root;

  for (let index = 0; index < path.length; index += 1) {
    const childIndex = path[index];

    if (childIndex == null) {
      return null;
    }

    current = current.childNodes[childIndex] ?? null;

    if (!current) {
      return null;
    }
  }

  return current;
}

/**
 * Sorts paths from deepest/right-most to shallowest/left-most.
 *
 * @param left - Left path.
 * @param right - Right path.
 * @returns Sort order.
 */
export function comparePathsReverse(left: readonly number[], right: readonly number[]): number {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? -1;
    const rightValue = right[index] ?? -1;

    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return right.length - left.length;
}

function indexOfChild(parentNode: Node, child: Node): number {
  let index = 0;
  let current = parentNode.firstChild;

  while (current && current !== child) {
    index += 1;
    current = current.nextSibling;
  }

  return index;
}
