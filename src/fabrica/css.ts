import { isPlainObject, isTemplateStringsArray } from "@/guards";
import { readValue } from "@/value";
import type { CssInput } from "@/types";

/** Parsed CSS declaration. */
type CssDeclaration = {
  name: string;
  value: string;
  important: boolean;
};

/** Cache parsed inline declaration strings. */
const declarationCache = new Map<string, CssDeclaration[]>();

/**
 * Creates CSS text from a template, string, or object.
 *
 * @param input - CSS source.
 * @param values - Template values.
 * @returns CSS text.
 *
 * @example Tagged CSS
 * ```ts
 * const text = css`color: ${color};`;
 * ```
 *
 * @example Object CSS
 * ```ts
 * const text = css({ backgroundColor: "black", color: "white" });
 * ```
 */
export function css(input: CssInput, ...values: unknown[]): string {
  if (typeof input === "string") {
    return input;
  }

  if (isTemplateStringsArray(input)) {
    let output = "";

    for (let index = 0; index < input.length; index += 1) {
      output += input[index] ?? "";

      if (index < values.length) {
        output += stringifyCssValue(readValue(values[index]));
      }
    }

    return output;
  }

  if (isPlainObject(input)) {
    let output = "";

    for (const property in input) {
      const value = stringifyCssValue(readValue(input[property]));

      if (!value) {
        continue;
      }

      output += `${toKebabCase(property)}: ${value};`;
    }

    return output;
  }

  return "";
}

/**
 * Applies CSS to an element or style tag.
 *
 * @param element - Target element.
 * @param input - CSS input.
 * @param values - Template values.
 * @param important - Whether all declarations should be forced important.
 */
export function applyCss(element: Element, input: CssInput, values: unknown[], important: boolean): void {
  const cssText = css(input, ...values);

  if (element.tagName === "STYLE") {
    element.textContent = important ? addImportantToCssText(cssText) : cssText;
    return;
  }

  const style = (element as HTMLElement).style;
  const declarations = parseCssDeclarations(cssText);

  for (let index = 0; index < declarations.length; index += 1) {
    const declaration = declarations[index];

    if (!declaration) {
      continue;
    }

    style.setProperty(declaration.name, declaration.value, important || declaration.important ? "important" : "");
  }
}

/**
 * Parses simple CSS declarations for inline style application.
 *
 * @remarks
 * This parser intentionally targets inline declarations such as
 * `color: red; background: black`. It does not parse nested rules. Style tags
 * receive raw text instead.
 *
 * @param cssText - CSS declaration text.
 * @returns Parsed declarations.
 */
export function parseCssDeclarations(cssText: string): CssDeclaration[] {
  const cached = declarationCache.get(cssText);

  if (cached) {
    return cached;
  }

  const declarations: CssDeclaration[] = [];
  let start = 0;

  for (let index = 0; index <= cssText.length; index += 1) {
    if (index !== cssText.length && cssText.charCodeAt(index) !== 59) {
      continue;
    }

    const chunk = cssText.slice(start, index).trim();
    start = index + 1;

    if (!chunk) {
      continue;
    }

    const colonIndex = chunk.indexOf(":");

    if (colonIndex <= 0) {
      continue;
    }

    const name = chunk.slice(0, colonIndex).trim();
    let value = chunk.slice(colonIndex + 1).trim();
    let important = false;

    if (/\s*!important\s*$/i.test(value)) {
      important = true;
      value = value.replace(/\s*!important\s*$/i, "").trim();
    }

    if (name && value) {
      declarations.push({ name, value, important });
    }
  }

  declarationCache.set(cssText, declarations);
  return declarations;
}

/**
 * Adds !important to every plain CSS declaration.
 *
 * @param cssText - CSS text.
 * @returns CSS text with !important appended to declarations.
 */
export function addImportantToCssText(cssText: string): string {
  return cssText.replace(/:\s*([^;{}]+)(;?)/g, (_match, value: string, semicolon: string) => {
    if (/\s*!important\s*$/i.test(value)) {
      return `: ${value.trim()}${semicolon || ";"}`;
    }

    return `: ${value.trim()} !important${semicolon || ";"}`;
  });
}

/**
 * Converts camelCase style names to kebab-case.
 *
 * @param value - CSS property name.
 * @returns Kebab-case property name.
 */
export function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Converts a CSS value to a string.
 *
 * @param value - Any CSS value.
 * @returns CSS-safe string.
 */
function stringifyCssValue(value: unknown): string {
  if (value == null || value === false) {
    return "";
  }

  return String(value);
}
