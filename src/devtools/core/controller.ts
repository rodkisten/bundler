import type { CipoCssArtifact } from "../../cipo";
import type { ShellRefs } from "../core/shell";
import { asElement, event, html, ref, styled, uiState } from "../core/runtime";
import { ConfigStore } from "./config";
import { on } from "./dom";
import { icon } from "./utils";
import { Emitter } from "./emitter";
import { applyTheme, themes } from "./theme";
import type {
  DevtoolsControllerLike,
  DevtoolsDefaults,
  DevToolsConfig,
  NotificationOptions,
  SettingsLike,
  ToolContext,
  ToolLike,
} from "../types";

interface ControllerEvents {
  show: [];
  hide: [];
  showTool: [name: string, previous?: ToolLike];
  add: [tool: ToolLike];
  remove: [name: string];
  [key: string]: unknown[];
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
  min-width: var(--rd-tab-min-width, 78px);
  height: var(--rd-tab-height, 40px);
  padding: 0 var(--rd-panel-gap, 10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-transform: capitalize;
  font-size: var(--rd-tab-font-size, 12px);
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
    min-width: var(--rd-compact-tab-min-width, 58px);
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
  width: min(100%, var(--rd-modal-max-width, 480px));
  max-height: min(80vh, var(--rd-modal-max-height, 620px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $background;
  border: 1px solid $border;
  border-radius: $modal;
  box-shadow: $shadow.modal;
`;

const ModalBox = styled.div("RodDevtoolsModalBox").css`
  width: min(100%, var(--rd-modal-max-width, 480px));
  max-height: min(80vh, var(--rd-modal-max-height, 620px));
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

function renderToolIcon(value: Node | string | undefined, name: string): Node | string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "nodeType" in value) {
    return (value as Node).cloneNode(true);
  }

  const fallback = icon(name);
  return fallback instanceof Node ? fallback : name.slice(0, 1).toUpperCase();
}

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
        const owner = this.devtools as DevTools;
        if (!owner.settings) throw new Error("Settings tool has not been registered yet");
        return owner.settings;
      },
      notify: (message, options) => this.notify(message, options),
      prompt: (message, initialValue) => this.prompt(message, initialValue),
      confirm: (message) => this.confirm(message),
    };

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

    let panel!: HTMLElement;

    panel = asElement<HTMLElement>(html`
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

    tab = asElement<HTMLButtonElement>(html`
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
        <RodDevtoolsTabIcon>${renderToolIcon(tool.icon, name)}</RodDevtoolsTabIcon>
        <RodDevtoolsTabLabel>${tool.title ?? name}</RodDevtoolsTabLabel>
      </RodDevtoolsTabButton>
    `);

    const settingsTab = this.tabs.get("settings");
    const buildBadge = this.refs.tabbar.querySelector("[data-roderuda-build-badge]");
    this.refs.tabbar.insertBefore(tab, settingsTab ?? buildBadge);

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
      this.refs.devtools.style.opacity = String(this.config.get("transparency"));

      this.refs.root.style.setProperty("--rd-blur", `${this.config.get("blur")}px`);
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
    }, this.config.get("animationDuration"));

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
    const duplicate = Array.from(this.refs.notifications.children).find(
      (child) => child.textContent === message && child.getAttribute("data-type") === (options.type ?? "info"),
    );

    if (duplicate instanceof HTMLElement) {
      duplicate.dataset.active = "true";
      return;
    }

    while (this.refs.notifications.children.length >= this.config.get("notificationMaxVisible")) {
      this.refs.notifications.firstElementChild?.remove();
    }

    let item!: HTMLElement;

    const remove = () => {
      item.dataset.active = "false";
      window.setTimeout(() => item.remove(), Math.max(80, Math.round(this.config.get("animationDuration") * .6)));
    };

    item = asElement<HTMLElement>(html`
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

    window.setTimeout(remove, Math.max(300, options.duration ?? this.config.get("notificationDuration")));
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

      body = asElement<HTMLFormElement>(html`
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

      body = asElement<HTMLElement>(html`
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
      this.resizeStartSize = this.config.get("displaySize");
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
      if (this.visible || this.inline) {
        this.refs.devtools.style.opacity = String(this.config.get("transparency"));
      }
    }

    if (!key || key === "blur") {
      if (this.visible || this.inline) {
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

    const buildBadge = this.refs.tabbar.querySelector("[data-roderuda-build-badge]");
    if (settingsTab) this.refs.tabbar.insertBefore(settingsTab, buildBadge);
    if (buildBadge) this.refs.tabbar.append(buildBadge);

    uiState.setPath("panels.names", order);
  }

  private panelOrder(): string[] {
    const configured = this.config.get("panelOrder");
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

    const disabled = this.config.get("disabledPanels");

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
