import { signal } from "./reactivity";
import { brotoDebugState } from "./debug";
import type { Signal } from "./types";

/** Reactive store made from an object of signals. */
export type Store<State extends Record<string, unknown>> = {
  readonly [Key in keyof State]: Signal<State[Key]>;
} & {
  /** Reads a plain snapshot without subscribing to every field. */
  snapshot(): State;
  /** Applies a partial patch to existing fields. */
  patch(nextState: Partial<State>): void;
};

/**
 * Creates a tiny object store from writable signals.
 *
 * @param initialState - Initial object state.
 * @returns Store with one signal per key.
 *
 * @example
 * ```ts
 * const user = store({ name: "Rod", active: true });
 * user.name.set("Rodolfo");
 * console.log(user.snapshot());
 * // { name: "Rodolfo", active: true }
 * ```
 */
export function store<State extends Record<string, unknown>>(initialState: State): Store<State> {
  brotoDebugState.stores += 1;

  const output: Record<string, Signal<unknown>> = {};

  for (const [key, value] of Object.entries(initialState)) {
    output[key] = signal(value);
  }

  Object.defineProperties(output, {
    snapshot: {
      enumerable: false,
      value() {
        const snapshot: Record<string, unknown> = {};

        for (const key of Object.keys(initialState)) {
          snapshot[key] = output[key]?.peek();
        }

        return snapshot as State;
      },
    },
    patch: {
      enumerable: false,
      value(nextState: Partial<State>) {
        for (const [key, value] of Object.entries(nextState)) {
          output[key]?.set(value);
        }
      },
    },
  });

  return output as Store<State>;
}
