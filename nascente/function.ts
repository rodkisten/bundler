/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import type { Awaitable, Curried } from "./types";
import { delay } from "./promise";

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
export function identity<Value>(value: Value): Value { return value; }

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
export function noop(): void {}

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
export async function asyncNoop(): Promise<void> {}

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
export function once<Arguments extends unknown[], Result>(functionToCall: (...arguments_: Arguments) => Result): (...arguments_: Arguments) => Result {
    let hasRun = false;
    let cachedResult: Result;
    return (...arguments_: Arguments): Result => {
        if (!hasRun) {
            hasRun = true;
            cachedResult = functionToCall(...arguments_);
        }
        return cachedResult;
    };
}

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
export function before<Arguments extends unknown[], Result>(callCount: number, functionToCall: (...arguments_: Arguments) => Result): (...arguments_: Arguments) => Result | undefined {
    let invocationCount = 0;
    let latestResult: Result | undefined;
    return (...arguments_: Arguments): Result | undefined => {
        invocationCount++;
        if (invocationCount < callCount) latestResult = functionToCall(...arguments_);
        return latestResult;
    };
}

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
export function after<Arguments extends unknown[], Result>(callCount: number, functionToCall: (...arguments_: Arguments) => Result): (...arguments_: Arguments) => Result | undefined {
    let invocationCount = 0;
    return (...arguments_: Arguments): Result | undefined => {
        invocationCount++;
        return invocationCount >= callCount ? functionToCall(...arguments_) : undefined;
    };
}

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
export function unary<FirstArgument, Result>(functionToCall: (argument: FirstArgument, ...ignoredArguments: unknown[]) => Result): (argument: FirstArgument) => Result {
    return (argument: FirstArgument): Result => functionToCall(argument);
}

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
export function ary<Arguments extends unknown[], Result>(functionToCall: (...arguments_: Arguments) => Result, arity: number): (...arguments_: Arguments) => Result {
    return (...arguments_: Arguments): Result => functionToCall(...arguments_.slice(0, arity) as Arguments);
}

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
export function negate<Arguments extends unknown[]>(predicate: (...arguments_: Arguments) => boolean): (...arguments_: Arguments) => boolean {
    return (...arguments_: Arguments): boolean => !predicate(...arguments_);
}

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
export function rest<LeadingArguments extends unknown[], RestValue, Result>(
    functionToCall: (...arguments_: [...LeadingArguments, RestValue[]]) => Result,
    startIndex = functionToCall.length - 1,
): (...arguments_: [...LeadingArguments, ...RestValue[]]) => Result {
    return (...arguments_: [...LeadingArguments, ...RestValue[]]): Result => {
        const leadingArguments = arguments_.slice(0, startIndex) as LeadingArguments;
        const restArguments = arguments_.slice(startIndex) as RestValue[];
        return functionToCall(...leadingArguments, restArguments);
    };
}

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
export function spread<Arguments extends unknown[], Result>(functionToCall: (...arguments_: Arguments) => Result): (arguments_: Arguments) => Result {
    return (arguments_: Arguments): Result => functionToCall(...arguments_);
}

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
export function partial<Prefix extends unknown[], RemainingArguments extends unknown[], Result>(
    functionToCall: (...arguments_: [...Prefix, ...RemainingArguments]) => Result,
    ...prefixArguments: Prefix
): (...arguments_: RemainingArguments) => Result {
    return (...remainingArguments: RemainingArguments): Result => functionToCall(...prefixArguments, ...remainingArguments);
}

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
export function partialRight<LeadingArguments extends unknown[], Suffix extends unknown[], Result>(
    functionToCall: (...arguments_: [...LeadingArguments, ...Suffix]) => Result,
    ...suffixArguments: Suffix
): (...arguments_: LeadingArguments) => Result {
    return (...leadingArguments: LeadingArguments): Result => functionToCall(...leadingArguments, ...suffixArguments);
}

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
export function flow<Input, A>(first: (value: Input) => A): (value: Input) => A;
export function flow<Input, A, B>(first: (value: Input) => A, second: (value: A) => B): (value: Input) => B;
export function flow<Input, A, B, C>(first: (value: Input) => A, second: (value: A) => B, third: (value: B) => C): (value: Input) => C;
export function flow<Input, A, B, C, D>(first: (value: Input) => A, second: (value: A) => B, third: (value: B) => C, fourth: (value: C) => D): (value: Input) => D;
export function flow(...functions: Array<(value: unknown) => unknown>): (value: unknown) => unknown {
    return (initialValue: unknown): unknown => {
        let currentValue = initialValue;
        for (let index = 0; index < functions.length; index++) currentValue = functions[index]!(currentValue);
        return currentValue;
    };
}

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
export function flowRight<Input, A>(first: (value: Input) => A): (value: Input) => A;
export function flowRight<Input, A, B>(second: (value: A) => B, first: (value: Input) => A): (value: Input) => B;
export function flowRight<Input, A, B, C>(third: (value: B) => C, second: (value: A) => B, first: (value: Input) => A): (value: Input) => C;
export function flowRight(...functions: Array<(value: unknown) => unknown>): (value: unknown) => unknown {
    return (initialValue: unknown): unknown => {
        let currentValue = initialValue;
        for (let index = functions.length - 1; index >= 0; index--) currentValue = functions[index]!(currentValue);
        return currentValue;
    };
}

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
export function memoize<Arguments extends unknown[], Result, CacheKey = Arguments[0]>(
    functionToMemoize: (...arguments_: Arguments) => Result,
    keyResolver: (...arguments_: Arguments) => CacheKey = ((...arguments_: Arguments) => arguments_[0] as CacheKey),
): (...arguments_: Arguments) => Result {
    const cache = new Map<CacheKey, Result>();
    return (...arguments_: Arguments): Result => {
        const cacheKey = keyResolver(...arguments_);
        if (cache.has(cacheKey)) return cache.get(cacheKey)!;
        const result = functionToMemoize(...arguments_);
        cache.set(cacheKey, result);
        return result;
    };
}


