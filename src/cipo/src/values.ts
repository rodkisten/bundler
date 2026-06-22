import { runtime } from "./runtime";
import type {
  AliasScale,
  CipoDeclarationNode,
  CipoHelperContext,
} from "./types";
import { resolveThemeReferencesForValue } from "./theme";
import {
  createDeclaration,
  findTopLevelColon,
  isPlainNumber,
  parseFunctionCall,
  splitTopLevel,
  toKebabMixed,
} from "./utils";
import {
  getTypedInitialValue,
  normalizeCustomPropertyName,
  normalizeTypedCssValue,
  property as registerCssProperty,
} from "./properties";
import { normalizePxValues } from "./helpers";
import { createOklchUtilityColor } from "./runtime-dsl";

const TEXT_SIZE_TOKENS = new Set([
  "xs",
  "sm",
  "base",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);
const RADIUS_TOKENS = new Set([
  "none",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "full",
  "pill",
]);
const SHADOW_TOKENS = new Set([
  "none",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "inner",
  "glow",
  "panel",
  "neon",
]);
const MAX_HELPER_PASSES = 12;
const TRANSITION_PRESETS: Record<string, string> = {
  colors:
    "color 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
  transform: "transform 160ms ease",
  opacity: "opacity 160ms ease",
  all: "all 160ms ease",
  fast: "120ms ease",
  normal: "180ms ease",
  slow: "320ms ease",
};
const ANIMATION_PRESETS: Record<string, string> = {
  "fade-in": "fade-in 180ms ease-out both",
  "fade-out": "fade-out 180ms ease-in both",
  "slide-up": "slide-up 220ms ease-out both",
  "scale-in": "scale-in 160ms ease-out both",
};

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
  let forceRawProperty = false;

  if (propertyKey[0] === "#") {
    forceRawProperty = true;
    propertyKey = propertyKey.slice(1).trim();
  }

  if (propertyKey.startsWith("$$")) {
    const customProperty = normalizeCustomPropertyName(propertyKey);
    const typedValue = normalizeTypedCssValue(rawValue);
    if (typedValue) {
      registerCssProperty(customProperty, {
        syntax: typedValue.syntax,
        inherits: typedValue.inherits,
        initialValue: typedValue.initialValue,
      });
      return [
        {
          type: "declaration",
          property: customProperty,
          value: getTypedInitialValue(typedValue),
          source: `${rawProperty}:${rawValue}`,
        },
      ];
    }
    return [
      {
        type: "declaration",
        property: customProperty,
        value: normalizeValue("theme-token", rawValue),
        source: `${rawProperty}:${rawValue}`,
      },
    ];
  }

  const smartProperty = normalizeSmartPropertyDeclaration(
    propertyKey,
    rawValue,
  );
  if (smartProperty) return smartProperty;

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
  const value = normalizeValue(property, rawValue, scale);

  return [
    {
      type: "declaration",
      property,
      value,
      source: `${rawProperty}:${rawValue}`,
    },
  ];
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
  const valueScale = resolveSmartValueScale(property, trimmed, scale);
  const resolved = resolveHelpers(
    resolveThemeReferencesForValue(trimmed, property, valueScale),
  );
  const smartValue = normalizeSmartPropertyValue(
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

/**
 * Resolves helper calls by scanning balanced parentheses instead of regex.
 *
 * @remarks
 * The scanner only looks at real identifier/function starts and bails out after
 * a small number of passes. It supports both the promoted syntax
 * `alpha($brand / 20%)` and the legacy `x:alpha($brand / 20%)` syntax.
 *
 * @param input - CSS value.
 * @returns Value with helper calls expanded.
 *
 * @example
 * ```ts
 * resolveHelpers('alpha(var(--x) / 20%)')
 * // 'color-mix(in oklch, var(--x) 20%, transparent)'
 * ```
 */
export function resolveHelpers(input: string): string {
  let current = input;

  for (let pass = 0; pass < MAX_HELPER_PASSES; pass += 1) {
    const next = resolveHelpersOnePass(current);
    if (next === current) return normalizePxValues(next);
    current = next;
  }

  return normalizePxValues(current);
}

function resolveHelpersOnePass(input: string): string {
  let output = "";
  let index = 0;
  let changed = false;

  while (index < input.length) {
    const start = findHelperStart(input, index);

    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);

    const hasLegacyPrefix = input[start] === "x" && input[start + 1] === ":";
    const nameStart = hasLegacyPrefix ? start + 2 : start;
    const openIndex = readIdentifierEnd(input, nameStart);

    if (input[openIndex] !== "(") {
      output += input[start];
      index = start + 1;
      continue;
    }

    const name = input.slice(nameStart, openIndex);
    const closeIndex = findMatchingParen(input, openIndex);

    if (closeIndex < 0) {
      output += input.slice(start);
      break;
    }

    const helper = runtime.helperRegistry.get(name);

    if (!helper) {
      output += input.slice(start, closeIndex + 1);
      index = closeIndex + 1;
      continue;
    }

    const args = input.slice(openIndex + 1, closeIndex);
    const context: CipoHelperContext = {
      name,
      raw: args,
      config: runtime.config,
      resolveValue(value: string, property = "helper") {
        return normalizeValue(property, value);
      },
    };

    output += helper(args, context);
    changed = true;
    index = closeIndex + 1;
  }

  return changed ? output : input;
}

function normalizeSmartPropertyDeclaration(
  property: string,
  rawValue: string,
): CipoDeclarationNode[] | null {
  const normalized = property.trim();
  if (
    normalized !== "bor" &&
    normalized !== "bor-x" &&
    normalized !== "bor-y" &&
    normalized !== "bor-t" &&
    normalized !== "bor-r" &&
    normalized !== "bor-b" &&
    normalized !== "bor-l"
  )
    return null;
  const borderProperty =
    normalized === "bor"
      ? "border"
      : normalized === "bor-x"
        ? "border-inline"
        : normalized === "bor-y"
          ? "border-block"
          : normalized === "bor-t"
            ? "border-top"
            : normalized === "bor-r"
              ? "border-right"
              : normalized === "bor-b"
                ? "border-bottom"
                : "border-left";
  return [
    {
      type: "declaration",
      property: borderProperty,
      value: normalizeBorderValue(rawValue),
      source: `${property}:${rawValue}`,
    },
  ];
}

function resolveSmartValueScale(
  property: string,
  rawValue: string,
  fallback: AliasScale,
): AliasScale {
  if (
    property === "background" ||
    property === "background-image" ||
    property === "color" ||
    property.endsWith("color")
  )
    return "color";
  if (
    (property === "border" || property.startsWith("border-")) &&
    !/width|radius|style/i.test(property)
  )
    return "color";
  if (/^(?:color|bg)-[a-z]+-[0-9]{1,3}$/.test(rawValue.trim())) return "color";
  return fallback;
}

function normalizeSmartPropertyValue(
  property: string,
  value: string,
  scale: AliasScale,
): string {
  const trimmed = value.trim();
  if (
    (property === "background" || property === "background-image") &&
    trimmed.startsWith("image(")
  )
    return imageValue(trimmed);
  if (
    (property === "background" || property === "background-image") &&
    trimmed.startsWith("gradient(")
  )
    return trimmed;
  if (
    (property === "background" || property === "background-image") &&
    /^bg-[a-z]+-[0-9]{1,3}$/.test(trimmed)
  )
    return utilityColor(trimmed.slice(3));
  if (
    (property === "color" || property.endsWith("color")) &&
    /^color-[a-z]+-[0-9]{1,3}$/.test(trimmed)
  )
    return utilityColor(trimmed.slice(6));
  if (isBorderShorthandProperty(property) && scale === "color")
    return normalizeBorderValue(trimmed);
  if (property === "transition") return normalizeTransitionValue(trimmed);
  if (property === "animation") return normalizeAnimationValue(trimmed);
  return trimmed;
}

/**
 * Expands modern declaration-level smart shorthands.
 *
 * @remarks
 * This keeps high-level helpers such as `pos(...)`, `stack(...)`, `snap(...)`
 * and `focus-ring(...)` out of the generic helper resolver. They are parsed as
 * declaration functions so they can emit multiple CSS declarations without
 * pretending to be native CSS value functions. The implementation stays
 * allocation-light and bounded for browser runtime usage.
 *
 * @param name - Function name without parentheses.
 * @param args - Top-level argument list parsed from the function call.
 * @returns Generated declaration CSS or an empty string when unknown.
 *
 * @example
 * ```ts
 * expandSmartDeclarationFunction('pos', ['fixed', 'top: 0'])
 * // 'position:fixed;top:0;'
 * ```
 */
export function expandSmartDeclarationFunction(
  name: string,
  args: readonly string[],
): string {
  const raw = args.join(",");
  if (name === "h" || name === "w") return expandSizeFunction(name, raw);
  if (name === "pos") return expandPositionFunction(raw);
  if (name === "grid-template") return expandGridTemplateFunction(raw);
  if (name === "grid-flow")
    return createDeclaration(
      "grid-auto-flow",
      normalizeValue("grid-auto-flow", raw || "row"),
    );
  if (name === "text") return expandText(raw);
  if (name === "break") return expandBreakFunction(raw);
  if (name === "stack") return expandStackFunction(raw);
  if (name === "cluster") return expandClusterFunction(raw);
  if (name === "center") return expandCenterFunction(raw);
  if (name === "cover") return expandCoverFunction(raw);
  if (name === "sidebar") return expandSidebarFunction(raw);
  if (name === "scroll") return expandScrollFunction(raw);
  if (name === "scrollbar") return expandScrollbarFunction(raw);
  if (name === "snap") return expandSnapFunction(raw);
  if (name === "snap-item") return expandSnapItemFunction(raw);
  if (name === "overscroll")
    return createDeclaration(
      "overscroll-behavior",
      normalizeKeywordArg(raw, "auto"),
    );
  if (name === "tap")
    return createDeclaration("touch-action", normalizeTapValue(raw));
  if (name === "select")
    return createDeclaration("user-select", normalizeKeywordArg(raw, "auto"));
  if (name === "drag") return expandDragFunction(raw);
  if (name === "focus-ring") return expandFocusRingFunction(raw);
  if (name === "transition")
    return createDeclaration("transition", normalizeTransitionValue(raw));
  if (name === "animate")
    return createDeclaration("animation", normalizeAnimationValue(raw));
  return "";
}

function expandSizeFunction(kind: string, raw: string): string {
  const parts = splitTopLevel(raw, ",");
  const property = kind === "h" ? "height" : "width";
  const minProperty = kind === "h" ? "min-height" : "min-width";
  const maxProperty = kind === "h" ? "max-height" : "max-width";
  let output = "";
  const positional: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() || "";
    if (!part) continue;
    const colon = findTopLevelColon(part);
    if (colon > 0) {
      const key = part.slice(0, colon).trim();
      const value = part.slice(colon + 1).trim();
      if (key === "min")
        output += createDeclaration(
          minProperty,
          normalizeValue(minProperty, value, "spacing"),
        );
      else if (key === "max")
        output += createDeclaration(
          maxProperty,
          normalizeValue(maxProperty, value, "spacing"),
        );
      else if (key === "value" || key === kind || key === property)
        output += createDeclaration(
          property,
          normalizeValue(property, value, "spacing"),
        );
      continue;
    }
    positional.push(part);
  }
  const first = positional[0];
  if (first && first !== "contain")
    output =
      createDeclaration(
        property,
        normalizeValue(property, first === "fill" ? "100%" : first, "spacing"),
      ) + output;
  else if (first === "contain")
    output = createDeclaration(property, "auto") + output;
  return output;
}

