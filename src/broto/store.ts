import { signal } from "./reactivity";
import { brotoDebugState } from "./debug";
import type { Signal } from "./types";

/** Primitive values that stay as writable signals inside a Broto store. */
type Primitive = string | number | boolean | bigint | symbol | null | undefined | Function | Date | RegExp;

/** Store path key used by patch diagnostics and deep writes. */
export type StorePath = readonly PropertyKey[];

/** Patch metadata used by devtools and diagnostics. */
export type StorePatchMeta = {
  cause?: string;
  path?: StorePath;
};

/** Recursively turns plain object leaves into signals while keeping nested objects reactive. */
export type DeepStoreValue<Value> = Value extends Primitive
  ? Signal<Value>
  : Value extends readonly (infer Item)[]
    ? Signal<Value> & { atSignal(index: number): DeepStoreValue<Item> | undefined }
    : Value extends Record<string, unknown>
      ? DeepStore<Value>
      : Signal<Value>;

/** Reactive store made from nested signals. */
export type DeepStore<State extends Record<string, unknown>> = {
  readonly [Key in keyof State]: DeepStoreValue<State[Key]>;
} & {
  /** Reads a plain snapshot without subscribing to every field. */
  snapshot(): State;
  /** Applies a deep partial patch. New keys are created on demand. */
  patch(nextState: DeepPartial<State>, meta?: StorePatchMeta): void;
  /** Reads a nested signal/store by path. */
  get(path: StorePath): unknown;
  /** Writes a nested path, creating intermediate plain object stores as needed. */
  set(path: StorePath, value: unknown, meta?: StorePatchMeta): void;
};

/** Backwards compatible public store type. */
export type Store<State extends Record<string, unknown>> = DeepStore<State>;

/** Deep partial helper for patch(). */
export type DeepPartial<Value> = Value extends Primitive
  ? Value
  : Value extends readonly unknown[]
    ? Value
    : Value extends Record<string, unknown>
      ? { [Key in keyof Value]?: DeepPartial<Value[Key]> }
      : Value;

/** Internal store marker. */
const STORE_MARKER = Symbol("broto.store");
const STORE_KEYS = new WeakMap<object, Set<string>>();

/**
 * Creates a deep object store from writable signals.
 *
 * @remarks
 * Earlier Broto stores only created one signal per initial top-level key. That
 * was tiny, but it made nested UI state and dynamically added settings awkward.
 * This implementation keeps the same public surface while adding nested stores,
 * dynamic key creation, path-based reads/writes and metadata hooks for devtools.
 * It intentionally avoids Proxy so snapshots are predictable and old browsers
 * stay calm.
 *
 * @param initialState - Initial object state.
 * @returns Store with one signal/store per key.
 *
 * @example Deep state
 * ```ts
 * const state = store({ panel: { open: false }, count: 0 });
 * state.panel.open.set(true);
 * state.set(["panel", "open"], false, { cause: "toggle" });
 * console.log(state.snapshot());
 * // { panel: { open: false }, count: 0 }
 * ```
 */
export function store<State extends Record<string, unknown>>(initialState: State): Store<State> {
  brotoDebugState.stores += 1;
  return createStoreObject(initialState, []) as Store<State>;
}

function createStoreObject(initialState: Record<string, unknown>, basePath: StorePath): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const keys = new Set<string>();

  Object.defineProperty(output, STORE_MARKER, { value: true, enumerable: false });
  STORE_KEYS.set(output, keys);

  for (const key in initialState) {
    keys.add(key);
    output[key] = createStoreValue(initialState[key], appendPath(basePath, key));
  }

  Object.defineProperties(output, {
    snapshot: {
      enumerable: false,
      value() {
        const snapshot: Record<string, unknown> = {};
        for (const key of keys) snapshot[key] = snapshotValue(output[key]);
        return snapshot;
      },
    },
    patch: {
      enumerable: false,
      value(nextState: Record<string, unknown>, meta: StorePatchMeta = {}) {
        if (!isPlainObject(nextState)) return;
        for (const key in nextState) {
          applyStoreKey(output, keys, key, nextState[key], { ...meta, path: appendPath(basePath, key) });
        }
      },
    },
    get: {
      enumerable: false,
      value(path: StorePath) {
        return getStorePath(output, path);
      },
    },
    set: {
      enumerable: false,
      value(path: StorePath, value: unknown, meta: StorePatchMeta = {}) {
        setStorePath(output, keys, path, value, { ...meta, path });
      },
    },
  });

  return output;
}