/**
 * Memoizes only the most recent invocation.
 *
 * @remarks
 * **Replaces:** A `Map`-backed memoizer when only repeated adjacent calls need caching.
 *
 * **Performance:** Stores one key and one value, avoiding `Map` allocation and hashing. This is a strong fit for
 * search queries, dynamically compiled regular expressions, and render helpers that repeatedly receive the same
 * current value but should not retain an unbounded cache.
 */
export function memoizeLast<Argument, Result>(
    functionToMemoize: (argument: Argument) => Result,
    equals: (left: Argument, right: Argument) => boolean = Object.is,
): (argument: Argument) => Result {
    let initialized = false;
    let previousArgument: Argument;
    let previousResult: Result;
    return (argument: Argument): Result => {
        if (initialized && equals(previousArgument!, argument)) return previousResult!;
        previousArgument = argument;
        previousResult = functionToMemoize(argument);
        initialized = true;
        return previousResult;
    };
}

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
export function debounce<Arguments extends unknown[]>(functionToDebounce: (...arguments_: Arguments) => unknown, waitMilliseconds = 0): ((...arguments_: Arguments) => void) & { cancel(): void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = (...arguments_: Arguments): void => {
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => { functionToDebounce(...arguments_); }, waitMilliseconds);
    };
    debounced.cancel = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
    };
    return debounced;
}

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
export function throttle<Arguments extends unknown[]>(functionToThrottle: (...arguments_: Arguments) => unknown, waitMilliseconds = 0): (...arguments_: Arguments) => void {
    let lastExecutionTime = 0;
    let trailingTimer: ReturnType<typeof setTimeout> | undefined;
    return (...arguments_: Arguments): void => {
        const currentTime = Date.now();
        const remainingMilliseconds = waitMilliseconds - (currentTime - lastExecutionTime);
        if (remainingMilliseconds <= 0) {
            lastExecutionTime = currentTime;
            functionToThrottle(...arguments_);
            return;
        }
        if (trailingTimer === undefined) {
            trailingTimer = setTimeout(() => {
                trailingTimer = undefined;
                lastExecutionTime = Date.now();
                functionToThrottle(...arguments_);
            }, remainingMilliseconds);
        }
    };
}

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
export async function retry<Result>(operation: () => Awaitable<Result>, attempts = 3, delayMilliseconds = 0): Promise<Result> {
    let latestError: unknown;
    for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex++) {
        try { return await operation(); }
        catch (error) {
            latestError = error;
            if (delayMilliseconds > 0 && attemptIndex + 1 < attempts) await delay(delayMilliseconds);
        }
    }
    throw latestError;
}

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
export function curry<Arguments extends unknown[], Result>(functionToCurry: (...arguments_: Arguments) => Result, arity = functionToCurry.length): Curried<Arguments, Result> {
    const collect = (collectedArguments: unknown[]): unknown => collectedArguments.length >= arity
        ? functionToCurry(...collectedArguments as Arguments)
        : (nextArgument: unknown) => collect([...collectedArguments, nextArgument]);
    return collect([]) as Curried<Arguments, Result>;
}

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
export function curryRight<Arguments extends unknown[], Result>(functionToCurry: (...arguments_: Arguments) => Result, arity = functionToCurry.length): Curried<Arguments, Result> {
    const collect = (collectedArguments: unknown[]): unknown => collectedArguments.length >= arity
        ? functionToCurry(...collectedArguments.reverse() as Arguments)
        : (nextArgument: unknown) => collect([...collectedArguments, nextArgument]);
    return collect([]) as Curried<Arguments, Result>;
}
