import path from "node:path";
import process from "node:process";

export const DIST_DIR = path.resolve("dist");
export const DEFAULT_ENTRYPOINT = "src/index.ts";
export const DEFAULT_GLOBAL_NAME = "RodK";

/**
 * Reads an environment variable with a safe default.
 *
 * @param name - Environment variable name.
 * @param fallback - Value used when the variable is empty.
 * @returns The configured value.
 *
 * @example
 * ```ts
 * readEnv("BUILD_ENTRYPOINT", "src/index.ts");
 * // "src/index.ts"
 * ```
 */
export function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

/**
 * Reads a boolean-like environment variable.
 *
 * @param name - Environment variable name.
 * @param fallback - Value used when the variable is not set.
 * @returns A normalized boolean value.
 *
 * @example
 * ```ts
 * readBooleanEnv("MINIFY", true);
 * // true
 * ```
 */
export function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  return value === "1" || value === "true" || value === "yes" || value === "on";
}
