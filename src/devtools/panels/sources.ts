import { ConfigStore } from "../core/config";
import {
  mountCodeEditor,
  type CodeEditorHandle,
  type CodeEditorLanguage,
} from "../core/code-editor";
import {
  copyText,
  downloadText,
  icon,
  isDevtoolsNode,
} from "../utils";
import {
  inferSourceType,
  plainText,
  renderValue,
} from "../core/serialize";
import {
  event,
  html,
  ref,
  render,
} from "../core/runtime";
import { Tool } from "../core/tool";
import type {
  NetworkRecord,
  SourcePayload,
  SourceType,
  SourcesConfig,
  ToolContext,
  ToolLike,
} from "../types";
import {
  sourcesStyleArtifacts,
  type SourcesViewModel,
} from "./sources-components";

export { sourcesStyleArtifacts };

type ResolvedSource = {
  type: SourceType | string;
  value: unknown;
  url: string;
};

interface NetworkSourceTool extends ToolLike {
  requests(): NetworkRecord[];
}

interface UserscriptRequestDetails {
  method: "GET";
  url: string;
  responseType: "text";
  timeout: number;
  onload(response: UserscriptResponse): void;
  onerror(error: unknown): void;
  ontimeout(): void;
  onabort(): void;
}

interface UserscriptResponse {
  status?: number;
  statusText?: string;
  response?: unknown;
  responseText?: string;
}

interface UserscriptApi {
  xmlHttpRequest?(details: UserscriptRequestDetails): unknown;
}

type UserscriptRequest = (details: UserscriptRequestDetails) => unknown;

const MAX_FORMAT_SOURCE_LENGTH = 500_000;

const DEFAULT_SOURCE_PAYLOAD: SourcePayload = {
  type: "html",
  value: () => document.documentElement.outerHTML,
  title: typeof location !== "undefined" ? location.href : "Document",
};

export class Sources extends Tool {
  readonly name = "sources";
  readonly title = "sources";
  readonly icon = icon("sources");

  readonly config = new ConfigStore<SourcesConfig>("sources", {
    showLineNum: true,
    formatCode: true,
    indentSize: "2",
    wrapLines: false,
    maxFormatSourceLength: 30_000,
    requestTimeout: 15_000,
    editorFontSize: 12,
    editorTabSize: 2,
    listBottomPadding: 96,
  });

