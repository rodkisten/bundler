import { store } from "@rodkisten/broto";
import { ConfigStore } from "@rodkisten/devtools/core-config";
import { NetworkCapture } from "@rodkisten/devtools/core-network-capture";
import { copyText, icon } from "@rodkisten/devtools/utils";
import { Tool } from "@rodkisten/devtools/tool";
import { html, render } from "@rodkisten/devtools/core-runtime";
import type { NetworkConfig, NetworkRecord, ToolContext } from "@rodkisten/devtools/types";
import {
  networkDetailTemplate,
  networkListTemplate,
  networkStyleArtifacts,
  type NetworkViewModel,
  NetworkViewContext,
} from "@rodkisten/devtools/panels-network-components";
import { shellQuote, toCurl } from "@rodkisten/devtools/panels-network.functions";
export { toCurl } from "@rodkisten/devtools/panels-network.functions";


export { networkStyleArtifacts };

export class Network extends Tool {
  readonly name = "network";
  readonly title = "network";
  readonly icon = icon("network");
  readonly config = new ConfigStore<NetworkConfig>("network", {
    preserveLog: true,
    captureResponseBody: true,
    filter: "",
    renderDelay: 16,
    bodyPreviewLimit: 200_000,
    listBottomPadding: 96,
  });
  readonly capture: NetworkCapture;

  private list: HTMLElement | null = null;
  private detail: HTMLElement | null = null;
  private filterInput: HTMLInputElement | null = null;
  private disposeView: (() => void) | null = null;
  private activeDetailTab = "headers";
  private renderFrame = 0;
  private readonly state = store({ selectedId: null as string | null });

  constructor(capture = new NetworkCapture()) {
    super();
    this.capture = capture;
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    const view: NetworkViewModel = {
      filter: this.config.get("filter"),
      recording: this.capture.isRecording(),
      setList: (node) => { this.list = node; },
      setDetail: (node) => { this.detail = node; },
      setFilterInput: (node) => { this.filterInput = node; },
      openRequest: (id) => this.openDetail(id),
      onAction: (actionEvent) => this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement),
      onFilterInput: (inputEvent) => this.handleFilterInput(inputEvent),
    };

    this.disposeView?.();
    this.disposeView = render(container, html`
      <${NetworkViewContext.Provider} value=${view as never}>
        <RodNetworkView />
      </${NetworkViewContext.Provider}>
    `);


    this.capture.on("request", this.onRequest);
    this.capture.on("update", this.onUpdate);
    this.capture.on("clear", this.onClear);
    this.capture.install();
    this.applyTweakVariables();
    this.config.on("change", this.onConfigChange);

    this.registerSettings(context);
  }

  override show(): void {
    super.show();
    this.cancelScheduledRender();
    this.render();

    const selected = this.selectedRecord();
    if (selected && this.detail?.dataset.active === "true") this.renderDetail(selected);
  }

  override hide(): void {
    super.hide();
    this.cancelScheduledRender();
  }

  clear(): void {
    this.capture.clear();
  }

  requests(): NetworkRecord[] {
    return this.capture.requests();
  }

  override destroy(): void {
    this.cancelScheduledRender();
    this.capture.off("request", this.onRequest);
    this.capture.off("update", this.onUpdate);
    this.capture.off("clear", this.onClear);
    this.capture.destroy();
    this.config.off("change", this.onConfigChange);


    this.disposeView?.();
    this.disposeView = null;
    this.list = null;
    this.detail = null;
    this.filterInput = null;

    super.destroy();
  }

  private readonly onRequest = (): void => {
    if (this.active) this.scheduleRender();
  };

  private readonly onUpdate = (record: NetworkRecord): void => {
    if (!this.active) return;

    this.scheduleRender();
    if (this.state.snapshot().selectedId === record.id && this.detail?.dataset.active === "true") {
      this.renderDetail(record);
    }
  };

  private readonly onClear = (): void => {
    this.state.setPath("selectedId", null);
    this.detail?.dataset && (this.detail.dataset.active = "false");
    if (this.active) this.scheduleRender();
  };

  private readonly onConfigChange = (key: string): void => {
    if (key === "listBottomPadding") this.applyTweakVariables();
    if (this.active) this.scheduleRender();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerConfigGroup({
      title: "Network",
      config: this.config,
      settings: [
        { kind: "switch", key: "preserveLog", label: "Preserve log across navigation" },
        { kind: "switch", key: "captureResponseBody", label: "Capture response bodies" },
        { kind: "number", key: "renderDelay", label: "Render batching delay (ms)", options: { min: 0, max: 1000, step: 5 } },
        { kind: "number", key: "bodyPreviewLimit", label: "Response preview character limit", options: { min: 1000, max: 5_000_000, step: 1000 } },
        { kind: "number", key: "listBottomPadding", label: "Network bottom scroll padding", options: { min: 0, max: 320, step: 4 } },
      ],
    });
  }

  private applyTweakVariables(): void {
    this.container?.style.setProperty("--rd-network-bottom-padding", `${this.config.get("listBottomPadding")}px`);
  }

  private scheduleRender(): void {
    if (this.renderFrame || !this.active) return;

    this.renderFrame = window.setTimeout(() => {
      this.renderFrame = 0;
      if (this.active) this.render();
    }, this.config.get("renderDelay"));
  }

  private cancelScheduledRender(): void {
    if (this.renderFrame) window.clearTimeout(this.renderFrame);
    this.renderFrame = 0;
  }

  private render(): void {
    if (!this.active || !this.list) return;

    const selectedId = this.state.snapshot().selectedId;
    const records = this.capture.requests().filter((record) => this.matches(record));

    render(this.list, networkListTemplate(records, selectedId, (id) => this.openDetail(id)));
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
      bodyPreviewLimit: this.config.get("bodyPreviewLimit"),
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
    if (this.active) this.render();
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
