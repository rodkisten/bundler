import { create, on, trustedHtml } from "./core/dom";
import {
  debugLog,
  debugTrace,
  debugWarn,
} from "./core/debug";

export  { setStyles } from "./core/dom"!

export type Cleanup = () => void;

export type IconName = keyof typeof ICONS;

export type IconNode = SVGSVGElement | Text | string;

export type DebouncedFunction<T extends (...args: never[]) => unknown> = (
  ...args: Parameters<T>
) => void;

/* ******************** */
/* Constants            */
/* ******************** */

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const MOBILE_USER_AGENT_PATTERN =
  /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i;

const DATA_ATTRIBUTE_PREFIX = "data-";

const MAX_NODE_TEXT_LENGTH = 60;
const MAX_NODE_DATASET_ENTRIES = 4;
const MAX_NODE_DATASET_VALUE_LENGTH = 24;
const MAX_NODE_CLASSES = 4;

const ICONS = {
  add: '<path d="M5 12h14"/><path d="M12 5v14"/>',

  back: '<path d="m15 18-6-6 6-6"/>',

  bug: [
    '<path d="m8 2 1.88 1.88"/>',
    '<path d="M14.12 3.88 16 2"/>',
    '<path d="M9 7.13v-1a3 3 0 0 1 6 0v1"/>',
    '<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>',
    '<path d="M12 20v-9"/>',
    '<path d="M6.53 9C4.6 8.8 3 7.1 3 5"/>',
    '<path d="M6 13H2"/>',
    '<path d="M3 21c0-2.1 1.7-3.8 3.8-4"/>',
    '<path d="M17.47 9C19.4 8.8 21 7.1 21 5"/>',
    '<path d="M18 13h4"/>',
    '<path d="M21 21c0-2.1-1.7-3.8-3.8-4"/>',
  ].join(""),

  clear: [
    '<path d="M3 6h18"/>',
    '<path d="M8 6V4h8v2"/>',
    '<path d="m19 6-1 14H6L5 6"/>',
    '<path d="M10 11v6"/>',
    '<path d="M14 11v6"/>',
  ].join(""),

  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',

  collapse: '<path d="m6 9 6 6 6-6"/>',

  console: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',

  copy: [
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>',
    '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  ].join(""),

  delete: [
    '<path d="M3 6h18"/>',
    '<path d="M8 6V4h8v2"/>',
    '<path d="m19 6-1 14H6L5 6"/>',
    '<path d="M10 11v6"/>',
    '<path d="M14 11v6"/>',
  ].join(""),

  diamond: [
    '<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/>',
    '<path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/>',
    '<path d="M2 9h20"/>',
  ].join(""),

  download: [
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
    '<path d="M7 10l5 5 5-5"/>',
    '<path d="M12 15V3"/>',
  ].join(""),

  edit: [
    '<path d="M12 20h9"/>',
    '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  ].join(""),

  elements: [
    '<path d="M4 4h16v16H4z"/>',
    '<path d="M4 9h16"/>',
    '<path d="M9 20V9"/>',
  ].join(""),

  expand: '<path d="m9 18 6-6-6-6"/>',

  eye: [
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/>',
    '<circle cx="12" cy="12" r="3"/>',
  ].join(""),

  filter: [
    '<path d="M3 6h18"/>',
    '<path d="M7 12h10"/>',
    '<path d="M10 18h4"/>',
  ].join(""),

  forward: '<path d="m9 18 6-6-6-6"/>',

  info: [
    '<circle cx="12" cy="12" r="10"/>',
    '<path d="M12 16v-4"/>',
    '<path d="M12 8h.01"/>',
  ].join(""),

  inspect: [
    '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51Z"/>',
    '<path d="m13 13 6 6"/>',
  ].join(""),

  menu: [
    '<circle cx="12" cy="12" r="1"/>',
    '<circle cx="19" cy="12" r="1"/>',
    '<circle cx="5" cy="12" r="1"/>',
  ].join(""),

  network: [
    '<path d="M9 2 5 6l4 4"/>',
    '<path d="M5 6h11a4 4 0 0 1 0 8H8"/>',
    '<path d="m15 22 4-4-4-4"/>',
    '<path d="M19 18H8a4 4 0 0 1 0-8h8"/>',
  ].join(""),

  pause: [
    '<path d="M10 4H6v16h4Z"/>',
    '<path d="M18 4h-4v16h4Z"/>',
  ].join(""),

  play: '<path d="m5 3 14 9-14 9Z"/>',

  record: '<circle cx="12" cy="12" r="8"/>',

  refresh: [
    '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/>',
    '<path d="M3 3v5h5"/>',
    '<path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/>',
    '<path d="M21 21v-5h-5"/>',
  ].join(""),

  resources: [
    '<ellipse cx="12" cy="5" rx="9" ry="3"/>',
    '<path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
    '<path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  ].join(""),

  search: [
    '<circle cx="11" cy="11" r="8"/>',
    '<path d="m21 21-4.3-4.3"/>',
  ].join(""),

  settings: [
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.73l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/>',
    '<circle cx="12" cy="12" r="3"/>',
  ].join(""),

  snippets: [
    '<circle cx="6" cy="6" r="3"/>',
    '<path d="M8.12 8.12 12 12"/>',
    '<path d="M20 4 8.12 15.88"/>',
    '<circle cx="6" cy="18" r="3"/>',
    '<path d="M14.8 14.8 20 20"/>',
  ].join(""),

  sources: [
    '<path d="m16 18 6-6-6-6"/>',
    '<path d="m8 6-6 6 6 6"/>',
  ].join(""),
} as const;

/* ******************** */
/* Clipboard            */
/* ******************** */

export async function copyText(value: string): Promise<boolean> {
  const text = String(value);

  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(text);

      debugLog("dom", "copyText:clipboard", {
        length: text.length,
      });

      return true;
    } catch (error) {
      debugWarn("dom", "copyText:clipboard-failed", {
        error: errorMessage(error),
        length: text.length,
      });
    }
  }

  return copyTextWithTextarea(text);
}

function canUseClipboardApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.clipboard != null &&
    typeof navigator.clipboard.writeText === "function"
  );
}

