import { readValue } from "../core/value.js";
import { debugState } from "../debug.js";
import { connectDelegatedEventRoot } from "../events.js";
import { runWithCurrentFabricaRuntime } from
  "../core/runtime-context.js";
import type { RenderValue } from "../types.js";
import {
  disposeCollectedCleanups,
  disposeRange,
  disposeTree,
  removeRange,
} from "./cleanup.js";
import {
  getHtmlResultMetadata,
  isHtmlResult,
} from "./html-result.js";
import {
  createChildPart,
  mountOwnedRange,
} from "./value.js";

/** Persistent root render parts keyed by container. */
type RootRenderState =
  | {
      kind: "part";
      part: ReturnType<typeof createChildPart>;
      dispose: () => void;
    }
  | {
      kind: "direct";
      dispose: () => void;
      cleanupNodes: Node[];
      dynamic: boolean;
    };

const renderStates = new WeakMap<Node, RootRenderState>();

/**
 * Replaces a container's content and returns a deterministic dispose function.
 *
 * Fresh materialized HTML results use a direct mount fast path. Repeated or
 * generic renders use a stable child part so updates retain a single ownership
 * boundary rather than replacing the entire container on every call.
 */
export function render(
  container: Element | DocumentFragment | ShadowRoot,
  value: RenderValue,
): () => void {
  return runWithCurrentFabricaRuntime(() => {
    const resolvedValue = readValue(value) as RenderValue;
    let state = renderStates.get(container);

    if (
      (!state || state.kind === "direct") &&
      isHtmlResult(resolvedValue)
    ) {
      state?.dispose();

      const metadata = getHtmlResultMetadata(resolvedValue);
      const cleanupNodes = metadata?.cleanupNodes ?? [];
      const dynamic = Boolean(
        metadata?.dynamic || cleanupNodes.length > 0,
      );

      connectDelegatedEventRoot(container, resolvedValue);
      container.replaceChildren(resolvedValue);
      debugState.reconciliations += 1;

      if (state?.kind === "direct") {
        state.cleanupNodes = cleanupNodes;
        state.dynamic = dynamic;
        renderStates.set(container, state);
        return state.dispose;
      }

      const directState: Extract<
        RootRenderState,
        { kind: "direct" }
      > = {
        kind: "direct",
        cleanupNodes,
        dynamic,
        dispose: () => {
          if (directState.cleanupNodes.length > 0) {
            disposeCollectedCleanups(
              directState.cleanupNodes,
            );
          } else if (directState.dynamic) {
            disposeTree(container);
          }

          container.replaceChildren();
          renderStates.delete(container);
        },
      };

      renderStates.set(container, directState);
      return directState.dispose;
    }

    if (!state || state.kind === "direct") {
      state?.dispose();
      disposeTree(container);
      container.replaceChildren();

      const marker = document.createComment("fabrica:render");
      container.appendChild(marker);

      const part = createChildPart(marker);
      const dispose = (): void => {
        disposeRange(part.start, part.end);
        removeRange(part.start, part.end);
        renderStates.delete(container);
      };

      state = { kind: "part", part, dispose };
      renderStates.set(container, state);
    }

    debugState.reconciliations += 1;
    state.part.set(resolvedValue);
    return state.dispose;
  });
}

/**
 * Mounts a new owned range after existing children without clearing them.
 *
 * This API intentionally does not claim SSR hydration. Fábrica has no server
 * marker protocol capable of attaching part bindings to arbitrary pre-rendered
 * nodes while preserving node identity. The former `hydrate()` name described
 * append-mount behavior and was removed from the public contract.
 */
export function mountPreservingChildren(
  container: Element | DocumentFragment | ShadowRoot,
  value: RenderValue,
): () => void {
  return mountOwnedRange(container, value);
}

/** Mounts content in a new owned range without clearing the container. */
export function mount(
  container: Node,
  value: RenderValue,
): () => void {
  return mountOwnedRange(container, value);
}
