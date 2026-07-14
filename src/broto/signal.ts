import type { Signal } from "./types";

/** Stable runtime brand shared by Broto signals across bundles and realms. */
export const SIGNAL_SYMBOL: unique symbol = Symbol.for("@rodkisten/broto.signal") as never;

/** Brands a callable as a Broto signal without exposing enumerable metadata. */
type SignalImplementation<Value> = (() => Value) & Pick<
  Signal<Value>,
  "set" | "update" | "peek" | "subscribe"
>;

export function markSignal<Value>(value: SignalImplementation<Value>): Signal<Value> {
  Object.defineProperty(value, SIGNAL_SYMBOL, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });

  return value as Signal<Value>;
}

/** Checks whether a value implements Broto's official signal protocol. */
export function isSignal<Value = unknown>(value: unknown): value is Signal<Value> {
  return Boolean(
    typeof value === "function" &&
      (value as Partial<Signal<Value>>)[SIGNAL_SYMBOL] === true,
  );
}

/** Reads a signal or returns a non-signal value unchanged. */
export function unwrapSignal<Value>(value: Value | Signal<Value>): Value {
  return isSignal<Value>(value) ? value() : value;
}