function copyTextWithTextarea(value: string): boolean {
  if (
    typeof document === "undefined" ||
    !document.body ||
    typeof document.execCommand !== "function"
  ) {
    debugWarn("dom", "copyText:unavailable", {
      length: value.length,
    });

    return false;
  }

  const textarea = create("textarea", {
    attrs: {
      "aria-hidden": "true",
      readonly: "",
      tabindex: "-1",
    },
  });

  textarea.value = value;

  Object.assign(textarea.style, {
    position: "fixed",
    top: "0",
    left: "-9999px",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  document.body.appendChild(textarea);

  try {
    textarea.focus({
      preventScroll: true,
    });

    textarea.select();
    textarea.setSelectionRange(0, value.length);

    const copied = document.execCommand("copy");

    debugLog("dom", "copyText:fallback", {
      copied,
      length: value.length,
    });

    return copied;
  } catch (error) {
    debugWarn("dom", "copyText:fallback-failed", {
      error: errorMessage(error),
      length: value.length,
    });

    return false;
  } finally {
    textarea.remove();

    activeElement?.focus({
      preventScroll: true,
    });
  }
}

/* ******************** */
/* Downloads            */
/* ******************** */

export function downloadText(
  filename: string,
  text: string,
  type = "text/plain;charset=utf-8",
): void {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof Blob === "undefined"
  ) {
    debugWarn("dom", "downloadText:unavailable", {
      filename,
      type,
      length: text.length,
    });

    return;
  }

  debugLog("dom", "downloadText", {
    filename,
    type,
    length: text.length,
  });

  const blob = new Blob([text], {
    type,
  });

  const url = URL.createObjectURL(blob);

  const anchor = create("a", {
    attrs: {
      href: url,
      download: filename,
      rel: "noopener",
    },
  });

  anchor.style.display = "none";

  document.body?.appendChild(anchor);
  anchor.click();
  anchor.remove();

  /*
   * Safari pode iniciar o download de forma assíncrona.
   * Revogar em microtask pode invalidar a URL cedo demais.
   */
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

/* ******************** */
/* Serialization        */
/* ******************** */

export function safeStringify(
  value: unknown,
  spacing = 2,
): string {
  const seen = new WeakSet<object>();
  const normalizedSpacing = normalizeJsonSpacing(spacing);

  try {
    const serialized = JSON.stringify(
      value,
      (_key, current: unknown): unknown => {
        if (typeof current === "bigint") {
          return `${current.toString()}n`;
        }

        if (typeof current === "function") {
          return `[Function ${current.name || "anonymous"}]`;
        }

        if (typeof current === "symbol") {
          return current.toString();
        }

        if (current instanceof Error) {
          return {
            name: current.name,
            message: current.message,
            stack: current.stack,
            cause: current.cause,
          };
        }

        if (isNode(current)) {
          return describeNode(current);
        }

        if (current instanceof Map) {
          return {
            type: "Map",
            entries: Array.from(current.entries()),
          };
        }

        if (current instanceof Set) {
          return {
            type: "Set",
            values: Array.from(current.values()),
          };
        }

        if (current && typeof current === "object") {
          if (seen.has(current)) {
            return "[Circular]";
          }

          seen.add(current);
        }

        return current;
      },
      normalizedSpacing,
    );

    /*
     * JSON.stringify(undefined), function ou symbol no nível raiz
     * retorna undefined, apesar da assinatura normalmente sugerir string.
     */
    return serialized ?? String(value);
  } catch (error) {
    debugWarn("dom", "safeStringify:failed", {
      error: errorMessage(error),
    });

    try {
      return String(value);
    } catch {
      return "[Unserializable]";
    }
  }
}

function normalizeJsonSpacing(spacing: number): number {
  if (!Number.isFinite(spacing)) return 2;
  return Math.min(10, Math.max(0, Math.trunc(spacing)));
}

/* ******************** */
/* Node inspection      */
/* ******************** */

export function describeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? "";

    return `#text ${truncate(text, MAX_NODE_TEXT_LENGTH)}`;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return `<!--${truncate(
      node.textContent ?? "",
      MAX_NODE_TEXT_LENGTH,
    )}-->`;
  }

  if (!(node instanceof Element)) {
    return node.nodeName;
  }

  const tagName = node.tagName.toLowerCase();
  const idDescription = node.id ? `#${node.id}` : "";

  const datasetDescription = node.id
    ? ""
    : describeDataAttributes(node);

  const classDescription = Array.from(node.classList)
    .slice(0, MAX_NODE_CLASSES)
    .map((className) => `.${className}`)
    .join("");

  return `<${tagName}${idDescription}${datasetDescription}${classDescription}>`;
}

