/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import type { Awaitable, Comparator, Iteratee, Orderable, Predicate, SortDirection, Truthy, ValueSelector } from "./types";

/***************************************************************************************************
 * Array utilities
 **************************************************************************************************/


function copyArrayRange<Value>(array: ArrayLike<Value>, startIndex: number, endIndex: number): Value[] {
    const normalizedStart = Math.max(0, Math.min(array.length, startIndex));
    const normalizedEnd = Math.max(normalizedStart, Math.min(array.length, endIndex));
    const result = new Array<Value>(normalizedEnd - normalizedStart);
    for (let sourceIndex = normalizedStart, targetIndex = 0; sourceIndex < normalizedEnd; sourceIndex++, targetIndex++) {
        result[targetIndex] = array[sourceIndex]!;
    }
    return result;
}

/**
 * Maps a generic iterable in one traversal without first materializing it.
 *
 * @remarks
 * **Replaces:** `[...iterable].map(iteratee)` and `Array.from(iterable, iteratee)` when the source does not
 * expose a stable `length`, such as `Map#values()`, `Map#entries()`, `Set`, `Headers`, and generators.
 *
 * **Performance:** Avoids a temporary materialized source array. The result is the only collection allocated.
 * This is especially useful for DevTools registries and protocol collections that are traversed frequently.
 */
export function mapIterable<Value, Result>(iterable: Iterable<Value>, iteratee: Iteratee<Value, Result>): Result[] {
    const result: Result[] = [];
    let index = 0;
    for (const value of iterable) {
        result.push(iteratee(value, index));
        index++;
    }
    return result;
}

/** Filters a generic iterable without materializing the source first. */
export function filterIterable<Value, Selected extends Value>(
    iterable: Iterable<Value>,
    predicate: (value: Value, index: number) => value is Selected,
): Selected[];
export function filterIterable<Value>(iterable: Iterable<Value>, predicate: Predicate<Value>): Value[];
export function filterIterable<Value>(iterable: Iterable<Value>, predicate: Predicate<Value>): Value[] {
    const result: Value[] = [];
    let index = 0;
    for (const value of iterable) {
        if (predicate(value, index)) result.push(value);
        index++;
    }
    return result;
}

/**
 * Filters an iterable and stops as soon as the requested result limit is reached.
 *
 * @remarks
 * **Replaces:** `[...iterable].filter(predicate).slice(0, limit)`. This avoids materializing the source, avoids
 * collecting matches that will be discarded, and can terminate early. Autocomplete and search suggestion lists
 * benefit disproportionately because their source registries may be large while the UI only renders a small cap.
 */
export function filterTakeIterable<Value, Selected extends Value>(
    iterable: Iterable<Value>,
    predicate: (value: Value, index: number) => value is Selected,
    limit: number,
): Selected[];
export function filterTakeIterable<Value>(
    iterable: Iterable<Value>,
    predicate: Predicate<Value>,
    limit: number,
): Value[];
export function filterTakeIterable<Value>(iterable: Iterable<Value>, predicate: Predicate<Value>, limit: number): Value[] {
    const maximumResults = Math.max(0, Math.trunc(limit));
    if (maximumResults === 0) return [];
    const result: Value[] = [];
    let index = 0;
    for (const value of iterable) {
        if (predicate(value, index) && result.length < maximumResults) result.push(value);
        index++;
        if (result.length === maximumResults) break;
    }
    return result;
}

/** Returns whether any iterable value matches without allocating an intermediate array. */
export function someIterable<Value>(iterable: Iterable<Value>, predicate: Predicate<Value>): boolean {
    let index = 0;
    for (const value of iterable) {
        if (predicate(value, index)) return true;
        index++;
    }
    return false;
}

/** Finds the first matching iterable value without materializing the iterable. */
export function findIterable<Value>(iterable: Iterable<Value>, predicate: Predicate<Value>): Value | undefined {
    let index = 0;
    for (const value of iterable) {
        if (predicate(value, index)) return value;
        index++;
    }
    return undefined;
}

/** Runs an iteratee over a generic iterable without allocating an intermediate array. */
export function forEachIterable<Value>(iterable: Iterable<Value>, iteratee: Iteratee<Value, void>): void {
    let index = 0;
    for (const value of iterable) {
        iteratee(value, index);
        index++;
    }
}

/**
 * Reads a non-negative position from an iterable without materializing the full iterable.
 *
 * @remarks
 * Particularly useful for `Map#keys()` and `Set#values()` compatibility adapters where `[...keys][index]`
 * would allocate the complete key list for every lookup. Negative indexes intentionally return `undefined`;
 * use {@link at} for indexable collections that support efficient negative indexing.
 */
export function atIterable<Value>(iterable: Iterable<Value>, index: number): Value | undefined {
    if (!Number.isInteger(index) || index < 0) return undefined;
    let currentIndex = 0;
    for (const value of iterable) {
        if (currentIndex === index) return value;
        currentIndex++;
    }
    return undefined;
}

