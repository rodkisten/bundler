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
export type JsonPrimitive = string | number | boolean | null;

/** A recursively valid JSON value. */
export type JsonValue = JsonPrimitive | JsonValue[] | { readonly [key: string]: JsonValue };

/** Typed result returned by `attempt` and `attemptAsync`. */
export type AttemptResult<T, ErrorValue = unknown> =
    | readonly [value: T, error: null]
    | readonly [value: undefined, error: ErrorValue];


/***************************************************************************************************
 * Array utilities
 **************************************************************************************************/

/**
 * Returns the element at an absolute or negative index.
 *
 * @remarks
 * **Replaces:** `Array.prototype.at()`.
 *
 * **Performance:** Performs direct index normalization and a single indexed read. This avoids callback creation and is suitable for tiny hot-path accessors, although modern engines may optimize the native method equally well.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function at<T>(a: ArrayLike<T>, i: number): T | undefined { i = i < 0 ? a.length + i : i; return i >= 0 && i < a.length ? a[i] : undefined; }

/**
 * Splits an array into fixed-size chunks.
 *
 * @remarks
 * **Replaces:** Repeated `slice()` calls written at the call site or utility-library chunk helpers.
 *
 * **Performance:** Uses one counted loop and allocates only the result array plus the chunks that must exist in the returned value.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function chunk<T>(a: readonly T[], n = 1): T[][] { n = Math.max(1, n | 0); const out: T[][] = []; for (let i = 0; i < a.length; i += n)
    out.push(a.slice(i, i + n)); return out; }
/**
 * Removes falsy values from an array while preserving order.
 *
 * @remarks
 * **Replaces:** `array.filter(Boolean)`.
 *
 * **Performance:** Uses a counted loop instead of invoking a callback for every element and grows only the output array. This can reduce callback and iterator overhead in allocation-sensitive loops.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function compact<T>(a: readonly T[]): NonNullable<T>[] { const o: NonNullable<T>[] = []; for (let i = 0; i < a.length; i++)
    if (a[i])
        o.push(a[i] as NonNullable<T>); return o; }
/**
 * Performs the `head` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `head` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function head<T>(a: readonly T[]): T | undefined { return a[0]; }
/**
 * Performs the `last` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `last` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function last<T>(a: readonly T[]): T | undefined { return a[a.length - 1]; }
/**
 * Performs the `initial` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `initial` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function initial<T>(a: readonly T[]): T[] { return a.slice(0, -1); }
/**
 * Performs the `tail` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `tail` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function tail<T>(a: readonly T[]): T[] { return a.slice(1); }
/**
 * Performs the `take` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `take` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function take<T>(a: readonly T[], n = 1): T[] { return a.slice(0, n < 0 ? 0 : n); }
/**
 * Performs the `takeRight` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `takeRight` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function takeRight<T>(a: readonly T[], n = 1): T[] { return a.slice(Math.max(0, a.length - n)); }
/**
 * Performs the `drop` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `drop` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function drop<T>(a: readonly T[], n = 1): T[] { return a.slice(Math.max(0, n)); }
/**
 * Performs the `dropRight` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `dropRight` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function dropRight<T>(a: readonly T[], n = 1): T[] { return a.slice(0, Math.max(0, a.length - n)); }
/**
 * Performs the `takeWhile` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `takeWhile` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function takeWhile<T>(a: readonly T[], p: Predicate<T>): T[] { let i = 0; while (i < a.length && p(a[i]!, i))
    i++; return a.slice(0, i); }
/**
 * Performs the `takeRightWhile` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `takeRightWhile` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function takeRightWhile<T>(a: readonly T[], p: Predicate<T>): T[] { let i = a.length - 1; while (i >= 0 && p(a[i]!, i))
    i--; return a.slice(i + 1); }
/**
 * Performs the `dropWhile` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `dropWhile` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function dropWhile<T>(a: readonly T[], p: Predicate<T>): T[] { let i = 0; while (i < a.length && p(a[i]!, i))
    i++; return a.slice(i); }
/**
 * Performs the `dropRightWhile` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `dropRightWhile` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function dropRightWhile<T>(a: readonly T[], p: Predicate<T>): T[] { let i = a.length - 1; while (i >= 0 && p(a[i]!, i))
    i--; return a.slice(0, i + 1); }

/**
 * Maps each element and flattens one array level in the same traversal.
 *
 * @remarks
 * **Replaces:** `array.map(mapper).flat()`.
 *
 * **Performance:** Fuses mapping and flattening, eliminating the intermediate mapped array and the second traversal.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function flatMap<T, R>(a: readonly T[], fn: Iteratee<T, R | readonly R[]>): R[] { const o: R[] = []; for (let i = 0; i < a.length; i++) {
    const v = fn(a[i]!, i);
    Array.isArray(v) ? o.push(...v as R[]) : o.push(v as R);
} return o; }
/**
 * Flattens one level of nested arrays.
 *
 * @remarks
 * **Replaces:** `array.flat(1)` for predictable array-only inputs.
 *
 * **Performance:** Uses a single explicit traversal and writes directly into the output. It avoids generic depth handling when only one level is required.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function flatten<T>(a: readonly (T | readonly T[])[]): T[] { const o: T[] = []; for (let i = 0; i < a.length; i++) {
    const v = a[i]!;
    Array.isArray(v) ? o.push(...v as T[]) : o.push(v as T);
} return o; }
/**
 * Flattens nested arrays of arbitrary depth without recursive calls.
 *
 * @remarks
 * **Replaces:** `array.flat(Infinity)` or recursive flatten helpers.
 *
 * **Performance:** Uses an explicit stack to avoid call-stack growth. The trade-off is stack storage proportional to pending nested values.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function flattenDeep<T>(a: readonly unknown[]): T[] { const o: T[] = []; const s = [...a].reverse(); while (s.length) {
    const v = s.pop();
    if (Array.isArray(v))
        for (let i = v.length - 1; i >= 0; i--)
            s.push(v[i]);
    else
        o.push(v as T);
} return o; }
/**
 * Performs the `flatMapDeep` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `flatMapDeep` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function flatMapDeep<T, R>(a: readonly T[], fn: Iteratee<T, unknown>): R[] { const mapped: unknown[] = []; for (let i = 0; i < a.length; i++)
    mapped.push(fn(a[i]!, i)); return flattenDeep<R>(mapped); }

/**
 * Maps values asynchronously with an explicit concurrency ceiling while preserving input order.
 *
 * @remarks
 * **Replaces:** `Promise.all(array.map(asyncMapper))` when unbounded concurrency is undesirable.
 *
 * **Performance:** Preallocates the result array and uses a worker pool, preventing large inputs from creating one eagerly scheduled promise per element. This is particularly useful on memory-constrained mobile devices.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function mapAsync<T, R>(a: readonly T[], fn: (v: T, i: number) => Awaitable<R>, concurrency = Infinity): Promise<R[]> { const o = new Array<R>(a.length); await limitAsync(a, async (v, i) => { o[i] = await fn(v, i); }, concurrency); return o; }
/**
 * Filters values with an asynchronous predicate and bounded concurrency.
 *
 * @remarks
 * **Replaces:** `Promise.all(array.map(predicate))` followed by `filter`.
 *
 * **Performance:** Reuses the bounded worker strategy from `mapAsync`, then performs a compact indexed pass over the predicate results.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function filterAsync<T>(a: readonly T[], fn: (v: T, i: number) => Awaitable<unknown>, concurrency = Infinity): Promise<T[]> { const keep = await mapAsync(a, fn, concurrency); const o: T[] = []; for (let i = 0; i < a.length; i++)
    if (keep[i])
        o.push(a[i]!); return o; }
/**
 * Performs the `flatMapAsync` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `flatMapAsync` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function flatMapAsync<T, R>(a: readonly T[], fn: (v: T, i: number) => Awaitable<R | readonly R[]>, c = Infinity): Promise<R[]> { return flatten(await mapAsync(a, fn, c)); }
/**
 * Performs the `forEachAsync` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `forEachAsync` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function forEachAsync<T>(a: readonly T[], fn: (v: T, i: number) => Awaitable<unknown>, c = Infinity): Promise<void> { await limitAsync(a, fn, c); }
/**
 * Runs asynchronous work over an array with at most the requested number of workers.
 *
 * @remarks
 * **Replaces:** Ad-hoc promise pools and unbounded `Promise.all` fan-out.
 *
 * **Performance:** Uses a shared monotonically increasing index instead of allocating a queue node per task. The worker count is bounded, reducing peak promise pressure.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function limitAsync<T>(a: readonly T[], fn: (v: T, i: number) => Awaitable<unknown>, c = Infinity): Promise<void> { c = Math.max(1, Math.min(a.length, c | 0 || a.length)); let next = 0; async function worker() { for (;;) {
    const i = next++;
    if (i >= a.length)
        return;
    await fn(a[i]!, i);
} } await Promise.all(Array.from({ length: c }, worker)); }
/**
 * Performs the `reduceAsync` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `reduceAsync` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function reduceAsync<T, R>(a: readonly T[], fn: (acc: R, v: T, i: number) => Awaitable<R>, acc: R): Promise<R> { for (let i = 0; i < a.length; i++)
    acc = await fn(acc, a[i]!, i); return acc; }
/**
 * Performs the `forEachRight` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `forEachRight` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function forEachRight<T>(a: readonly T[], fn: (v: T, i: number) => void): void { for (let i = a.length - 1; i >= 0; i--)
    fn(a[i]!, i); }

/**
 * Groups array elements by a computed property key.
 *
 * @remarks
 * **Replaces:** `Object.groupBy()` or `reduce()`-based grouping.
 *
 * **Performance:** Builds groups in one pass and uses a null-prototype dictionary so keys such as `__proto__` cannot collide with object inheritance.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function groupBy<T>(a: readonly T[], fn: (v: T, i: number) => PropertyKey): Record<PropertyKey, T[]> { const o = Object.create(null) as Record<PropertyKey, T[]>; for (let i = 0; i < a.length; i++) {
    const k = fn(a[i]!, i);
    (o[k] ??= []).push(a[i]!);
} return o; }
/**
 * Indexes array values by a computed property key, keeping the last value for duplicate keys.
 *
 * @remarks
 * **Replaces:** `Object.fromEntries(array.map(...))`.
 *
 * **Performance:** Avoids allocating `[key, value]` tuples and the intermediate mapped array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function keyBy<T>(a: readonly T[], fn: (v: T, i: number) => PropertyKey): Record<PropertyKey, T> { const o = Object.create(null) as Record<PropertyKey, T>; for (let i = 0; i < a.length; i++)
    o[fn(a[i]!, i)] = a[i]!; return o; }
/**
 * Counts iterable values by a computed property key.
 *
 * @remarks
 * **Replaces:** `reduce()`-based counters or `Object.entries` pipelines.
 *
 * **Performance:** Performs one pass and increments counters directly in a null-prototype dictionary.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function countBy<T>(a: Iterable<T>, fn: (v: T) => PropertyKey): Record<PropertyKey, number> { const o = Object.create(null) as Record<PropertyKey, number>; for (const v of a) {
    const k = fn(v);
    o[k] = (o[k] ?? 0) + 1;
} return o; }
/**
 * Performs the `partition` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `partition` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function partition<T>(a: readonly T[], p: Predicate<T>): [
    T[],
    T[]
] { const y: T[] = [], n: T[] = []; for (let i = 0; i < a.length; i++)
    (p(a[i]!, i) ? y : n).push(a[i]!); return [y, n]; }
/**
 * Returns unique values using SameValueZero semantics.
 *
 * @remarks
 * **Replaces:** `Array.from(new Set(array))`.
 *
 * **Performance:** Uses the platform `Set`, which is generally the correct asymptotic choice for primitive/reference identity deduplication. The returned array is the only unavoidable materialization.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function uniq<T>(a: readonly T[]): T[] { return [...new Set(a)]; }
/**
 * Performs the `uniqBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `uniqBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function uniqBy<T, K>(a: readonly T[], fn: (v: T) => K): T[] { const s = new Set<K>(), o: T[] = []; for (const v of a) {
    const k = fn(v);
    if (!s.has(k)) {
        s.add(k);
        o.push(v);
    }
} return o; }
/**
 * Performs the `uniqWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `uniqWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function uniqWith<T>(a: readonly T[], eq: Comparator<T>): T[] { const o: T[] = []; outer: for (const v of a) {
    for (const x of o)
        if (eq(v, x))
            continue outer;
    o.push(v);
} return o; }
/**
 * Returns values from the first array that are absent from the second array.
 *
 * @remarks
 * **Replaces:** `array.filter(value => !other.includes(value))`.
 *
 * **Performance:** Builds a `Set` once, changing repeated membership checks from linear scans to expected constant-time lookups. This is especially beneficial as the exclusion set grows.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function difference<T>(a: readonly T[], b: readonly T[]): T[] { const s = new Set(b); return a.filter(v => !s.has(v)); }
/**
 * Returns unique values shared by both arrays.
 *
 * @remarks
 * **Replaces:** Nested `includes()` checks or chained `filter()` plus deduplication.
 *
 * **Performance:** Uses `Set` membership rather than repeatedly scanning the second array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function intersection<T>(a: readonly T[], b: readonly T[]): T[] { const s = new Set(b); return uniq(a.filter(v => s.has(v))); }
/**
 * Performs the `union` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `union` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function union<T>(...xs: readonly (readonly T[])[]): T[] { const s = new Set<T>(); for (const a of xs)
    for (const v of a)
        s.add(v); return [...s]; }
/**
 * Performs the `without` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `without` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function without<T>(a: readonly T[], ...values: T[]): T[] { return difference(a, values); }
/**
 * Performs the `xor` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `xor` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function xor<T>(a: readonly T[], b: readonly T[]): T[] { return union(difference(a, b), difference(b, a)); }
/**
 * Performs the `differenceBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `differenceBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function differenceBy<T, K>(a: readonly T[], b: readonly T[], fn: (v: T) => K): T[] { const s = new Set(b.map(fn)); return a.filter(v => !s.has(fn(v))); }
/**
 * Performs the `intersectionBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `intersectionBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function intersectionBy<T, K>(a: readonly T[], b: readonly T[], fn: (v: T) => K): T[] { const s = new Set(b.map(fn)); return uniqBy(a.filter(v => s.has(fn(v))), fn); }
/**
 * Performs the `unionBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `unionBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function unionBy<T, K>(a: readonly T[], b: readonly T[], fn: (v: T) => K): T[] { return uniqBy([...a, ...b], fn); }
/**
 * Performs the `xorBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `xorBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function xorBy<T, K>(a: readonly T[], b: readonly T[], fn: (v: T) => K): T[] { return unionBy(differenceBy(a, b, fn), differenceBy(b, a, fn), fn); }
function withCmp<T>(a: readonly T[], b: readonly T[], eq: Comparator<T>, mode: 'diff' | 'inter'): T[] { return a.filter(v => (b.some(x => eq(v, x))) === (mode === 'inter')); }
/**
 * Performs the `differenceWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `differenceWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function differenceWith<T>(a: readonly T[], b: readonly T[], eq: Comparator<T>): T[] { return withCmp(a, b, eq, 'diff'); }
/**
 * Performs the `intersectionWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `intersectionWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function intersectionWith<T>(a: readonly T[], b: readonly T[], eq: Comparator<T>): T[] { return uniqWith(withCmp(a, b, eq, 'inter'), eq); }
/**
 * Performs the `unionWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `unionWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function unionWith<T>(a: readonly T[], b: readonly T[], eq: Comparator<T>): T[] { return uniqWith([...a, ...b], eq); }
/**
 * Performs the `xorWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `xorWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function xorWith<T>(a: readonly T[], b: readonly T[], eq: Comparator<T>): T[] { return unionWith(differenceWith(a, b, eq), differenceWith(b, a, eq), eq); }
/**
 * Performs the `isSubset` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `isSubset` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function isSubset<T>(a: readonly T[], b: readonly T[]): boolean { const s = new Set(b); for (const v of a)
    if (!s.has(v))
        return false; return true; }
/**
 * Performs the `isSubsetWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `isSubsetWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function isSubsetWith<T>(a: readonly T[], b: readonly T[], eq: Comparator<T>): boolean { return a.every(v => b.some(x => eq(v, x))); }
/**
 * Performs the `fill` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `fill` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function fill<T>(a: T[], v: T, start = 0, end = a.length): T[] { for (let i = start; i < end; i++)
    a[i] = v; return a; }
/**
 * Performs the `toFilled` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `toFilled` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function toFilled<T>(a: readonly T[], v: T, start = 0, end = a.length): T[] { return fill(a.slice(), v, start, end); }
/**
 * Removes matching values from an array in place.
 *
 * @remarks
 * **Replaces:** Repeated `splice()` calls or filter-and-copy mutation patterns.
 *
 * **Performance:** Uses read/write cursors to compact survivors in one pass, avoiding repeated tail shifting caused by `splice()`.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function pull<T>(a: T[], ...vs: T[]): T[] { const s = new Set(vs); let w = 0; for (let r = 0; r < a.length; r++)
    if (!s.has(a[r]!))
        a[w++] = a[r]!; a.length = w; return a; }
/**
 * Removes selected indexes from an array in place and returns the removed values.
 *
 * @remarks
 * **Replaces:** Repeated `splice(index, 1)` calls.
 *
 * **Performance:** Uses a set of indexes and one compaction pass, avoiding O(n) tail movement for each removed element.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function pullAt<T>(a: T[], idx: readonly number[]): T[] { const s = new Set(idx), removed: T[] = []; for (const i of idx)
    if (i >= 0 && i < a.length)
        removed.push(a[i]!); let w = 0; for (let r = 0; r < a.length; r++)
    if (!s.has(r))
        a[w++] = a[r]!; a.length = w; return removed; }
/**
 * Removes predicate-matching values from an array in place and returns them.
 *
 * @remarks
 * **Replaces:** `filter()` plus reassignment or repeated `splice()`.
 *
 * **Performance:** Compacts survivors with read/write cursors in one traversal and allocates only the removed-values result.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function remove<T>(a: T[], p: Predicate<T>): T[] { const out: T[] = []; let w = 0; for (let r = 0; r < a.length; r++) {
    const v = a[r]!;
    if (p(v, r))
        out.push(v);
    else
        a[w++] = v;
} a.length = w; return out; }
/**
 * Performs the `sample` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `sample` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function sample<T>(a: readonly T[]): T | undefined { return a.length ? a[(Math.random() * a.length) | 0] : undefined; }
/**
 * Performs the `sampleSize` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `sampleSize` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function sampleSize<T>(a: readonly T[], n = 1): T[] { return shuffle(a.slice()).slice(0, n); }
/**
 * Shuffles an array in place with the Fisher-Yates algorithm.
 *
 * @remarks
 * **Replaces:** `array.sort(() => Math.random() - 0.5)`.
 *
 * **Performance:** Runs in O(n) time, performs bounded swaps, and avoids the O(n log n) comparator traffic and statistical bias of random sorting.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j]!, a[i]!];
} return a; }
/**
 * Finds the element producing the largest numeric score.
 *
 * @remarks
 * **Replaces:** `Math.max(...array.map(selector))` followed by a lookup.
 *
 * **Performance:** Computes each score once in a single pass and avoids allocating a score array or spreading large arrays onto the call stack.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function maxBy<T>(a: readonly T[], fn: (v: T) => number): T | undefined { let best = a[0], score = best === undefined ? -Infinity : fn(best); for (let i = 1; i < a.length; i++) {
    const s = fn(a[i]!);
    if (s > score) {
        score = s;
        best = a[i];
    }
} return best; }
/**
 * Finds the element producing the smallest numeric score.
 *
 * @remarks
 * **Replaces:** `Math.min(...array.map(selector))` followed by a lookup.
 *
 * **Performance:** Delegates to the same single-pass selection strategy as `maxBy` without materializing mapped scores.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function minBy<T>(a: readonly T[], fn: (v: T) => number): T | undefined { return maxBy(a, v => -fn(v)); }
/**
 * Performs the `sortBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `sortBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function sortBy<T>(a: readonly T[], ...fns: Array<(v: T) => unknown>): T[] { return a.slice().sort((x, y) => { for (const f of fns) {
    const a = f(x), b = f(y);
    if (a < b)
        return -1;
    if (a > b)
        return 1;
} return 0; }); }
/**
 * Performs the `orderBy` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `orderBy` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function orderBy<T>(a: readonly T[], fns: Array<(v: T) => unknown>, orders: Array<'asc' | 'desc'> = []): T[] { return a.slice().sort((x, y) => { for (let i = 0; i < fns.length; i++) {
    const av = fns[i]!(x), bv = fns[i]!(y), m = orders[i] === 'desc' ? -1 : 1;
    if (av < bv)
        return -m;
    if (av > bv)
        return m;
} return 0; }); }
/**
 * Performs the `cartesianProduct` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `cartesianProduct` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function cartesianProduct<T>(...arrays: readonly (readonly T[])[]): T[][] { let o: T[][] = [[]]; for (const a of arrays) {
    const n: T[][] = [];
    for (const p of o)
        for (const v of a)
            n.push([...p, v]);
    o = n;
} return o; }
/**
 * Performs the `combinations` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `combinations` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function combinations<T>(a: readonly T[], k: number): T[][] { const o: T[][] = []; function go(s: number, p: T[]) { if (p.length === k) {
    o.push(p.slice());
    return;
} for (let i = s; i < a.length; i++) {
    p.push(a[i]!);
    go(i + 1, p);
    p.pop();
} } go(0, []); return o; }
/**
 * Performs the `windowed` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `windowed` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function windowed<T>(a: readonly T[], size: number, step = 1): T[][] { const o: T[][] = []; for (let i = 0; i + size <= a.length; i += step)
    o.push(a.slice(i, i + size)); return o; }
/**
 * Performs the `zip` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `zip` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function zip<T>(...a: readonly (readonly T[])[]): T[][] { const n = Math.max(0, ...a.map(x => x.length)), o: T[][] = []; for (let i = 0; i < n; i++)
    o.push(a.map(x => x[i] as T)); return o; }
/**
 * Performs the `unzip` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `unzip` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function unzip<T>(a: readonly (readonly T[])[]): T[][] { return zip(...a); }
/**
 * Performs the `zipWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `zipWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function zipWith<T, R>(a: readonly T[], b: readonly T[], fn: (a: T | undefined, b: T | undefined) => R): R[] { const n = Math.max(a.length, b.length), o: R[] = []; for (let i = 0; i < n; i++)
    o.push(fn(a[i], b[i])); return o; }
/**
 * Performs the `unzipWith` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `unzipWith` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function unzipWith<T, R>(a: readonly (readonly T[])[], fn: (...v: T[]) => R): R[] { return unzip(a).map(v => fn(...v)); }
/**
 * Performs the `zipObject` array operation with allocation-conscious control flow.
 *
 * @remarks
 * **Replaces:** Equivalent chained array helpers or utility-library `zipObject` implementations.
 *
 * **Performance:** Prefers explicit loops, direct writes, early exits, and `Set`/`Map` membership where those choices reduce intermediate arrays, repeated scans, or callback traffic. The exact winner depends on input size and JavaScript engine, so benchmark representative workloads.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function zipObject<K extends PropertyKey, V>(k: readonly K[], v: readonly V[]): Record<K, V> { const o = Object.create(null); for (let i = 0; i < k.length; i++)
    o[k[i]!] = v[i]; return o; }


/***************************************************************************************************
 * Object utilities
 **************************************************************************************************/

