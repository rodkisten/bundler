import { ATTR_MARKER_PREFIX, ATTR_MARKER_SUFFIX, TEXT_MARKER_PREFIX } from "./constants";
import { debugState } from "./debug";
import type { CompiledTemplate, RenderValue, TemplatePart } from "./types";

/** Template compilation cache keyed by the browser-owned TemplateStringsArray. */
const templateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();
const jsxTemplateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();
const JSX_COMPONENT_NAME = "[A-Z][A-Za-z0-9_$.-]*";

/**
 * Gets a compiled template from cache or compiles a new one.
 *
 * @remarks
 * The compiler understands normal child/attribute markers and Fabrica component
 * tags. Component tags are authored as real template syntax:
 *
 * ```ts
 * html`
 *   <${Button} tone="primary">
 *     Save
 *   </${Button}>
 * `
 * ```
 *
 * Internally, the opening component interpolation becomes a hidden
 * `<template data-fabrica-component="...">` node. At runtime that node is
 * replaced with the component output and its children are passed as
 * `props.children`.
 *
 * @param strings - Template strings.
 * @param values - Runtime values. Only used to detect component tag positions.
 * @returns Compiled template and static part metadata.
 *
 * @example Input
 * ```ts
 * html`<${Button} tone="primary">Save</${Button}>`
 * ```
 *
 * @example Generated shape
 * ```html
 * <template data-fabrica-component="0" tone="primary">Save</template>
 * ```
 */
export function getCompiledTemplate(strings: TemplateStringsArray, values: readonly RenderValue[] = []): CompiledTemplate {
  return getCompiledTemplateWithMode(strings, values, false);
}

/**
 * Gets a compiled micro-JSX template from cache or compiles a new one.
 *
 * @remarks
 * Micro-JSX supports registered uppercase component tags such as `<Panel />`
 * while leaving HTML comments alone. Commented components therefore behave like
 * React comments: `<!-- <Panel /> -->` remains a browser comment and does not
 * mount the component.
 *
 * @param strings - Template strings.
 * @param values - Runtime values.
 * @returns Compiled template and static part metadata.
 */
export function getCompiledJsxTemplate(strings: TemplateStringsArray, values: readonly RenderValue[] = []): CompiledTemplate {
  return getCompiledTemplateWithMode(strings, values, true);
}

function getCompiledTemplateWithMode(strings: TemplateStringsArray, values: readonly RenderValue[], jsx: boolean): CompiledTemplate {
  const cache = jsx ? jsxTemplateCache : templateCache;
  const cached = cache.get(strings);

  if (cached) {
    return cached;
  }

  const template = document.createElement("template");
  template.innerHTML = buildTemplateSource(strings, values, { jsx });

  const parts = compileParts(template.content);
  const compiled: CompiledTemplate = { template, parts };

  cache.set(strings, compiled);
  debugState.templates += 1;
  debugState.parts += parts.length;

  return compiled;
}

/**
 * Builds template HTML with text, attribute and component markers.
 *
 * @param strings - Static template chunks.
 * @param values - Runtime values.
 * @param options - Compiler mode options.
 * @returns HTML source with markers.
 */
export function buildTemplateSource(strings: TemplateStringsArray, values: readonly RenderValue[] = [], options: { jsx?: boolean } = {}): string {
  let source = "";
  let skipNextPrefix = "";

  for (let index = 0; index < strings.length; index += 1) {
    let chunk = strings[index] ?? "";

    if (skipNextPrefix && chunk.startsWith(skipNextPrefix)) {
      chunk = chunk.slice(skipNextPrefix.length);
      skipNextPrefix = "";
    }

    if (index < strings.length - 1 && isSpreadAttributePosition(chunk)) {
      source += chunk.replace(/\.\.\.\s*$/, "");
      source += ` data-fabrica-spread="${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}"`;
      continue;
    }

    source += chunk;

    if (index >= strings.length - 1) {
      continue;
    }

    const value = values[index];

    if (isComponentTagValue(value) && chunk.endsWith("<")) {
      const nextChunk = strings[index + 1] ?? "";
      const selfClose = nextChunk.match(/^\s*\/\s*>/);

      if (selfClose) {
        source += `template data-fabrica-component="${index}"></template>`;
        skipNextPrefix = selfClose[0];
        continue;
      }

      source += `template data-fabrica-component="${index}"`;
      continue;
    }

    if (isComponentTagValue(value) && chunk.endsWith("</")) {
      source += "template";
      continue;
    }

    source += isAttributePosition(chunk)
      ? `${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}`
      : `<!--${TEXT_MARKER_PREFIX}${index}-->`;
  }

  return options.jsx ? transformMicroJsxChunk(source) : source;
}