/**
 * Appends one value while cloning an array-like source into exact-size storage.
 *
 * @remarks
 * **Replaces:** `[...array, value]`. Exact-size indexed copying avoids spread iterator machinery and makes the
 * unavoidable output allocation explicit.
 */
export function appendArray<Value>(array: ArrayLike<Value>, value: Value): Value[] {
    const result = new Array<Value>(array.length + 1);
    for (let index = 0; index < array.length; index++) result[index] = array[index]!;
    result[array.length] = value;
    return result;
}

/**
 * Appends every value from an array-like source into an existing target array.
 *
 * @remarks
 * **Replaces:** `target.push(...source)` in hot paths. Large spreads can hit argument-count limits and always
 * route values through call argument expansion. An indexed append keeps memory usage predictable and works for
 * DOM array-like collections as well as arrays.
 */
export function appendArrayValues<Value>(target: Value[], source: ArrayLike<Value>): Value[] {
    const initialLength = target.length;
    target.length = initialLength + source.length;
    for (let index = 0; index < source.length; index++) target[initialLength + index] = source[index]!;
    return target;
}

type ArrayLikeValue<Source> = Source extends ArrayLike<infer Value> ? Value : never;

/**
 * Concatenates array-like sources into one pre-sized result without spread intermediates.
 *
 * @remarks
 * The variadic tuple signature preserves a union of heterogeneous element types instead of forcing every input
 * array to share the type inferred from the first argument. This keeps configuration builders and mixed value
 * lists strongly typed while still using one exact-size allocation.
 */
export function concatArrays<const Arrays extends readonly ArrayLike<unknown>[]>(
    ...arrays: Arrays
): Array<ArrayLikeValue<Arrays[number]>> {
    type Value = ArrayLikeValue<Arrays[number]>;
    let totalLength = 0;
    for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex++) totalLength += arrays[arrayIndex]!.length;
    const result = new Array<Value>(totalLength);
    let writeIndex = 0;
    for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex++) {
        const array = arrays[arrayIndex]!;
        for (let valueIndex = 0; valueIndex < array.length; valueIndex++) result[writeIndex++] = array[valueIndex] as Value;
    }
    return result;
}

/**
 * Maps iterable values directly into a joined string without allocating either a source or mapped array.
 *
 * @remarks
 * **Replaces:** `[...iterable].map(mapper).join(separator)`. This is intended for `Map`, `Set`, `Headers`,
 * `FormData`, and generator-backed serializers.
 */
export function mapJoinIterable<Value>(
    iterable: Iterable<Value>,
    mapper: (value: Value, index: number) => unknown,
    separator = ",",
): string {
    let result = "";
    let hasValue = false;
    let index = 0;
    for (const value of iterable) {
        const mappedValue = mapper(value, index++);
        if (hasValue) result += separator;
        result += mappedValue == null ? "" : String(mappedValue);
        hasValue = true;
    }
    return result;
}

/**
 * Maps an array-like value with a predictable indexed loop.
 *
 * @remarks
 * **Replaces:** `array.map(iteratee)` and `Array.from(arrayLike, iteratee)` in hot paths.
 *
 * **Performance:** Preallocates the exact output length and writes by index. This avoids callback plumbing
 * through `Array.prototype.map`, avoids iterator materialization for DOM collections, and keeps the loop shape
 * simple for JavaScriptCore/WebKit. Native `map` can still be equally fast or faster for tiny arrays.
 */
export function mapArray<T, Result>(array: ArrayLike<T>, iteratee: Iteratee<T, Result>): Result[] {
    const length = array.length;
    const result = new Array<Result>(length);
    for (let index = 0; index < length; index++) result[index] = iteratee(array[index]!, index);
    return result;
}

export function filterArray<T, Selected extends T>(array: ArrayLike<T>, predicate: (value: T, index: number) => value is Selected): Selected[];
export function filterArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): T[];
/**
 * Filters an array-like value in one indexed pass.
 *
 * @remarks
 * **Replaces:** `array.filter(predicate)` and common `Array.from(collection).filter(predicate)` pipelines.
 *
 * **Performance:** Avoids the intermediate array created when DOM collections are first converted with
 * `Array.from`, and uses direct indexed reads with a single grow-only result array.
 */
export function filterArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): T[] {
    const result: T[] = [];
    for (let index = 0; index < array.length; index++) {
        const value = array[index]!;
        if (predicate(value, index)) result.push(value);
    }
    return result;
}


/**
 * Maps and keeps only truthy mapped values in a single pass.
 *
 * @remarks
 * **Replaces:** `array.map(mapper).filter(Boolean)`.
 *
 * **Performance:** Fuses two full traversals and removes the intermediate mapped array. This is particularly
 * useful when reading optional DOM properties such as `src` and `href` in Safari/WebKit hot paths.
 */
