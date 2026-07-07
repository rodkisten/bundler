import { create, describeNode, escapeHtml, safeStringify, truncate } from "./dom";

export interface RenderValueOptions {
  depth?: number;
  maxDepth?: number;
  maxEntries?: number;
  onNodeSelect?: (node: Node) => void;
}

type Callable = (...args: unknown[]) => unknown;

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_ENTRIES = 100;
const MORE_KEY = "…";

export function renderValue(value: unknown, options: RenderValueOptions = {}): Node {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;

  if (value === null) return span("roderuda-value roderuda-value-null", "null");
  if (value === undefined) return span("roderuda-value roderuda-value-undefined", "undefined");

  const type = typeof value;

  if (type === "string") return span("roderuda-value roderuda-value-string", JSON.stringify(value));
  if (type === "number") return span("roderuda-value roderuda-value-number", String(value));
  if (type === "bigint") return span("roderuda-value roderuda-value-bigint", `${value}n`);
  if (type === "boolean") return span("roderuda-value roderuda-value-boolean", String(value));
  if (type === "symbol") return span("roderuda-value roderuda-value-keyword", String(value));

  if (type === "function") {
    const fn = value as Callable & { name?: string };
    const summary = `[Function ${fn.name || "anonymous"}]`;

    if (depth >= maxDepth) return span("roderuda-value roderuda-value-function", summary);

    return renderObject(fn, summary, {
      ...options,
      depth,
      maxDepth,
      maxEntries,
    });
  }

  if (isError(value)) return renderError(value);

  if (isDomNode(value)) {
    const node = span("roderuda-value roderuda-value-node", describeNode(value));
    node.tabIndex = 0;
    node.role = "button";
    node.addEventListener("click", () => options.onNodeSelect?.(value));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        options.onNodeSelect?.(value);
      }
    });
    return node;
  }

  if (value instanceof Date) {
    return span("roderuda-value roderuda-value-string", Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString());
  }

  if (value instanceof RegExp) return span("roderuda-value roderuda-value-keyword", String(value));
  if (value instanceof Promise) return renderObject(value, "Promise", { ...options, depth, maxDepth, maxEntries });

  if (value && typeof value === "object") {
    return renderObject(value, objectSummary(value), {
      ...options,
      depth,
      maxDepth,
      maxEntries,
    });
  }

  return span("roderuda-value", String(value));
}

function renderError(error: Error): Node {
  const details = create("details", { className: "roderuda-object roderuda-value-error" });
  details.append(create("summary", { text: `${error.name}: ${error.message}` }));

  const body = create("div", { className: "roderuda-object-body" });
  body.append(create("pre", { className: "roderuda-pre", text: error.stack || String(error) }));
  details.append(body);

  return details;
}

function renderObject(
  value: object,
  summary: string,
  options: Required<Pick<RenderValueOptions, "depth" | "maxDepth" | "maxEntries">> & RenderValueOptions,
): Node {
  if (options.depth >= options.maxDepth) return span("roderuda-value", summary);

  const details = create("details", { className: "roderuda-object" });
  details.append(create("summary", { text: summary }));

  const body = create("div", { className: "roderuda-object-body" });
  details.append(body);

  let rendered = false;

  details.addEventListener("toggle", () => {
    if (!details.open || rendered) return;

    rendered = true;

    const entries = getEntries(value, options.maxEntries);

    if (!entries.length) {
      body.append(span("roderuda-value roderuda-value-undefined", "(empty)"));
      return;
    }

    for (const [key, entry] of entries) {
      const row = create("div", { className: "roderuda-object-row" });
      row.append(span("roderuda-object-key", `${key}:`));
      row.append(renderValue(entry, { ...options, depth: options.depth + 1 }));
      body.append(row);
    }
  });

  return details;
}

function getEntries(value: object, maxEntries: number): Array<[string, unknown]> {
  if (maxEntries <= 0) return [[MORE_KEY, "entries hidden"]];

  if (value instanceof Map) return mapEntries(value, maxEntries);
  if (value instanceof Set) return setEntries(value, maxEntries);

  const output: Array<[string, unknown]> = [];
  const seen = new Set<PropertyKey>();
  let current: object | null = value;
  let totalSeen = 0;

  while (current && output.length < maxEntries) {
    for (const key of Reflect.ownKeys(current)) {
      if (seen.has(key)) continue;

      seen.add(key);
      totalSeen += 1;

      const label = typeof key === "symbol" ? key.toString() : key;

      let entry: unknown;

      try {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);

        // Avoid executing getter-only properties in a console inspector.
        // Getters can be expensive, mutate state, or throw intentionally.
        if (descriptor?.get && !descriptor.set) entry = "[Getter]";
        else entry = Reflect.get(value, key);
      } catch (error) {
        entry = error;
      }

      output.push([label, entry]);

      if (output.length >= maxEntries) break;
    }

    current = Object.getPrototypeOf(current) as object | null;
  }

  if (totalSeen > output.length) {
    output.push([MORE_KEY, `${totalSeen - output.length}+ more`]);
  }

  return output;
}

function mapEntries(value: Map<unknown, unknown>, maxEntries: number): Array<[string, unknown]> {
  const output: Array<[string, unknown]> = [];
  let index = 0;

  for (const [key, entry] of value) {
    if (index >= maxEntries) break;
    output.push([`Map(${previewText(key, 48)})`, entry]);
    index += 1;
  }

  if (value.size > output.length) output.push([MORE_KEY, `${value.size - output.length}+ more`]);

  return output;
}

