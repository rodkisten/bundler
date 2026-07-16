import { signal, type Signal } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";
import { event, html } from "@rodkisten/devtools/core/runtime";
import { icon } from "@rodkisten/devtools/utils";
import type {
  ConfigChangeListener,
  ConfigLike,
  ConfigSettingsGroup,
  KeysOfValue,
  RangeOptions,
  SettingsContextValue,
  ToolContext,
} from "@rodkisten/devtools/types";
import { Tool } from "@rodkisten/devtools/tool";
import { settingsStyleArtifacts, SettingsContext } from "@rodkisten/devtools/panels/settings-components";
import { findArray, findIndexArray, mapArray, range, removeAtArray } from "@rodkisten/nascente";

export { settingsStyleArtifacts };

type BaseSettingEntry = {
  id: string;
  label?: string;
  dispose?: () => void;
  version: Signal<number>;
};

type SettingEntry =
  | (BaseSettingEntry & { kind: "text" })
  | (BaseSettingEntry & { kind: "separator" })
  | (BaseSettingEntry & { kind: "button"; handler: () => void | Promise<void> })
  | (BaseSettingEntry & {
      kind: "switch";
      getValue: () => boolean;
      setValue: (value: boolean) => void;
    })
  | (BaseSettingEntry & {
      kind: "select";
      selections: readonly string[];
      getValue: () => string;
      setValue: (value: string) => void;
    })
  | (BaseSettingEntry & {
      kind: "range";
      range: RangeOptions;
      getValue: () => number;
      setValue: (value: number) => void;
    })
  | (BaseSettingEntry & {
      kind: "number";
      range: RangeOptions;
      getValue: () => number;
      setValue: (value: number) => void;
    });

type NewSettingEntry = SettingEntry extends infer Entry
  ? Entry extends SettingEntry
    ? Omit<Entry, "id" | "version">
    : never
  : never;

export class Settings extends Tool {
  readonly name = "settings";
  readonly title = "settings";
  readonly icon = icon("settings");

