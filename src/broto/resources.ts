import { signal } from "./reactivity";
import { brotoDebugState } from "./debug";
import type { Resource, ResourceState } from "./types";

/**
 * Creates an async resource backed by a signal.
 *
 * @param loader - Async function used to load the value.
 * @returns Resource signal with a reload method.
 *
 * @example
 * ```ts
 * const profile = resource(() => fetch("/me").then((r) => r.json()));
 * effect(() => {
 *   if (profile().loading) console.log("Loading...");
 * });
 * ```
 */
export function resource<Value, ErrorValue = unknown>(loader: () => Promise<Value>): Resource<Value, ErrorValue> {
  brotoDebugState.resources += 1;

  const state = signal<ResourceState<Value, ErrorValue>>({
    loading: false,
    value: undefined,
    error: undefined,
  });

  async function reload(): Promise<Value | undefined> {
    state.set({ ...state.peek(), loading: true, error: undefined });

    try {
      const value = await loader();
      state.set({ loading: false, value, error: undefined });
      return value;
    } catch (error) {
      state.set({ loading: false, value: state.peek().value, error: error as ErrorValue });
      return undefined;
    }
  }

  const output = state as Resource<Value, ErrorValue>;
  output.reload = reload;
  void reload();

  return output;
}
