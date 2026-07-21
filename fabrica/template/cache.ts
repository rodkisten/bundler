import { debugState } from "../debug.js";
import { normalizeStaticSpecialAttributes } from
  "../bindings/special.js";
import type {
  CompiledTemplate,
  RenderValue,
} from "../types.js";
import { buildTemplateSource } from "./source.js";
import {
  comparePathsReverse,
  compileParts,
} from "./parts.js";

/** Template compilation caches keyed by browser-owned callsite arrays. */
const templateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();
const jsxTemplateCache = new WeakMap<TemplateStringsArray, CompiledTemplate>();
const namedComponentSyntaxCache = new WeakMap<
  TemplateStringsArray,
  boolean
>();

/**
 * Gets a compiled template from cache or compiles a new one.
 *
 * @remarks
 * The compiler understands normal child/attribute markers and Fabrica component
 * tags. Component tags are authored as real template syntax:
 *
 * ```ts
 * html`
 *   <${Button} tone="primary">
 *     Save
 *   </${Button}>
 * `
 * ```
 *
 * Internally, the opening component interpolation becomes a hidden
 * `<template data-fabrica-component="...">` node. At runtime that node is
 * replaced with the component output and its children are passed as
 * `props.children`.
 *
 * @param strings - Template strings.
 * @param values - Runtime values. Only used to detect component tag positions.
 * @returns Compiled template and static part metadata.
 *
 * @example Input
 * ```ts
 * html`<${Button} tone="primary">Save</${Button}>`
 * ```
 *
 * @example Generated shape
 * ```html
 * <template data-fabrica-component="0" tone="primary">Save</template>
 * ```
 */
export function getCompiledTemplate(strings: TemplateStringsArray, values: readonly RenderValue[] = []): CompiledTemplate {
  return getCompiledTemplateWithMode(strings, values, hasNamedComponentTagSyntax(strings));
}

/**
 * Gets a compiled micro-JSX template from cache or compiles a new one.
 *
 * @remarks
 * Micro-JSX supports registered uppercase component tags such as `<Panel />`
 * while leaving HTML comments alone. Commented components therefore behave like
 * React comments: `<!-- <Panel /> -->` remains a browser comment and does not
 * mount the component.
 *
 * @param strings - Template strings.
 * @param values - Runtime values.
 * @returns Compiled template and static part metadata.
 */
export function getCompiledJsxTemplate(strings: TemplateStringsArray, values: readonly RenderValue[] = []): CompiledTemplate {
  return getCompiledTemplateWithMode(strings, values, true);
}

/**
 * Detects registered-component syntax with a tiny static-chunk scan.
 *
 * @remarks
 * Normal `html`` ` remains on its original cache/compiler path unless a static
 * chunk contains `<Uppercase...` or `</Uppercase...`. Named styled components
 * can therefore be authored without passing their function to the template,
 * while ordinary templates pay only this bounded character scan once per call.
 */
export function hasNamedComponentTagSyntax(strings: TemplateStringsArray): boolean {
  const cached = namedComponentSyntaxCache.get(strings);
  if (cached !== undefined) return cached;

  for (let chunkIndex = 0; chunkIndex < strings.length; chunkIndex += 1) {
    const chunk = strings[chunkIndex] ?? "";
    for (let index = 0; index < chunk.length - 1; index += 1) {
      if (chunk[index] !== "<") continue;
      let nameIndex = index + 1;
      if (chunk[nameIndex] === "/") nameIndex += 1;
      const code = chunk.charCodeAt(nameIndex);
      if (code >= 65 && code <= 90) {
        namedComponentSyntaxCache.set(strings, true);
        return true;
      }
    }
  }
  namedComponentSyntaxCache.set(strings, false);
  return false;
}

function getCompiledTemplateWithMode(strings: TemplateStringsArray, values: readonly RenderValue[], jsx: boolean): CompiledTemplate {
  const cache = jsx ? jsxTemplateCache : templateCache;
  const cached = cache.get(strings);

  if (cached) {
    return cached;
  }

  const template = document.createElement("template");
  template.innerHTML = buildTemplateSource(strings, values, { jsx });
  normalizeStaticSpecialAttributes(template.content);

  const parts = compileParts(template.content);
  const orderedParts = parts.slice().sort((left, right) => comparePathsReverse(left.path, right.path));
  const compiled: CompiledTemplate = {
    template,
    parts,
    orderedParts,
    hasComponents: parts.some((part) => part.type === "component"),
  };

  cache.set(strings, compiled);
  debugState.templates += 1;
  debugState.parts += parts.length;

  return compiled;
}

