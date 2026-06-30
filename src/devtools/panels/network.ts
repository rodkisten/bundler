import { store } from "../../broto";
import { ConfigStore } from "../core/config";
import { NetworkCapture } from "../core/network-capture";
import { copyText, create, delegate, escapeHtml, formatBytes, formatDuration, icon, qs, truncate } from "../core/dom";
import { highlightCode, inferSourceType, withLineNumbers } from "../core/serialize";
import { Tool } from "../tool";
import type { NetworkHeader, NetworkRecord, ToolContext } from "../types";

interface NetworkConfig {
  preserveLog: boolean;
  captureResponseBody: boolean;
  filter: string;
}

export class Network extends Tool {
  readonly name = "network";
  readonly title = "network";
  readonly icon = "⇄";
  readonly config = new ConfigStore<NetworkConfig>("network", {
    preserveLog: true,
    captureResponseBody: true,
    filter: "",
  });
  readonly capture: NetworkCapture;
  private list: HTMLElement | null = null;
  private detail: HTMLElement | null = null;
  private filterInput: HTMLInputElement | null = null;
  private cleanup: Array<() => void> = [];
  private readonly state = store({ selectedId: null as string | null });

  constructor(capture = new NetworkCapture()) {
    super();
    this.capture = capture;
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    const layout = create("div", { className: "roderuda-network-layout" });
    const control = create("div", { className: "roderuda-control" });
    control.append(
      create("button", { className: "roderuda-icon-btn roderuda-active", text: icon("record"), attrs: { type: "button", "data-action": "record", title: "Record" } }),
      create("button", { className: "roderuda-icon-btn", text: icon("clear"), attrs: { type: "button", "data-action": "clear", title: "Clear" } }),
      create("div", { className: "roderuda-control-spacer" }),
      create("input", { className: "roderuda-search", attrs: { "data-network-filter": "", type: "search", placeholder: "Filter requests", "aria-label": "Filter network requests" } }),
      create("button", { className: "roderuda-icon-btn", text: icon("copy"), attrs: { type: "button", "data-action": "copy", title: "Copy as cURL" } }),
    );
    layout.append(
      control,
      create("div", { className: "roderuda-network-list", attrs: { "data-network-list": "" } }),
      create("section", { className: "roderuda-detail", attrs: { "data-network-detail": "" } }),
    );
    container.replaceChildren(layout);
    this.list = qs(container, "[data-network-list]");
    this.detail = qs(container, "[data-network-detail]");
    const filterInput = qs<HTMLInputElement>(container, "[data-network-filter]");
    this.filterInput = filterInput;
    filterInput.value = this.config.get("filter");

    this.cleanup.push(delegate(container, "click", "[data-action]", (event, element) => this.handleAction(event, element)));
    this.cleanup.push(delegate(container, "click", "[data-request-id]", (_event, element) => this.openDetail(element.dataset.requestId || "")));
    this.cleanup.push(delegate(container, "click", "[data-detail-tab]", (_event, element) => this.switchDetailTab(element.dataset.detailTab || "headers")));
    this.cleanup.push(this.listen(filterInput, "input", (event) => {
      this.config.set("filter", (event.target as HTMLInputElement).value);
      this.render();
    }));

    this.capture.on("request", this.onRequest);
    this.capture.on("update", this.onUpdate);
    this.capture.on("clear", this.onClear);
    this.capture.install();
    this.registerSettings(context);
    this.render();
  }

  clear(): void {
    this.capture.clear();
  }

  requests(): NetworkRecord[] {
    return this.capture.requests();
  }

  override destroy(): void {
    this.capture.off("request", this.onRequest);
    this.capture.off("update", this.onUpdate);
    this.capture.off("clear", this.onClear);
    this.capture.destroy();
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    super.destroy();
  }

  private readonly onRequest = (): void => this.render();
  private readonly onUpdate = (record: NetworkRecord): void => {
    this.render();
    if (this.state.snapshot().selectedId === record.id) {
      this.renderDetail(record);
    }
  };
  private readonly onClear = (): void => {
    this.state.setPath("selectedId", null);
    this.detail?.classList.remove("roderuda-active");
    this.render();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Network");
    context.settings.registerSwitch(this.config, "preserveLog", "Preserve network log across navigation events");
    context.settings.registerSwitch(this.config, "captureResponseBody", "Capture response bodies");
  }

