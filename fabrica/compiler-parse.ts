import {
  ATTR_EQUALS_TAIL_RE,
  ATTR_TOKEN_RE,
  EXPLICIT_SPREAD_TAIL_RE,
  FABRICA_SPREAD_PREFIX,
  FABRICA_SPREAD_SUFFIX,
  FABRICA_VALUE_PREFIX,
  FABRICA_VALUE_SUFFIX,
  IMPLICIT_SPREAD_NEXT_RE,
  OPEN_TAG_RE,
  UPPERCASE_TAG_RE,
  VALUE_MARKER_RE,
  VOID_TAG_RE,
} from "@rodkisten/fabrica/compiler-constants";
import {
  normalizeAttributeName,
  readSpreadMarker,
  readValueMarker,
  unquote,
} from "@rodkisten/fabrica/compiler-utils";

/** Shared prop shape used by both the build-time emitter and runtime hydrator. */
export type CompiledProp =
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

export interface CompiledTextNode {
  readonly type: "text";
  readonly value: string;
}

export interface CompiledValueNode {
  readonly type: "value";
  readonly index: number;
}

export interface CompiledElementNode<Tag = string> {
  readonly type: "element";
  readonly tag: Tag;
  readonly props: readonly CompiledProp[];
  readonly children: CompiledNode<Tag>[];
}

export type CompiledNode<Tag = string> =
  | CompiledElementNode<Tag>
  | CompiledTextNode
  | CompiledValueNode;

/** Rejects templates where `${}` sits inside a tag name or closing prefix. */
export function containsUnsupportedTemplateShape(
  strings: readonly string[],
): boolean {
  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? "";
    if (chunk.endsWith("<") || chunk.endsWith("</")) return true;
  }
  return false;
}

/**
 * Stitches cooked template chunks into a marker-annotated HTML string.
 *
 * Value slots become `%%fabrica_value_N%%`. Spread slots (explicit `...${}` or
 * an empty interpolation between attributes) become `%%fabrica_spread_N%%`.
 */
export function buildCompiledRuntimeSource(strings: readonly string[]): string {
  let output = "";
  let inTag = false;

  for (let index = 0; index < strings.length; index += 1) {
    const chunk = strings[index] ?? "";
    for (let i = 0; i < chunk.length; i += 1) {
      if (chunk[i] === "<") inTag = true;
      else if (chunk[i] === ">") inTag = false;
    }

    const nextChunk = strings[index + 1] ?? "";
    const explicitSpread = EXPLICIT_SPREAD_TAIL_RE.test(chunk) && inTag;
    const implicitSpread = isImplicitSpreadSlot(chunk, nextChunk, inTag);

    if (index < strings.length - 1 && (explicitSpread || implicitSpread)) {
      output += explicitSpread
        ? chunk.replace(EXPLICIT_SPREAD_TAIL_RE, "")
        : chunk;
      output += ` ${FABRICA_SPREAD_PREFIX}${index}${FABRICA_SPREAD_SUFFIX}`;
      continue;
    }

    output += chunk;
    if (index < strings.length - 1) {
      output += `${FABRICA_VALUE_PREFIX}${index}${FABRICA_VALUE_SUFFIX}`;
    }
  }

  return output;
}

function isImplicitSpreadSlot(
  chunk: string,
  nextChunk: string,
  inTag: boolean,
): boolean {
  if (!inTag || !/\s$/.test(chunk)) return false;
  if (ATTR_EQUALS_TAIL_RE.test(chunk)) return false;
  if (/^\s*$/.test(nextChunk)) return true;
  return IMPLICIT_SPREAD_NEXT_RE.test(nextChunk);
}

/** Splits text containing value markers into text/value nodes. */
export function splitMarkerText(value: string): CompiledNode[] {
  const output: CompiledNode[] = [];
  let cursor = 0;
  VALUE_MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VALUE_MARKER_RE.exec(value))) {
    const before = value.slice(cursor, match.index);
    if (before) output.push({ type: "text", value: before });
    output.push({ type: "value", index: Number(match[1]) });
    cursor = VALUE_MARKER_RE.lastIndex;
  }
  const tail = value.slice(cursor);
  if (tail) output.push({ type: "text", value: tail });
  return output;
}

