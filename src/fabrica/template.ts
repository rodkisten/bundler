import { ATTR_MARKER_PREFIX, ATTR_MARKER_SUFFIX, TEXT_MARKER_PREFIX } from "./constants";
import { debugState } from "./debug";
import type { CompiledTemplate, RenderValue, TemplatePart } from "./types";

/** Template compilation cache keyed by the browser-owned TemplateStringsArray. */
const templateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();
const jsxTemplateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();
const namedComponentSyntaxCache = new WeakMap<TemplateStringsArray, boolean>();
const JSX_COMPONENT_NAME = "[A-Z][A-Za-z0-9_$.-]*";
const ATTR_NAME_MARKER_SUFFIX = "__fabrica_attr_name_end__";

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
  return getCompiledTemplateWithMode(strings, values, hasNamedComponentTagSyntax(strings));
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

/**
 * Detects registered-component syntax with a tiny static-chunk scan.
 *
 * @remarks
 * Normal `html`` ` remains on its original cache/compiler path unless a static
 * chunk contains `<Uppercase...` or `</Uppercase...`. Named styled components
 * can therefore be authored without passing their function to the template,
 * while ordinary templates pay only this bounded character scan once per call.
 */
export function hasNamedComponentTagSyntax(strings: TemplateStringsArray): boolean {
  const cached = namedComponentSyntaxCache.get(strings);
  if (cached !== undefined) return cached;

  for (let chunkIndex = 0; chunkIndex < strings.length; chunkIndex += 1) {
    const chunk = strings[chunkIndex] ?? "";
    for (let index = 0; index < chunk.length - 1; index += 1) {
      if (chunk[index] !== "<") continue;
      let nameIndex = index + 1;
      if (chunk[nameIndex] === "/") nameIndex += 1;
      const code = chunk.charCodeAt(nameIndex);
      if (code >= 65 && code <= 90) {
        namedComponentSyntaxCache.set(strings, true);
        return true;
      }
    }
  }
  namedComponentSyntaxCache.set(strings, false);
  return false;
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

    const attributeName = readAttributeBindingName(chunk) || readOpenAttributeBindingName(source);
    source += attributeName
      ? `${ATTR_MARKER_PREFIX}${index}${ATTR_MARKER_SUFFIX}${encodeURIComponent(attributeName)}${ATTR_NAME_MARKER_SUFFIX}`
      : `<!--${TEXT_MARKER_PREFIX}${index}-->`;
  }

  const normalizedSource = normalizeInterpolatedComponentSelfClosingTags(source);
  return options.jsx ? transformMicroJsxChunk(normalizedSource) : normalizedSource;
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
  return readAttributeBindingName(chunk) !== "";
}

/**
 * Reads the exact author-provided attribute or component prop name.
 *
 * @remarks
 * HTML parsers lowercase attribute names, which used to turn component props
 * such as `onClick` into `onclick`. The original spelling is encoded in the
 * marker value and restored during part compilation, while normal DOM binding
 * keeps the same behavior as before.
 *
 * @param chunk - Static chunk before an interpolation.
 * @returns Original binding name or an empty string.
 */
export function readAttributeBindingName(chunk: string): string {
  const match = /([.?@:a-zA-Z_][\w:.-]*)\s*=\s*(?:"[^"]*|'[^']*)?$/.exec(chunk);
  return match?.[1] ?? "";
}

/**
 * Reads the attribute whose value is still open at the end of generated source.
 *
 * @remarks
 * `readAttributeBindingName()` handles the common first interpolation cheaply.
 * This fallback is only used for compound values such as
 * `class="${base} ${tone}"`, where later interpolations no longer have the
 * attribute name in their immediate static chunk. Template compilation is
 * cached, so this quote-aware scan never runs on DOM updates.
 */
