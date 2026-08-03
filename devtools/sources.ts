import { signal } from "@rodkisten/broto";
import type { Cleanup, RenderValue } from "@rodkisten/fabrica";
import { ConfigStore } from "@rodkisten/devtools/core/config";
import { sharedNetworkCapture } from "@rodkisten/devtools/core/network-capture";
import {
  mountCodeEditor,
  type CodeEditorHandle,
} from "@rodkisten/devtools/core/code-editor";
import {
  copyText,
  downloadText,
  icon,
} from "@rodkisten/devtools/utils";
import {
  inferSourceType,
  plainText,
  renderValue,
} from "@rodkisten/devtools/core/serialize";
import { event, html } from "@rodkisten/devtools/core/runtime";
import { Tool } from "@rodkisten/devtools/core/tool";
import type {
  NetworkRecord,
  SourcePayload,
  SourceType,
  SourcesConfig,
  SourcesContextValue,
  ToolContext,
  ToolLike,
} from "@rodkisten/devtools/types";
import {
  sourcesStyleArtifacts,
  SourcesContext,
} from "@rodkisten/devtools/panels/sources-components";
import { isSourcePayload, collectSources, inferTextSourceType, readCurrentDocumentSource, readStylesheetSource, readCachedSource, fetchSourceText, readUserscriptSource, sourceFailureText, normalizeSourceUrl, sourceErrorMessage, looksLikeUrl, formatJson, sourceLanguage, formatSource, fileNameFor } from "@rodkisten/devtools/panels/sources.functions";
import { findArray, mapArray, mapJoinArray, reverseArray, toArray } from "@rodkisten/nascente";
export { formatSource } from "@rodkisten/devtools/panels/sources.functions";


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

export interface UserscriptResponse {
  status?: number;
  statusText?: string;
  response?: unknown;
  responseText?: string;
}

export interface UserscriptApi {
  xmlHttpRequest?(details: UserscriptRequestDetails): unknown;
}

export type UserscriptRequest = (details: UserscriptRequestDetails) => unknown;

