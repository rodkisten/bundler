import { effect } from "@rodkisten/broto/reactivity";
import { hasReactiveValue, readValue } from "../../core/value.js";
import { debugState } from "../../debug.js";
import { clearRange, disposeRange, disposeTree, registerCleanup } from "../../render/cleanup.js";
import type { Directive, DirectiveController, RepeatDirective, RepeatRecord, VirtualRepeatDirective } from "../../types.js";
import type { DirectiveRuntimeHost } from "../host.js";
import { updateRepeat } from "../repeat.js";

export function createVirtualRepeatController(
  start: Comment,
  end: Comment,
  host: DirectiveRuntimeHost,
): DirectiveController {
  const records = new Map<PropertyKey, RepeatRecord>();
  let currentDirective: VirtualRepeatDirective<unknown, PropertyKey> | null =
    null;
  let disposeItems: (() => void) | null = null;
  let scroller: HTMLDivElement | null = null;
  let topSpacer: HTMLDivElement | null = null;
  let contentStart: Comment | null = null;
  let contentEnd: Comment | null = null;
  let bottomSpacer: HTMLDivElement | null = null;
  let scrollFrame = 0;

  const ensureNodes = (): void => {
    if (scroller || !end.parentNode || !currentDirective) {
      return;
    }

    scroller = document.createElement("div");
    topSpacer = document.createElement("div");
    bottomSpacer = document.createElement("div");
    contentStart = document.createComment("fabrica:virtual:start");
    contentEnd = document.createComment("fabrica:virtual:end");

    scroller.style.overflow = "auto";
    scroller.style.maxHeight =
      typeof currentDirective.height === "number"
        ? `${currentDirective.height}px`
        : String(currentDirective.height);
    scroller.style.contain = "content";
    topSpacer.style.pointerEvents = "none";
    bottomSpacer.style.pointerEvents = "none";

    scroller.append(topSpacer, contentStart, contentEnd, bottomSpacer);
    end.parentNode.insertBefore(scroller, end);

    scroller.addEventListener(
      "scroll",
      () => {
        if (scrollFrame) {
          return;
        }

        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          updateWindow();
        });
      },
      { passive: true },
    );
  };

  const updateWindow = (): void => {
    if (!currentDirective) {
      return;
    }

    ensureNodes();

    if (
      !scroller ||
      !topSpacer ||
      !contentStart ||
      !contentEnd ||
      !bottomSpacer
    ) {
      return;
    }

    const resolvedItems = readValue(currentDirective.items);
    const items = Array.isArray(resolvedItems) ? resolvedItems : [];
    const itemHeight = Math.max(1, currentDirective.itemHeight);
    const viewportHeight =
      scroller.clientHeight ||
      (typeof currentDirective.height === "number"
        ? currentDirective.height
        : itemHeight * 12);
    const firstVisible = Math.floor(scroller.scrollTop / itemHeight);
    const visibleCount = Math.ceil(viewportHeight / itemHeight);
    const from = Math.max(0, firstVisible - currentDirective.overscan);
    const to = Math.min(
      items.length,
      firstVisible + visibleCount + currentDirective.overscan,
    );
    const visibleItems = items.slice(from, to);

    debugState.virtualWindows += 1;
    topSpacer.style.height = `${from * itemHeight}px`;
    bottomSpacer.style.height = `${Math.max(0, items.length - to) * itemHeight}px`;

    const visibleDirective: RepeatDirective<unknown, PropertyKey> = {
      __kind: "directive",
      kind: "repeat",
      items: visibleItems,
      key: (item, visibleIndex) =>
        currentDirective?.key(item, from + visibleIndex) ?? visibleIndex,
      render: currentDirective.render,
      empty: currentDirective.empty,
    };

    updateRepeat(
      host,
      contentEnd,
      records,
      visibleDirective,
    );
  };

  return {
    kind: "virtualRepeat",
    update(nextDirective: Directive): void {
      currentDirective = nextDirective as VirtualRepeatDirective<
        unknown,
        PropertyKey
      >;
      ensureNodes();

      if (disposeItems) {
        updateWindow();
        return;
      }

      disposeItems = hasReactiveValue(currentDirective.items)
        ? effect(updateWindow)
        : (updateWindow(), null);

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

      if (scroller) {
        disposeTree(scroller);
        scroller.remove();
      }

      scroller = null;
      topSpacer = null;
      contentStart = null;
      contentEnd = null;
      bottomSpacer = null;
      clearRange(start, end);
    },
  };
}
