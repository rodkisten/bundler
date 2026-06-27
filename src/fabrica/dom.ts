import { PART_END, PART_START } from "./constants";
import { debugState } from "./debug";
import {
  clearRange,
  disposeRange,
  disposeTree,
  moveRangeBefore,
  registerCleanup,
  removeRange,
} from "./dom-cleanup";
import { bindEvent } from "./events";
import { bindModelPart, createDirectiveController } from "./dom-directives";
import { bindSpreadPart } from "./dom-spread";
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
  comparePathsReverse,
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
  ComponentPayload,
  ComponentRenderRequest,
  Directive,
  ElementPayload,
  DirectiveController,
  RenderValue,
  RepeatDirective,
  RepeatRecord,
  TemplatePart,
  PortalDirective,
  SuspenseDirective,
  BindDirective,
  EventOptionsDirective,
  KeyedDirective,
  VirtualRepeatDirective,
  WhenDirective,
} from "./types";

/** Persistent root render parts keyed by container. */
const renderStates = new WeakMap<
  Node,
  { part: ReturnType<typeof createChildPart>; dispose: () => void }
>();


type DynamicComponentPropPart =
  | {
      name: string;
      index: number;
      indices: number[];
      strings: string[];
      raw: boolean;
      spread?: false;
    }
  | { index: number; spread: true };

/**
 * Creates DOM from a tagged template.
 *
 * @param strings - Template strings.
 * @param values - Dynamic values.
 * @returns Rendered document fragment.
 *
 * @example
 * ```ts
 * const view = html`<strong>${name}</strong>`;
 * ```
 */
export function html(
  strings: TemplateStringsArray,
  ...values: RenderValue[]
): DocumentFragment {
  return runWithCurrentFabricaRuntime(() => {
    const compiled = getCompiledTemplate(strings, values);
    const fragment = compiled.template.content.cloneNode(
      true,
    ) as DocumentFragment;

    applyParts(fragment, compiled.parts, values);
    return fragment;
  });
}

/**
 * Creates DOM from Fabrica micro-JSX syntax.
 *
 * @remarks
 * `jsx.html` is the preferred entrypoint because many editors highlight that
 * shape better than `html.jsx`. The compatibility alias remains attached to
 * `html.jsx`. Uppercase component tags are resolved from the component registry
 * and HTML comments stay inert, so `<!-- <Panel /> -->` does not mount `Panel`.
 *
 * @param strings - Template strings.
 * @param values - Dynamic values.
 * @returns Rendered document fragment.
 */
(html as typeof html & { jsx: typeof html }).jsx = function jsxHtml(
  strings: TemplateStringsArray,
  ...values: RenderValue[]
): DocumentFragment {
  return runWithCurrentFabricaRuntime(() => {
    const compiled = getCompiledJsxTemplate(strings, values);
    const fragment = compiled.template.content.cloneNode(
      true,
    ) as DocumentFragment;

    applyParts(fragment, compiled.parts, values);
    return fragment;
  });
};