function expandPositionFunction(raw: string): string {
  const parts = splitTopLevel(raw, ",");
  let output = "";
  let position = (parts[0] || "relative").trim();
  if (position.includes(":")) position = "relative";
  output += createDeclaration("position", position);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() || "";
    if (!part || (index === 0 && not_colon(part))) continue;
    const colon = findTopLevelColon(part);
    if (colon > 0) {
      const key = part.slice(0, colon).trim();
      const value = part.slice(colon + 1).trim();
      const prop =
        key === "x" ? "inset-inline" : key === "y" ? "inset-block" : key;
      output += createDeclaration(prop, normalizeValue(prop, value, "spacing"));
      continue;
    }
    if (
      part === "top" ||
      part === "right" ||
      part === "bottom" ||
      part === "left"
    )
      output += createDeclaration(part, "0");
  }
  return output;
}

function not_colon(value: string): boolean {
  return findTopLevelColon(value) < 0;
}

function expandGridTemplateFunction(raw: string): string {
  const parts = splitTopLevel(raw, ",");
  let output = "";
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() || "";
    const colon = findTopLevelColon(part);
    if (colon <= 0) continue;
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (key === "cols" || key === "columns")
      output += createDeclaration(
        "grid-template-columns",
        normalizeValue("grid-template-columns", value),
      );
    else if (key === "rows")
      output += createDeclaration(
        "grid-template-rows",
        normalizeValue("grid-template-rows", value),
      );
    else if (key === "areas")
      output += createDeclaration("grid-template-areas", value);
  }
  return output;
}

