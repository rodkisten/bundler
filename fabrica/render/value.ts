import {
  createOwner,
  disposeOwner,
  getOwner,
  runWithOwner,
} from "@rodkisten/broto/owner";
import { effect } from "@rodkisten/broto/reactivity";
import { PART_END, PART_START } from "../core/constants.js";
import {
  getCurrentFabricaRuntime,
  runWithCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "../core/runtime-context.js";
import { hasReactiveValue, readValue } from "../core/value.js";
import { debugState } from "../debug.js";
import { createDirectiveController } from "../directives/runtime.js";
import { connectDelegatedEventRoot } from "../events.js";
import {
  isComponent,
  isComponentRenderRequest,
  isDirective,
  isDomBag,
  isDomNode,
  isRawHtml,
  isSignal,
} from "../guards.js";
import { materializeComponent } from "../component.js";
import type {
  ComponentRenderRequest,
  DirectiveController,
  RenderValue,
} from "../types.js";
import {
  clearRange,
  disposeRange,
  registerCleanup,
  removeRange,
} from "./cleanup.js";
import { activateDeferredFragmentBindings } from "./deferred.js";
import {
  isComponentPayload,
  isElementPayload,
  materializeComponentPayload,
  materializeElementPayload,
} from "./payload.js";

const RAW_HTML_TEMPLATE_CACHE_LIMIT = 128;
const rawHtmlTemplateCache = new Map<string, HTMLTemplateElement>();

const DIRECTIVE_RUNTIME_HOST = {
  appendValue,
  mount: mountOwnedRange,
};

/**
 * Mounts one owned range without clearing existing children.
 *
 * This primitive is shared with directives so the directive runtime does not
 * need to import the root renderer. The range markers are the ownership
 * boundary used for deterministic cleanup.
 */
export function mountOwnedRange(
  container: Node,
  value: RenderValue,
): () => void {
  return runWithCurrentFabricaRuntime(() => {
    const start = document.createComment("fabrica:mount:start");
    const end = document.createComment("fabrica:mount:end");

    container.appendChild(start);
    appendValue(container, value);
    container.appendChild(end);

    return () => {
      disposeRange(start, end);
      removeRange(start, end);
    };
  });
}

/**
 * Appends a render value into a parent, optionally before a reference node.
 *
 * Value classification is intentionally centralized here. Root rendering,
 * child parts, directives, payload adapters, and component output therefore
 * share exactly the same materialization semantics.
 */
export function appendValue(
  parentNode: Node | null,
  value: RenderValue,
  beforeNode: Node | null = null,
): void {
  if (!parentNode) return;

  if (isDirective(value) || isSignal(value)) {
    const marker = document.createComment("fabrica:dynamic");
    parentNode.insertBefore(marker, beforeNode);
    bindChildPart(marker, value);
    return;
  }

  const resolvedValue = readValue(value) as RenderValue;

  if (
    resolvedValue == null ||
    resolvedValue === false ||
    resolvedValue === true
  ) {
    return;
  }

  if (isComponent(resolvedValue)) {
    const componentNode = materializeComponent(
      resolvedValue(),
      appendValue,
    );
    connectDelegatedEventRoot(parentNode, componentNode);
    parentNode.insertBefore(componentNode, beforeNode);
    return;
  }

  if (isComponentRenderRequest(resolvedValue)) {
    const componentNode = materializeComponent(
      resolvedValue as ComponentRenderRequest,
      appendValue,
    );
    connectDelegatedEventRoot(parentNode, componentNode);
    parentNode.insertBefore(componentNode, beforeNode);
    return;
  }

  if (isElementPayload(resolvedValue)) {
    const materialized = materializeElementPayload(
      resolvedValue,
      appendValue,
    );
    appendValue(parentNode, materialized, beforeNode);
    return;
  }

  if (isComponentPayload(resolvedValue)) {
    const materialized = materializeComponentPayload(resolvedValue);
    appendValue(parentNode, materialized as RenderValue, beforeNode);
    return;
  }

  if (isDomBag(resolvedValue)) {
    const elements = resolvedValue.elements;

    for (let index = 0; index < elements.length; index += 1) {
      const element = elements[index] as Node;
      connectDelegatedEventRoot(parentNode, element);
      parentNode.insertBefore(element, beforeNode);
    }

    return;
  }

  if (Array.isArray(resolvedValue)) {
    for (let index = 0; index < resolvedValue.length; index += 1) {
      appendValue(parentNode, resolvedValue[index], beforeNode);
    }

    return;
  }

  if (isRawHtml(resolvedValue)) {
    parentNode.insertBefore(
      cloneRawHtmlContent(resolvedValue.value),
      beforeNode,
    );
    return;
  }

  if (resolvedValue instanceof DocumentFragment) {
    activateDeferredFragmentBindings(resolvedValue);
    connectDelegatedEventRoot(parentNode, resolvedValue);
    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }

  if (isDomNode(resolvedValue)) {
    connectDelegatedEventRoot(parentNode, resolvedValue);
    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }

  parentNode.insertBefore(
    document.createTextNode(String(resolvedValue)),
    beforeNode,
  );
}

/** Binds a child interpolation marker to a static or reactive render value. */
export function bindChildPart(
  marker: Node,
  value: RenderValue | undefined,
): void {
  const runtime = getCurrentFabricaRuntime();
  const part = createChildPart(marker);
  const owner = createOwner({
    parent: getOwner(),
    name: "fabrica.childPart",
  });

  registerCleanup(part.start, () => disposeOwner(owner));

  if (hasReactiveValue(value)) {
    const dispose = runWithOwner(owner, () =>
      effect(
        () => {
          runWithFabricaRuntime(runtime, () => {
            part.set(readValue(value) as RenderValue);
          });
        },
        {
          name: "fabrica.childBinding",
          scheduler: "sync",
        },
      ),
    );

    registerCleanup(part.start, dispose);
    return;
  }

  runWithOwner(owner, () => {
    runWithFabricaRuntime(runtime, () => part.set(value));
  });
}

/**
 * Creates the stable marker range that owns one dynamic child value.
 *
 * A child part retains only the minimum state required for fast updates. DOM
 * nodes and directive controllers are reused when identity permits; all other
 * transitions clear the owned range before inserting the next representation.
 */
export function createChildPart(marker: Node): {
  start: Comment;
  end: Comment;
  set(value: RenderValue | undefined): void;
} {
  const start = document.createComment(PART_START);
  const end = document.createComment(PART_END);
  const parentNode = marker.parentNode;
  const runtime = getCurrentFabricaRuntime();

  let currentType = "empty";
  let currentText = "";
  let textNode: Text | null = null;
  let currentNode: Node | null = null;
  let directiveController: DirectiveController | null = null;

  if (parentNode) {
    parentNode.insertBefore(start, marker);
    parentNode.insertBefore(end, marker);
    parentNode.removeChild(marker);
  }

  const setValue = (value: RenderValue | undefined): void => {
    debugState.updates += 1;
    const resolvedValue = readValue(value) as RenderValue;

    if (isDirective(resolvedValue)) {
      if (
        !directiveController ||
        directiveController.kind !== resolvedValue.kind
      ) {
        directiveController?.dispose();
        clearRange(start, end);
        directiveController = createDirectiveController(
          start,
          end,
          resolvedValue,
          DIRECTIVE_RUNTIME_HOST,
        );
        currentType = `directive:${resolvedValue.kind}`;
        currentText = "";
        textNode = null;
        currentNode = null;
      }

      directiveController.update(resolvedValue);
      return;
    }

    if (directiveController) {
      directiveController.dispose();
      directiveController = null;
    }

    if (
      resolvedValue == null ||
      resolvedValue === false ||
      resolvedValue === true
    ) {
      if (currentType !== "empty") {
        clearRange(start, end);
        currentType = "empty";
        currentText = "";
        textNode = null;
        currentNode = null;
      }

      return;
    }

    if (Array.isArray(resolvedValue)) {
      clearRange(start, end);

      for (let index = 0; index < resolvedValue.length; index += 1) {
        appendValue(end.parentNode, resolvedValue[index], end);
      }

      currentType = "array";
      currentText = "";
      textNode = null;
      currentNode = null;
      return;
    }

    if (isRawHtml(resolvedValue)) {
      if (
        currentType === "raw" &&
        currentText === resolvedValue.value
      ) {
        return;
      }

      clearRange(start, end);
      end.parentNode?.insertBefore(
        cloneRawHtmlContent(resolvedValue.value),
        end,
      );
      currentType = "raw";
      currentText = resolvedValue.value;
      textNode = null;
      currentNode = null;
      return;
    }

    if (
      isComponent(resolvedValue) ||
      isComponentRenderRequest(resolvedValue) ||
      isElementPayload(resolvedValue) ||
      isComponentPayload(resolvedValue) ||
      isDomBag(resolvedValue)
    ) {
      clearRange(start, end);
      appendValue(end.parentNode, resolvedValue, end);
      currentType = "renderable";
      currentText = "";
      textNode = null;
      currentNode = null;
      return;
    }

    if (isDomNode(resolvedValue)) {
      if (
        currentType === "node" &&
        currentNode === resolvedValue
      ) {
        return;
      }

      clearRange(start, end);
      appendValue(end.parentNode, resolvedValue, end);
      currentType = "node";
      currentText = "";
      textNode = null;
      currentNode = resolvedValue;
      return;
    }

    const nextText = String(resolvedValue);

    if (currentType === "text" && textNode) {
      if (currentText !== nextText) {
        textNode.data = nextText;
        currentText = nextText;
      }

      return;
    }

    clearRange(start, end);
    textNode = document.createTextNode(nextText);
    end.parentNode?.insertBefore(textNode, end);
    currentType = "text";
    currentText = nextText;
    currentNode = textNode;
  };

  return {
    start,
    end,
    set(value: RenderValue | undefined): void {
      runWithFabricaRuntime(runtime, () => setValue(value));
    },
  };
}

function cloneRawHtmlContent(value: string): DocumentFragment {
  let template = rawHtmlTemplateCache.get(value);

  if (!template) {
    template = document.createElement("template");
    template.innerHTML = value;

    if (rawHtmlTemplateCache.size >= RAW_HTML_TEMPLATE_CACHE_LIMIT) {
      const firstKey = rawHtmlTemplateCache.keys().next().value as
        | string
        | undefined;
      if (firstKey !== undefined) rawHtmlTemplateCache.delete(firstKey);
    }

    rawHtmlTemplateCache.set(value, template);
  }

  return template.content.cloneNode(true) as DocumentFragment;
}
