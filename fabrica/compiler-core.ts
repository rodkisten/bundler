import {
  applyEdits,
  countTemplateValues,
  findTemplateEnd,
  isTagBoundary,
  isVoidTag,
  normalizeAttributeName,
  type SourceEdit,
  unquote,
  readSpreadMarker,
  readValueMarker,
  FABRICA_SPREAD_PREFIX,
  FABRICA_SPREAD_SUFFIX,
  FABRICA_VALUE_PREFIX,
  FABRICA_VALUE_SUFFIX,
} from "@rodkisten/fabrica/compiler-utils";

export interface FabricaCompileSourceOptions {
  readonly filename?: string;
  readonly importPath?: string;
  readonly htmlTags?: readonly string[];
  readonly jsxHtmlTags?: readonly string[];
  /** Emits uppercase component tags as direct lexical references for smaller, tree-shakeable bundles. */
  readonly directComponentReferences?: boolean;
}

export interface FabricaCompileSourceResult {
  readonly code: string;
  readonly changed: boolean;
  readonly manifest: readonly FabricaCompiledTemplateManifestEntry[];
}

export interface FabricaCompiledTemplateManifestEntry {
  readonly id: string;
  readonly filename?: string;
  readonly start: number;
  readonly end: number;
  readonly tag: string;
  readonly dynamicValues: number;
  readonly fallback: boolean;
}

const DEFAULT_IMPORT_PATH = "./compiler-runtime";
const HTML_TAGS = ["html"];
const JSX_HTML_TAGS = ["jsx.html", "html.jsx"];

/** Compiles Fábrica template tags to runtime-backed DOM instructions. */
export function compileFabricaSource(
  source: string,
  options: FabricaCompileSourceOptions = {},
): FabricaCompileSourceResult {
  const edits: SourceEdit[] = [];
  const manifest: FabricaCompiledTemplateManifestEntry[] = [];
  const tags = [
    ...(options.htmlTags ?? HTML_TAGS),
    ...(options.jsxHtmlTags ?? JSX_HTML_TAGS),
  ];

  for (const tag of tags) {
    let searchFrom = 0;
    const marker = `${tag}\``;
    while (searchFrom < source.length) {
      const start = source.indexOf(marker, searchFrom);
      if (start < 0) break;
      if (!isTagBoundary(source, start)) {
        searchFrom = start + marker.length;
        continue;
      }
      const templateStart = start + tag.length;
      const templateEnd = findTemplateEnd(source, templateStart);
      if (templateEnd < 0) {
        searchFrom = start + marker.length;
        continue;
      }

      const raw = source.slice(templateStart + 1, templateEnd);
      const dynamicValues = countTemplateValues(
        source,
        templateStart,
        templateEnd,
      );
      const templateParts = readTemplateParts(
        source,
        templateStart,
        templateEnd,
      );
      const compiled =
        dynamicValues === 0 ? compileStaticTemplateToExpression(raw) : null;
      const dynamicCompiled = compiled
        ? null
        : compileDynamicTemplateToExpression(
            templateParts.strings,
            templateParts.expressions,
            options.directComponentReferences ?? false,
          );
      const expression =
        compiled?.expression ??
        dynamicCompiled ??
        emitCompiledTemplateFallbackExpression(
          templateParts.strings,
          templateParts.expressions,
        );

      edits.push({ start, end: templateEnd + 1, value: expression });
      manifest.push({
        id: `fabrica-compiled-${manifest.length + 1}`,
        ...(options.filename ? { filename: options.filename } : {}),
        start,
        end: templateEnd + 1,
        tag: compiled?.rootTag ?? "template",
        dynamicValues,
        fallback: dynamicCompiled == null && compiled == null,
      });
      searchFrom = templateEnd + 1;
    }
  }

  if (edits.length === 0) return { code: source, changed: false, manifest };
  const code = ensureCompiledImport(
    applyEdits(
      source,
      edits.sort((a, b) => a.start - b.start),
    ),
    options.importPath ?? DEFAULT_IMPORT_PATH,
  );
  return { code, changed: true, manifest };
}

interface CompiledTemplateExpression {
  readonly expression: string;
  readonly rootTag: string;
}

interface ParsedNode {
  type: "element";
  tag: string;
  props: Record<string, string | true>;
  children: ParsedChild[];
}
type ParsedChild = ParsedNode | { type: "text"; value: string };

type BuildNode = BuildElementNode | BuildTextNode | BuildValueNode;
interface BuildElementNode {
  readonly type: "element";
  readonly tag: string;
  readonly props: readonly BuildProp[];
  readonly children: BuildNode[];
}
interface BuildTextNode {
  readonly type: "text";
  readonly value: string;
}
interface BuildValueNode {
  readonly type: "value";
  readonly index: number;
}
type BuildProp =
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

