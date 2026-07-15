/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */

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
export function mapSet<T, R>(set: ReadonlySet<T>, iteratee: (v: T) => R): Set<R> { const o = new Set<R>(); for (const v of set)
    o.add(iteratee(v)); return o; }

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
export function filterSet<T>(set: ReadonlySet<T>, predicate: (v: T) => boolean): Set<T> { const o = new Set<T>(); for (const v of set)
    if (predicate(v))
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
export function reduceSet<T, R>(set: ReadonlySet<T>, reducer: (initialValue: R, v: T) => R, initialValue: R): R { for (const v of set)
    initialValue = reducer(initialValue, v); return initialValue; }

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
export function everySet<T>(set: ReadonlySet<T>, predicate: (v: T) => boolean): boolean { for (const v of set)
    if (!predicate(v))
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
export function someSet<T>(set: ReadonlySet<T>, predicate: (v: T) => boolean): boolean { for (const v of set)
    if (predicate(v))
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
export function findSet<T>(set: ReadonlySet<T>, predicate: (v: T) => boolean): T | undefined { for (const v of set)
    if (predicate(v))
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
export function forEachSet<T>(set: ReadonlySet<T>, iteratee: (v: T) => void): void { for (const v of set)
    iteratee(v); }

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
export function keyBySet<T, K>(set: ReadonlySet<T>, keySelector: (v: T) => K): Map<K, T> { const o = new Map<K, T>(); for (const v of set)
    o.set(keySelector(v), v); return o; }
