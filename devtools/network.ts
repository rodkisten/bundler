import { signal } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";
import { ConfigStore } from "@rodkisten/devtools/core/config";
import { NetworkCapture } from "@rodkisten/devtools/core/network-capture";
import { copyText, icon } from "@rodkisten/devtools/utils";
import { Tool } from "@rodkisten/devtools/tool";
import { html } from "@rodkisten/devtools/core/runtime";
import type { NetworkConfig, NetworkContextValue, NetworkRecord, ToolContext } from "@rodkisten/devtools/types";
import {
  networkStyleArtifacts,
  NetworkContext,
} from "@rodkisten/devtools/panels/network-components";
import { toCurl } from "@rodkisten/devtools/panels/network.functions";
export { toCurl } from "@rodkisten/devtools/panels/network.functions";


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

  private syncTimer = 0;
  private readonly records = signal<readonly NetworkRecord[]>([], { name: "network.records" });
  private readonly selectedId = signal<string | null>(null, { name: "network.selectedId" });
  private readonly detailOpen = signal(false, { name: "network.detailOpen" });
  private readonly activeDetailTab = signal("headers", { name: "network.activeDetailTab" });
  private readonly filter = signal(this.config.get("filter"), { name: "network.filter" });
  private readonly recording = signal(true, { name: "network.recording" });
  private readonly configRevision = signal(0, { name: "network.configRevision" });
  private readonly view: NetworkContextValue = {
    records: this.records,
    selectedId: this.selectedId,
    detailOpen: this.detailOpen,
    activeDetailTab: this.activeDetailTab,
    filter: this.filter,
    recording: this.recording,
    captureResponseBody: () => { this.configRevision(); return this.config.get("captureResponseBody"); },
    bodyPreviewLimit: () => { this.configRevision(); return this.config.get("bodyPreviewLimit"); },
    onAction: (actionEvent) => this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement),
    onFilterInput: (inputEvent) => this.handleFilterInput(inputEvent),
    openRequest: (id) => this.openDetail(id),
    switchDetailTab: (tab) => this.switchDetailTab(tab),
  };

  constructor(capture = new NetworkCapture()) {
    super();
    this.capture = capture;
    this.recording.set(capture.isRecording());
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    this.capture.on("request", this.onRequest);
    this.capture.on("update", this.onUpdate);
    this.capture.on("clear", this.onClear);
    this.capture.install();
    this.applyTweakVariables();
    this.config.on("change", this.onConfigChange);
    this.syncRecords();

    this.registerSettings(context);
  }

  override renderView(): RenderValue {
    return NetworkContext.Provider({
      value: this.view,
      children: () => html`<RodNetworkView />`,
    });
  }

  override show(): void {
    super.show();
    this.cancelScheduledSync();
    this.syncRecords();
  }

  override hide(): void {
    super.hide();
    this.cancelScheduledSync();
  }

  clear(): void {
    this.capture.clear();
  }

  requests(): NetworkRecord[] {
    return this.capture.requests();
  }

  override destroy(): void {
    this.cancelScheduledSync();
    this.capture.off("request", this.onRequest);
    this.capture.off("update", this.onUpdate);
    this.capture.off("clear", this.onClear);
    this.capture.destroy();
    this.config.off("change", this.onConfigChange);

    this.records.set([]);
    this.selectedId.set(null);
    this.detailOpen.set(false);

    super.destroy();
  }

  private readonly onRequest = (): void => {
    if (this.active) this.scheduleRecordsSync();
  };

  private readonly onUpdate = (): void => {
    if (this.active) this.scheduleRecordsSync();
  };

  private readonly onClear = (): void => {
    this.selectedId.set(null);
    this.detailOpen.set(false);
    this.records.set([]);
  };

  private readonly onConfigChange = (key: string): void => {
    if (key === "listBottomPadding") this.applyTweakVariables();
    if (key === "filter") this.filter.set(this.config.get("filter"));
    this.configRevision.update((current) => current + 1);
    if (this.active) this.scheduleRecordsSync();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerConfigGroup({
      title: "Network",
      config: this.config,
      settings: [
        { kind: "switch", key: "preserveLog", label: "Preserve log across navigation" },
        { kind: "switch", key: "captureResponseBody", label: "Capture response bodies" },
        { kind: "number", key: "renderDelay", label: "Capture batching delay (ms)", options: { min: 0, max: 1000, step: 5 } },
        { kind: "number", key: "bodyPreviewLimit", label: "Response preview character limit", options: { min: 1000, max: 5_000_000, step: 1000 } },
        { kind: "number", key: "listBottomPadding", label: "Network bottom scroll padding", options: { min: 0, max: 320, step: 4 } },
      ],
    });
  }

  private applyTweakVariables(): void {
    this.container?.style.setProperty("--rd-network-bottom-padding", `${this.config.get("listBottomPadding")}px`);
  }

  /** Batches capture bursts before publishing one records signal update. */
  private scheduleRecordsSync(): void {
    if (this.syncTimer || !this.active) return;

    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = 0;
      if (this.active) this.syncRecords();
    }, this.config.get("renderDelay"));
  }

  private cancelScheduledSync(): void {
    if (this.syncTimer) window.clearTimeout(this.syncTimer);
    this.syncTimer = 0;
  }

  private syncRecords(): void {
    this.records.set(this.capture.requests().filter((record) => this.matches(record)));
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

    this.selectedId.set(record.id);
    this.activeDetailTab.set("headers");
    this.detailOpen.set(true);
  }

  private switchDetailTab(tab: string): void {
    this.activeDetailTab.set(tab);
  }

  private handleFilterInput(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : "";

    this.filter.set(value);
    this.config.set("filter", value);
    this.syncRecords();
  }

  private handleAction(event: Event, element: HTMLElement): void {
    event.preventDefault();

    switch (element.dataset.action) {
      case "record":
        this.capture.setRecording(!this.capture.isRecording());
        this.recording.set(this.capture.isRecording());
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
        this.detailOpen.set(false);
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
    const id = this.selectedId.peek();
    return id ? this.capture.get(id) ?? null : null;
  }
}
