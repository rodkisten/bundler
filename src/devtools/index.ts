/**
 * @tool RodEruda Devtools
 * @global RodDevtools
 * @package devtools
 * @tags devtools console network elements mobile userscripts
 * @description Dependency-free browser developer tools implemented in TypeScript with Cipo and Fábrica.
 */
import { installDevtoolsStyles } from "./core/style";
import { renderShell, type ShellRefs } from "./components/shell";
import { configureDebug, debugError, debugGroup, debugInfo, debugLog, debugWarn, getDebugConfig } from "./core/debug";
import { applyImportantStyle, detectMobile, forceAppendToPage, isDevtoolsNode, viewportScale } from "./core/dom";
import { NativeProtocol } from "./core/protocol";
import { applyTheme, isDarkTheme, resolveTheme, themes } from "./core/theme";
import { DevTools } from "./devtools-controller";
import { EntryBtn } from "./entry-button";
import { Console, consoleStyleArtifacts } from "./panels/console";
import { Elements, elementsStyleArtifacts } from "./panels/elements";
import { Info } from "./panels/info";
import { Network } from "./panels/network";
import { Resources } from "./panels/resources";
import { Settings } from "./panels/settings";
import { Snippets } from "./panels/snippets";
import { Sources } from "./panels/sources";
import { Tool } from "./tool";
import type { DevtoolsInitOptions, Position, ToolLike } from "./types";

export const VERSION = "4.0.0-native";

export type ToolFactory = ToolLike | ((api: RodDevtoolsApi) => ToolLike);

export interface RodDevtoolsApi {
  readonly version: string;
  readonly util: typeof util;
  readonly chobitsu: NativeProtocol;
  readonly Tool: typeof Tool;
  readonly Console: typeof Console;
  readonly Elements: typeof Elements;
  readonly Network: typeof Network;
  readonly Sources: typeof Sources;
  readonly Resources: typeof Resources;
  readonly Info: typeof Info;
  readonly Snippets: typeof Snippets;
  readonly Settings: typeof Settings;
  init(options?: DevtoolsInitOptions): RodDevtoolsApi;
  destroy(): RodDevtoolsApi;
  get(name?: string): ToolLike | DevTools | EntryBtn | undefined;
  add(tool: ToolFactory): RodDevtoolsApi;
  remove(name: string): RodDevtoolsApi;
  show(name?: string): RodDevtoolsApi;
  hide(): RodDevtoolsApi;
  scale(): number;
  scale(value: number): RodDevtoolsApi;
  position(): Position | undefined;
  position(value: Position): RodDevtoolsApi;
  isInitialized(): boolean;
}

const util = Object.freeze({
  isErudaEl: isDevtoolsNode,
  isDevtoolsNode,
  isDarkTheme,
  getTheme: () => resolveTheme(String(api.get<DevTools>()?.config.get("theme") ?? "System preference")).name,
  getDebugConfig,
  themes,
  applyTheme,
});

const defaultTools = ["console", "elements", "network", "resources", "sources", "info", "snippets"] as const;
const toolConstructors: Record<string, new () => ToolLike> = {
  console: Console,
  elements: Elements,
  network: Network,
  resources: Resources,
  sources: Sources,
  info: Info,
  snippets: Snippets,
  settings: Settings,
};

class RodDevtoolsRuntime implements RodDevtoolsApi {
  readonly version = VERSION;
  readonly util = util;
  readonly chobitsu = new NativeProtocol();
  readonly Tool = Tool;
  readonly Console = Console;
  readonly Elements = Elements;
  readonly Network = Network;
  readonly Sources = Sources;
  readonly Resources = Resources;
  readonly Info = Info;
  readonly Snippets = Snippets;
  readonly Settings = Settings;
  private initialized = false;
  private host: HTMLElement | null = null;
  private rootTarget: HTMLElement | ShadowRoot | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private refs: ShellRefs | null = null;
  private devtools: DevTools | null = null;
  private entryBtn: EntryBtn | null = null;
  private style: HTMLStyleElement | null = null;
  private currentScale = 1;
  private ownsHost = false;
  private reattachTimer = 0;
  private hostObserver: MutationObserver | null = null;
  private readonly reattachHost = () => this.forceMountHost();