export function describeTarget(
  target: EventTarget | Node | ParentNode | null,
): string {
  if (target == null) {
    return "null";
  }

  if (
    typeof window !== "undefined" &&
    target === window
  ) {
    return "window";
  }

  if (
    typeof Document !== "undefined" &&
    target instanceof Document
  ) {
    return "document";
  }

  if (
    typeof ShadowRoot !== "undefined" &&
    target instanceof ShadowRoot
  ) {
    return target.host
      ? `#shadow-root(${describeNode(target.host)})`
      : "#shadow-root";
  }

  if (
    typeof Element !== "undefined" &&
    target instanceof Element
  ) {
    return describeNode(target);
  }

  if (
    typeof Node !== "undefined" &&
    target instanceof Node
  ) {
    return target.nodeName;
  }

  return getConstructorName(target) ?? typeof target;
}

function describeDataAttributes(element: Element): string {
  const attributes = Array.from(element.attributes);

  const dataAttributes = attributes
    .filter((attribute) =>
      attribute.name.startsWith(DATA_ATTRIBUTE_PREFIX),
    )
    .sort(compareDataAttributes)
    .slice(0, MAX_NODE_DATASET_ENTRIES)
    .map((attribute) => {
      const key = attribute.name.slice(DATA_ATTRIBUTE_PREFIX.length);
      const value = attribute.value.trim();

      if (!value) {
        return key;
      }

      return `${key}=${truncate(
        value,
        MAX_NODE_DATASET_VALUE_LENGTH,
      )}`;
    });

  return dataAttributes.length > 0
    ? `:${dataAttributes.join(":")}`
    : "";
}

