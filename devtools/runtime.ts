import { createStyled } from "@rodkisten/cipo";
import { createFabrica } from "@rodkisten/fabrica";
import type { Cleanup, Component, RefDirective, RenderValue } from "@rodkisten/fabrica";
import { bootstrapDevtoolsCipo } from "@rodkisten/devtools/core/cipo-bootstrap";
import { filterArray, forEachObject, toArray } from "@rodkisten/nascente";

// Theme tokens (`$background`, `$font.ui`, prefix `rd`, …) must exist before
// any styled component template is evaluated.
bootstrapDevtoolsCipo();


export const devtoolsFabrica = createFabrica({
  name: "roderuda-devtools",
  isolated: true,
  setAsDefault: true,
});

export const html = devtoolsFabrica.html;
export const jsx = devtoolsFabrica.jsx;
export const component = devtoolsFabrica.component;
export const signal = devtoolsFabrica.signal;
export const computed = devtoolsFabrica.computed;
export const effect = devtoolsFabrica.effect;
export const batch = devtoolsFabrica.batch;
export const repeat = devtoolsFabrica.repeat;
export const portal = devtoolsFabrica.portal;
export const suspense = devtoolsFabrica.suspense;
export const when = devtoolsFabrica.when;
export const classMap = devtoolsFabrica.classMap;
export const styleMap = devtoolsFabrica.styleMap;
export const onMount = devtoolsFabrica.onMount;
export const onUnmount = devtoolsFabrica.onUnmount;
export const onDispose = devtoolsFabrica.onDispose;

export function ref<T extends Element = HTMLElement>(callback: (node: T) => void | Cleanup): RefDirective<T> {
  return devtoolsFabrica.ref(callback);
}

export const styled = createStyled({ fabrica: devtoolsFabrica });
export const compiledStyled = styled;

/** Collects every styled component and static Cipó artifact created by DevTools. */
export const styledRegistry = styled.registry;

styled.connectRegistry(devtoolsFabrica);
styled.flushRegistry();

export type RenderInput = RenderValue | (() => RenderValue);

const baseRender = devtoolsFabrica.render;
const baseMount = devtoolsFabrica.mount;

function resolveRenderInput(value: RenderInput): RenderValue {
  return typeof value === "function" ? (value as () => RenderValue)() : value;
}

/**
 * Runs all devtools rendering inside the isolated Fabrica instance.
 *
 * This is important because styled component tags are resolved through this
 * instance registry. Rendering through the global/default Fabrica instance can
 * make styled tags render as inert custom elements instead of real DOM nodes.
 */
export function render(container: Element | DocumentFragment | ShadowRoot, value: RenderInput): Cleanup {
  return devtoolsFabrica.run(() => baseRender(container, resolveRenderInput(value)));
}

export function mount(container: Element | DocumentFragment | ShadowRoot, value: RenderInput): Cleanup {
  return devtoolsFabrica.run(() => baseMount(container, resolveRenderInput(value)));
}

export function renderInto(target: Element | ShadowRoot | DocumentFragment, value: RenderInput): Cleanup {
  return render(target, value);
}

export function asNode(value: RenderInput): Node {
  const fragment = document.createDocumentFragment();
  render(fragment, value);

  const meaningful = filterArray(fragment.childNodes, (node) => {
    if (node.nodeType === Node.COMMENT_NODE) return false;
    if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
    return true;
  });

  return meaningful.length === 1 ? meaningful[0]! : fragment;
}

/** Materializes exactly one element and fails early instead of leaking a DocumentFragment cast. */
export function asElement<T extends Element = HTMLElement>(value: RenderInput): T {
  const node = asNode(value);
  if (node instanceof Element) return node as T;
  if (node instanceof DocumentFragment) {
    const elements = toArray(node.children);
    if (elements.length === 1) return elements[0] as T;
  }
  throw new Error(`[RodEruda] Expected one rendered element, received ${node.nodeName}`);
}

/** Strongly typed identity helper for every template event name. */
export const event = devtoolsFabrica.event;

export type UiElementOptions<TElement extends Element = Element> = {
  className?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  children?: RenderValue;
  ref?: (node: TElement) => void | Cleanup;
  on?: Record<string, EventListener>;
};

type ElementFactory = (props?: Record<string, unknown>) => Element;

const elementFactories = devtoolsFabrica.elements as unknown as Record<string, ElementFactory>;

export function uiElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: UiElementOptions<HTMLElementTagNameMap[K]> = {},
): HTMLElementTagNameMap[K] {
  const factory = elementFactories[tag as string];

  if (!factory) {
    throw new Error(`[RodEruda] Unsupported Fabrica element: ${String(tag)}`);
  }

  const props: Record<string, unknown> = {
    ...normalizeAttrs(options.attrs),
    class: options.className,
    ref: options.ref,
    on: options.on,
    children: options.children ?? options.text ?? undefined,
  };

  const element = factory(props) as HTMLElementTagNameMap[K];

  if (options.html != null) {
    element.replaceChildren();

    // Explicitly marked unsafe to keep callers honest. This path exists only
    // for legacy DevTools surfaces that already provide trusted HTML.
    render(element, html.unsafe(options.html));
  }

  return element;
}

function normalizeAttrs(attrs?: UiElementOptions["attrs"]): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  if (!attrs) return output;

  forEachObject(attrs, (value, name) => {
    if (value == null || value === false) return;
    output[name] = value === true ? "" : value;
  });

  return output;
}

export type DevtoolsComponent<Props extends object = Record<string, unknown>> = Component<Props>;
