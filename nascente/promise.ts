/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */
import type { Awaitable } from "./types";
import { AbortError, TimeoutError } from "./errors";

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
export function timeout(milliseconds: number, signal?: AbortSignal): Promise<never> { return new Promise((_, reject) => { const t = setTimeout(() => reject(new TimeoutError()), milliseconds); signal?.addEventListener('abort', () => { clearTimeout(t); reject(new AbortError()); }, { once: true }); }); }

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
export async function withTimeout<T>(promise: Awaitable<T>, milliseconds: number): Promise<T> { return Promise.race([promise, timeout(milliseconds)]); }

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
export async function allKeyed<T extends Record<PropertyKey, Awaitable<unknown>>>(object: T): Promise<{
    [K in keyof T]: Awaited<T[K]>;
}> { const keys = Reflect.ownKeys(object) as (keyof T)[], vals = await Promise.all(keys.map(k => object[k])); const r: any = {}; for (let i = 0; i < keys.length; i++)
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
