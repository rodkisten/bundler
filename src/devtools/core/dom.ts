import { uiElement } from "../components/runtime";
import { debugLog, debugTrace, debugWarn } from "./debug";
import { describeNode } from "../utils";

export type Cleanup = () => void;

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
  const elements = Array.from(root.querySelectorAll(selector)) as unknown as T[];
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
 // debugTrace("dom", "create", { tag, className: options.className, attrs: Object.keys(options.attrs ?? {}) });
  return uiElement(tag, options) as HTMLElementTagNameMap[K];
}

export function setStyles(
  style: CSSStyleDeclaration,
  properties: Record<string, string | number | null | undefined>,
): void {
  for (const [property, value] of Object.entries(properties)) {
    if (value == null) continue;
    style.setProperty(toCssPropertyName(property), String(value));
  }
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

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

export function truncate(value: string, max = 120): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function formatBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[index]}`;
}

export function formatDuration(milliseconds?: number): string {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return "—";
  if (milliseconds < 1000) return `${milliseconds.toFixed(milliseconds < 10 ? 1 : 0)} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

export function safeStringify(value: unknown, spacing = 2): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_key, current: unknown) => {
        if (typeof current === "bigint") return `${current}n`;
        if (typeof current === "function") return `[Function ${current.name || "anonymous"}]`;
        if (typeof current === "symbol") return current.toString();
        if (current instanceof Error) {
          return { name: current.name, message: current.message, stack: current.stack };
        }
        if (current instanceof Node) return describeNode(current);
        if (current && typeof current === "object") {
          if (seen.has(current)) return "[Circular]";
          seen.add(current);
        }
        return current;
      },
      spacing,
    );
  } catch {
    return String(value);
  }
}
/*
export function describeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return `#text ${truncate(node.textContent?.trim() || "", 60)}`;
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return `<!--${truncate(node.textContent || "", 60)}-->`;
  }
  if (!(node instanceof Element)) {
    return node.nodeName;
  }
  const id = node.id ? `#${node.id}` : "";
  const dataset = !id
    ? Array.from(node.attributes)
        .filter((attribute) => attribute.name.startsWith("data-"))
        .slice(0, 4)
        .map((attribute) => {
          const key = attribute.name.slice("data-".length);
          const value = attribute.value.trim();
          return value
            ? `${key}=${truncate(value, 24)}`
            : key;
        })
        .join(":")
    : "";
  const datasetDescription = dataset ? `:${dataset}` : "";
  const classes = Array.from(node.classList)
    .slice(0, 4)
    .map((name) => `.${name}`)
    .join("");
  return `<${node.tagName.toLowerCase()}${id}${datasetDescription}${classes}>`;
}

*/

export function nodePath(node: Node): string {
  if (!(node instanceof Element)) return describeNode(node);
  const parts: string[] = [];
  let current: Element | null = node;
  while (current && parts.length < 8) {
    let part = current.tagName.toLowerCase();
    if (current.id) {
      part += `#${CSS.escape(current.id)}`;
      parts.unshift(part);
      break;
    }
    const classes = Array.from(current.classList).slice(0, 2);
    if (classes.length) part += classes.map((name) => `.${CSS.escape(name)}`).join("");
    const parentElement: Element | null = current.parentElement;
    if (parentElement) {
      const sameTag = Array.from(parentElement.children as HTMLCollectionOf<Element>).filter((child: Element) => child.tagName === current!.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
    }
    parts.unshift(part);
    current = parentElement;
  }
  const path = parts.join(" > ");
  debugTrace("dom", "nodePath", { node: describeNode(node), path });
  return path;
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    debugLog("dom", "copyText:clipboard", { length: value.length });
    return true;
  } catch (error) {
    debugWarn("dom", "copyText:fallback", { error: error instanceof Error ? error.message : String(error), length: value.length });
    const textarea = create("textarea", { attrs: { "aria-hidden": "true" } });
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

export function downloadText(filename: string, text: string, type = "text/plain"): void {
  debugLog("dom", "downloadText", { filename, type, length: text.length });
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = create("a", { attrs: { href: url, download: filename } });
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

export function applyImportantStyle(element: HTMLElement, styles: Record<string, string>): void {
  debugTrace("dom", "applyImportantStyle", { target: describeTarget(element), properties: Object.keys(styles) });
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value, "important");
  }
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

export function isDevtoolsNode(value: EventTarget | Node | null, host?: HTMLElement | null): boolean {
  if (!(value instanceof Node)) return false;
  if (host?.contains(value)) return true;
  const root = value.getRootNode();
  return root instanceof ShadowRoot && root.host === host;
}

export function detectMobile(): boolean {
  const mobile = (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
 // debugLog("dom", "detectMobile", { mobile, userAgent: navigator.userAgent });
  return mobile;
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

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer = 0;
  return ((...args: never[]) => {
  //  debugTrace("dom", "debounce:schedule", { wait });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
     // debugTrace("dom", "debounce:run", { wait });
      fn(...args);
    }, wait);
  }) as T;
}

export function icon(name: string): SVGSVGElement | Text | string {
  const icons: Record<string, string> = {
    add: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 0 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.8 3.8-4"/><path d="M17.47 9C19.4 8.8 21 7.1 21 5"/><path d="M18 13h4"/><path d="M21 21c0-2.1-1.7-3.8-3.8-4"/>',
    clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    collapse: '<path d="m6 9 6 6 6-6"/>',
    console: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    elements: '<path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M9 20V9"/>',
    expand: '<path d="m9 18 6-6-6-6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    filter: '<path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    forward: '<path d="m9 18 6-6-6-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    inspect: '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51Z"/><path d="m13 13 6 6"/>',
    menu: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    network: '<path d="M9 2 5 6l4 4"/><path d="M5 6h11a4 4 0 0 1 0 8H8"/><path d="m15 22 4-4-4-4"/><path d="M19 18H8a4 4 0 0 1 0-8h8"/>',
    pause: '<path d="M10 4H6v16h4Z"/><path d="M18 4h-4v16h4Z"/>',
    play: '<path d="m5 3 14 9-14 9Z"/>',
    record: '<circle cx="12" cy="12" r="8"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/><path d="M21 21v-5h-5"/>',
    resources: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.73l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
    snippets: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    sources: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    diamond: '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/>'
  };
  const body = icons[name];
  if (typeof document === "undefined") return "•";

  if (!body) return document.createTextNode("•");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "1em");
  svg.setAttribute("height", "1em");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("roderuda-lucide-icon");
  svg.innerHTML = trustedHtml(body) as string;
  return svg;
}

function describeTarget(target: EventTarget | Node | ParentNode | null): string {
  if (!target) return "null";
  if (target instanceof ShadowRoot) return "#shadow-root";
  if (target instanceof Document) return "document";
  if (target === window) return "window";
  if (target instanceof Element) return describeNode(target);
  return (target as object).constructor?.name ?? typeof target;
}

function describeEventOptions(options?: AddEventListenerOptions | boolean): string {
  if (typeof options === "boolean") return options ? "capture" : "bubble";
  if (!options) return "default";
  return Object.entries(options).filter(([, value]) => value != null).map(([key, value]) => `${key}:${String(value)}`).join(",") || "default";
}

function toCssPropertyName(property: string): string {
  return property.startsWith("--") ? property : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