/**
 * Transforms the own enumerable string-keyed values of an object while preserving keys.
 *
 * @remarks
 * **Replaces:** `Object.fromEntries(Object.entries(object).map(...))`.
 *
 * **Performance:** Avoids allocating an entries array, one `[key, value]` tuple per property, a mapped tuple array, and a final `fromEntries` traversal.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mapValues<T extends object, R>(obj: T, fn: (v: T[keyof T], k: keyof T) => R): Record<keyof T, R> { const o = {} as Record<keyof T, R>; for (const k in obj)
    if (Object.prototype.hasOwnProperty.call(obj, k))
        o[k as keyof T] = fn(obj[k as keyof T], k as keyof T); return o; }
/**
 * Transforms the own enumerable string keys of an object while preserving values.
 *
 * @remarks
 * **Replaces:** `Object.fromEntries(Object.entries(object).map(...))`.
 *
 * **Performance:** Writes transformed keys directly to the output object and avoids tuple/intermediate-array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mapKeys<T extends object>(obj: T, fn: (v: T[keyof T], k: keyof T) => PropertyKey): Record<PropertyKey, T[keyof T]> { const o: Record<PropertyKey, T[keyof T]> = {}; for (const k in obj)
    if (Object.prototype.hasOwnProperty.call(obj, k))
        o[fn(obj[k as keyof T], k as keyof T)] = obj[k as keyof T]; return o; }

/**
 * Creates a shallow clone of arrays or objects while preserving an object prototype and enumerable symbol keys.
 *
 * @remarks
 * **Replaces:** Object spread, `Object.assign`, or generic clone helpers.
 *
 * **Performance:** Arrays use the engine-optimized `slice()` path. Objects allocate exactly one destination and copy enumerable own keys directly. Benchmark against spread for your concrete object shapes because engines optimize common spreads aggressively.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function clone<T>(v: T): T { if (Array.isArray(v))
    return v.slice() as T; if (v && typeof v === 'object') {
    const o = Object.create(Object.getPrototypeOf(v));
    for (const k of Reflect.ownKeys(v as object))
        if (Object.prototype.propertyIsEnumerable.call(v, k))
            o[k] = (v as any)[k];
    return o;
} return v; }

/**
 * Deeply clones supported JavaScript containers while preserving cycles and shared references.
 *
 * @remarks
 * **Replaces:** `JSON.parse(JSON.stringify(value))` and generic recursive deep-clone helpers.
 *
 * **Performance:** Avoids UTF-16 serialization/parsing and preserves types JSON destroys, including `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed arrays, cycles, and shared references. A `WeakMap` prevents repeated cloning of already visited objects.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function cloneDeep<T>(v: T, seen = new WeakMap<object, unknown>()): T { if (!v || typeof v !== 'object')
    return v; if (seen.has(v as object))
    return seen.get(v as object) as T; if (v instanceof Date)
    return new Date(v) as T; if (v instanceof RegExp)
    return new RegExp(v.source, v.flags) as T; if (v instanceof Map) {
    const o = new Map();
    seen.set(v, o);
    for (const [k, x] of v)
        o.set(cloneDeep(k, seen), cloneDeep(x, seen));
    return o as T;
} if (v instanceof Set) {
    const o = new Set();
    seen.set(v, o);
    for (const x of v)
        o.add(cloneDeep(x, seen));
    return o as T;
} if (ArrayBuffer.isView(v))
    return new (v.constructor as any)(v as any) as T; if (v instanceof ArrayBuffer)
    return v.slice(0) as T; const o: any = Array.isArray(v) ? [] : Object.create(Object.getPrototypeOf(v)); seen.set(v as object, o); for (const k of Reflect.ownKeys(v as object))
    o[k] = cloneDeep((v as any)[k], seen); return o; }
/**
 * Deeply clones a value unless a customizer supplies a replacement.
 *
 * @remarks
 * **Replaces:** Custom recursive clone implementations.
 *
 * **Performance:** Provides a fast customizer escape hatch before falling back to `cloneDeep`, allowing callers to short-circuit expensive traversal for known immutable or specialized values.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function cloneDeepWith<T>(v: T, custom: (v: unknown) => unknown): T { const x = custom(v); return (x === undefined ? cloneDeep(v) : x) as T; }
/**
 * Creates an object containing only selected keys.
 *
 * @remarks
 * **Replaces:** `Object.entries(object).filter(... )` plus `Object.fromEntries()`.
 *
 * **Performance:** Iterates only the requested key list instead of scanning every property and allocating entry tuples.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function pick<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> { const r = {} as Pick<T, K>; for (const k of keys)
    if (k in o)
        r[k] = o[k]; return r; }
/**
 * Creates a shallow object excluding selected keys.
 *
 * @remarks
 * **Replaces:** Object rest destructuring for dynamic key lists or entry/filter pipelines.
 *
 * **Performance:** Builds one exclusion `Set` and copies each retained own key once.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function omit<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Omit<T, K> { const s = new Set<PropertyKey>(keys), r: any = {}; for (const k of Reflect.ownKeys(o))
    if (!s.has(k))
        r[k] = (o as any)[k]; return r; }
/**
 * Performs the `pickBy` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `pickBy` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function pickBy<T extends object>(o: T, p: (v: T[keyof T], k: keyof T) => unknown): Partial<T> { const r: Partial<T> = {}; for (const k in o)
    if (Object.hasOwn(o, k) && p(o[k as keyof T], k as keyof T))
        r[k as keyof T] = o[k as keyof T]; return r; }
/**
 * Performs the `omitBy` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `omitBy` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function omitBy<T extends object>(o: T, p: (v: T[keyof T], k: keyof T) => unknown): Partial<T> { return pickBy(o, (v, k) => !p(v, k)); }
/**
 * Performs the `invert` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `invert` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function invert(o: Record<PropertyKey, PropertyKey>): Record<PropertyKey, PropertyKey> { const r: Record<PropertyKey, PropertyKey> = {}; for (const k of Reflect.ownKeys(o))
    r[o[k]!] = k; return r; }
/**
 * Performs the `sortKeys` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `sortKeys` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function sortKeys<T extends object>(o: T): Partial<T> { const r: Partial<T> = {}; for (const k of Object.keys(o).sort())
    (r as any)[k] = (o as any)[k]; return r; }
/**
 * Performs the `flattenObject` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `flattenObject` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function flattenObject(o: Record<string, unknown>, prefix = '', r: Record<string, unknown> = {}): Record<string, unknown> { for (const k in o) {
    const key = prefix ? prefix + '.' + k : k, v = o[k];
    if (isPlainObject(v))
        flattenObject(v as Record<string, unknown>, key, r);
    else
        r[key] = v;
} return r; }
/**
 * Performs the `merge` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `merge` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function merge<T extends object>(target: T, ...sources: object[]): T { for (const s of sources)
    for (const k of Reflect.ownKeys(s)) {
        const sv = (s as any)[k], tv = (target as any)[k];
        (target as any)[k] = isPlainObject(sv) && isPlainObject(tv) ? merge(tv, sv) : cloneDeep(sv);
    } return target; }
/**
 * Performs the `mergeWith` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `mergeWith` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mergeWith<T extends object>(target: T, source: object, fn: (a: unknown, b: unknown, k: PropertyKey) => unknown): T { for (const k of Reflect.ownKeys(source)) {
    const x = fn((target as any)[k], (source as any)[k], k);
    (target as any)[k] = x === undefined ? (source as any)[k] : x;
} return target; }
/**
 * Performs the `toMerged` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `toMerged` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function toMerged<T extends object>(target: T, ...s: object[]): T { return merge(cloneDeep(target), ...s); }

/***************************************************************************************************
 * Predicates and runtime type guards
 **************************************************************************************************/

