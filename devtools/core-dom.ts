import type { Cleanup } from "@rodkisten/devtools/types";
import { uiElement } from "@rodkisten/devtools/core/runtime";
import { debugLog, debugTrace, debugWarn } from "@rodkisten/devtools/core-debug";
import {
  describeTarget,
  debounce, 
  icon,
  isDevtoolsNode,
  detectMobile,
  downloadText,
  copyText,
  describeNode,
  nodePath,
  escapeHtml,
  truncate,
  formatBytes,
  escapeAttribute,
  formatTime, 
  safeStringify 
} from "@rodkisten/devtools/utils";
import { forEachObject, objectKeys, toArray } from "@rodkisten/nascente";

type TrustedTypesPolicy = { createHTML(value: string): unknown };

type TrustedTypesFactory = {
  createPolicy(name: string, rules: { createHTML(value: string): string }): TrustedTypesPolicy;
};

let roderudaTrustedTypesPolicy: TrustedTypesPolicy | null | undefined;

export function trustedHtml(value: string): unknown {
  const trustedTypes = typeof window !== "undefined" ? (window as unknown as { trustedTypes?: TrustedTypesFactory }).trustedTypes : undefined;
  if (!trustedTypes) return value;
  if (roderudaTrustedTypesPolicy === undefined) {
    try {
      roderudaTrustedTypesPolicy = trustedTypes.createPolicy("roderuda-devtools", { createHTML: (html) => html });
      debugLog("dom", "trusted types policy created");
    } catch (error) {
      roderudaTrustedTypesPolicy = null;
      debugWarn("dom", "trusted types policy unavailable", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return roderudaTrustedTypesPolicy ? roderudaTrustedTypesPolicy.createHTML(value) : value;
}

export function setHtml(element: Element, html: string): void {
  debugTrace("dom", "setHtml", { target: describeTarget(element), length: html.length });
  (element as Element & { innerHTML: string }).innerHTML = trustedHtml(html) as string;
}


export function qs<T = any>(root: ParentNode, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    debugWarn("dom", "qs missing", { selector });
    throw new Error(`[Devtools] Missing element: ${selector}`);
  }
  debugTrace("dom", "qs", { selector, element: describeTarget(element) });
  return element as unknown as T;
}

export function qsa<T = HTMLElement>(root: ParentNode, selector: string): T[] {
  const elements = toArray(root.querySelectorAll(selector)) as unknown as T[];
  debugTrace("dom", "qsa", { selector, count: elements.length });
  return elements;
}

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    html?: string;
    attrs?: Record<string, string | number | boolean | null | undefined>;
  } = {},
): HTMLElementTagNameMap[K] {
 // debugTrace("dom", "create", { tag, className: options.className, attrs: objectKeys(options.attrs ?? {}) });
  return uiElement(tag, options) as HTMLElementTagNameMap[K];
}

export function setStyles(
  style: CSSStyleDeclaration,
  properties: Record<string, string | number | null | undefined>,
): void {
  forEachObject(properties, (value, property) => {
    if (value == null) return;
    style.setProperty(toCssPropertyName(property), String(value));
  });
}

export function on<K extends keyof HTMLElementEventMap>(
  target: EventTarget,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions | boolean,
): Cleanup;
export function on(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions | boolean,
): Cleanup;
export function on(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: AddEventListenerOptions | boolean,
): Cleanup {
  debugTrace("dom", "on", { target: describeTarget(target), type, options: describeEventOptions(options) });
  target.addEventListener(type, listener, options);
  return () => {
  //  debugTrace("dom", "off", { target: describeTarget(target), type });
    target.removeEventListener(type, listener, options);
  };
}