function compileStaticTemplateToExpression(
  raw: string,
): CompiledTemplateExpression | null {
  if (
    raw.includes("${") ||
    raw.includes("<!") ||
    raw.includes("<template") ||
    raw.includes("</${")
  )
    return null;
  const root = parseSingleRoot(raw.trim());
  if (!root) return null;
  return { expression: emitNode(root), rootTag: root.tag };
}

function compileDynamicTemplateToExpression(
  strings: readonly string[],
  expressions: readonly string[],
  directComponentReferences: boolean,
): string | null {
  if (containsUnsupportedTemplateShape(strings)) return null;
  const source = buildCompiledRuntimeSource(strings);
  const nodes = parseBuildNodes(source);
  if (!nodes) return null;
  return `createCompiledTemplate(${serializeDefinition({ nodes }, directComponentReferences)}${expressions.length ? `, ${expressions.join(", ")}` : ""})`;
}

function parseSingleRoot(source: string): ParsedNode | null {
  const stack: ParsedNode[] = [];
  let root: ParsedNode | null = null;
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
    if (!token) return null;
    if (token.startsWith("/")) {
      const closing = token.slice(1).trim().toLowerCase();
      const node = stack.pop();
      if (!node || node.tag.toLowerCase() !== closing) return null;
      if (stack.length === 0) {
        if (root) return null;
        root = node;
      } else stack[stack.length - 1]!.children.push(node);
    } else {
      const selfClosing = token.endsWith("/");
      const open = selfClosing ? token.slice(0, -1).trim() : token;
      const parsed = parseOpenTag(open);
      if (!parsed) return null;
      if (selfClosing || isVoidTag(parsed.tag)) {
        if (stack.length === 0) {
          if (root) return null;
          root = parsed;
        } else stack[stack.length - 1]!.children.push(parsed);
      } else stack.push(parsed);
    }
    index = gt + 1;
  }
  if (stack.length !== 0) return null;
  return root;

  function pushText(value: string): void {
    if (!value || !value.trim()) return;
    if (stack.length === 0) return;
    stack[stack.length - 1]!.children.push({ type: "text", value });
  }
}

function parseOpenTag(open: string): ParsedNode | null {
  const match = open.match(/^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/);
  if (!match) return null;
  const tag = match[1]!;
  if (/^[A-Z]/.test(tag)) return null;
  const props = parseStaticAttributes(match[2] ?? "");
  if (!props) return null;
  return { type: "element", tag, props, children: [] };
}

