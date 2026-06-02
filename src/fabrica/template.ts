import { ATTR_MARKER_PREFIX, ATTR_MARKER_SUFFIX, TEXT_MARKER_PREFIX } from "@/constants";
import { debugState } from "@/debug";
import type { CompiledTemplate, TemplatePart } from "@/types";

/** Template compilation cache keyed by the browser-owned TemplateStringsArray. */
const templateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();

/**
 * Gets a compiled template from cache or compiles a new one.
 *
 * @param strings - Template strings.
 * @returns Compiled template and static part metadata.
 *
 * @example
 * ```ts
 * const compiled = getCompiledTemplate(strings);
 * ```
 */
export function getCompiledTemplate(strings: TemplateStringsArray): CompiledTemplate {
  const cached = templateCache.get(strings);

  if (cached) {
    return cached;
  }

  const template = document.createElement("template");
  template.innerHTML = buildTemplateSource(strings);

  const parts = compileParts(template.content);
  const compiled: CompiledTemplate = { template, parts };

  templateCache.set(strings, compiled);
  debugState.templates += 1;
  debugState.parts += parts.length;

  return compiled;
}

/**
 * Builds template HTML with text and attribute markers.
 *
 * @param strings - Static template chunks.
 * @returns HTML source with markers.
 */
export function buildTemplateSource(strings: TemplateStringsArray): string {
  let source = "";

  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? "";
    source += chunk;

    if (index >= strings.length - 1) {
      continue;
    }

    source += isAttributePosition(chunk)
      ? `${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}`
      : `<!--${TEXT_MARKER_PREFIX}${index}-->`;
  }

  return source;
}

/**
 * Detects if interpolation appears in an attribute assignment.
 *
 * @param chunk - Static chunk before interpolation.
 * @returns Whether the next value belongs to an attribute.
 */
export function isAttributePosition(chunk: string): boolean {
  return /(?:[.?@:a-zA-Z_][\w:.-]*)\s*=\s*(?:"[^"]*|'[^']*)?$/.test(chunk);
}

/**
 * Compiles child and attribute parts from a template root.
 *
 * @param root - Template content root.
 * @returns Template parts.
 */
function compileParts(root: DocumentFragment): TemplatePart[] {
  const parts: TemplatePart[] = [];

  compileChildParts(root, parts);
  compileAttributeParts(root, parts);

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

    parts.push({ type: "child", index: Number(value.slice(TEXT_MARKER_PREFIX.length)), path: getNodePath(root, node) });
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
    const attributes = Array.from(element.attributes);

    for (let index = 0; index < attributes.length; index += 1) {
      const attribute = attributes[index];

      if (!attribute) {
        continue;
      }

      const markerIndex = getAttributeMarkerIndex(attribute.value);

      if (markerIndex === -1) {
        continue;
      }

      parts.push({ type: "attribute", index: markerIndex, path: getNodePath(root, element), name: attribute.name });
      element.removeAttribute(attribute.name);
    }
  }
}

/**
 * Reads a marker index from an attribute value.
 *
 * @param value - Attribute value.
 * @returns Marker index or -1.
 */
function getAttributeMarkerIndex(value: string): number {
  const start = value.indexOf(ATTR_MARKER_PREFIX);

  if (start === -1) {
    return -1;
  }

  return Number(value.slice(start + ATTR_MARKER_PREFIX.length).split(ATTR_MARKER_SUFFIX)[0]);
}

/**
 * Builds a stable child-index path to a node.
 *
 * @param root - Root node.
 * @param node - Target node.
 * @returns Path from root to node.
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
 * Resolves a path inside a cloned fragment.
 *
 * @param root - Clone root.
 * @param path - Previously compiled path.
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
 * Sorts parts in reverse DOM order so replacements do not shift unresolved siblings.
 *
 * @param left - Left path.
 * @param right - Right path.
 * @returns Sort number.
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

/**
 * Gets child index using sibling traversal instead of allocating arrays.
 *
 * @param parentNode - Parent node.
 * @param child - Child node.
 * @returns Child index.
 */
function indexOfChild(parentNode: Node, child: Node): number {
  let index = 0;
  let current: ChildNode | null = parentNode.firstChild;

  while (current && current !== child) {
    index += 1;
    current = current.nextSibling;
  }

  return index;
}
