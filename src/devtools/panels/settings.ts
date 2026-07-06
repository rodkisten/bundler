import { event, html, render } from "../components/runtime";
import type { ConfigLike, RangeOptions, ToolContext } from "../types";
import { Tool } from "../tool";
import {
  SettingsButton,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSectionTitle,
  SettingsSelect,
  SettingsSeparator,
  SettingsText,
  settingsStyleArtifacts,
  type SettingsViewModel,
} from "./settings-components";

export { settingsStyleArtifacts };

type SettingKind = "text" | "separator" | "button" | "switch" | "select" | "range";

type SettingEntry = {
  id: string;
  kind: SettingKind;
  label?: string;
  handler?: () => void | Promise<void>;
  config?: ConfigLike;
  key?: string;
  selections?: readonly string[];
  range?: RangeOptions;
  dispose?: () => void;
};

export class Settings extends Tool {
  readonly name = "settings";
  readonly title = "settings";
  readonly icon = "⚙";

  private body: HTMLElement | null = null;
  private disposeView: (() => void) | null = null;
  private sequence = 0;
  private readonly entries: SettingEntry[] = [];

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    const view: SettingsViewModel = {
      setBody: (node) => {
        this.body = node;
      },
    };

    this.disposeView?.();
    this.disposeView = render(container, html`<RodSettingsView view=${view as never} />`);
    this.render();
  }

  override destroy(): void {
    for (const entry of this.entries) entry.dispose?.();
    this.entries.length = 0;
    this.disposeView?.();
    this.disposeView = null;
    this.body = null;
    super.destroy();
  }

  registerText(text: string): string {
    return this.add({ kind: "text", label: text });
  }

  registerSeparator(): string {
    return this.add({ kind: "separator" });
  }

  registerButton(label: string, handler: () => void | Promise<void>): string {
    return this.add({ kind: "button", label, handler });
  }

  registerSwitch(config: ConfigLike, key: string, description: string): string {
    return this.addConfigEntry({ kind: "switch", label: description, config, key });
  }

  registerSelect(config: ConfigLike, key: string, description: string, selections: readonly string[]): string {
    return this.addConfigEntry({ kind: "select", label: description, config, key, selections });
  }

  registerRange(config: ConfigLike, key: string, description: string, options: RangeOptions = {}): string {
    return this.addConfigEntry({ kind: "range", label: description, config, key, range: options });
  }

  removeSetting(id: string): void {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    const [entry] = this.entries.splice(index, 1);
    entry?.dispose?.();
    this.render();
  }

  private add(entry: Omit<SettingEntry, "id">): string {
    const id = `setting-${++this.sequence}`;
    this.entries.push({ ...entry, id });
    this.render();
    return id;
  }

  private addConfigEntry(entry: Omit<SettingEntry, "id" | "dispose"> & { config: ConfigLike; key: string }): string {
    const id = `setting-${++this.sequence}`;
    const listener = (changedKey: string) => {
      if (changedKey === entry.key) this.render();
    };
    entry.config.on("change", listener);
    this.entries.push({
      ...entry,
      id,
      dispose: () => entry.config.off("change", listener),
    });
    this.render();
    return id;
  }

  private render(): void {
    if (!this.body) return;

    render(this.body, html`
      <SettingsSection>
        <SettingsSectionTitle>Settings</SettingsSectionTitle>
        ${this.entries.length ? this.entries.map((entry) => this.renderEntry(entry)) : html`
          <SettingsRow>
            <SettingsText>No settings registered.</SettingsText>
          </SettingsRow>
        `}
      </SettingsSection>
    `);
  }

  private renderEntry(entry: SettingEntry) {
    if (entry.kind === "separator") return html`<SettingsSeparator />`;
    if (entry.kind === "text") return html`<SettingsSectionTitle>${entry.label ?? ""}</SettingsSectionTitle>`;

    if (entry.kind === "button") {
      return html`
        <SettingsRow>
          <SettingsText>${entry.label ?? ""}</SettingsText>
          <SettingsButton type="button" @click=${event(() => void entry.handler?.())}>Run</SettingsButton>
        </SettingsRow>
      `;
    }

    if (!entry.config || !entry.key) return "";

    if (entry.kind === "switch") {
      return html`
        <SettingsRow>
          <SettingsText>${entry.label ?? entry.key}</SettingsText>
          <SettingsInput
            type="checkbox"
            .checked=${Boolean(entry.config.get(entry.key))}
            @change=${event((change: Event) => {
              const checked = change.target instanceof HTMLInputElement ? change.target.checked : false;
              entry.config?.set(entry.key!, checked);
            })}
          />
        </SettingsRow>
      `;
    }

    if (entry.kind === "select") {
      const value = String(entry.config.get(entry.key) ?? "");
      return html`
        <SettingsRow>
          <SettingsText>${entry.label ?? entry.key}</SettingsText>
          <SettingsSelect
            .value=${value}
            @change=${event((change: Event) => {
              const next = change.target instanceof HTMLSelectElement ? change.target.value : value;
              entry.config?.set(entry.key!, next);
            })}
          >
            ${(entry.selections ?? []).map((selection) => html`
              <option value=${selection} .selected=${selection === value}>${selection}</option>
            `)}
          </SettingsSelect>
        </SettingsRow>
      `;
    }

    if (entry.kind === "range") {
      const value = Number(entry.config.get(entry.key) ?? 0);
      return html`
        <SettingsRow>
          <SettingsText>${entry.label ?? entry.key}: ${String(entry.config.get(entry.key))}</SettingsText>
          <SettingsInput
            type="range"
            min=${String(entry.range?.min ?? 0)}
            max=${String(entry.range?.max ?? 100)}
            step=${String(entry.range?.step ?? 1)}
            .value=${String(value)}
            @input=${event((input: Event) => {
              const next = input.target instanceof HTMLInputElement ? Number(input.target.value) : value;
              entry.config?.set(entry.key!, next);
            })}
          />
        </SettingsRow>
      `;
    }

    return "";
  }
}