function compareDataAttributes(
  left: Attr,
  right: Attr,
): number {
  return (
    dataAttributePriority(left.name) -
      dataAttributePriority(right.name) ||
    left.name.localeCompare(right.name)
  );
}

function dataAttributePriority(name: string): number {
  switch (name) {
    case "data-testid":
      return 0;

    case "data-test":
      return 1;

    case "data-cy":
      return 2;

    case "data-qa":
      return 3;

    case "data-id":
      return 4;

    default:
      return 10;
  }
}

const MAX_NODE_PATH_DEPTH = 8;

const NODE_PATH_DATA_ATTRIBUTES = [
  "data-testid",
  "data-test",
  "data-cy",
  "data-qa",
  "data-id",
] as const;

export function nodePath(node: Node): string {
  if (!(node instanceof Element)) {
    return describeNode(node);
  }
  const parts: string[] = [];
  let current: Element | null = node;
  let depth = 0;
  while (current && depth < MAX_NODE_PATH_DEPTH) {
    const part = describePathElement(current);
    parts.unshift(part);
    depth += 1;
    if (current.id) {
      break;
    }
    const root = current.getRootNode();
    const parent = current.parentElement as Element;
    if (parent) {
      current = parent;
      continue;
    }
    /*
     * parentElement é null para elementos diretamente dentro
     * de um ShadowRoot. Incluímos o host e marcamos a fronteira
     * com ::shadow.
     */
    if (
      typeof ShadowRoot !== "undefined" &&
      root instanceof ShadowRoot
    ) {
      parts.unshift("::shadow");
      current = root.host;
      continue;
    }
    current = null;
  }
  const path = parts.join(" > ");
  debugTrace("dom", "nodePath", {
    node: describeNode(node),
    path,
    depth,
  });
  return path;
}

function describePathElement(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  if (element.id) {
    return `${tagName}#${escapeCssIdentifier(element.id)}`;
  }
  const dataSelector = getStableDataSelector(element);
  if (dataSelector) {
    return `${tagName}${dataSelector}`;
  }
  const classSelector = getStableClassSelector(element);
  let selector = `${tagName}${classSelector}`;
  if (!isUniqueAmongSiblings(element, selector)) {
    selector += `:nth-of-type(${getElementIndexOfType(element)})`;
  }
  return selector;
}

function getStableDataSelector(
  element: Element,
): string {
  for (const attributeName of NODE_PATH_DATA_ATTRIBUTES) {
    const value = element.getAttribute(attributeName);
    if (!value) {
      continue;
    }
    return `[${attributeName}="${escapeCssString(value)}"]`;
  }
  return "";
}
function getStableClassSelector(
  element: Element,
): string {
  return Array.from(element.classList)
    .filter(isUsefulPathClass)
    .slice(0, 2)
    .map((className) => `.${escapeCssIdentifier(className)}`)
    .join("");
}
function isUsefulPathClass(className: string): boolean {
  if (!className) {
    return false;
  }
  /*
   * Evita classes geradas por CSS-in-JS, hashes e estados
   * excessivamente voláteis quando houver classes melhores.
   */
  if (/^(active|selected|hover|focus|open|closed|disabled)$/i.test(className)) {
    return false;
  }
  if (/^[a-z0-9_-]{8,}$/i.test(className) && /\d/.test(className)) {
    return false;
  }
  return true;
}
function isUniqueAmongSiblings(
  element: Element,
  selector: string,
): boolean {
  const parent = element.parentElement;
  if (!parent) {
    return true;
  }
  try {
    let matches = 0;
    for (const child of parent.children) {
      if (child.matches(selector)) {
        matches += 1;
        if (matches > 1) {
          return false;
        }
      }
    }
    return matches === 1;
  } catch {
    return false;
  }
}
function getElementIndexOfType(
  element: Element,
): number {
  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
    sibling = sibling.previousElementSibling;
  }
  return index;
}
function escapeCssIdentifier(
  value: string,
): string {
  if (
    typeof CSS !== "undefined" &&
    typeof CSS.escape === "function"
  ) {
    return CSS.escape(value);
  }
  /*
   * Fallback seguro para navegadores antigos, userscripts
   * e ambientes DOM incompletos.
   */
  return String(value).replace(
    /(^-?\d)|[^a-zA-Z0-9_-]/g,
    (character, leadingDigit: string | undefined) => {
      if (leadingDigit) {
        return `\\3${character} `;
      }
      const codePoint = character.codePointAt(0);
      return codePoint == null
        ? ""
        : `\\${codePoint.toString(16)} `;
    },
  );
}

