import { effect } from "@rodkisten/broto/reactivity";
import { readValue } from "../../core/value.js";
import { clearRange, registerCleanup } from "../../render/cleanup.js";
import type { Directive, DirectiveController, KeyedDirective } from "../../types.js";
import type { DirectiveRuntimeHost } from "../host.js";

export function createKeyedController(
  start: Comment,
  end: Comment,
  host: DirectiveRuntimeHost,
): DirectiveController {
  let previousKey: unknown = Symbol('initial-key');
  let disposeEffect: (() => void) | null = null;
  let currentDirective: KeyedDirective | null = null;

  const updateKeyed = () => {
    if (!currentDirective) return;
    const nextKey = readValue(currentDirective.key);
    if (Object.is(previousKey, nextKey)) return;
    previousKey = nextKey;
    clearRange(start, end);
    host.appendValue(end.parentNode, currentDirective.render(), end);
  };

  return {
    kind: 'keyed',
    update(nextDirective: Directive) {
      currentDirective = nextDirective as KeyedDirective;
      if (disposeEffect) { updateKeyed(); return; }
      disposeEffect = effect(updateKeyed, { name: 'fabrica.keyed' });
      registerCleanup(start, disposeEffect);
    },
    dispose() {
      disposeEffect?.();
      disposeEffect = null;
      clearRange(start, end);
    },
  };
}