function isComponentTagValue(value: unknown): boolean {
  return typeof value === "function";
}

/**
 * Detects object-spread syntax inside an open tag.
 *
 * @remarks
 * Fabrica accepts a template-only spread form such as `<button ...${props}>`.
 * Browsers do not understand `...` attributes, so the compiler removes the
 * ellipsis and emits a hidden marker attribute that is later bound as a props
 * object.
 *
 * @param chunk - Static chunk before interpolation.
 * @returns Whether the next value is a spread props object.
 */
export function isSpreadAttributePosition(chunk: string): boolean {
  return /\.\.\.\s*$/.test(chunk) && chunk.lastIndexOf("<") > chunk.lastIndexOf(">");
}

/**
 * Rewrites uppercase micro-JSX component tags to component placeholders.
 *
 * @remarks
 * HTML comments are preserved before rewriting, so commented component tags do
 * not become live placeholders. This keeps `jsx.html` aligned with the React
 * mental model where commented component markup is inert.
 *
 * @param chunk - Source HTML.
 * @returns Source with component placeholders.
 */
export function transformMicroJsxChunk(chunk: string): string {
  if (!chunk || (chunk.indexOf("<") === -1 && chunk.indexOf("</") === -1)) {
    return chunk;
  }

  return transformOutsideHtmlComments(chunk, (source) => {
    let output = rewriteExplicitComponentTags(source);

    output = output.replace(
      new RegExp(`<(${JSX_COMPONENT_NAME})([^<>]*?)\\/\\s*>`, "g"),
      (_match, name: string, attrs: string) => `<template data-fabrica-component-name="${escapeComponentName(name)}"${attrs || ""}></template>`,
    );

    output = output.replace(
      new RegExp(`<(${JSX_COMPONENT_NAME})([^<>]*?)>`, "g"),
      (_match, name: string, attrs: string) => `<template data-fabrica-component-name="${escapeComponentName(name)}"${attrs || ""}>`,
    );

    output = output.replace(new RegExp(`</(${JSX_COMPONENT_NAME})\\s*>`, "g"), "</template>");

    return output;
  });
}

function transformOutsideHtmlComments(source: string, transform: (chunk: string) => string): string {
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const commentStart = source.indexOf("<!--", cursor);

    if (commentStart === -1) {
      output += transform(source.slice(cursor));
      break;
    }

    output += transform(source.slice(cursor, commentStart));

    const commentEnd = source.indexOf("-->", commentStart + 4);

    if (commentEnd === -1) {
      output += source.slice(commentStart);
      break;
    }

    output += source.slice(commentStart, commentEnd + 3);
    cursor = commentEnd + 3;
  }

  return output;
}

function rewriteExplicitComponentTags(chunk: string): string {
  return chunk
    .replace(/<f-component\b([^<>]*?)\/\s*>/g, (_match, attrs: string) => `<template data-fabrica-explicit-component="true"${attrs || ""}></template>`)
    .replace(/<f-component\b([^<>]*?)>/g, (_match, attrs: string) => `<template data-fabrica-explicit-component="true"${attrs || ""}>`)
    .replace(/<\/f-component\s*>/g, "</template>");
}

function escapeComponentName(name: string): string {
  return String(name).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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

      if (attribute.name === "data-fabrica-spread") {
        parts.push({ type: "spread", index: markerIndex, path: getNodePath(root, element) });
        element.removeAttribute(attribute.name);
        continue;
      }

      parts.push({ type: "attribute", index: markerIndex, path: getNodePath(root, element), name: attribute.name });
      element.removeAttribute(attribute.name);
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
  const templates = Array.from(
    root.querySelectorAll("template[data-fabrica-component], template[data-fabrica-component-name], template[data-fabrica-explicit-component]"),
  );

  for (let index = 0; index < templates.length; index += 1) {
    const element = templates[index];
    const rawIndex = element.getAttribute("data-fabrica-component");
    const rawName = element.getAttribute("data-fabrica-component-name") || element.getAttribute("name") || "";
    const componentIndex = rawIndex == null ? -1 : Number(rawIndex);

    if (rawIndex != null && !Number.isFinite(componentIndex)) {
      continue;
    }

    parts.push({
      type: "component",
      index: componentIndex,
      path: getNodePath(root, element),
      name: rawName || undefined,
    });
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