function parseStaticAttributes(
  source: string,
): Record<string, string | true> | null {
  const props: Record<string, string | true> = {};
  const re = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>`=]+))?/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    if (source.slice(cursor, match.index).trim()) return null;
    const name = match[1]!;
    const rawValue = match[2];
    props[normalizeAttributeName(name)] =
      rawValue == null ? true : unquote(rawValue);
    cursor = re.lastIndex;
  }
  if (source.slice(cursor).trim()) return null;
  return props;
}

function emitNode(node: ParsedNode): string {
  const props =
    Object.keys(node.props).length > 0 ? JSON.stringify(node.props) : "null";
  const children = node.children.map(emitChild);
  return `createCompiledElement(${JSON.stringify(node.tag)}, ${props}${children.length ? `, ${children.join(", ")}` : ""})`;
}

function emitChild(child: ParsedChild): string {
  return child.type === "text" ? JSON.stringify(child.value) : emitNode(child);
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

function parseBuildNodes(source: string): BuildNode[] | null {
  const root: BuildElementNode = {
    type: "element",
    tag: "#fragment",
    props: [],
    children: [],
  };
  const stack: BuildElementNode[] = [root];
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
      if (!node || node === root || node.tag.toLowerCase() !== closing)
        return null;
    } else {
      const selfClosing = token.endsWith("/");
      const open = selfClosing ? token.slice(0, -1).trim() : token;
      const parsed = parseBuildOpenTag(open);
      if (!parsed) return null;
      stack[stack.length - 1]!.children.push(parsed);
      if (!selfClosing && !isVoidTag(parsed.tag)) stack.push(parsed);
    }
    index = gt + 1;
  }

  if (stack.length !== 1) return null;
  return root.children;

  function pushText(value: string): void {
    if (!value) return;
    const current = stack[stack.length - 1]!;
    current.children.push(...splitBuildText(value));
  }
}

function parseBuildOpenTag(open: string): BuildElementNode | null {
  const match = open.match(/^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/);
  if (!match) return null;
  const tag = match[1]!;
  const props = parseBuildAttributes(match[2] ?? "");
  if (!props) return null;
  return { type: "element", tag, props, children: [] };
}

function parseBuildAttributes(source: string): BuildProp[] | null {
  const props: BuildProp[] = [];
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
        const single = readValueMarker(value);
        if (single != null) props.push({ type: "value", name, index: single });
        else {
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
    cursor = re.lastIndex;
  }
  if (source.slice(cursor).trim()) return null;
  return props;
}

function splitBuildText(value: string): BuildNode[] {
  const output: BuildNode[] = [];
  let cursor = 0;
  const markerRe = /%%fabrica_value_(\d+)%%/g;
  let match: RegExpExecArray | null;
  while ((match = markerRe.exec(value))) {
    const before = value.slice(cursor, match.index);
    if (before) output.push({ type: "text", value: before });
    output.push({ type: "value", index: Number(match[1]) });
    cursor = markerRe.lastIndex;
  }
  const tail = value.slice(cursor);
  if (tail) output.push({ type: "text", value: tail });
  return output;
}

function splitCompoundValue(
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

function serializeDefinition(definition: {
  readonly nodes: readonly BuildNode[];
}, directComponentReferences: boolean): string {
  // Production templates use compact tuples instead of verbose object AST keys.
  // Component tags are emitted as direct identifier references so bundlers can
  // tree-shake and mangle component symbols instead of preserving display-name strings.
  return `[${definition.nodes.map((node) => serializeCompactNode(node, directComponentReferences)).join(",")}]`;
}

function serializeCompactNode(node: BuildNode, directComponentReferences: boolean): string {
  if (node.type === "text") return `[1,${JSON.stringify(node.value)}]`;
  if (node.type === "value") return `[2,${node.index}]`;

  const tag = directComponentReferences && /^[A-Z_$][\w$]*$/.test(node.tag)
    ? node.tag
    : JSON.stringify(node.tag);
  return `[0,${tag},[${node.props.map(serializeCompactProp).join(",")}],[${node.children.map((child) => serializeCompactNode(child, directComponentReferences)).join(",")}]]`;
}

function serializeCompactProp(prop: BuildProp): string {
  if (prop.type === "spread") return `[3,${prop.index}]`;
  if (prop.type === "value") return `[1,${JSON.stringify(prop.name)},${prop.index}]`;
  if (prop.type === "compound") {
    return `[2,${JSON.stringify(prop.name)},${JSON.stringify(prop.strings)},${JSON.stringify(prop.indices)}]`;
  }
  return `[0,${JSON.stringify(prop.name)},${JSON.stringify(prop.value)}]`;
}

function emitCompiledTemplateFallbackExpression(
  strings: readonly string[],
  expressions: readonly string[],
): string {
  const args = strings.map((item) => JSON.stringify(item)).join(", ");
  const values = expressions.join(", ");
  return `createCompiledTemplate([${args}] as unknown as TemplateStringsArray${values ? `, ${values}` : ""})`;
}

function readTemplateParts(
  source: string,
  templateStart: number,
  templateEnd: number,
): { strings: string[]; expressions: string[] } {
  const raw = source.slice(templateStart + 1, templateEnd);
  const strings: string[] = [];
  const expressions: string[] = [];
  let cursor = 0;
  let index = 0;

  while (index < raw.length) {
    if (raw[index] === "$" && raw[index + 1] === "{") {
      strings.push(raw.slice(cursor, index));
      const expressionStart = index + 2;
      const expressionEnd = findExpressionEnd(raw, expressionStart);
      if (expressionEnd < 0) break;
      expressions.push(raw.slice(expressionStart, expressionEnd).trim());
      cursor = expressionEnd + 1;
      index = cursor;
      continue;
    }
    if (raw[index] === "\\") index += 2;
    else index += 1;
  }

  strings.push(raw.slice(cursor));
  return { strings, expressions };
}

function findExpressionEnd(source: string, start: number): number {
  let depth = 1;
  let quote = "";
  let escaped = false;
  let templateDepth = 0;

  for (let index = start; index < source.length; index += 1) {
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
        templateDepth += 1;
        index += 1;
        continue;
      }
      if (quote === "`" && char === "}" && templateDepth > 0) {
        templateDepth -= 1;
        continue;
      }
      if (char === quote && templateDepth === 0) quote = "";
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function ensureCompiledImport(source: string, importPath: string): string {
  const needed = ["createCompiledElement", "createCompiledTemplate"];
  const hasElement =
    /import\s+\{[^}]*\bcreateCompiledElement\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(
      source,
    );
  const hasTemplate =
    /import\s+\{[^}]*\bcreateCompiledTemplate\b[^}]*\}\s+from\s+['"][^'"]+['"]/.test(
      source,
    );
  if (hasElement && hasTemplate) return source;
  return `import { ${needed.join(", ")} } from ${JSON.stringify(importPath)};\n${source}`;
}
