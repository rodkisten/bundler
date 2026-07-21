import { effect } from "@rodkisten/broto/reactivity";
import { readValue } from "../../core/value.js";
import { clearRange, registerCleanup } from "../../render/cleanup.js";
import type { Directive, DirectiveController, WhenDirective } from "../../types.js";
import type { DirectiveRuntimeHost } from "../host.js";

export function createWhenController(
  start: Comment,
  end: Comment,
  host: DirectiveRuntimeHost,
): DirectiveController {
  let currentDirective: WhenDirective | null = null;
  let disposeEffect: (() => void) | null = null;
  let previousBranch = "";

  return {
    kind: "when",
    update(nextDirective: Directive): void {
      currentDirective = nextDirective as WhenDirective;

      if (disposeEffect) {
        return;
      }

      disposeEffect = effect(() => {
        if (!currentDirective) {
          return;
        }

        const condition = Boolean(readValue(currentDirective.condition));
        const branch = condition ? "truthy" : "falsy";

        if (previousBranch === branch) {
          return;
        }

        previousBranch = branch;
        clearRange(start, end);

        const factory = condition
          ? currentDirective.truthy
          : currentDirective.falsy;

        if (factory) {
          host.appendValue(end.parentNode, factory(), end);
        }
      });

      registerCleanup(start, disposeEffect);
    },
    dispose(): void {
      disposeEffect?.();
      disposeEffect = null;
      clearRange(start, end);
    },
  };
}
