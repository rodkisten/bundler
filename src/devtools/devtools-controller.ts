import type { ShellRefs } from "./components/shell";
import { ConfigStore } from "./core/config";
import { create, delegate, on } from "./core/dom";
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

    const panel = create("section", {
      className: `roderuda-tool roderuda-tool-${name.replace(/\s+/g, "-")}`,
      attrs: { role: "tabpanel", "data-tool": name, "aria-label": tool.title ?? name },
    });
    this.refs.tools.prepend(panel);

    const tab = create("button", {
      className: "roderuda-tab",
      attrs: { type: "button", role: "tab", "data-tool-tab": name, "aria-selected": "false" },
    });
    tab.append(
      create("span", { className: "roderuda-tab-icon", text: tool.icon ?? name.slice(0, 1).toUpperCase() }),
      create("span", { className: "roderuda-tab-label", text: tool.title ?? name }),
    );
    const settingsTab = this.refs.tabbar.querySelector('[data-tool-tab="settings"]');
    if (name !== "settings" && settingsTab) this.refs.tabbar.insertBefore(tab, settingsTab);
    else this.refs.tabbar.append(tab);

    this.tools.set(name, tool);
    this.tabs.set(name, tab);
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
    const item = create("div", {
      className: `roderuda-notification roderuda-notification-${options.type ?? "info"}`,
      text: message,
      attrs: { role: options.type === "error" ? "alert" : "status", "data-notification": ++this.notificationSequence },
    });
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
      const body = create("form", { className: "roderuda-modal" });
      const input = create("input", { className: "roderuda-modal-input", attrs: { value: initialValue, autocomplete: "off" } });
      input.value = initialValue;
      body.append(
        create("div", { className: "roderuda-modal-title", text: message }),
        create("div", { className: "roderuda-modal-body" }),
      );
      body.querySelector(".roderuda-modal-body")?.append(input);
      const actions = create("div", { className: "roderuda-modal-actions" });
      const cancel = create("button", { className: "roderuda-text-btn", text: "Cancel", attrs: { type: "button" } });
      const submit = create("button", { className: "roderuda-text-btn", text: "OK", attrs: { type: "submit" } });
      actions.append(cancel, submit);
      body.append(actions);
      const finish = (value: string | null) => {
        body.remove();
        this.refs.modalRoot.classList.remove("roderuda-active");
        resolve(value);
      };
      cancel.addEventListener("click", () => finish(null));
      body.addEventListener("submit", (event) => { event.preventDefault(); finish(input.value); });
      this.openModal(body);
      requestAnimationFrame(() => { input.focus(); input.select(); });
    });
  }

  async confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const body = create("div", { className: "roderuda-modal" });
      body.append(
        create("div", { className: "roderuda-modal-title", text: "Confirm" }),
        create("div", { className: "roderuda-modal-body", text: message }),
      );
      const actions = create("div", { className: "roderuda-modal-actions" });
      const cancel = create("button", { className: "roderuda-text-btn", text: "Cancel", attrs: { type: "button" } });
      const accept = create("button", { className: "roderuda-text-btn", text: "Continue", attrs: { type: "button" } });
      actions.append(cancel, accept);
      body.append(actions);
      const finish = (value: boolean) => {
        body.remove();
        this.refs.modalRoot.classList.remove("roderuda-active");
        resolve(value);
      };
      cancel.addEventListener("click", () => finish(false));
      accept.addEventListener("click", () => finish(true));
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
    if (!key || key === "theme") applyTheme(this.refs.root, String(this.config.get("theme")));
    if (!key || key === "transparency") {
      if (this.visible || this.inline) this.refs.devtools.style.opacity = String(this.config.get<number>("transparency"));
    }
    if (!key || key === "displaySize") {
      this.refs.devtools.style.height = `${this.inline ? 100 : this.config.get<number>("displaySize")}%`;
    }
    if (this.inline) {
      this.visible = true;
      this.refs.devtools.style.display = "block";
      this.refs.devtools.style.opacity = "1";
      this.refs.devtools.setAttribute("aria-hidden", "false");
      this.refs.resizer.hidden = true;
    }
  }

  private openModal(modal: HTMLElement): void {
    this.refs.modalRoot.replaceChildren(modal);
    this.refs.modalRoot.classList.add("roderuda-active");
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
