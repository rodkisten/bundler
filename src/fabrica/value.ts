import {
  isClassMapDirective,
  isComponent,
  isDirective,
  isDomBag,
  isDomNode,
  isRawHtml,
  isSignal,
  isStyleMapDirective,
} from "@/guards";

/**
 * Reads signals and reactive expressions while leaving DOM-ish values intact.
 *
 * @param value - Value to resolve.
 * @returns Resolved value.
 *
 * @example
 * ```ts
 * const count = signal(1);
 * console.log(readValue(count));
 * // 1
 * ```
 */
export function readValue(value: unknown): unknown {
  if (isSignal(value)) {
    return value();
  }

  if (
    Array.isArray(value) ||
    isDirective(value) ||
    isRawHtml(value) ||
    isDomNode(value) ||
    isComponent(value) ||
    isDomBag(value)
  ) {
    return value;
  }

  if (typeof value === "function") {
    return (value as () => unknown)();
  }

  return value;
}

/**
 * Checks whether a value or directive contains reactive reads.
 *
 * @param value - Value to inspect.
 * @returns Whether the value should be wrapped in an effect.
 */
export function hasReactiveValue(value: unknown): boolean {
  if (isSignal(value)) {
    return true;
  }

  if (typeof value === "function" && !isComponent(value)) {
    return true;
  }

  if (isClassMapDirective(value) || isStyleMapDirective(value)) {
    const map = value.value;

    for (const key in map) {
      if (hasReactiveValue(map[key])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Converts a nullable value to text.
 *
 * @param value - Input value.
 * @returns Empty string for nullish values, string otherwise.
 */
export function stringifyValue(value: unknown): string {
  if (value == null) {
    return "";
  }

  return String(value);
}