/**
 * Checks whether a value satisfies the Nil predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isNil = (v: unknown): v is null | undefined => v == null;
/**
 * Checks whether a value satisfies the NotNil predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isNotNil = <T>(v: T): v is NonNullable<T> => v != null;
/**
 * Checks whether a value satisfies the Null predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isNull = (v: unknown): v is null => v === null;
/**
 * Checks whether a value satisfies the Undefined predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isUndefined = (v: unknown): v is undefined => v === undefined;
/**
 * Checks whether a value satisfies the Boolean predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
/**
 * Checks whether a value satisfies the Number predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
/**
 * Checks whether a value satisfies the String predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isString = (v: unknown): v is string => typeof v === 'string';
/**
 * Checks whether a value satisfies the Symbol predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isSymbol = (v: unknown): v is symbol => typeof v === 'symbol';
/**
 * Checks whether a value satisfies the Function predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isFunction = (v: unknown): v is Function => typeof v === 'function';
/**
 * Checks whether a value satisfies the Primitive predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isPrimitive = (v: unknown) => v == null || (typeof v !== 'object' && typeof v !== 'function');
/**
 * Checks whether a value satisfies the Date predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isDate = (v: unknown): v is Date => v instanceof Date;
/**
 * Checks whether a value satisfies the RegExp predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isRegExp = (v: unknown): v is RegExp => v instanceof RegExp;
/**
 * Checks whether a value satisfies the Map predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isMap = (v: unknown): v is Map<unknown, unknown> => v instanceof Map;
/**
 * Checks whether a value satisfies the Set predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isSet = (v: unknown): v is Set<unknown> => v instanceof Set;
/**
 * Checks whether a value satisfies the WeakMap predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isWeakMap = (v: unknown): v is WeakMap<object, unknown> => v instanceof WeakMap;
/**
 * Checks whether a value satisfies the WeakSet predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isWeakSet = (v: unknown): v is WeakSet<object> => v instanceof WeakSet;
/**
 * Checks whether a value satisfies the Promise predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isPromise = (v: any): v is PromiseLike<unknown> => !!v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function';
/**
 * Checks whether a value satisfies the Iterable predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isIterable = (v: any): v is Iterable<unknown> => v != null && typeof v[Symbol.iterator] === 'function';
/**
 * Checks whether a value satisfies the ArrayBuffer predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isArrayBuffer = (v: unknown): v is ArrayBuffer => v instanceof ArrayBuffer;
/**
 * Checks whether a value satisfies the TypedArray predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isTypedArray = (v: unknown): v is ArrayBufferView => ArrayBuffer.isView(v) && !(v instanceof DataView);
/**
 * Checks whether a value satisfies the Error predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isError = (v: unknown): v is Error => v instanceof Error;
/**
 * Checks whether a value satisfies the PlainObject predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isPlainObject = (v: unknown): v is Record<PropertyKey, unknown> => { if (v === null || typeof v !== 'object')
    return false; const p = Object.getPrototypeOf(v); return p === null || p === Object.prototype; };
/**
 * Checks whether a value satisfies the EmptyObject predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isEmptyObject = (v: unknown) => isPlainObject(v) && Reflect.ownKeys(v).length === 0;
/**
 * Checks whether a value satisfies the Length predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isLength = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
/**
 * Checks whether a value satisfies the Browser predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
/**
 * Checks whether a value satisfies the Node predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isNode = (): boolean => {
    const runtime = globalThis as typeof globalThis & { process?: { versions?: { node?: string } } };
    return typeof runtime.process?.versions?.node === 'string';
};
/**
 * Checks whether a value satisfies the Blob predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isBlob = (v: unknown): v is Blob => typeof Blob !== 'undefined' && v instanceof Blob;
/**
 * Checks whether a value satisfies the File predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isFile = (v: unknown): v is File => typeof File !== 'undefined' && v instanceof File;
/**
 * Checks whether a value satisfies the Buffer predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isBuffer = (value: unknown): boolean => {
    const runtime = globalThis as typeof globalThis & { Buffer?: { isBuffer(candidate: unknown): boolean } };
    return runtime.Buffer?.isBuffer(value) ?? false;
};
/**
 * Performs structural equality for the supported built-in shapes.
 *
 * @remarks
 * **Replaces:** `JSON.stringify(a) === JSON.stringify(b)`.
 *
 * **Performance:** Avoids serialization, exits on the first mismatch, and correctly distinguishes many values JSON cannot represent. This implementation is optimized for common arrays and plain object graphs, not every exotic built-in type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function isEqual(a: unknown, b: unknown): boolean { if (Object.is(a, b))
    return true; if (!a || !b || typeof a !== 'object' || typeof b !== 'object')
    return false; if (a instanceof Date && b instanceof Date)
    return +a === +b; if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (!isEqual(a[i], b[i]))
            return false;
    return true;
} const ak = Reflect.ownKeys(a), bk = Reflect.ownKeys(b); if (ak.length !== bk.length)
    return false; for (const k of ak)
    if (!Object.hasOwn(b, k) || !isEqual((a as any)[k], (b as any)[k]))
        return false; return true; }
/**
 * Checks whether a value satisfies the EqualWith predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function isEqualWith(a: unknown, b: unknown, fn: (a: unknown, b: unknown) => boolean | undefined): boolean { return fn(a, b) ?? isEqual(a, b); }
/**
 * Checks whether a value satisfies the JSON predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function isJSON(v: string): boolean { try {
    JSON.parse(v);
    return true;
}
catch {
    return false;
} }
/**
 * Checks whether a value satisfies the JSONValue predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function isJSONValue(v: unknown): boolean { if (v === null || ['string', 'boolean'].includes(typeof v) || isNumber(v))
    return true; if (Array.isArray(v))
    return v.every(isJSONValue); if (isPlainObject(v))
    return Object.values(v).every(isJSONValue); return false; }
/**
 * Checks whether a value satisfies the JSONArray predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isJSONArray = (v: unknown) => Array.isArray(v) && isJSONValue(v);
/**
 * Checks whether a value satisfies the JSONObject predicate.
 *
 * @remarks
 * **Replaces:** Ad-hoc runtime type checks at call sites.
 *
 * **Performance:** Uses a direct built-in or `typeof`/prototype check with no collection pipeline. Type-guard signatures narrow values for TypeScript where the runtime test can prove a concrete type.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const isJSONObject = (v: unknown) => isPlainObject(v) && isJSONValue(v);

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
export function sum(a: readonly number[]): number { let n = 0; for (let i = 0; i < a.length; i++)
    n += a[i]!; return n; }
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
export function sumBy<T>(a: readonly T[], fn: (v: T) => number): number { let n = 0; for (let i = 0; i < a.length; i++)
    n += fn(a[i]!); return n; }
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
export function median(a: readonly number[]): number { if (!a.length)
    return NaN; const x = a.slice().sort((a, b) => a - b), m = x.length >> 1; return x.length % 2 ? x[m]! : (x[m - 1]! + x[m]!) / 2; }
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
export function percentile(a: readonly number[], p: number): number { if (!a.length)
    return NaN; const x = a.slice().sort((a, b) => a - b), i = clamp(p, 0, 1) * (x.length - 1), lo = Math.floor(i), hi = Math.ceil(i), t = i - lo; return x[lo]! * (1 - t) + x[hi]! * t; }
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
export function rangeRight(...a: Parameters<typeof range>): number[] { return range(...a).reverse(); }
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

/***************************************************************************************************
 * Function utilities
 **************************************************************************************************/

