import { brotoDebugState } from "./debug";
import { onOwnerCleanup } from "./owner";
import { signal } from "./reactivity";
import type { Resource, ResourceLoader, ResourceState } from "./types";

/**
 * Creates an owned async resource backed by a signal.
 *
 * @remarks
 * Resources are tied to the current Broto owner. When a component/effect/root is
 * disposed, the in-flight request is aborted and later results are ignored. This
 * makes async UI safe by default: no "set state after unmount", no orphaned
 * fetches, no forgotten AbortControllers.
 *
 * @param loader - Async function used to load the value. Receives AbortSignal.
 * @returns Resource signal with reload and abort methods.
 *
 * @example Basic resource
 * ```ts
 * const profile = resource((signal) => fetch("/me", { signal }).then((r) => r.json()));
 * effect(() => {
 *   if (profile().loading) console.log("Loading...");
 * });
 * ```
 *
 * @example Manual reload
 * ```ts
 * await profile.reload();
 * ```
 */
export function resource<Value, ErrorValue = unknown>(loader: ResourceLoader<Value>): Resource<Value, ErrorValue> {
  brotoDebugState.resources += 1;

  let controller: AbortController | null = null;
  let version = 0;
  let disposed = false;

  const state = signal<ResourceState<Value, ErrorValue>>({
    loading: false,
    value: undefined,
    error: undefined,
    stale: false,
  });

  function abort(reason?: unknown): void {
    controller?.abort(reason);
    controller = null;
  }

  async function reload(): Promise<Value | undefined> {
    if (disposed) {
      return undefined;
    }

    abort("reload");
    const localVersion = ++version;
    controller = new AbortController();
    const previous = state.peek();

    state.set({ ...previous, loading: true, error: undefined, stale: previous.value !== undefined });

    try {
      const value = await loader(controller.signal);

      if (disposed || localVersion !== version || controller.signal.aborted) {
        return undefined;
      }

      state.set({ loading: false, value, error: undefined, stale: false });
      return value;
    } catch (error) {
      if (disposed || localVersion !== version || controller.signal.aborted) {
        return undefined;
      }

      state.set({ loading: false, value: state.peek().value, error: error as ErrorValue, stale: false });
      return undefined;
    }
  }

  onOwnerCleanup(() => {
    disposed = true;
    abort("dispose");
  });

  const output = state as Resource<Value, ErrorValue>;
  output.reload = reload;
  output.abort = abort;

  void reload();

  return output;
}
