import { ConfigStore } from "../core/config";
import { mountCodeEditor, type CodeEditorHandle, type CodeEditorLanguage } from "../core/code-editor";
import { copyText, create, delegate, downloadText, escapeHtml, icon, qs } from "../core/dom";
import { inferSourceType, plainText, renderValue } from "../core/serialize";
import { event, html, render } from "../components/runtime";
import { Tool } from "../tool";
import type { SourcePayload, SourceType, ToolContext } from "../types";
import {
  SourcesBreadcrumb,
  SourcesCodeMirrorHost,
  SourcesEditor,
  SourcesEmpty,
  SourcesIframe,
  SourcesImage,
  SourcesLinkList,
  SourcesObject,
  SourcesPre,
  SourcesTextButton,
  sourcesStyleArtifacts,
  type SourcesViewModel,
} from "./sources-components";

export { sourcesStyleArtifacts };

interface SourcesConfig {
  showLineNum: boolean;
  formatCode: boolean;
  indentSize: string;
  wrapLines: boolean;
}

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
  private payload: SourcePayload = { type: "html", value: () => document.documentElement.outerHTML, title: location.href };
  private cleanup: Array<() => void> = [];
  private disposeView: (() => void) | null = null;
  private renderToken = 0;
  private renderedText = "";
  private editor: CodeEditorHandle | null = null;

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    this.renderShell();
    this.config.on("change", this.onConfigChange);
    this.registerSettings(context);
    void this.render();
  }

  set(payload: SourcePayload): this;
  set(type: SourceType | string, value: unknown): this;
  set(typeOrPayload: SourcePayload | SourceType | string, value?: unknown): this {
    if (typeof typeOrPayload === "object") this.payload = { ...typeOrPayload };
    else this.payload = { type: typeOrPayload as SourceType, value, title: typeof value === "string" ? value : typeOrPayload };
    void this.render();
    return this;
  }

  override show(): void {
    super.show();
    void this.render();
  }

  override destroy(): void {
    this.config.off("change", this.onConfigChange);
    this.editor?.destroy();
    this.editor = null;
    this.disposeView?.();
    this.disposeView = null;
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    super.destroy();
  }

  private readonly onConfigChange = (): void => { void this.render(); };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Sources");
    context.settings.registerSwitch(this.config, "showLineNum", "Show line numbers");
    context.settings.registerSwitch(this.config, "formatCode", "Format JSON and source code");
    context.settings.registerSelect(this.config, "indentSize", "Indent size", ["2", "4", "8"]);
    context.settings.registerSwitch(this.config, "wrapLines", "Wrap long lines");
  }

  private renderShell(): void {
    if (!this.container) return;
    const view: SourcesViewModel = {
      setBody: (node) => { this.body = node; },
      action: (name) => this.handleActionName(name),
    };
    this.disposeView?.();
    this.disposeView = render(this.container, html`<RodSourcesView view=${view as never} title=${this.payload.title || this.payload.url || "Document"} />`);
  }

  private async render(): Promise<void> {
    if (!this.body || !this.container) return;
    const token = ++this.renderToken;
    this.renderShell();
    if (!this.body) return;
    render(this.body, html`<SourcesEmpty><strong>Loading source…</strong></SourcesEmpty>`);

    let value = typeof this.payload.value === "function" ? (this.payload.value as () => unknown)() : this.payload.value;
    let type = this.payload.type || "auto";
    const url = this.payload.url || (typeof value === "string" && looksLikeUrl(value) ? value : "");

    if (url && !["image", "iframe"].includes(type)) {
      try {
        const response = await fetch(url);
        value = await response.text();
        if (type === "auto" || type === "text") type = inferSourceType(value, url) as SourceType;
      } catch (error) {
        value = `Unable to load ${url}\n\n${plainText(error)}`;
        type = "text";
      }
    }

    if (token !== this.renderToken || !this.body) return;
    if (type === "auto") type = inferSourceType(value, url) as SourceType;
    this.renderedText = plainText(value);

    switch (type) {
      case "image":
        this.renderImage(String(value), url);
        break;
      case "iframe":
        this.renderIframe(String(value));
        break;
      case "object":
        this.renderObject(value);
        break;
      case "json":
        this.renderCode(formatJson(value), "json");
        break;
      case "html":
      case "css":
      case "javascript":
        this.renderCode(this.config.get("formatCode") ? formatSource(String(value), type, Number(this.config.get("indentSize"))) : String(value), type);
        break;
      case "raw":
      case "text":
      default:
        render(this.body, html`<SourcesPre>${String(value ?? "")}</SourcesPre>`);
    }
  }

  private renderCode(code: string, type: string): void {
    if (!this.body) return;
    this.editor?.destroy();
    this.editor = null;
    this.renderedText = code;
    const wrapper = SourcesEditor() as HTMLElement;
    const title = SourcesBreadcrumb({ children: this.payload.title || this.payload.url || type }) as HTMLElement;
    const host = SourcesCodeMirrorHost() as HTMLElement;
    wrapper.append(title, host);
    this.body.replaceChildren(wrapper);
    this.editor = mountCodeEditor({
      parent: host,
      value: code,
      language: sourceLanguage(type),
      readOnly: true,
      dark: this.context?.root.classList.contains("roderuda-dark") ?? true,
    });
  }

  private renderObject(value: unknown): void {
    if (!this.body) return;
    const wrapper = SourcesObject() as HTMLElement;
    wrapper.append(renderValue(value, { maxDepth: 8, maxEntries: 500 }));
    this.body.replaceChildren(wrapper);
  }

  private renderImage(src: string, url: string): void {
    if (!this.body) return;
    const wrapper = SourcesImage() as HTMLElement;
    const title = SourcesBreadcrumb({ children: this.payload.title || url || src }) as HTMLElement;
    const image = document.createElement("img");
    const info = document.createElement("p");
    info.dataset.imageInfo = "";
    info.textContent = "Loading image…";
    image.src = src;
    image.alt = "";
    image.addEventListener("load", () => {
      info.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
    }, { once: true });
    image.addEventListener("error", () => { info.textContent = "Image failed to load"; }, { once: true });
    wrapper.append(image, info);
    this.body.replaceChildren(title, wrapper);
  }

  private renderIframe(src: string): void {
    if (!this.body) return;
    const frame = SourcesIframe({ src, sandbox: "allow-forms allow-modals allow-popups allow-same-origin allow-scripts" }) as HTMLIFrameElement;
    this.body.replaceChildren(frame);
  }

  private handleActionName(action: string): void {
    switch (action) {
      case "source-home":
        this.set({ type: "html", value: () => document.documentElement.outerHTML, title: location.href });
        break;
      case "source-list":
        this.renderSourceIndex();
        break;
      case "source-copy":
        void copyText(this.renderedText).then(() => this.context?.notify("Source copied", { type: "success" }));
        break;
      case "source-download":
        downloadText(fileNameFor(this.payload), this.renderedText);
        break;
      case "source-refresh":
        void this.render();
        break;
    }
  }

  private renderSourceIndex(): void {
    if (!this.body) return;
    const sources = collectSources();
    this.renderedText = sources.map((source) => `${source.type}\t${source.title}`).join("\n");
    render(this.body, html`
      <SourcesBreadcrumb>All sources</SourcesBreadcrumb>
      <SourcesLinkList>
        ${sources.map((source, index) => html`
          <li><SourcesTextButton type="button" @click=${event((click: Event) => { click.preventDefault(); this.openIndexedSource(index); })}>${source.type} · ${source.title}</SourcesTextButton></li>
        `)}
      </SourcesLinkList>
    `);
  }

  private openIndexedSource(index: number): void {
    const sources = collectSources();
    const source = sources[index];
    if (source) this.set(source);
  }
}

