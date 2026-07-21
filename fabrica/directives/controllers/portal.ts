import { effect } from "@rodkisten/broto/reactivity";
import { readValue } from "../../core/value.js";
import { clearRange, registerCleanup } from "../../render/cleanup.js";
import type { Directive, DirectiveController, PortalDirective, RenderValue } from "../../types.js";
import type { DirectiveRuntimeHost } from "../host.js";

export function createPortalController(
  start: Comment,
  end: Comment,
  host: DirectiveRuntimeHost,
): DirectiveController {
  let currentDirective: PortalDirective | null = null;
  let disposePortal: (() => void) | null = null;
  let disposeEffect: (() => void) | null = null;
  let currentTarget: Element | DocumentFragment | ShadowRoot | null = null;

  const updatePortal = (): void => {
    if (!currentDirective) return;
    const target = typeof currentDirective.target === "function" ? currentDirective.target() : currentDirective.target;
    const value = readValue(currentDirective.value) as RenderValue;

    if (!target) {
      disposePortal?.();
      disposePortal = null;
      currentTarget = null;
      return;
    }

    if (target !== currentTarget) {
      disposePortal?.();
      disposePortal = null;
      currentTarget = target;
    }

    if (!disposePortal) {
      disposePortal = host.mount(target, value);
      return;
    }

    disposePortal();
    disposePortal = host.mount(target, value);
  };

  return {
    kind: "portal",
    update(nextDirective: Directive): void {
      currentDirective = nextDirective as PortalDirective;

      if (disposeEffect) {
        updatePortal();
        return;
      }

      disposeEffect = effect(updatePortal, { name: "fabrica.portal" });
      registerCleanup(start, () => {
        disposeEffect?.();
        disposeEffect = null;
        disposePortal?.();
        disposePortal = null;
        currentTarget = null;
      });
    },
    dispose(): void {
      disposeEffect?.();
      disposeEffect = null;
      disposePortal?.();
      disposePortal = null;
      currentTarget = null;
      clearRange(start, end);
    },
  };
}