/** Parses a value that interleaves literals with value markers. */
export function splitCompoundValue(
  value: string,
): { strings: string[]; indices: number[] } | null {
  const strings: string[] = [];
  const indices: number[] = [];
  let cursor = 0;
  VALUE_MARKER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VALUE_MARKER_RE.exec(value))) {
    strings.push(value.slice(cursor, match.index));
    indices.push(Number(match[1]));
    cursor = VALUE_MARKER_RE.lastIndex;
  }
  if (indices.length === 0) return null;
  strings.push(value.slice(cursor));
  return { strings, indices };
}

/**
 * Parses marker-annotated HTML into a fragment child list.
 * Returns null for comments, malformed tags, or unbalanced trees.
 */
export function parseCompiledNodes<Tag = string>(
  source: string,
  options: {
    readonly allowUppercaseTags?: boolean;
  } = {},
): CompiledNode<Tag>[] | null {
  const root: CompiledElementNode<Tag> = {
    type: "element",
    tag: "#fragment" as Tag,
    props: [],
    children: [],
  };
  const stack: CompiledElementNode<Tag>[] = [root];
  let index = 0;

  while (index < source.length) {
    const lt = source.indexOf("<", index);
    if (lt < 0) {
      pushText(source.slice(index));
      break;
    }
    pushText(source.slice(index, lt));
    const gt = source.indexOf(">", lt + 1);
    if (gt < 0) return null;
    const token = source.slice(lt + 1, gt).trim();
    if (!token || token.startsWith("!") || token.startsWith("?")) return null;

    if (token.startsWith("/")) {
      const closing = token.slice(1).trim().toLowerCase();
      const node = stack.pop();
      if (
        !node ||
        node === root ||
        String(node.tag).toLowerCase() !== closing
      ) {
        return null;
      }
    } else {
      const selfClosing = token.endsWith("/");
      const open = selfClosing ? token.slice(0, -1).trim() : token;
      const parsed = parseCompiledOpenTag<Tag>(open, options.allowUppercaseTags);
      if (!parsed) return null;
      stack[stack.length - 1]!.children.push(parsed);
      if (!selfClosing && !VOID_TAG_RE.test(String(parsed.tag))) {
        stack.push(parsed);
      }
    }
    index = gt + 1;
  }

  if (stack.length !== 1) return null;
  return root.children;

  function pushText(value: string): void {
    if (!value) return;
    const current = stack[stack.length - 1]!;
    current.children.push(...(splitMarkerText(value) as CompiledNode<Tag>[]));
  }
}

function parseCompiledOpenTag<Tag>(
  open: string,
  allowUppercaseTags = true,
): CompiledElementNode<Tag> | null {
  const match = open.match(OPEN_TAG_RE);
  if (!match) return null;
  const tag = match[1]!;
  if (!allowUppercaseTags && UPPERCASE_TAG_RE.test(tag)) return null;
  const props = parseCompiledAttributes(match[2] ?? "");
  if (!props) return null;
  return { type: "element", tag: tag as Tag, props, children: [] };
}

function parseCompiledAttributes(source: string): CompiledProp[] | null {
  const props: CompiledProp[] = [];
  ATTR_TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = ATTR_TOKEN_RE.exec(source))) {
    if (source.slice(cursor, match.index).trim()) return null;
    const rawName = match[1]!;
    const rawValue = match[2];
    const spread = readSpreadMarker(rawName);
    if (spread != null) {
      props.push({ type: "spread", index: spread });
    } else {
      const name = normalizeAttributeName(rawName);
      const value = rawValue == null ? true : unquote(rawValue);
      if (typeof value !== "string") {
        props.push({ type: "static", name, value });
      } else {
        const marker = readValueMarker(value);
        if (marker != null) {
          props.push({ type: "value", name, index: marker });
        } else {
          const compound = splitCompoundValue(value);
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
    cursor = ATTR_TOKEN_RE.lastIndex;
  }

  if (source.slice(cursor).trim()) return null;
  return props;
}
