import { normalizePxValues } from '../helpers'
import { runtime } from '../runtime'
import type { CipoHelperContext } from '../types'
import type { ValueNormalizer } from './contracts'

const MAX_HELPER_PASSES = 12

/** Creates the bounded helper resolver once per value-normalization pipeline. */
export function createHelperResolver(normalizeValue: ValueNormalizer): (input: string) => string {
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
  function resolveHelpers(input: string): string {
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


  return resolveHelpers
}
