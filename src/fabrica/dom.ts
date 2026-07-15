import { PART_END, PART_START } from "./constants";
import { FABRICA_HTML_ARTIFACT } from "./types";
import { debugState } from "./debug";
import {
  clearRange,
  collectCleanupNodes,
  disposeCollectedCleanups,
  disposeRange,
  disposeTree,
  moveRangeBefore,
  registerCleanup,
  removeRange,
} from "./dom-cleanup";
import { bindEvent } from "./events";
import { bindModelPart, createDirectiveController } from "./dom-directives";
import { bindSpreadPart } from "./dom-spread";
import { bindSpecialAttribute, toDataAttributeName } from "./dom-special-attributes";
import {
  isClassMapDirective,
  isComponent,
  isComponentRenderRequest,
  isDirective,
  isDomBag,
  isDomElement,
  isDomNode,
  isRawHtml,
  isRefDirective,
  isSignal,
  isStyleMapDirective,
} from "./guards";
import { applyClassMap, applyStyleMap } from "./maps";
import { setPropertyOrAttribute } from "./props";
import {
  isComponentPayload,
  isElementPayload,
  materializeComponentPayload,
  materializeElementPayload,
  invokeComponentLike,
  stringifyAttributeValue,
} from "./dom-payload";
import { batch, effect, signal } from "../broto/reactivity";
import {
  createOwner,
  disposeOwner,
  getOwner,
  runWithOwner,
} from "../broto/owner";
import {
  compileParts,
  getCompiledJsxTemplate,
  getCompiledTemplate,
  resolvePath,
} from "./template";
import { hasReactiveValue, readValue } from "./value";
import { materializeComponent } from "./component";
import {
  getCurrentFabricaRuntime,
  runWithCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "./runtime-context";
import type {
  Cleanup,
  ComponentPayload,
  ComponentPropPart,
  ComponentRenderRequest,
  Directive,
  ElementPayload,
  DirectiveController,
  RefCallback,
  RenderValue,
  RepeatDirective,
  RepeatRecord,
  TemplatePart,
  PortalDirective,
  SuspenseDirective,
  BindDirective,
  EventOptionsDirective,
  FabricaRuntimeContext,
  HtmlArtifact,
  HtmlResult,
  HtmlTag,
  HtmlTemplateTag,
  KeyedDirective,
  VirtualRepeatDirective,
  WhenDirective,
} from "./types";

/** Persistent root render parts keyed by container. */
type RootRenderState =
  | { kind: "part"; part: ReturnType<typeof createChildPart>; dispose: () => void }
  | { kind: "direct"; dispose: () => void; cleanupNodes: Node[]; dynamic: boolean };

const renderStates = new WeakMap<Node, RootRenderState>();

type MaterializedHtmlResultMetadata = {
  cleanupNodes: Node[];
  dynamic: boolean;
};

const materializedHtmlResultMetadata = new WeakMap<Node, MaterializedHtmlResultMetadata>();

const RAW_HTML_TEMPLATE_CACHE_LIMIT = 128;
const rawHtmlTemplateCache = new Map<string, HTMLTemplateElement>();

/**
 * Defers nested child bindings until a component appends its children.
 * The public component contract remains a real DocumentFragment.
 */
type DeferredComponentChildren = {
  readonly parts: readonly TemplatePart[];
  readonly values: readonly RenderValue[];
  readonly hasComponents: boolean;
  readonly runtime: FabricaRuntimeContext;
};

const deferredComponentChildren = new WeakMap<DocumentFragment, DeferredComponentChildren>();

type DynamicComponentPropPart = ComponentPropPart;

function isDynamicComponentSpreadPropPart(part: DynamicComponentPropPart): part is Extract<ComponentPropPart, { spread: true }> {
  return "spread" in part && part.spread === true;
}

/** Returns the template artifact attached to a Fábrica HTML result. */
export function getHtmlArtifact(value: unknown): HtmlArtifact | undefined {
  if (!isDomNode(value)) return undefined;

  return (value as Node & {
    readonly [FABRICA_HTML_ARTIFACT]?: HtmlArtifact;
  })[FABRICA_HTML_ARTIFACT];
}

/** Checks whether a value is a real DOM node materialized by a Fábrica HTML tag. */
export function isHtmlResult(value: unknown): value is HtmlResult {
  return getHtmlArtifact(value)?.kind === "fabrica.html";
}

/** Internal metadata used by the direct root-render fast path. */
export function getHtmlResultMetadata(
  value: unknown,
): MaterializedHtmlResultMetadata | undefined {
  return isDomNode(value) ? materializedHtmlResultMetadata.get(value) : undefined;
}

/**
 * Converts a materialized fragment into the public polymorphic HTML result.
 *
 * A single meaningful root is returned as the real root node. Root-level
 * indentation whitespace is discarded only in that single-root case. Empty or
 * multi-root templates remain a `DocumentFragment`.
 */
export function createHtmlResult(
  fragment: DocumentFragment,
  artifact: HtmlArtifact,
  metadata: MaterializedHtmlResultMetadata,
): HtmlResult {
  const result = extractHtmlResultRoot(fragment);

  Object.defineProperty(result, FABRICA_HTML_ARTIFACT, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: artifact,
  });

  materializedHtmlResultMetadata.set(result, metadata);
  return result as HtmlResult;
}