export const MAX_FORMAT_SOURCE_LENGTH = 500_000;

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

  private payload: SourcePayload = { ...DEFAULT_SOURCE_PAYLOAD };
  private readonly titleState = signal(this.sourceTitle(), { name: "sources.title" });
  private readonly content = signal<RenderValue>(null, { name: "sources.content" });
  private readonly view: SourcesContextValue = {
    title: this.titleState,
    content: this.content,
    action: (name) => this.handleActionName(name),
  };
  private renderToken = 0;
  private renderedText = "";
  private editor: CodeEditorHandle | null = null;
  private requestController: AbortController | null = null;
  private destroyed = false;
  private dirty = true;
  private indexedSources: SourcePayload[] = [];
  private sourceIndexOpen = false;
  private networkRefreshFrame = 0;

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    this.destroyed = false;
    this.dirty = true;
    this.titleState.set(this.sourceTitle());
    this.config.on("change", this.onConfigChange);
    sharedNetworkCapture.on("request", this.onNetworkCaptureChange);
    sharedNetworkCapture.on("update", this.onNetworkCaptureChange);
    sharedNetworkCapture.on("clear", this.onNetworkCaptureChange);
    sharedNetworkCapture.install();
    this.applyTweakVariables();
    this.registerSettings(context);
  }


  override renderView(): RenderValue {
    return SourcesContext.Provider({
      value: this.view,
      children: () => html`<RodSourcesView />`,
    });
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
    this.titleState.set(this.sourceTitle());

    if (this.active) void this.renderSource();

    return this;
  }

  override show(): void {
    super.show();
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
    sharedNetworkCapture.off("request", this.onNetworkCaptureChange);
    sharedNetworkCapture.off("update", this.onNetworkCaptureChange);
    sharedNetworkCapture.off("clear", this.onNetworkCaptureChange);
    sharedNetworkCapture.destroy();
    if (this.networkRefreshFrame) cancelAnimationFrame(this.networkRefreshFrame);
    this.networkRefreshFrame = 0;
    this.sourceIndexOpen = false;
    this.abortRequest();
    this.destroyEditor();

    this.content.set(null);
    this.renderedText = "";
    this.dirty = true;
    this.indexedSources = [];

    super.destroy();
  }

  private readonly onNetworkCaptureChange = (): void => {
    if (!this.active || !this.sourceIndexOpen || this.networkRefreshFrame) return;
    this.networkRefreshFrame = requestAnimationFrame(() => {
      this.networkRefreshFrame = 0;
      if (this.active && this.sourceIndexOpen) this.renderSourceIndex();
    });
  };

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

  private async renderSource(): Promise<void> {
    this.sourceIndexOpen = false;
    if (!this.active) {
      this.dirty = true;
      return;
    }

    if (!this.container || this.destroyed) return;

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

    const hasInlineText = typeof value === "string"
      && value.trim().length > 0
      && !looksLikeUrl(value);

    // A URL may be metadata for an already captured body. Never throw away a
    // valid body merely because the original resource URL is also present.
    if (!url || type === "image" || type === "iframe" || hasInlineText) {
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

  private capturedNetworkRecords(): NetworkRecord[] {
    const records = new Map<string, NetworkRecord>();

    for (const record of sharedNetworkCapture.requests()) {
      records.set(record.id, record);
    }

    const network = this.context?.devtools.get<NetworkSourceTool>("network");
    if (network && typeof network.requests === "function") {
      for (const record of network.requests()) {
        records.set(record.id, record);
      }
    }

    return toArray(records.values());
  }

  private readCapturedNetworkSource(url: string): string | null {
    const normalized = normalizeSourceUrl(url);
    const record = findArray(reverseArray(this.capturedNetworkRecords()), (candidate) => (
      normalizeSourceUrl(candidate.url) === normalized
      && typeof candidate.responseBody === "string"
      && candidate.responseBody.length > 0
    ));

    return record?.responseBody ?? null;
  }

  private renderLoading(): void {
    this.content.set(html`
      <RodSourcesEmpty>
        <strong>Loading source…</strong>
      </RodSourcesEmpty>
    `);
  }

  private renderCode(code: string, type: string): void {
    this.destroyEditor();
    this.renderedText = code;
    this.content.set(html`
      <RodSourcesEditor>
        <RodSourcesBreadcrumb>${this.sourceTitle(type)}</RodSourcesBreadcrumb>
        <RodSourcesCodeMirrorHost ref=${(node: HTMLElement) => this.mountSourceEditor(node, code, type)} />
      </RodSourcesEditor>
    `);
  }

  private mountSourceEditor(host: HTMLElement, code: string, type: string): Cleanup {
    this.destroyEditor();
    const editor = mountCodeEditor({
      parent: host,
      value: code,
      language: sourceLanguage(type),
      readOnly: true,
      dark: this.isDarkTheme(),
      lineNumbers: this.config.get("showLineNum"),
      lineWrapping: this.config.get("wrapLines"),
      fontSize: this.config.get("editorFontSize"),
      tabSize: this.config.get("editorTabSize"),
    });
    this.editor = editor;

    return () => {
      editor.destroy();
      if (this.editor === editor) this.editor = null;
    };
  }

  private renderObject(value: unknown): void {
    this.destroyEditor();
    this.content.set(html`
      <RodSourcesObject>
        ${renderValue(value, { maxDepth: 8, maxEntries: 500 })}
      </RodSourcesObject>
    `);
  }

  private renderImage(src: string, url: string): void {
    this.destroyEditor();
    const info = signal("Loading image…", { name: "sources.imageInfo" });
    this.content.set(html`
      <RodSourcesBreadcrumb>${this.sourceTitle(url || src)}</RodSourcesBreadcrumb>
      <RodSourcesImage>
        <img
          src=${src}
          alt=""
          @load=${event.load((load) => {
            const image = load.currentTarget as HTMLImageElement;
            info.set(`${image.naturalWidth} × ${image.naturalHeight} px`);
          })}
          @error=${event.error(() => info.set("Image failed to load"))}
        />
        <p :imageInfo>${info}</p>
      </RodSourcesImage>
    `);
  }

  private renderIframe(src: string): void {
    this.destroyEditor();
    this.content.set(html`
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
    this.sourceIndexOpen = true;
    this.abortRequest();
    this.destroyEditor();

    const sources = collectSources(this.capturedNetworkRecords());
    this.indexedSources = sources;

    this.renderedText = mapJoinArray(sources, (source) => `${source.type}\t${source.title}`, "\n");

    this.content.set(html`
      <RodSourcesBreadcrumb>All sources</RodSourcesBreadcrumb>

      <RodSourcesLinkList>
        ${mapArray(sources, (source, index) => html`
            <li>
              <RodSourcesTextButton
                type="button"
                @click=${event.click((click) => {
                  click.preventDefault();
                  this.openIndexedSource(index);
                })}
              >
                ${source.type} · ${source.title}
              </RodSourcesTextButton>
            </li>
          `)}
      </RodSourcesLinkList>
    `);
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
