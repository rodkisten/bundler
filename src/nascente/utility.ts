/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import type { AttemptResult, Awaitable } from "./types";

/***************************************************************************************************
 * Assertions and result helpers
 **************************************************************************************************/

/**
 * Asserts that a condition is truthy and narrows it for TypeScript.
 *
 * @remarks
 * **Replaces:** Manual `if (!condition) throw ...` checks.
 *
 * **Performance:** Adds no abstraction beyond one predictable branch while providing compile-time control-flow narrowing.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function assert(condition: unknown, message = 'Assertion failed'): asserts condition { if (!condition)
    throw new Error(message); }

/**
 * Asserts a program invariant and narrows the condition for TypeScript.
 *
 * @remarks
 * **Replaces:** Repeated invariant guard boilerplate.
 *
 * **Performance:** Delegates to `assert`, keeping the runtime path to one branch and one error allocation only on failure.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function invariant(condition: unknown, message = 'Invariant violation'): asserts condition { assert(condition, message); }

/**
 * Executes synchronous work and returns a typed success/error tuple.
 *
 * @remarks
 * **Replaces:** Repeated `try/catch` wrappers at call sites.
 *
 * **Performance:** The success path allocates only the returned tuple; errors remain unmodified and are not rewrapped.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function attempt<T>(operation: () => T): [
    T,
    null
] | [
    undefined,
    unknown
] { try {
    return [operation(), null];
}
catch (e) {
    return [undefined, e];
} }

/**
 * Executes asynchronous work and returns a typed success/error tuple.
 *
 * @remarks
 * **Replaces:** Repeated asynchronous `try/catch` wrappers.
 *
 * **Performance:** Uses one `try/catch` around the awaited operation and returns a discriminable tuple without constructing wrapper error objects.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function attemptAsync<T>(operation: () => Awaitable<T>): Promise<[
    T,
    null
] | [
    undefined,
    unknown
]> { try {
    return [await operation(), null];
}
catch (e) {
    return [undefined, e];
} }
