/** Lightweight mode scanner for the polymorphic `Cipo.css` entry point. */
export type PolymorphicCssSource = {
  readonly css: string;
  readonly configCss: string;
  readonly inline: boolean;
};

const CONFIG_DIRECTIVES: Record<string, 1> = {
  cipo: 1,
  config: 1,
  theme: 1,
  tokens: 1,
  breakpoints: 1,
  alias: 1,
  helper: 1,
  preset: 1,
  plugin: 1,
};

const DETECTION_CACHE_LIMIT = 512;
const sourceDetectionCache = new Map<string, PolymorphicCssSource>();

/** Clears bounded source-shape detection cache. Intended for tests/benchmarks. */
export function clearPolymorphicDetectionCache(): void {
  sourceDetectionCache.clear();
}

/**
 * Splits the single `Cipo.css` entry point into the lightest safe mode.
 *
 * @remarks
 * This is a bounded top-level scanner, not a second parser. It only looks at
 * the first meaningful directive and top-level CSS-first config directives.
 * That keeps legacy atomic detection fast while allowing:
 *
 * - `css({ px: 2 })` for inline style objects.
 * - `css`@inline { px: 2 }`` for inline template strings.
 * - `css`@cipo {...} @theme {...} .card {...}`` for configure + sheet.
 * - `css`@cipo {...}`` for pure CSS-first setup.
 */
export function splitPolymorphicCssSource(input: string): PolymorphicCssSource {
  const cached = sourceDetectionCache.get(input);
  if (cached) return cached;

  const result = scanPolymorphicCssSource(input);
  sourceDetectionCache.set(input, result);
  if (sourceDetectionCache.size > DETECTION_CACHE_LIMIT) {
    const oldest = sourceDetectionCache.keys().next().value as string | undefined;
    if (oldest !== undefined) sourceDetectionCache.delete(oldest);
  }
  return result;
}

function scanPolymorphicCssSource(input: string): PolymorphicCssSource {
  const first = findFirstMeaningful(input);
  if (
    first >= 0 &&
    input.startsWith("@inline", first) &&
    isDirectiveBoundary(input[first + 7] || "")
  ) {
    const afterName = skipWhitespace(input, first + 7);
    if (input[afterName] === "{") {
      const close = findMatchingTopLevelBrace(input, afterName);
      if (close >= 0) {
        return {
          css: input.slice(afterName + 1, close),
          configCss: "",
          inline: true,
        };
      }
    }
    if (input[afterName] === ";")
      return { css: input.slice(afterName + 1), configCss: "", inline: true };
  }

  let configCss = "";
  let cssText = "";
  let index = 0;
  let sawConfig = false;

  while (index < input.length) {
    const next = findNextTopLevelAt(input, index);
    if (next < 0) {
      cssText += input.slice(index);
      break;
    }

    cssText += input.slice(index, next);

    const nameStart = next + 1;
    const nameEnd = readDirectiveNameEnd(input, nameStart);
    const directive = input.slice(nameStart, nameEnd);
    const cursor = skipWhitespace(input, nameEnd);
    const namedBlock = readTopLevelNamedBlock(input, cursor);
    const shouldTreatAsConfig =
      CONFIG_DIRECTIVES[directive] === 1 ||
      (directive === "property" && sawConfig);

    if (!shouldTreatAsConfig) {
      cssText += input.slice(next, nameEnd);
      index = nameEnd;
      continue;
    }

    if (input[cursor] === "{" || namedBlock) {
      const open = namedBlock ? namedBlock.open : cursor;
      const close = findMatchingTopLevelBrace(input, open);
      if (close < 0) {
        cssText += input.slice(next);
        break;
      }
      configCss += input.slice(next, close + 1) + "\n";
      sawConfig = true;
      index = close + 1;
      continue;
    }

    const end = findTopLevelStatementEnd(input, cursor);
    configCss += input.slice(next, end + 1) + "\n";
    sawConfig = true;
    index = end + 1;
  }

  return { css: cssText, configCss, inline: false };
}

export function findFirstMeaningful(input: string): number {
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (/\s/.test(char || "")) continue;
    if (char === "/" && input[index + 1] === "*") {
      const close = input.indexOf("*/", index + 2);
      if (close < 0) return -1;
      index = close + 1;
      continue;
    }
    if (char === "/" && input[index + 1] === "/") {
      const close = input.indexOf("\n", index + 2);
      if (close < 0) return -1;
      index = close;
      continue;
    }
    return index;
  }
  return -1;
}

export function findNextTopLevelAt(input: string, start: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "/" && input[index + 1] === "*") {
      const close = input.indexOf("*/", index + 2);
      if (close < 0) return -1;
      index = close + 1;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === "}" || char === ")" || char === "]") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && char === "@" && isDirectiveStart(input[index + 1] || ""))
      return index;
  }
  return -1;
}

function readDirectiveNameEnd(input: string, start: number): number {
  let index = start;
  while (index < input.length && /[a-zA-Z0-9_-]/.test(input[index] || ""))
    index += 1;
  return index;
}

function skipWhitespace(input: string, start: number): number {
  let index = start;
  while (index < input.length && /\s/.test(input[index] || "")) index += 1;
  return index;
}

function readTopLevelNamedBlock(
  input: string,
  start: number,
): { readonly open: number } | null {
  let index = start;
  let quote: '"' | "'" | null = null;
  while (index < input.length) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      index += 1;
      continue;
    }
    if (char === "{") return { open: index };
    if (char === ";" || char === "\n" || char === "}") return null;
    index += 1;
  }
  return null;
}

function findMatchingTopLevelBrace(input: string, open: number): number {
  if (input[open] !== "{") return -1;
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = open; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "/" && input[index + 1] === "*") {
      const close = input.indexOf("*/", index + 2);
      if (close < 0) return -1;
      index = close + 1;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function findTopLevelStatementEnd(input: string, start: number): number {
  let quote: '"' | "'" | null = null;
  for (let index = start; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ";") return index;
    if (char === "\n") return Math.max(start, index - 1);
  }
  return input.length - 1;
}

function isDirectiveStart(value: string): boolean {
  return /[a-zA-Z]/.test(value);
}

function isDirectiveBoundary(value: string): boolean {
  return !value || !/[a-zA-Z0-9_-]/.test(value);
}

