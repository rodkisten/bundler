import { ConfigStore } from "@rodkisten/devtools/core-config";
import {
  mountCodeEditor,
  type CodeEditorHandle,
  type CodeEditorLanguage,
} from "@rodkisten/devtools/core-code-editor";
import {
  copyText,
  downloadText,
  icon,
  isDevtoolsNode,
} from "@rodkisten/devtools/utils";
import {
  inferSourceType,
  plainText,
  renderValue,
} from "@rodkisten/devtools/core-serialize";
import {
  event,
  html,
  
  render,
} from "@rodkisten/devtools/core-runtime";
import { Tool } from "@rodkisten/devtools/core-tool";
import type {
  NetworkRecord,
  SourcePayload,
  SourceType,
  SourcesConfig,
  ToolContext,
  ToolLike,
} from "@rodkisten/devtools/types";
import {
  type SourcesViewModel,
} from "@rodkisten/devtools/panels-sources-components";
import { UserscriptApi, UserscriptRequest, UserscriptResponse, MAX_FORMAT_SOURCE_LENGTH } from "@rodkisten/devtools/panels-sources";
import { at, clone, compactMapArray, concatArrays, forEachArray, includesArray, joinArray, mapArray, mapFilterArray, mapJoinArray, splitLines, splitNonEmpty, splitTrimmedNonEmpty, toArray } from "@rodkisten/nascente";

export function isSourcePayload(
  value: SourcePayload | SourceType | string,
): value is SourcePayload {
  return (
    value !== null
    && typeof value === "object"
    && "type" in value
  );
}

