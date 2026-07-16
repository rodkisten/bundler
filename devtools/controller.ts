import { signal } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";
import { event, html } from "@rodkisten/devtools/core/runtime";
import { ConfigStore } from "@rodkisten/devtools/core/config";
import { on } from "@rodkisten/devtools/core/dom";
import { Emitter } from "@rodkisten/devtools/core/emitter";
import { applyTheme, themes } from "@rodkisten/devtools/core/theme";
import type {
  DevtoolsContextValue,
  DevtoolsControllerLike,
  DevtoolsDefaults,
  DevtoolsNotificationEntry,
  DevtoolsShellRefs,
  DevtoolsToolRegistration,
  DevToolsConfig,
  NotificationOptions,
  SettingsLike,
  ToolContext,
  ToolLike,
} from "@rodkisten/devtools/types";

interface ControllerEvents {
  show: [];
  hide: [];
  showTool: [name: string, previous?: ToolLike];
  add: [tool: ToolLike];
  remove: [name: string];
  [key: string]: unknown[];
}


export class DevTools extends Emitter<ControllerEvents> implements DevtoolsControllerLike {
  readonly config: ConfigStore<DevToolsConfig>;

  private readonly tools = new Map<string, ToolLike>();
  private readonly registrations = new Map<string, DevtoolsToolRegistration>();
  private readonly mountedTools = new Set<string>();
  private readonly context: ToolContext;

  private cleanup: Array<() => void> = [];
  private notificationSequence = 0;
  private readonly notificationTimers = new Map<number, number>();
  private resizeStartY = 0;
  private resizeStartSize = 0;
  private resizing = false;

  constructor(
    host: HTMLElement,
    private readonly shadowRoot: ShadowRoot | null,
    private readonly refs: DevtoolsShellRefs,
    private readonly inline = false,
    defaults: DevtoolsDefaults = {},
    private readonly sharedContext: DevtoolsContextValue,
  ) {
    super();

    void host;

    this.config = new ConfigStore<DevToolsConfig>("dev-tools", {
      transparency: defaults.transparency ?? 0.95,
      blur: defaults.blur ?? 0,
      displaySize: defaults.displaySize ?? 80,
      theme: defaults.theme ?? "System preference",
      panelOrder: [],
      disabledPanels: [],
      tabHeight: 40,
      tabMinWidth: 78,
      compactTabMinWidth: 58,
      tabFontSize: 12,
      uiFontSize: 14,
      entryButtonSize: 48,
      safeAreaMinimum: 20,
      dockBottomGap: 0,
      resizerHeight: 30,
      resizerHandleWidth: 64,
      resizerHandleHeight: 6,
      notificationDuration: 2800,
      notificationMaxVisible: 3,
      notificationWidth: 440,
      notificationTop: 48,
      modalMaxWidth: 480,
      modalMaxHeight: 620,
      animationDuration: 300,
      panelPadding: 12,
      panelGap: 10,
    });

    this.context = {
      root: refs.root,
      shadowRoot,
      container: refs.tools,
      devtools: this,
      get settings() {
        const settings = sharedContext.settings.peek();
        if (!settings) throw new Error("Settings tool has not been registered yet");
        return settings;
      },
      notify: (message, options) => this.notify(message, options),
      prompt: (message, initialValue) => this.prompt(message, initialValue),
      confirm: (message) => this.confirm(message),
    };

    this.sharedContext.toolContext.set(this.context);

    this.bind();
    this.updateViewportMetrics();
    this.applyConfiguration();
  }