function escapeCssString(
  value: string,
): string {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\a ")
    .replaceAll("\r", "\\d ")
    .replaceAll("\f", "\\c ");
}

/* ******************** */
/* Devtools boundaries  */
/* ******************** */

export function isDevtoolsNode(
  value: EventTarget | Node | null,
  host?: HTMLElement | null,
): boolean {
  if (!host || !isNode(value)) {
    return false;
  }

  if (value === host || host.contains(value)) {
    return true;
  }

  const root = value.getRootNode();

  if (!(root instanceof ShadowRoot)) {
    return false;
  }

  return root.host === host || host.contains(root.host);
}

/* ******************** */
/* Device and viewport  */
/* ******************** */

export function detectMobile(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const coarsePointer =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches;

  const mobileUserAgent =
    MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent);

  return coarsePointer || mobileUserAgent;
}

export function viewportScale(): number {
  if (typeof document === "undefined") {
    return 1;
  }

  const viewport = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]',
  );

  const content = viewport?.content ?? "";

  const match = content.match(
    /(?:^|,|\s)initial-scale\s*=\s*([0-9]*\.?[0-9]+)/i,
  );

  if (!match) {
    return 1;
  }

  const scale = Number.parseFloat(match[1]);

  return Number.isFinite(scale) && scale > 0
    ? scale
    : 1;
}

/* ******************** */
/* Timing               */
/* ******************** */

export function debounce<
  T extends (...args: never[]) => unknown,
>(
  fn: T,
  wait: number,
): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const delay =
    Number.isFinite(wait) && wait > 0
      ? wait
      : 0;

  return (...args: Parameters<T>): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delay);
  };
}

/* ******************** */
/* Icons                */
/* ******************** */

export function icon(name: IconName | string): IconNode {
  if (typeof document === "undefined") {
    return "•";
  }

  const body = ICONS[name as IconName];

  if (!body) {
    return document.createTextNode("•");
  }

  const svg = document.createElementNS(
    SVG_NAMESPACE,
    "svg",
  );

  setAttributes(svg, {
    viewBox: "0 0 24 24",
    width: "1em",
    height: "1em",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  });

  svg.classList.add("roderuda-lucide-icon");

  svg.innerHTML = trustedHtml(body) as string;

  return svg;
}