/** JSX-friendly namespace for `jsx.html` authoring. */
export const jsx = Object.freeze({
  html: (html as typeof html & { jsx: typeof html }).jsx,
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
    let state = renderStates.get(container);

    if (!state) {
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

      state = { part, dispose };
      renderStates.set(container, state);
    }

    debugState.reconciliations += 1;
    state.part.set(value);
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
    const template = document.createElement("template");
    template.innerHTML = resolvedValue.value;
    parentNode.insertBefore(template.content, beforeNode);
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
): void {
  const resolvedParts: Array<{ part: TemplatePart; node: Node }> = [];
  const componentPathSet = new Set<string>();
  const componentPropParts = new Map<string, DynamicComponentPropPart[]>();

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (!part) {
      continue;
    }

    if (part.type === "component") {
      componentPathSet.add(part.path.join("."));
    }
  }

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (!part) {
      continue;
    }

    const node = resolvePath(fragment, part.path);

    if (!node) {
      continue;
    }

    if ((part.type === "attribute" || part.type === "spread") && componentPathSet.has(part.path.join(".")) && node instanceof HTMLTemplateElement) {
      const key = part.path.join(".");
      const propParts = componentPropParts.get(key) ?? [];

      if (part.type === "spread") {
        propParts.push({ index: part.index, spread: true });
        node.removeAttribute("data-fabrica-spread");
      } else {
        propParts.push({
          name: part.name,
          index: part.index,
          indices: part.indices,
          strings: part.strings,
          raw: part.raw,
        });
        node.removeAttribute(part.name);
      }

      componentPropParts.set(key, propParts);
      continue;
    }

    resolvedParts.push({ part, node });
  }

  resolvedParts.sort((left, right) =>
    comparePathsReverse(left.part.path, right.part.path),
  );

  for (let index = 0; index < resolvedParts.length; index += 1) {
    const resolved = resolvedParts[index];

    if (!resolved) {
      continue;
    }

    if (resolved.part.type === "child") {
      bindChildPart(resolved.node, values[resolved.part.index]);
    } else if (resolved.part.type === "attribute") {
      bindAttributePart(
        resolved.node,
        resolved.part.name,
        createAttributeBindingValue(resolved.part, values),
      );
    } else if (resolved.part.type === "spread") {
      bindSpreadPart(resolved.node, values[resolved.part.index]);
    } else {
      const key = resolved.part.path.join(".");
      bindComponentPart(
        resolved.node,
        resolved.part.index >= 0 ? values[resolved.part.index] : undefined,
        values,
        resolved.part,
        componentPropParts.get(key) ?? [],
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
        { name: "fabrica.childBinding" },
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
      const props = {
        ...readStaticComponentProps(node),
        ...readDynamicComponentProps(dynamicPropParts, values),
      };
      const children = node.content.cloneNode(true) as DocumentFragment;
      const childParts = compileParts(children);

      applyParts(children, childParts, values);

      const output = callComponentLike(
        componentValue,
        hasMeaningfulComponentChildren(children) ? { ...props, children } : props,
      );

      childPart.set(output as RenderValue);
    });
  };

  if (hasReactiveComponentInputs(dynamicPropParts, values)) {
    const dispose = runWithOwner(owner, () =>
      effect(renderComponent, { name: `fabrica.componentTagBinding:${componentName || "anonymous"}` }),
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

    if (part.spread) {
      if (hasReactiveRecordValue(value)) return true;
      continue;
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

function callComponentLike(componentValue: unknown, props: Record<string, unknown>): unknown {
  if (typeof componentValue !== "function") {
    return null;
  }

  return (componentValue as (nextProps?: Record<string, unknown>) => unknown)(props);
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
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (let index = 0; index < propParts.length; index += 1) {
    const prop = propParts[index];

    if (!prop) {
      continue;
    }

    if (prop.spread) {
      mergeSpreadProps(props, readValue(values[prop.index]) as unknown);
      continue;
    }

    props[normalizeComponentPropName(prop.name)] = readComponentPropValue(prop, values);
  }

  return props;
}

function readComponentPropValue(
  part: Exclude<DynamicComponentPropPart, { spread: true }>,
  values: readonly RenderValue[],
): unknown {
  if (part.raw) return values[part.index];
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
  return name;
}

function normalizeComponentPropName(name: string): string {
  if (name.startsWith("@")) return eventAttributeToPropName(name.slice(1));
  if (name.startsWith(".")) return name.slice(1);
  if (name.startsWith("?")) return name.slice(1);
  if (name.startsWith(":")) return name.slice(1);
  return name;
}

function eventAttributeToPropName(rawName: string): string {
  const eventName = rawName.split(".", 1)[0] || rawName;
  return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
}

function mergeSpreadProps(target: Record<string, unknown>, value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const source = value as Record<string, unknown>;

  for (const key in source) {
    target[normalizeComponentPropName(key)] = source[key];
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
        const template = document.createElement("template");
        template.innerHTML = resolvedValue.value;
        appendValue(end.parentNode, template.content, end);
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
      appendValue(end.parentNode, textNode, end);
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

  if (isRefDirective(value)) {
    const cleanup = value.callback(node);

    if (typeof cleanup === "function") {
      registerCleanup(node, cleanup);
    }

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

    if (next == null || next === false) {
      element.removeAttribute(name);
      return;
    }

    element.setAttribute(name, stringifyAttributeValue(name, next));
  };

  const dispose = hasReactiveValue(value) ? effect(update) : (update(), null);

  if (dispose) {
    registerCleanup(element, dispose);
  }
}

function bindPropertyPart(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
  let previous: unknown = Symbol("initial");

  const update = (): void => {
    const next = readValue(value);

    if (Object.is(previous, next)) {
      return;
    }

    previous = next;
    (element as unknown as Record<string, unknown>)[name] = next;
  };

  const dispose = hasReactiveValue(value) ? effect(update) : (update(), null);

  if (dispose) {
    registerCleanup(element, dispose);
  }
}

function bindBooleanAttributePart(
  element: Element,
  name: string,
  value: RenderValue | undefined,
): void {
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

  const dispose = hasReactiveValue(value) ? effect(update) : (update(), null);

  if (dispose) {
    registerCleanup(element, dispose);
  }
}

function bindConditionalClassPart(
  element: Element,
  className: string,
  value: RenderValue | undefined,
): void {
  let previous: boolean | null = null;

  const update = (): void => {
    const next = Boolean(readValue(value));

    if (previous === next) {
      return;
    }

    previous = next;
    element.classList.toggle(className, next);
  };

  const dispose = hasReactiveValue(value) ? effect(update) : (update(), null);

  if (dispose) {
    registerCleanup(element, dispose);
  }
}