export function compactMapArray<T, Result>(array: ArrayLike<T>, mapper: Iteratee<T, Result>): Array<Truthy<Result>> {
    const result: Array<Truthy<Result>> = [];
    for (let index = 0; index < array.length; index++) {
        const mappedValue = mapper(array[index]!, index);
        if (mappedValue) result.push(mappedValue as Truthy<Result>);
    }
    return result;
}


export function mapFilterArray<T, Result, Selected extends Result>(
    array: ArrayLike<T>,
    mapper: Iteratee<T, Result>,
    predicate: (value: Result, index: number) => value is Selected,
): Selected[];
export function mapFilterArray<T, Result>(
    array: ArrayLike<T>,
    mapper: Iteratee<T, Result>,
    predicate: Predicate<Result>,
): Result[];
/**
 * Maps an array-like source and filters the mapped values in the same pass.
 *
 * @remarks
 * **Replaces:** `array.map(mapper).filter(predicate)`.
 *
 * **Performance:** Eliminates the intermediate mapped array and touches each source element once. This is useful
 * for DOM collection extraction where the mapped property itself determines whether a value should be retained.
 */
export function mapFilterArray<T, Result>(
    array: ArrayLike<T>,
    mapper: Iteratee<T, Result>,
    predicate: Predicate<Result>,
): Result[] {
    const result: Result[] = [];
    for (let index = 0; index < array.length; index++) {
        const mappedValue = mapper(array[index]!, index);
        if (predicate(mappedValue, index)) result.push(mappedValue);
    }
    return result;
}

/**
 * Filters and maps an array-like source in a single pass.
 *
 * @remarks
 * **Replaces:** `array.filter(predicate).map(mapper)`.
 *
 * **Performance:** Avoids the intermediate filtered array and performs exactly one source traversal.
 */
export function filterMapArray<T, Selected extends T, Result>(
    array: ArrayLike<T>,
    predicate: (value: T, index: number) => value is Selected,
    mapper: Iteratee<Selected, Result>,
): Result[];
export function filterMapArray<T, Result>(
    array: ArrayLike<T>,
    predicate: Predicate<T>,
    mapper: Iteratee<T, Result>,
): Result[];
export function filterMapArray<T, Result>(
    array: ArrayLike<T>,
    predicate: Predicate<T>,
    mapper: Iteratee<T, Result>,
): Result[] {
    const result: Result[] = [];
    for (let index = 0; index < array.length; index++) {
        const value = array[index]!;
        if (predicate(value, index)) result.push(mapper(value, index));
    }
    return result;
}

/**
 * Filters and flat-maps an array-like source without allocating the filtered intermediate array.
 *
 * @remarks
 * **Replaces:** `array.filter(predicate).flatMap(mapper)`.
 */
export function filterFlatMapArray<T, Result>(
    array: ArrayLike<T>,
    predicate: Predicate<T>,
    mapper: Iteratee<T, Result | readonly Result[]>,
): Result[] {
    const result: Result[] = [];
    for (let index = 0; index < array.length; index++) {
        const value = array[index]!;
        if (!predicate(value, index)) continue;
        const mappedValue = mapper(value, index);
        if (Array.isArray(mappedValue)) {
            for (let mappedIndex = 0; mappedIndex < mappedValue.length; mappedIndex++) result.push(mappedValue[mappedIndex]!);
        } else {
            result.push(mappedValue as Result);
        }
    }
    return result;
}

/**
 * Maps values directly into a joined string without allocating a mapped string array.
 *
 * @remarks
 * **Replaces:** `array.map(mapper).join(separator)`.
 *
 * **Performance:** Performs one indexed pass and builds the final string directly. This removes the temporary
 * array of mapped strings, reducing short-lived allocations in serializers, console rendering, and DOM labels.
 */
export function mapJoinArray<T>(array: ArrayLike<T>, mapper: Iteratee<T, unknown>, separator = ","): string {
    if (array.length === 0) return "";
    const firstValue = mapper(array[0]!, 0);
    let result = firstValue == null ? "" : String(firstValue);
    for (let index = 1; index < array.length; index++) {
        const mappedValue = mapper(array[index]!, index);
        result += separator + (mappedValue == null ? "" : String(mappedValue));
    }
    return result;
}


/**
 * Filters and joins an array-like source in one traversal without allocating a filtered array.
 *
 * @remarks
 * **Replaces:** `array.filter(predicate).join(separator)`. Separators are appended only after the first retained
 * value, so the result is built directly while the source is scanned once.
 */
export function filterJoinArray<Value>(
    array: ArrayLike<Value>,
    predicate: Predicate<Value>,
    separator = ",",
): string {
    let result = "";
    let hasValue = false;
    for (let index = 0; index < array.length; index++) {
        const value = array[index]!;
        if (!predicate(value, index)) continue;
        if (hasValue) result += separator;
        result += value == null ? "" : String(value);
        hasValue = true;
    }
    return result;
}

