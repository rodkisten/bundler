import type { Cleanup, ContextToken, Owner, OwnerOptions } from "./types";

let ownerId = 0;
let activeOwner: Owner | null = null;

/**
 * Gets the currently active owner.
 *
 * @remarks
 * Owners are Broto's lifecycle boundaries. Effects, resources and components can
 * register cleanup work against the active owner so disposal is deterministic
 * instead of relying on GC or ad-hoc arrays.
 *
 * @returns The active owner, or null when code is running outside a root.
 *
 * @example
 * ```ts
 * const owner = getOwner();
 * console.log(owner?.name);
 * ```
 */
export function getOwner(): Owner | null {
  return activeOwner;
}

/**
 * Runs a callback with a temporary active owner.
 *
 * @param owner - Owner to activate.
 * @param callback - Work to run inside the owner.
 * @returns Callback result.
 *
 * @example
 * ```ts
 * runWithOwner(owner, () => {
 *   effect(() => console.log(count()));
 * });
 * ```
 */
export function runWithOwner<Value>(owner: Owner | null, callback: () => Value): Value {
  const previousOwner = activeOwner;
  activeOwner = owner;

  try {
    return callback();
  } finally {
    activeOwner = previousOwner;
  }
}

/**
 * Creates an owner under the active owner or an explicit parent.
 *
 * @param options - Owner options.
 * @returns New owner.
 *
 * @example
 * ```ts
 * const owner = createOwner({ name: "Panel" });
 * runWithOwner(owner, () => onOwnerCleanup(() => console.log("disposed")));
 * disposeOwner(owner);
 * ```
 */
export function createOwner(options: OwnerOptions = {}): Owner {
  const parent = options.parent === undefined ? activeOwner : options.parent;
  const owner: Owner = {
    id: options.id ?? `broto-${++ownerId}`,
    name: options.name,
    parent,
    children: new Set<Owner>(),
    cleanups: [],
    context: new Map<ContextToken<unknown>, unknown>(),
    disposed: false,
  };

  if (parent && !parent.disposed) {
    parent.children.add(owner);
  }

  return owner;
}

/**
 * Creates a root owner, runs setup inside it and returns the setup value plus a disposer.
 *
 * @param callback - Root setup callback.
 * @param options - Optional owner metadata.
 * @returns Callback value and dispose callback.
 *
 * @example Component-like root
 * ```ts
 * const [view, dispose] = createRoot(() => html`<p>Hello</p>`, { name: "View" });
 * dispose();
 * ```
 */
export function createRoot<Value>(callback: (dispose: Cleanup, owner: Owner) => Value, options: OwnerOptions = {}): [Value, Cleanup] {
  const owner = createOwner({ ...options, parent: options.parent ?? null });
  const dispose = () => disposeOwner(owner);
  const value = runWithOwner(owner, () => callback(dispose, owner));
  return [value, dispose];
}

/**
 * Registers cleanup in the active owner.
 *
 * @param cleanup - Cleanup callback.
 * @returns The same cleanup for convenient composition.
 *
 * @example
 * ```ts
 * onOwnerCleanup(() => socket.close());
 * ```
 */
export function onOwnerCleanup(cleanup: Cleanup): Cleanup {
  if (typeof cleanup !== "function") {
    return cleanup;
  }

  if (activeOwner && !activeOwner.disposed) {
    activeOwner.cleanups.push(cleanup);
  }

  return cleanup;
}

/**
 * Runs and clears an owner's child graph and cleanup stack without marking it disposed.
 *
 * @remarks
 * Effects use this during re-runs: nested effects/resources created during the
 * previous run must be disposed, but the effect's owner remains reusable.
 *
 * @param owner - Owner to clean.
 * @returns void.
 */
export function cleanupOwner(owner: Owner): void {
  for (const child of Array.from(owner.children)) {
    disposeOwner(child);
  }

  owner.children.clear();

  const cleanups = owner.cleanups.splice(0);
  for (let index = cleanups.length - 1; index >= 0; index -= 1) {
    runCleanup(cleanups[index]);
  }
}

/**
 * Disposes an owner and its full subtree.
 *
 * @param owner - Owner to dispose.
 * @returns void.
 *
 * @example
 * ```ts
 * disposeOwner(owner);
 * ```
 */
export function disposeOwner(owner: Owner): void {
  if (owner.disposed) {
    return;
  }

  cleanupOwner(owner);
  owner.disposed = true;
  owner.parent?.children.delete(owner);
}

/**
 * Creates a context token.
 *
 * @param defaultValue - Optional fallback value.
 * @param description - Debug-friendly name.
 * @returns Context token.
 *
 * @example
 * ```ts
 * const ThemeContext = createContext("dark", "Theme");
 * ```
 */
export function createContext<Value>(defaultValue?: Value, description = "BrotoContext"): ContextToken<Value> {
  return {
    id: Symbol(description),
    description,
    defaultValue,
  };
}

/**
 * Provides a context value in the active owner.
 *
 * @param context - Context token.
 * @param value - Value to provide.
 * @returns Provided value.
 *
 * @example
 * ```ts
 * provide(ThemeContext, "forest");
 * ```
 */
export function provide<Value>(context: ContextToken<Value>, value: Value): Value {
  if (!activeOwner) {
    throw new Error(`[Broto] provide(${context.description}) was called without an active owner.`);
  }

  activeOwner.context.set(context as ContextToken<unknown>, value);
  return value;
}

/**
 * Reads the nearest context value from the owner tree.
 *
 * @param context - Context token.
 * @returns Nearest provided value or token default.
 *
 * @example
 * ```ts
 * const theme = useContext(ThemeContext);
 * ```
 */
export function useContext<Value>(context: ContextToken<Value>): Value {
  let owner = activeOwner;

  while (owner) {
    if (owner.context.has(context as ContextToken<unknown>)) {
      return owner.context.get(context as ContextToken<unknown>) as Value;
    }

    owner = owner.parent;
  }

  return context.defaultValue as Value;
}

/**
 * Returns a serializable owner graph snapshot for devtools/debug panels.
 *
 * @param root - Root owner. Defaults to active owner.
 * @returns Owner graph object.
 *
 * @example
 * ```ts
 * console.log(inspectOwnerGraph());
 * ```
 */
export function inspectOwnerGraph(root: Owner | null = activeOwner): unknown {
  if (!root) {
    return null;
  }

  return {
    id: root.id,
    name: root.name,
    disposed: root.disposed,
    cleanups: root.cleanups.length,
    context: root.context.size,
    children: Array.from(root.children, (child) => inspectOwnerGraph(child)),
  };
}

function runCleanup(cleanup: Cleanup | undefined): void {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}
