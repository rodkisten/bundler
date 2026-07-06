import { store } from "../../broto";
import { ConfigStore } from "../core/config";
import { NetworkCapture } from "../core/network-capture";
import { copyText, delegate } from "../core/dom";
import { Tool } from "../tool";
import { html, render } from "../components/runtime";
import type { NetworkRecord, ToolContext } from "../types";
import {
  networkDetailTemplate,
  networkListTemplate,
  networkStyleArtifacts,
  type NetworkViewModel,
} from "./network-components";

export { networkStyleArtifacts };

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
  private disposeView: (() => void) | null = null;
  private activeDetailTab = "headers";
  private readonly state = store({ selectedId: null as string | null });

  constructor(capture = new NetworkCapture()) {
    super();
    this.capture = capture;
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    const view: NetworkViewModel = {
      setList: (node) => { this.list = node; },
      setDetail: (node) => { this.detail = node; },
      setFilterInput: (node) => { this.filterInput = node; },
      onAction: (actionEvent) => this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement),
      onFilterInput: (inputEvent) => this.handleFilterInput(inputEvent),
    };

    this.disposeView?.();
    this.disposeView = render(container, html`
      <RodNetworkView
        view=${view as never}
        filter=${this.config.get("filter")}
        recording=${this.capture.isRecording()}
      />
    `);

    this.cleanup.push(delegate(container, "click", "[data-request-id]", (_event, element) => this.openDetail(element.dataset.requestId || "")));

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

    this.disposeView?.();
    this.disposeView = null;
    this.list = null;
    this.detail = null;
    this.filterInput = null;

    super.destroy();
  }

  private readonly onRequest = (): void => {
    this.render();
  };

  private readonly onUpdate = (record: NetworkRecord): void => {
    this.render();

    if (this.state.snapshot().selectedId === record.id) {
      this.renderDetail(record);
    }
  };

  private readonly onClear = (): void => {
    this.state.setPath("selectedId", null);
    this.detail?.dataset && (this.detail.dataset.active = "false");
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

    const selectedId = this.state.snapshot().selectedId;
    const records = this.capture.requests().filter((record) => this.matches(record));

    render(this.list, networkListTemplate(records, selectedId));
  }

  private matches(record: NetworkRecord): boolean {
    const filter = this.config.get("filter").trim().toLowerCase();
    if (!filter) return true;

    return `${record.method} ${record.url} ${record.status ?? ""} ${record.type ?? ""} ${record.mimeType ?? ""}`
      .toLowerCase()
      .includes(filter);
  }

  private openDetail(id: string): void {
    const record = this.capture.get(id);
    if (!record) return;

    this.state.setPath("selectedId", record.id);
    this.activeDetailTab = "headers";
    this.render();
    this.renderDetail(record);

    if (this.detail) this.detail.dataset.active = "true";
  }

  private renderDetail(record: NetworkRecord): void {
    if (!this.detail) return;

    render(this.detail, networkDetailTemplate(record, {
      activeTab: this.activeDetailTab,
      captureResponseBody: this.config.get("captureResponseBody"),
      onAction: (actionEvent) => this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement),
      onTab: (tabEvent) => this.switchDetailTab((tabEvent.currentTarget as HTMLElement).dataset.detailTab || "headers"),
    }));

    this.detail.dataset.active = "true";
  }

  private switchDetailTab(tab: string): void {
    this.activeDetailTab = tab;

    const selected = this.selectedRecord();
    if (selected) this.renderDetail(selected);
  }

  private handleFilterInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : "";

    this.config.set("filter", value);
    this.render();
  }

  private handleAction(event: Event, element: HTMLElement): void {
    event.preventDefault();

    switch (element.dataset.action) {
      case "record":
        this.capture.setRecording(!this.capture.isRecording());
        element.dataset.active = String(this.capture.isRecording());
        break;

      case "clear":
        this.clear();
        break;

      case "copy": {
        const record = this.selectedRecord() || this.capture.requests().at(-1);
        if (!record) return;

        void copyText(toCurl(record)).then(() => {
          this.context?.notify("cURL copied", { type: "success" });
        });
        break;
      }

      case "close-detail":
        if (this.detail) this.detail.dataset.active = "false";
        break;

      case "copy-curl": {
        const selected = this.selectedRecord();
        if (!selected) return;

        void copyText(toCurl(selected)).then(() => {
          this.context?.notify("cURL copied", { type: "success" });
        });
        break;
      }
    }
  }

  private selectedRecord(): NetworkRecord | null {
    const id = this.state.snapshot().selectedId;
    return id ? this.capture.get(id) ?? null : null;
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function toCurl(record: NetworkRecord): string {
  const parts = ["curl", "-X", record.method, shellQuote(record.url)];

  for (const header of record.requestHeaders) {
    parts.push("-H", shellQuote(`${header.name}: ${header.value}`));
  }

  if (record.requestBody) {
    parts.push("--data-raw", shellQuote(record.requestBody));
  }

  return parts.join(" ");
}
