import { debug } from "./debug";
import { getOwnerRoots, inspectOwnerGraph } from "./owner";
import { inspectEffects, inspectScheduler, inspectSignals } from "./reactivity";
import type { BrotoRuntimeSnapshot, Owner, OwnerGraphSnapshot } from "./types";

/**
 * Creates a complete runtime snapshot for debug panels and devtools adapters.
 *
 * @remarks
 * This is intentionally read-only and allocation-aware: it snapshots counters,
 * owners, signals, effects and scheduler queues into plain JSON-compatible data
 * without exposing live Sets/Maps. It is safe to call from userscripts, tests and
 * UI inspectors. Existing APIs stay untouched, this is a pure additive surface.
 *
 * @param root - Optional owner root. When omitted, every known root owner is included.
 * @returns Serializable runtime snapshot.
 *
 * @example Inspect every active root
 * ```ts
 * const snapshot = inspectRuntime();
 * console.table(snapshot.signals);
 * ```
 *
 * @example Inspect one component subtree
 * ```ts
 * const snapshot = inspectRuntime(componentOwner);
 * console.log(snapshot.owners[0]?.descendants);
 * ```
 */
export function inspectRuntime(root?: Owner | null): BrotoRuntimeSnapshot {
  const roots: OwnerGraphSnapshot[] = [];

  if (root) {
    const single = inspectOwnerGraph(root);
    if (single) roots[roots.length] = single;
  } else {
    const knownRoots = getOwnerRoots();
    for (let index = 0; index < knownRoots.length; index += 1) {
      const snapshot = inspectOwnerGraph(knownRoots[index]);
      if (snapshot) roots[roots.length] = snapshot;
    }
  }

  return {
    debug: debug(),
    owners: roots,
    signals: inspectSignals(),
    effects: inspectEffects(),
    scheduler: inspectScheduler(),
  };
}

/**
 * Flattens an owner graph into rows that are easy to render in tables.
 *
 * @param graph - Owner graph snapshot.
 * @returns Flat owner rows with depth information.
 *
 * @example
 * ```ts
 * const rows = flattenOwnerGraph(inspectGraph()!);
 * console.table(rows);
 * ```
 */
export function flattenOwnerGraph(graph: OwnerGraphSnapshot | null): Array<Omit<OwnerGraphSnapshot, "children"> & { depth: number; parentId: string | null }> {
  const rows: Array<Omit<OwnerGraphSnapshot, "children"> & { depth: number; parentId: string | null }> = [];
  if (!graph) return rows;
  appendOwnerRows(rows, graph, 0, null);
  return rows;
}

function appendOwnerRows(
  rows: Array<Omit<OwnerGraphSnapshot, "children"> & { depth: number; parentId: string | null }>,
  graph: OwnerGraphSnapshot,
  depth: number,
  parentId: string | null,
): void {
  rows[rows.length] = {
    id: graph.id,
    name: graph.name,
    disposed: graph.disposed,
    cleanups: graph.cleanups,
    context: graph.context,
    errorHandlers: graph.errorHandlers,
    createdAt: graph.createdAt,
    descendants: graph.descendants,
    depth,
    parentId,
  };

  for (let index = 0; index < graph.children.length; index += 1) {
    appendOwnerRows(rows, graph.children[index], depth + 1, graph.id);
  }
}
