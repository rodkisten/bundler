const LITERAL_DATA_ATTRIBUTE_PREFIX =
  "__fabrica_literal_data__";

/**
 * Normalizes a Fábrica data binding name to the DOM attribute it owns.
 *
 * @remarks
 * `:panelState` and `:data-panel-state` both resolve to
 * `data-panel-state`. Literal names encoded by `:"name"` preserve their
 * spelling instead of running through camelCase normalization.
 */
export function toDataAttributeName(name: string): string {
  const decodedName = decodeLiteralDataAttributeName(name);
  const withoutPrefix = decodedName.value.replace(/^data-?/, "");
  const normalized = decodedName.literal
    ? withoutPrefix
    : toDataAttributeKebabCase(withoutPrefix);
  return `data-${normalized}`;
}

/** Encodes quoted data names into an HTML-parser-safe attribute name. */
export function encodeLiteralDataAttributeName(name: string): string {
  const encoded = Array.from(
    name,
    (char) =>
      char
        .codePointAt(0)!
        .toString(16)
        .padStart(6, "0"),
  ).join("");
  return `:${LITERAL_DATA_ATTRIBUTE_PREFIX}${encoded}`;
}

/**
 * Converts JavaScript-style data keys to the kebab-case spelling used in DOM.
 */
export function toDataAttributeKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function decodeLiteralDataAttributeName(
  name: string,
): { literal: boolean; value: string } {
  const unquoted = readQuotedDataAttributeName(name);
  if (unquoted != null) {
    return { literal: true, value: unquoted };
  }

  if (!name.startsWith(LITERAL_DATA_ATTRIBUTE_PREFIX)) {
    return { literal: false, value: name };
  }

  const encoded = name.slice(LITERAL_DATA_ATTRIBUTE_PREFIX.length);
  if (
    !encoded ||
    encoded.length % 6 !== 0 ||
    /[^0-9a-f]/i.test(encoded)
  ) {
    return { literal: true, value: encoded };
  }

  let value = "";
  for (let index = 0; index < encoded.length; index += 6) {
    value += String.fromCodePoint(
      Number.parseInt(encoded.slice(index, index + 6), 16),
    );
  }

  return { literal: true, value };
}

function readQuotedDataAttributeName(name: string): string | null {
  if (!name.startsWith('"') || !name.endsWith('"')) return null;
  return name.slice(1, -1);
}
