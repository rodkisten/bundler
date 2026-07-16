import { copyText, icon, safeStringify } from "@rodkisten/devtools/utils";
import { html, render } from "@rodkisten/devtools/core-runtime";
import type { RenderValue } from "@rodkisten/fabrica/runtime";
import { Tool } from "@rodkisten/devtools/tool";
import { DEVTOOLS_BUILD_INFO } from "@rodkisten/devtools/core-build-info";
import type { InfoItem, ToolContext } from "@rodkisten/devtools/types";
import {
  InfoKey,
  InfoKv,
  InfoValue,
  type InfoModel,
  type InfoViewModel,
  InfoViewContext,
} from "@rodkisten/devtools/panels-info-components";
import { getConnectionInfo, getMemoryInfo, getNavigationInfo, defaultItems } from "@rodkisten/devtools/panels-info.functions";
import { filterArray, findArray, mapArray, mapObject, objectFromEntries } from "@rodkisten/nascente";



export class Info extends Tool {
  readonly name = "info";
  readonly title = "info";
  readonly icon = icon("info");
  private items: InfoItem[] = defaultItems();
  private disposeView: (() => void) | null = null;
  private root: HTMLElement | null = null;

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    this.render();
  }

  add(name: string, value: InfoItem["value"]): this {
    const existing = findArray(this.items, (item) => item.name === name);
    if (existing) existing.value = value;
    else this.items.push({ name, value });
    this.render();
    return this;
  }

  get(): InfoItem[];
  get(name: string): InfoItem["value"] | undefined;
  get(name?: string): InfoItem[] | InfoItem["value"] | undefined {
    if (name == null) return mapArray(this.items, (item) => ({ ...item }));
    return findArray(this.items, (item) => item.name === name)?.value;
  }

  remove(name: string): this {
    this.items = filterArray(this.items, (item) => item.name !== name);
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
    this.disposeView?.();
    this.disposeView = null;
    this.root = null;
    super.destroy();
  }

  private model(): InfoModel {
    return { items: mapArray(this.items, (item) => ({ name: item.name, value: this.resolve(item) })) };
  }

  private render(): void {
    if (!this.container) return;
    const view: InfoViewModel = {
      model: () => this.model(),
      setRoot: (node) => { this.root = node; },
      refresh: () => this.render(),
      copyAll: () => { void this.copyAll(); },
      copyItem: (index) => { void this.copyItem(index); },
      renderValue: (value) => this.renderValue(value),
    };
    this.disposeView?.();
    this.disposeView = render(this.container, html`
      <${InfoViewContext.Provider} value=${view as never}>
        <RodInfoView />
      </${InfoViewContext.Provider}>
    `);
  }

  private resolve(item: InfoItem): unknown {
    try {
      return typeof item.value === "function" ? item.value() : item.value;
    } catch (error) {
      return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
  }

  private renderValue(value: unknown): RenderValue {
    if (value && typeof value === "object") {
      const entries = mapObject(value as Record<string, unknown>, (item, key) => html`<InfoKey>${key}</InfoKey><InfoValue>${typeof item === "string" ? item : safeStringify(item, 0)}</InfoValue>`);
      if (!entries.length) return safeStringify(value);
      return html`<InfoKv>${entries}</InfoKv>`;
    }
    return String(value ?? "null");
  }

  private async copyItem(index: number): Promise<void> {
    const item = this.items[index];
    if (!item) return;
    const copied = await copyText(`${item.name}: ${safeStringify(this.resolve(item))}`);
    this.context?.notify(copied ? "Information copied" : "Unable to copy", { type: copied ? "success" : "error" });
  }

  private async copyAll(): Promise<void> {
    const value = objectFromEntries(mapArray(this.items, (item) => [item.name, this.resolve(item)]));
    const copied = await copyText(safeStringify(value));
    this.context?.notify(copied ? "All information copied" : "Unable to copy", { type: copied ? "success" : "error" });
  }
}