export function delegate(
  target: EventTarget,
  type: string,
  selector: string,
  listener: (event: Event, element: HTMLElement) => void,
): Cleanup {
  debugTrace("dom", "delegate", { target: describeTarget(target), type, selector });
  return on(target, type, ((event: Event) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    const match = origin.closest<HTMLElement>(selector);
    if (!match) return;
    debugTrace("dom", "delegate match", { type, selector, origin: describeTarget(origin), match: describeTarget(match) });
    listener(event, match);
  }) as EventListener);
}

export function applyImportantStyle(element: HTMLElement, styles: Record<string, string>): void {
  debugTrace("dom", "applyImportantStyle", { target: describeTarget(element), properties: objectKeys(styles) });
  forEachObject(styles, (value, property) => {
    element.style.setProperty(property, value, "important");
  });
}

export function forceAppendToPage(element: HTMLElement): boolean {
  const roots = collectMountRoots();
  for (const root of roots) {
    if (!root) continue;
    try {
      if (!element.isConnected) {
        (root as HTMLElement).appendChild(element);
      }
      if (element.isConnected) {
        debugLog("dom", "forceAppendToPage", { target: element, root, connected: element.isConnected });
        return true;
      }
    } catch (error) {
      debugWarn("dom", "forceAppendToPage root failed", { root, error: error instanceof Error ? error.message : String(error) });
    }
  }

  try {
    const adopted = adoptOpenShadowRoot(element);
    if (adopted) {
      debugLog("dom", "forceAppendToPage shadow", { target: describeTarget(element), element, root: describeTarget(adopted), adopted, connected: element.isConnected });
      return element.isConnected;
    }
  } catch (error) {
    debugWarn("dom", "forceAppendToPage shadow failed", { err: error, error: error instanceof Error ? error.message : String(error) });
  }

  try {
    document.appendChild(element);
    debugLog("dom", "forceAppendToPage document", { connected: element.isConnected });
    return element.isConnected;
  } catch (error) {
    debugWarn("dom", "forceAppendToPage failed", { err: error, error: error instanceof Error ? error.message : String(error) });
    return element.isConnected;
  }
}

function collectMountRoots(): Array<ParentNode | null> {
  const roots: Array<ParentNode | null> = [
    document.body,
    document.getElementById("app"),
    document.querySelector("main"),
    document.querySelector("[data-roderuda-mount]"),
   // document.body,
    document.documentElement,
   // document.head,
  ];

  const seen = new Set<ParentNode>();
  const unique: ParentNode[] = [];
  for (const root of roots) {
    if (!root || seen.has(root)) continue;
    seen.add(root);
    unique.push(root);
  }
  return unique;
}

function adoptOpenShadowRoot(element: HTMLElement): ParentNode | null {
  const root = document.documentElement
  if (!root) return null

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let current: Node | null = walker.currentNode

  while (current) {
    const host = current as HTMLElement
    if (host.shadowRoot && host !== element && !host.contains(element)) {
      try {
        host.shadowRoot.appendChild(element)
        if (element.isConnected) return host.shadowRoot
        element.remove()
      } catch {
        // try the next open shadow root
      }
    }
    current = walker.nextNode()
  }
  return null
}

export function viewportScale(): number {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const content = viewport?.content ?? "";
  const match = content.match(/initial-scale\s*=\s*([\d.]+)/i);
  const scale = match ? Number(match[1]) || 1 : 1;
 // debugLog("dom", "viewportScale", { scale, content });
  return scale;
}

export function eventPoint(event: PointerEvent | MouseEvent | TouchEvent): { x: number; y: number } {
  if ("touches" in event && event.touches[0]) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  if ("changedTouches" in event && event.changedTouches[0]) return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
}

function describeEventOptions(options?: AddEventListenerOptions | boolean): string {
  if (typeof options === "boolean") return options ? "capture" : "bubble";
  if (!options) return "default";
  let description = "";
  forEachObject(options, (value, key) => {
    if (value == null) return;
    if (description) description += ",";
    description += `${key}:${String(value)}`;
  });
  return description || "default";
}

function toCssPropertyName(property: string): string {
  return property.startsWith("--") ? property : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
