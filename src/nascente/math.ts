/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import type { ValueSelector } from "./types";

/***************************************************************************************************
 * Math utilities
 **************************************************************************************************/

/**
 * Computes `clamp` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const clamp = (n: number, min: number, max: number) => n < min ? min : n > max ? max : n;

/**
 * Computes `inRange` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const inRange = (n: number, start: number, end = 0) => { if (start > end)
    [start, end] = [end, start]; return n >= start && n < end; };

/**
 * Sums numeric array elements.
 *
 * @remarks
 * **Replaces:** `array.reduce((total, value) => total + value, 0)`.
 *
 * **Performance:** Uses a counted loop, avoiding a callback invocation for every element and enabling a simple numeric accumulator hot path.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function sum(values: readonly number[]): number { let n = 0; for (let i = 0; i < values.length; i++)
    n += values[i]!; return n; }

/**
 * Sums numeric projections of array elements.
 *
 * @remarks
 * **Replaces:** `array.map(selector).reduce(...)`.
 *
 * **Performance:** Fuses projection and accumulation into one pass and avoids the intermediate mapped array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function sumBy<T>(array: readonly T[], valueSelector: (v: T) => number): number { let n = 0; for (let i = 0; i < array.length; i++)
    n += valueSelector(array[i]!); return n; }

/**
 * Computes `mean` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const mean = (a: readonly number[]) => a.length ? sum(a) / a.length : NaN;

/**
 * Computes `meanBy` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const meanBy = <T>(a: readonly T[], f: (v: T) => number) => a.length ? sumBy(a, f) / a.length : NaN;

/**
 * Computes the median of numeric values without mutating the input.
 *
 * @remarks
 * **Replaces:** Manual copy-sort-index pipelines.
 *
 * **Performance:** Performs exactly one defensive copy and one numeric sort. Sorting dominates complexity at O(n log n); use a selection algorithm instead for very large datasets where median is a critical hot path.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function median(values: readonly number[]): number { if (!values.length)
    return NaN; const x = values.slice().sort((values, b) => values - b), m = x.length >> 1; return x.length % 2 ? x[m]! : (x[m - 1]! + x[m]!) / 2; }

/**
 * Computes `medianBy` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const medianBy = <T>(a: readonly T[], f: (v: T) => number) => median(a.map(f));

/**
 * Computes `percentile` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function percentile(values: readonly number[], percentileValue: number): number { if (!values.length)
    return NaN; const x = values.slice().sort((values, b) => values - b), i = clamp(percentileValue, 0, 1) * (x.length - 1), lo = Math.floor(i), hi = Math.ceil(i), t = i - lo; return x[lo]! * (1 - t) + x[hi]! * t; }

/**
 * Computes `random` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const random = (min = 0, max = 1) => min + Math.random() * (max - min);

/**
 * Computes `randomInt` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const randomInt = (min: number, max: number) => Math.floor(random(min, max + 1));

/**
 * Creates a numeric range with positive or negative step support.
 *
 * @remarks
 * **Replaces:** `Array.from({ length }, (_, index) => ...)`.
 *
 * **Performance:** Avoids the source placeholder array-like object and per-element callback invocation by pushing values from a counted loop.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function range(start: number, end?: number, step = 1): number[] { if (end === undefined) {
    end = start;
    start = 0;
} const o: number[] = []; if (step > 0)
    for (let i = start; i < end; i += step)
        o.push(i);
else
    for (let i = start; i > end; i += step)
        o.push(i); return o; }

/**
 * Computes `rangeRight` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function rangeRight(...rangeArguments: Parameters<typeof range>): number[] { return range(...rangeArguments).reverse(); }

/**
 * Computes `round` for numeric data.
 *
 * @remarks
 * **Replaces:** Equivalent map/reduce pipelines or general-purpose utility helpers.
 *
 * **Performance:** Uses direct arithmetic and counted loops where possible, avoiding callback invocation and intermediate numeric arrays unless the mathematical operation inherently requires sorting or copying.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const round = (n: number, p = 0) => { const f = 10 ** p; return Math.round((n + Number.EPSILON) * f) / f; };
