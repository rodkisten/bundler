/** Process-wide warning dedupe shared by independently bundled Fabrica copies. */
const WARNING_KEYS = Symbol.for("rod.fabrica.deprecation-warnings");

function getWarningKeys(): Set<string> {
  const target = globalThis as typeof globalThis & Record<PropertyKey, unknown>;
  let keys = target[WARNING_KEYS] as Set<string> | undefined;

  if (!keys) {
    keys = new Set<string>();
    Object.defineProperty(target, WARNING_KEYS, {
      configurable: true,
      enumerable: false,
      value: keys,
    });
  }

  return keys;
}

/** Emits a development migration warning once per JavaScript realm. */
export function warnDeprecated(key: string, message: string): void {
  const keys = getWarningKeys();
  if (keys.has(key)) return;
  keys.add(key);

  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(message);
  }
}

/** Test-only reset kept internal to the package. */
export function resetDeprecationWarnings(): void {
  getWarningKeys().clear();
}
