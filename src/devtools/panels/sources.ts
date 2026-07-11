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
} from "../components/runtime";
import { Tool } from "../tool";
import type {
  SourcePayload,
  SourceType,
  SourcesConfig,
  ToolContext,
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

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    this.destroyed = false;
    this.mountShell();
    this.config.on("change", this.onConfigChange);
    this.registerSettings(context);

    void this.renderSource();
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

    this.mountShell();
    void this.renderSource();

    return this;
  }

  override show(): void {
    super.show();
    void this.renderSource();
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

    super.destroy();
  }

  private readonly onConfigChange = (): void => {
    void this.renderSource();
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
  }

  private mountShell(): void {
    if (!this.container || this.destroyed) return;

    this.abortRequest();
    this.destroyEditor();

    this.disposeBody?.();
    this.disposeBody = null;

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
          title=${this.sourceTitle()}
        />
      `,
    );

    // Ref is the primary path. This fallback makes failures in compiled refs
    // visible without leaving the panel permanently blank.
    this.body ??= this.container.querySelector<HTMLElement>(
      "[data-sources-body]",
    );
  }

  private async renderSource(): Promise<void> {
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
            ? formatSource(source, type, this.indentSize())
            : source,
          type,
        );
        return;
      }

      case "raw":
      case "text":
      default:
        this.renderText(String(value ?? ""));
    }
  }

  private async resolveSource(
    payload: SourcePayload,
  ): Promise<ResolvedSource> {
    let value = typeof payload.value === "function"
      ? await payload.value()
      : payload.value;

    let type = payload.type || "auto";

    const url = payload.url
      || (
        typeof value === "string"
        && looksLikeUrl(value)
          ? value
          : ""
      );

    if (url && type !== "image" && type !== "iframe") {
      const controller = new AbortController();
      this.requestController = controller;

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `${response.status} ${response.statusText}`.trim(),
          );
        }

        value = await response.text();

        if (type === "auto" || type === "text") {
          type = inferSourceType(value, url) as SourceType;
        }
      } catch (error) {
        if (controller.signal.aborted) {
          throw error;
        }

        value = `Unable to load ${url}\n\n${plainText(error)}`;
        type = "text";
      } finally {
        if (this.requestController === controller) {
          this.requestController = null;
        }
      }
    }

    return {
      type,
      value,
      url,
    };
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

  private renderText(value: string): void {
    if (!this.body) return;

    this.destroyEditor();
    this.disposeBody?.();

    this.disposeBody = render(
      this.body,
      html`<RodSourcesPre>${value}</RodSourcesPre>`,
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
        void this.renderSource();
        return;
    }
  }

  private renderSourceIndex(): void {
    if (!this.body) return;

    this.abortRequest();
    this.destroyEditor();

    const sources = collectSources();

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
    const source = collectSources()[index];

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
      value: document.documentElement.outerHTML,
      title: "Document HTML",
    },
  ];

  for (
    const [index, script]
    of Array.from(document.scripts).entries()
  ) {
    if (script.src) {
      sources.push({
        type: "javascript",
        value: script.src,
        url: script.src,
        title: script.src,
      });
    } else if (script.textContent?.trim()) {
      sources.push({
        type: "javascript",
        value: script.textContent,
        title: `Inline script #${index + 1}`,
      });
    }
  }

  for (
    const [index, style]
    of Array.from(document.querySelectorAll("style")).entries()
  ) {
    if (style.textContent?.trim()) {
      sources.push({
        type: "css",
        value: style.textContent,
        title: `Inline stylesheet #${index + 1}`,
      });
    }
  }

  for (
    const link
    of Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="stylesheet"][href]',
      ),
    )
  ) {
    sources.push({
      type: "css",
      value: link.href,
      url: link.href,
      title: link.href,
    });
  }

  return sources;
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

function formatSource(
  source: string,
  type: string,
  indentSize: number,
): string {
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
  const tokens = source
    .replace(/>\s*</g, "><")
    .split(/(?=<)|(?<=>)/)
    .filter(Boolean);

  let depth = 0;

  return tokens
    .map((token) => {
      const trimmed = token.trim();

      if (/^<\//.test(trimmed)) {
        depth = Math.max(0, depth - 1);
      }

      const line =
        `${" ".repeat(depth * indentSize)}${trimmed}`;

      const opensContainer =
        /^<[^!/][^>]*[^/]>/i.test(trimmed)
        && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(
          trimmed,
        )
        && !trimmed.includes("</");

      if (opensContainer) {
        depth += 1;
      }

      return line;
    })
    .join("\n");
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
