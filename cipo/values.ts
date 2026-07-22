import { runtime } from "./runtime";
import type {
  AliasScale,
  CipoDeclarationNode,
} from "./types";
import { resolveThemeReferencesForValue } from "./theme-reference";
import {
  findTopLevelColon,
  isPlainNumber,
} from "./utils";
import {
  getTypedInitialValue,
  normalizeCustomPropertyName,
  normalizeTypedCssValue,
  property as registerCssProperty,
  typedProperty,
} from "./properties";
import { normalizePxValues } from "./helpers";
import { createHelperResolver } from "./values/helper-resolution";
import { RADIUS_TOKENS, SHADOW_TOKENS, TEXT_SIZE_TOKENS } from "./values/presets";
import { createSmartValueTools } from "./values/smart";
import { createTextExpander } from "./values/text";

const textExpander = createTextExpander(normalizeValue);
const helperResolver = createHelperResolver(normalizeValue);
const smartValueTools = createSmartValueTools(normalizeValue, expandText);

/**
 * Normalizes a property/value pair into one or more real CSS declarations.
 *
 * @remarks
 * Property aliases are resolved here, not in the parser, so the parser can stay
 * a very small tokenizer. A leading `#` is accepted as an escape hatch for raw
 * CSS properties in the DSL. This makes examples such as
 * `#box-shadow: outlineGlow($brand)` work even when a shortcut with the same
 * semantic name exists now or later.
 *
 * @param rawProperty - DSL or real CSS property.
 * @param rawValue - CSS value.
 * @returns Declaration nodes.
 *
 * @example Optional semicolons
 * ```ts
 * css`
 *   px: 4
 *   py: 2
 *   bg: $brand
 * `
 * ```
 *
 * Output CSS contains:
 * ```css
 * padding-inline: calc(var(--cipo-spacing, 0.25rem) * 4);
 * padding-block: calc(var(--cipo-spacing, 0.25rem) * 2);
 * background: var(--cipo-colors-brand);
 * ```
 *
 * @example Raw property escape
 * ```ts
 * css`
 *   #box-shadow: outlineGlow($brand)
 * `
 * ```
 *
 * Output CSS contains:
 * ```css
 * box-shadow: 0 0 0 3px color-mix(...);
 * ```
 */
export function normalizePropertyDeclaration(
  rawProperty: string,
  rawValue: string,
): CipoDeclarationNode[] {
  let propertyKey = rawProperty.trim();
  let valueInput = rawValue;
  let forceRawProperty = false;
  let forceImportant = false;

  if (propertyKey[0] === "!") {
    propertyKey = propertyKey.slice(1).trim();
    forceImportant = true;
  }

  if (propertyKey[0] === "#") {
    forceRawProperty = true;
    propertyKey = propertyKey.slice(1).trim();
  }

  if (propertyKey.startsWith("$$")) {
    const annotation = parseTypedPropertyAnnotation(propertyKey);
    const customProperty = normalizeCustomPropertyName(
      annotation?.name ?? propertyKey,
    );
    if (annotation) {
      typedProperty(
        annotation.name,
        annotation.type,
        valueInput,
      );
    }
    const typedValue = normalizeTypedCssValue(valueInput);
    if (typedValue) {
      registerCssProperty(customProperty, {
        syntax: typedValue.syntax,
        inherits: typedValue.inherits,
        initialValue: typedValue.initialValue,
      });
      return applyDeclarationImportant([
        {
          type: "declaration",
          property: customProperty,
          value: getTypedInitialValue(typedValue),
          source: `${rawProperty}:${valueInput}`,
        },
      ], forceImportant);
    }
    return applyDeclarationImportant([
      {
        type: "declaration",
        property: customProperty,
        value: normalizeValue("theme-token", valueInput),
        source: `${rawProperty}:${valueInput}`,
      },
    ], forceImportant);
  }

  const smartProperty = smartValueTools.normalizePropertyDeclaration(
    propertyKey,
    valueInput,
  );
  if (smartProperty) return applyDeclarationImportant(smartProperty, forceImportant);

  if (propertyKey === "text") {
    return parseGeneratedDeclarations(expandText(rawValue));
  }

  const lookupKey = runtime.propertyAliasRegistry.has(propertyKey)
    ? propertyKey
    : propertyKey.toLowerCase();
  const alias = forceRawProperty
    ? undefined
    : runtime.propertyAliasRegistry.get(lookupKey);
  const property = alias?.property ?? propertyKey;
  const scale = alias?.scale ?? "none";
  const value = normalizeValue(property, valueInput, scale);

  return applyDeclarationImportant([
    {
      type: "declaration",
      property,
      value,
      source: `${rawProperty}:${valueInput}`,
    },
  ], forceImportant);
}