function collectSources(): SourcePayload[] {
  const sources: SourcePayload[] = [
    { type: "html", value: document.documentElement.outerHTML, title: "Document HTML" },
  ];
  for (const [index, script] of Array.from(document.scripts).entries()) {
    if (script.src) sources.push({ type: "javascript", value: script.src, url: script.src, title: script.src });
    else if (script.textContent?.trim()) sources.push({ type: "javascript", value: script.textContent, title: `Inline script #${index + 1}` });
  }
  for (const [index, style] of Array.from(document.querySelectorAll("style")).entries()) {
    if (style.textContent?.trim()) sources.push({ type: "css", value: style.textContent, title: `Inline stylesheet #${index + 1}` });
  }
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'))) {
    sources.push({ type: "css", value: link.href, url: link.href, title: link.href });
  }
  return sources;
}

function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);
    return /^(https?:|blob:|data:|file:)/.test(url.protocol) && (value.includes(":") || value.startsWith("/") || value.startsWith("."));
  } catch {
    return false;
  }
}

function formatJson(value: unknown): string {
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(data, null, 2);
  } catch {
    return String(value);
  }
}

function sourceLanguage(type: string): CodeEditorLanguage {
  if (type === "javascript") return "javascript";
  if (type === "json") return "json";
  if (type === "html") return "html";
  if (type === "css") return "css";
  return "text";
}

function formatSource(source: string, type: string, indentSize: number): string {
  if (type === "json") return formatJson(source);
  if (type === "html") return formatHtml(source, indentSize);
  if (type === "css") return formatCss(source, indentSize);
  return formatJavaScript(source, indentSize);
}

function formatHtml(source: string, indentSize: number): string {
  const tokens = source.replace(/>\s*</g, "><").split(/(?=<)|(?<=>)/).filter(Boolean);
  let depth = 0;
  return tokens.map((token) => {
    const trimmed = token.trim();
    if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
    const line = `${" ".repeat(depth * indentSize)}${trimmed}`;
    if (/^<[^!/][^>]*[^/]>/i.test(trimmed) && !/^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i.test(trimmed) && !trimmed.includes("</")) depth += 1;
    return line;
  }).join("\n");
}

function formatCss(source: string, indentSize: number): string {
  let depth = 0;
  return source.replace(/\s*([{};])\s*/g, "$1\n").split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("}")) depth = Math.max(0, depth - 1);
    const output = `${" ".repeat(depth * indentSize)}${trimmed}`;
    if (trimmed.endsWith("{")) depth += 1;
    return output;
  }).filter(Boolean).join("\n");
}

function formatJavaScript(source: string, indentSize: number): string {
  let depth = 0;
  let output = "";
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quote) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; output += char; continue; }
    if (char === "{") { depth += 1; output += `{\n${" ".repeat(depth * indentSize)}`; continue; }
    if (char === "}") { depth = Math.max(0, depth - 1); output = output.trimEnd() + `\n${" ".repeat(depth * indentSize)}}`; continue; }
    if (char === ";") { output += `;\n${" ".repeat(depth * indentSize)}`; continue; }
    output += char;
  }
  return output.replace(/\n\s*\n+/g, "\n").trim();
}

function fileNameFor(payload: SourcePayload): string {
  const source = payload.url || payload.title || "source.txt";
  try {
    const pathname = new URL(source, location.href).pathname;
    return pathname.split("/").filter(Boolean).at(-1) || "source.txt";
  } catch {
    return "source.txt";
  }
}
