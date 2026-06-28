import { batch, effect, signal } from "../broto/reactivity";
import { clearRange, disposeRange, disposeTree, moveRangeBefore, registerCleanup, removeRange } from "./dom-cleanup";
import { debugState } from "./debug";
import { appendValue, mount } from "./dom";
import { hasReactiveValue, readValue } from "./value";
import type { BindDirective, Directive, DirectiveController, KeyedDirective, PortalDirective, RenderValue, RepeatDirective, RepeatRecord, SuspenseDirective, VirtualRepeatDirective, WhenDirective } from "./types";

let repeatDiffVersion = 0;

export function createDirectiveController(
  start: Comment,
  end: Comment,
  directive: Directive,
): DirectiveController {
  if (directive.kind === "when") {
    return createWhenController(start, end);
  }

  if (directive.kind === "repeat") {
    return createRepeatController(start, end);
  }

  if (directive.kind === "virtualRepeat") {
    return createVirtualRepeatController(start, end);
  }

  if (directive.kind === "portal") {
    return createPortalController(start, end);
  }

  if (directive.kind === "suspense") {
    return createSuspenseController(start, end);
  }

  if (directive.kind === "keyed") {
    return createKeyedController(start, end);
  }

  return {
    kind: directive.kind,
    update(): void {},
    dispose(): void {
      clearRange(start, end);
    },
  };
}


/**
 * Creates a portal controller that renders into a foreign DOM root.
 *
 * @param start - Owned range start.
 * @param end - Owned range end.
 * @returns Directive controller.
 */

export function bindModelPart(element: Element, rawName: string, directive: BindDirective): void {
  const propertyName = rawName.startsWith('.') || rawName.startsWith('?') || rawName.startsWith(':') ? rawName.slice(1) : rawName;
  const eventName = directive.event || (propertyName === 'checked' ? 'change' : 'input');
  const readElement = directive.from || ((node: Element) => {
    const target = node as HTMLInputElement & { [key: string]: unknown };
    return (propertyName === 'checked' ? Boolean(target.checked) : target[propertyName]) as never;
  });
  const writeElement = directive.to || ((value: unknown) => value);

  const update = () => {
    const next = writeElement(directive.signal());
    const target = element as HTMLElement & { [key: string]: unknown };
    if (!Object.is(target[propertyName], next)) target[propertyName] = next;
  };

  const dispose = effect(update, { name: `fabrica.bind.${propertyName}` });
  const listener = () => directive.signal.set(readElement(element));
  element.addEventListener(eventName, listener);
  registerCleanup(element, () => {
    dispose();
    element.removeEventListener(eventName, listener);
  });
}

