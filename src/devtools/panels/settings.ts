import { store } from "../../broto";
import { ConfigStore } from "../core/config";
import { create, delegate, qs } from "../core/dom";
import { Tool } from "../tool";
import type { ConfigLike, RangeOptions, SettingsLike, ToolContext } from "../types";

type SettingDescriptor =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "separator" }
  | { id: string; type: "button"; label: string; handler: () => void | Promise<void> }
  | { id: string; type: "switch"; config: ConfigLike; key: string; description: string }
  | { id: string; type: "select"; config: ConfigLike; key: string; description: string; selections: readonly string[] }
  | { id: string; type: "range"; config: ConfigLike; key: string; description: string; options: Required<RangeOptions> };

export class Settings extends Tool implements SettingsLike {
  readonly name = "settings";
  readonly title = "settings";
  readonly icon = "⚙";
  private readonly state = store({ descriptors: [] as SettingDescriptor[], sequence: 0 });
  private body: HTMLElement | null = null;
  private cleanup: Array<() => void> = [];

  static createCfg<T extends object>(name: string, defaults: T): ConfigStore<T> {
    return new ConfigStore(name, defaults);
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    container.replaceChildren(create("div", { className: "roderuda-settings roderuda-scroll", attrs: { "data-settings-body": "" } }));
    const body = qs<HTMLElement>(container, "[data-settings-body]");
    this.body = body;
    this.cleanup.push(delegate(body, "change", "[data-setting-id]", (event, element) => this.handleChange(event, element)));
    this.cleanup.push(delegate(body, "click", "button[data-setting-id]", (_event, element) => this.handleButton(element)));
    this.render();
  }

  registerText(text: string): string {
    return this.add({ id: this.id(), type: "text", text });
  }

  text(text: string): this {
    this.registerText(text);
    return this;
  }

  registerSeparator(): string {
    return this.add({ id: this.id(), type: "separator" });
  }

  separator(): this {
    this.registerSeparator();
    return this;
  }

  registerButton(label: string, handler: () => void | Promise<void>): string {
    return this.add({ id: this.id(), type: "button", label, handler });
  }

  button(label: string, handler: () => void | Promise<void>): this {
    this.registerButton(label, handler);
    return this;
  }

  registerSwitch(config: ConfigLike, key: string, description: string): string {
    return this.add({ id: this.id(), type: "switch", config, key, description });
  }

  switch(config: ConfigLike, key: string, description: string): this {
    this.registerSwitch(config, key, description);
    return this;
  }

  registerSelect(config: ConfigLike, key: string, description: string, selections: readonly string[]): string {
    return this.add({ id: this.id(), type: "select", config, key, description, selections });
  }

  select(config: ConfigLike, key: string, description: string, selections: readonly string[]): this {
    this.registerSelect(config, key, description, selections);
    return this;
  }

  registerRange(config: ConfigLike, key: string, description: string, options: RangeOptions = {}): string {
    return this.add({
      id: this.id(),
      type: "range",
      config,
      key,
      description,
      options: { min: options.min ?? 0, max: options.max ?? 1, step: options.step ?? 0.1 },
    });
  }

  range(config: ConfigLike, key: string, description: string, options: RangeOptions = {}): this {
    this.registerRange(config, key, description, options);
    return this;
  }

  removeSetting(id: string): void {
    this.setDescriptors(this.descriptors().filter((descriptor) => descriptor.id !== id));
    this.render();
  }

  remove(title: string): this;
  remove(config: ConfigLike, key: string): this;
  remove(configOrTitle: string | ConfigLike, key?: string): this {
    this.setDescriptors(typeof configOrTitle === "string"
      ? this.descriptors().filter((descriptor) => !(descriptor.type === "text" && descriptor.text === configOrTitle))
      : this.descriptors().filter((descriptor) => !("config" in descriptor && descriptor.config === configOrTitle && descriptor.key === key)));
    this.cleanSeparators();
    this.render();
    return this;
  }

  clear(): this {
    this.setDescriptors([]);
    this.render();
    return this;
  }

  override destroy(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.setDescriptors([]);
    this.body = null;
    super.destroy();
  }