/**
 * Maps, filters, and joins an array-like source in one traversal.
 *
 * @remarks
 * **Replaces:** `array.map(mapper).filter(predicate).join(separator)`.
 *
 * **Performance:** Avoids both intermediate arrays and appends separators only for retained values. This is
 * useful for style serializers, breadcrumb labels, and compact debug strings that run frequently in DevTools.
 */
export function mapFilterJoinArray<T, Result>(
    array: ArrayLike<T>,
    mapper: Iteratee<T, Result>,
    predicate: Predicate<Result>,
    separator = ",",
): string {
    let result = "";
    let hasValue = false;
    for (let index = 0; index < array.length; index++) {
        const mappedValue = mapper(array[index]!, index);
        if (!predicate(mappedValue, index)) continue;
        if (hasValue) result += separator;
        result += mappedValue == null ? "" : String(mappedValue);
        hasValue = true;
    }
    return result;
}

/** Finds the last matching value with a reverse indexed loop and no copied/reversed array. */
export function findLastArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): T | undefined {
    for (let index = array.length - 1; index >= 0; index--) {
        const value = array[index]!;
        if (predicate(value, index)) return value;
    }
    return undefined;
}

/**
 * Returns the first index whose value is strictly equal to the searched value.
 *
 * @remarks
 * **Replaces:** `array.indexOf(value, fromIndex)` for array-like hot paths. The implementation performs a direct
 * indexed scan and also works with DOM array-like collections without converting them first. Semantics match
 * `Array.prototype.indexOf`, including strict equality rather than SameValueZero.
 */
export function indexOfArray<Value>(array: ArrayLike<Value>, searchedValue: Value, fromIndex = 0): number {
    const length = array.length;
    let index = fromIndex < 0 ? Math.max(0, length + fromIndex) : fromIndex;
    for (; index < length; index++) if (array[index] === searchedValue) return index;
    return -1;
}

/** Reverse counterpart of {@link indexOfArray} with no copied or reversed array. */
export function lastIndexOfArray<Value>(array: ArrayLike<Value>, searchedValue: Value, fromIndex = array.length - 1): number {
    let index = fromIndex < 0 ? array.length + fromIndex : Math.min(fromIndex, array.length - 1);
    for (; index >= 0; index--) if (array[index] === searchedValue) return index;
    return -1;
}

/**
 * Removes and returns one item while shifting the remaining tail in place.
 *
 * @remarks
 * **Replaces:** `array.splice(index, 1)[0]` when only the removed value is required. Avoids allocating the
 * one-element array returned by `splice`, which matters for listener registries and frequently edited lists.
 */
export function removeAtArray<Value>(array: Value[], index: number): Value | undefined {
    const normalizedIndex = index < 0 ? array.length + index : index;
    if (normalizedIndex < 0 || normalizedIndex >= array.length) return undefined;
    const removedValue = array[normalizedIndex];
    for (let readIndex = normalizedIndex + 1; readIndex < array.length; readIndex++) {
        array[readIndex - 1] = array[readIndex]!;
    }
    array.length -= 1;
    return removedValue;
}

/**
 * Moves one array item in place with a single shift pass.
 *
 * @remarks
 * **Replaces:** the common `splice(from, 1); splice(to, 0, value)` pair. This avoids the temporary removed-item
 * array produced by the first `splice` and touches each displaced element only once.
 */
export function moveArrayItem<Value>(array: Value[], fromIndex: number, toIndex: number): Value[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= array.length || toIndex >= array.length) return array;
    const value = array[fromIndex]!;
    if (fromIndex < toIndex) {
        for (let index = fromIndex; index < toIndex; index++) array[index] = array[index + 1]!;
    } else {
        for (let index = fromIndex; index > toIndex; index--) array[index] = array[index - 1]!;
    }
    array[toIndex] = value;
    return array;
}

/**
 * Copies an array and clears the source while preserving the original iteration order.
 *
 * @remarks
 * **Replaces:** `array.splice(0)` when callers need a stable snapshot before invoking callbacks that may mutate
 * the original array. The source is cleared before the snapshot is consumed, matching the reentrancy behavior
 * of the `splice(0)` cleanup pattern.
 */
export function drainArray<Value>(array: Value[]): Value[] {
    const drained = toArray(array);
    array.length = 0;
    return drained;
}

/**
 * Discards a prefix in place without allocating the array of removed values produced by `splice`.
 */
export function trimArrayStart<Value>(array: Value[], count: number): Value[] {
    const removeCount = Math.min(array.length, Math.max(0, Math.trunc(count)));
    if (removeCount === 0) return array;
    const nextLength = array.length - removeCount;
    for (let index = 0; index < nextLength; index++) array[index] = array[index + removeCount]!;
    array.length = nextLength;
    return array;
}

