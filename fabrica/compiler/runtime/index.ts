import { html } from "../../render/dom.js";
import {
  createHtmlResult,
  isHtmlResult,
  pruneInsignificantWhitespace,
} from "../../render/html-result.js";
import { collectCleanupNodes } from "../../render/cleanup.js";
import {
  FABRICA_HTML_RUNTIME,
  getCurrentFabricaRuntime,
  runWithCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "../../core/runtime-context.js";
import type {
  FabricaRuntimeContext,
  HtmlArtifact,
  HtmlResult,
  HtmlTemplateTag,
  RenderValue,
} from "../../types.js";
import {
  buildCompiledRuntimeSource,
  containsUnsupportedTemplateShape,
  parseCompiledNodes,
} from "../html-parser.js";
import { normalizeTemplateStrings } from "../utils.js";
import {
  appendCompiledNode,
  normalizeCompactNode,
} from "./materialize.js";
import type {
  RuntimeCompiledTemplate,
  RuntimeCompiledTemplateInput,
  RuntimeNode,
} from "./types.js";

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
} from "./types.js";

export {
  applyCompiledProps,
  createCompiledElement,
  createCompiledFragment,
} from "./element.js";

const CALLSITE_TEMPLATE_CACHE = new WeakMap<
  TemplateStringsArray,
  RuntimeCompiledTemplate | null
>();
const DYNAMIC_TEMPLATE_CACHE = new Map<
  string,
  RuntimeCompiledTemplate | null
>();
const DYNAMIC_TEMPLATE_CACHE_LIMIT = 256;

/**
 * Runtime helper used by the build transform for dynamic templates.
 *
 * Parses the template once into a compact tree and materializes each call with
 * the current interpolation values. Unsupported shapes fall back to `html```.
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
    const reusableResult = getReusableHtmlResult(input, values);
    if (reusableResult) return reusableResult;
    const runtimeDefinition = isRuntimeCompiledTemplate(input);
    const normalizedStrings = runtimeDefinition
      ? null
      : normalizeTemplateStrings(input);
    const compiled = runtimeDefinition
      ? normalizeRuntimeCompiledTemplate(input)
      : getCachedCompiledRuntimeTemplate(input, normalizedStrings!);

    if (!compiled) {
      return html(normalizedStrings!, ...values);
    }

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
  };

  return boundRuntime
    ? runWithFabricaRuntime(boundRuntime, materialize)
    : runWithCurrentFabricaRuntime(materialize);
}

function getReusableHtmlResult(
  input: RuntimeCompiledTemplateInput | TemplateStringsArray | readonly string[],
  values: readonly RenderValue[],
): HtmlResult | null {
  if (isRuntimeCompiledTemplate(input) || values.length !== 1) return null;

  const strings = Array.from(input);
  if (strings.length !== 2 || strings.some((part) => part.trim())) return null;

  const value = values[0];
  return isHtmlResult(value) ? value : null;
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
  input: TemplateStringsArray | readonly string[],
  strings: TemplateStringsArray,
): RuntimeCompiledTemplate | null {
  if (isTemplateStringsArray(input)) {
    if (CALLSITE_TEMPLATE_CACHE.has(input)) {
      return CALLSITE_TEMPLATE_CACHE.get(input) ?? null;
    }
    const compiled = compileRuntimeTemplate(strings);
    CALLSITE_TEMPLATE_CACHE.set(input, compiled);
    return compiled;
  }

  const key = JSON.stringify(Array.from(strings));
  if (DYNAMIC_TEMPLATE_CACHE.has(key)) {
    const cached = DYNAMIC_TEMPLATE_CACHE.get(key) ?? null;
    DYNAMIC_TEMPLATE_CACHE.delete(key);
    DYNAMIC_TEMPLATE_CACHE.set(key, cached);
    return cached;
  }

  const compiled = compileRuntimeTemplate(strings);
  DYNAMIC_TEMPLATE_CACHE.set(key, compiled);
  if (DYNAMIC_TEMPLATE_CACHE.size > DYNAMIC_TEMPLATE_CACHE_LIMIT) {
    const oldest = DYNAMIC_TEMPLATE_CACHE.keys().next().value as
      | string
      | undefined;
    if (oldest !== undefined) DYNAMIC_TEMPLATE_CACHE.delete(oldest);
  }
  return compiled;
}

function isTemplateStringsArray(
  value: TemplateStringsArray | readonly string[],
): value is TemplateStringsArray {
  return Array.isArray(value) && Array.isArray(
    (value as { raw?: unknown }).raw,
  );
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
