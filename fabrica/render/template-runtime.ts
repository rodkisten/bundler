import { bindTemplateAttribute } from "../bindings/attribute.js";
import { createAttributeBindingValue } from "../bindings/interpolation.js";
import { bindSpreadPart } from "../bindings/spread.js";
import {
  getCurrentFabricaRuntime,
  runWithCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "../core/runtime-context.js";
import {
  getCompiledJsxTemplate,
  getCompiledTemplate,
  resolvePath,
} from "../template/index.js";
import type {
  FabricaRuntimeContext,
  HtmlArtifact,
  HtmlResult,
  HtmlTag,
  HtmlTemplateTag,
  RenderValue,
  TemplatePart,
} from "../types.js";
import { collectCleanupNodes } from "./cleanup.js";
import {
  bindComponentPart,
  type ComponentPartBindingHost,
} from "./component-part.js";
import {
  createHtmlResult,
  getHtmlArtifact,
  isHtmlResult,
  pruneInsignificantWhitespace,
} from "./html-result.js";
import { bindChildPart } from "./value.js";

const COMPONENT_PART_HOST: ComponentPartBindingHost = {
  bindFragmentParts: applyParts,
};

function createTemplateArtifact(
  strings: TemplateStringsArray,
  values: readonly RenderValue[],
  jsxMode: boolean,
  runtime: FabricaRuntimeContext,
): HtmlArtifact {
  const exposedStrings = Object.freeze(Array.from(strings));
  const capturedValues = Object.freeze(
    Array.from(values),
  ) as readonly RenderValue[];

  return Object.freeze({
    kind: "fabrica.html" as const,
    strings: exposedStrings,
    values: capturedValues,
    jsx: jsxMode,
    materialize: () =>
      runWithFabricaRuntime(runtime, () =>
        materializeHtmlTemplate(
          strings,
          capturedValues,
          jsxMode,
          runtime,
        ),
      ),
  });
}

function materializeHtmlTemplate(
  strings: TemplateStringsArray,
  values: readonly RenderValue[],
  jsxMode: boolean,
  runtime: FabricaRuntimeContext,
): HtmlResult {
  const compiled = jsxMode
    ? getCompiledJsxTemplate(strings, values)
    : getCompiledTemplate(strings, values);
  const fragment = compiled.template.content.cloneNode(
    true,
  ) as DocumentFragment;

  let cleanupNodes: Node[] = [];
  if (compiled.orderedParts.length > 0) {
    const collected = collectCleanupNodes(() => {
      applyParts(
        fragment,
        compiled.orderedParts,
        values,
        compiled.hasComponents,
      );
    });
    cleanupNodes = collected.nodes;
  }

  pruneInsignificantWhitespace(fragment);

  return createHtmlResult(
    fragment,
    createTemplateArtifact(
      strings,
      values,
      jsxMode,
      runtime,
    ),
    {
      cleanupNodes,
      dynamic:
        compiled.orderedParts.length > 0 ||
        cleanupNodes.length > 0,
    },
  );
}

const htmlTemplateTag: HtmlTemplateTag = (
  strings: TemplateStringsArray,
  ...values: RenderValue[]
): HtmlResult =>
  runWithCurrentFabricaRuntime(() => {
    const runtime = getCurrentFabricaRuntime();
    return materializeHtmlTemplate(
      strings,
      values,
      false,
      runtime,
    );
  });

const jsxHtmlTemplateTag: HtmlTemplateTag = (
  strings: TemplateStringsArray,
  ...values: RenderValue[]
): HtmlResult =>
  runWithCurrentFabricaRuntime(() => {
    const runtime = getCurrentFabricaRuntime();
    return materializeHtmlTemplate(
      strings,
      values,
      true,
      runtime,
    );
  });

/**
 * Creates DOM from a tagged template.
 *
 * A template with one meaningful root returns that real root node. Empty and
 * multi-root templates return a `DocumentFragment`. Every result carries a
 * non-enumerable artifact that can materialize a fresh DOM instance.
 */
export const html: HtmlTag = Object.assign(htmlTemplateTag, {
  jsx: jsxHtmlTemplateTag,
  artifact: getHtmlArtifact,
  isResult: isHtmlResult,
});

/** JSX-friendly namespace for `jsx.html` authoring. */
export const jsx = Object.freeze({
  html: jsxHtmlTemplateTag,
});

/** Applies compiled template-part descriptors to a cloned fragment. */
export function applyParts(
  fragment: DocumentFragment,
  parts: readonly TemplatePart[],
  values: readonly RenderValue[],
  _hasComponents = false,
): void {
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;

    if (
      (part.type === "attribute" || part.type === "spread") &&
      part.componentProp
    ) {
      continue;
    }

    const node = resolvePath(fragment, part.path);
    if (!node) continue;

    if (part.type === "child") {
      bindChildPart(node, values[part.index]);
      continue;
    }

    if (part.type === "attribute") {
      if (!(node instanceof Element)) continue;
      bindTemplateAttribute(
        node,
        part.name,
        createAttributeBindingValue(part, values),
      );
      continue;
    }

    if (part.type === "spread") {
      if (!(node instanceof Element)) continue;
      bindSpreadPart(node, values[part.index]);
      continue;
    }

    bindComponentPart(
      node,
      part.index >= 0 ? values[part.index] : undefined,
      values,
      COMPONENT_PART_HOST,
      part,
      part.dynamicPropParts ?? [],
    );
  }
}
