/**
 * Converts attribute-like values into the text representation expected by the
 * DOM renderer. Cipó artifacts are intentionally recognized structurally so
 * Fábrica does not need a runtime import from Cipó for class/style serialization.
 */
export function stringifyAttributeValue(
  name: string,
  value: unknown,
): string {
  if (value == null || value === false) return "";

  if ((name === "class" || name === "className") && Array.isArray(value)) {
    return value
      .map((item) => stringifyAttributeValue(name, item))
      .filter(Boolean)
      .join(" ");
  }

  if (name === "style" && value && typeof value === "object") {
    const styleLike = value as {
      cssText?: unknown;
      compiledCss?: unknown;
      value?: unknown;
    };

    if (typeof styleLike.cssText === "string") return styleLike.cssText;
    if (typeof styleLike.compiledCss === "string") {
      return styleLike.compiledCss;
    }
    if (typeof styleLike.value === "string") return styleLike.value;
  }

  if (
    (name === "class" || name === "className") &&
    value &&
    typeof value === "object"
  ) {
    const classLike = value as {
      className?: unknown;
      classes?: unknown;
      value?: unknown;
    };

    if (typeof classLike.className === "string") return classLike.className;
    if (typeof classLike.classes === "string") return classLike.classes;
    if (typeof classLike.value === "string") return classLike.value;
  }

  return String(value);
}