function expandBreakFunction(raw: string): string {
  const value = normalizeKeywordArg(raw, "word");
  if (value === "anywhere")
    return createDeclaration("overflow-wrap", "anywhere");
  if (value === "word" || value === "words")
    return createDeclaration("overflow-wrap", "break-word");
  if (value === "all") return createDeclaration("word-break", "break-all");
  if (value === "keep") return createDeclaration("word-break", "keep-all");
  return createDeclaration("word-break", value);
}

function expandStackFunction(raw: string): string {
  const values = parseNamedArgs(raw);
  return (
    createDeclaration("display", "flex") +
    createDeclaration("flex-direction", values.direction || "column") +
    createDeclaration(
      "gap",
      normalizeValue("gap", values.gap || values.space || "4", "spacing"),
    )
  );
}

function expandClusterFunction(raw: string): string {
  const values = parseNamedArgs(raw);
  return (
    createDeclaration("display", "flex") +
    createDeclaration("flex-wrap", values.wrap || "wrap") +
    createDeclaration("align-items", values.align || values.items || "center") +
    createDeclaration("justify-content", values.justify || "flex-start") +
    createDeclaration(
      "gap",
      normalizeValue("gap", values.gap || "3", "spacing"),
    )
  );
}

function expandCenterFunction(raw: string): string {
  const values = parseNamedArgs(raw);
  let output =
    createDeclaration("box-sizing", "content-box") +
    createDeclaration("margin-inline", "auto");
  if (values.max)
    output += createDeclaration(
      "max-width",
      normalizeValue("max-width", values.max, "spacing"),
    );
  if (values.px)
    output += createDeclaration(
      "padding-inline",
      normalizeValue("padding-inline", values.px, "spacing"),
    );
  if (values.text === "true" || values.text === "center")
    output += createDeclaration("text-align", "center");
  return output;
}