function createStoreValue(value: unknown, path: StorePath): unknown {
  if (isPlainObject(value)) return createStoreObject(value as Record<string, unknown>, path);
  if (Array.isArray(value)) return createArraySignal(value, path);
  return signal(value);
}

function createArraySignal(value: unknown[], path: StorePath): Signal<unknown[]> & { atSignal(index: number): unknown } {
  const source = signal(value.slice()) as Signal<unknown[]> & { atSignal(index: number): unknown };
  const itemStores = new Map<number, unknown>();

  source.atSignal = (index: number): unknown => {
    const list = source.peek();
    if (index < 0 || index >= list.length) return undefined;
    if (!itemStores.has(index)) itemStores.set(index, createStoreValue(list[index], appendPath(path, index)));
    return itemStores.get(index);
  };

  return source;
}

function applyStoreKey(target: Record<string, unknown>, keys: Set<string>, key: string, value: unknown, meta: StorePatchMeta): void {
  const current = target[key];

  if (!keys.has(key)) {
    keys.add(key);
    target[key] = createStoreValue(value, meta.path ?? [key]);
    return;
  }

  if (isStoreObject(current) && isPlainObject(value)) {
    (current as { patch(nextState: Record<string, unknown>, meta?: StorePatchMeta): void }).patch(value as Record<string, unknown>, meta);
    return;
  }

  if (isSignalLike(current)) {
    (current as Signal<unknown>).set(value);
    return;
  }

  target[key] = createStoreValue(value, meta.path ?? [key]);
}

function getStorePath(root: Record<string, unknown>, path: StorePath): unknown {
  let current: unknown = root;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    if (isStoreObject(current)) current = (current as Record<PropertyKey, unknown>)[key];
    else if (isSignalLike(current)) current = (current as Signal<unknown>).peek();
    else return undefined;
  }
  return current;
}

function setStorePath(root: Record<string, unknown>, keys: Set<string>, path: StorePath, value: unknown, meta: StorePatchMeta): void {
  if (path.length === 0) return;

  let current: Record<string, unknown> = root;
  let currentKeys = keys;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = String(path[index]);
    const next = current[key];
    if (!isStoreObject(next)) {
      currentKeys.add(key);
      current[key] = createStoreObject({}, path.slice(0, index + 1));
    }
    current = current[key] as Record<string, unknown>;
    currentKeys = collectStoreKeys(current);
  }

  applyStoreKey(current, currentKeys, String(path[path.length - 1]), value, meta);
}

function collectStoreKeys(storeObject: Record<string, unknown>): Set<string> {
  let output = STORE_KEYS.get(storeObject);
  if (output) return output;
  output = new Set<string>();
  for (const key in storeObject) output.add(key);
  STORE_KEYS.set(storeObject, output);
  return output;
}

function snapshotValue(value: unknown): unknown {
  if (isStoreObject(value)) return (value as { snapshot(): unknown }).snapshot();
  if (isSignalLike(value)) return (value as Signal<unknown>).peek();
  return value;
}

function appendPath(path: StorePath, key: PropertyKey): StorePath {
  const next = new Array<PropertyKey>(path.length + 1);
  for (let index = 0; index < path.length; index += 1) next[index] = path[index];
  next[path.length] = key;
  return next;
}

function isSignalLike(value: unknown): value is Signal<unknown> {
  return typeof value === "function" && typeof (value as Signal<unknown>).set === "function" && typeof (value as Signal<unknown>).peek === "function";
}

function isStoreObject(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Record<PropertyKey, unknown>)[STORE_MARKER]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
