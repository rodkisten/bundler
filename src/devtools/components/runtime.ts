import { store } from "../../broto";
import { createStyled, compiledStyled } from "../../cipo";
import { createFabrica } from "../../fabrica";
import type { Component, RenderValue } from "../../fabrica";

export const devtoolsFabrica = createFabrica({
  name: "roderuda-devtools",
  isolated: true,
});

export const html = devtoolsFabrica.html;
export const jsx = devtoolsFabrica.jsx;
export const render = devtoolsFabrica.render;
export const mount = devtoolsFabrica.mount;
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

export const styled = createStyled({ fabrica: devtoolsFabrica });
export const compiledStyled = createCompiledStyled({ fabrica: devtoolsFabrica });

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
    element.replaceChildren();
    render(element, html.unsafe(options.html));
  }
  return element;
}

export function renderInto(target: HTMLElement | ShadowRoot | DocumentFragment, value: RenderValue): void {
  render(target, value);
}

export function asNode(value: RenderValue): Node {
  const fragment = document.createDocumentFragment();
  render(fragment, value);
  return fragment.childNodes.length === 1 ? fragment.firstChild! : fragment;
}

export type DevtoolsComponent<Props extends object = Record<string, unknown>> = Component<Props>;
