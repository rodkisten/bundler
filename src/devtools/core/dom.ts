export type Cleanup = () => void;

export function qs<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`[Devtools] Missing element: ${selector}`);
  return element;
}

export function qsa<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
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
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text != null) element.textContent = options.text;
  if (options.html != null) element.innerHTML = options.html;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value == null || value === false) continue;
      element.setAttribute(name, value === true ? "" : String(value));
    }
  }
  return element;
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
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

export function delegate(
  target: EventTarget,
  type: string,
  selector: string,
  listener: (event: Event, element: HTMLElement) => void,
): Cleanup {
  return on(target, type, ((event: Event) => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    const match = origin.closest<HTMLElement>(selector);
    if (!match) return;
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

export function describeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return `#text ${truncate(node.textContent?.trim() || "", 60)}`;
  if (node.nodeType === Node.COMMENT_NODE) return `<!--${truncate(node.textContent || "", 60)}-->`;
  if (!(node instanceof Element)) return node.nodeName;
  const id = node.id ? `#${node.id}` : "";
  const classes = Array.from(node.classList).slice(0, 4).map((name) => `.${name}`).join("");
  return `<${node.tagName.toLowerCase()}${id}${classes}>`;
}

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
  return parts.join(" > ");
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
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
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = create("a", { attrs: { href: url, download: filename } });
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

export function isDevtoolsNode(value: EventTarget | Node | null, host?: HTMLElement | null): boolean {
  if (!(value instanceof Node)) return false;
  if (host?.contains(value)) return true;
  const root = value.getRootNode();
  return root instanceof ShadowRoot && root.host === host;
}

export function detectMobile(): boolean {
  return (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

export function viewportScale(): number {
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const content = viewport?.content ?? "";
  const match = content.match(/initial-scale\s*=\s*([\d.]+)/i);
  return match ? Number(match[1]) || 1 : 1;
}

export function eventPoint(event: PointerEvent | MouseEvent | TouchEvent): { x: number; y: number } {
  if ("touches" in event && event.touches[0]) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  if ("changedTouches" in event && event.changedTouches[0]) return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer = 0;
  return ((...args: never[]) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  }) as T;
}

export function icon(name: string): string {
  const icons: Record<string, string> = {
    console: "⌘",
    elements: "◇",
    network: "⇄",
    resources: "▦",
    sources: "{ }",
    info: "ⓘ",
    snippets: "⚡",
    settings: "⚙",
    clear: "⌫",
    filter: "▽",
    copy: "⧉",
    back: "‹",
    close: "×",
    refresh: "↻",
    inspect: "◎",
    delete: "⌦",
    add: "+",
    play: "▶",
    pause: "Ⅱ",
    search: "⌕",
    menu: "⋯",
    record: "●",
    eye: "◉",
    expand: "▸",
    collapse: "▾",
    edit: "✎",
    download: "⇩",
  };
  return icons[name] ?? "•";
}