  private descriptors(): SettingDescriptor[] {
    return this.state.snapshot().descriptors;
  }

  private setDescriptors(descriptors: SettingDescriptor[]): void {
    this.state.setPath("descriptors", descriptors);
  }

  private cleanSeparators(): void {
    this.setDescriptors(this.descriptors().filter((descriptor, index, all) => {
      if (descriptor.type !== "separator") return true;
      return index > 0 && index < all.length - 1 && all[index - 1]?.type !== "separator";
    }));
  }

  private add(descriptor: SettingDescriptor): string {
    this.setDescriptors([...this.descriptors(), descriptor]);
    this.render();
    return descriptor.id;
  }

  private id(): string {
    const next = this.state.snapshot().sequence + 1;
    this.state.setPath("sequence", next);
    return `setting-${next}`;
  }

  private render(): void {
    if (!this.body) return;
    this.body.replaceChildren();
    for (const descriptor of this.descriptors()) this.body.append(this.renderSetting(descriptor));
  }

  private renderSetting(descriptor: SettingDescriptor): HTMLElement {
    if (descriptor.type === "separator") return create("div", { className: "roderuda-setting-separator", attrs: { "data-setting-separator": descriptor.id } });
    if (descriptor.type === "text") return create("div", { className: "roderuda-setting-text", text: descriptor.text });
    const setting = create("div", { className: "roderuda-setting" });

    if (descriptor.type === "button") {
      const button = create("button", { text: descriptor.label, attrs: { type: "button", "data-setting-id": descriptor.id } });
      setting.append(button);
      return setting;
    }

    setting.append(create("div", { className: "roderuda-setting-title", text: descriptor.description }));
    const control = create("div", { className: "roderuda-setting-control" });
    const value = descriptor.config.get(descriptor.key);

    if (descriptor.type === "switch") {
      const input = create("input", { attrs: { type: "checkbox", "data-setting-id": descriptor.id } });
      input.checked = Boolean(value);
      control.append(input, create("span", { text: input.checked ? "Enabled" : "Disabled" }));
    } else if (descriptor.type === "select") {
      const select = create("select", { attrs: { "data-setting-id": descriptor.id } });
      for (const selection of descriptor.selections) {
        const option = create("option", { text: selection, attrs: { value: selection } });
        option.selected = String(value) === selection;
        select.append(option);
      }
      control.append(select);
    } else {
      const range = create("input", {
        attrs: {
          type: "range",
          min: descriptor.options.min,
          max: descriptor.options.max,
          step: descriptor.options.step,
          value: Number(value),
          "data-setting-id": descriptor.id,
        },
      });
      const number = create("input", {
        attrs: {
          type: "number",
          min: descriptor.options.min,
          max: descriptor.options.max,
          step: descriptor.options.step,
          value: Number(value),
          "data-setting-id": descriptor.id,
          "data-setting-number": "",
        },
      });
      control.append(range, number);
    }

    setting.append(control);
    return setting;
  }

  private handleChange(event: Event, element: HTMLElement): void {
    const descriptor = this.descriptors().find((item) => item.id === element.dataset.settingId);
    if (!descriptor || !("config" in descriptor)) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    const value = descriptor.type === "switch"
      ? (input as HTMLInputElement).checked
      : descriptor.type === "range"
        ? Number(input.value)
        : input.value;
    descriptor.config.set(descriptor.key, value);
    if (descriptor.type === "range") {
      const parent = input.closest(".roderuda-setting-control");
      parent?.querySelectorAll<HTMLInputElement>("input").forEach((candidate) => { candidate.value = String(value); });
    } else if (descriptor.type === "switch") {
      const label = input.parentElement?.querySelector("span");
      if (label) label.textContent = value ? "Enabled" : "Disabled";
    }
  }

  private handleButton(element: HTMLElement): void {
    const descriptor = this.descriptors().find((item) => item.id === element.dataset.settingId);
    if (descriptor?.type !== "button") return;
    void Promise.resolve(descriptor.handler()).catch((error) => this.context?.notify(String(error), { type: "error" }));
  }
}
