import type { CipoCssArtifact } from "../cipo";
import type { ShellRefs } from "./components/shell";
import { asNode, event, html, ref, styled, uiState } from "./components/runtime";
import { ConfigStore } from "./core/config";
import { on } from "./core/dom";
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

const ToolPanel = styled.section("RodDevtoolsToolPanel").css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: $background;

  &[hidden] {
    display: none !important;
  }
`;

const TabButton = styled.button("RodDevtoolsTabButton").css`
  position: relative;
  flex: 0 0 auto;
  min-width: 78px;
  height: 40px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-transform: capitalize;
  font-size: 12px;
  white-space: nowrap;
  transition: color .2s, background .2s;

  &:hover {
    background: mix($highlight, transparent, 70%);
  }

  &[data-selected="true"] {
    color: $accent;
  }

  &[data-selected="true"]::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 0;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: $accent;
  }

  x:not(xs) {
    min-width: 58px;
    padding-inline: 7px;
  }
`;

const TabIcon = styled.span("RodDevtoolsTabIcon").css`
  display: inline-grid;
  place-items: center;
  font-size: 15px;
  line-height: 1;

  .roderuda-lucide-icon {
    display: block;
    flex: 0 0 auto;
    width: 1em;
    height: 1em;
    stroke: currentColor;
  }

  x:not(xs) {
    font-size: 17px;
  }
`;

const TabLabel = styled.span("RodDevtoolsTabLabel").css`
  x:not(xs) {
    display: none;
  }
