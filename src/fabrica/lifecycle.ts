import { getOwner, onOwnerCleanup, onOwnerError } from "../broto/owner";
import type { Cleanup, OwnerErrorHandler } from "../broto/types";

/**
 * Schedules a callback after the current render microtask and owns its cleanup.
 *
 * @remarks
 * Components already receive `ctx.onMount()`. This package-level helper is an
 * additive convenience for small islands, directives and userscripts that run
 * inside an active owner but are not themselves component factories.
 *
 * @param callback - Mount callback. Returning a function registers cleanup.
 * @returns Cleanup that cancels the callback before it runs or executes returned cleanup.
 *
 * @example
 * ```ts
 * onMount(() => {
 *   const controller = new AbortController();
 *   window.addEventListener('resize', sync, { signal: controller.signal });
 *   return () => controller.abort();
 * });
 * ```
 */
export function onMount(callback: () => void | Cleanup): Cleanup {
  let cancelled = false;
  let cleanup: void | Cleanup;
  const owner = getOwner();

  queueMicrotask(() => {
    if (cancelled) return;
    try {
      cleanup = callback();
    } catch (error) {
      throw error;
    }
  });

  const dispose = (): void => {
    cancelled = true;
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
  };

  if (owner) onOwnerCleanup(dispose);
  return dispose;
}

/**
 * Registers cleanup in the current owner.
 *
 * @param cleanup - Cleanup callback.
 * @returns The same cleanup callback.
 *
 * @example
 * ```ts
 * onUnmount(() => socket.close());
 * ```
 */
export function onUnmount(cleanup: Cleanup): Cleanup {
  return onOwnerCleanup(cleanup);
}

/** Alias for onUnmount used by lower-level runtime code. */
export const onDispose = onUnmount;

/**
 * Registers an error handler in the current owner.
 *
 * @param handler - Error handler. Return true to mark the error handled.
 * @returns Cleanup that removes the handler.
 */
export function onError(handler: OwnerErrorHandler): Cleanup {
  return onOwnerError(handler);
}