/**
 * Creates or executes the `identity` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const identity = <T>(v: T) => v;
/**
 * Creates or executes the `noop` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const noop = () => { };
/**
 * Creates or executes the `asyncNoop` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const asyncNoop = async () => { };
/**
 * Wraps a function so only its first invocation executes the original function.
 *
 * @remarks
 * **Replaces:** Ad-hoc boolean guards around repeated calls.
 *
 * **Performance:** Keeps only two closure fields: an execution flag and the cached result. Subsequent calls return without invoking the original function.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function once<F extends (...a: any[]) => any>(fn: F): F { let done = false, v: any; return function (this: any, ...a: any[]) { if (!done) {
    done = true;
    v = fn.apply(this, a);
} return v; } as F; }
/**
 * Creates or executes the `before` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function before<F extends (...a: any[]) => any>(n: number, fn: F): F { let c = 0, v: any; return function (this: any, ...a: any[]) { if (++c < n)
    v = fn.apply(this, a); return v; } as F; }
/**
 * Creates or executes the `after` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function after<F extends (...a: any[]) => any>(n: number, fn: F): F { let c = 0; return function (this: any, ...a: any[]) { if (++c >= n)
    return fn.apply(this, a); } as F; }
/**
 * Creates or executes the `unary` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const unary = <F extends (a: any, ...x: any[]) => any>(fn: F) => (a: Parameters<F>[0]) => fn(a);
/**
 * Creates or executes the `ary` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const ary = <F extends (...a: any[]) => any>(fn: F, n: number) => (...a: any[]) => fn(...a.slice(0, n));
/**
 * Creates or executes the `negate` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const negate = <F extends (...a: any[]) => any>(fn: F) => (...a: Parameters<F>) => !fn(...a);
/**
 * Creates or executes the `rest` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const rest = <F extends (...a: any[]) => any>(fn: F, start = fn.length - 1) => (...a: any[]) => fn(...a.slice(0, start), a.slice(start));
/**
 * Creates or executes the `spread` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const spread = <F extends (...a: any[]) => any>(fn: F) => (a: Parameters<F>) => fn(...a);
/**
 * Creates or executes the `partial` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const partial = <F extends (...a: any[]) => any>(fn: F, ...p: any[]) => (...a: any[]) => fn(...p, ...a);
/**
 * Creates or executes the `partialRight` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const partialRight = <F extends (...a: any[]) => any>(fn: F, ...p: any[]) => (...a: any[]) => fn(...a, ...p);
/**
 * Creates or executes the `flow` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const flow = (...f: Array<(x: any) => any>) => (x: any) => f.reduce((v, fn) => fn(v), x);
/**
 * Creates or executes the `flowRight` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const flowRight = (...f: Array<(x: any) => any>) => flow(...f.reverse());
/**
 * Caches function results by a caller-defined key.
 *
 * @remarks
 * **Replaces:** Repeated recomputation of pure or stable expensive functions.
 *
 * **Performance:** Performs a single `Map` lookup per invocation after key resolution. Performance depends primarily on cache hit rate and resolver cost.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function memoize<F extends (...a: any[]) => any>(fn: F, key = (...a: Parameters<F>) => a[0]): F { const c = new Map(); return function (this: any, ...a: any[]) { const k = key(...a as Parameters<F>); if (c.has(k))
    return c.get(k); const v = fn.apply(this, a); c.set(k, v); return v; } as F; }
/**
 * Delays execution until calls stop for the configured interval.
 *
 * @remarks
 * **Replaces:** Repeated manual `setTimeout`/`clearTimeout` orchestration.
 *
 * **Performance:** Maintains one timer handle and replaces the pending timer on each call, preventing redundant executions during bursts.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function debounce<F extends (...a: any[]) => any>(fn: F, wait = 0) { let t: ReturnType<typeof setTimeout> | undefined; const f = (...a: Parameters<F>) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; f.cancel = () => clearTimeout(t); return f; }
/**
 * Limits a function to at most one execution per interval while retaining a trailing call.
 *
 * @remarks
 * **Replaces:** Manual timestamp and timer guards.
 *
 * **Performance:** Uses one timestamp and at most one pending timer, bounding callback execution during high-frequency events such as scroll and pointer movement.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function throttle<F extends (...a: any[]) => any>(fn: F, wait = 0) { let last = 0, t: ReturnType<typeof setTimeout> | undefined; return (...a: Parameters<F>) => { const now = Date.now(), left = wait - (now - last); if (left <= 0) {
    last = now;
    fn(...a);
}
else if (!t)
    t = setTimeout(() => { t = undefined; last = Date.now(); fn(...a); }, left); }; }
/**
 * Retries asynchronous work a bounded number of times with optional delay.
 *
 * @remarks
 * **Replaces:** Repeated nested `try/catch` retry code.
 *
 * **Performance:** Uses a simple iterative loop instead of recursive promise chains, keeping control flow and allocation predictable.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function retry<T>(fn: () => Awaitable<T>, times = 3, delayMs = 0): Promise<T> { let e: unknown; for (let i = 0; i < times; i++)
    try {
        return await fn();
    }
    catch (x) {
        e = x;
        if (delayMs)
            await delay(delayMs);
    } throw e; }
/**
 * Creates or executes the `curry` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function curry(fn: Function, arity = fn.length): any { const next = (a: any[]): any => a.length >= arity ? fn(...a) : (...b: any[]) => next([...a, ...b]); return next([]); }
/**
 * Creates or executes the `curryRight` function utility.
 *
 * @remarks
 * **Replaces:** Equivalent wrapper logic written repeatedly at call sites.
 *
 * **Performance:** Keeps closure state intentionally small and avoids unnecessary intermediate collections. Wrapper utilities are primarily ergonomic; benchmark them only when wrapper overhead is material to your workload.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function curryRight(fn: Function, arity = fn.length): any { return curry((...a: any[]) => fn(...a.reverse()), arity); }

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
/**
 * Resolves after a delay and supports abort cancellation.
 *
 * @remarks
 * **Replaces:** Ad-hoc timeout promises.
 *
 * **Performance:** Allocates one promise and one timer, and clears the timer immediately on abort to avoid unnecessary wakeups.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => { if (signal?.aborted)
    return reject(new AbortError()); const t = setTimeout(resolve, ms); signal?.addEventListener('abort', () => { clearTimeout(t); reject(new AbortError()); }, { once: true }); });
/**
 * Provides the `timeout` promise utility.
 *
 * @remarks
 * **Replaces:** Repeated ad-hoc promise orchestration.
 *
 * **Performance:** Keeps promise fan-out explicit and bounded where applicable. For asynchronous workloads, peak concurrency and memory pressure usually matter more than nanosecond-level synchronous overhead.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function timeout(ms: number, signal?: AbortSignal): Promise<never> { return new Promise((_, reject) => { const t = setTimeout(() => reject(new TimeoutError()), ms); signal?.addEventListener('abort', () => { clearTimeout(t); reject(new AbortError()); }, { once: true }); }); }
/**
 * Rejects when an awaitable does not settle within the requested duration.
 *
 * @remarks
 * **Replaces:** Manual timeout race wiring.
 *
 * **Performance:** Uses a direct `Promise.race` between the operation and a timeout promise.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function withTimeout<T>(p: Awaitable<T>, ms: number): Promise<T> { return Promise.race([p, timeout(ms)]); }
/**
 * Awaits an object of keyed awaitables and reconstructs the same key shape.
 *
 * @remarks
 * **Replaces:** `Object.entries` plus `Promise.all` plus `Object.fromEntries`.
 *
 * **Performance:** Separates keys and values without entry tuples and preserves symbol keys by using `Reflect.ownKeys`.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export async function allKeyed<T extends Record<PropertyKey, Awaitable<any>>>(o: T): Promise<{
    [K in keyof T]: Awaited<T[K]>;
}> { const keys = Reflect.ownKeys(o) as (keyof T)[], vals = await Promise.all(keys.map(k => o[k])); const r: any = {}; for (let i = 0; i < keys.length; i++)
    r[keys[i]] = vals[i]; return r; }
/**
 * Provides the `Semaphore` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export class Semaphore {
    private q: Array<() => void> = [];
    constructor(public permits = 1) { }
    async acquire() { if (this.permits > 0) {
        this.permits--;
        return;
    } await new Promise<void>(r => this.q.push(r)); }
    release() { const n = this.q.shift(); n ? n() : this.permits++; }
    async use<T>(fn: () => Awaitable<T>): Promise<T> { await this.acquire(); try {
        return await fn();
    }
    finally {
        this.release();
    } }
}
/**
 * Provides the `Mutex` utility.
 *
 * @remarks
 * **Replaces:** Equivalent ad-hoc helper code.
 *
 * **Performance:** Designed to keep control flow explicit and allocations visible. Benchmark representative inputs before relying on performance claims.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export class Mutex extends Semaphore {
    constructor() { super(1); }
}

/***************************************************************************************************
 * Map utilities
 **************************************************************************************************/

