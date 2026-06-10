import type { BrotoDebugSnapshot } from "./types";

/** Mutable debug counters for Broto. */
export const brotoDebugState: BrotoDebugSnapshot = {
  enabled: false,
  signals: 0,
  effects: 0,
  computed: 0,
  stores: 0,
  resources: 0,
  flushes: 0,
  updates: 0,
};

/** Enables or disables debug counters. */
export function setDebug(enabled: boolean): void {
  brotoDebugState.enabled = enabled;
}

/** Returns a readonly debug snapshot. */
export function debug(): Readonly<BrotoDebugSnapshot> {
  return { ...brotoDebugState };
}