function extractHtmlResultRoot(fragment: DocumentFragment): Node {
  const childNodes = Array.from(fragment.childNodes);
  if (childNodes.length === 1) return fragment.removeChild(childNodes[0]!);

  const meaningfulNodes = childNodes.filter((node) =>
    node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim()),
  );

  if (meaningfulNodes.length !== 1) return fragment;

  const root = meaningfulNodes[0]!;
  for (const node of childNodes) {
    if (node !== root && node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
      fragment.removeChild(node);
    }
  }

  return fragment.removeChild(root);
}


/**
 * Removes indentation-only text nodes while preserving HTML's inline spacing semantics.
 *
 * Whitespace between two concrete elements is formatting indentation and can be
 * removed. Whitespace touching a Fábrica part marker is normalized to one space,
 * because it separates interpolated primitive values just like native HTML parsing.
 */
export function pruneInsignificantWhitespace(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const removals: Text[] = [];
  const normalizations: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    const text = current as Text;
    const parent = text.parentNode;
    const parentElement = parent instanceof Element ? parent : null;
    const value = text.data;

    if (
      parent
      && (!parentElement || !/^(PRE|TEXTAREA|SCRIPT|STYLE)$/.test(parentElement.tagName))
      && /^[\t\r\n ]+$/.test(value)
      && /[\t\r\n]/.test(value)
    ) {
      const previous = text.previousSibling;
      const next = text.nextSibling;
      const touchesDynamicPart =
        previous?.nodeType === Node.COMMENT_NODE
        || next?.nodeType === Node.COMMENT_NODE;

      if (touchesDynamicPart && !(parent instanceof DocumentFragment)) {
        normalizations.push(text);
      } else {
        removals.push(text);
      }
    }

    current = walker.nextNode();
  }

  for (const text of normalizations) text.data = " ";
  for (const text of removals) text.remove();
}

function createTemplateArtifact(
  strings: TemplateStringsArray,
  values: readonly RenderValue[],
  jsxMode: boolean,
  runtime: FabricaRuntimeContext,
): HtmlArtifact {
  const exposedStrings = Object.freeze(Array.from(strings));
  const capturedValues = Object.freeze(Array.from(values)) as readonly RenderValue[];

  return Object.freeze({
    kind: "fabrica.html" as const,
    strings: exposedStrings,
    values: capturedValues,
    jsx: jsxMode,
    materialize: () =>
      runWithFabricaRuntime(runtime, () =>
        materializeHtmlTemplate(strings, capturedValues, jsxMode, runtime),
      ),
  });
}

function materializeHtmlTemplate(
  strings: TemplateStringsArray,
  values: readonly RenderValue[],
  jsxMode: boolean,
  runtime: FabricaRuntimeContext,
): HtmlResult {
  const compiled = jsxMode
    ? getCompiledJsxTemplate(strings, values)
    : getCompiledTemplate(strings, values);
  const fragment = compiled.template.content.cloneNode(true) as DocumentFragment;

  let cleanupNodes: Node[] = [];
  if (compiled.orderedParts.length > 0) {
    const collected = collectCleanupNodes(() => {
      applyParts(fragment, compiled.orderedParts, values, compiled.hasComponents);
    });
    cleanupNodes = collected.nodes;
  }

  pruneInsignificantWhitespace(fragment);

  return createHtmlResult(
    fragment,
    createTemplateArtifact(strings, values, jsxMode, runtime),
    {
      cleanupNodes,
      dynamic: compiled.orderedParts.length > 0 || cleanupNodes.length > 0,
    },
  );
}

const htmlTemplateTag: HtmlTemplateTag = (
  strings: TemplateStringsArray,
  ...values: RenderValue[]
): HtmlResult =>
  runWithCurrentFabricaRuntime(() => {
    const runtime = getCurrentFabricaRuntime();
    return materializeHtmlTemplate(strings, values, false, runtime);
  });