  add(tool: ToolLike): this {
    const name = String(tool.name || "").trim();

    if (!name) throw new Error("A tool must have a name");

    if (this.tools.has(name)) {
      this.notify(`Tool “${name}” already exists`, { type: "warning" });
      return this;
    }

    this.tools.set(name, tool);

    if (name === "settings") {
      this.sharedContext.settings.set(tool as SettingsLike);
    }

    const registration: DevtoolsToolRegistration = {
      name,
      title: tool.title ?? name,
      icon: tool.icon,
      tool,
      disabled: false,
      view: () => tool.renderView?.() ?? null,
      mount: (panel) => this.mountTool(name, tool, panel),
      activate: () => { this.showTool(name); },
      dragStart: (drag) => this.handleTabDragStart(drag, name),
      dragOver: (drag) => this.handleTabDragOver(drag),
      drop: (drop) => this.handleTabDrop(drop, name),
    };

    this.registrations.set(name, registration);
    this.applyPanelPreferences();
    this.emit("add", tool);
    return this;
  }

  private mountTool(name: string, tool: ToolLike, panel: HTMLElement): void {
    if (this.mountedTools.has(name) || this.tools.get(name) !== tool) return;

    this.mountedTools.add(name);

    try {
      void Promise.resolve(tool.init(panel, this.context)).catch((error) => {
        this.mountedTools.delete(name);
        this.notify(`Unable to initialize ${name}: ${this.errorMessage(error)}`, {
          type: "error",
          duration: 7000,
        });
      });
    } catch (error) {
      this.mountedTools.delete(name);
      this.notify(`Unable to initialize ${name}: ${this.errorMessage(error)}`, {
        type: "error",
        duration: 7000,
      });
    }
  }