  private render(): void {
    if (!this.list) return;
    const records = this.capture.requests().filter((record) => this.matches(record));
    if (!records.length) {
      this.list.innerHTML = `<div class="roderuda-empty"><strong>No requests</strong><span>fetch, XHR, WebSocket and resource timing entries appear here.</span></div>`;
      return;
    }

    const table = create("table", { className: "roderuda-table roderuda-network-table" });
    table.innerHTML = `
      <thead><tr><th>Name</th><th>Status</th><th>Method</th><th>Type</th><th>Size</th><th>Time</th></tr></thead>
      <tbody>${records.map((record) => this.rowHtml(record)).join("")}</tbody>
    `;
    this.list.replaceChildren(table);
  }

  private rowHtml(record: NetworkRecord): string {
    const url = safeUrl(record.url);
    const name = url.pathname.split("/").filter(Boolean).at(-1) || url.hostname || record.url;
    const status = record.status == null ? (record.state === "pending" ? "…" : "—") : String(record.status);
    return `
      <tr class="roderuda-network-row" data-request-id="${record.id}" data-state="${record.state}">
        <td><div class="roderuda-network-name" title="${escapeHtml(record.url)}">${escapeHtml(truncate(name, 80))}</div></td>
        <td><span class="roderuda-status" data-status="${status}">${status}</span></td>
        <td><span class="roderuda-network-method" data-method="${escapeHtml(record.method)}">${escapeHtml(record.method)}</span></td>
        <td>${escapeHtml(record.type || record.kind)}</td>
        <td>${formatBytes(record.size)}</td>
        <td>${formatDuration(record.duration)}</td>
      </tr>
    `;
  }

  private matches(record: NetworkRecord): boolean {
    const filter = this.config.get("filter").trim().toLowerCase();
    if (!filter) return true;
    return `${record.method} ${record.url} ${record.status ?? ""} ${record.type ?? ""} ${record.mimeType ?? ""}`.toLowerCase().includes(filter);
  }

  private openDetail(id: string): void {
    const record = this.capture.get(id);
    if (!record) return;
    this.state.setPath("selectedId", record.id);
    this.renderDetail(record);
    this.detail?.classList.add("roderuda-active");
  }

  private renderDetail(record: NetworkRecord): void {
    if (!this.detail) return;
    const responseType = inferSourceType(record.responseBody ?? "", record.url);
    const responseCode = this.config.get("captureResponseBody") ? (record.responseBody ?? "Response body is not available.") : "Response body capture is disabled.";
    const preview = responseType === "json" || responseType === "javascript" || responseType === "css" || responseType === "html"
      ? withLineNumbers(highlightCode(prettyBody(responseCode, responseType), responseType))
      : escapeHtml(responseCode);
    const timing = record.timing ?? {
      total: record.duration ?? 0,
      start: record.startTime,
      end: record.endTime ?? record.startTime,
    };

    this.detail.innerHTML = `
      <div class="roderuda-control">
        <button class="roderuda-icon-btn" type="button" data-action="close-detail" title="Back">${icon("back")}</button>
        <div class="roderuda-detail-title" title="${escapeHtml(record.url)}">${escapeHtml(record.url)}</div>
        <button class="roderuda-icon-btn" type="button" data-action="copy-curl" title="Copy as cURL">${icon("copy")}</button>
      </div>
      <div class="roderuda-detail-body">
        <div class="roderuda-detail-tabs">
          <button class="roderuda-active" type="button" data-detail-tab="headers">Headers</button>
          <button type="button" data-detail-tab="preview">Preview</button>
          <button type="button" data-detail-tab="response">Response</button>
          <button type="button" data-detail-tab="timing">Timing</button>
          ${record.kind === "websocket" ? '<button type="button" data-detail-tab="messages">Messages</button>' : ""}
        </div>
        <div class="roderuda-detail-pane roderuda-active" data-detail-pane="headers">
          ${sectionTable("General", [
            ["Request URL", record.url], ["Request Method", record.method], ["Status Code", `${record.status ?? "—"} ${record.statusText ?? ""}`.trim()],
            ["Resource Type", record.type || record.kind], ["MIME Type", record.mimeType || "—"], ["From Cache", record.fromCache ? "Yes" : "No"],
          ])}
          ${headerTable("Request Headers", record.requestHeaders)}
          ${record.requestBody ? sectionPre("Request Payload", record.requestBody) : ""}
          ${headerTable("Response Headers", record.responseHeaders)}
          ${record.error ? sectionPre("Error", record.error) : ""}
        </div>
        <div class="roderuda-detail-pane" data-detail-pane="preview"><pre class="roderuda-code">${preview}</pre></div>
        <div class="roderuda-detail-pane" data-detail-pane="response"><pre class="roderuda-pre">${escapeHtml(responseCode)}</pre></div>
        <div class="roderuda-detail-pane" data-detail-pane="timing">${sectionTable("Timing", Object.entries(timing).map(([key, value]) => [key, formatDuration(value)]))}</div>
        ${record.kind === "websocket" ? `<div class="roderuda-detail-pane" data-detail-pane="messages">${messagesTable(record)}</div>` : ""}
      </div>
    `;
  }

