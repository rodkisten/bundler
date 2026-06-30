import { create, describeNode, escapeHtml, safeStringify, truncate } from "./dom";

export interface RenderValueOptions {
  depth?: number;
  maxDepth?: number;
  maxEntries?: number;
  onNodeSelect?: (node: Node) => void;
}

export function renderValue(value: unknown, options: RenderValueOptions = {}): Node {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? 4;
  const maxEntries = options.maxEntries ?? 100;

  if (value === null) return span("roderuda-value roderuda-value-null", "null");
  if (value === undefined) return span("roderuda-value roderuda-value-undefined", "undefined");

  const type = typeof value;
  if (type === "string") return span("roderuda-value roderuda-value-string", JSON.stringify(value));
  if (type === "number") return span("roderuda-value roderuda-value-number", String(value));
  if (type === "bigint") return span("roderuda-value roderuda-value-bigint", `${value}n`);
  if (type === "boolean") return span("roderuda-value roderuda-value-boolean", String(value));
  if (type === "symbol") return span("roderuda-value roderuda-value-keyword", String(value));
  if (type === "function") {
    const fn = value as Function;
    const summary = `[Function ${fn.name || "anonymous"}]`;
    if (depth >= maxDepth) return span("roderuda-value roderuda-value-function", summary);
    return renderObject(value as object, summary, { ...options, depth, maxDepth, maxEntries });
  }

  if (value instanceof Error) {
    const details = create("details", { className: "roderuda-object roderuda-value-error" });
    details.append(create("summary", { text: `${value.name}: ${value.message}` }));
    const body = create("div", { className: "roderuda-object-body" });
    body.append(create("pre", { className: "roderuda-pre", text: value.stack || String(value) }));
    details.append(body);
    return details;
  }

  if (value instanceof Node) {
    const node = span("roderuda-value roderuda-value-node", describeNode(value));
    node.addEventListener("click", () => options.onNodeSelect?.(value));
    return node;
  }

  if (value instanceof Date) return span("roderuda-value roderuda-value-string", value.toISOString());
  if (value instanceof RegExp) return span("roderuda-value roderuda-value-keyword", String(value));
  if (value instanceof Promise) return renderObject(value, "Promise", { ...options, depth, maxDepth, maxEntries });

  return renderObject(value as object, objectSummary(value as object), { ...options, depth, maxDepth, maxEntries });
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
      row.append(
        renderValue(entry, {
          ...options,
          depth: options.depth + 1,
        }),
      );
      body.append(row);
    }
  });

  return details;
}

function getEntries(value: object, maxEntries: number): Array<[string, unknown]> {
  const output: Array<[string, unknown]> = [];
  const names = new Set<string>();
  let current: object | null = value;

  while (current && output.length < maxEntries) {
    for (const key of Reflect.ownKeys(current)) {
      const label = typeof key === "symbol" ? key.toString() : key;
      if (names.has(label)) continue;
      names.add(label);
      let entry: unknown;
      try {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
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

  if (names.size >= maxEntries) output.push(["…", `${names.size - maxEntries}+ more`]);
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
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (value instanceof Node) return value instanceof Element ? value.outerHTML : describeNode(value);
  if (typeof value === "function") return value.toString();
  if (value && typeof value === "object") return safeStringify(value);
  return String(value);
}

export function highlightCode(code: string, type: string): string {
  let escaped = escapeHtml(code);

  if (type === "html") {
    escaped = escaped.replace(
      /(&lt;\/?)([\w:-]+)([\s\S]*?)(\/?&gt;)/g,
      (_all, open: string, tag: string, attrs: string, close: string) => {
        const highlightedAttrs = attrs.replace(
          /([\w:-]+)(=)(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|[^\s]+)/g,
          '<span class="token-attr">$1</span>$2<span class="token-string">$3</span>',
        );
        return `${open}<span class="token-tag">${tag}</span>${highlightedAttrs}${close}`;
      },
    );
    return escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="token-comment">$1</span>');
  }

  escaped = escaped
    .replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="token-comment">$1</span>')
    .replace(/(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|`[\s\S]*?`)/g, '<span class="token-string">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')
    .replace(/\b(const|let|var|function|class|extends|return|if|else|for|while|switch|case|break|continue|new|this|typeof|instanceof|in|of|await|async|try|catch|finally|throw|import|export|from|default|true|false|null|undefined|interface|type|enum|public|private|protected|readonly|static)\b/g, '<span class="token-keyword">$1</span>');

  if (type === "css") {
    escaped = escaped.replace(/(^|[;{]\s*)(--?[\w-]+|[a-zA-Z-]+)(\s*:)/gm, '$1<span class="token-attr">$2</span>$3');
  }

  return escaped;
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
    if (/^\s*[\[{]/.test(trimmed)) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // Not JSON.
      }
    }
    if (/^\s*<!doctype|^\s*<html|<\w+[\s>]/i.test(trimmed)) return "html";
  }
  return "text";
}

export function previewText(value: unknown, max = 160): string {
  return truncate(plainText(value).replace(/\s+/g, " ").trim(), max);
}
