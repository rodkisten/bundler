/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */

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
export function mapMap<K, V, R>(map: ReadonlyMap<K, V>, iteratee: (v: V, k: K) => R): Map<K, R> { const o = new Map<K, R>(); for (const [k, v] of map)
    o.set(k, iteratee(v, k)); return o; }

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
export function filterMap<K, V>(map: ReadonlyMap<K, V>, predicate: (v: V, k: K) => boolean): Map<K, V> { const o = new Map<K, V>(); for (const [k, v] of map)
    if (predicate(v, k))
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
export function mapKeysMap<K, V, R>(map: ReadonlyMap<K, V>, keySelector: (v: V, k: K) => R): Map<R, V> { const o = new Map<R, V>(); for (const [k, v] of map)
    o.set(keySelector(v, k), v); return o; }

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
export function mapValuesMap<K, V, R>(map: ReadonlyMap<K, V>, iteratee: (v: V, k: K) => R): Map<K, R> { return mapMap(map, iteratee); }

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
export function reduceMap<K, V, R>(map: ReadonlyMap<K, V>, reducer: (initialValue: R, v: V, k: K) => R, initialValue: R): R { for (const [k, v] of map)
    initialValue = reducer(initialValue, v, k); return initialValue; }

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
export function everyMap<K, V>(map: ReadonlyMap<K, V>, predicate: (v: V, k: K) => boolean): boolean { for (const [k, v] of map)
    if (!predicate(v, k))
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
export function someMap<K, V>(map: ReadonlyMap<K, V>, predicate: (v: V, k: K) => boolean): boolean { for (const [k, v] of map)
    if (predicate(v, k))
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
export function findKeyMap<K, V>(map: ReadonlyMap<K, V>, predicate: (v: V, k: K) => boolean): K | undefined { for (const [k, v] of map)
    if (predicate(v, k))
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
export function findValueMap<K, V>(map: ReadonlyMap<K, V>, predicate: (v: V, k: K) => boolean): V | undefined { for (const [k, v] of map)
    if (predicate(v, k))
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
export function hasValue<K, V>(map: ReadonlyMap<K, V>, value: V): boolean { for (const v of map.values())
    if (Object.is(v, value))
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
export function forEachMap<K, V>(map: ReadonlyMap<K, V>, iteratee: (v: V, k: K) => void): void { for (const [k, v] of map)
    iteratee(v, k); }

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
export function keyByMap<K, V, R>(map: ReadonlyMap<K, V>, keySelector: (v: V, k: K) => R): Map<R, V> { const o = new Map<R, V>(); for (const [k, v] of map)
    o.set(keySelector(v, k), v); return o; }
