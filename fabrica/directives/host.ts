import { readValue } from "../core/value.js";
import { disposeRange, removeRange } from "../render/cleanup.js";
import type { RenderValue } from "../types.js";
import type { RepeatRuntimeHost } from "./repeat.js";

/** Renderer capabilities consumed by directive controllers. */
export interface DirectiveRuntimeHost extends RepeatRuntimeHost {
  mount(container: Node, value: RenderValue): () => void;
}

/** Minimal DOM fallback used when controllers are exercised without a renderer. */
export const DEFAULT_DIRECTIVE_HOST: DirectiveRuntimeHost = {
  appendValue(parentNode, value, beforeNode = null): void {
    appendStandaloneValue(parentNode, value, beforeNode);
  },
  mount(container, value): () => void {
    const start = document.createComment("fabrica:directive-mount:start");
    const end = document.createComment("fabrica:directive-mount:end");
    container.appendChild(start);
    appendStandaloneValue(container, value, null);
    container.appendChild(end);

    return () => {
      disposeRange(start, end);
      removeRange(start, end);
    };
  },
};

function appendStandaloneValue(
  parentNode: Node | null,
  value: RenderValue,
  beforeNode: Node | null,
): void {
  if (!parentNode || value == null || value === false || value === true) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendStandaloneValue(parentNode, item, beforeNode);
    }
    return;
  }

  const resolved = readValue(value) as RenderValue;
  if (resolved instanceof Node) {
    parentNode.insertBefore(resolved, beforeNode);
    return;
  }

  parentNode.insertBefore(
    document.createTextNode(String(resolved ?? "")),
    beforeNode,
  );
}
