import { effect } from "@rodkisten/broto/reactivity";
import { hasReactiveValue } from "../../core/value.js";
import { clearRange, disposeRange, registerCleanup, removeRange } from "../../render/cleanup.js";
import type { Directive, DirectiveController, RepeatDirective, RepeatRecord } from "../../types.js";
import type { DirectiveRuntimeHost } from "../host.js";
import { updateRepeat } from "../repeat.js";

export function createRepeatController(
  start: Comment,
  end: Comment,
  host: DirectiveRuntimeHost,
): DirectiveController {
  const records = new Map<PropertyKey, RepeatRecord>();
  let currentDirective: RepeatDirective<unknown, PropertyKey> | null = null;
  let disposeItems: (() => void) | null = null;
  let emptyStart: Comment | null = null;
  let emptyEnd: Comment | null = null;

  const updateList = (): void => {
    if (!currentDirective) {
      return;
    }

    const hasItems = updateRepeat(
      host,
      end,
      records,
      currentDirective,
    );

    if (!hasItems && currentDirective.empty) {
      if (!emptyStart) {
        emptyStart = document.createComment("fabrica:empty:start");
        emptyEnd = document.createComment("fabrica:empty:end");
        end.parentNode?.insertBefore(emptyStart, end);
        host.appendValue(end.parentNode, currentDirective.empty(), end);
        end.parentNode?.insertBefore(emptyEnd, end);
      }

      return;
    }

    if (emptyStart && emptyEnd) {
      disposeRange(emptyStart, emptyEnd);
      removeRange(emptyStart, emptyEnd);
      emptyStart = null;
      emptyEnd = null;
    }
  };

  return {
    kind: "repeat",
    update(nextDirective: Directive): void {
      currentDirective = nextDirective as RepeatDirective<unknown, PropertyKey>;

      if (disposeItems) {
        return;
      }

      disposeItems = hasReactiveValue(currentDirective.items)
        ? effect(updateList)
        : (updateList(), null);

      if (disposeItems) {
        registerCleanup(start, disposeItems);
      }
    },
    dispose(): void {
      disposeItems?.();
      disposeItems = null;

      for (const record of records.values()) {
        disposeRange(record.start, record.end);
      }

      records.clear();
      clearRange(start, end);
    },
  };
}