  private body: HTMLElement | null = null;
  private payload: SourcePayload = { ...DEFAULT_SOURCE_PAYLOAD };
  private disposeView: (() => void) | null = null;
  private disposeBody: (() => void) | null = null;
  private renderToken = 0;
  private renderedText = "";
  private editor: CodeEditorHandle | null = null;
  private requestController: AbortController | null = null;
  private destroyed = false;
  private dirty = true;
  private shellTitle = "";
  private indexedSources: SourcePayload[] = [];

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    this.destroyed = false;
    this.dirty = true;
    this.mountShell();
    this.config.on("change", this.onConfigChange);
    this.applyTweakVariables();
    this.registerSettings(context);
  }

  set(payload: SourcePayload): this;
  set(type: SourceType | string, value: unknown): this;
  set(
    typeOrPayload: SourcePayload | SourceType | string,
    value?: unknown,
  ): this {
    this.payload = isSourcePayload(typeOrPayload)
      ? { ...typeOrPayload }
      : {
          type: typeOrPayload as SourceType,
          value,
          title: typeof value === "string"
            ? value
            : String(typeOrPayload),
        };

    this.dirty = true;

    if (this.active) {
      this.mountShell();
      void this.renderSource();
    }

    return this;
  }

  override show(): void {
    super.show();
    this.mountShell();
    if (this.dirty || !this.editor) void this.renderSource();
  }

  override hide(): void {
    super.hide();
    this.abortRequest();
  }

  override destroy(): void {
    this.destroyed = true;
    this.renderToken += 1;

    this.config.off("change", this.onConfigChange);
    this.abortRequest();
    this.destroyEditor();

    this.disposeBody?.();
    this.disposeBody = null;

    this.disposeView?.();
    this.disposeView = null;

    this.body = null;
    this.renderedText = "";
    this.dirty = true;
    this.shellTitle = "";
    this.indexedSources = [];

    super.destroy();
  }

  private readonly onConfigChange = (): void => {
    this.applyTweakVariables();
    this.dirty = true;
    if (this.active) void this.renderSource();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Sources");

    context.settings.registerSwitch(
      this.config,
      "showLineNum",
      "Show line numbers",
    );

    context.settings.registerSwitch(
      this.config,
      "formatCode",
      "Format JSON and source code",
    );

    context.settings.registerSelect(
      this.config,
      "indentSize",
      "Indent size",
      ["2", "4", "8"],
    );

    context.settings.registerSwitch(
      this.config,
      "wrapLines",
      "Wrap long lines",
    );

    if (typeof context.settings.registerNumber === "function") {
      context.settings.registerNumber(
        this.config,
        "maxFormatSourceLength",
        "Max format source length",
        { min: 1_000, max: MAX_FORMAT_SOURCE_LENGTH, step: 1_000 },
      );
    } else {
      context.settings.registerRange(
        this.config,
        "maxFormatSourceLength",
        "Max format source length",
        { min: 1_000, max: MAX_FORMAT_SOURCE_LENGTH, step: 1_000 },
      );
    }

    context.settings.registerNumber(this.config, "requestTimeout", "Source request timeout (ms)", { min: 1000, max: 120000, step: 1000 });
    context.settings.registerNumber(this.config, "editorFontSize", "Source editor font size", { min: 8, max: 32, step: 1 });
    context.settings.registerNumber(this.config, "editorTabSize", "Source editor tab size", { min: 1, max: 8, step: 1 });
    context.settings.registerNumber(this.config, "listBottomPadding", "Sources bottom scroll padding", { min: 0, max: 320, step: 4 });
  }

  private applyTweakVariables(): void {
    this.container?.style.setProperty("--rd-sources-font-size", `${this.config.get("editorFontSize")}px`);
    this.container?.style.setProperty("--rd-sources-bottom-padding", `${this.config.get("listBottomPadding")}px`);
  }

  private mountShell(): void {
    if (!this.container || this.destroyed) return;

    const title = this.sourceTitle();
    if (this.disposeView && this.body && this.shellTitle === title) return;

    this.abortRequest();
    this.destroyEditor();
    this.disposeBody?.();
    this.disposeBody = null;
    this.body = null;

    const view: SourcesViewModel = {
      setBody: (node) => {
        this.body = node;
      },
      action: (name) => {
        this.handleActionName(name);
      },
    };

    this.disposeView?.();
    this.disposeView = render(
      this.container,
      html`
        <RodSourcesView
          view=${view as never}
          title=${title}
        />
      `,
    );

    this.shellTitle = title;
    this.body ??= this.container.querySelector<HTMLElement>("[data-sources-body]");
  }

  private async renderSource(): Promise<void> {
    if (!this.active) {
      this.dirty = true;
      return;
    }

    this.mountShell();
    if (!this.body || !this.container || this.destroyed) return;

    const token = ++this.renderToken;

    this.abortRequest();
    this.destroyEditor();
    this.renderLoading();

    let resolved: ResolvedSource;

    try {
      resolved = await this.resolveSource(this.payload);
    } catch (error) {
      resolved = {
        type: "text",
        value: `Unable to resolve source\n\n${plainText(error)}`,
        url: "",
      };
    }

    if (
      this.destroyed
      || token !== this.renderToken
      || !this.body
    ) {
      return;
    }

    let { type, value, url } = resolved;

    if (type === "auto") {
      type = inferSourceType(value, url) as SourceType;
    }

    this.renderedText = plainText(value);
    this.dirty = false;

    switch (type) {
      case "image":
        this.renderImage(String(value ?? ""), url);
        return;

      case "iframe":
        this.renderIframe(String(value ?? ""));
        return;

      case "object":
        this.renderObject(value);
        return;

      case "json":
        this.renderCode(
          this.config.get("formatCode")
            ? formatJson(value, this.indentSize())
            : plainText(value),
          "json",
        );
        return;

      case "html":
      case "css":
      case "javascript": {
        const source = String(value ?? "");

        this.renderCode(
          this.config.get("formatCode")
            ? formatSource(
                source,
                type,
                this.indentSize(),
                this.config.get("maxFormatSourceLength"),
              )
            : source,
          type,
        );
        return;
      }

      case "raw":
      case "text":
      default: {
        const inferredType = inferTextSourceType(type, url || this.sourceTitle());
        this.renderCode(String(value ?? ""), inferredType);
      }
    }
  }

  private async resolveSource(payload: SourcePayload): Promise<ResolvedSource> {
    let value = typeof payload.value === "function"
      ? await payload.value()
      : payload.value;

    let type = payload.type || "auto";
    const url = payload.url
      || (typeof value === "string" && looksLikeUrl(value) ? value : "");

    if (!url || type === "image" || type === "iframe") {
      return { type, value, url };
    }

    const normalizedType = inferTextSourceType(type, url);
    const failures: string[] = [];

    const documentSource = readCurrentDocumentSource(url, normalizedType);
    if (documentSource != null) {
      return { type: normalizedType, value: documentSource, url };
    }

    if (normalizedType === "css") {
      const cssomSource = readStylesheetSource(url);
      if (cssomSource != null) {
        return { type: "css", value: cssomSource, url };
      }
    }

    const capturedSource = this.readCapturedNetworkSource(url);
    if (capturedSource != null) {
      return {
        type: inferTextSourceType(type, url, capturedSource),
        value: capturedSource,
        url,
      };
    }

    const cachedSource = await readCachedSource(url, failures);
    if (cachedSource != null) {
      return {
        type: inferTextSourceType(type, url, cachedSource),
        value: cachedSource,
        url,
      };
    }

    const controller = new AbortController();
    this.requestController = controller;

    try {
      const fetchedSource = await fetchSourceText(url, controller.signal);
      return {
        type: inferTextSourceType(type, url, fetchedSource),
        value: fetchedSource,
        url,
      };
    } catch (error) {
      if (controller.signal.aborted) throw error;
      failures.push(`fetch: ${sourceErrorMessage(error)}`);
    } finally {
      if (this.requestController === controller) this.requestController = null;
    }

const userscriptSource = await readUserscriptSource(
  url,
  failures,
  this.config.get("requestTimeout"),
);
    
    if (userscriptSource != null) {
      return {
        type: inferTextSourceType(type, url, userscriptSource),
        value: userscriptSource,
        url,
      };
    }

    return {
      type: normalizedType,
      value: sourceFailureText(normalizedType, url, failures),
      url,
    };
  }

  private readCapturedNetworkSource(url: string): string | null {
    const network = this.context?.devtools.get<NetworkSourceTool>("network");
    if (!network || typeof network.requests !== "function") return null;

    const normalized = normalizeSourceUrl(url);
    const record = [...network.requests()].reverse().find((candidate) => (
      normalizeSourceUrl(candidate.url) === normalized
      && typeof candidate.responseBody === "string"
      && candidate.responseBody.length > 0
    ));

    return record?.responseBody ?? null;
  }

  private renderLoading(): void {
    if (!this.body) return;

    this.disposeBody?.();

    this.disposeBody = render(
      this.body,
      html`
        <RodSourcesEmpty>
          <strong>Loading source…</strong>
        </RodSourcesEmpty>
      `,
    );
  }


  private renderCode(code: string, type: string): void {
    if (!this.body) return;

    this.destroyEditor();
    this.disposeBody?.();
    this.renderedText = code;

    let editorHost: HTMLElement | null = null;
    this.disposeBody = render(this.body, html`
      <RodSourcesEditor>
        <RodSourcesBreadcrumb>${this.sourceTitle(type)}</RodSourcesBreadcrumb>
        <RodSourcesCodeMirrorHost ref=${ref<HTMLElement>((node) => { editorHost = node; })} />
      </RodSourcesEditor>
    `);

    if (!editorHost) throw new Error("[RodEruda] Sources editor host did not mount");

    this.editor = mountCodeEditor({
      parent: editorHost,
      value: code,
      language: sourceLanguage(type),
      readOnly: true,
      dark: this.isDarkTheme(),
      lineNumbers: this.config.get("showLineNum"),
      lineWrapping: this.config.get("wrapLines"),
      fontSize: this.config.get("editorFontSize"),
      tabSize: this.config.get("editorTabSize"),
    });
  }

  private renderObject(value: unknown): void {
    if (!this.body) return;

    this.destroyEditor();
    this.disposeBody?.();
    this.disposeBody = render(this.body, html`
      <RodSourcesObject>
        ${renderValue(value, { maxDepth: 8, maxEntries: 500 })}
      </RodSourcesObject>
    `);
  }

  private renderImage(src: string, url: string): void {
    if (!this.body) return;

    this.destroyEditor();
    this.disposeBody?.();

    let image: HTMLImageElement | null = null;
    let info: HTMLParagraphElement | null = null;

    this.disposeBody = render(this.body, html`
      <RodSourcesBreadcrumb>${this.sourceTitle(url || src)}</RodSourcesBreadcrumb>
      <RodSourcesImage>
        <img
          src=${src}
          alt=""
          @load=${event(() => {
            if (image && info) info.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
          })}
          @error=${event(() => {
            if (info) info.textContent = "Image failed to load";
          })}
          ref=${ref<HTMLImageElement>((node) => { image = node; })}
        />
        <p data-image-info ref=${ref<HTMLParagraphElement>((node) => { info = node; })}>Loading image…</p>
      </RodSourcesImage>
    `);
  }

  private renderIframe(src: string): void {
    if (!this.body) return;

    this.destroyEditor();
    this.disposeBody?.();
    this.disposeBody = render(this.body, html`
      <RodSourcesIframe
        src=${src}
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
      />
    `);
  }

  private handleActionName(action: string): void {
    switch (action) {
      case "source-home":
        this.set({
          type: "html",
          value: () => document.documentElement.outerHTML,
          title: location.href,
        });
        return;

      case "source-list":
        this.renderSourceIndex();
        return;

      case "source-copy":
        void copyText(this.renderedText).then(() => {
          this.context?.notify("Source copied", {
            type: "success",
          });
        });
        return;

      case "source-download":
        downloadText(
          fileNameFor(this.payload),
          this.renderedText,
        );
        return;

      case "source-refresh":
        this.dirty = true;
        void this.renderSource();
        return;
    }
  }

  private renderSourceIndex(): void {
    if (!this.body) return;

    this.abortRequest();
    this.destroyEditor();

    const sources = collectSources();
    this.indexedSources = sources;

    this.renderedText = sources
      .map((source) => `${source.type}\t${source.title}`)
      .join("\n");

    this.disposeBody?.();

    this.disposeBody = render(
      this.body,
      html`
        <RodSourcesBreadcrumb>All sources</RodSourcesBreadcrumb>

        <RodSourcesLinkList>
          ${sources.map(
            (source, index) => html`
              <li>
                <RodSourcesTextButton
                  type="button"
                  @click=${event((click: Event) => {
                    click.preventDefault();
                    this.openIndexedSource(index);
                  })}
                >
                  ${source.type} · ${source.title}
                </RodSourcesTextButton>
              </li>
            `,
          )}
        </RodSourcesLinkList>
      `,
    );
  }

  private openIndexedSource(index: number): void {
    const source = this.indexedSources[index];

    if (source) {
      this.set(source);
    }
  }

  private sourceTitle(fallback = "Document"): string {
    return String(
      this.payload.title
      || this.payload.url
      || fallback,
    );
  }

  private indentSize(): number {
    const size = Number.parseInt(
      this.config.get("indentSize"),
      10,
    );

    return Number.isFinite(size) && size > 0
      ? size
      : 2;
  }

  private isDarkTheme(): boolean {
    const root = this.context?.root;

    if (!root) return true;

    return (
      root.classList.contains("roderuda-dark")
      || root.dataset.theme === "dark"
      || getComputedStyle(root).colorScheme === "dark"
    );
  }

  private abortRequest(): void {
    this.requestController?.abort();
    this.requestController = null;
  }

  private destroyEditor(): void {
    this.editor?.destroy();
    this.editor = null;
  }
}