/**
 * Transforms the values of a `Map` into a new `Map` with the same keys.
 *
 * @remarks
 * **Replaces:** Converting a `Map` to an array, mapping it, then reconstructing a `Map`.
 *
 * **Performance:** Traverses the source once and writes directly to the destination map, avoiding entry-array materialization.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mapMap<K, V, R>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => R): Map<K, R> { const o = new Map<K, R>(); for (const [k, v] of m)
    o.set(k, fn(v, k)); return o; }
/**
 * Filters a `Map` into a new `Map`.
 *
 * @remarks
 * **Replaces:** Array conversion plus `filter` plus `new Map(...)`.
 *
 * **Performance:** Traverses entries once and writes accepted entries directly to the destination.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function filterMap<K, V>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => unknown): Map<K, V> { const o = new Map<K, V>(); for (const [k, v] of m)
    if (fn(v, k))
        o.set(k, v); return o; }
/**
 * Performs the `mapKeysMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mapKeysMap<K, V, R>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => R): Map<R, V> { const o = new Map<R, V>(); for (const [k, v] of m)
    o.set(fn(v, k), v); return o; }
/**
 * Performs the `mapValuesMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mapValuesMap<K, V, R>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => R): Map<K, R> { return mapMap(m, fn); }
/**
 * Performs the `reduceMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function reduceMap<K, V, R>(m: ReadonlyMap<K, V>, fn: (a: R, v: V, k: K) => R, a: R): R { for (const [k, v] of m)
    a = fn(a, v, k); return a; }
/**
 * Performs the `everyMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function everyMap<K, V>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => unknown): boolean { for (const [k, v] of m)
    if (!fn(v, k))
        return false; return true; }
/**
 * Performs the `someMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function someMap<K, V>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => unknown): boolean { for (const [k, v] of m)
    if (fn(v, k))
        return true; return false; }
/**
 * Performs the `findKeyMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function findKeyMap<K, V>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => unknown): K | undefined { for (const [k, v] of m)
    if (fn(v, k))
        return k; }
/**
 * Performs the `findValueMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function findValueMap<K, V>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => unknown): V | undefined { for (const [k, v] of m)
    if (fn(v, k))
        return v; }
/**
 * Performs the `hasValue` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function hasValue<K, V>(m: ReadonlyMap<K, V>, x: V): boolean { for (const v of m.values())
    if (Object.is(v, x))
        return true; return false; }
/**
 * Performs the `forEachMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function forEachMap<K, V>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => void): void { for (const [k, v] of m)
    fn(v, k); }
/**
 * Performs the `keyByMap` operation directly on a `Map`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Map` to an array before transforming it.
 *
 * **Performance:** Traverses the map directly and writes to the result without materializing an intermediate entry array.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function keyByMap<K, V, R>(m: ReadonlyMap<K, V>, fn: (v: V, k: K) => R): Map<R, V> { const o = new Map<R, V>(); for (const [k, v] of m)
    o.set(fn(v, k), v); return o; }

/***************************************************************************************************
 * Set utilities
 **************************************************************************************************/

