import {
  ATTR_MARKER_PREFIX,
  ATTR_MARKER_SUFFIX,
  TEXT_MARKER_PREFIX,
} from "../core/constants.js";
import {
  encodeLiteralDataAttributeName,
  toDataAttributeKebabCase,
} from "../data-attributes.js";
import type { RenderValue } from "../types.js";

const JSX_COMPONENT_NAME = "[\\p{Lu}][\\p{L}\\p{N}_$.-]*";
export const ATTR_NAME_MARKER_SUFFIX =
  "__fabrica_attr_name_end__";

/**
 * Builds template HTML with text, attribute and component markers.
 *
 * @param strings - Static template chunks.
 * @param values - Runtime values.
 * @param options - Compiler mode options.
 * @returns HTML source with markers.
 */
export function buildTemplateSource(
  strings: TemplateStringsArray,
  values: readonly RenderValue[] = [],
  options: { jsx?: boolean } = {},
): string {
  let source = "";
  let skipNextPrefix = "";

  for (let index = 0; index < strings.length; index += 1) {
    let chunk = strings[index] ?? "";

    if (skipNextPrefix && chunk.startsWith(skipNextPrefix)) {
      chunk = chunk.slice(skipNextPrefix.length);
      skipNextPrefix = "";
    }

    if (
      index < strings.length - 1
      && (
        isSpreadAttributePosition(chunk) ||
        isImplicitSpreadAttributePosition(
          chunk,
          strings[index + 1] ?? "",
        )
      )
    ) {
      source += isSpreadAttributePosition(chunk)
        ? chunk.replace(/\.\.\.\s*$/, "")
        : chunk;
      source += [
        ' data-fabrica-spread="',
        ATTR_MARKER_PREFIX,
        index,
        ATTR_MARKER_SUFFIX,
        '"',
      ].join("");
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

    const attributeName =
      readAttributeBindingName(chunk) ||
      readOpenAttributeBindingName(source);
    source += attributeName
      ? [
          ATTR_MARKER_PREFIX,
          index,
          ATTR_MARKER_SUFFIX,
          encodeURIComponent(attributeName),
          ATTR_NAME_MARKER_SUFFIX,
        ].join("")
      : `<!--${TEXT_MARKER_PREFIX}${index}-->`;
  }

  const normalizedSource = normalizeStaticDataAttributeNames(
    normalizeQuotedDataAttributeNames(
      normalizeInterpolatedComponentSelfClosingTags(source),
    ),
  );
  return options.jsx
    ? transformMicroJsxChunk(normalizedSource)
    : normalizedSource;
}

function isComponentTagValue(value: unknown): boolean {
  return typeof value === "function";
}


/** Rewrites quoted data names to a parser-safe internal representation. */
export function normalizeQuotedDataAttributeNames(source: string): string {
  let output = "";
  let index = 0;
  let inTag = false;
  let quote: '"' | "'" | null = null;

  while (index < source.length) {
    if (!inTag && source.startsWith("<!--", index)) {
      const commentEnd = source.indexOf("-->", index + 4);
      if (commentEnd === -1) return output + source.slice(index);
      output += source.slice(index, commentEnd + 3);
      index = commentEnd + 3;
      continue;
    }

    const char = source[index]!;
    if (!inTag) {
      inTag = char === "<" && /[A-Za-z/]/.test(source[index + 1] ?? "");
      output += char;
      index += 1;
      continue;
    }

    if (quote) {
      output += char;
      if (char === quote && source[index - 1] !== "\\") quote = null;
      index += 1;
      continue;
    }

    if (char === ">") {
      inTag = false;
      output += char;
      index += 1;
      continue;
    }

    if (char === "'" || (char === '"' && source[index - 1] !== ":")) {
      quote = char;
      output += char;
      index += 1;
      continue;
    }

    if (char === ":" && source[index + 1] === '"') {
      const nameEnd = source.indexOf('"', index + 2);
      const next = nameEnd === -1 ? "" : source[nameEnd + 1] ?? "";
      if (nameEnd !== -1 && nameEnd > index + 2 && /[\s=/>]/.test(next)) {
        output += encodeLiteralDataAttributeName(
          source.slice(index + 2, nameEnd),
        );
        index = nameEnd + 1;
        continue;
      }
    }

    output += char;
    index += 1;
  }

  return output;
}

/** Preserves camelCase static `:dataName` before HTML lowercases it. */
export function normalizeStaticDataAttributeNames(source: string): string {
  return transformTagAttributeNames(source, (name) => {
    if (
      !name.startsWith(":") ||
      name === ":data" ||
      name.startsWith(":__fabrica_literal_data__")
    ) {
      return name;
    }

    const rawName = name.slice(1);
    if (!/[A-Z]/.test(rawName)) return name;
    return `:${toDataAttributeKebabCase(rawName)}`;
  });
}

/** Rewrites names only inside opening tags, preserving comments and values. */
function transformTagAttributeNames(
  source: string,
  transform: (name: string) => string,
): string {
  return source.replace(/<([A-Za-z][^<>]*?)>/g, (tag) => {
    let output = "";
    let index = 0;
    let quote: string | null = null;

    while (index < tag.length) {
      const char = tag[index]!;
      if (quote) {
        output += char;
        if (char === quote && tag[index - 1] !== "\\") quote = null;
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        output += char;
        index += 1;
        continue;
      }
      if (char === ":" && /[A-Za-z_]/.test(tag[index + 1] ?? "")) {
        const start = index;
        index += 1;
        while (
          index < tag.length &&
          /[\w:.$-]/.test(tag[index] ?? "")
        ) {
          index += 1;
        }
        output += transform(tag.slice(start, index));
        continue;
      }
      output += char;
      index += 1;
    }
    return output;
  });
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
  return (
    /\.\.\.\s*$/.test(chunk) &&
    chunk.lastIndexOf("<") > chunk.lastIndexOf(">")
  );
}

/**
 * Detects shorthand component/element props spread `<Button ${props} />`.
 *
 * The interpolation must occupy a standalone slot inside an opening tag.
 * Assignments like `value=${value}` and child interpolations stay untouched.
 */
export function isImplicitSpreadAttributePosition(
  chunk: string,
  nextChunk: string,
): boolean {
  if (chunk.lastIndexOf("<") <= chunk.lastIndexOf(">")) return false;
  if (!/\s$/.test(chunk)) return false;
  if (
    /([.?@:a-zA-Z_][\w:.-]*)\s*=\s*(?:"[^"]*"|'[^']*)?$/.test(
      chunk,
    )
  ) {
    return false;
  }
  if (/^\s*$/.test(nextChunk)) return true;

  const nextPattern = new RegExp(
    [
      "^\\s*(?:\\/?>|",
      "[.?@:a-zA-Z_][\\w:.-]*\\s*=|",
      "[a-zA-Z_][\\w:.-]*(?:\\s|\\/?>))",
    ].join(""),
  );
  return nextPattern.test(nextChunk);
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
      new RegExp(`<(${JSX_COMPONENT_NAME})([^<>]*?)\\/\\s*>`, "gu"),
      (_match, name: string, attrs: string) => [
        '<template data-fabrica-component-name="',
        escapeComponentName(name),
        '"',
        attrs || "",
        '></template>',
      ].join(""),
    );

    output = output.replace(
      new RegExp(`<(${JSX_COMPONENT_NAME})([^<>]*?)>`, "gu"),
      (_match, name: string, attrs: string) => [
        '<template data-fabrica-component-name="',
        escapeComponentName(name),
        '"',
        attrs || "",
        '>',
      ].join(""),
    );

    const closingComponentPattern = new RegExp(
      `</(${JSX_COMPONENT_NAME})\\s*>`,
      "gu",
    );
    output = output.replace(closingComponentPattern, "</template>");

    return output;
  });
}

