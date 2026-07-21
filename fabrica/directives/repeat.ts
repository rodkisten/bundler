import { batch, signal } from "@rodkisten/broto/reactivity";
import {
  appendRangeToFragment,
  disposeRange,
  moveRangeBefore,
  removeRange,
} from "../render/cleanup.js";
import { readValue } from "../core/value.js";
import type {
  RenderValue,
  RepeatDirective,
  RepeatRecord,
} from "../types.js";

let repeatDiffVersion = 0;

/** Renderer capabilities required by the keyed repeat reconciler. */
export interface RepeatRuntimeHost {
  appendValue(
    parentNode: Node | null,
    value: RenderValue,
    beforeNode?: Node | null,
  ): void;
}

export function updateRepeat(
  host: RepeatRuntimeHost,
  end: Comment,
  records: Map<PropertyKey, RepeatRecord>,
  directive: RepeatDirective<unknown, PropertyKey>,
): boolean {
  const resolvedItems = readValue(directive.items);
  const items = Array.isArray(resolvedItems) ? resolvedItems : [];

  if (directive.strategy === "append-only") {
    return updateAppendOnlyRepeat(
      host,
      end,
      records,
      directive,
      items,
    );
  }

  if (directive.strategy === "indexed") {
    return updateIndexedRepeat(
      host,
      end,
      records,
      directive,
      items,
    );
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
      record = createRepeatRecord(
        host,
        item,
        index,
        key,
        directive.render,
      );
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

  // Reversals and large reshuffles are faster as one fragment move than as many
  // tiny `insertBefore()` calls. The benchmark's keyed-list case reverses the
  // whole list, which makes the LIS intentionally tiny; batching the ranges
  // avoids a storm of DOM mutations while keeping node identity and effects.
  const shouldBatchReorder = nextRecords.length > 16 && stableIndexes.length * 2 < nextRecords.length;
  if (shouldBatchReorder) {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < nextRecords.length; index += 1) {
      const record = nextRecords[index]!;
      record.order = index;
      if (record.fragment) {
        fragment.append(record.fragment);
        record.fragment = null;
      } else {
        appendRangeToFragment(record.start, record.end, fragment);
      }
    }
    parent.insertBefore(fragment, end);
    return items.length > 0;
  }

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

export function longestIncreasingSubsequence(values: readonly number[]): number[] {
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
 * @param end - Range end marker.
 * @param records - Existing records.
 * @param directive - Repeat directive.
 * @param items - Resolved items.
 * @returns Whether there are items.
 */
function updateAppendOnlyRepeat(
  host: RepeatRuntimeHost,
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
      record = createRepeatRecord(
        host,
        item,
        index,
        key,
        directive.render,
      );
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
 * @param end - Range end marker.
 * @param records - Existing records.
 * @param directive - Repeat directive.
 * @param items - Resolved items.
 * @returns Whether there are items.
 */
function updateIndexedRepeat(
  host: RepeatRuntimeHost,
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
      record = createRepeatRecord(
        host,
        item,
        index,
        key,
        directive.render,
      );
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

/**
 * Creates a repeat context signal that allocates the Broto signal lazily.
 *
 * @remarks
 * `repeat()` exposes `{ item, index, key }` as signals for ergonomic render
 * functions, but many item templates only read `item`. Creating and updating
 * three full reactive primitives per row makes keyed reorders pay for signals
 * that were never observed. This facade keeps the public callable signal shape
 * while only materializing the real signal when user code reads or subscribes.
 */
function createLazyRepeatSignal<Value>(initialValue: Value): ReturnType<typeof signal<Value>> {
  let value = initialValue;
  let inner: ReturnType<typeof signal<Value>> | null = null;

  const ensure = (): ReturnType<typeof signal<Value>> => {
    if (!inner) inner = signal(value);
    return inner;
  };

  const read = (() => {
    if (inner) return inner();
    inner = signal(value);
    return inner();
  }) as ReturnType<typeof signal<Value>>;

  read.set = (nextValue: Value): void => {
    value = nextValue;
    inner?.set(nextValue);
  };

  read.update = (updater: (currentValue: Value) => Value): void => {
    read.set(updater(value));
  };

  read.peek = (): Value => inner ? inner.peek() : value;

  read.subscribe = (listener: Parameters<ReturnType<typeof signal<Value>>["subscribe"]>[0]): (() => void) => ensure().subscribe(listener);

  return read;
}

function createRepeatRecord(
  host: RepeatRuntimeHost,
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
    item: createLazyRepeatSignal(item),
    index: createLazyRepeatSignal(index),
    key: createLazyRepeatSignal(key),
  };
  const fragment = document.createDocumentFragment();

  fragment.append(start);
  host.appendValue(fragment, renderItem(context));
  fragment.append(end);

  return { ...context, start, end, fragment };
}
