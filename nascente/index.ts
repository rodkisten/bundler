/**
 * Nascente is a zero-dependency, allocation-conscious utility toolkit optimized for hot paths.
 *
 * @remarks
 * The public API is intentionally flat. Category modules exist only to keep the implementation maintainable
 * and tree-shakeable; consumers can import every public utility from this barrel.
 *
 * @packageDocumentation
 */

export * from "./types";
export * from "./array";
export * from "./function";
export * from "./map";
export * from "./math";
export * from "./object";
export * from "./predicates";
export * from "./promise";
export * from "./set";
export * from "./string";
export * from "./utility";
export * from "./errors";