/** SameValueZero membership test for array-like sources. */
export function includesArray<T>(array: ArrayLike<T>, searchedValue: T, fromIndex = 0): boolean {
    let index = fromIndex < 0 ? Math.max(0, array.length + fromIndex) : fromIndex;
    for (; index < array.length; index++) {
        const value = array[index]!;
        if (value === searchedValue || (value !== value && searchedValue !== searchedValue)) return true;
    }
    return false;
}

/** Returns the first matching value without allocating an intermediate array. */
export function findArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): T | undefined {
    for (let index = 0; index < array.length; index++) {
        const value = array[index]!;
        if (predicate(value, index)) return value;
    }
    return undefined;
}

/** Returns the index of the first matching value using a direct indexed loop. */
export function findIndexArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): number {
    for (let index = 0; index < array.length; index++) if (predicate(array[index]!, index)) return index;
    return -1;
}

/** Short-circuiting replacement for `array.some(predicate)`. */
export function someArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): boolean {
    for (let index = 0; index < array.length; index++) if (predicate(array[index]!, index)) return true;
    return false;
}

/** Short-circuiting replacement for `array.every(predicate)`. */
export function everyArray<T>(array: ArrayLike<T>, predicate: Predicate<T>): boolean {
    for (let index = 0; index < array.length; index++) if (!predicate(array[index]!, index)) return false;
    return true;
}

/** Iterates an array-like value without allocating an iterator or callback wrapper collection. */
export function forEachArray<T>(array: ArrayLike<T>, iteratee: Iteratee<T, void>): void {
    for (let index = 0; index < array.length; index++) iteratee(array[index]!, index);
}

/**
 * Converts an iterable or array-like source to an array, optionally mapping during the same traversal.
 *
 * @remarks
 * **Replaces:** `Array.from(source)` and `Array.from(source, mapper)`.
 *
 * **Performance:** Uses exact-size preallocation for array-like sources such as `NodeList`, `HTMLCollection`,
 * `DOMTokenList`, and CSS declaration lists. Generic iterables fall back to one grow-only traversal.
 */
export function toArray<T>(source: ArrayLike<T> | Iterable<T>): T[];
export function toArray<T, Result>(source: ArrayLike<T> | Iterable<T>, iteratee: (value: T, index: number) => Result): Result[];
export function toArray<T, Result>(source: ArrayLike<T> | Iterable<T>, iteratee?: (value: T, index: number) => Result): T[] | Result[] {
    if ("length" in Object(source) && typeof (source as ArrayLike<T>).length === "number") {
        const arrayLike = source as ArrayLike<T>;
        if (iteratee) return mapArray(arrayLike, iteratee);
        const result = new Array<T>(arrayLike.length);
        for (let index = 0; index < arrayLike.length; index++) result[index] = arrayLike[index]!;
        return result;
    }
    const result: Array<T | Result> = [];
    let index = 0;
    for (const value of source as Iterable<T>) result.push(iteratee ? iteratee(value, index++) : value);
    return result as T[] | Result[];
}

/** Joins array-like values without constructing an intermediate mapped array. */
export function joinArray(array: ArrayLike<unknown>, separator = ","): string {
    if (array.length === 0) return "";
    let result = array[0] == null ? "" : String(array[0]);
    for (let index = 1; index < array.length; index++) {
        const value = array[index];
        result += separator + (value == null ? "" : String(value));
    }
    return result;
}

/** Sorts an array in place while keeping mutation explicit at the call site. */
export function sortArray<T>(array: T[], comparator?: (left: T, right: T) => number): T[] {
    return comparator ? array.sort(comparator) : array.sort();
}