function expandCoverFunction(raw: string): string {
  const values = parseNamedArgs(raw);
  const rows = [
    values.header || "auto",
    values.main || "1fr",
    values.footer || "auto",
  ].join(" ");
  return (
    createDeclaration("display", "grid") +
    createDeclaration("grid-template-rows", rows) +
    createDeclaration("min-block-size", values.min || "100dvh")
  );
}

function expandSidebarFunction(raw: string): string {
  const values = parseNamedArgs(raw);
  const width = values.width || values.w || "280px";
  const gap = values.gap || "4";
  const side = values.side || "left";
  const columns =
    side === "right"
      ? `minmax(0,1fr) ${normalizeValue("width", width, "spacing")}`
      : `${normalizeValue("width", width, "spacing")} minmax(0,1fr)`;
  return (
    createDeclaration("display", "grid") +
    createDeclaration("grid-template-columns", columns) +
    createDeclaration("gap", normalizeValue("gap", gap, "spacing"))
  );
}

function expandScrollFunction(raw: string): string {
  const value = normalizeKeywordArg(raw, "smooth");
  if (value === "touch")
    return createDeclaration("-webkit-overflow-scrolling", "touch");
  return createDeclaration("scroll-behavior", value);
}

function expandScrollbarFunction(raw: string): string {
  const value = normalizeKeywordArg(raw, "thin");
  return createDeclaration("scrollbar-width", value);
}

function expandSnapFunction(raw: string): string {
  const parts = splitTopLevel(raw, ",");
  const axis = (parts[0] || "x").trim();
  const strictness = (parts[1] || "mandatory").trim();
  return createDeclaration("scroll-snap-type", `${axis} ${strictness}`);
}

function expandSnapItemFunction(raw: string): string {
  const value = normalizeKeywordArg(raw, "start");
  return createDeclaration("scroll-snap-align", value);
}