function transformOutsideHtmlComments(
  source: string,
  transform: (chunk: string) => string,
): string {
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
    .replace(
      /<f-component\b([^<>]*?)\/\s*>/g,
      (_match, attrs: string) => [
        '<template data-fabrica-explicit-component="true"',
        attrs || "",
        '></template>',
      ].join(""),
    )
    .replace(
      /<f-component\b([^<>]*?)>/g,
      (_match, attrs: string) => [
        '<template data-fabrica-explicit-component="true"',
        attrs || "",
        '>',
      ].join(""),
    )
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
  const pattern = new RegExp(
    [
      String.raw`(:"[^"\r\n]+"|`,
      String.raw`[.?@:$a-zA-Z_][\w:.$-]*|`,
      String.raw`\[[^\]\s=]+\])`,
      String.raw`\s*=\s*(?:"[^"]*|'[^']*)?$`,
    ].join(""),
  );
  const match = pattern.exec(chunk);
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

  while (
    index < source.length &&
    !/\s/.test(source[index] ?? "") &&
    source[index] !== ">"
  ) {
    index += 1;
  }

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    if (
      index >= source.length ||
      source[index] === ">" ||
      source[index] === "/"
    ) {
      return "";
    }

    const nameStart = index;
    while (
      index < source.length &&
      !/[\s=/>]/.test(source[index] ?? "")
    ) {
      index += 1;
    }
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

      if (
        index >= source.length &&
        source[source.length - 1] !== quote
      ) {
        return name;
      }
      continue;
    }

    while (
      index < source.length &&
      !/[\s>]/.test(source[index] ?? "")
    ) {
      index += 1;
    }
    if (index >= source.length) return name;
  }

  return "";
}

/** Finds the current opening tag while ignoring comments and quoted `>`. */
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

    if (
      char === "<" &&
      /[A-Za-z/]/.test(source[index + 1] ?? "")
    ) {
      tagStart = index;
    }
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
export function normalizeInterpolatedComponentSelfClosingTags(
  source: string,
): string {
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
    while (
      slashIndex > start &&
      /\s/.test(source[slashIndex] ?? "")
    ) {
      slashIndex -= 1;
    }

    if (isComponentPlaceholder && source[slashIndex] === "/") {
      output += [
        source.slice(start, slashIndex),
        source.slice(slashIndex + 1, close + 1),
        "</template>",
      ].join("");
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
