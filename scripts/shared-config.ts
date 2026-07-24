/**
 * Backward-compatible entrypoint for the canonical shared Vite configuration.
 *
 * Keep the implementation in `scripts/vite/shared-config.ts` so build scripts
 * and legacy imports cannot diverge again.
 */
export * from "./vite/shared-config";