  private sequence = 0;
  private readonly entries: SettingEntry[] = [];
  private readonly entryIds = signal<readonly string[]>([], { name: "settings.entryIds" });
  private readonly view: SettingsContextValue = {
    entryIds: this.entryIds,
    renderEntry: (id) => this.renderEntryById(id),
  };

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
  }

  override renderView(): RenderValue {
    return SettingsContext.Provider({
      value: this.view,
      children: () => html`<RodSettingsView />`,
    });
  }

  override destroy(): void {
    for (const entry of this.entries) entry.dispose?.();
    this.entries.length = 0;
    this.entryIds.set([]);
    super.destroy();
  }

  registerText(text: string): string {
    return this.add({ kind: "text", label: text });
  }

  registerConfigGroup<Values extends object>(group: ConfigSettingsGroup<Values>): readonly string[] {
    const ids: string[] = [this.registerSeparator(), this.registerText(group.title)];

    for (const setting of group.settings) {
      switch (setting.kind) {
        case "switch":
          ids.push(this.registerSwitch(group.config, setting.key, setting.label));
          break;
        case "select":
          ids.push(this.registerSelect(group.config, setting.key, setting.label, setting.selections));
          break;
        case "range":
          ids.push(this.registerRange(group.config, setting.key, setting.label, setting.options));
          break;
        case "number":
          ids.push(this.registerNumber(group.config, setting.key, setting.label, setting.options));
          break;
      }
    }

    return ids;
  }

  registerSeparator(): string {
    return this.add({ kind: "separator" });
  }

  registerButton(label: string, handler: () => void | Promise<void>): string {
    return this.add({ kind: "button", label, handler });
  }

  registerSwitch<Values extends object, Key extends KeysOfValue<Values, boolean>>(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
  ): string {
    return this.addConfigEntry(config, key, {
      kind: "switch",
      label: description,
      getValue: () => config.get(key) as boolean,
      setValue: (value: boolean) => config.set(key, value as Values[Key]),
    });
  }

  registerSelect<Values extends object, Key extends KeysOfValue<Values, string>>(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
    selections: readonly string[],
  ): string {
    return this.addConfigEntry(config, key, {
      kind: "select",
      label: description,
      selections,
      getValue: () => config.get(key) as string,
      setValue: (value: string) => config.set(key, value as Values[Key]),
    });
  }

  registerRange<Values extends object, Key extends KeysOfValue<Values, number>>(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
    range: RangeOptions = {},
  ): string {
    return this.addConfigEntry(config, key, {
      kind: "range",
      label: description,
      range,
      getValue: () => config.get(key) as number,
      setValue: (value: number) => config.set(key, value as Values[Key]),
    });
  }

  registerNumber<Values extends object, Key extends KeysOfValue<Values, number>>(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
    range: RangeOptions = {},
  ): string {
    return this.addConfigEntry(config, key, {
      kind: "number",
      label: description,
      range,
      getValue: () => config.get(key) as number,
      setValue: (value: number) => config.set(key, value as Values[Key]),
    });
  }

  removeSetting(id: string): void {
    const index = findIndexArray(this.entries, (entry) => entry.id === id);
    if (index < 0) return;

    const entry = removeAtArray(this.entries, index);
    entry?.dispose?.();
    this.syncEntryIds();
  }

  private add(entry: NewSettingEntry): string {
    const id = `setting-${++this.sequence}`;
    this.entries.push({ ...entry, id, version: signal(0, { name: `settings.${id}` }) } as SettingEntry);
    this.syncEntryIds();
    return id;
  }

  private addConfigEntry<
    Values extends object,
    Key extends Extract<keyof Values, string>,
    Entry extends Omit<SettingEntry, "id" | "dispose" | "version">,
  >(
    config: ConfigLike<Values>,
    key: Key,
    entry: Entry,
  ): string {
    const id = `setting-${++this.sequence}`;
    const version = signal(0, { name: `settings.${id}` });
    const listener: ConfigChangeListener<Values> = (changedKey) => {
      if (changedKey === key) version.update((current) => current + 1);
    };

    config.on("change", listener);
    this.entries.push({
      ...entry,
      id,
      version,
      dispose: () => config.off("change", listener),
    } as SettingEntry);

    this.syncEntryIds();
    return id;
  }

  private syncEntryIds(): void {
    this.entryIds.set(mapArray(this.entries, (entry) => entry.id));
  }

  private renderEntryById(id: string): RenderValue {
    const entry = findArray(this.entries, (candidate) => candidate.id === id);
    if (!entry) return null;

    entry.version();
    return this.renderEntry(entry);
  }

  private renderEntry(entry: SettingEntry): RenderValue {
    switch (entry.kind) {
      case "separator":
        return html`<SettingsSeparator />`;

      case "text":
        return html`<SettingsSectionTitle>${entry.label ?? ""}</SettingsSectionTitle>`;

      case "button":
        return html`
          <SettingsRow>
            <SettingsText>${entry.label ?? ""}</SettingsText>
            <SettingsButton type="button" @click=${event.click(() => void entry.handler())}>Run</SettingsButton>
          </SettingsRow>
        `;

      case "switch":
        return html`
          <SettingsRow>
            <SettingsText>${entry.label ?? ""}</SettingsText>
            <SettingsInput
              type="checkbox"
              .checked=${entry.getValue()}
              @change=${event.change((change) => {
                entry.setValue(change.target instanceof HTMLInputElement && change.target.checked);
              })}
            />
          </SettingsRow>
        `;

      case "select": {
        const value = entry.getValue();
        return html`
          <SettingsRow>
            <SettingsText>${entry.label ?? ""}</SettingsText>
            <SettingsSelect
              .value=${value}
              @change=${event.change((change) => {
                if (change.target instanceof HTMLSelectElement) entry.setValue(change.target.value);
              })}
            >
              ${mapArray(entry.selections, (selection) => html`
                <option value=${selection} .selected=${selection === value}>${selection}</option>
              `)}
            </SettingsSelect>
          </SettingsRow>
        `;
      }

      case "number": {
        const value = entry.getValue();
        return html`
          <SettingsRow>
            <SettingsText>${entry.label ?? ""}</SettingsText>
            <SettingsInput
              type="number"
              min=${String(entry.range.min ?? "")}
              max=${String(entry.range.max ?? "")}
              step=${String(entry.range.step ?? 1)}
              .value=${String(value)}
              @change=${event.change((change) => {
                if (!(change.currentTarget instanceof HTMLInputElement)) return;
                const next = change.currentTarget.valueAsNumber;
                if (Number.isFinite(next)) entry.setValue(next);
              })}
            />
          </SettingsRow>
        `;
      }

      case "range": {
        const value = entry.getValue();
        return html`
          <SettingsRow>
            <SettingsText>${entry.label ?? ""}: ${String(value)}</SettingsText>
            <SettingsInput
              type="range"
              min=${String(entry.range.min ?? 0)}
              max=${String(entry.range.max ?? 100)}
              step=${String(entry.range.step ?? 1)}
              .value=${String(value)}
              @input=${event.input((input) => {
                if (input.target instanceof HTMLInputElement) entry.setValue(Number(input.target.value));
              })}
            />
          </SettingsRow>
        `;
      }
    }
  }
}
