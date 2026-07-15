import {
  FABRICA_SPREAD_PREFIX,
  FABRICA_SPREAD_SUFFIX,
  FABRICA_VALUE_PREFIX,
  FABRICA_VALUE_SUFFIX,
  LEGACY_SPREAD_MARKER_RE,
  SPREAD_MARKER_EXACT_RE,
  SVG_NAMESPACE,
  SVG_TAG_RE,
  TAG_BOUNDARY_BEFORE_RE,
  VALUE_MARKER_EXACT_RE,
  VOID_TAG_RE,
} from "@rodkisten/fabrica/compiler-constants";

export interface SourceEdit {
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

export {
  FABRICA_VALUE_PREFIX,
  FABRICA_VALUE_SUFFIX,
  FABRICA_SPREAD_PREFIX,
  FABRICA_SPREAD_SUFFIX,
} from "@rodkisten/fabrica/compiler-constants";

export function normalizeAttributeName(name: string): string {
  if (name === "className") return "class";
  return name;
}

export function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function readValueMarker(value: string): number | null {
  const match = value.match(VALUE_MARKER_EXACT_RE);
  return match ? Number(match[1]) : null;
}

export function readSpreadMarker(value: string): number | null {
  const spread = value.match(SPREAD_MARKER_EXACT_RE);
  if (spread) return Number(spread[1]);
  const legacy = value.match(LEGACY_SPREAD_MARKER_RE);
  return legacy ? Number(legacy[1]) : null;
}

export function isVoidTag(tag: string): boolean {
  return VOID_TAG_RE.test(tag);
}

export function isSvgTag(tag: string): boolean {
  return SVG_TAG_RE.test(tag);
}

export function createElementForTag(tag: string): Element {
  return isSvgTag(tag)
    ? document.createElementNS(SVG_NAMESPACE, tag)
    : document.createElement(tag);
}

export function normalizeTemplateStrings(
  strings: TemplateStringsArray | readonly string[],
): TemplateStringsArray {
  if (isTemplateStringsArray(strings)) return strings;
  const cooked = strings.slice() as string[] & { raw?: readonly string[] };
  Object.defineProperty(cooked, "raw", {
    configurable: false,
    enumerable: false,
    value: strings.slice(),
  });
  return cooked as unknown as TemplateStringsArray;
}

function isTemplateStringsArray(
  value: TemplateStringsArray | readonly string[],
): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray((value as { raw?: unknown }).raw);
}

export function isTagBoundary(source: string, start: number): boolean {
  const before = source[start - 1] ?? "";
  return !TAG_BOUNDARY_BEFORE_RE.test(before);
}

export function countTemplateValues(
  source: string,
  templateStart: number,
  templateEnd: number,
): number {
  let count = 0;
  for (let index = templateStart; index < templateEnd; index += 1) {
    if (source[index] === "$" && source[index + 1] === "{") count += 1;
  }
  return count;
}

/**
 * Finds the closing backtick of a tagged template, tracking nested `${}` and
 * quoted string regions so expression bodies are not treated as template ends.
 */
export function findTemplateEnd(source: string, start: number): number {
  let escaped = false;
  let expressionDepth = 0;
  let quote = "";
  let templateExpressionDepth = 0;

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index]!;
    const next = source[index + 1];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (quote === "`" && char === "$" && next === "{") {
        templateExpressionDepth += 1;
        index += 1;
        continue;
      }
      if (quote === "`" && char === "}" && templateExpressionDepth > 0) {
        templateExpressionDepth -= 1;
        continue;
      }
      if (char === quote && templateExpressionDepth === 0) quote = "";
      continue;
    }

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (expressionDepth > 0) {
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") {
        expressionDepth += 1;
        continue;
      }
      if (char === "}") {
        expressionDepth -= 1;
        continue;
      }
      continue;
    }

    if (char === "$" && next === "{") {
      expressionDepth = 1;
      index += 1;
      continue;
    }
    if (char === "`") return index;
  }
  return -1;
}

export function applyEdits(
  source: string,
  edits: readonly SourceEdit[],
): string {
  let output = "";
  let cursor = 0;
  for (const edit of edits) {
    if (edit.start < cursor) continue;
    output += source.slice(cursor, edit.start);
    output += edit.value;
    cursor = edit.end;
  }
  return output + source.slice(cursor);
}