`;

const NotificationToast = styled.div("RodDevtoolsNotificationToast").css`
  pointer-events: auto;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $notification;
  color: $primary;
  background: mix($background, transparent, 94%);
  box-shadow: $shadow.notification;
  backdrop-filter: blur(14px);
  opacity: 0;
  transform: translateY(-7px) scale(.98);
  transition: opacity .18s ease-out, transform .18s ease-out;

  &[data-active="true"] {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  &[data-type="success"] {
    border-color: $success;
  }

  &[data-type="warning"] {
    border-color: $warningBorder;
    background: $warningBg;
    color: $warningFg;
  }

  &[data-type="error"] {
    border-color: $errorBorder;
    background: $errorBg;
    color: $errorFg;
  }
`;

const ModalSurface = styled.form("RodDevtoolsModalSurface").css`
  width: min(100%, 480px);
  max-height: min(80vh, 620px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $background;
  border: 1px solid $border;
  border-radius: $modal;
  box-shadow: $shadow.modal;
`;

const ModalBox = styled.div("RodDevtoolsModalBox").css`
  width: min(100%, 480px);
  max-height: min(80vh, 620px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $background;
  border: 1px solid $border;
  border-radius: $modal;
  box-shadow: $shadow.modal;
`;

const ModalTitle = styled.div("RodDevtoolsModalTitle").css`
  padding: 13px 14px;
  color: $primary;
  font-weight: 700;
  border-bottom: 1px solid $border;
`;

const ModalBody = styled.div("RodDevtoolsModalBody").css`
  padding: 14px;
  overflow: auto;
  color: $foreground;
  user-select: text;
`;

const ModalInput = styled.input("RodDevtoolsModalInput").css`
  width: 100%;
  min-width: 0;
  margin-top: 12px;
  padding: 9px 10px;
  border: 1px solid $border;
  border-radius: $control;
  outline: none;
  background: $backgroundDark;
  color: $primary;
  user-select: text;

  &:focus {
    border-color: $accent;
  }
`;

const ModalActions = styled.div("RodDevtoolsModalActions").css`
  padding: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid $border;
`;

const TextButton = styled.button("RodDevtoolsTextButton").css`
  flex: 0 0 auto;
  min-width: 74px;
  min-height: 28px;
  padding: 8px 11px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: $control;
  background: $backgroundDark;
  color: $primary;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  transition: color .18s, background .18s, transform .1s;

  &:hover {
    background: $highlight;
    color: $selectedForeground;
  }

  &:active {
    transform: scale(.94);
    color: $accent;
  }

  &[data-primary="true"] {
    background: $accent;
    color: white;
  }
`;

const CONTROLLER_STYLED_COMPONENTS = Object.freeze([
  ToolPanel,
  TabButton,
  TabIcon,
  TabLabel,
  NotificationToast,
  ModalSurface,
  ModalBox,
  ModalTitle,
  ModalBody,
  ModalInput,
  ModalActions,
  TextButton,
]);

export const devtoolsControllerStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  CONTROLLER_STYLED_COMPONENTS
    .flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

export class DevTools extends Emitter<ControllerEvents> implements DevtoolsControllerLike {
  readonly config: ConfigStore<DevToolsConfig>;

  private readonly tools = new Map<string, ToolLike>();
  private readonly tabs = new Map<string, HTMLButtonElement>();
  private readonly panels = new Map<string, HTMLElement>();
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

    void this.host;

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

    asNode(html`
      <RodDevtoolsToolPanel
        role="tabpanel"
        data-tool=${name}
        aria-label=${tool.title ?? name}
        hidden
        ref=${ref<HTMLElement>((node) => {
          panel = node;
        })}
      />
    `);

    this.refs.tools.prepend(panel);

    let tab!: HTMLButtonElement;

    asNode(html`
      <RodDevtoolsTabButton
        type="button"
        role="tab"
        data-tool-tab=${name}
        data-selected="false"
        aria-selected="false"
        draggable=${name === "settings" ? "false" : "true"}
        @click=${event((click: Event) => {
          click.preventDefault();
          this.showTool(name);
        })}
        @dragstart=${event((drag: Event) => this.handleTabDragStart(drag, name, tab))}
        @dragover=${event((drag: Event) => this.handleTabDragOver(drag))}
        @drop=${event((drop: Event) => this.handleTabDrop(drop, name))}
        ref=${ref<HTMLButtonElement>((node) => {
          tab = node;
        })}
      >
        <RodDevtoolsTabIcon>${tool.icon ?? name.slice(0, 1).toUpperCase()}</RodDevtoolsTabIcon>
        <RodDevtoolsTabLabel>${tool.title ?? name}</RodDevtoolsTabLabel>
      </RodDevtoolsTabButton>
    `);

    const settingsTab = this.tabs.get("settings");
    if (name !== "settings" && settingsTab) this.refs.tabbar.insertBefore(tab, settingsTab);
    else this.refs.tabbar.append(tab);

    this.tools.set(name, tool);
    this.tabs.set(name, tab);
    this.panels.set(name, panel);

    if (name === "settings") this.settings = tool as SettingsLike;

    this.applyPanelPreferences();
    uiState.setPath("panels.names", [...this.tools.keys()]);

    try {
      void Promise.resolve(tool.init(panel, this.context)).catch((error) => {
        this.notify(`Unable to initialize ${name}: ${this.errorMessage(error)}`, {
          type: "error",
          duration: 7000,
        });
      });
    } catch (error) {
      panel.remove();
      tab.remove();
      this.tools.delete(name);
      this.tabs.delete(name);
      this.panels.delete(name);
      if (this.settings === tool) this.settings = null;
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
    this.panels.get(name)?.remove();

    this.tabs.delete(name);
    this.panels.delete(name);
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
      if (candidate.active === true) {
        previous = candidate;
        candidate.hide();
      }

      const tab = this.tabs.get(toolName);
      const panel = this.panels.get(toolName);

      if (tab) {
        tab.dataset.selected = "false";
        tab.setAttribute("aria-selected", "false");
      }

      if (panel) panel.hidden = true;
    }

    tool.show();

    const tab = this.tabs.get(name);
    const panel = this.panels.get(name);

    if (tab) {
      tab.dataset.selected = "true";
      tab.setAttribute("aria-selected", "true");
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    if (panel) panel.hidden = false;

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

    requestAnimationFrame(() => {
      this.refs.devtools.style.opacity = String(this.config.get<number>("transparency"));
    });

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

    const remove = () => {
      item.dataset.active = "false";
      window.setTimeout(() => item.remove(), 180);
    };

    asNode(html`
      <RodDevtoolsNotificationToast
        role=${options.type === "error" ? "alert" : "status"}
        data-type=${options.type ?? "info"}
        data-active="false"
        data-notification=${++this.notificationSequence}
        @click=${event((click: Event) => {
          click.preventDefault();
          remove();
        })}
        ref=${ref<HTMLElement>((node) => {
          item = node;
        })}
      >
        ${message}
      </RodDevtoolsNotificationToast>
    `);

    this.refs.notifications.append(item);

    requestAnimationFrame(() => {
      item.dataset.active = "true";
    });

    window.setTimeout(remove, Math.max(900, options.duration ?? 2800));
  }

  async prompt(message: string, initialValue = ""): Promise<string | null> {
    return new Promise((resolve) => {
      let body!: HTMLFormElement;
      let input!: HTMLInputElement;

      const finish = (value: string | null) => {
        body.remove();
        uiState.setPath("modal.active", false);
        this.refs.modalRoot.dataset.active = "false";
        resolve(value);
      };

      asNode(html`
        <RodDevtoolsModalSurface
          @submit=${event((submit: Event) => {
            submit.preventDefault();
            finish(input.value);
          })}
          ref=${ref<HTMLFormElement>((node) => {
            body = node;
          })}
        >
          <RodDevtoolsModalTitle>${message}</RodDevtoolsModalTitle>
          <RodDevtoolsModalBody>
            <RodDevtoolsModalInput
              .value=${initialValue}
              autocomplete="off"
              ref=${ref<HTMLInputElement>((node) => {
                input = node;
              })}
            />
          </RodDevtoolsModalBody>
          <RodDevtoolsModalActions>
            <RodDevtoolsTextButton type="button" @click=${event(() => finish(null))}>Cancel</RodDevtoolsTextButton>
            <RodDevtoolsTextButton type="submit" data-primary="true">OK</RodDevtoolsTextButton>
          </RodDevtoolsModalActions>
        </RodDevtoolsModalSurface>
      `);

      this.openModal(body);

      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    });
  }

  async confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      let body!: HTMLElement;
      let accept!: HTMLButtonElement;

      const finish = (value: boolean) => {
        body.remove();
        uiState.setPath("modal.active", false);
        this.refs.modalRoot.dataset.active = "false";
        resolve(value);
      };

      asNode(html`
        <RodDevtoolsModalBox
          ref=${ref<HTMLElement>((node) => {
            body = node;
          })}
        >
          <RodDevtoolsModalTitle>Confirm</RodDevtoolsModalTitle>
          <RodDevtoolsModalBody>${message}</RodDevtoolsModalBody>
          <RodDevtoolsModalActions>
            <RodDevtoolsTextButton type="button" @click=${event(() => finish(false))}>Cancel</RodDevtoolsTextButton>
            <RodDevtoolsTextButton
              type="button"
              data-primary="true"
              @click=${event(() => finish(true))}
              ref=${ref<HTMLButtonElement>((node) => {
                accept = node;
              })}
            >
              Continue
            </RodDevtoolsTextButton>
          </RodDevtoolsModalActions>
        </RodDevtoolsModalBox>
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
    this.cleanup.push(on(this.refs.entryButton, "click", (click: MouseEvent) => {
      click.preventDefault();
      click.stopPropagation();
      this.toggle();
    }));

    this.cleanup.push(on(this.refs.resizer, "pointerdown", (pointer: PointerEvent) => {
      if (this.inline) return;

      pointer.preventDefault();
      this.resizing = true;
      this.resizeStartY = pointer.clientY;
      this.resizeStartSize = this.config.get<number>("displaySize");
      this.refs.resizer.setPointerCapture?.(pointer.pointerId);
      this.refs.resizer.style.height = "100%";
    }));

    this.cleanup.push(on(window, "pointermove", (pointer: PointerEvent) => {
      if (!this.resizing) return;

      const delta = ((this.resizeStartY - pointer.clientY) / innerHeight) * 100;

      this.config.set(
        "displaySize",
        Math.max(40, Math.min(100, Math.round(this.resizeStartSize + delta))),
      );
    }));

    this.cleanup.push(on(window, "pointerup", (pointer: PointerEvent) => {
      if (!this.resizing) return;

      this.resizing = false;
      this.refs.resizer.releasePointerCapture?.(pointer.pointerId);
      this.refs.resizer.style.height = "";
    }));

    const onConfigChange = (key: string) => this.applyConfiguration(key);
    this.config.on("change", onConfigChange);
    this.cleanup.push(() => this.config.off("change", onConfigChange));

    if (typeof matchMedia === "function") {
      const media = matchMedia("(prefers-color-scheme: dark)");

      const listener = () => {
        if (this.config.get<string>("theme") === "System preference") {
          this.applyConfiguration("theme");
        }
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
      if (this.visible || this.inline) {
        this.refs.devtools.style.opacity = String(this.config.get<number>("transparency"));
      }
    }

    if (!key || key === "displaySize") {
      this.refs.devtools.style.height = `${this.inline ? 100 : this.config.get<number>("displaySize")}%`;
    }

    if (!key || key === "panelOrder" || key === "disabledPanels") {
      this.applyPanelPreferences();
    }

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

    const requested = new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );

    const disabled = names.filter((name) => !requested.has(name.toLowerCase()));
    this.config.set("disabledPanels", disabled);
    this.applyPanelPreferences();

    if (this.currentTool && this.isPanelDisabled(this.currentTool)) {
      const fallback = this.firstEnabledTool();
      if (fallback) this.showTool(fallback);
    }
  }

  private handleTabDragStart(event: Event, name: string, tab: HTMLButtonElement): void {
    if (name === "settings" || !(event instanceof DragEvent)) return;

    event.dataTransfer?.setData("text/plain", name);
    event.dataTransfer?.setDragImage?.(tab, 8, 8);
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
    const settingsTab = this.tabs.get("settings");

    for (const name of order) {
      const tab = this.tabs.get(name);
      const panel = this.panels.get(name);

      if (tab && name !== "settings") this.refs.tabbar.insertBefore(tab, settingsTab ?? null);
      if (panel) this.refs.tools.append(panel);

      const disabled = this.isPanelDisabled(name);

      if (tab) tab.hidden = disabled;
      if (panel) {
        // Ordering and enable/disable preferences should never erase the active panel state.
        // Visibility is owned by showTool(); preferences only hide disabled panels.
        panel.hidden = disabled || this.currentTool !== name;
      }
    }

    if (settingsTab) this.refs.tabbar.append(settingsTab);

    uiState.setPath("panels.names", order);
  }

  private panelOrder(): string[] {
    const configured = this.config.get<string[]>("panelOrder");
    const known = [...this.tools.keys()];
    const ordered = Array.isArray(configured)
      ? configured.filter((name) => this.tools.has(name))
      : [];

    for (const name of known) {
      if (!ordered.includes(name)) ordered.push(name);
    }

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
    this.refs.modalRoot.dataset.active = "true";
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