function setAttributes(
  element: Element,
  attributes: Readonly<Record<string, string>>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

/* ******************** */
/* Events               */
/* ******************** */

export function delegate(
  target: EventTarget,
  type: string,
  selector: string,
  listener: (
    event: Event,
    element: HTMLElement,
  ) => void,
): Cleanup {
  debugTrace("dom", "delegate", {
    target: describeTarget(target),
    type,
    selector,
  });

  return on(
    target,
    type,
    ((event: Event): void => {
      const match = findDelegatedElement(
        event,
        selector,
        target,
      );

      if (!match) {
        return;
      }

      debugTrace("dom", "delegate:match", {
        type,
        selector,
        origin: describeTarget(event.target),
        match: describeTarget(match),
      });

      listener(event, match);
    }) as EventListener,
  );
}

function findDelegatedElement(
  event: Event,
  selector: string,
  delegationTarget: EventTarget,
): HTMLElement | null {
  /*
   * composedPath permite encontrar elementos que originaram o evento
   * através de Shadow DOM aberto.
   */
  const path =
    typeof event.composedPath === "function"
      ? event.composedPath()
      : [];

  for (const item of path) {
    if (item === delegationTarget) {
      break;
    }

    if (
      item instanceof HTMLElement &&
      item.matches(selector)
    ) {
      return item;
    }
  }

  const origin = event.target;

  if (!(origin instanceof Element)) {
    return null;
  }

  const match = origin.closest<HTMLElement>(selector);

  if (!match) {
    return null;
  }

  if (
    delegationTarget instanceof Node &&
    !delegationTarget.contains(match)
  ) {
    return null;
  }

  return match;
}

export function describeEventOptions(
  options?: AddEventListenerOptions | boolean,
): string {
  if (typeof options === "boolean") {
    return options ? "capture" : "bubble";
  }

  if (!options) {
    return "default";
  }

  const descriptions: string[] = [];

  if (options.capture != null) {
    descriptions.push(`capture:${Boolean(options.capture)}`);
  }

  if (options.once != null) {
    descriptions.push(`once:${Boolean(options.once)}`);
  }

  if (options.passive != null) {
    descriptions.push(`passive:${Boolean(options.passive)}`);
  }

  if (options.signal) {
    descriptions.push(
      `signal:${options.signal.aborted ? "aborted" : "active"}`,
    );
  }

  return descriptions.join(",") || "default";
}

/* ******************** */
/* Escaping             */
/* ******************** */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value)
    .replaceAll("`", "&#96;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\r", "&#13;");
}

/* ******************** */
/* String formatting    */
/* ******************** */

export function truncate(
  value: string,
  max = 120,
): string {
  const text = String(value);

  if (!Number.isFinite(max)) {
    return text;
  }

  const limit = Math.max(0, Math.trunc(max));

  if (text.length <= limit) {
    return text;
  }

  if (limit === 0) {
    return "";
  }

  if (limit === 1) {
    return "…";
  }

  return `${text.slice(0, limit - 1)}…`;
}

export function toCssPropertyName(
  property: string,
): string {
  if (property.startsWith("--")) {
    return property;
  }

  return property.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
}

/* ******************** */
/* Number formatting    */
/* ******************** */

export function formatBytes(
  bytes?: number,
): string {
  if (
    bytes == null ||
    !Number.isFinite(bytes)
  ) {
    return "—";
  }

  const absoluteBytes = Math.abs(bytes);
  const sign = bytes < 0 ? "-" : "";

  if (absoluteBytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"] as const;

  let value = absoluteBytes / 1024;
  let unitIndex = 0;

  while (
    value >= 1024 &&
    unitIndex < units.length - 1
  ) {
    value /= 1024;
    unitIndex += 1;
  }

  const formatted =
    value >= 100
      ? value.toFixed(0)
      : value >= 10
        ? value.toFixed(1)
        : value.toFixed(2);

  return `${sign}${formatted} ${units[unitIndex]}`;
}

export function formatDuration(
  milliseconds?: number,
): string {
  if (
    milliseconds == null ||
    !Number.isFinite(milliseconds)
  ) {
    return "—";
  }

  if (milliseconds < 1) {
    return `${milliseconds.toFixed(2)} ms`;
  }

  if (milliseconds < 10) {
    return `${milliseconds.toFixed(1)} ms`;
  }

  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(0)} ms`;
  }

  if (milliseconds < 60_000) {
    return `${(milliseconds / 1000).toFixed(2)} s`;
  }

  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = (milliseconds % 60_000) / 1000;

  return `${minutes}m ${seconds.toFixed(1)}s`;
}

export function formatTime(
  timestamp: number,
): string {
  if (!Number.isFinite(timestamp)) {
    return "—";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const time = date.toLocaleTimeString([], {
    hour12: false,
  });

  const milliseconds = String(
    date.getMilliseconds(),
  ).padStart(3, "0");

  return `${time}.${milliseconds}`;
}

/* ******************** */
/* Internal helpers     */
/* ******************** */

function isNode(value: unknown): value is Node {
  return (
    typeof Node !== "undefined" &&
    value instanceof Node
  );
}

function getConstructorName(
  value: object,
): string | undefined {
  const constructor = (
    value as {
      constructor?: {
        name?: unknown;
      };
    }
  ).constructor;

  return typeof constructor?.name === "string"
    ? constructor.name
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}
