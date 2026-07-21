import { effect } from "@rodkisten/broto/reactivity";
import { readValue } from "../../core/value.js";
import { clearRange, registerCleanup } from "../../render/cleanup.js";
import type { Directive, DirectiveController, SuspenseDirective } from "../../types.js";
import type { DirectiveRuntimeHost } from "../host.js";

/**
 * Creates a resource suspense controller.
 *
 * @param start - Owned range start.
 * @param end - Owned range end.
 * @returns Directive controller.
 */
export function createSuspenseController(
  start: Comment,
  end: Comment,
  host: DirectiveRuntimeHost,
): DirectiveController {
  let currentDirective: SuspenseDirective | null = null;
  let disposeEffect: (() => void) | null = null;

  const updateSuspense = (): void => {
    if (!currentDirective) return;
    const state = readValue(currentDirective.source) as { loading?: boolean; value?: unknown; error?: unknown } | unknown;
    const resource = state && typeof state === "object" ? state as { loading?: boolean; value?: unknown; error?: unknown } : { value: state };

    clearRange(start, end);

    if (resource.error !== undefined && currentDirective.rejected) {
      host.appendValue(end.parentNode, currentDirective.rejected(resource.error), end);
      return;
    }

    if (resource.loading) {
      host.appendValue(end.parentNode, currentDirective.pending(), end);
      return;
    }

    host.appendValue(end.parentNode, currentDirective.resolved(resource.value), end);
  };

  return {
    kind: "suspense",
    update(nextDirective: Directive): void {
      currentDirective = nextDirective as SuspenseDirective;

      if (disposeEffect) {
        updateSuspense();
        return;
      }

      disposeEffect = effect(updateSuspense, { name: "fabrica.suspense" });
      registerCleanup(start, () => {
        disposeEffect?.();
        disposeEffect = null;
      });
    },
    dispose(): void {
      disposeEffect?.();
      disposeEffect = null;
      clearRange(start, end);
    },
  };
}