function expandDragFunction(raw: string): string {
  const value = normalizeKeywordArg(raw, "none");
  if (value === "none")
    return (
      createDeclaration("-webkit-user-drag", "none") +
      createDeclaration("user-select", "none")
    );
  return createDeclaration("-webkit-user-drag", value);
}

function expandFocusRingFunction(raw: string): string {
  const color = normalizeValue(
    "outline-color",
    raw.trim() || "$brand",
    "color",
  );
  return (
    createDeclaration("outline", `2px solid ${color}`) +
    createDeclaration("outline-offset", "2px")
  );
}

function parseNamedArgs(raw: string): Record<string, string> {
  const output: Record<string, string> = Object.create(null);
  const parts = splitTopLevel(raw, ",");
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() || "";
    if (!part) continue;
    const colon = findTopLevelColon(part);
    if (colon > 0)
      output[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
    else output[index === 0 ? "value" : `_${index}`] = part;
  }
  return output;
}

function normalizeKeywordArg(raw: string, fallback: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, "") || fallback;
}

function normalizeTapValue(raw: string): string {
  const value = normalizeKeywordArg(raw, "manipulation");
  if (value === "none") return "none";
  if (
    value === "pan-x" ||
    value === "pan-y" ||
    value === "auto" ||
    value === "manipulation"
  )
    return value;
  return "manipulation";
}

function normalizeTransitionValue(raw: string): string {
  const parts = splitTopLevel(raw, ",");
  if (parts.length === 1)
    return TRANSITION_PRESETS[parts[0]?.trim() || ""] || raw;
  let output = "";
  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] || "").trim();
    const value = TRANSITION_PRESETS[part] || part;
    if (!value) continue;
    output += output ? `, ${value}` : value;
  }
  return output || raw;
}

function normalizeAnimationValue(raw: string): string {
  return ANIMATION_PRESETS[raw.trim()] || raw;
}

