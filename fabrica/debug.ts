import type { DebugListener, DebugRecord, DebugSnapshot } from "@rodkisten/fabrica/types";

const DEBUG_RECORD_LIMIT = 256;
const debugRecordsBuffer: DebugRecord[] = [];
const debugListeners = new Set<DebugListener>();
let debugSequence = 0;

/**
 * Mutable debug counters for the runtime.
 *
 * @remarks
 * The runtime increments these counters in hot paths, so this object stays flat
 * and tiny. Consumers only receive frozen snapshots through `debug()`.
 */
export const debugState: DebugSnapshot = {
  enabled: false,
  templates: 0,
  parts: 0,
  effects: 0,
  flushes: 0,
  updates: 0,
  components: 0,
  delegatedEvents: 0,
  delegatedBindings: 0,
  directEventBindings: 0,
  delegatedDispatches: 0,
  eventHandlerCalls: 0,
  reconciliations: 0,
  virtualWindows: 0,
};

/**
 * Enables or disables debug mode.
 *
 * @remarks
 * Event trace objects are only allocated while debug mode is enabled. Counters
 * remain available in both modes so production diagnostics can inspect totals
 * without paying the cost of per-event history allocation.
 *
 * @param enabled - Whether debug mode should be enabled.
 *
 * @example
 * ```ts
 * setDebug(true);
 * console.table(debug());
 * ```
 */
export function setDebug(enabled: boolean): void {
  debugState.enabled = Boolean(enabled);
}

/**
 * Returns a frozen debug snapshot.
 *
 * @returns Current debug counters.
 *
 * @example
 * ```ts
 * const snapshot = debug();
 * console.log(snapshot.templates);
 * ```
 */
export function debug(): Readonly<DebugSnapshot> {
  return Object.freeze({ ...debugState });
}

/** Returns an immutable snapshot of the bounded runtime debug history. */
export function debugRecords(): readonly DebugRecord[] {
  return Object.freeze(debugRecordsBuffer.slice());
}

/** Clears the bounded debug history without resetting lifetime counters. */
export function clearDebugRecords(): void {
  debugRecordsBuffer.length = 0;
}

/**
 * Subscribes to runtime debug records.
 *
 * @remarks
 * This is intentionally transport-agnostic so a future DevTools panel can
 * stream records without coupling the core runtime to UI code.
 */
export function subscribeDebug(listener: DebugListener): () => void {
  debugListeners.add(listener);
  return () => debugListeners.delete(listener);
}

/** Internal hot-path hook. Does nothing and allocates nothing when debug is off. */
export function recordDebug(
  record: Omit<DebugRecord, "sequence" | "timestamp">,
): void {
  if (!debugState.enabled) return;

  const next = Object.freeze({
    ...record,
    sequence: ++debugSequence,
    timestamp: Date.now(),
  }) as DebugRecord;

  if (debugRecordsBuffer.length >= DEBUG_RECORD_LIMIT) {
    debugRecordsBuffer.shift();
  }

  debugRecordsBuffer.push(next);

  for (const listener of debugListeners) {
    listener(next);
  }
}
