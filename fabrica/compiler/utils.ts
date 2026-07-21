import {
  LEGACY_SPREAD_MARKER_RE,
  SPREAD_MARKER_EXACT_RE,
  SVG_NAMESPACE,
  SVG_TAG_RE,
  VALUE_MARKER_EXACT_RE,
} from "./constants.js";

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
} from "./constants.js";

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
