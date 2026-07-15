import {
  ATTR_TOKEN_RE,
  DIRECT_COMPONENT_IDENT_RE,
  IMPORT_CREATE_ELEMENT_RE,
  IMPORT_CREATE_TEMPLATE_RE,
  NODE_ELEMENT,
  NODE_TEXT,
  NODE_VALUE,
  OPEN_TAG_RE,
  PROP_COMPOUND,
  PROP_SPREAD,
  PROP_STATIC,
  PROP_VALUE,
  UPPERCASE_TAG_RE,
} from "@rodkisten/fabrica/compiler-constants";
import {
  buildCompiledRuntimeSource,
  containsUnsupportedTemplateShape,
  parseCompiledNodes,
  type CompiledNode,
  type CompiledProp,
} from "@rodkisten/fabrica/compiler-parse";
import {
  applyEdits,
  countTemplateValues,
  findTemplateEnd,
  isTagBoundary,
  isVoidTag,
  normalizeAttributeName,
  type SourceEdit,
  unquote,
} from "@rodkisten/fabrica/compiler-utils";

// Re-export defaults used only by this module — avoid circular imports by inlining.
const COMPILER_DEFAULT_IMPORT_PATH = "./compiler-runtime";
const COMPILER_HTML_TAGS = ["html"];
const COMPILER_JSX_HTML_TAGS = ["jsx.html", "html.jsx"];

export interface FabricaCompileSourceOptions {
  readonly filename?: string;
  readonly importPath?: string;
  readonly htmlTags?: readonly string[];
  readonly jsxHtmlTags?: readonly string[];
  /** Emits uppercase component tags as direct lexical references for tree-shaking. */
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

/** Compiles Fábrica `html` / `jsx.html` template tags into runtime-backed expressions. */
export function compileFabricaSource(
  source: string,
  options: FabricaCompileSourceOptions = {},
): FabricaCompileSourceResult {
  const edits: SourceEdit[] = [];
  const manifest: FabricaCompiledTemplateManifestEntry[] = [];
  const tags = [
    ...(options.htmlTags ?? COMPILER_HTML_TAGS),
    ...(options.jsxHtmlTags ?? COMPILER_JSX_HTML_TAGS),
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
    options.importPath ?? COMPILER_DEFAULT_IMPORT_PATH,
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

function compileStaticTemplateToExpression(
  raw: string,
): CompiledTemplateExpression | null {
  if (
    raw.includes("${") ||
    raw.includes("<!") ||
    raw.includes("<template") ||
    raw.includes("</${")
  ) {
    return null;
  }
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
  const nodes = parseCompiledNodes(source, { allowUppercaseTags: true });
  if (!nodes) return null;
  return `createCompiledTemplate(${serializeDefinition({ nodes }, directComponentReferences)}${expressions.length ? `, ${expressions.join(", ")}` : ""})`;
}

/** Parses a single-root static HTML fragment; rejects forests and unbalanced tags. */
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
      } else {
        stack[stack.length - 1]!.children.push(node);
      }
    } else {
      const selfClosing = token.endsWith("/");
      const open = selfClosing ? token.slice(0, -1).trim() : token;
      const parsed = parseStaticOpenTag(open);
      if (!parsed) return null;
      if (selfClosing || isVoidTag(parsed.tag)) {
        if (stack.length === 0) {
          if (root) return null;
          root = parsed;
        } else {
          stack[stack.length - 1]!.children.push(parsed);
        }
      } else {
        stack.push(parsed);
      }
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

function parseStaticOpenTag(open: string): ParsedNode | null {
  const match = open.match(OPEN_TAG_RE);
  if (!match) return null;
  const tag = match[1]!;
  if (UPPERCASE_TAG_RE.test(tag)) return null;
  const props = parseStaticAttributes(match[2] ?? "");
  if (!props) return null;
  return { type: "element", tag, props, children: [] };
}

function parseStaticAttributes(
  source: string,
): Record<string, string | true> | null {
  const props: Record<string, string | true> = {};
  ATTR_TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_TOKEN_RE.exec(source))) {
    if (source.slice(cursor, match.index).trim()) return null;
    const name = match[1]!;
    const rawValue = match[2];
    props[normalizeAttributeName(name)] =
      rawValue == null ? true : unquote(rawValue);
    cursor = ATTR_TOKEN_RE.lastIndex;
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

function serializeDefinition(
  definition: { readonly nodes: readonly CompiledNode[] },
  directComponentReferences: boolean,
): string {
  // Compact tuples shrink emitted source vs verbose object AST keys.
  return `[${definition.nodes.map((node) => serializeCompactNode(node, directComponentReferences)).join(",")}]`;
}

function serializeCompactNode(
  node: CompiledNode,
  directComponentReferences: boolean,
): string {
  if (node.type === "text") return `[${NODE_TEXT},${JSON.stringify(node.value)}]`;
  if (node.type === "value") return `[${NODE_VALUE},${node.index}]`;

  const tag =
    directComponentReferences && DIRECT_COMPONENT_IDENT_RE.test(node.tag)
      ? node.tag
      : JSON.stringify(node.tag);
  return `[${NODE_ELEMENT},${tag},[${node.props.map(serializeCompactProp).join(",")}],[${node.children.map((child) => serializeCompactNode(child, directComponentReferences)).join(",")}]]`;
}

function serializeCompactProp(prop: CompiledProp): string {
  if (prop.type === "spread") return `[${PROP_SPREAD},${prop.index}]`;
  if (prop.type === "value") {
    return `[${PROP_VALUE},${JSON.stringify(prop.name)},${prop.index}]`;
  }
  if (prop.type === "compound") {
    return `[${PROP_COMPOUND},${JSON.stringify(prop.name)},${JSON.stringify(prop.strings)},${JSON.stringify(prop.indices)}]`;
  }
  return `[${PROP_STATIC},${JSON.stringify(prop.name)},${JSON.stringify(prop.value)}]`;
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

/** Walks `${...}` with nesting/quote awareness so `,` and `{` inside strings are safe. */
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
  const hasElement = IMPORT_CREATE_ELEMENT_RE.test(source);
  const hasTemplate = IMPORT_CREATE_TEMPLATE_RE.test(source);
  if (hasElement && hasTemplate) return source;
  return `import { ${needed.join(", ")} } from ${JSON.stringify(importPath)};\n${source}`;
}