  init(options: DevtoolsInitOptions = {}): this {
    configureDebug(options.debug);
    const finishDebug = debugGroup("runtime", "init", {
      version: VERSION,
      inline: options.inline === true,
      useShadowDom: options.useShadowDom !== false,
      autoScale: options.autoScale !== false,
      tool: options.tool ?? "default",
    });
    if (this.initialized) {
      debugWarn("runtime", "init skipped: already initialized");
      finishDebug();
      return this;
    }
    if (typeof document === "undefined") throw new Error("RodEruda requires a browser document");

    this.host = options.container ?? document.createElement("div");
    this.ownsHost = !options.container;
    debugLog("runtime", "host prepared", { ownsHost: this.ownsHost, id: this.host.id || "pending" });
    this.prepareHost(this.host, options.inline === true);
    this.forceMountHost();

    const useShadowDom = options.useShadowDom !== false;
    if (useShadowDom && this.host.attachShadow) {
      try {
        this.shadowRoot = this.host.shadowRoot ?? this.host.attachShadow({ mode: "open" });
        this.rootTarget = this.shadowRoot;
        debugInfo("runtime", "shadow root mounted", { reused: Boolean(this.host.shadowRoot) });
      } catch (error) {
        this.shadowRoot = null;
        this.rootTarget = this.host;
        debugWarn("runtime", "shadow root fallback", { error: error instanceof Error ? error.message : String(error) });
      }
    } else {
      this.rootTarget = this.host;
      debugInfo("runtime", "using light dom root");
    }

    this.refs = renderShell(this.rootTarget, options.inline === true);
    debugLog("runtime", "shell rendered");
    this.style = installDevtoolsStyles(this.rootTarget, elementsStyleArtifacts);
    debugLog("runtime", "styles installed", { style: this.style, root: this.rootTarget instanceof ShadowRoot ? "shadow" : "light" });
    this.chobitsu.setHost(this.host);
    this.devtools = new DevTools(this.host, this.shadowRoot, this.refs, options.inline === true, options.defaults);
    this.entryBtn = new EntryBtn(this.refs.entryButton, this.refs.root).on("click", () => this.devtools?.toggle());

    const settings = new Settings();
    this.devtools.add(settings);
    this.entryBtn.initCfg(settings);
    this.devtools.initCfg(settings);

    const selected = options.tool == null
      ? [...defaultTools]
      : Array.isArray(options.tool)
        ? [...options.tool]
        : [options.tool];
    debugInfo("runtime", "mounting tools", { selected });
    for (const name of selected) {
      const Constructor = toolConstructors[name.toLowerCase()];
      if (!Constructor || name.toLowerCase() === "settings") continue;
      try {
        const instance = new Constructor();
        if (instance instanceof Network) this.chobitsu.attachNetworkCapture(instance.capture);
        this.devtools.add(instance);
        debugLog("runtime", "tool added", { name });
      } catch (error) {
        debugError("runtime", "tool init failed", { name, error: error instanceof Error ? error.message : String(error) });
        queueMicrotask(() => console.error(`[RodEruda] Unable to initialize ${name}`, error));
      }
    }

    const first = selected.find((name) => this.devtools?.get(name)) ?? "settings";
    this.devtools.showTool(first);
    this.initialized = true;
    this.installHostWatchdog();
    this.forceMountHost();

    if (options.autoScale !== false && detectMobile()) this.scale(1 / viewportScale());
    if (options.inline) {
      this.entryBtn.hide();
      this.devtools.show();
    }
    finishDebug();
    return this;
  }

  destroy(): this {
    if (!this.initialized) return this;
    const finishDebug = debugGroup("runtime", "destroy");
    this.entryBtn?.destroy();
    this.devtools?.destroy();
    this.style?.remove();
    this.chobitsu.destroy();
    this.uninstallHostWatchdog();
    if (this.ownsHost) this.host?.remove();
    else this.host?.replaceChildren();
    this.initialized = false;
    this.host = null;
    this.rootTarget = null;
    this.shadowRoot = null;
    this.refs = null;
    this.devtools = null;
    this.entryBtn = null;
    this.style = null;
    this.currentScale = 1;
    this.ownsHost = false;
    finishDebug();
    return this;
  }

  get<T extends ToolLike | DevTools | EntryBtn = ToolLike | DevTools | EntryBtn>(name?: string): T | undefined {
    if (!this.checkInitialized()) return undefined;
    if (!name) return this.devtools as T;
    if (name === "entryBtn") return this.entryBtn as T;
    return this.devtools?.get(name) as T | undefined;
  }

  add(tool: ToolFactory): this {
    if (!this.checkInitialized()) return this;
    const value = typeof tool === "function" ? tool(this) : tool;
    debugLog("runtime", "api.add", { name: value.name });
    this.devtools?.add(value);
    return this;
  }

