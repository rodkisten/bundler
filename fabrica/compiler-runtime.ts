import {
  createHtmlResult,
  html,
  pruneInsignificantWhitespace,
} from "@rodkisten/fabrica/dom";
import { collectCleanupNodes } from "@rodkisten/fabrica/dom-cleanup";
import {
  FABRICA_HTML_RUNTIME,
  getCurrentFabricaRuntime,
  runWithCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "@rodkisten/fabrica/runtime-context";
import type {
  FabricaRuntimeContext,
  HtmlArtifact,
  HtmlResult,
  HtmlTemplateTag,
  RenderValue,
} from "@rodkisten/fabrica/types";
import { TEMPLATE_CACHE_KEY_SEPARATOR } from "@rodkisten/fabrica/compiler-constants";
import {
  buildCompiledRuntimeSource,
  containsUnsupportedTemplateShape,
  parseCompiledNodes,
} from "@rodkisten/fabrica/compiler-parse";
import { normalizeTemplateStrings } from "@rodkisten/fabrica/compiler-utils";
import {
  appendCompiledNode,
  normalizeCompactNode,
} from "@rodkisten/fabrica/compiler-runtime-hydrate";
import type {
  RuntimeCompiledTemplate,
  RuntimeCompiledTemplateInput,
  RuntimeNode,
} from "@rodkisten/fabrica/compiler-runtime-types";

export type {
  CompactRuntimeCompiledTemplate,
  CompactRuntimeNode,
  CompactRuntimeProp,
  FabricaCompiledElementProps,
  RuntimeCompiledTemplate,
  RuntimeCompiledTemplateInput,
  RuntimeComponent,
  RuntimeElementNode,
  RuntimeNode,
  RuntimeProp,
  RuntimeTextNode,
  RuntimeValueNode,
} from "@rodkisten/fabrica/compiler-runtime-types";

export {
  applyCompiledProps,
  createCompiledElement,
  createCompiledFragment,
} from "@rodkisten/fabrica/compiler-runtime-element";

const runtimeTemplateCache = new Map<string, RuntimeCompiledTemplate | null>();

/**
 * Runtime helper used by the build transform for dynamic templates.
 *
 * Parses the template once into a compact tree and hydrates every call with the
 * current interpolation values. Unsupported shapes fall back to `html```.
 */
export function createCompiledTemplate(
  input: RuntimeCompiledTemplateInput | TemplateStringsArray | readonly string[],
  ...values: readonly RenderValue[]
): HtmlResult;
export function createCompiledTemplate(
  tag: HtmlTemplateTag,
  input: RuntimeCompiledTemplateInput | TemplateStringsArray | readonly string[],
  ...values: readonly RenderValue[]
): HtmlResult;
export function createCompiledTemplate(
  inputOrTag:
    | HtmlTemplateTag
    | RuntimeCompiledTemplateInput
    | TemplateStringsArray
    | readonly string[],
  ...inputAndValues: readonly unknown[]
): HtmlResult {
  const tagged = typeof inputOrTag === "function";
  const input = (tagged ? inputAndValues[0] : inputOrTag) as
    | RuntimeCompiledTemplateInput
    | TemplateStringsArray
    | readonly string[];
  const values = (tagged ? inputAndValues.slice(1) : inputAndValues) as readonly RenderValue[];
  const boundRuntime = tagged
    ? (Reflect.get(inputOrTag, FABRICA_HTML_RUNTIME) as FabricaRuntimeContext | undefined)
    : undefined;

  const materialize = (): HtmlResult => {
    const runtime = getCurrentFabricaRuntime();
    const runtimeDefinition = isRuntimeCompiledTemplate(input);
    const normalizedStrings = runtimeDefinition
      ? null
      : normalizeTemplateStrings(input);
    const compiled = runtimeDefinition
      ? normalizeRuntimeCompiledTemplate(input)
      : getCachedCompiledRuntimeTemplate(normalizedStrings!);

    if (!compiled) {
      return html(normalizedStrings!, ...values);
    }

    try {
      const fragment = document.createDocumentFragment();
      const collected = collectCleanupNodes(() => {
        for (const node of compiled.nodes) {
          appendCompiledNode(fragment, node, values);
        }
      });

      pruneInsignificantWhitespace(fragment);

      return createHtmlResult(
        fragment,
        createCompiledHtmlArtifact(
          runtimeDefinition ? input : normalizedStrings!,
          values,
          runtime,
        ),
        {
          cleanupNodes: collected.nodes,
          dynamic: collected.nodes.length > 0,
        },
      );
    } catch (error) {
      // Compiled definitions are an optimization. On failure, string templates
      // reclaim the canonical html`` semantics instead of diverging.
      if (!runtimeDefinition) {
        return html(normalizedStrings!, ...values);
      }
      throw error;
    }
  };

  return boundRuntime
    ? runWithFabricaRuntime(boundRuntime, materialize)
    : runWithCurrentFabricaRuntime(materialize);
}

function createCompiledHtmlArtifact(
  input: RuntimeCompiledTemplateInput | TemplateStringsArray,
  values: readonly RenderValue[],
  runtime: FabricaRuntimeContext,
): HtmlArtifact {
  const capturedValues = Object.freeze(
    Array.from(values),
  ) as readonly RenderValue[];
  const artifactStrings = Object.freeze(
    isRuntimeCompiledTemplate(input) ? [] : Array.from(input),
  );

  return Object.freeze({
    kind: "fabrica.html" as const,
    strings: artifactStrings,
    values: capturedValues,
    jsx: false,
    materialize: () =>
      runWithFabricaRuntime(runtime, () =>
        createCompiledTemplate(input, ...capturedValues),
      ),
  });
}

function isRuntimeCompiledTemplate(
  value: unknown,
): value is RuntimeCompiledTemplateInput {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray((value as { nodes?: unknown }).nodes)) return true;
  if (!Array.isArray(value)) return false;
  // Compact definitions are arrays of tuple nodes; template strings are string[].
  return value.length === 0 || Array.isArray(value[0]);
}

function normalizeRuntimeCompiledTemplate(
  input: RuntimeCompiledTemplateInput,
): RuntimeCompiledTemplate {
  if (!Array.isArray(input)) return input as RuntimeCompiledTemplate;
  return { nodes: input.map(normalizeCompactNode) };
}

function getCachedCompiledRuntimeTemplate(
  strings: readonly string[],
): RuntimeCompiledTemplate | null {
  const key = strings.join(TEMPLATE_CACHE_KEY_SEPARATOR);
  if (runtimeTemplateCache.has(key)) {
    return runtimeTemplateCache.get(key) ?? null;
  }
  const compiled = compileRuntimeTemplate(strings);
  runtimeTemplateCache.set(key, compiled);
  return compiled;
}

function compileRuntimeTemplate(
  strings: readonly string[],
): RuntimeCompiledTemplate | null {
  if (containsUnsupportedTemplateShape(strings)) return null;
  const source = buildCompiledRuntimeSource(strings);
  const roots = parseCompiledNodes<string | ((props: never) => RenderValue)>(
    source,
  );
  return roots ? { nodes: roots as RuntimeNode[] } : null;
}
