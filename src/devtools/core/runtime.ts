import { store } from "../../broto";
import { createStyled } from "../../cipo";
import { createFabrica } from "../../fabrica";
import type { Cleanup, Component, RefDirective, RenderValue } from "../../fabrica";
import { bootstrapDevtoolsCipo } from "./cipo-bootstrap";

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

  const meaningful = Array.from(fragment.childNodes).filter((node) => {
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
    const elements = Array.from(node.children);
    if (elements.length === 1) return elements[0] as T;
  }
  throw new Error(`[RodEruda] Expected one rendered element, received ${node.nodeName}`);
}

export interface DevtoolsUiState extends Record<string, unknown> {
  shell: { inline: boolean; mounted: boolean };
  panels: { active: string; names: string[] };
  modal: { active: boolean };
}

export const uiState = store<DevtoolsUiState>({
  shell: {
    inline: false,
    mounted: false,
  },
  panels: {
    active: "",
    names: [],
  },
  modal: {
    active: false,
  },
});

/**
 * Type helper for template event bindings.
 *
 * Fabrica consumes the returned function through the `@event=${...}` binding.
 * The `never` return keeps template interpolation types permissive without
 * leaking event handler functions into normal RenderValue positions.
 */
export function event<T extends Event = Event>(handler: (event: T) => void): never {
  return handler as never;
}

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

  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    output[name] = value === true ? "" : value;
  }

  return output;
}

export type DevtoolsComponent<Props extends object = Record<string, unknown>> = Component<Props>;
