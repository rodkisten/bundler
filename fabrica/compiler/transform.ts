import * as ts from "typescript";
import {
  createSingleFileChecker,
  createSourceFile,
} from "./ast.js";
import {
  isFabricaTemplateTag,
  readVisibleValueBindings,
} from "./bindings.js";
import {
  injectCompilerImport,
  resolveCompilerHelper,
} from "./imports.js";
import { compileTemplateToExpression } from "./serialize.js";
import {
  applyEdits,
  type SourceEdit,
} from "./utils.js";

const DEFAULT_IMPORT_PATH = "@rodkisten/fabrica/compiler-runtime";
const DEFAULT_HTML_TAGS = ["html"] as const;
const DEFAULT_JSX_HTML_TAGS = ["jsx.html", "html.jsx"] as const;

export interface FabricaCompileSourceOptions {
  readonly filename?: string;
  readonly importPath?: string;
  readonly htmlTags?: readonly string[];
  readonly jsxHtmlTags?: readonly string[];
  /**
   * Emits uppercase component tags as direct lexical references when a value
   * binding with the same name is visible at the template callsite.
   */
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

interface InternalManifestEntry {
  readonly filename?: string;
  readonly start: number;
  readonly end: number;
  readonly tag: string;
  readonly dynamicValues: number;
  readonly fallback: boolean;
}

interface CompileContext {
  readonly options: FabricaCompileSourceOptions;
  readonly configuredTags: ReadonlySet<string>;
  readonly helperName: string;
  readonly manifest: InternalManifestEntry[];
}

interface CompileFragmentResult {
  readonly code: string;
  readonly changed: boolean;
}

interface TemplateParts {
  readonly strings: readonly string[];
  readonly expressions: readonly {
    readonly code: string;
    readonly start: number;
  }[];
}

/**
 * Compiles Fábrica tagged templates through a TypeScript AST.
 *
 * The source AST is used only for JavaScript/TypeScript structure and lexical
 * binding analysis. Fábrica's HTML DSL remains parsed by the dedicated compact
 * HTML parser, keeping the build transform independent from browser DOM APIs.
 */
export function compileFabricaSource(
  source: string,
  options: FabricaCompileSourceOptions = {},
): FabricaCompileSourceResult {
  const filename = options.filename ?? "source.tsx";
  const sourceFile = createSourceFile(source, filename);
  const checker = createSingleFileChecker(sourceFile, filename);
  const importPath = options.importPath ?? DEFAULT_IMPORT_PATH;
  const helper = resolveCompilerHelper(sourceFile, importPath);
  const configuredTags = new Set([
    ...(options.htmlTags ?? DEFAULT_HTML_TAGS),
    ...(options.jsxHtmlTags ?? DEFAULT_JSX_HTML_TAGS),
  ]);
  const manifestEntries: InternalManifestEntry[] = [];
  const context: CompileContext = {
    options,
    configuredTags,
    helperName: helper.localName,
    manifest: manifestEntries,
  };

  const compiled = compileSourceFragment(
    source,
    filename,
    0,
    context,
    checker,
  );

  if (!compiled.changed) {
    return { code: source, changed: false, manifest: [] };
  }

  const code = helper.alreadyImported
    ? compiled.code
    : injectCompilerImport(
        compiled.code,
        sourceFile,
        importPath,
        helper.localName,
      );

  const manifest = manifestEntries
    .slice()
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map((entry, index) => ({
      id: `fabrica-compiled-${index + 1}`,
      ...entry,
    }));

  return { code, changed: true, manifest };
}

function compileSourceFragment(
  source: string,
  filename: string,
  sourceOffset: number,
  context: CompileContext,
  parentChecker?: ts.TypeChecker,
): CompileFragmentResult {
  const sourceFile = createSourceFile(source, filename);
  const checker = sourceOffset === 0 && parentChecker
    ? parentChecker
    : createSingleFileChecker(sourceFile, filename);
  const templates: ts.TaggedTemplateExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isTaggedTemplateExpression(node) &&
      isFabricaTemplateTag(node.tag, checker, context.configuredTags)
    ) {
      templates.push(node);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (templates.length === 0) {
    return { code: source, changed: false };
  }

  const edits: SourceEdit[] = [];
  for (const template of templates) {
    const parts = readTemplateParts(
      template.template,
      sourceFile,
      source,
      filename,
      sourceOffset,
      context,
    );
    const tagText = template.tag.getText(sourceFile);
    const directNames = context.options.directComponentReferences
      ? readVisibleValueBindings(template)
      : EMPTY_NAMES;
    const compiled = compileTemplateToExpression(
      tagText,
      parts.strings,
      parts.expressions.map((item) => item.code),
      directNames,
      context.helperName,
    );
    const start = template.getStart(sourceFile);
    const end = template.getEnd();

    edits.push({ start, end, value: compiled.expression });
    context.manifest.push({
      ...(context.options.filename
        ? { filename: context.options.filename }
        : {}),
      start: sourceOffset + start,
      end: sourceOffset + end,
      tag: compiled.rootTag,
      dynamicValues: parts.expressions.length,
      fallback: compiled.fallback,
    });
  }

  return {
    code: applyEdits(
      source,
      edits.sort((a, b) => a.start - b.start),
    ),
    changed: true,
  };
}

function readTemplateParts(
  template: ts.TemplateLiteral,
  sourceFile: ts.SourceFile,
  source: string,
  filename: string,
  sourceOffset: number,
  context: CompileContext,
): TemplateParts {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return { strings: [template.text], expressions: [] };
  }

  const strings: string[] = [template.head.text];
  const expressions: { code: string; start: number }[] = [];

  for (const span of template.templateSpans) {
    const expression = span.expression;
    const expressionStart = expression.getStart(sourceFile);
    const expressionSource = source.slice(expressionStart, expression.getEnd());
    const compiled = compileSourceFragment(
      expressionSource,
      filename,
      sourceOffset + expressionStart,
      context,
    );
    expressions.push({
      code: compiled.code,
      start: sourceOffset + expressionStart,
    });
    strings.push(span.literal.text);
  }

  return { strings, expressions };
}



const EMPTY_NAMES: ReadonlySet<string> = new Set<string>();
