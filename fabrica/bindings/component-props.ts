import { toDataAttributeName } from "./special.js";

/** Normalizes static placeholder attributes into component prop names. */
export function normalizeStaticComponentPropName(name: string): string {
  if (name === "classname") return "className";
  if (name === "htmlfor") return "htmlFor";
  if (name === "tabindex") return "tabIndex";
  if (name === "readonly") return "readOnly";
  if (name.startsWith(":")) return toDataAttributeName(name.slice(1));
  return name;
}

/** Normalizes dynamic template syntax into the component prop vocabulary. */
export function normalizeComponentPropName(name: string): string {
  if (name.startsWith("@")) {
    return eventAttributeToPropName(name.slice(1));
  }
  if (name.startsWith(".")) return name.slice(1);
  if (name.startsWith("?")) return name.slice(1);
  if (name === ":data") return name;
  if (name.startsWith(":")) return toDataAttributeName(name.slice(1));
  return normalizeStaticComponentPropName(name);
}

/** Converts `@click.modifier` syntax to a React-like component callback prop. */
export function eventAttributeToPropName(rawName: string): string {
  const dotIndex = rawName.indexOf(".");
  const eventName = dotIndex < 0 ? rawName : rawName.slice(0, dotIndex);
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
}

/** Expands Fábrica's `:data` object shorthand into concrete data attributes. */
export function mergeComponentDataProps(
  target: Record<string, unknown>,
  value: unknown,
  resolve: (value: unknown) => unknown = identity,
): void {
  const resolved = resolve(value);
  if (!resolved || typeof resolved !== "object") return;

  const source = resolved as Record<string, unknown>;
  for (const key in source) {
    const literal = key.startsWith(":");
    const rawName = literal ? `"${key.slice(1)}"` : key;
    target[toDataAttributeName(rawName)] = resolve(source[key]);
  }
}

/** Merges object spread props using the canonical component name normalizer. */
export function mergeComponentSpreadProps(
  target: Record<string, unknown>,
  value: unknown,
  resolve: (value: unknown) => unknown = identity,
): void {
  const resolved = resolve(value);
  if (!resolved || typeof resolved !== "object") return;

  for (const [name, item] of Object.entries(
    resolved as Record<string, unknown>,
  )) {
    target[normalizeComponentPropName(name)] = resolve(item);
  }
}

function identity(value: unknown): unknown {
  return value;
}
