/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */

/***************************************************************************************************
 * Errors, promises, and concurrency
 **************************************************************************************************/

/**
 * Provides the `AbortError` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export class AbortError extends Error {
    name = 'AbortError';
    constructor(message = 'Operation aborted') { super(message); }
}

/**
 * Provides the `TimeoutError` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export class TimeoutError extends Error {
    name = 'TimeoutError';
    constructor(message = 'Operation timed out') { super(message); }
}