  remove(name: string): this {
    if (!this.checkInitialized()) return this;
    debugLog("runtime", "api.remove", { name });
    this.devtools?.remove(name);
    return this;
  }

  show(name?: string): this {
    if (!this.checkInitialized()) return this;
    debugLog("runtime", "api.show", { name: name ?? "current" });
    if (name) this.devtools?.showTool(name);
    else this.devtools?.show();
    return this;
  }

  hide(): this {
    if (!this.checkInitialized()) return this;
    debugLog("runtime", "api.hide");
    this.devtools?.hide();
    return this;
  }

  scale(): number;
  scale(value: number): this;
  scale(value?: number): number | this {
    if (value == null) return this.currentScale;
    this.currentScale = Number.isFinite(value) && value > 0 ? value : 1;
    debugLog("runtime", "scale", { value: this.currentScale });
    this.devtools?.setScale(this.currentScale);
    return this;
  }

  position(): Position | undefined;
  position(value: Position): this;
  position(value?: Position): Position | undefined | this {
    if (!this.checkInitialized()) return value ? this : undefined;
    if (value) {
      debugLog("runtime", "position:set", { x: value.x, y: value.y });
      this.entryBtn?.setPos(value);
      return this;
    }
    return this.entryBtn?.getPos();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private prepareHost(host: HTMLElement, inline: boolean): void {
    if (!host.id) host.id = "roderuda";
    host.classList.add("__chobitsu-hide__", "__roderuda-host__");
    host.setAttribute("data-roderuda-force-mounted", "true");
    host.contentEditable = "false";
    host.setAttribute("aria-live", "off");
    host.setAttribute("role", "presentation");
    applyImportantStyle(host, inline ? {
      all: "initial",
      display: "block",
      position: "relative",
      width: "100%",
      height: "100%",
      minWidth: "320px",
      minHeight: "320px",
      zIndex: "2147483647",
      pointerEvents: "auto",
      contain: "layout style paint",
    } : {
      all: "initial",
      display: "block",
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      minWidth: "0",
      minHeight: "0",
      margin: "0",
      padding: "0",
      border: "0",
      overflow: "visible",
      zIndex: "2147483647",
      pointerEvents: "none",
      contain: "layout style paint",
      isolation: "isolate",
    });
  }

  private forceMountHost(): void {
    if (!this.host || !this.ownsHost) return;
    if (this.host.isConnected) return;
    if (forceAppendToPage(this.host)) {
      debugLog("runtime", "host attached");
      return;
    }
    debugWarn("runtime", "host attach deferred");
    const retry = () => {
      if (!this.initialized || !this.host || this.host.isConnected) return;
      if (!forceAppendToPage(this.host)) {
        window.setTimeout(retry, 16);
      } else {
        debugLog("runtime", "host attached after retry");
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", retry, { once: true, capture: true });
    }
    window.setTimeout(retry, 16);
  }

  private installHostWatchdog(): void {
    if (!this.host || !this.ownsHost) return;
    this.uninstallHostWatchdog();
    try {
      this.hostObserver = new MutationObserver(this.reattachHost);
      this.hostObserver.observe(document, { childList: true, subtree: true });
      debugLog("runtime", "host watchdog observer installed");
    } catch (error) {
      debugWarn("runtime", "host watchdog observer fallback", { error: error instanceof Error ? error.message : String(error) });
    }
    this.reattachTimer = window.setInterval(this.reattachHost, 1000);
    window.addEventListener("pageshow", this.reattachHost, true);
    window.addEventListener("focus", this.reattachHost, true);
  }

  private uninstallHostWatchdog(): void {
    if (this.reattachTimer) {
      window.clearInterval(this.reattachTimer);
      this.reattachTimer = 0;
    }
    this.hostObserver?.disconnect();
    this.hostObserver = null;
    window.removeEventListener("pageshow", this.reattachHost, true);
    window.removeEventListener("focus", this.reattachHost, true);
  }

  private checkInitialized(): boolean {
    if (!this.initialized) console.error('[RodEruda] Please call "devtools.init()" first');
    return this.initialized;
  }
}

export const api = new RodDevtoolsRuntime();
export const devtools = api;
export const eruda = api;

export {
  Console,
  DevTools,
  Elements,
  EntryBtn,
  Info,
  NativeProtocol,
  Network,
  Resources,
  Settings,
  Snippets,
  Sources,
  Tool,
  applyTheme,
  isDarkTheme,
  resolveTheme,
  themes,
};
export type * from "./types";

export default api;