  remove(name: string): this {
    const tool = this.tools.get(name);
    if (!tool) return this;

    const wasActive = tool.active === true;

    tool.destroy();
    this.mountedTools.delete(name);
    this.tools.delete(name);
    this.registrations.delete(name);

    if (this.sharedContext.settings.peek() === tool) {
      this.sharedContext.settings.set(null);
    }

    if (wasActive) {
      this.sharedContext.activePanel.set("");
    }

    this.applyPanelPreferences();

    if (wasActive) {
      const fallback = this.firstEnabledTool();
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

    if (!this.sharedContext.visible.peek()) this.show();
    if (this.sharedContext.activePanel.peek() === name && tool.active) return this;

    let previous: ToolLike | undefined;

    for (const candidate of this.tools.values()) {
      if (candidate.active === true) {
        previous = candidate;
        candidate.hide();
      }
    }

    tool.show();
    this.sharedContext.activePanel.set(name);

    queueMicrotask(() => {
      const selector = `[data-tool-tab="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name}"]`;
      this.refs.tabbar.querySelector<HTMLElement>(selector)?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    });

    this.emit("showTool", name, previous);
    return this;
  }

  show(): this {
    if (this.sharedContext.visible.peek()) return this;

    this.sharedContext.visible.set(true);
    this.refs.root.style.setProperty("--rd-transparency", String(this.config.get("transparency")));
    this.refs.root.style.setProperty("--rd-blur", `${this.config.get("blur")}px`);

    this.emit("show");
    return this;
  }

  hide(): this {
    if (this.inline || !this.sharedContext.visible.peek()) return this;

    this.sharedContext.visible.set(false);
    this.emit("hide");
    return this;
  }

  toggle(): this {
    return this.sharedContext.visible.peek() ? this.hide() : this.show();
  }

  isVisible(): boolean {
    return this.sharedContext.visible.peek();
  }

  getRoot(): HTMLElement {
    return this.refs.root;
  }

  notify(message: string, options: NotificationOptions = {}): void {
    const type = options.type ?? "info";
    const notifications = this.sharedContext.notifications;

    const duplicate = notifications.peek().find(
      (entry) => entry.message === message && entry.type === type,
    );

    if (duplicate) {
      duplicate.active.set(true);
      this.scheduleNotificationDismiss(
        duplicate,
        options.duration ?? this.config.get("notificationDuration"),
      );
      return;
    }

    const id = ++this.notificationSequence;
    const entry: DevtoolsNotificationEntry = {
      id,
      message,
      type,
      active: signal(false, { name: `devtools.notification.${id}.active` }),
      dismiss: () => this.dismissNotification(id),
    };

    const maxVisible = Math.max(1, this.config.get("notificationMaxVisible"));
    const current = notifications.peek();
    const overflow = Math.max(0, current.length - maxVisible + 1);

    for (const stale of current.slice(0, overflow)) {
      this.clearNotificationTimer(stale.id);
    }

    notifications.set([...current.slice(overflow), entry]);

    requestAnimationFrame(() => entry.active.set(true));
    this.scheduleNotificationDismiss(
      entry,
      options.duration ?? this.config.get("notificationDuration"),
    );
  }

  async prompt(message: string, initialValue = ""): Promise<string | null> {
    return new Promise((resolve) => {
      let input: HTMLInputElement | null = null;

      const finish = (value: string | null) => {
        this.closeModal();
        resolve(value);
      };

      this.openModal(html`
        <RodDevtoolsModalSurface
          @submit=${event.submit((submit) => {
            submit.preventDefault();
            finish(input?.value ?? "");
          })}
        >
          <RodDevtoolsModalTitle>${message}</RodDevtoolsModalTitle>
          <RodDevtoolsModalBody>
            <RodDevtoolsModalInput
              .value=${initialValue}
              autocomplete="off"
              ref=${(node: HTMLInputElement) => {
                input = node;
                return () => {
                  input = null;
                };
              }}
            />
          </RodDevtoolsModalBody>
          <RodDevtoolsModalActions>
            <RodDevtoolsTextButton type="button" @click=${event.click(() => finish(null))}>Cancel</RodDevtoolsTextButton>
            <RodDevtoolsTextButton type="submit" :primary="true">OK</RodDevtoolsTextButton>
          </RodDevtoolsModalActions>
        </RodDevtoolsModalSurface>
      `);

      requestAnimationFrame(() => {
        input?.focus();
        input?.select();
      });
    });
  }

  async confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      let accept: HTMLButtonElement | null = null;

      const finish = (value: boolean) => {
        this.closeModal();
        resolve(value);
      };

      this.openModal(html`
        <RodDevtoolsModalBox>
          <RodDevtoolsModalTitle>Confirm</RodDevtoolsModalTitle>
          <RodDevtoolsModalBody>${message}</RodDevtoolsModalBody>
          <RodDevtoolsModalActions>
            <RodDevtoolsTextButton type="button" @click=${event.click(() => finish(false))}>Cancel</RodDevtoolsTextButton>
            <RodDevtoolsTextButton
              type="button"
              :primary="true"
              @click=${event.click(() => finish(true))}
              ref=${(node: HTMLButtonElement) => {
                accept = node;
                return () => {
                  accept = null;
                };
              }}
            >
              Continue
            </RodDevtoolsTextButton>
          </RodDevtoolsModalActions>
        </RodDevtoolsModalBox>
      `);

      requestAnimationFrame(() => accept?.focus());
    });
  }

  initCfg(settings: SettingsLike): void {
    settings.registerConfigGroup({
      title: "DevTools appearance and layout",
      config: this.config,
      settings: [
        { kind: "select", key: "theme", label: "Theme", selections: ["System preference", ...Object.keys(themes)] },
        ...(!this.inline ? [
          { kind: "range" as const, key: "transparency" as const, label: "Transparency", options: { min: 0.2, max: 1, step: 0.01 } },
          { kind: "range" as const, key: "blur" as const, label: "Background blur", options: { min: 0, max: 24, step: 0.25 } },
          { kind: "range" as const, key: "displaySize" as const, label: "Display size (%)", options: { min: 30, max: 100, step: 1 } },
        ] : []),
        { kind: "number", key: "uiFontSize", label: "UI font size", options: { min: 9, max: 24, step: 1 } },
        { kind: "number", key: "tabHeight", label: "Tab bar height", options: { min: 30, max: 72, step: 1 } },
        { kind: "number", key: "tabMinWidth", label: "Desktop tab minimum width", options: { min: 42, max: 160, step: 1 } },
        { kind: "number", key: "compactTabMinWidth", label: "Compact tab minimum width", options: { min: 36, max: 120, step: 1 } },
        { kind: "number", key: "tabFontSize", label: "Tab label font size", options: { min: 9, max: 20, step: 1 } },
        { kind: "number", key: "entryButtonSize", label: "Floating entry button size", options: { min: 32, max: 96, step: 1 } },
        { kind: "number", key: "safeAreaMinimum", label: "Minimum bottom safe area", options: { min: 0, max: 80, step: 1 } },
        { kind: "number", key: "dockBottomGap", label: "Dock bottom gap", options: { min: 0, max: 80, step: 1 } },
        { kind: "number", key: "resizerHeight", label: "Resize gesture height", options: { min: 16, max: 80, step: 1 } },
        { kind: "number", key: "resizerHandleWidth", label: "Resize handle width", options: { min: 24, max: 160, step: 1 } },
        { kind: "number", key: "resizerHandleHeight", label: "Resize handle thickness", options: { min: 2, max: 16, step: 1 } },
        { kind: "number", key: "panelPadding", label: "Panel content padding", options: { min: 0, max: 40, step: 1 } },
        { kind: "number", key: "panelGap", label: "Panel spacing", options: { min: 0, max: 32, step: 1 } },
        { kind: "number", key: "notificationDuration", label: "Notification duration (ms)", options: { min: 300, max: 30000, step: 100 } },
        { kind: "number", key: "notificationMaxVisible", label: "Maximum visible notifications", options: { min: 1, max: 12, step: 1 } },
        { kind: "number", key: "notificationWidth", label: "Notification maximum width", options: { min: 220, max: 900, step: 10 } },
        { kind: "number", key: "notificationTop", label: "Notification top offset", options: { min: 0, max: 240, step: 1 } },
        { kind: "number", key: "modalMaxWidth", label: "Modal maximum width", options: { min: 280, max: 1200, step: 10 } },
        { kind: "number", key: "modalMaxHeight", label: "Modal maximum height", options: { min: 240, max: 1200, step: 10 } },
        { kind: "number", key: "animationDuration", label: "Animation duration (ms)", options: { min: 0, max: 2000, step: 25 } },
      ],
    });

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

  beginResize(pointer: PointerEvent): void {
    if (this.inline) return;

    pointer.preventDefault();
    this.resizing = true;
    this.resizeStartY = pointer.clientY;
    this.resizeStartSize = this.config.get("displaySize");

    if (pointer.currentTarget instanceof HTMLElement) {
      pointer.currentTarget.setPointerCapture?.(pointer.pointerId);
      pointer.currentTarget.style.height = "100%";
    }
  }

  updateResize(pointer: PointerEvent): void {
    if (!this.resizing) return;

    const delta = ((this.resizeStartY - pointer.clientY) / innerHeight) * 100;
    this.config.set(
      "displaySize",
      Math.max(40, Math.min(100, Math.round(this.resizeStartSize + delta))),
    );
  }

  endResize(pointer: PointerEvent): void {
    if (!this.resizing) return;

    this.resizing = false;
    if (pointer.currentTarget instanceof HTMLElement) {
      pointer.currentTarget.releasePointerCapture?.(pointer.pointerId);
      pointer.currentTarget.style.height = "";
    }
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
    for (const id of this.notificationTimers.keys()) this.clearNotificationTimer(id);
    this.sharedContext.notifications.set([]);
    this.closeModal();

    this.removeAll();
    this.removeAllListeners();
  }

  private bind(): void {
    const updateViewport = () => this.updateViewportMetrics();
    this.cleanup.push(on(window, "resize", updateViewport));
    this.cleanup.push(on(window, "orientationchange", updateViewport));
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", updateViewport);
      viewport.addEventListener("scroll", updateViewport);
      this.cleanup.push(() => {
        viewport.removeEventListener("resize", updateViewport);
        viewport.removeEventListener("scroll", updateViewport);
      });
    }

    const onConfigChange = (key: string) => this.applyConfiguration(key);
    this.config.on("change", onConfigChange);
    this.cleanup.push(() => this.config.off("change", onConfigChange));

    if (typeof matchMedia === "function") {
      const media = matchMedia("(prefers-color-scheme: dark)");

      const listener = () => {
        if (this.config.get("theme") === "System preference") {
          this.applyConfiguration("theme");
        }
      };

      media.addEventListener?.("change", listener);
      this.cleanup.push(() => media.removeEventListener?.("change", listener));
    }
  }

  private updateViewportMetrics(): void {
    const viewport = window.visualViewport;
    const top = Math.max(0, viewport?.offsetTop ?? 0);
    const height = Math.max(240, viewport?.height ?? window.innerHeight);
    const bottom = Math.max(0, window.innerHeight - (top + height));
    this.refs.root.style.setProperty("--rd-visual-viewport-top", `${top}px`);
    this.refs.root.style.setProperty("--rd-visual-viewport-height", `${height}px`);
    this.refs.root.style.setProperty("--rd-visual-viewport-bottom", `${bottom}px`);
  }

  private applyConfiguration(key?: string): void {
    if (!key || key === "theme") {
      const themeName = String(this.config.get("theme"));
      const host = this.shadowRoot?.host;

      if (host instanceof HTMLElement) applyTheme(host, themeName);
      applyTheme(this.refs.root, themeName);
    }

    if (!key || key === "transparency") {
      this.refs.root.style.setProperty("--rd-transparency", String(this.config.get("transparency")));
    }

    if (!key || key === "blur") {
      if (this.sharedContext.visible.peek() || this.inline) {
        this.refs.root.style.setProperty("--rd-blur", `${this.config.get("blur")}px`);
      }
    }

    if (!key || key === "displaySize") {
      this.refs.devtools.style.height = this.inline
        ? "100%"
        : `min(calc(${this.config.get("displaySize")}dvh - var(--rd-safe-bottom)), calc(var(--rd-visual-viewport-height) - var(--rd-safe-top) - var(--rd-safe-bottom) - 12px))`;
    }

    const cssVariables: Partial<Record<keyof DevToolsConfig, string>> = {
      tabHeight: "--rd-tab-height",
      tabMinWidth: "--rd-tab-min-width",
      compactTabMinWidth: "--rd-compact-tab-min-width",
      tabFontSize: "--rd-tab-font-size",
      uiFontSize: "--rd-ui-font-size",
      entryButtonSize: "--rd-entry-button-size",
      safeAreaMinimum: "--rd-safe-area-minimum",
      dockBottomGap: "--rd-dock-bottom-gap",
      resizerHeight: "--rd-resizer-height",
      resizerHandleWidth: "--rd-resizer-handle-width",
      resizerHandleHeight: "--rd-resizer-handle-height",
      notificationWidth: "--rd-notification-width",
      notificationTop: "--rd-notification-top",
      modalMaxWidth: "--rd-modal-max-width",
      modalMaxHeight: "--rd-modal-max-height",
      panelPadding: "--rd-panel-padding",
      panelGap: "--rd-panel-gap",
    };

    for (const [configKey, variable] of Object.entries(cssVariables) as Array<[keyof DevToolsConfig, string]>) {
      if (key && key !== configKey) continue;
      this.refs.root.style.setProperty(variable, `${this.config.snapshot()[configKey]}px`);
    }

    if (!key || key === "animationDuration") {
      this.refs.root.style.setProperty("--rd-animation-duration", `${this.config.get("animationDuration")}ms`);
    }

    if (!key || key === "panelOrder" || key === "disabledPanels") {
      this.applyPanelPreferences();
    }

    if (this.inline) {
      this.sharedContext.visible.set(true);
      this.refs.resizer.hidden = true;
    }
  }

  private async configureActivePanels(): Promise<void> {
    const names = [...this.tools.keys()].filter((name) => name !== "settings");
    const active = names.filter((name) => !this.isPanelDisabled(name));
    const value = await this.prompt("Active panels, comma-separated", active.join(", "));

    if (value == null) return;

    const requested = new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );

    const disabled = names.filter((name) => !requested.has(name.toLowerCase()));
    this.config.set("disabledPanels", disabled);
    this.applyPanelPreferences();

    const activePanel = this.sharedContext.activePanel.peek();
    if (activePanel && this.isPanelDisabled(activePanel)) {
      const fallback = this.firstEnabledTool();
      if (fallback) this.showTool(fallback);
    }
  }

  private handleTabDragStart(event: Event, name: string): void {
    if (name === "settings" || !(event instanceof DragEvent)) return;

    event.dataTransfer?.setData("text/plain", name);
    if (event.currentTarget instanceof HTMLElement) {
      event.dataTransfer?.setDragImage?.(event.currentTarget, 8, 8);
    }
  }

  private handleTabDragOver(event: Event): void {
    if (event instanceof DragEvent) event.preventDefault();
  }

  private handleTabDrop(event: Event, target: string): void {
    if (!(event instanceof DragEvent)) return;

    event.preventDefault();

    const source = event.dataTransfer?.getData("text/plain") || "";

    if (!source || !target || source === target || source === "settings") return;

    this.movePanel(source, target);
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
    const entries: DevtoolsToolRegistration[] = [];

    for (const name of order) {
      const registration = this.registrations.get(name);
      if (!registration) continue;
      entries.push({ ...registration, disabled: this.isPanelDisabled(name) });
    }

    this.sharedContext.tools.set(entries);
  }

  private panelOrder(): string[] {
    const configured = this.config.get("panelOrder");
    const known = [...this.tools.keys()].filter((name) => name !== "settings");
    const ordered = Array.isArray(configured)
      ? configured.filter((name) => name !== "settings" && this.tools.has(name))
      : [];

    for (const name of known) {
      if (!ordered.includes(name)) ordered.push(name);
    }

    if (this.tools.has("settings")) ordered.push("settings");
    return ordered;
  }

  private isPanelDisabled(name: string): boolean {
    if (name === "settings") return false;

    const disabled = this.config.get("disabledPanels");

    return Array.isArray(disabled) && disabled.includes(name);
  }

  private firstEnabledTool(): string | undefined {
    return this.panelOrder().find((name) => !this.isPanelDisabled(name) && this.tools.has(name));
  }

  private scheduleNotificationDismiss(
    entry: DevtoolsNotificationEntry,
    duration: number,
  ): void {
    this.clearNotificationTimer(entry.id);
    const timer = window.setTimeout(
      () => this.dismissNotification(entry.id),
      Math.max(300, duration),
    );
    this.notificationTimers.set(entry.id, timer);
  }

  private dismissNotification(id: number): void {
    const notifications = this.sharedContext.notifications;

    const entry = notifications.peek().find((candidate) => candidate.id === id);
    if (!entry) return;

    this.clearNotificationTimer(id);
    entry.active.set(false);

    const timer = window.setTimeout(() => {
      this.notificationTimers.delete(id);
      notifications.update((current) => current.filter((candidate) => candidate.id !== id));
    }, Math.max(80, Math.round(this.config.get("animationDuration") * 0.6)));

    this.notificationTimers.set(id, timer);
  }

  private clearNotificationTimer(id: number): void {
    const timer = this.notificationTimers.get(id);
    if (timer != null) window.clearTimeout(timer);
    this.notificationTimers.delete(id);
  }

  private openModal(modal: RenderValue): void {
    this.sharedContext.modal.set(modal);
  }

  private closeModal(): void {
    this.sharedContext.modal.set(null);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