function createKeyedController(start: Comment, end: Comment): DirectiveController {
  let previousKey: unknown = Symbol('initial-key');
  let disposeEffect: (() => void) | null = null;
  let currentDirective: KeyedDirective | null = null;

  const updateKeyed = () => {
    if (!currentDirective) return;
    const nextKey = readValue(currentDirective.key);
    if (Object.is(previousKey, nextKey)) return;
    previousKey = nextKey;
    clearRange(start, end);
    appendValue(end.parentNode, currentDirective.render(), end);
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

function createPortalController(start: Comment, end: Comment): DirectiveController {
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
      disposePortal = mount(target, value);
      return;
    }

    disposePortal();
    disposePortal = mount(target, value);
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

/**
 * Creates a resource suspense controller.
 *
 * @param start - Owned range start.
 * @param end - Owned range end.
 * @returns Directive controller.
 */
function createSuspenseController(start: Comment, end: Comment): DirectiveController {
  let currentDirective: SuspenseDirective | null = null;
  let disposeEffect: (() => void) | null = null;

  const updateSuspense = (): void => {
    if (!currentDirective) return;
    const state = readValue(currentDirective.source) as { loading?: boolean; value?: unknown; error?: unknown } | unknown;
    const resource = state && typeof state === "object" ? state as { loading?: boolean; value?: unknown; error?: unknown } : { value: state };

    clearRange(start, end);

    if (resource.error !== undefined && currentDirective.rejected) {
      appendValue(end.parentNode, currentDirective.rejected(resource.error), end);
      return;
    }

    if (resource.loading) {
      appendValue(end.parentNode, currentDirective.pending(), end);
      return;
    }

    appendValue(end.parentNode, currentDirective.resolved(resource.value), end);
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

function createWhenController(
  start: Comment,
  end: Comment,
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
          appendValue(end.parentNode, factory(), end);
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

function createRepeatController(
  start: Comment,
  end: Comment,
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

    const hasItems = updateRepeat(start, end, records, currentDirective);

    if (!hasItems && currentDirective.empty) {
      if (!emptyStart) {
        emptyStart = document.createComment("fabrica:empty:start");
        emptyEnd = document.createComment("fabrica:empty:end");
        end.parentNode?.insertBefore(emptyStart, end);
        appendValue(end.parentNode, currentDirective.empty(), end);
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

function createVirtualRepeatController(
  start: Comment,
  end: Comment,
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

    updateRepeat(contentStart, contentEnd, records, visibleDirective);
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

function updateRepeat(
  start: Comment,
  end: Comment,
  records: Map<PropertyKey, RepeatRecord>,
  directive: RepeatDirective<unknown, PropertyKey>,
): boolean {
  const resolvedItems = readValue(directive.items);
  const items = Array.isArray(resolvedItems) ? resolvedItems : [];

  if (directive.strategy === "append-only") {
    return updateAppendOnlyRepeat(start, end, records, directive, items);
  }

  if (directive.strategy === "indexed") {
    return updateIndexedRepeat(start, end, records, directive, items);
  }

  const parent = end.parentNode;
  if (!parent) return items.length > 0;

  const version = ++repeatDiffVersion;
  const nextRecords: RepeatRecord[] = new Array(items.length);
  const oldIndexes: number[] = new Array(items.length);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const key = directive.key(item, index);
    let record = records.get(key);

    if (!record) {
      record = createRepeatRecord(item, index, key, directive.render);
      records.set(key, record);
      oldIndexes[index] = -1;
    } else {
      oldIndexes[index] = record.order ?? index;
      batch(() => {
        record!.item.set(item);
        record!.index.set(index);
        record!.key.set(key);
      });
    }

    record.version = version;
    nextRecords[index] = record;
  }

  const staleKeys: PropertyKey[] = [];
  for (const [key, record] of records) {
    if (record.version === version) continue;
    disposeRange(record.start, record.end);
    removeRange(record.start, record.end);
    staleKeys[staleKeys.length] = key;
  }

  for (let index = 0; index < staleKeys.length; index += 1) {
    records.delete(staleKeys[index]);
  }

  const stableIndexes = longestIncreasingSubsequence(oldIndexes);
  let stableCursor = stableIndexes.length - 1;
  let anchor: Node = end;

  for (let index = nextRecords.length - 1; index >= 0; index -= 1) {
    const record = nextRecords[index]!;
    record.order = index;

    if (record.fragment) {
      parent.insertBefore(record.fragment, anchor);
      record.fragment = null;
    } else if (oldIndexes[index] === -1) {
      moveRangeBefore(record.start, record.end, anchor);
    } else if (stableCursor >= 0 && stableIndexes[stableCursor] === index) {
      stableCursor -= 1;
    } else if (record.end.nextSibling !== anchor) {
      moveRangeBefore(record.start, record.end, anchor);
    }

    anchor = record.start;
  }

  return items.length > 0;
}

function longestIncreasingSubsequence(values: readonly number[]): number[] {
  const predecessors = new Array<number>(values.length);
  const result: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (value < 0) continue;

    let low = 0;
    let high = result.length;

    while (low < high) {
      const middle = (low + high) >> 1;
      if (values[result[middle]!]! < value) low = middle + 1;
      else high = middle;
    }

    if (low > 0) predecessors[index] = result[low - 1]!;
    result[low] = index;
  }

  let cursor = result.length;
  let index = result[cursor - 1];
  const sequence = new Array<number>(cursor);

  while (cursor-- > 0 && index !== undefined) {
    sequence[cursor] = index;
    index = predecessors[index];
  }

  return sequence;
}

/**
 * Updates a list that only appends or trims from the end.
 *
 * @remarks
 * This is the fast path for logs, timelines and console records. It avoids
 * building next-key sets, moving existing ranges and scanning old records on
 * every push. When the list shrinks, only the truncated tail is disposed.
 *
 * @param start - Range start marker.
 * @param end - Range end marker.
 * @param records - Existing records.
 * @param directive - Repeat directive.
 * @param items - Resolved items.
 * @returns Whether there are items.
 */
function updateAppendOnlyRepeat(
  start: Comment,
  end: Comment,
  records: Map<PropertyKey, RepeatRecord>,
  directive: RepeatDirective<unknown, PropertyKey>,
  items: readonly unknown[],
): boolean {
  let index = 0;

  for (; index < items.length; index += 1) {
    const item = items[index];
    const key = directive.key(item, index);
    let record = records.get(key);

    if (!record) {
      record = createRepeatRecord(item, index, key, directive.render);
      records.set(key, record);
      record.order = index;
      end.parentNode?.insertBefore(record.fragment as DocumentFragment, end);
      record.fragment = null;
      continue;
    }

    batch(() => {
      record.item.set(item);
      record.index.set(index);
      record.key.set(key);
    });
    record.order = index;
  }

  if (records.size > items.length) {
    const staleKeys: PropertyKey[] = [];
    let seen = 0;
    for (const [key, record] of records) {
      if (seen >= items.length) {
        disposeRange(record.start, record.end);
        removeRange(record.start, record.end);
        staleKeys[staleKeys.length] = key;
      }
      seen += 1;
    }
    for (let staleIndex = 0; staleIndex < staleKeys.length; staleIndex += 1) records.delete(staleKeys[staleIndex]);
  }

  return items.length > 0;
}

/**
 * Updates an index-stable list without moving DOM ranges.
 *
 * @param start - Range start marker.
 * @param end - Range end marker.
 * @param records - Existing records.
 * @param directive - Repeat directive.
 * @param items - Resolved items.
 * @returns Whether there are items.
 */
function updateIndexedRepeat(
  start: Comment,
  end: Comment,
  records: Map<PropertyKey, RepeatRecord>,
  directive: RepeatDirective<unknown, PropertyKey>,
  items: readonly unknown[],
): boolean {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const key = index;
    let record = records.get(key);

    if (!record) {
      record = createRepeatRecord(item, index, key, directive.render);
      records.set(key, record);
      record.order = index;
      end.parentNode?.insertBefore(record.fragment as DocumentFragment, end);
      record.fragment = null;
      continue;
    }

    batch(() => {
      record.item.set(item);
      record.index.set(index);
      record.key.set(key);
    });
    record.order = index;
  }

  if (records.size > items.length) {
    const staleKeys: PropertyKey[] = [];
    for (const [key, record] of records) {
      if (Number(key) < items.length) continue;
      disposeRange(record.start, record.end);
      removeRange(record.start, record.end);
      staleKeys[staleKeys.length] = key;
    }
    for (let index = 0; index < staleKeys.length; index += 1) records.delete(staleKeys[index]);
  }

  return items.length > 0;
}

function createRepeatRecord(
  item: unknown,
  index: number,
  key: PropertyKey,
  renderItem: (context: {
    item: ReturnType<typeof signal<unknown>>;
    index: ReturnType<typeof signal<number>>;
    key: ReturnType<typeof signal<PropertyKey>>;
  }) => RenderValue,
): RepeatRecord {
  const start = document.createComment("fabrica:item:start");
  const end = document.createComment("fabrica:item:end");
  const context = {
    item: signal(item),
    index: signal(index),
    key: signal(key),
  };
  const fragment = document.createDocumentFragment();

  fragment.append(start);
  appendValue(fragment, renderItem(context));
  fragment.append(end);

  return { ...context, start, end, fragment };
}