function readOpenAttributeBindingName(source: string): string {
  const tagStart = findOpenTagStart(source);
  if (tagStart < 0) return "";

  let index = tagStart + 1;
  if (source[index] === "/") index += 1;

  while (index < source.length && !/\s/.test(source[index] ?? "") && source[index] !== ">") index += 1;

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    if (index >= source.length || source[index] === ">" || source[index] === "/") return "";

    const nameStart = index;
    while (index < source.length && !/[\s=/>]/.test(source[index] ?? "")) index += 1;
    const name = source.slice(nameStart, index);

    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    if (source[index] !== "=") continue;

    index += 1;
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    if (index >= source.length) return name;

    const quote = source[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      let escaped = false;

      while (index < source.length) {
        const char = source[index];
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === quote) {
          index += 1;
          break;
        }
        index += 1;
      }

      if (index >= source.length && source[source.length - 1] !== quote) return name;
      continue;
    }

    while (index < source.length && !/[\s>]/.test(source[index] ?? "")) index += 1;
    if (index >= source.length) return name;
  }

  return "";
}

/** Finds the current opening tag while ignoring comments and quoted `>` text. */
function findOpenTagStart(source: string): number {
  let tagStart = -1;
  let quote: '"' | "'" | null = null;
  let inComment = false;

  for (let index = 0; index < source.length; index += 1) {
    if (inComment) {
      if (source.startsWith("-->", index)) {
        inComment = false;
        index += 2;
      }
      continue;
    }

    if (source.startsWith("<!--", index)) {
      inComment = true;
      index += 3;
      continue;
    }

    const char = source[index];
    if (tagStart >= 0) {
      if (quote) {
        if (char === quote && source[index - 1] !== "\\") quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === ">") tagStart = -1;
      continue;
    }

    if (char === "<" && /[A-Za-z/]/.test(source[index + 1] ?? "")) tagStart = index;
  }

  return tagStart;
}

/**
 * Converts HTML-ignored self-closing component placeholders into explicit
 * `<template></template>` pairs.
 *
 * @remarks
 * Browsers ignore the self-closing slash on non-void HTML elements. Without
 * this normalization, `<${Component} prop=${value} />` swallows every following
 * sibling into the first template element. The scanner is quote-aware and only
 * touches Fabrica component placeholders, keeping ordinary HTML untouched.
 *
 * @param source - Marker-rich template source.
 * @returns Source with explicit closing template tags.
 */
export function normalizeInterpolatedComponentSelfClosingTags(source: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf("<template", cursor);

    if (start < 0) {
      output += source.slice(cursor);
      break;
    }

    output += source.slice(cursor, start);

    const close = findTagClose(source, start + 9);
    if (close < 0) {
      output += source.slice(start);
      break;
    }

    const openingTag = source.slice(start, close + 1);
    const isComponentPlaceholder =
      openingTag.includes("data-fabrica-component=") ||
      openingTag.includes("data-fabrica-component-name=") ||
      openingTag.includes("data-fabrica-explicit-component=");

    let slashIndex = close - 1;
    while (slashIndex > start && /\s/.test(source[slashIndex] ?? "")) slashIndex -= 1;

    if (isComponentPlaceholder && source[slashIndex] === "/") {
      output += source.slice(start, slashIndex) + source.slice(slashIndex + 1, close + 1) + "</template>";
    } else {
      output += openingTag;
    }

    cursor = close + 1;
  }

  return output;
}

function findTagClose(source: string, start: number): number {
  let quote: '"' | "'" | null = null;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") return index;
  }

  return -1;
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

      const markerState = readAttributeMarkers(attribute.value);

      if (!markerState) {
        continue;
      }

      if (attribute.name === "data-fabrica-spread") {
        parts.push({ type: "spread", index: markerState.indices[0]!, path: getNodePath(root, element) });
        element.removeAttribute(attribute.name);
        continue;
      }

      parts.push({
        type: "attribute",
        index: markerState.indices[0]!,
        indices: markerState.indices,
        strings: markerState.strings,
        raw: markerState.raw,
        path: getNodePath(root, element),
        name: markerState.name || attribute.name,
      });
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