/** Reverses an array in place while keeping mutation explicit at the call site. */
export function reverseArray<T>(array: T[]): T[] {
    let leftIndex = 0;
    let rightIndex = array.length - 1;
    while (leftIndex < rightIndex) {
        const leftValue = array[leftIndex]!;
        array[leftIndex] = array[rightIndex]!;
        array[rightIndex] = leftValue;
        leftIndex++;
        rightIndex--;
    }
    return array;
}

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
export function at<T>(arrayLike: ArrayLike<T>, index: number): T | undefined { index = index < 0 ? arrayLike.length + index : index; return index >= 0 && index < arrayLike.length ? arrayLike[index] : undefined; }

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
export function chunk<T>(array: readonly T[], chunkSize = 1): T[][] { chunkSize = Math.max(1, chunkSize | 0); const out: T[][] = []; for (let i = 0; i < array.length; i += chunkSize)
    out.push(array.slice(i, i + chunkSize)); return out; }

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
export function compact<T>(array: readonly T[]): NonNullable<T>[] { const o: NonNullable<T>[] = []; for (let i = 0; i < array.length; i++)
    if (array[i])
        o.push(array[i] as NonNullable<T>); return o; }

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
export function head<T>(array: readonly T[]): T | undefined { return array[0]; }

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
export function last<T>(array: readonly T[]): T | undefined { return array[array.length - 1]; }

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
export function initial<T>(array: readonly T[]): T[] { return array.slice(0, -1); }

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
export function tail<T>(array: readonly T[]): T[] { return array.slice(1); }

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
export function take<T>(array: ArrayLike<T>, count = 1): T[] { return copyArrayRange(array, 0, Math.max(0, count)); }

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
export function takeRight<T>(array: ArrayLike<T>, count = 1): T[] { return copyArrayRange(array, Math.max(0, array.length - Math.max(0, count)), array.length); }

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
export function drop<T>(array: ArrayLike<T>, count = 1): T[] { return copyArrayRange(array, Math.max(0, count), array.length); }

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
export function dropRight<T>(array: ArrayLike<T>, count = 1): T[] { return copyArrayRange(array, 0, Math.max(0, array.length - Math.max(0, count))); }

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
export function takeWhile<T>(array: readonly T[], predicate: Predicate<T>): T[] { let i = 0; while (i < array.length && predicate(array[i]!, i))
    i++; return array.slice(0, i); }

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
export function takeRightWhile<T>(array: readonly T[], predicate: Predicate<T>): T[] { let i = array.length - 1; while (i >= 0 && predicate(array[i]!, i))
    i--; return array.slice(i + 1); }

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
export function dropWhile<T>(array: readonly T[], predicate: Predicate<T>): T[] { let i = 0; while (i < array.length && predicate(array[i]!, i))
    i++; return array.slice(i); }

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
export function dropRightWhile<T>(array: readonly T[], predicate: Predicate<T>): T[] { let i = array.length - 1; while (i >= 0 && predicate(array[i]!, i))
    i--; return array.slice(0, i + 1); }

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
export function flatMap<T, R>(array: readonly T[], iteratee: Iteratee<T, R | readonly R[]>): R[] { const o: R[] = []; for (let i = 0; i < array.length; i++) {
    const v = iteratee(array[i]!, i);
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
export function flatten<T>(array: readonly (T | readonly T[])[]): T[] { const o: T[] = []; for (let i = 0; i < array.length; i++) {
    const v = array[i]!;
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
export function flattenDeep<T>(array: readonly unknown[]): T[] { const o: T[] = []; const s = [...array].reverse(); while (s.length) {
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
export function flatMapDeep<T, R>(array: readonly T[], iteratee: Iteratee<T, unknown>): R[] { const mapped: unknown[] = []; for (let i = 0; i < array.length; i++)
    mapped.push(iteratee(array[i]!, i)); return flattenDeep<R>(mapped); }

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
export async function mapAsync<T, R>(array: readonly T[], iteratee: (v: T, i: number) => Awaitable<R>, concurrency = Infinity): Promise<R[]> { const o = new Array<R>(array.length); await limitAsync(array, async (v, i) => { o[i] = await iteratee(v, i); }, concurrency); return o; }

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
export async function filterAsync<T>(array: readonly T[], predicate: (value: T, index: number) => Awaitable<boolean>, concurrency = Infinity): Promise<T[]> { const keep = await mapAsync(array, predicate, concurrency); const o: T[] = []; for (let i = 0; i < array.length; i++)
    if (keep[i])
        o.push(array[i]!); return o; }

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
export async function flatMapAsync<T, R>(array: readonly T[], iteratee: (v: T, i: number) => Awaitable<R | readonly R[]>, concurrency = Infinity): Promise<R[]> { return flatten(await mapAsync(array, iteratee, concurrency)); }

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
export async function forEachAsync<T>(array: readonly T[], iteratee: (value: T, index: number) => Awaitable<unknown>, concurrency = Infinity): Promise<void> { await limitAsync(array, iteratee, concurrency); }

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
export async function limitAsync<T>(array: readonly T[], iteratee: (value: T, index: number) => Awaitable<unknown>, concurrency = Infinity): Promise<void> { concurrency = Math.max(1, Math.min(array.length, concurrency | 0 || array.length)); let next = 0; async function worker() { for (;;) {
    const i = next++;
    if (i >= array.length)
        return;
    await iteratee(array[i]!, i);
} } await Promise.all(Array.from({ length: concurrency }, worker)); }

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
export async function reduceAsync<T, R>(array: readonly T[], reducer: (initialValue: R, v: T, i: number) => Awaitable<R>, initialValue: R): Promise<R> { for (let i = 0; i < array.length; i++)
    initialValue = await reducer(initialValue, array[i]!, i); return initialValue; }

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
export function forEachRight<T>(array: readonly T[], iteratee: (v: T, i: number) => void): void { for (let i = array.length - 1; i >= 0; i--)
    iteratee(array[i]!, i); }

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
export function groupBy<T>(array: readonly T[], keySelector: (v: T, i: number) => PropertyKey): Record<PropertyKey, T[]> { const o = Object.create(null) as Record<PropertyKey, T[]>; for (let i = 0; i < array.length; i++) {
    const k = keySelector(array[i]!, i);
    (o[k] ??= []).push(array[i]!);
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
export function keyBy<T>(array: readonly T[], keySelector: (v: T, i: number) => PropertyKey): Record<PropertyKey, T> { const o = Object.create(null) as Record<PropertyKey, T>; for (let i = 0; i < array.length; i++)
    o[keySelector(array[i]!, i)] = array[i]!; return o; }

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
export function countBy<T>(iterable: Iterable<T>, keySelector: (v: T) => PropertyKey): Record<PropertyKey, number> { const o = Object.create(null) as Record<PropertyKey, number>; for (const v of iterable) {
    const k = keySelector(v);
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
export function partition<T>(array: readonly T[], predicate: Predicate<T>): [
    T[],
    T[]
] { const y: T[] = [], n: T[] = []; for (let i = 0; i < array.length; i++)
    (predicate(array[i]!, i) ? y : n).push(array[i]!); return [y, n]; }

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
export function uniq<T>(array: readonly T[]): T[] { return [...new Set(array)]; }

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
export function uniqBy<T, K>(array: readonly T[], valueSelector: (v: T) => K): T[] { const s = new Set<K>(), o: T[] = []; for (const v of array) {
    const k = valueSelector(v);
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
export function uniqWith<T>(array: readonly T[], comparator: Comparator<T>): T[] { const o: T[] = []; outer: for (const v of array) {
    for (const x of o)
        if (comparator(v, x))
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
export function difference<T>(array: readonly T[], valuesToExclude: readonly T[]): T[] { const s = new Set(valuesToExclude); return array.filter(v => !s.has(v)); }

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
export function intersection<T>(array: readonly T[], otherArray: readonly T[]): T[] { const s = new Set(otherArray); return uniq(array.filter(v => s.has(v))); }

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
export function union<T>(...arrays: readonly (readonly T[])[]): T[] { const s = new Set<T>(); for (const a of arrays)
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
export function without<T>(array: readonly T[], ...values: T[]): T[] { return difference(array, values); }

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
export function xor<T>(array: readonly T[], otherArray: readonly T[]): T[] { return union(difference(array, otherArray), difference(otherArray, array)); }

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
export function differenceBy<T, K>(array: readonly T[], valuesToExclude: readonly T[], valueSelector: (v: T) => K): T[] { const s = new Set(valuesToExclude.map(valueSelector)); return array.filter(v => !s.has(valueSelector(v))); }

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
export function intersectionBy<T, K>(array: readonly T[], otherArray: readonly T[], valueSelector: (v: T) => K): T[] { const s = new Set(otherArray.map(valueSelector)); return uniqBy(array.filter(v => s.has(valueSelector(v))), valueSelector); }

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
export function unionBy<T, K>(array: readonly T[], otherArray: readonly T[], valueSelector: (v: T) => K): T[] { return uniqBy([...array, ...otherArray], valueSelector); }

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
export function xorBy<T, K>(array: readonly T[], otherArray: readonly T[], valueSelector: (v: T) => K): T[] { return unionBy(differenceBy(array, otherArray, valueSelector), differenceBy(otherArray, array, valueSelector), valueSelector); }

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
export function differenceWith<T>(array: readonly T[], valuesToExclude: readonly T[], comparator: Comparator<T>): T[] { return withCmp(array, valuesToExclude, comparator, 'diff'); }

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
export function intersectionWith<T>(array: readonly T[], otherArray: readonly T[], comparator: Comparator<T>): T[] { return uniqWith(withCmp(array, otherArray, comparator, 'inter'), comparator); }

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
export function unionWith<T>(array: readonly T[], otherArray: readonly T[], comparator: Comparator<T>): T[] { return uniqWith([...array, ...otherArray], comparator); }

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
export function xorWith<T>(array: readonly T[], otherArray: readonly T[], comparator: Comparator<T>): T[] { return unionWith(differenceWith(array, otherArray, comparator), differenceWith(otherArray, array, comparator), comparator); }

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
export function isSubset<T>(subset: readonly T[], superset: readonly T[]): boolean { const s = new Set(superset); for (const v of subset)
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
export function isSubsetWith<T>(subset: readonly T[], superset: readonly T[], comparator: Comparator<T>): boolean { return subset.every(v => superset.some(x => comparator(v, x))); }

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
export function fill<T>(array: T[], value: T, startIndex = 0, endIndex = array.length): T[] { for (let i = startIndex; i < endIndex; i++)
    array[i] = value; return array; }

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
export function toFilled<T>(array: readonly T[], value: T, startIndex = 0, endIndex = array.length): T[] { return fill(array.slice(), value, startIndex, endIndex); }

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
export function pull<T>(array: T[], ...values: T[]): T[] { const s = new Set(values); let w = 0; for (let r = 0; r < array.length; r++)
    if (!s.has(array[r]!))
        array[w++] = array[r]!; array.length = w; return array; }

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
export function pullAt<T>(array: T[], indexes: readonly number[]): T[] { const s = new Set(indexes), removed: T[] = []; for (const i of indexes)
    if (i >= 0 && i < array.length)
        removed.push(array[i]!); let w = 0; for (let r = 0; r < array.length; r++)
    if (!s.has(r))
        array[w++] = array[r]!; array.length = w; return removed; }

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
export function remove<T>(array: T[], predicate: Predicate<T>): T[] { const out: T[] = []; let w = 0; for (let r = 0; r < array.length; r++) {
    const v = array[r]!;
    if (predicate(v, r))
        out.push(v);
    else
        array[w++] = v;
} array.length = w; return out; }

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
export function sample<T>(array: readonly T[]): T | undefined { return array.length ? array[(Math.random() * array.length) | 0] : undefined; }

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
export function sampleSize<T>(array: readonly T[], sampleCount = 1): T[] { return shuffle(array.slice()).slice(0, sampleCount); }

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
export function shuffle<T>(array: T[]): T[] { for (let i = array.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [array[i], array[j]] = [array[j]!, array[i]!];
} return array; }

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
export function maxBy<T>(array: readonly T[], valueSelector: (v: T) => number): T | undefined { let best = array[0], score = best === undefined ? -Infinity : valueSelector(best); for (let i = 1; i < array.length; i++) {
    const s = valueSelector(array[i]!);
    if (s > score) {
        score = s;
        best = array[i];
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
export function minBy<T>(array: readonly T[], valueSelector: (v: T) => number): T | undefined { return maxBy(array, v => -valueSelector(v)); }

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
export function sortBy<T>(array: readonly T[], ...selectors: Array<ValueSelector<T, Orderable>>): T[] {
    return array.slice().sort((leftValue, rightValue) => {
        for (const selector of selectors) {
            const leftOrderValue = selector(leftValue, 0);
            const rightOrderValue = selector(rightValue, 0);
            if (leftOrderValue < rightOrderValue) return -1;
            if (leftOrderValue > rightOrderValue) return 1;
        }
        return 0;
    });
}

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
export function orderBy<T>(
    array: readonly T[],
    selectors: readonly ValueSelector<T, Orderable>[],
    directions: readonly SortDirection[] = [],
): T[] {
    return array.slice().sort((leftValue, rightValue) => {
        for (let index = 0; index < selectors.length; index++) {
            const selector = selectors[index]!;
            const leftOrderValue = selector(leftValue, index);
            const rightOrderValue = selector(rightValue, index);
            const directionMultiplier = directions[index] === "desc" ? -1 : 1;
            if (leftOrderValue < rightOrderValue) return -directionMultiplier;
            if (leftOrderValue > rightOrderValue) return directionMultiplier;
        }
        return 0;
    });
}

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
export function combinations<T>(array: readonly T[], combinationSize: number): T[][] { const o: T[][] = []; function go(s: number, p: T[]) { if (p.length === combinationSize) {
    o.push(p.slice());
    return;
} for (let i = s; i < array.length; i++) {
    p.push(array[i]!);
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
export function windowed<T>(array: readonly T[], windowSize: number, step = 1): T[][] { const o: T[][] = []; for (let i = 0; i + windowSize <= array.length; i += step)
    o.push(array.slice(i, i + windowSize)); return o; }

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
export function zip<T>(...arrays: readonly (readonly T[])[]): T[][] { const n = Math.max(0, ...arrays.map(x => x.length)), o: T[][] = []; for (let i = 0; i < n; i++)
    o.push(arrays.map(x => x[i] as T)); return o; }

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
export function unzip<T>(groups: readonly (readonly T[])[]): T[][] { return zip(...groups); }

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
export function zipWith<T, R>(leftArray: readonly T[], rightArray: readonly T[], combiner: (leftArray: T | undefined, rightArray: T | undefined) => R): R[] { const n = Math.max(leftArray.length, rightArray.length), o: R[] = []; for (let i = 0; i < n; i++)
    o.push(combiner(leftArray[i], rightArray[i])); return o; }

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
export function unzipWith<T, R>(groups: readonly (readonly T[])[], combiner: (...v: T[]) => R): R[] { return unzip(groups).map(v => combiner(...v)); }

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
export function zipObject<K extends PropertyKey, V>(keys: readonly K[], values: readonly V[]): Record<K, V> { const o = Object.create(null); for (let i = 0; i < keys.length; i++)
    o[keys[i]!] = values[i]; return o; }
