import {
  DIRECT_COMPONENT_IDENT_RE,
  NODE_ELEMENT,
  NODE_TEXT,
  NODE_VALUE,
  PROP_COMPOUND,
  PROP_SPREAD,
  PROP_STATIC,
  PROP_VALUE,
} from "./constants.js";
import {
  buildCompiledRuntimeSource,
  containsUnsupportedTemplateShape,
  parseCompiledNodes,
  type CompiledNode,
  type CompiledProp,
} from "./html-parser.js";

export interface CompiledTemplateExpression {
  readonly expression: string;
  readonly rootTag: string;
  readonly fallback: boolean;
}

export function compileTemplateToExpression(
  tag: string,
  strings: readonly string[],
  expressions: readonly string[],
  directNames: ReadonlySet<string>,
  helperName: string,
): CompiledTemplateExpression {
  if (!containsUnsupportedTemplateShape(strings)) {
    const source = buildCompiledRuntimeSource(strings);
    const nodes = parseCompiledNodes(source, { allowUppercaseTags: true });
    if (nodes) {
      return {
        expression:
          `${helperName}(${tag}, ` +
          `${serializeDefinition({ nodes }, directNames)}` +
          `${expressions.length ? `, ${expressions.join(", ")}` : ""})`,
        rootTag: readRootTag(nodes),
        fallback: false,
      };
    }
  }

  return {
    expression: emitCompiledTemplateFallbackExpression(
      helperName,
      tag,
      strings,
      expressions,
    ),
    rootTag: "template",
    fallback: true,
  };
}

function serializeDefinition(
  definition: { readonly nodes: readonly CompiledNode[] },
  directNames: ReadonlySet<string>,
): string {
  return (
    "[" +
    definition.nodes
      .map((node) => serializeCompactNode(node, directNames))
      .join(",") +
    "]"
  );
}

function serializeCompactNode(
  node: CompiledNode,
  directNames: ReadonlySet<string>,
): string {
  if (node.type === "text") {
    return `[${NODE_TEXT},${JSON.stringify(node.value)}]`;
  }
  if (node.type === "value") return `[${NODE_VALUE},${node.index}]`;

  const tag =
    DIRECT_COMPONENT_IDENT_RE.test(node.tag) && directNames.has(node.tag)
      ? node.tag
      : JSON.stringify(node.tag);
  const props = node.props.map(serializeCompactProp).join(",");
  const children = node.children
    .map((child) => serializeCompactNode(child, directNames))
    .join(",");
  return `[${NODE_ELEMENT},${tag},[${props}],[${children}]]`;
}

function serializeCompactProp(prop: CompiledProp): string {
  if (prop.type === "spread") return `[${PROP_SPREAD},${prop.index}]`;
  if (prop.type === "value") {
    return `[${PROP_VALUE},${JSON.stringify(prop.name)},${prop.index}]`;
  }
  if (prop.type === "compound") {
    return (
      `[${PROP_COMPOUND},${JSON.stringify(prop.name)},` +
      `${JSON.stringify(prop.strings)},${JSON.stringify(prop.indices)}]`
    );
  }
  return (
    `[${PROP_STATIC},${JSON.stringify(prop.name)},` +
    `${JSON.stringify(prop.value)}]`
  );
}

function emitCompiledTemplateFallbackExpression(
  helperName: string,
  tag: string,
  strings: readonly string[],
  expressions: readonly string[],
): string {
  const input = JSON.stringify(strings);
  const values = expressions.length ? `, ${expressions.join(", ")}` : "";
  return `${helperName}(${tag}, ${input}${values})`;
}

function readRootTag(nodes: readonly CompiledNode[]): string {
  if (nodes.length !== 1 || nodes[0]?.type !== "element") return "template";
  return typeof nodes[0].tag === "string" ? nodes[0].tag : "template";
}
