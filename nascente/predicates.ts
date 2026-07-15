/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import type { JsonValue, UnknownCallable } from "./types";

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
export const isNil = (value: unknown): value is null | undefined => value == null;

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
export const isNotNil = <T>(value: T): value is NonNullable<T> => value != null;

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
export const isNull = (value: unknown): value is null => value === null;

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
export const isUndefined = (value: unknown): value is undefined => value === undefined;

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
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

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
export const isNumber = (value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value);

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
export const isString = (value: unknown): value is string => typeof value === 'string';

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
export const isSymbol = (value: unknown): value is symbol => typeof value === 'symbol';

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
export const isFunction = (value: unknown): value is UnknownCallable => typeof value === 'function';

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
export const isPrimitive = (value: unknown) => value == null || (typeof value !== 'object' && typeof value !== 'function');

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
export const isDate = (value: unknown): value is Date => value instanceof Date;

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
export const isRegExp = (value: unknown): value is RegExp => value instanceof RegExp;

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
export const isMap = (value: unknown): value is Map<unknown, unknown> => value instanceof Map;

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
export const isSet = (value: unknown): value is Set<unknown> => value instanceof Set;

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
export const isWeakMap = (value: unknown): value is WeakMap<object, unknown> => value instanceof WeakMap;

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
export const isWeakSet = (value: unknown): value is WeakSet<object> => value instanceof WeakSet;

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
export const isPromise = (value: unknown): value is PromiseLike<unknown> => value !== null && (typeof value === 'object' || typeof value === 'function') && typeof (value as { then?: unknown }).then === 'function';

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
export const isIterable = (value: unknown): value is Iterable<unknown> => value !== null && value !== undefined && typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';

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
export const isArrayBuffer = (value: unknown): value is ArrayBuffer => value instanceof ArrayBuffer;

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
export const isTypedArray = (value: unknown): value is ArrayBufferView => ArrayBuffer.isView(value) && !(value instanceof DataView);

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
export const isError = (value: unknown): value is Error => value instanceof Error;

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
export const isPlainObject = (value: unknown): value is Record<PropertyKey, unknown> => { if (value === null || typeof value !== 'object')
    return false; const p = Object.getPrototypeOf(value); return p === null || p === Object.prototype; };

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
export const isEmptyObject = (value: unknown) => isPlainObject(value) && Reflect.ownKeys(value).length === 0;

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
export const isLength = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

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
export const isBlob = (value: unknown): value is Blob => typeof Blob !== 'undefined' && value instanceof Blob;

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
export const isFile = (value: unknown): value is File => typeof File !== 'undefined' && value instanceof File;

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
export function isEqual(left: unknown, right: unknown): boolean { if (Object.is(left, right))
    return true; if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false; if (left instanceof Date && right instanceof Date)
    return +left === +right; if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length)
        return false;
    for (let i = 0; i < left.length; i++)
        if (!isEqual(left[i], right[i]))
            return false;
    return true;
} const ak = Reflect.ownKeys(left), bk = Reflect.ownKeys(right); if (ak.length !== bk.length)
    return false; for (const k of ak)
    if (!Object.hasOwn(right, k) || !isEqual((left as any)[k], (right as any)[k]))
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
export function isEqualWith(left: unknown, right: unknown, customizer: (left: unknown, right: unknown) => boolean | undefined): boolean { return customizer(left, right) ?? isEqual(left, right); }

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
export function isJSON(value: string): boolean { try {
    JSON.parse(value);
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
export function isJSONValue(value: unknown): boolean { if (value === null || ['string', 'boolean'].includes(typeof value) || isNumber(value))
    return true; if (Array.isArray(value))
    return value.every(isJSONValue); if (isPlainObject(value))
    return Object.values(value).every(isJSONValue); return false; }

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
export const isJSONArray = (value: unknown) => Array.isArray(value) && isJSONValue(value);

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
export const isJSONObject = (value: unknown) => isPlainObject(value) && isJSONValue(value);
