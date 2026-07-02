import type { ShellRefs } from "./components/shell";
import { ConfigStore } from "./core/config";
import { delegate, on } from "./core/dom";
import { asNode, event, html, ref, uiState } from "./components/runtime";
import { Emitter } from "./core/emitter";
import { applyTheme, themes } from "./core/theme";
import type {
  DevtoolsControllerLike,
  DevtoolsDefaults,
  NotificationOptions,
  SettingsLike,
  ToolContext,
  ToolLike,
} from "./types";

interface ControllerEvents {
  show: [];
  hide: [];
  showTool: [name: string, previous?: ToolLike];
  add: [tool: ToolLike];
  remove: [name: string];
  [key: string]: unknown[];
}

interface DevToolsConfig extends Record<string, unknown> {
  transparency: number;
  displaySize: number;
  theme: string;
  panelOrder: string[];
  disabledPanels: string[];
}

export class DevTools extends Emitter<ControllerEvents> implements DevtoolsControllerLike {
  readonly config: ConfigStore<DevToolsConfig>;
  private readonly tools = new Map<string, ToolLike>();
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private readonly context: ToolContext;
  private cleanup: Array<() => void> = [];
  private currentTool = "";
  private visible = false;
  private settings: SettingsLike | null = null;
  private notificationSequence = 0;
  private resizeStartY = 0;
  private resizeStartSize = 0;
  private resizing = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly shadowRoot: ShadowRoot | null,
    private readonly refs: ShellRefs,
    private readonly inline = false,
    defaults: DevtoolsDefaults = {},
  ) {
    super();
    this.config = new ConfigStore<DevToolsConfig>("dev-tools", {
      transparency: defaults.transparency ?? 0.95,
      displaySize: defaults.displaySize ?? 80,
      theme: defaults.theme ?? "System preference",
      panelOrder: [],
      disabledPanels: [],
    });
    this.context = {
      root: refs.root,
      shadowRoot,
      container: refs.tools,
      devtools: this,
      get settings() {
        const owner = this.devtools as DevTools;
        if (!owner.settings) throw new Error("Settings tool has not been registered yet");
        return owner.settings;
      },
      notify: (message, options) => this.notify(message, options),
      prompt: (message, initialValue) => this.prompt(message, initialValue),
      confirm: (message) => this.confirm(message),
    };
    this.bind();
    this.applyConfiguration();
  }

  add(tool: ToolLike): this {
    const name = String(tool.name || "").trim();
    if (!name) throw new Error("A tool must have a name");
    if (this.tools.has(name)) {
      this.notify(`Tool “${name}” already exists`, { type: "warning" });
      return this;
    }

    let panel!: HTMLElement;
    const panelFragment = html`
      <section
        class=${`roderuda-tool roderuda-tool-${name.replace(/\s+/g, "-")}`}
        role="tabpanel"
        data-tool=${name}
        aria-label=${tool.title ?? name}
        ref=${ref((node) => { panel = node as HTMLElement; })}
      />
    `;
    asNode(panelFragment);
    this.refs.tools.prepend(panel);

    let tab!: HTMLButtonElement;
    const tabFragment = html`
      <button
        class="roderuda-tab"
        type="button"
        role="tab"
        data-tool-tab=${name}
        aria-selected="false"
        draggable=${name === "settings" ? "false" : "true"}
        @click=${event(() => this.showTool(name))}
        ref=${ref((node) => { tab = node as HTMLButtonElement; })}
      >
        <span class="roderuda-tab-icon">${tool.icon ?? name.slice(0, 1).toUpperCase()}</span>
        <span class="roderuda-tab-label">${tool.title ?? name}</span>
      </button>
    `;
    asNode(tabFragment);
    const settingsTab = this.refs.tabbar.querySelector('[data-tool-tab="settings"]');
    if (name !== "settings" && settingsTab) this.refs.tabbar.insertBefore(tab, settingsTab);
    else this.refs.tabbar.append(tab);

    this.tools.set(name, tool);
    this.tabs.set(name, tab);
    this.applyPanelPreferences();
    uiState.setPath("panels.names", [...this.tools.keys()]);
    if (name === "settings") this.settings = tool as SettingsLike;

    try {
      void Promise.resolve(tool.init(panel, this.context)).catch((error) => {
        this.notify(`Unable to initialize ${name}: ${this.errorMessage(error)}`, { type: "error", duration: 7000 });
      });
    } catch (error) {
      panel.remove();
      tab.remove();
      this.tools.delete(name);
      this.tabs.delete(name);
      throw error;
    }

    this.emit("add", tool);
    return this;
  }

  remove(name: string): this {
    const tool = this.tools.get(name);
    if (!tool) return this;
    const wasActive = tool.active;
    tool.destroy();
    this.tabs.get(name)?.remove();
    this.tabs.delete(name);
    this.tools.delete(name);
    uiState.setPath("panels.names", [...this.tools.keys()]);
    if (this.settings === tool) this.settings = null;
    if (wasActive) {
      this.currentTool = "";
      const fallback = [...this.tools.keys()].find((key) => key !== "settings") ?? this.tools.keys().next().value;
      if (fallback) this.showTool(fallback);
    }
    this.emit("remove", name);
    return this;
  }

  removeAll(): this {
    for (const name of [...this.tools.keys()]) this.remove(name);
    return this;
  }

  get<T extends ToolLike = ToolLike>(name: string): T | undefined {
    return this.tools.get(name) as T | undefined;
  }

  showTool(name: string): this {
    const tool = this.tools.get(name);
    if (!tool) {
      this.notify(`Tool “${name}” does not exist`, { type: "warning" });
      return this;
    }
    if (this.isPanelDisabled(name)) {
      const fallback = this.firstEnabledTool();
      if (fallback && fallback !== name) return this.showTool(fallback);
      this.notify(`Tool “${name}” is disabled`, { type: "warning" });
      return this;
    }
    if (!this.visible) this.show();
    if (this.currentTool === name && tool.active) return this;
    let previous: ToolLike | undefined;
    for (const [toolName, candidate] of this.tools) {
      const active = candidate.active === true;
      if (active) {
        previous = candidate;
        candidate.hide();
      }
      const tab = this.tabs.get(toolName);
      tab?.classList.remove("roderuda-selected");
      tab?.setAttribute("aria-selected", "false");
    }
    tool.show();
    const tab = this.tabs.get(name);
    tab?.classList.add("roderuda-selected");
    tab?.setAttribute("aria-selected", "true");
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    this.currentTool = name;
    uiState.setPath("panels.active", name);
    this.emit("showTool", name, previous);
    return this;
  }

  show(): this {
    if (this.visible) return this;
    this.visible = true;
    this.refs.devtools.style.display = "block";
    this.refs.devtools.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => { this.refs.devtools.style.opacity = String(this.config.get<number>("transparency")); });
    this.emit("show");
    return this;
  }

  hide(): this {
    if (this.inline || !this.visible) return this;
    this.visible = false;
    this.refs.devtools.style.opacity = "0";
    this.refs.devtools.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (!this.visible) this.refs.devtools.style.display = "none";
    }, 300);
    this.emit("hide");
    return this;
  }

  toggle(): this {
    return this.visible ? this.hide() : this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  getRoot(): HTMLElement {
    return this.refs.root;
  }

  notify(message: string, options: NotificationOptions = {}): void {
    let item!: HTMLElement;
    asNode(html`
      <div
        class=${`roderuda-notification roderuda-notification-${options.type ?? "info"}`}
        role=${options.type === "error" ? "alert" : "status"}
        data-notification=${++this.notificationSequence}
        @click=${event(() => item && item.remove())}
        ref=${ref((node) => { item = node as HTMLElement; })}
      >${message}</div>
    `);
    this.refs.notifications.append(item);
    requestAnimationFrame(() => item.classList.add("roderuda-active"));
    const remove = () => {
      item.classList.remove("roderuda-active");
      window.setTimeout(() => item.remove(), 180);
    };
    item.addEventListener("click", remove, { once: true });
    window.setTimeout(remove, Math.max(900, options.duration ?? 2800));
  }

  async prompt(message: string, initialValue = ""): Promise<string | null> {
    return new Promise((resolve) => {
      let body!: HTMLFormElement;
      let input!: HTMLInputElement;
      const finish = (value: string | null) => {
        body.remove();
        uiState.setPath("modal.active", false);
        this.refs.modalRoot.classList.remove("roderuda-active");
        resolve(value);
      };
      asNode(html`
        <form
          class="roderuda-modal"
          @submit=${event((event: Event) => { event.preventDefault(); finish(input.value); })}
          ref=${ref((node) => { body = node as HTMLFormElement; })}
        >
          <div class="roderuda-modal-title">${message}</div>
          <div class="roderuda-modal-body">
            <input
              class="roderuda-modal-input"
              value=${initialValue}
              autocomplete="off"
              ref=${ref((node) => { input = node as HTMLInputElement; input.value = initialValue; })}
            />
          </div>
          <div class="roderuda-modal-actions">
            <button class="roderuda-text-btn" type="button" @click=${event(() => finish(null))}>Cancel</button>
            <button class="roderuda-text-btn" type="submit">OK</button>
          </div>
        </form>
      `);
      this.openModal(body);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    });
  }

  async confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      let body!: HTMLElement;
      let accept!: HTMLButtonElement;
      const finish = (value: boolean) => {
        body.remove();
        uiState.setPath("modal.active", false);
        this.refs.modalRoot.classList.remove("roderuda-active");
        resolve(value);
      };
      asNode(html`
        <div class="roderuda-modal" ref=${ref((node) => { body = node as HTMLElement; })}>
          <div class="roderuda-modal-title">Confirm</div>
          <div class="roderuda-modal-body">${message}</div>
          <div class="roderuda-modal-actions">
            <button class="roderuda-text-btn" type="button" @click=${event(() => finish(false))}>Cancel</button>
            <button class="roderuda-text-btn" type="button" @click=${event(() => finish(true))} ref=${ref((node) => { accept = node as HTMLButtonElement; })}>Continue</button>
          </div>
        </div>
      `);
      this.openModal(body);
      requestAnimationFrame(() => accept.focus());
    });
  }

  initCfg(settings: SettingsLike): void {
    settings.registerSeparator();
    settings.registerSelect(this.config, "theme", "Theme", ["System preference", ...Object.keys(themes)]);
    if (!this.inline) {
      settings.registerRange(this.config, "transparency", "Transparency", { min: 0.2, max: 1, step: 0.01 });
      settings.registerRange(this.config, "displaySize", "Display Size", { min: 40, max: 100, step: 1 });
    }
    settings.registerButton("Choose active panels", () => this.configureActivePanels());
    settings.registerButton("Reset panel order", () => {
      this.config.set("panelOrder", []);
      this.applyPanelPreferences();
    });
    settings.registerButton("Restore defaults and reload", () => {
      this.config.reset();
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("roderuda:")) localStorage.removeItem(key);
      }
      location.reload();
    });
    settings.registerSeparator();
  }

  setScale(scale: number): this {
    const value = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.refs.root.style.setProperty("--rd-scale", String(value));
    this.refs.devtools.style.transformOrigin = "left bottom";
    this.refs.devtools.style.transform = value === 1 ? "" : `scale(${value})`;
    this.refs.devtools.style.width = value === 1 ? "100%" : `${100 / value}%`;
    return this;
  }

  destroy(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.removeAll();
    this.refs.root.remove();
    this.removeAllListeners();
  }

  private bind(): void {
    this.cleanup.push(delegate(this.refs.tabbar, "click", "[data-tool-tab]", (_event, tab) => this.showTool(tab.dataset.toolTab ?? "")));
    this.cleanup.push(delegate(this.refs.tabbar, "dragstart", "[data-tool-tab]", (event, tab) => {
      if (tab.dataset.toolTab === "settings" || !(event instanceof DragEvent)) return;
      event.dataTransfer?.setData("text/plain", tab.dataset.toolTab ?? "");
      event.dataTransfer?.setDragImage?.(tab, 8, 8);
    }));
    this.cleanup.push(delegate(this.refs.tabbar, "dragover", "[data-tool-tab]", (event) => {
      if (event instanceof DragEvent) event.preventDefault();
    }));
    this.cleanup.push(delegate(this.refs.tabbar, "drop", "[data-tool-tab]", (event, tab) => {
      if (!(event instanceof DragEvent)) return;
      event.preventDefault();
      const source = event.dataTransfer?.getData("text/plain") || "";
      const target = tab.dataset.toolTab || "";
      if (!source || !target || source === target || source === "settings") return;
      this.movePanel(source, target);
    }));
    this.cleanup.push(on(this.refs.resizer, "pointerdown", (event: PointerEvent) => {
      if (this.inline) return;
      event.preventDefault();
      this.resizing = true;
      this.resizeStartY = event.clientY;
      this.resizeStartSize = this.config.get<number>("displaySize");
      this.refs.resizer.setPointerCapture?.(event.pointerId);
      this.refs.resizer.style.height = "100%";
    }));
    this.cleanup.push(on(window, "pointermove", (event: PointerEvent) => {
      if (!this.resizing) return;
      const delta = ((this.resizeStartY - event.clientY) / innerHeight) * 100;
      this.config.set("displaySize", Math.max(40, Math.min(100, Math.round(this.resizeStartSize + delta))));
    }));
    this.cleanup.push(on(window, "pointerup", (event: PointerEvent) => {
      if (!this.resizing) return;
      this.resizing = false;
      this.refs.resizer.releasePointerCapture?.(event.pointerId);
      this.refs.resizer.style.height = "";
    }));
    const onConfigChange = (key: string) => this.applyConfiguration(key);
    this.config.on("change", onConfigChange);
    this.cleanup.push(() => this.config.off("change", onConfigChange));
    if (typeof matchMedia === "function") {
      const media = matchMedia("(prefers-color-scheme: dark)");
      const listener = () => {
        if (this.config.get<string>("theme") === "System preference") this.applyConfiguration("theme");
      };
      media.addEventListener?.("change", listener);
      this.cleanup.push(() => media.removeEventListener?.("change", listener));
    }
  }

  private applyConfiguration(key?: string): void {
    if (!key || key === "theme") {
      const themeName = String(this.config.get("theme"));
      const host = this.shadowRoot?.host;
      if (host instanceof HTMLElement) applyTheme(host, themeName);
      applyTheme(this.refs.root, themeName);
    }
    if (!key || key === "transparency") {
      if (this.visible || this.inline) this.refs.devtools.style.opacity = String(this.config.get<number>("transparency"));
    }
    if (!key || key === "displaySize") {
      this.refs.devtools.style.height = `${this.inline ? 100 : this.config.get<number>("displaySize")}%`;
    }
    if (!key || key === "panelOrder" || key === "disabledPanels") this.applyPanelPreferences();
    if (this.inline) {
      this.visible = true;
      this.refs.devtools.style.display = "block";
      this.refs.devtools.style.opacity = "1";
      this.refs.devtools.setAttribute("aria-hidden", "false");
      this.refs.resizer.hidden = true;
    }
  }

  private async configureActivePanels(): Promise<void> {
    const names = [...this.tools.keys()].filter((name) => name !== "settings");
    const active = names.filter((name) => !this.isPanelDisabled(name));
    const value = await this.prompt("Active panels, comma-separated", active.join(", "));
    if (value == null) return;
    const requested = new Set(value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
    const disabled = names.filter((name) => !requested.has(name.toLowerCase()));
    this.config.set("disabledPanels", disabled);
    this.applyPanelPreferences();
    if (this.currentTool && this.isPanelDisabled(this.currentTool)) {
      const fallback = this.firstEnabledTool();
      if (fallback) this.showTool(fallback);
    }
  }

  private movePanel(source: string, target: string): void {
    const ordered = this.panelOrder();
    const from = ordered.indexOf(source);
    const to = ordered.indexOf(target);
    if (from < 0 || to < 0) return;
    ordered.splice(from, 1);
    ordered.splice(to, 0, source);
    this.config.set("panelOrder", ordered);
    this.applyPanelPreferences();
  }

  private applyPanelPreferences(): void {
    const order = this.panelOrder();
    const settingsTab = this.tabs.get("settings");
    for (const name of order) {
      const tab = this.tabs.get(name);
      const panel = Array.from(this.refs.tools.querySelectorAll<HTMLElement>("[data-tool]")).find((candidate) => candidate.dataset.tool === name);
      if (tab && name !== "settings") this.refs.tabbar.insertBefore(tab, settingsTab ?? null);
      if (panel) this.refs.tools.append(panel);
      const disabled = this.isPanelDisabled(name);
      if (tab) tab.hidden = disabled;
      if (panel) panel.hidden = disabled;
    }
    if (settingsTab) this.refs.tabbar.append(settingsTab);
    uiState.setPath("panels.names", order);
  }

  private panelOrder(): string[] {
    const configured = this.config.get<string[]>("panelOrder");
    const known = [...this.tools.keys()];
    const ordered = Array.isArray(configured) ? configured.filter((name) => this.tools.has(name)) : [];
    for (const name of known) if (!ordered.includes(name)) ordered.push(name);
    return ordered;
  }

  private isPanelDisabled(name: string): boolean {
    if (name === "settings") return false;
    const disabled = this.config.get<string[]>("disabledPanels");
    return Array.isArray(disabled) && disabled.includes(name);
  }

  private firstEnabledTool(): string | undefined {
    return this.panelOrder().find((name) => !this.isPanelDisabled(name) && this.tools.has(name));
  }

  private openModal(modal: HTMLElement): void {
    this.refs.modalRoot.replaceChildren(modal);
    uiState.setPath("modal.active", true);
    this.refs.modalRoot.classList.add("roderuda-active");
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
