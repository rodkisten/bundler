import { copyText, icon, safeStringify } from "@rodkisten/devtools/utils";
import { html, signal } from "@rodkisten/devtools/core/runtime";
import type { RenderValue } from "@rodkisten/fabrica";
import { Tool } from "@rodkisten/devtools/tool";
import type { InfoContextValue, InfoItem, InfoModel, ToolContext } from "@rodkisten/devtools/types";
import {
  infoStyleArtifacts,
  InfoContext,
} from "@rodkisten/devtools/panels/info-components";
import { defaultItems } from "@rodkisten/devtools/panels/info.functions";


export { infoStyleArtifacts };

export class Info extends Tool {
  readonly name = "info";
  readonly title = "info";
  readonly icon = icon("info");
  private readonly items = signal<InfoItem[]>(defaultItems(), { name: "info.items" });
  private readonly revision = signal(0, { name: "info.revision" });
  private readonly view: InfoContextValue = {
    model: () => this.model(),
    refresh: () => this.revision.update((value) => value + 1),
    copyAll: () => { void this.copyAll(); },
    copyItem: (name) => { void this.copyItem(name); },
    renderValue: (value) => this.renderValue(value),
  };

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
  }

  override renderView(): RenderValue {
    return InfoContext.Provider({
      value: this.view,
      children: () => html`<RodInfoView />`,
    });
  }

  add(name: string, value: InfoItem["value"]): this {
    const items = this.items.peek();
    const index = items.findIndex((item) => item.name === name);
    const next = items.slice();
    if (index >= 0) next[index] = { name, value };
    else next.push({ name, value });
    this.items.set(next);
    return this;
  }

  get(): InfoItem[];
  get(name: string): InfoItem["value"] | undefined;
  get(name?: string): InfoItem[] | InfoItem["value"] | undefined {
    const items = this.items.peek();
    if (name == null) return items.map((item) => ({ ...item }));
    return items.find((item) => item.name === name)?.value;
  }

  remove(name: string): this {
    this.items.set(this.items.peek().filter((item) => item.name !== name));
    return this;
  }

  clear(): this {
    this.items.set([]);
    return this;
  }

  reset(): this {
    this.items.set(defaultItems());
    return this;
  }

  override destroy(): void {
    super.destroy();
  }

  private model(): InfoModel {
    this.revision();
    return { items: this.items().map((item) => ({ name: item.name, value: this.resolve(item) })) };
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
      const entries = Object.entries(value as Record<string, unknown>);
      if (!entries.length) return safeStringify(value);
      return html`<InfoKv>${entries.map(([key, item]) => html`<InfoKey>${key}</InfoKey><InfoValue>${typeof item === "string" ? item : safeStringify(item, 0)}</InfoValue>`)}</InfoKv>`;
    }
    return String(value ?? "null");
  }

  private async copyItem(name: string): Promise<void> {
    const item = this.items.peek().find((candidate) => candidate.name === name);
    if (!item) return;
    const copied = await copyText(`${item.name}: ${safeStringify(this.resolve(item))}`);
    this.context?.notify(copied ? "Information copied" : "Unable to copy", { type: copied ? "success" : "error" });
  }

  private async copyAll(): Promise<void> {
    const value = Object.fromEntries(this.items.peek().map((item) => [item.name, this.resolve(item)]));
    const copied = await copyText(safeStringify(value));
    this.context?.notify(copied ? "All information copied" : "Unable to copy", { type: copied ? "success" : "error" });
  }
}