export function collectSources(): SourcePayload[] {
  const sources: SourcePayload[] = [
    {
      type: "html",
      value: serializeDocumentSource,
      title: "Document HTML",
      url: location.href,
    },
  ];
  const seenUrls = new Set<string>();

  for (let index = 0; index < document.scripts.length; index++) {
    const script = document.scripts[index]!;
    if (isDevtoolsNode(script)) continue;

    if (script.src) {
      const normalized = normalizeSourceUrl(script.src);
      if (seenUrls.has(normalized)) continue;
      seenUrls.add(normalized);
      sources.push({
        type: "javascript",
        value: script.src,
        url: script.src,
        title: script.src,
      });
    } else if (script.textContent?.trim()) {
      sources.push({
        type: inferInlineScriptType(script.type),
        value: script.textContent,
        title: `Inline script #${index + 1}`,
      });
    }
  }

  const inlineStyles = document.querySelectorAll("style");
  for (let index = 0; index < inlineStyles.length; index++) {
    const style = inlineStyles[index]!;
    if (isDevtoolsNode(style) || !style.textContent?.trim()) continue;
    sources.push({
      type: "css",
      value: style.textContent,
      title: `Inline stylesheet #${index + 1}`,
    });
  }

  const stylesheetUrls = concatArrays(
    mapArray(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'), (link) => link.href),
    mapFilterArray(document.styleSheets, (sheet) => sheet.href, (href): href is string => Boolean(href)),
  );

  for (const url of stylesheetUrls) {
    const normalized = normalizeSourceUrl(url);
    if (seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);
    sources.push({
      type: "css",
      value: url,
      url,
      title: url,
    });
  }

  return sources;
}

export function serializeDocumentSource(): string {
  const devtoolsHost = document.querySelector<HTMLElement>("#roderuda,.__roderuda-host__");

  // Shadow DOM content is not included by outerHTML, so the common path can
  // serialize without cloning the whole page. Light-DOM installations need a
  // cleaned clone to avoid recursively embedding the DevTools UI in Sources.
  if (!devtoolsHost || devtoolsHost.shadowRoot) {
    return `<!doctype html>\n${document.documentElement.outerHTML}`;
  }

  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  forEachArray(clone.querySelectorAll(
    "#roderuda,.__roderuda-host__,.__roderuda-overlay__,[data-roderuda-root],[data-roderuda-internal]",
  ), (node) => node.remove());
  return `<!doctype html>\n${clone.outerHTML}`;
}

export function inferInlineScriptType(type: string): SourceType {
  return /json|ld\+json/i.test(type) ? "json" : "javascript";
}

export function inferTextSourceType(
  requestedType: SourceType | string,
  sourceHint: string,
  value?: string,
): CodeEditorLanguage {
  if (includesArray(["html", "css", "javascript", "json"], requestedType)) {
    return requestedType as CodeEditorLanguage;
  }

  const inferred = inferSourceType(value ?? "", sourceHint);
  if (includesArray(["html", "css", "javascript", "json"], inferred)) {
    return inferred as CodeEditorLanguage;
  }

  return "text";
}

export function readCurrentDocumentSource(url: string, type: string): string | null {
  if (type !== "html") return null;
  return normalizeSourceUrl(url) === normalizeSourceUrl(location.href)
    ? serializeDocumentSource()
    : null;
}

export function readStylesheetSource(url: string): string | null {
  const normalized = normalizeSourceUrl(url);

  for (const stylesheet of toArray(document.styleSheets)) {
    if (!stylesheet.href || normalizeSourceUrl(stylesheet.href) !== normalized) continue;

    try {
      return mapJoinArray(stylesheet.cssRules, (rule) => rule.cssText, "\n");
    } catch {
      return null;
    }
  }

  return null;
}

export async function readCachedSource(url: string, failures: string[]): Promise<string | null> {
  if (typeof caches === "undefined") return null;

  try {
    const response = await caches.match(url);
    if (!response) return null;
    return await response.text();
  } catch (error) {
    failures.push(`cache: ${sourceErrorMessage(error)}`);
    return null;
  }
}

export async function fetchSourceText(url: string, signal: AbortSignal): Promise<string> {
  const target = new URL(url, location.href);
  const response = await fetch(target.href, {
    signal,
    cache: "no-cache",
    credentials: target.origin === location.origin ? "include" : "omit",
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return response.text();
}

export async function readUserscriptSource(
  url: string,
  failures: string[],
  requestTimeout: number,
): Promise<string | null> {
  const globalScope = globalThis as typeof globalThis & {
    GM?: UserscriptApi;
    GM_xmlhttpRequest?: UserscriptRequest;
  };

  const request = globalScope.GM?.xmlHttpRequest
    ? globalScope.GM.xmlHttpRequest.bind(globalScope.GM)
    : globalScope.GM_xmlhttpRequest;

  if (!request) return null;

  try {
    return await new Promise<string>((resolve, reject) => {
      let settled = false;

      const settle = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        callback();
      };

      const handleResponse = (
        response: UserscriptResponse,
      ): void => {
        settle(() => {
          const status = response.status ?? 200;

          if (status < 200 || status >= 400) {
            reject(
              new Error(
                `${status} ${response.statusText ?? ""}`.trim(),
              ),
            );
            return;
          }

          resolve(
            String(
              response.responseText
              ?? response.response
              ?? "",
            ),
          );
        });
      };

      const result = request({
        method: "GET",
        url,
        responseType: "text",
        timeout: requestTimeout,
        onload: handleResponse,
        onerror: (error: unknown): void => {
          settle(() => reject(error));
        },
        ontimeout: (): void => {
          settle(() => {
            reject(new Error("Request timed out"));
          });
        },
        onabort: (): void => {
          settle(() => {
            reject(
              new DOMException(
                "Request aborted",
                "AbortError",
              ),
            );
          });
        },
      });

      if (isPromiseLike<UserscriptResponse>(result)) {
        void result.then(
          handleResponse,
          (error: unknown): void => {
            settle(() => reject(error));
          },
        );
      }
    });
  } catch (error: unknown) {
    failures.push(
      `userscript request: ${sourceErrorMessage(error)}`,
    );

    return null;
  }
}

export function sourceFailureText(type: string, url: string, failures: readonly string[]): string {
  const detail = failures.length ? joinArray(failures, "\n") : "No readable response body was available.";
  const message = joinArray([
    "RodEruda could not read this resource from the page context.",
    `URL: ${url || "unknown"}`,
    "Tried: current DOM/CSSOM, captured Network responses, Cache Storage, fetch and userscript cross-origin request.",
    detail,
  ], "\n");

  if (type === "html") return `<!--\n${message}\n-->`;
  if (type === "json") {
    return JSON.stringify({
      error: "RodEruda could not read this resource from the page context.",
      url: url || "unknown",
      attempts: failures,
    }, null, 2);
  }
  if (type === "css" || type === "javascript") return `/*\n${message}\n*/`;
  return message;
}

export function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value, location.href);
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

export function isPromiseLike<Value>(value: unknown): value is PromiseLike<Value> {
  return value !== null
    && typeof value === "object"
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function";
}

export function sourceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);

    return (
      /^(https?:|blob:|data:|file:)$/.test(url.protocol)
      && (
        value.includes(":")
        || value.startsWith("/")
        || value.startsWith(".")
      )
    );
  } catch {
    return false;
  }
}

export function formatJson(
  value: unknown,
  indentSize = 2,
): string {
  try {
    const data = typeof value === "string"
      ? JSON.parse(value)
      : value;

    return JSON.stringify(data, null, indentSize);
  } catch {
    return String(value);
  }
}