function setEntries(value: Set<unknown>, maxEntries: number): Array<[string, unknown]> {
  const output: Array<[string, unknown]> = [];
  let index = 0;

  for (const entry of value) {
    if (index >= maxEntries) break;
    output.push([String(index), entry]);
    index += 1;
  }

  if (value.size > output.length) output.push([MORE_KEY, `${value.size - output.length}+ more`]);

  return output;
}

function objectSummary(value: object): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  if (ArrayBuffer.isView(value)) return `${value.constructor.name}(${value.byteLength})`;
  if (value instanceof ArrayBuffer) return `ArrayBuffer(${value.byteLength})`;

  const constructorName = value.constructor?.name;
  if (constructorName && constructorName !== "Object") return constructorName;

  try {
    const keys = Object.keys(value);
    const preview = keys.slice(0, 3).join(", ");
    return keys.length ? `{ ${preview}${keys.length > 3 ? ", …" : ""} }` : "{}";
  } catch {
    return "Object";
  }
}

function span(className: string, text: string): HTMLSpanElement {
  return create("span", { className, text });
}

export function plainText(value: unknown): string {
  if (typeof value === "string") return value;
  if (isError(value)) return value.stack || `${value.name}: ${value.message}`;
  if (isDomNode(value)) return value instanceof Element ? value.outerHTML : describeNode(value);
  if (typeof value === "function") return String(value);
  if (typeof value === "symbol") return String(value);
  if (value && typeof value === "object") return safeStringify(value);
  return String(value);
}

export function highlightCode(code: string, type: string): string {
  if (type === "html") return highlightHtml(code);
  if (type === "css") return highlightCss(code);
  if (type === "json") return highlightJson(code);
  return highlightJavaScriptLike(code);
}

function highlightHtml(code: string): string {
  return escapeHtml(code)
    .replace(
      /(&lt;\/?)([\w:-]+)([\s\S]*?)(\/?&gt;)/g,
      (_all, open: string, tag: string, attrs: string, close: string) => {
        const highlightedAttrs = attrs.replace(
          /([\w:-]+)(=)(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|[^\s]+)/g,
          '<span class="token-attr">$1</span>$2<span class="token-string">$3</span>',
        );

        return `${open}<span class="token-tag">${tag}</span>${highlightedAttrs}${close}`;
      },
    )
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="token-comment">$1</span>');
}

function highlightCss(code: string): string {
  return escapeHtml(code)
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>')
    .replace(/(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;)/g, '<span class="token-string">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms)?)\b/g, '<span class="token-number">$1</span>')
    .replace(/(^|[;{]\s*)(--?[\w-]+|[a-zA-Z-]+)(\s*:)/gm, '$1<span class="token-attr">$2</span>$3');
}

function highlightJson(code: string): string {
  return escapeHtml(code)
    .replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?/g, (_all, value: string, colon: string | undefined) => {
      return colon ? `<span class="token-attr">${value}</span>${colon}` : `<span class="token-string">${value}</span>`;
    })
    .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="token-keyword">$1</span>');
}

function highlightJavaScriptLike(code: string): string {
  return escapeHtml(code)
    .replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="token-comment">$1</span>')
    .replace(/(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|`[\s\S]*?`)/g, '<span class="token-string">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')
    .replace(
      /\b(const|let|var|function|class|extends|return|if|else|for|while|switch|case|break|continue|new|this|typeof|instanceof|in|of|await|async|try|catch|finally|throw|import|export|from|default|true|false|null|undefined|interface|type|enum|public|private|protected|readonly|static)\b/g,
      '<span class="token-keyword">$1</span>',
    );
}

export function withLineNumbers(highlighted: string): string {
  return highlighted
    .split("\n")
    .map((line, index) => `<span class="roderuda-line" data-line="${index + 1}">${line || " "}</span>`)
    .join("");
}

export function inferSourceType(value: unknown, url = ""): string {
  if (value && typeof value === "object") return "object";

  const lower = url.toLowerCase();

  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/.test(lower)) return "image";
  if (/\.css(?:[?#]|$)/.test(lower)) return "css";
  if (/\.(m?js|cjs|jsx|ts|tsx)(?:[?#]|$)/.test(lower)) return "javascript";
  if (/\.json(?:[?#]|$)/.test(lower)) return "json";
  if (/\.html?(?:[?#]|$)/.test(lower)) return "html";

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^[{[]/.test(trimmed)) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // Not JSON.
      }
    }

    if (/^<!doctype|^<html|<\w+[\s>]/i.test(trimmed)) return "html";
    if (looksLikeCss(trimmed)) return "css";
    if (looksLikeJavaScript(trimmed)) return "javascript";
  }

  return "text";
}

export function previewText(value: unknown, max = 160): string {
  return truncate(plainText(value).replace(/\s+/g, " ").trim(), max);
}

function looksLikeCss(value: string): boolean {
  return /(?:^|[\s}])(?:[.#]?[\w-]+|\*)\s*\{[\s\S]*?:[\s\S]*?\}/.test(value);
}

function looksLikeJavaScript(value: string): boolean {
  return /\b(?:const|let|var|function|class|import|export|return|async|await)\b/.test(value);
}

/**
 * Returns whether a value behaves like an Error.
 *
 * Supports:
 * - native Error
 * - subclasses of Error
 * - cross-realm Errors (iframe, workers)
 * - serialized / plain error objects
 */
export function isError(value: unknown): value is Error {
  if (value instanceof Error) {
    return true;
  }

  if (value == null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<Error>;

  return (
    typeof candidate.name === "string" &&
    typeof candidate.message === "string"
  );
}

function isDomNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}