/**
 * Transforms values from a `Set` into a new `Set`.
 *
 * @remarks
 * **Replaces:** Spreading a set to an array, mapping, then constructing a new set.
 *
 * **Performance:** Avoids the intermediate array and inserts transformed values directly into the destination set.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function mapSet<T, R>(s: ReadonlySet<T>, fn: (v: T) => R): Set<R> { const o = new Set<R>(); for (const v of s)
    o.add(fn(v)); return o; }
/**
 * Filters values from a `Set` into a new `Set`.
 *
 * @remarks
 * **Replaces:** Array conversion plus `filter` plus `new Set(...)`.
 *
 * **Performance:** Avoids array materialization and writes accepted values directly to the destination set.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function filterSet<T>(s: ReadonlySet<T>, fn: (v: T) => unknown): Set<T> { const o = new Set<T>(); for (const v of s)
    if (fn(v))
        o.add(v); return o; }
/**
 * Performs the `reduceSet` operation directly on a `Set`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Set` to an array before transforming it.
 *
 * **Performance:** Traverses the set directly and avoids intermediate array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function reduceSet<T, R>(s: ReadonlySet<T>, fn: (a: R, v: T) => R, a: R): R { for (const v of s)
    a = fn(a, v); return a; }
/**
 * Performs the `everySet` operation directly on a `Set`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Set` to an array before transforming it.
 *
 * **Performance:** Traverses the set directly and avoids intermediate array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function everySet<T>(s: ReadonlySet<T>, fn: (v: T) => unknown): boolean { for (const v of s)
    if (!fn(v))
        return false; return true; }
/**
 * Performs the `someSet` operation directly on a `Set`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Set` to an array before transforming it.
 *
 * **Performance:** Traverses the set directly and avoids intermediate array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function someSet<T>(s: ReadonlySet<T>, fn: (v: T) => unknown): boolean { for (const v of s)
    if (fn(v))
        return true; return false; }
/**
 * Performs the `findSet` operation directly on a `Set`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Set` to an array before transforming it.
 *
 * **Performance:** Traverses the set directly and avoids intermediate array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function findSet<T>(s: ReadonlySet<T>, fn: (v: T) => unknown): T | undefined { for (const v of s)
    if (fn(v))
        return v; }
/**
 * Performs the `forEachSet` operation directly on a `Set`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Set` to an array before transforming it.
 *
 * **Performance:** Traverses the set directly and avoids intermediate array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function forEachSet<T>(s: ReadonlySet<T>, fn: (v: T) => void): void { for (const v of s)
    fn(v); }
/**
 * Performs the `keyBySet` operation directly on a `Set`.
 *
 * @remarks
 * **Replaces:** Spreading or converting a `Set` to an array before transforming it.
 *
 * **Performance:** Traverses the set directly and avoids intermediate array allocation.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function keyBySet<T, K>(s: ReadonlySet<T>, fn: (v: T) => K): Map<K, T> { const o = new Map<K, T>(); for (const v of s)
    o.set(fn(v), v); return o; }
const WORDS = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g;

/***************************************************************************************************
 * String utilities
 **************************************************************************************************/

