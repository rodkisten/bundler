import { runtime } from '../runtime'
import { createDeclaration, findTopLevelColon, parseFunctionCall, splitTopLevel } from '../utils'
import type { ValueNormalizer } from './contracts'
import { TEXT_SIZE_TOKENS } from './presets'

/** Creates the typography shorthand expander around the core value normalizer. */
export function createTextExpander(normalizeValue: ValueNormalizer): (args: string) => string {
  /**
   * Expands the typography helper into standard CSS declarations.
   *
   * @param args - text(...) arguments.
   * @returns CSS declarations.
   */
  function expandText(args: string): string {
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

  return expandText
}
