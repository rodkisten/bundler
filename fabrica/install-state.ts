import type { RuntimeConfig } from "./types.js";

/** Stable defaults reapplied for every global installation. */
export const DEFAULT_RUNTIME_CONFIG: Readonly<RuntimeConfig> = Object.freeze({
  exposeDollar: false,
  exposeDollarEl: true,
  dollarAlias: "$el",
  forceAlias: false,
  createWhenSelectorMisses: true,
});

/**
 * Runtime configuration consumed by legacy global helpers such as `$()`.
 *
 * The object identity stays stable for live imports, but every `install()` call
 * resets it to defaults before applying options so settings from an earlier
 * installation cannot leak into a later one.
 */
export const config: RuntimeConfig = { ...DEFAULT_RUNTIME_CONFIG };

export function configureRuntime(options: Partial<RuntimeConfig>): void {
  Object.assign(config, DEFAULT_RUNTIME_CONFIG, options);
}