/**
 * Splits an identifier-like string into word tokens.
 *
 * @remarks
 * **Replaces:** Repeated chained regex replacements followed by split.
 *
 * **Performance:** Runs one precompiled global regular expression and allocates only the match result required by the API.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const words = (s: string) => s.match(WORDS) ?? [];
/**
 * Transforms a string using the `deburr` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const deburr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/**
 * Transforms a string using the `capitalize` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const capitalize = (s: string) => s ? upperFirst(s.toLowerCase()) : s;
/**
 * Transforms a string using the `upperFirst` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const upperFirst = (s: string) => s ? s[0]!.toUpperCase() + s.slice(1) : s;
/**
 * Transforms a string using the `lowerFirst` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const lowerFirst = (s: string) => s ? s[0]!.toLowerCase() + s.slice(1) : s;
/**
 * Transforms a string using the `camelCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const camelCase = (s: string) => { const w = words(deburr(s)); return w.map((x, i) => i ? capitalize(x) : x.toLowerCase()).join(''); };
/**
 * Transforms a string using the `pascalCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const pascalCase = (s: string) => words(deburr(s)).map(capitalize).join('');
/**
 * Transforms a string using the `kebabCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const kebabCase = (s: string) => words(deburr(s)).map(x => x.toLowerCase()).join('-');
/**
 * Transforms a string using the `snakeCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const snakeCase = (s: string) => words(deburr(s)).map(x => x.toLowerCase()).join('_');
/**
 * Transforms a string using the `constantCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const constantCase = (s: string) => snakeCase(s).toUpperCase();
/**
 * Transforms a string using the `startCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const startCase = (s: string) => words(deburr(s)).map(capitalize).join(' ');
/**
 * Transforms a string using the `lowerCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const lowerCase = (s: string) => words(deburr(s)).join(' ').toLowerCase();
/**
 * Transforms a string using the `upperCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const upperCase = (s: string) => words(deburr(s)).join(' ').toUpperCase();
/**
 * Transforms a string using the `reverseString` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const reverseString = (s: string) => Array.from(s).reverse().join('');
/**
 * Transforms a string using the `pad` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const pad = (s: string, n: number, c = ' ') => (c.repeat(Math.max(0, Math.floor((n - s.length) / 2))) + s + c.repeat(Math.max(0, Math.ceil((n - s.length) / 2)))).slice(0, n);
/**
 * Transforms a string using the `trim` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const trim = (s: string, c?: string) => c ? trimEnd(trimStart(s, c), c) : s.trim();
/**
 * Transforms a string using the `trimStart` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const trimStart = (s: string, c?: string) => c ? s.replace(new RegExp('^' + escapeRegExp(c) + '+'), '') : s.trimStart();
/**
 * Transforms a string using the `trimEnd` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const trimEnd = (s: string, c?: string) => c ? s.replace(new RegExp(escapeRegExp(c) + '+$'), '') : s.trimEnd();
/**
 * Transforms a string using the `escapeRegExp` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HTML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HTML_REVERSE: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
/**
 * Transforms a string using the `escape` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const escape = (s: string) => s.replace(/[&<>"']/g, c => HTML[c]!);
/**
 * Decodes the HTML entities emitted by `escape`.
 *
 * @remarks
 * **Replaces:** `Object.entries(entities).find(...)` for every match.
 *
 * **Performance:** Should use direct entity lookup so each replacement is expected O(1), avoiding repeated entry-array allocation and linear scans.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, entity => HTML_REVERSE[entity] ?? entity);

/***************************************************************************************************
 * Recursive key transforms
 **************************************************************************************************/