function parseTypedPropertyAnnotation(
  property: string,
): { readonly name: string; readonly type: string } | null {
  const match = /^\$\$([a-zA-Z_][\w.-]*)<([a-zA-Z][\w-]*)>$/.exec(
    property.trim(),
  );
  if (!match?.[1] || !match[2]) return null;
  return {
    name: `$$${match[1]}`,
    type: match[2],
  };
}

function applyDeclarationImportant(nodes: CipoDeclarationNode[], important: boolean): CipoDeclarationNode[] {
  if (!important) return nodes;
  return nodes.map((node) => ({
    ...node,
    value: /\s!important\s*$/i.test(node.value) ? node.value : `${node.value} !important`,
  }));
}

/**
 * Resolves theme tokens, helpers, REM conversion and scale shortcuts.
 *
 * @remarks
 * This is hot code. It avoids recursive helper expansion because recursive
 * expansion made nested helpers such as `outlineGlow($brand)` → `alpha(...)`
 * capable of hammering mobile Safari. Helpers now run through a bounded,
 * iterative scanner.
 *
 * @param property - Final CSS property.
 * @param rawValue - Raw value.
 * @param scale - Value scale hint.
 * @returns Normalized CSS value.
 */
export function normalizeValue(
  property: string,
  rawValue: string,
  scale: AliasScale = "none",
): string {
  const trimmed = rawValue.trim();
  if (property === "container") return trimmed.replace(/^calc\(([\s\S]*)\)$/i, "$1");
  const valueScale = smartValueTools.resolveScale(property, trimmed, scale);
  const resolved = helperResolver(
    resolveThemeReferencesForValue(trimmed, property, valueScale),
  );
  const smartValue = smartValueTools.normalizePropertyValue(
    property,
    resolved,
    valueScale,
  );

  if (valueScale === "spacing" && isPlainNumber(smartValue))
    return Number(smartValue) === 0
      ? "0"
      : `calc(var(--${runtime.config.prefix}-spacing, 0.25rem) * ${smartValue})`;
  if (valueScale === "radius" && RADIUS_TOKENS.has(smartValue))
    return `var(--${runtime.config.prefix}-radius-${smartValue})`;
  if (valueScale === "shadow" && SHADOW_TOKENS.has(smartValue))
    return `var(--${runtime.config.prefix}-shadow-${smartValue})`;
  if (valueScale === "text" && TEXT_SIZE_TOKENS.has(smartValue))
    return `var(--${runtime.config.prefix}-text-${smartValue})`;

  return normalizePxValues(smartValue);
}

/** Resolves registered helper calls using the bounded shared scanner. */
export function resolveHelpers(input: string): string {
  return helperResolver(input);
}

/** Expands modern declaration-level smart shorthands. */
export function expandSmartDeclarationFunction(name: string, args: readonly string[]): string {
  return smartValueTools.expandDeclarationFunction(name, args);
}

/** Expands the typography helper into standard CSS declarations. */
export function expandText(args: string): string {
  return textExpander(args);
}

export function parseGeneratedDeclarations(
  cssText: string,
): CipoDeclarationNode[] {
  const output: CipoDeclarationNode[] = [];
  let start = 0;

  for (let index = 0; index <= cssText.length; index += 1) {
    if (index < cssText.length && cssText[index] !== ";") continue;

    const part = cssText.slice(start, index).trim();
    start = index + 1;
    if (!part) continue;

    const colonIndex = findTopLevelColon(part);
    if (colonIndex <= 0) continue;

    output.push({
      type: "declaration",
      property: part.slice(0, colonIndex).trim(),
      value: part.slice(colonIndex + 1).trim(),
      source: part,
    });
  }

  return output;
}

/**
 * Checks whether a function name belongs to CSS itself rather than Cipó.
 *
 * @remarks
 * The function name is normalized to lowercase so authoring can use either
 * `rotateX(...)` or `rotatex(...)`. Cipó helpers remain case-sensitive by
 * design, but platform CSS functions are case-insensitive in practice.
 *
 * @param name - Function name without parentheses.
 * @returns Whether the name is registered as native CSS.
 */
export function isNativeCssFunction(name: string): boolean {
  return runtime.nativeFunctionRegistry.has(
    String(name || "")
      .trim()
      .toLowerCase(),
  );
}