export function sourceLanguage(
  type: string,
): CodeEditorLanguage {
  switch (type) {
    case "javascript":
      return "javascript";

    case "json":
      return "json";

    case "html":
      return "html";

    case "css":
      return "css";

    default:
      return "text";
  }
}

export function formatSource(
  source: string,
  type: string,
  indentSize: number,
  maxLength = MAX_FORMAT_SOURCE_LENGTH,
): string {
  // Formatting allocates a second representation of the whole source. Keep
  // syntax highlighting for large files, but avoid a synchronous formatter
  // pass that can freeze mobile pages for several seconds.
  if (source.length > Math.max(1_000, maxLength)) return source;

  switch (type) {
    case "json":
      return formatJson(source, indentSize);

    case "html":
      return formatHtml(source, indentSize);

    case "css":
      return formatCss(source, indentSize);

    case "javascript":
      return formatJavaScript(source, indentSize);

    default:
      return source;
  }
}

export function formatHtml(
  source: string,
  indentSize: number,
): string {
  const embedded: string[] = [];
  const protectedSource = source.replace(
    /<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, attributes = "", content: string) => {
      const language = tag.toLowerCase() === "style" ? "css" : "javascript";
      const formatted = language === "css"
        ? formatCss(content.trim(), indentSize)
        : formatJavaScript(content.trim(), indentSize);
      const token = `<roderuda-embedded data-index="${embedded.length}"/>`;
      embedded.push(`<${tag}${attributes}>\n${indentBlock(formatted, indentSize)}\n</${tag}>`);
      return token;
    },
  );

  const tokens = splitTrimmedNonEmpty(
    protectedSource.replace(/>\s*</g, "><"),
    /(?=<)|(?<=>)/,
  );

  let depth = 0;
  const output = mapArray(tokens, (trimmed) => {
    const embeddedMatch = /^<roderuda-embedded data-index="(\d+)"\/>$/.exec(trimmed);
    if (embeddedMatch) {
      const block = embedded[Number(embeddedMatch[1])] ?? "";
      return indentBlock(block, depth * indentSize);
    }

    if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
    const line = `${" ".repeat(depth * indentSize)}${trimmed}`;
    const opensContainer =
      /^<[^!/][^>]*[^/]>/i.test(trimmed)
      && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(trimmed)
      && !trimmed.includes("</");
    if (opensContainer) depth += 1;
    return line;
  });

  return joinArray(output, "\n");
}

export function indentBlock(value: string, spaces: number): string {
  const prefix = " ".repeat(Math.max(0, spaces));
  return mapJoinArray(splitLines(value), (line) => `${prefix}${line}`, "\n");
}

export function formatCss(
  source: string,
  indentSize: number,
): string {
  let depth = 0;

  return joinArray(compactMapArray(splitLines(source
    .replace(/\s*([{};])\s*/g, "$1\n")), (line) => {
      const trimmed = line.trim();

      if (!trimmed) return "";

      if (trimmed.startsWith("}")) {
        depth = Math.max(0, depth - 1);
      }

      const output =
        `${" ".repeat(depth * indentSize)}${trimmed}`;

      if (trimmed.endsWith("{")) {
        depth += 1;
      }

      return output;
    }), "\n");
}

export function formatJavaScript(
  source: string,
  indentSize: number,
): string {
  let depth = 0;
  let output = "";
  let quote = "";
  let escaped = false;

  for (
    let index = 0;
    index < source.length;
    index += 1
  ) {
    const char = source[index]!;

    if (quote) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }

      continue;
    }

    if (
      char === '"'
      || char === "'"
      || char === "`"
    ) {
      quote = char;
      output += char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      output += `{\n${" ".repeat(depth * indentSize)}`;
      continue;
    }

    if (char === "}") {
      depth = Math.max(0, depth - 1);
      output =
        `${output.trimEnd()}\n${" ".repeat(depth * indentSize)}}`;
      continue;
    }

    if (char === ";") {
      output += `;\n${" ".repeat(depth * indentSize)}`;
      continue;
    }

    output += char;
  }

  return output
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function fileNameFor(
  payload: SourcePayload,
): string {
  const source =
    payload.url
    || payload.title
    || "source.txt";

  try {
    const pathname = new URL(
      source,
      location.href,
    ).pathname;

    return at(splitNonEmpty(pathname, "/"), -1)
      || defaultExtensionFor(payload.type);
  } catch {
    return defaultExtensionFor(payload.type);
  }
}

export function defaultExtensionFor(
  type: SourcePayload["type"],
): string {
  switch (type) {
    case "html":
      return "source.html";

    case "css":
      return "source.css";

    case "javascript":
      return "source.js";

    case "json":
    case "object":
      return "source.json";

    default:
      return "source.txt";
  }
}