  private switchDetailTab(tab: string): void {
    if (!this.detail) return;
    this.detail.querySelectorAll<HTMLElement>("[data-detail-tab]").forEach((element) => element.classList.toggle("roderuda-active", element.dataset.detailTab === tab));
    this.detail.querySelectorAll<HTMLElement>("[data-detail-pane]").forEach((element) => element.classList.toggle("roderuda-active", element.dataset.detailPane === tab));
  }

  private handleAction(event: Event, element: HTMLElement): void {
    event.preventDefault();
    switch (element.dataset.action) {
      case "record":
        this.capture.setRecording(!this.capture.isRecording());
        element.classList.toggle("roderuda-active", this.capture.isRecording());
        break;
      case "clear":
        this.clear();
        break;
      case "copy": {
        const record = this.selectedRecord() || this.capture.requests().at(-1);
        if (!record) return;
        void copyText(toCurl(record)).then(() => this.context?.notify("cURL copied", { type: "success" }));
        break;
      }
      case "close-detail":
        this.detail?.classList.remove("roderuda-active");
        break;
      case "copy-curl":
        {
          const selected = this.selectedRecord();
          if (selected) void copyText(toCurl(selected)).then(() => this.context?.notify("cURL copied", { type: "success" }));
        }
        break;
    }
  }

  private selectedRecord(): NetworkRecord | null {
    const id = this.state.snapshot().selectedId;
    return id ? this.capture.get(id) ?? null : null;
  }

  private listen(target: EventTarget, type: string, listener: EventListener): () => void {
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  }
}

function safeUrl(value: string): URL {
  try { return new URL(value, location.href); } catch { return new URL(location.href); }
}

function sectionTable(title: string, rows: Array<readonly [string, unknown]>): string {
  return `<section class="roderuda-section"><div class="roderuda-section-title">${escapeHtml(title)}</div><div class="roderuda-table-wrap"><table class="roderuda-kv"><tbody>${rows.map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table></div></section>`;
}

function headerTable(title: string, headers: NetworkHeader[]): string {
  return sectionTable(title, headers.length ? headers.map((header) => [header.name, header.value] as const) : [["—", "No headers"]]);
}

function sectionPre(title: string, value: string): string {
  return `<section class="roderuda-section"><div class="roderuda-section-title">${escapeHtml(title)}</div><pre class="roderuda-pre">${escapeHtml(value)}</pre></section>`;
}

function messagesTable(record: NetworkRecord): string {
  const messages = record.messages ?? [];
  return `<div class="roderuda-table-wrap"><table class="roderuda-table"><thead><tr><th>Direction</th><th>Time</th><th>Data</th></tr></thead><tbody>${messages.map((message) => `<tr><td>${message.direction === "sent" ? "↑ Sent" : "↓ Received"}</td><td>${new Date(message.timestamp).toLocaleTimeString()}</td><td><pre class="roderuda-pre">${escapeHtml(message.data)}</pre></td></tr>`).join("")}</tbody></table></div>`;
}

function prettyBody(body: string, type: string): string {
  if (type === "json") {
    try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
  }
  return body;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function toCurl(record: NetworkRecord): string {
  const parts = ["curl", "-X", record.method, shellQuote(record.url)];
  for (const header of record.requestHeaders) parts.push("-H", shellQuote(`${header.name}: ${header.value}`));
  if (record.requestBody) parts.push("--data-raw", shellQuote(record.requestBody));
  return parts.join(" ");
}