function imageValue(raw: string): string {
  const call = parseFunctionCall(raw);
  const url = call?.args.join(",").trim() || "";
  if (!url) return raw;
  if (/^url\(/i.test(url)) return url;
  if (/^['"]/.test(url)) return `url(${url})`;
  return `url("${url.replace(/"/g, '\\"')}")`;
}

function utilityColor(value: string): string {
  const [name, shade] = value.split("-");
  return createOklchUtilityColor(name || "accent", Number(shade || 500));
}

function isBorderShorthandProperty(property: string): boolean {
  return (
    property === "border" ||
    property === "border-inline" ||
    property === "border-block" ||
    property === "border-top" ||
    property === "border-right" ||
    property === "border-bottom" ||
    property === "border-left"
  );
}

function normalizeBorderValue(raw: string): string {
  const parts = splitTopLevel(raw.trim(), " ");
  let width = "";
  let style = "";
  let color = "";
  const styles = new Set([
    "none",
    "hidden",
    "dotted",
    "dashed",
    "solid",
    "double",
    "groove",
    "ridge",
    "inset",
    "outset",
  ]);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() || "";
    if (!part) continue;
    if (
      !width &&
      (/^-?\d/.test(part) ||
        part === "thin" ||
        part === "medium" ||
        part === "thick")
    ) {
      width = normalizeValue("border-width", part, "spacing");
      continue;
    }
    if (!style && styles.has(part)) {
      style = part;
      continue;
    }
    color += color ? ` ${part}` : part;
  }
  if (!width) width = "1px";
  if (!style) style = "solid";
  if (!color) color = "currentColor";
  return `${width} ${style} ${normalizeValue("border-color", color, "color")}`;
}

/**
 * Expands the typography helper into standard CSS declarations.
 *
 * @param args - text(...) arguments.
 * @returns CSS declarations.
 */
export function expandText(args: string): string {
  const parts = splitTopLevel(args, ",");
  const typed: Record<string, string> = {};
  let output = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] ?? "";
    const call = parseFunctionCall(part);
    const colonIndex = findTopLevelColon(part);

    if (colonIndex > 0 && !call) {
      typed[part.slice(0, colonIndex).trim()] = part
        .slice(colonIndex + 1)
        .trim();
      continue;
    }

    const token = part.trim();
    if (!token) continue;

    if (token === "underline")
      output += createDeclaration("text-decoration-line", "underline");
    else if (token === "no-underline")
      output += createDeclaration("text-decoration-line", "none");
    else if (token === "nowrap")
      output += createDeclaration("white-space", "nowrap");
    else if (token === "pre" || token === "pre-wrap" || token === "pre-line")
      output += createDeclaration("white-space", token);
    else if (token === "normal")
      output += createDeclaration("white-space", "normal");
    else if (token === "balance" || token === "pretty" || token === "stable")
      output += createDeclaration("text-wrap", token);
    else if (
      token === "uppercase" ||
      token === "lowercase" ||
      token === "capitalize"
    )
      output += createDeclaration("text-transform", token);
    else if (isColorLike(token))
      output += createDeclaration(
        "color",
        normalizeValue("color", token, "color"),
      );
    else if (token.startsWith("gradient(")) {
      output += createDeclaration(
        "background-image",
        normalizeValue("background-image", token),
      );
      output += createDeclaration("-webkit-background-clip", "text");
      output += createDeclaration("background-clip", "text");
      output += createDeclaration("color", "transparent");
    }
  }

  if (typed.size)
    output += createDeclaration(
      "font-size",
      TEXT_SIZE_TOKENS.has(typed.size)
        ? `var(--${runtime.config.prefix}-text-${typed.size})`
        : normalizeValue("font-size", typed.size),
    );
  if (typed.lh || typed.leading)
    output += createDeclaration("line-height", typed.lh ?? typed.leading ?? "");
  if (typed.weight) output += createDeclaration("font-weight", typed.weight);
  if (typed.color)
    output += createDeclaration(
      "color",
      normalizeValue("color", typed.color, "color"),
    );
  if (typed.align) output += createDeclaration("text-align", typed.align);
  if (typed.decoration)
    output += createDeclaration("text-decoration-line", typed.decoration);
  if (typed.shadow)
    output += createDeclaration(
      "text-shadow",
      normalizeValue("text-shadow", typed.shadow, "shadow"),
    );
  if (typed.tracking)
    output += createDeclaration(
      "letter-spacing",
      normalizeValue("letter-spacing", typed.tracking),
    );
  if (typed.transform)
    output += createDeclaration("text-transform", typed.transform);
  if (typed.wrap) output += createDeclaration("text-wrap", typed.wrap);
  if (typed.fill) {
    output += createDeclaration(
      "background-image",
      normalizeValue("background-image", typed.fill),
    );
    output += createDeclaration("-webkit-background-clip", "text");
    output += createDeclaration("background-clip", "text");
    output += createDeclaration("color", "transparent");
  }

  return output;
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

function findHelperStart(input: string, fromIndex: number): number {
  for (let index = fromIndex; index < input.length; index += 1) {
    const char = input[index];

    if (
      char === "x" &&
      input[index + 1] === ":" &&
      isIdentifierStart(input[index + 2] ?? "")
    ) {
      const nameStart = index + 2;
      const nameEnd = readIdentifierEnd(input, nameStart);
      const name = input.slice(nameStart, nameEnd);
      if (input[nameEnd] === "(" && runtime.helperRegistry.has(name))
        return index;
      index = nameEnd;
      continue;
    }

    if (!isIdentifierStart(char ?? "")) continue;
    if (index > 0 && isIdentifierPart(input[index - 1] ?? "")) continue;

    const nameEnd = readIdentifierEnd(input, index);
    const name = input.slice(index, nameEnd);
    if (input[nameEnd] === "(" && runtime.helperRegistry.has(name))
      return index;
    index = nameEnd;
  }

  return -1;
}

function readIdentifierEnd(input: string, start: number): number {
  let index = start;
  while (index < input.length && isIdentifierPart(input[index] ?? ""))
    index += 1;
  return index;
}

function findMatchingParen(input: string, openIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function isIdentifierStart(value: string): boolean {
  return /[a-zA-Z_]/.test(value);
}

function isIdentifierPart(value: string): boolean {
  return /[a-zA-Z0-9_-]/.test(value);
}

function isColorLike(value: string): boolean {
  return (
    value.startsWith("$") ||
    value.startsWith("#") ||
    value.startsWith("rgb") ||
    value.startsWith("hsl") ||
    value.startsWith("oklch") ||
    value.startsWith("oklab") ||
    value === "transparent" ||
    value === "currentColor"
  );
}
