import { store } from "../../broto";
import { createStyled } from "../../cipo";
import { createFabrica } from "../../fabrica";
import type { Component, RenderValue } from "../../fabrica";
import { debugLog, debugTrace } from "../core/debug";

export const devtoolsFabrica = createFabrica({
  name: "roderuda-devtools",
  isolated: true,
});

debugLog("fabrica", "runtime created", { name: "roderuda-devtools", isolated: true });

type HtmlFn = typeof devtoolsFabrica.html;
type JsxFn = typeof devtoolsFabrica.jsx;
type RenderFn = typeof devtoolsFabrica.render;
type MountFn = typeof devtoolsFabrica.mount;
type ComponentFn = typeof devtoolsFabrica.component;
type SignalFn = typeof devtoolsFabrica.signal;
type ComputedFn = typeof devtoolsFabrica.computed;
type EffectFn = typeof devtoolsFabrica.effect;
type BatchFn = typeof devtoolsFabrica.batch;
type RefFn = typeof devtoolsFabrica.ref;
type RepeatFn = typeof devtoolsFabrica.repeat;
type PortalFn = typeof devtoolsFabrica.portal;
type SuspenseFn = typeof devtoolsFabrica.suspense;
type WhenFn = typeof devtoolsFabrica.when;

export const html: HtmlFn = devtoolsFabrica.html;
export const jsx: JsxFn = ((...args: Parameters<JsxFn>) => {
  debugTrace("fabrica", "jsx", { type: describeComponentType(args[0]) });
  return devtoolsFabrica.jsx(...args);
}) as JsxFn;

export const render: RenderFn = ((...args: Parameters<RenderFn>) => {
  debugTrace("fabrica", "render", { target: describeRenderTarget(args[0]) });
  return devtoolsFabrica.render(...args);
}) as RenderFn;

export const mount: MountFn = ((...args: Parameters<MountFn>) => {
  debugTrace("fabrica", "mount", { target: describeRenderTarget(args[0]) });
  return devtoolsFabrica.mount(...args);
}) as MountFn;

export const component: ComponentFn = ((...args: Parameters<ComponentFn>) => {
  debugLog("fabrica", "component", { name: typeof args[0] === "string" ? args[0] : describeComponentType(args[0]) });
  return devtoolsFabrica.component(...args);
}) as ComponentFn;

export const signal: SignalFn = ((...args: Parameters<SignalFn>) => {
  debugTrace("fabrica", "signal", { hasInitialValue: args.length > 0 });
  return devtoolsFabrica.signal(...args);
}) as SignalFn;

export const computed: ComputedFn = ((...args: Parameters<ComputedFn>) => {
  debugTrace("fabrica", "computed");
  return devtoolsFabrica.computed(...args);
}) as ComputedFn;

export const effect: EffectFn = ((...args: Parameters<EffectFn>) => {
  debugTrace("fabrica", "effect");
  return devtoolsFabrica.effect(...args);
}) as EffectFn;

export const batch: BatchFn = ((...args: Parameters<BatchFn>) => {
  debugTrace("fabrica", "batch");
  return devtoolsFabrica.batch(...args);
}) as BatchFn;

export const ref: RefFn = ((...args: Parameters<RefFn>) => {
  debugTrace("fabrica", "ref");
  return devtoolsFabrica.ref(...args);
}) as RefFn;

export const repeat: RepeatFn = ((...args: Parameters<RepeatFn>) => {
  debugTrace("fabrica", "repeat");
  return devtoolsFabrica.repeat(...args);
}) as RepeatFn;

export const portal: PortalFn = ((...args: Parameters<PortalFn>) => {
  debugTrace("fabrica", "portal", { target: describeRenderTarget(args[0]) });
  return devtoolsFabrica.portal(...args);
}) as PortalFn;

export const suspense: SuspenseFn = ((...args: Parameters<SuspenseFn>) => {
  debugTrace("fabrica", "suspense");
  return devtoolsFabrica.suspense(...args);
}) as SuspenseFn;

export const when: WhenFn = ((...args: Parameters<WhenFn>) => {
  debugTrace("fabrica", "when");
  return devtoolsFabrica.when(...args);
}) as WhenFn;

export const classMap = devtoolsFabrica.classMap;
export const styleMap = devtoolsFabrica.styleMap;
export const onMount = devtoolsFabrica.onMount;
export const onUnmount = devtoolsFabrica.onUnmount;
export const onDispose = devtoolsFabrica.onDispose;

export const styled = createStyled({ fabrica: devtoolsFabrica });

debugLog("cipo", "styled runtime created", { fabrica: "roderuda-devtools" });

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
  return ((nativeEvent: T) => {
    debugTrace("event", nativeEvent.type, {
      target: describeEventTarget(nativeEvent.target),
      currentTarget: describeEventTarget(nativeEvent.currentTarget),
    });
    handler(nativeEvent);
  }) as never;
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
  debugTrace("ui", "create element", {
    tag,
    className: options.className,
    attrs: Object.keys(attrs),
    hasHtml: options.html != null,
    hasChildren: options.children != null || options.text != null,
  });
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
  debugTrace("fabrica", "renderInto", { target: describeEventTarget(target) });
  render(target, value);
}

export function asNode(value: RenderValue): Node {
  debugTrace("fabrica", "asNode");
  const fragment = document.createDocumentFragment();
  render(fragment, value);
  return fragment.childNodes.length === 1 ? fragment.firstChild! : fragment;
}

function describeComponentType(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "function") return value.name || "anonymous";
  return String(value ?? "unknown");
}

function describeRenderTarget(value: unknown): string {
  return value instanceof EventTarget ? describeEventTarget(value) : describeComponentType(value);
}

function describeEventTarget(target: EventTarget | null): string {
  if (!target) return "null";
  if (target instanceof ShadowRoot) return "#shadow-root";
  if (target instanceof DocumentFragment) return "#fragment";
  if (target instanceof Element) {
    const id = target.id ? `#${target.id}` : "";
    const classes = Array.from(target.classList).slice(0, 3).map((name) => `.${name}`).join("");
    return `${target.tagName.toLowerCase()}${id}${classes}`;
  }
  return target.constructor?.name ?? typeof target;
}

export type DevtoolsComponent<Props extends object = Record<string, unknown>> = Component<Props>;
