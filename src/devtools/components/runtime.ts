import { store } from "../../broto";
import { createCompiledStyled } from "../../cipo";
import { createFabrica } from "../../fabrica";
import type { Component, RenderValue } from "../../fabrica";

export const devtoolsFabrica = createFabrica({
  name: "roderuda-devtools",
  isolated: true,
});

export const html = devtoolsFabrica.html;
export const jsx = devtoolsFabrica.jsx;
export const component = devtoolsFabrica.component;
export const signal = devtoolsFabrica.signal;
export const computed = devtoolsFabrica.computed;
export const effect = devtoolsFabrica.effect;
export const batch = devtoolsFabrica.batch;
export const ref = devtoolsFabrica.ref;
export const repeat = devtoolsFabrica.repeat;
export const portal = devtoolsFabrica.portal;
export const suspense = devtoolsFabrica.suspense;
export const when = devtoolsFabrica.when;
export const classMap = devtoolsFabrica.classMap;
export const styleMap = devtoolsFabrica.styleMap;
export const onMount = devtoolsFabrica.onMount;
export const onUnmount = devtoolsFabrica.onUnmount;
export const onDispose = devtoolsFabrica.onDispose;

export const styled = createCompiledStyled({ fabrica: devtoolsFabrica });
export const compiledStyled = styled;

styled.connectRegistry(devtoolsFabrica);
styled.flushRegistry();

type RenderInput = RenderValue | (() => RenderValue);

const baseRender = devtoolsFabrica.render;
const baseMount = devtoolsFabrica.mount;

function resolveRenderInput(value: RenderInput): RenderValue {
  return typeof value === "function" ? (value as () => RenderValue)() : value;
}

/** Renders inside the isolated devtools Fabrica runtime so styled components resolve correctly. */
export function render(container: Element | DocumentFragment | ShadowRoot, value: RenderInput): () => void {
  return devtoolsFabrica.run(() => baseRender(container, resolveRenderInput(value)));
}

export function mount(container: Element | DocumentFragment | ShadowRoot, value: RenderInput): () => void {
  return devtoolsFabrica.run(() => baseMount(container, resolveRenderInput(value)));
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

export function event<T extends Event = Event>(handler: (event: T) => void): never {
  return handler as never;
}

export type UiElementOptions = {
  className?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  children?: RenderValue;
  ref?: (node: Element) => void | (() => void);
  on?: Record<string, EventListener>;
};

const elementFactories = devtoolsFabrica.elements as unknown as Record<string, (props?: Record<string, unknown>) => Element>;

export function uiElement<K extends keyof HTMLElementTagNameMap>(tag: K, options: UiElementOptions = {}): HTMLElementTagNameMap[K] {
  const factory = elementFactories[tag as string];
  if (!factory) throw new Error(`[RodEruda] Unsupported Fabrica element: ${String(tag)}`);
  const attrs = options.attrs ?? {};
  const props: Record<string, unknown> = {
    ...attrs,
    class: options.className,
    attrs,
    ref: options.ref,
    on: options.on,
    children: options.children ?? options.text ?? undefined,
  };
  const element = factory(props) as HTMLElementTagNameMap[K];
  if (options.html != null) {
    const unsafeHtml = options.html;
    element.replaceChildren();
    devtoolsFabrica.run(() => baseRender(element, html.unsafe(unsafeHtml)));
  }
  return element;
}

export function renderInto(target: HTMLElement | ShadowRoot | DocumentFragment, value: RenderInput): void {
  devtoolsFabrica.run(() => {
    baseRender(target, resolveRenderInput(value));
  });
}

export function asNode(value: RenderInput): Node {
  const fragment = document.createDocumentFragment();
  devtoolsFabrica.run(() => {
    baseRender(fragment, resolveRenderInput(value));
  });
  return fragment.childNodes.length === 1 ? fragment.firstChild! : fragment;
}

export type DevtoolsComponent<Props extends object = Record<string, unknown>> = Component<Props>;