const jsxHtmlTemplateTag: HtmlTemplateTag = (
  strings: TemplateStringsArray,
  ...values: RenderValue[]
): HtmlResult =>
  runWithCurrentFabricaRuntime(() => {
    const runtime = getCurrentFabricaRuntime();
    return materializeHtmlTemplate(strings, values, true, runtime);
  });

/**
 * Creates DOM from a tagged template.
 *
 * A template with one meaningful root returns that real root node. Empty and
 * multi-root templates return a `DocumentFragment`. Every result carries a
 * non-enumerable artifact that can materialize a fresh DOM instance.
 */
export const html: HtmlTag = Object.assign(htmlTemplateTag, {
  jsx: jsxHtmlTemplateTag,
  artifact: getHtmlArtifact,
  isResult: isHtmlResult,
});

/** JSX-friendly namespace for `jsx.html` authoring. */
export const jsx = Object.freeze({
  html: jsxHtmlTemplateTag,
});

/**
 * Replaces a container content and returns a dispose function.
 *
 * @param container - Target container.
 * @param value - Render value.
 * @returns Dispose callback.
 *
 * @example
 * ```ts
 * const dispose = render(document.body, html`<h1>Hello</h1>`);
 * dispose();
 * ```
 */
export function render(
  container: Element | DocumentFragment | ShadowRoot,
  value: RenderValue,
): () => void {
  return runWithCurrentFabricaRuntime(() => {
    const resolvedValue = readValue(value) as RenderValue;
    let state = renderStates.get(container);

    /**
     * Runtime v2 fast root path.
     *
     * `html``...`` already returns a fully materialized `HtmlResult` whose
     * compiled parts, reactive effects and event listeners were installed while
     * the template was cloned. For the common root-render shape
     * `render(host, html`...`)`, routing that fragment through a generic
     * ChildPart adds two comment markers, a range clear and another render-value
     * classification pass. Fresh containers can mount the fragment directly and
     * still dispose correctly through `disposeTree(container)`.
     *
     * Existing containers keep the stable ChildPart path so repeated renders,
     * directives and non-template values preserve the old reconciliation API.
     */
    if ((!state || state.kind === "direct") && isHtmlResult(resolvedValue)) {
      state?.dispose();

      const metadata = getHtmlResultMetadata(resolvedValue);
      const cleanupNodes = metadata?.cleanupNodes ?? [];
      const dynamic = Boolean(metadata?.dynamic || cleanupNodes.length > 0);

      /**
       * For freshly materialized html fragments, the compiler has already
       * collected every node that owns a cleanup. Static fragments have no
       * registered effects/listeners at all, so direct render can skip the
       * expensive disposeTree(container) walk entirely. Dynamic fragments
       * dispose the collected nodes only, preserving listener/effect cleanup
       * without traversing unrelated static markup.
       */
      container.replaceChildren(resolvedValue);
      debugState.reconciliations += 1;

      if (state?.kind === "direct") {
        state.cleanupNodes = cleanupNodes;
        state.dynamic = dynamic;
        renderStates.set(container, state);
        return state.dispose;
      }

      const directState: Extract<RootRenderState, { kind: "direct" }> = {
        kind: "direct",
        cleanupNodes,
        dynamic,
        dispose: () => {
          if (directState.cleanupNodes.length > 0) {
            disposeCollectedCleanups(directState.cleanupNodes);
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
 * Hydrates an existing container by attaching Fabrica ownership.
 *
 * @remarks
 * This conservative hydration path preserves existing DOM until the first
 * reactive update. It is intentionally safe for progressively enhanced islands:
 * callers can render server markup, then call hydrate with the equivalent view
 * to install event listeners and range cleanup without a forced empty pass.
 *
 * @param container - Target container.
 * @param value - Render value.
 * @returns Dispose callback.
 */
export function hydrate(
  container: Element | DocumentFragment | ShadowRoot,
  value: RenderValue,
): () => void {
  return runWithCurrentFabricaRuntime(() => {
    if (!container.firstChild) return render(container, value);
    return mount(container, value);
  });
}

/**
 * Mounts content without clearing the container.
 *
 * @param container - Target container.
 * @param value - Render value.
 * @returns Dispose callback.
 */
export function mount(container: Node, value: RenderValue): () => void {
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
 * @param parentNode - Parent node.
 * @param value - Render value.
 * @param beforeNode - Optional insertion reference.
 */
export function appendValue(
  parentNode: Node | null,
  value: RenderValue,
  beforeNode: Node | null = null,
): void {
  if (!parentNode) {
    return;
  }

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
    parentNode.insertBefore(
      materializeComponent(resolvedValue()),
      beforeNode,
    );
    return;
  }

  if (isComponentRenderRequest(resolvedValue)) {
    parentNode.insertBefore(
      materializeComponent(resolvedValue as ComponentRenderRequest),
      beforeNode,
    );
    return;
  }

  if (isElementPayload(resolvedValue)) {
    appendValue(parentNode, materializeElementPayload(resolvedValue, appendValue), beforeNode);
    return;
  }

  if (isComponentPayload(resolvedValue)) {
    appendValue(parentNode, materializeComponentPayload(resolvedValue) as RenderValue, beforeNode);
    return;
  }

  if (isDomBag(resolvedValue)) {
    const elements = resolvedValue.elements;

    for (let index = 0; index < elements.length; index += 1) {
      parentNode.insertBefore(elements[index] as Node, beforeNode);
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
    parentNode.insertBefore(cloneRawHtmlContent(resolvedValue.value), beforeNode);
    return;
  }

  if (resolvedValue instanceof DocumentFragment) {
    const deferred = deferredComponentChildren.get(resolvedValue);

    if (deferred) {
      deferredComponentChildren.delete(resolvedValue);
      runWithFabricaRuntime(deferred.runtime, () => {
        applyParts(resolvedValue, deferred.parts, deferred.values, deferred.hasComponents);
        pruneInsignificantWhitespace(resolvedValue);
      });
    }

    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }

  if (isDomNode(resolvedValue)) {
    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }

  parentNode.insertBefore(
    document.createTextNode(String(resolvedValue)),
    beforeNode,
  );
}

function cloneRawHtmlContent(value: string): DocumentFragment {
  let template = rawHtmlTemplateCache.get(value);

  if (!template) {
    template = document.createElement("template");
    template.innerHTML = value;

    if (rawHtmlTemplateCache.size >= RAW_HTML_TEMPLATE_CACHE_LIMIT) {
      const firstKey = rawHtmlTemplateCache.keys().next().value as string | undefined;
      if (firstKey !== undefined) rawHtmlTemplateCache.delete(firstKey);
    }

    rawHtmlTemplateCache.set(value, template);
  }

  return template.content.cloneNode(true) as DocumentFragment;
}

/**
 * Applies compiled parts to a cloned fragment.
 *
 * @param fragment - Cloned fragment.
 * @param parts - Compiled parts.
 * @param values - Runtime values.
 */
function applyParts(
  fragment: DocumentFragment,
  parts: readonly TemplatePart[],
  values: readonly RenderValue[],
  _hasComponents = false,
): void {
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;

    if ((part.type === "attribute" || part.type === "spread") && part.componentProp) {
      continue;
    }

    const node = resolvePath(fragment, part.path);
    if (!node) continue;

    if (part.type === "child") {
      bindChildPart(node, values[part.index]);
    } else if (part.type === "attribute") {
      bindAttributePart(node, part.name, createAttributeBindingValue(part, values));
    } else if (part.type === "spread") {
      bindSpreadPart(node, values[part.index]);
    } else {
      bindComponentPart(
        node,
        part.index >= 0 ? values[part.index] : undefined,
        values,
        part,
        part.dynamicPropParts ?? [],
      );
    }
  }
}

/**
 * Binds a child interpolation marker.
 *
 * @param marker - Marker node.
 * @param value - Runtime value.
 */
function bindChildPart(marker: Node, value: RenderValue | undefined): void {
  const runtime = getCurrentFabricaRuntime();
  const part = createChildPart(marker);
  const owner = createOwner({ parent: getOwner(), name: "fabrica.childPart" });

  registerCleanup(part.start, () => disposeOwner(owner));

  if (hasReactiveValue(value)) {
    const dispose = runWithOwner(owner, () =>
      effect(
        () => {
          runWithFabricaRuntime(runtime, () => {
            part.set(readValue(value) as RenderValue);
          });
        },
        { name: "fabrica.childBinding", scheduler: "sync" },
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
 * Binds a component placeholder created by `<${Component}>...</${Component}>`.
 *
 * @param node - Template placeholder node.
 * @param value - Component function from the opening interpolation.
 * @param values - All template values for dynamic children inside the component body.
 */
function bindComponentPart(
  node: Node,
  value: RenderValue | undefined,
  values: readonly RenderValue[],
  part?: Extract<TemplatePart, { type: "component" }>,
  dynamicPropParts: DynamicComponentPropPart[] = [],
): void {
  if (!(node instanceof HTMLTemplateElement)) {
    return;
  }

  const runtime = getCurrentFabricaRuntime();
  const componentName = part?.name || readComponentName(node);
  const componentValue = typeof value === "function"
    ? value
    : componentName
      ? runtime.registry.resolve(componentName)
      : undefined;
  const marker = document.createComment(componentName ? `fabrica:component-tag:${componentName}` : "fabrica:component-tag");

  node.parentNode?.insertBefore(marker, node);
  node.remove();

  const childPart = createChildPart(marker);

  if (typeof componentValue !== "function") {
    childPart.set(createMissingComponentFallback(componentName || "unknown") as RenderValue);
    return;
  }

  const owner = createOwner({ parent: getOwner(), name: `fabrica.componentTag:${componentName || "anonymous"}` });
  registerCleanup(childPart.start, () => disposeOwner(owner));

  const renderComponent = (): void => {
    runWithFabricaRuntime(runtime, () => {
      const staticProps = part?.staticProps;
      const dynamicProps = dynamicPropParts.length > 0
        ? readDynamicComponentProps(dynamicPropParts, values, componentValue)
        : null;
      const hasCompiledChildren = Boolean(part?.hasStaticChildren || (part?.orderedChildParts?.length ?? 0) > 0);
      const props = dynamicProps
        ? { ...(staticProps ?? null), ...dynamicProps }
        : hasCompiledChildren
          ? staticProps
            ? { ...staticProps }
            : {}
          : staticProps ?? {};
      const hasMeaningfulChildren = hasCompiledChildren
        && hasPotentialComponentChildren(part, values, node.content);

      /**
       * Keep the historical DocumentFragment children contract while delaying
       * nested part binding until the fragment is appended under this owner.
       */
      let children: DocumentFragment | null = null;

      if (hasMeaningfulChildren) {
        children = node.content.cloneNode(true) as DocumentFragment;
        const childParts = part?.orderedChildParts ?? compileParts(children);

        deferredComponentChildren.set(children, {
          parts: childParts,
          values,
          hasComponents: part?.hasChildComponents
            ?? childParts.some((childPart) => childPart.type === "component"),
          runtime,
        });
      }

      const output = callComponentLike(
        componentValue,
        children ? { ...props, children } : props,
      );

      childPart.set(output as RenderValue);
    });
  };

  if (hasReactiveComponentInputs(dynamicPropParts, values)) {
    const dispose = runWithOwner(owner, () =>
      effect(renderComponent, { name: `fabrica.componentTagBinding:${componentName || "anonymous"}`, scheduler: "sync" }),
    );
    registerCleanup(childPart.start, dispose);
    return;
  }

  runWithOwner(owner, renderComponent);
}


/**
 * Checks whether dynamic component props or spreads contain reactive values.
 *
 * @remarks
 * Component tags such as `<${Button} tone=${tone}>` must re-run the component
 * factory when `tone` changes. Plain DOM parts already handle reactivity at the
 * attribute/child level; component tags need this small bridge because their
 * props are gathered before invoking an arbitrary component or styled factory.
 *
 * @param propParts - Dynamic prop descriptors.
 * @param values - Template values.
 * @returns Whether the component invocation should be owned by an effect.
 */
function hasReactiveComponentInputs(
  propParts: readonly DynamicComponentPropPart[],
  values: readonly RenderValue[],
): boolean {
  for (let index = 0; index < propParts.length; index += 1) {
    const part = propParts[index];
    if (!part) continue;

    const value = values[part.index];
    if (hasReactiveValue(value)) return true;

    if (isDynamicComponentSpreadPropPart(part)) {
      if (hasReactiveRecordValue(value)) return true;
      continue;
    }

    if (normalizeComponentPropName(part.name) === "props" && hasReactiveRecordValue(value)) {
      return true;
    }

    for (let valueIndex = 0; valueIndex < part.indices.length; valueIndex += 1) {
      if (hasReactiveValue(values[part.indices[valueIndex]!] as unknown)) return true;
    }
  }

  return false;
}

/**
 * Checks a plain object for reactive values without importing adapter code.
 *
 * @param value - Possible object.
 * @returns Whether at least one own property is reactive.
 */
function hasReactiveRecordValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (hasReactiveValue(record[key])) return true;
  }

  return false;
}

function hasMeaningfulComponentChildren(fragment: DocumentFragment): boolean {
  const children = fragment.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child) continue;
    if (child.nodeType === Node.ELEMENT_NODE) return true;
    if (child.nodeType === Node.TEXT_NODE && (child.nodeValue ?? "").trim()) return true;
  }

  return false;
}

/** Detects dynamic children without eagerly materializing nested components. */
function hasPotentialComponentChildren(
  part: Extract<TemplatePart, { type: "component" }> | undefined,
  values: readonly RenderValue[],
  template: DocumentFragment,
): boolean {
  if (part?.hasStaticChildren || hasMeaningfulComponentChildren(template)) return true;

  const childParts = part?.orderedChildParts ?? [];
  for (let index = 0; index < childParts.length; index += 1) {
    const childPart = childParts[index];
    if (!childPart) continue;
    if (childPart.type === "component") return true;
    if (childPart.type !== "child") continue;
    if (hasMeaningfulRenderValue(values[childPart.index])) return true;
  }

  return false;
}

function hasMeaningfulRenderValue(value: RenderValue | undefined): boolean {
  if (isDirective(value) || isSignal(value)) return true;

  const resolved = readValue(value) as RenderValue;
  if (resolved == null || resolved === false || resolved === true) return false;
  if (Array.isArray(resolved)) return resolved.some((item) => hasMeaningfulRenderValue(item));
  if (typeof resolved === "string") return resolved.trim().length > 0;
  if (resolved instanceof DocumentFragment) return hasMeaningfulComponentChildren(resolved);
  return true;
}

function callComponentLike(componentValue: unknown, props: Record<string, unknown>): unknown {
  return invokeComponentLike(componentValue, props);
}

function readComponentName(template: HTMLTemplateElement): string {
  return (
    template.getAttribute("data-fabrica-component-name") ||
    template.getAttribute("name") ||
    ""
  );
}

function createMissingComponentFallback(name: string): HTMLElement {
  const element = document.createElement("fabrica-component-error");
  element.setAttribute("role", "alert");
  element.setAttribute("data-fabrica-error", "missing-component");
  element.setAttribute("data-component", name);
  element.style.cssText = [
    "display:inline-block",
    "padding:6px 8px",
    "border:1px solid #f87171",
    "border-radius:8px",
    "background:#450a0a",
    "color:#fecaca",
    "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace",
  ].join(";");
  element.textContent = `[Fabrica] Missing component: ${name}`;
  return element;
}

function readDynamicComponentProps(
  propParts: readonly DynamicComponentPropPart[],
  values: readonly RenderValue[],
  componentValue?: unknown,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (let index = 0; index < propParts.length; index += 1) {
    const prop = propParts[index];

    if (!prop) {
      continue;
    }

    if (isDynamicComponentSpreadPropPart(prop)) {
      mergeSpreadProps(props, readValue(values[prop.index]) as unknown);
      continue;
    }

    const name = normalizeComponentPropName(prop.name);
    const value = readComponentPropValue(prop, values, componentValue, name);
    if (name === "props") {
      mergeSpreadProps(props, readValue(value));
    } else if (name === ":data") {
      mergeComponentDataProps(props, readValue(value));
    } else {
      props[name] = value;
    }
  }

  return props;
}

function readComponentPropValue(
  part: Extract<ComponentPropPart, { spread?: false }>,
  values: readonly RenderValue[],
  componentValue: unknown,
  propName: string,
): unknown {
  if (part.raw) {
    const value = values[part.index];
    const preservedProps = (componentValue as { preserveSignalProps?: ReadonlySet<string> } | null)?.preserveSignalProps;

    // Component props normally receive the current signal value. Components
    // that intentionally transport signals, such as Context.Provider, opt in
    // per prop so callbacks and ordinary object identity remain untouched.
    if (isSignal(value) && !preservedProps?.has(propName)) return value();
    return value;
  }

  return composeAttributeValue(part.indices, part.strings, values);
}

function createAttributeBindingValue(
  part: Extract<TemplatePart, { type: "attribute" }>,
  values: readonly RenderValue[],
): RenderValue | undefined {
  if (part.raw) return values[part.index];

  for (let index = 0; index < part.indices.length; index += 1) {
    if (hasReactiveValue(values[part.indices[index]!] as unknown)) {
      return (() => composeAttributeValue(part.indices, part.strings, values)) as RenderValue;
    }
  }

  return composeAttributeValue(part.indices, part.strings, values);
}

function composeAttributeValue(
  indices: readonly number[],
  strings: readonly string[],
  values: readonly RenderValue[],
): string {
  let output = strings[0] ?? "";

  for (let index = 0; index < indices.length; index += 1) {
    output += stringifyAttributeSegment(readValue(values[indices[index]!]));
    output += strings[index + 1] ?? "";
  }

  return output;
}

function stringifyAttributeSegment(value: unknown): string {
  if (value == null || value === false) return "";
  if (value === true) return "true";
  if (isDomNode(value)) return value.textContent ?? "";
  return String(value);
}

function normalizeStaticComponentPropName(name: string): string {
  if (name === "classname") return "className";
  if (name === "htmlfor") return "htmlFor";
  if (name === "tabindex") return "tabIndex";
  if (name === "readonly") return "readOnly";
  if (name.startsWith(":")) return toDataAttributeName(name.slice(1));
  return name;
}

function normalizeComponentPropName(name: string): string {
  if (name.startsWith("@")) return eventAttributeToPropName(name.slice(1));
  if (name.startsWith(".")) return name.slice(1);
  if (name.startsWith("?")) return name.slice(1);
  if (name === ":data") return name;
  if (name.startsWith(":")) return toDataAttributeName(name.slice(1));
  return name;
}

function mergeComponentDataProps(target: Record<string, unknown>, value: unknown): void {
  if (!value || typeof value !== "object") return;
  const source = value as Record<string, unknown>;
  for (const key in source) {
    const literal = key.startsWith(":");
    const rawName = literal ? `"${key.slice(1)}"` : key;
    target[toDataAttributeName(rawName)] = source[key];
  }
}

function eventAttributeToPropName(rawName: string): string {
  const dotIndex = rawName.indexOf(".");
  const eventName = dotIndex < 0 ? rawName : rawName.slice(0, dotIndex);
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
}

function mergeSpreadProps(target: Record<string, unknown>, value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const source = value as Record<string, unknown>;

  for (const key in source) {
    const item = source[key];
    target[normalizeComponentPropName(key)] = item;
  }
}

/**
 * Reads static attributes from a component placeholder.
 *
 * @param template - Component placeholder template.
 * @returns Props object.
 */
function readStaticComponentProps(
  template: HTMLTemplateElement,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (let index = 0; index < template.attributes.length; index += 1) {
    const attribute = template.attributes[index];

    if (
      !attribute ||
      attribute.name === "data-fabrica-component" ||
      attribute.name === "data-fabrica-component-name" ||
      attribute.name === "data-fabrica-explicit-component" ||
      attribute.name === "name"
    ) {
      continue;
    }

    props[normalizeStaticComponentPropName(attribute.name)] = attribute.value;
  }

  return props;
}

/**
 * Creates a stable dynamic child part.
 *
 * @param marker - Template marker node.
 * @returns Child part controller.
 */
function createChildPart(marker: Node): {
  start: Comment;
  end: Comment;
  set(value: RenderValue | undefined): void;
} {
  const start = document.createComment(PART_START);
  const end = document.createComment(PART_END);
  const parentNode = marker.parentNode;

  let currentType = "empty";
  let currentText = "";
  let textNode: Text | null = null;
  let currentNode: Node | null = null;
  let directiveController: DirectiveController | null = null;
  const runtime = getCurrentFabricaRuntime();

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
        if (currentType === "raw" && currentText === resolvedValue.value) {
          return;
        }

        clearRange(start, end);
        end.parentNode?.insertBefore(cloneRawHtmlContent(resolvedValue.value), end);
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
        if (currentType === "node" && currentNode === resolvedValue) {
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

/**
 * Binds an attribute interpolation.
 *
 * @param node - Target node.
 * @param rawName - Raw attribute name.
 * @param value - Runtime value.
 */
function bindAttributePart(
  node: Node,
  rawName: string,
  value: RenderValue | undefined,
): void {
  if (!isDomElement(node)) {
    return;
  }

  if (isDirective(value) && value.kind === "bind") {
    bindModelPart(node, rawName, value as unknown as BindDirective);
    return;
  }

  if (rawName === "ref") {
    const refValue = isRefDirective(value) ? value.callback : value;

    if (typeof refValue === "function") {
      const cleanup = (refValue as RefCallback<Element>)(node);
      if (typeof cleanup === "function") registerCleanup(node, cleanup as Cleanup);
      return;
    }

    if (refValue && typeof refValue === "object" && "current" in refValue) {
      const objectRef = refValue as { current: Element | null };
      objectRef.current = node;
      registerCleanup(node, () => {
        if (objectRef.current === node) objectRef.current = null;
      });
      return;
    }
  }

  if (bindSpecialAttribute(node, rawName, value)) {
    return;
  }

  if (rawName.startsWith("@")) {
    bindEvent(node, rawName.slice(1), value as RenderValue);
    return;
  }

  if (rawName.startsWith(".")) {
    bindPropertyPart(node, rawName.slice(1), value);
    return;
  }

  if (rawName.startsWith("?")) {
    bindBooleanAttributePart(node, rawName.slice(1), value);
    return;
  }

  if (rawName.startsWith("class:")) {
    bindConditionalClassPart(node, rawName.slice("class:".length), value);
    return;
  }

  bindPlainAttributePart(node, rawName, value);
}

function bindPlainAttributePart(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  /**
   * Static attribute fast path.
   *
   * Most benchmark and docs templates bind plain strings/numbers. Creating an
   * update closure, a previous-value sentinel and then immediately executing it
   * costs more than the DOM write itself for simple attributes. Reactive values
   * still use the old closure/effect path below.
   */
  if (!hasReactiveValue(value)) {
    applyPlainAttributeValue(element, name, readValue(value));
    return;
  }

  let previous: unknown = Symbol("initial");
  let mapState:
    | ReturnType<typeof applyClassMap>
    | ReturnType<typeof applyStyleMap>
    | null = null;

  const update = (): void => {
    const next = readValue(value);

    if (isClassMapDirective(next) && name === "class") {
      mapState = applyClassMap(element, next.value, mapState);
      return;
    }

    if (isStyleMapDirective(next) && name === "style") {
      mapState = applyStyleMap(element, next.value, mapState);
      return;
    }

    if (Object.is(previous, next)) {
      return;
    }

    previous = next;
    applyPlainAttributeValue(element, name, next);
  };

  const dispose = effect(update, { scheduler: "sync" });
  registerCleanup(element, dispose);
}

function applyPlainAttributeValue(element: Element, name: string, next: unknown): void {
  if (isClassMapDirective(next) && name === "class") {
    applyClassMap(element, next.value, null);
    return;
  }

  if (isStyleMapDirective(next) && name === "style") {
    applyStyleMap(element, next.value, null);
    return;
  }

  if (next == null || next === false) {
    if (name === "class") {
      (element as HTMLElement).className = "";
      return;
    }

    if (name === "style" && element instanceof HTMLElement) {
      element.style.cssText = "";
      return;
    }

    element.removeAttribute(name);
    return;
  }

  const stringValue = stringifyAttributeValue(name, next);

  if (name === "class") {
    (element as HTMLElement).className = stringValue;
    return;
  }

  if (name === "style" && element instanceof HTMLElement) {
    element.style.cssText = stringValue;
    return;
  }

  element.setAttribute(name, stringValue);
}

function bindPropertyPart(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  // Dot bindings follow property semantics: ordinary functions are values
  // (callbacks, controllers, factories), not implicit reactive expressions.
  // Branded signals remain reactive and update the property through an effect.
  if (!isSignal(value)) {
    (element as unknown as Record<string, unknown>)[name] = value;
    return;
  }

  let previous: unknown = Symbol("initial");

  const update = (): void => {
    const next = readValue(value);

    if (Object.is(previous, next)) {
      return;
    }

    previous = next;
    (element as unknown as Record<string, unknown>)[name] = next;
  };

  const dispose = effect(update, { scheduler: "sync" });
  registerCleanup(element, dispose);
}

function bindBooleanAttributePart(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  if (!hasReactiveValue(value)) {
    if (Boolean(readValue(value))) element.setAttribute(name, "");
    else element.removeAttribute(name);
    return;
  }

  let previous: boolean | null = null;

  const update = (): void => {
    const next = Boolean(readValue(value));

    if (previous === next) {
      return;
    }

    previous = next;

    if (next) {
      element.setAttribute(name, "");
    } else {
      element.removeAttribute(name);
    }
  };

  const dispose = effect(update, { scheduler: "sync" });
  registerCleanup(element, dispose);
}

function bindConditionalClassPart(
  element: Element,
  className: string,
  value: RenderValue | undefined,
): void {
  if (!hasReactiveValue(value)) {
    element.classList.toggle(className, Boolean(readValue(value)));
    return;
  }

  let previous: boolean | null = null;

  const update = (): void => {
    const next = Boolean(readValue(value));

    if (previous === next) {
      return;
    }

    previous = next;
    element.classList.toggle(className, next);
  };

  const dispose = effect(update, { scheduler: "sync" });
  registerCleanup(element, dispose);
}