/**
 * Performs the `toCamelCaseKeys` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `toCamelCaseKeys` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function toCamelCaseKeys<T>(v: T): T { return transformKeys(v, camelCase); }
/**
 * Performs the `toSnakeCaseKeys` object transformation.
 *
 * @remarks
 * **Replaces:** Object.entries()/Object.fromEntries() pipelines or generic utility-library `toSnakeCaseKeys` helpers.
 *
 * **Performance:** Prefers direct own-key traversal and direct destination writes to avoid entry tuples and intermediate arrays. Operations that must preserve symbols use `Reflect.ownKeys`, trading some raw speed for correct key coverage.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export function toSnakeCaseKeys<T>(v: T): T { return transformKeys(v, snakeCase); }
function transformKeys(v: any, fn: (s: string) => string): any { if (Array.isArray(v))
    return v.map(x => transformKeys(x, fn)); if (isPlainObject(v)) {
    const o: any = {};
    for (const k in v)
        o[fn(k)] = transformKeys(v[k], fn);
    return o;
} return v; }

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
export function attempt<T>(fn: () => T): [
    T,
    null
] | [
    undefined,
    unknown
] { try {
    return [fn(), null];
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
export async function attemptAsync<T>(fn: () => Awaitable<T>): Promise<[
    T,
    null
] | [
    undefined,
    unknown
]> { try {
    return [await fn(), null];
}
catch (e) {
    return [undefined, e];
} }
