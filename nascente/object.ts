/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import { isPlainObject } from "./predicates";
import { camelCase, snakeCase } from "./string";

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
export function mapValues<T extends object, R>(object: T, iteratee: (v: T[keyof T], k: keyof T) => R): Record<keyof T, R> { const o = {} as Record<keyof T, R>; for (const k in object)
    if (Object.prototype.hasOwnProperty.call(object, k))
        o[k as keyof T] = iteratee(object[k as keyof T], k as keyof T); return o; }

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
export function mapKeys<T extends object>(object: T, keySelector: (v: T[keyof T], k: keyof T) => PropertyKey): Record<PropertyKey, T[keyof T]> { const o: Record<PropertyKey, T[keyof T]> = {}; for (const k in object)
    if (Object.prototype.hasOwnProperty.call(object, k))
        o[keySelector(object[k as keyof T], k as keyof T)] = object[k as keyof T]; return o; }

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
export function clone<T>(value: T): T { if (Array.isArray(value))
    return value.slice() as T; if (value && typeof value === 'object') {
    const o = Object.create(Object.getPrototypeOf(value));
    for (const k of Reflect.ownKeys(value as object))
        if (Object.prototype.propertyIsEnumerable.call(value, k))
            o[k] = (value as any)[k];
    return o;
} return value; }

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
export function cloneDeep<T>(value: T, seen = new WeakMap<object, unknown>()): T { if (!value || typeof value !== 'object')
    return value; if (seen.has(value as object))
    return seen.get(value as object) as T; if (value instanceof Date)
    return new Date(value) as T; if (value instanceof RegExp)
    return new RegExp(value.source, value.flags) as T; if (value instanceof Map) {
    const o = new Map();
    seen.set(value, o);
    for (const [k, x] of value)
        o.set(cloneDeep(k, seen), cloneDeep(x, seen));
    return o as T;
} if (value instanceof Set) {
    const o = new Set();
    seen.set(value, o);
    for (const x of value)
        o.add(cloneDeep(x, seen));
    return o as T;
} if (ArrayBuffer.isView(value))
    return new (value.constructor as any)(value as any) as T; if (value instanceof ArrayBuffer)
    return value.slice(0) as T; const o: any = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value)); seen.set(value as object, o); for (const k of Reflect.ownKeys(value as object))
    o[k] = cloneDeep((value as any)[k], seen); return o; }

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
export function cloneDeepWith<T>(value: T, customizer: (value: unknown) => unknown): T { const x = customizer(value); return (x === undefined ? cloneDeep(value) : x) as T; }

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
export function pick<T extends object, K extends keyof T>(object: T, keys: readonly K[]): Pick<T, K> { const r = {} as Pick<T, K>; for (const k of keys)
    if (k in object)
        r[k] = object[k]; return r; }

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
export function omit<T extends object, K extends keyof T>(object: T, keys: readonly K[]): Omit<T, K> {
    const excludedKeys = new Set<PropertyKey>(keys);
    const result: Record<PropertyKey, unknown> = {};
    const source = object as T & Record<PropertyKey, unknown>;
    for (const key of Reflect.ownKeys(object)) {
        if (!excludedKeys.has(key)) result[key] = source[key];
    }
    return result as Omit<T, K>;
}

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
export function pickBy<T extends object>(object: T, predicate: (v: T[keyof T], k: keyof T) => unknown): Partial<T> { const r: Partial<T> = {}; for (const k in object)
    if (Object.hasOwn(object, k) && predicate(object[k as keyof T], k as keyof T))
        r[k as keyof T] = object[k as keyof T]; return r; }

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
export function omitBy<T extends object>(object: T, predicate: (v: T[keyof T], k: keyof T) => unknown): Partial<T> { return pickBy(object, (v, k) => !predicate(v, k)); }

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
export function invert(object: Record<PropertyKey, PropertyKey>): Record<PropertyKey, PropertyKey> { const r: Record<PropertyKey, PropertyKey> = {}; for (const k of Reflect.ownKeys(object))
    r[object[k]!] = k; return r; }

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
export function sortKeys<T extends object>(object: T): Partial<T> { const r: Partial<T> = {}; for (const k of Object.keys(object).sort())
    (r as any)[k] = (object as any)[k]; return r; }

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
export function flattenObject(object: Record<string, unknown>, prefix = '', result: Record<string, unknown> = {}): Record<string, unknown> { for (const k in object) {
    const key = prefix ? prefix + '.' + k : k, v = object[k];
    if (isPlainObject(v))
        flattenObject(v as Record<string, unknown>, key, result);
    else
        result[key] = v;
} return result; }

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
export function mergeWith<T extends object>(target: T, source: object, customizer: (a: unknown, b: unknown, k: PropertyKey) => unknown): T { for (const k of Reflect.ownKeys(source)) {
    const x = customizer((target as any)[k], (source as any)[k], k);
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
export function toMerged<T extends object>(target: T, ...sources: object[]): T { return merge(cloneDeep(target), ...sources); }

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
export function toCamelCaseKeys<T>(value: T): T { return transformKeys(value, camelCase); }

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
export function toSnakeCaseKeys<T>(value: T): T { return transformKeys(value, snakeCase); }

function transformKeys(v: any, fn: (s: string) => string): any { if (Array.isArray(v))
    return v.map(x => transformKeys(x, fn)); if (isPlainObject(v)) {
    const o: any = {};
    for (const k in v)
        o[fn(k)] = transformKeys(v[k], fn);
    return o;
} return v; }
