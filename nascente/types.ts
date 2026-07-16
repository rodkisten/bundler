/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */

/**
 * Nascente is a zero-dependency, allocation-conscious utility toolkit optimized for hot paths.
 *
 * @remarks
 * Performance strategy: plain indexed loops for dense arrays, single-pass transforms, lazy allocation,
 * `Set`/`Map` membership where asymptotically useful, and no iterator/intermediate-array pipelines in hot paths.
 * Safari/WebKit benefits especially from predictable monomorphic loops and fewer short-lived allocations.
 * Always benchmark with your real data: native engines evolve and tiny inputs may favor built-ins.
 *
 * @packageDocumentation
 */

/***************************************************************************************************
 * Core semantic types
 **************************************************************************************************/

/**
 * Provides the `Iteratee` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export type Iteratee<T, Result> = (value: T, index: number) => Result;

/** Semantic alias for selectors that derive a stable key from a value. */
export type KeySelector<T, Key extends PropertyKey = PropertyKey> = (value: T, index: number) => Key;

/** Semantic alias for selectors used by `*By` utilities. */
export type ValueSelector<T, Selected> = (value: T, index: number) => Selected;


/** Runtime-callable value with unknown arguments and result. */
export type UnknownCallable = (...arguments_: unknown[]) => unknown;

/** An asynchronous or synchronous iteratee accepted by concurrency-aware utilities. */
export type AsyncIteratee<T, Result> = (value: T, index: number) => Awaitable<Result>;

/**
 * Provides the `Predicate` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export type Predicate<T> = (value: T, index: number) => boolean;

/** Predicate whose decision may be produced synchronously or asynchronously. */
export type AsyncPredicate<T> = (value: T, index: number) => Awaitable<boolean>;

/**
 * Provides the `Comparator` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export type Comparator<T> = (left: T, right: T) => boolean;

/** Three-way ordering comparator compatible with `Array.prototype.sort`. */
export type OrderingComparator<T> = (left: T, right: T) => number;

/** Direction used by multi-key ordering operations. */
export type SortDirection = "asc" | "desc";

/**
 * Provides the `Awaitable` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export type Awaitable<T> = T | PromiseLike<T>;

/** A JSON primitive supported without structural traversal. */
export type Falsy = false | 0 | 0n | "" | null | undefined;

/** Removes JavaScript falsy members from a union. */
export type Truthy<Value> = Value extends Falsy ? never : Value;

export type JsonPrimitive = string | number | boolean | null;

/** A recursively valid JSON value. */
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };



/** Recursively models a unary curried function while preserving argument and result types. */
export type Curried<Arguments extends readonly unknown[], Result> =
    Arguments extends readonly [infer FirstArgument, ...infer RemainingArguments]
        ? (argument: FirstArgument) => Curried<RemainingArguments, Result>
        : Result;

/** Values that can be compared directly by Nascente ordering utilities. */
export type Orderable = string | number | bigint | boolean | Date;

/** Typed result returned by `attempt` and `attemptAsync`. */
export type AttemptResult<T, ErrorValue = unknown> =
    | readonly [value: T, error: null]
    | readonly [value: undefined, error: ErrorValue];
