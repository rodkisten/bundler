import { copyText, create, delegate, safeStringify } from "../core/dom";
import { Tool } from "../tool";
import type { InfoItem, ToolContext } from "../types";
import { renderPanelShell } from "./panel-ui";

function getConnectionInfo(): Record<string, unknown> {
  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
      type?: string;
    };
  }).connection;
  return connection
    ? {
        type: connection.type ?? "unknown",
        effectiveType: connection.effectiveType ?? "unknown",
        downlink: connection.downlink == null ? "unknown" : `${connection.downlink} Mb/s`,
        rtt: connection.rtt == null ? "unknown" : `${connection.rtt} ms`,
        saveData: connection.saveData ?? false,
      }
    : { supported: false };
}

function getMemoryInfo(): Record<string, unknown> {
  const memory = performance as Performance & {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  };
  if (!memory.memory) return { supported: false };
  const toMiB = (value: number) => `${(value / 1024 / 1024).toFixed(2)} MiB`;
  return {
    usedJSHeapSize: toMiB(memory.memory.usedJSHeapSize),
    totalJSHeapSize: toMiB(memory.memory.totalJSHeapSize),
    jsHeapSizeLimit: toMiB(memory.memory.jsHeapSizeLimit),
  };
}

function getNavigationInfo(): Record<string, unknown> {
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!entry) return { supported: false };
  return {
    type: entry.type,
    redirectCount: entry.redirectCount,
    domInteractive: `${entry.domInteractive.toFixed(1)} ms`,
    domContentLoaded: `${entry.domContentLoadedEventEnd.toFixed(1)} ms`,
    loadEvent: `${entry.loadEventEnd.toFixed(1)} ms`,
    transferSize: `${entry.transferSize} B`,
    decodedBodySize: `${entry.decodedBodySize} B`,
  };
}

function defaultItems(): InfoItem[] {
  return [
    { name: "Location", value: () => location.href },
    { name: "Title", value: () => document.title },
    { name: "User Agent", value: () => navigator.userAgent },
    {
      name: "Device",
      value: () => ({
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
        screen: `${screen.width} × ${screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        colorDepth: screen.colorDepth,
        orientation: screen.orientation?.type ?? "unknown",
        touchPoints: navigator.maxTouchPoints,
      }),
    },
    {
      name: "System",
      value: () => ({
        platform: navigator.platform || "unknown",
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        online: navigator.onLine,
        hardwareConcurrency: navigator.hardwareConcurrency ?? "unknown",
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "unknown",
      }),
    },
    { name: "Connection", value: getConnectionInfo },
    { name: "Navigation", value: getNavigationInfo },
    { name: "JavaScript Memory", value: getMemoryInfo },
    {
      name: "Document",
      value: () => ({
        characterSet: document.characterSet,
        contentType: document.contentType,
        compatMode: document.compatMode,
        visibilityState: document.visibilityState,
        referrer: document.referrer || "none",
        nodes: document.getElementsByTagName("*").length,
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length,
        images: document.images.length,
      }),
    },
    {
      name: "RodEruda Devtools",
      value: {
        implementation: "Native TypeScript",
        dependencies: ["Cipo", "Fábrica"],
        runtimeDependencies: 0,
      },
    },
  ];
}

export class Info extends Tool {
  readonly name = "info";
  readonly title = "info";
  readonly icon = "ⓘ";
  private items: InfoItem[] = defaultItems();
  private body: HTMLElement | null = null;
  private cleanup: Array<() => void> = [];

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    const refs = renderPanelShell(container, {
      className: "roderuda-section roderuda-info",
      title: "Page information",
      bodyAttr: "data-info-body",
      bodyClassName: "roderuda-cards",
      actions: [
        { label: "Refresh", action: "refresh" },
        { label: "Copy all", action: "copy-all" },
      ],
    });
    this.body = refs.body;
    this.cleanup.push(delegate(container, "click", "[data-action]", (_event, element) => {
      if (element.dataset.action === "refresh") this.render();
      if (element.dataset.action === "copy-all") void this.copyAll();
      if (element.dataset.action === "copy") void this.copyItem(Number(element.dataset.index));
    }));
    this.render();
  }

  add(name: string, value: InfoItem["value"]): this {
    const existing = this.items.find((item) => item.name === name);
    if (existing) existing.value = value;
    else this.items.push({ name, value });
    this.render();
    return this;
  }

  get(): InfoItem[];
  get(name: string): InfoItem["value"] | undefined;
  get(name?: string): InfoItem[] | InfoItem["value"] | undefined {
    if (name == null) return this.items.map((item) => ({ ...item }));
    return this.items.find((item) => item.name === name)?.value;
  }

  remove(name: string): this {
    this.items = this.items.filter((item) => item.name !== name);
    this.render();
    return this;
  }

  clear(): this {
    this.items = [];
    this.render();
    return this;
  }

  reset(): this {
    this.items = defaultItems();
    this.render();
    return this;
  }

  override destroy(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.body = null;
    super.destroy();
  }

  private resolve(item: InfoItem): unknown {
    try {
      return typeof item.value === "function" ? item.value() : item.value;
    } catch (error) {
      return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
  }

  private render(): void {
    if (!this.body) return;
    this.body.replaceChildren();
    if (!this.items.length) {
      this.body.append(create("div", { className: "roderuda-empty", text: "No information registered." }));
      return;
    }
    this.items.forEach((item, index) => {
      const value = this.resolve(item);
      const card = create("article", { className: "roderuda-info-card" });
      const title = create("header", { className: "roderuda-card-title" });
      title.append(
        create("span", { text: item.name }),
        create("button", {
          className: "roderuda-card-copy",
          text: "Copy",
          attrs: { type: "button", "data-action": "copy", "data-index": index },
        }),
      );
      const content = create("div", { className: "roderuda-card-content" });
      this.renderValue(content, value);
      card.append(title, content);
      this.body?.append(card);
    });
  }

  private renderValue(target: HTMLElement, value: unknown): void {
    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (!entries.length) {
        target.textContent = safeStringify(value);
        return;
      }
      const table = create("div", { className: "roderuda-kv" });
      for (const [key, item] of entries) {
        table.append(
          create("div", { className: "roderuda-object-key", text: key }),
          create("div", { className: "roderuda-value", text: typeof item === "string" ? item : safeStringify(item, 0) }),
        );
      }
      target.append(table);
      return;
    }
    target.textContent = String(value ?? "null");
  }

  private async copyItem(index: number): Promise<void> {
    const item = this.items[index];
    if (!item) return;
    const copied = await copyText(`${item.name}: ${safeStringify(this.resolve(item))}`);
    this.context?.notify(copied ? "Information copied" : "Unable to copy", { type: copied ? "success" : "error" });
  }

  private async copyAll(): Promise<void> {
    const value = Object.fromEntries(this.items.map((item) => [item.name, this.resolve(item)]));
    const copied = await copyText(safeStringify(value));
    this.context?.notify(copied ? "All information copied" : "Unable to copy", { type: copied ? "success" : "error" });
  }
}