function isSourcePayload(
  value: SourcePayload | SourceType | string,
): value is SourcePayload {
  return (
    value !== null
    && typeof value === "object"
    && "type" in value
  );
}

function collectSources(): SourcePayload[] {
  const sources: SourcePayload[] = [
    {
      type: "html",
      value: serializeDocumentSource,
      title: "Document HTML",
      url: location.href,
    },
  ];
  const seenUrls = new Set<string>();

  for (const [index, script] of Array.from(document.scripts).entries()) {
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

  for (const [index, style] of Array.from(document.querySelectorAll("style")).entries()) {
    if (isDevtoolsNode(style) || !style.textContent?.trim()) continue;
    sources.push({
      type: "css",
      value: style.textContent,
      title: `Inline stylesheet #${index + 1}`,
    });
  }

  const stylesheetUrls = [
    ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')).map((link) => link.href),
    ...Array.from(document.styleSheets).map((sheet) => sheet.href).filter((href): href is string => Boolean(href)),
  ];

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

function serializeDocumentSource(): string {
  const devtoolsHost = document.querySelector<HTMLElement>("#roderuda,.__roderuda-host__");

  // Shadow DOM content is not included by outerHTML, so the common path can
  // serialize without cloning the whole page. Light-DOM installations need a
  // cleaned clone to avoid recursively embedding the DevTools UI in Sources.
  if (!devtoolsHost || devtoolsHost.shadowRoot) {
    return `<!doctype html>\n${document.documentElement.outerHTML}`;
  }

  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(
    "#roderuda,.__roderuda-host__,.__roderuda-overlay__,[data-roderuda-root],[data-roderuda-internal]",
  ).forEach((node) => node.remove());
  return `<!doctype html>\n${clone.outerHTML}`;
}

function inferInlineScriptType(type: string): SourceType {
  return /json|ld\+json/i.test(type) ? "json" : "javascript";
}

function inferTextSourceType(
  requestedType: SourceType | string,
  sourceHint: string,
  value?: string,
): CodeEditorLanguage {
  if (["html", "css", "javascript", "json"].includes(requestedType)) {
    return requestedType as CodeEditorLanguage;
  }

  const inferred = inferSourceType(value ?? "", sourceHint);
  if (["html", "css", "javascript", "json"].includes(inferred)) {
    return inferred as CodeEditorLanguage;
  }

  return "text";
}

function readCurrentDocumentSource(url: string, type: string): string | null {
  if (type !== "html") return null;
  return normalizeSourceUrl(url) === normalizeSourceUrl(location.href)
    ? serializeDocumentSource()
    : null;
}

function readStylesheetSource(url: string): string | null {
  const normalized = normalizeSourceUrl(url);

  for (const stylesheet of Array.from(document.styleSheets)) {
    if (!stylesheet.href || normalizeSourceUrl(stylesheet.href) !== normalized) continue;

    try {
      return Array.from(stylesheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
    } catch {
      return null;
    }
  }

  return null;
}

async function readCachedSource(url: string, failures: string[]): Promise<string | null> {
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

async function fetchSourceText(url: string, signal: AbortSignal): Promise<string> {
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

async function readUserscriptSource(
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

function sourceFailureText(type: string, url: string, failures: readonly string[]): string {
  const detail = failures.length ? failures.join("\n") : "No readable response body was available.";
  const message = [
    "RodEruda could not read this resource from the page context.",
    `URL: ${url || "unknown"}`,
    "Tried: current DOM/CSSOM, captured Network responses, Cache Storage, fetch and userscript cross-origin request.",
    detail,
  ].join("\n");

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

function normalizeSourceUrl(value: string): string {
  try {
    const url = new URL(value, location.href);
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

function isPromiseLike<Value>(value: unknown): value is PromiseLike<Value> {
  return value !== null
    && typeof value === "object"
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function";
}

function sourceErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function looksLikeUrl(value: string): boolean {
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

function formatJson(
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

function sourceLanguage(
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

function formatHtml(
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

  const tokens = protectedSource
    .replace(/>\s*</g, "><")
    .split(/(?=<)|(?<=>)/)
    .filter((token) => token.trim().length > 0);

  let depth = 0;
  const output = tokens.map((token) => {
    const trimmed = token.trim();
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

  return output.join("\n");
}

function indentBlock(value: string, spaces: number): string {
  const prefix = " ".repeat(Math.max(0, spaces));
  return value.split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n");
}

function formatCss(
  source: string,
  indentSize: number,
): string {
  let depth = 0;

  return source
    .replace(/\s*([{};])\s*/g, "$1\n")
    .split("\n")
    .map((line) => {
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
    })
    .filter(Boolean)
    .join("\n");
}

function formatJavaScript(
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

function fileNameFor(
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

    return pathname
      .split("/")
      .filter(Boolean)
      .at(-1)
      || defaultExtensionFor(payload.type);
  } catch {
    return defaultExtensionFor(payload.type);
  }
}

function defaultExtensionFor(
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
