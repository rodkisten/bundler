import "@rodkisten/devtools/core-cipo-bootstrap";
import { renderShell, shellStyleArtifacts, type ShellRefs } from "@rodkisten/devtools/core-shell";
import { asNode, event, html, setDevtoolsContextOwner, uiState } from "@rodkisten/devtools/core-runtime";
import { ConfigStore } from "@rodkisten/devtools/core-config";
import { createDevtoolsContextScope, type DevtoolsContextScope } from "@rodkisten/devtools/core-context";
import { configureDebug, debugError, debugGroup, debugInfo, debugLog, debugWarn, getDebugConfig } from "@rodkisten/devtools/core-debug";
import { detectMobile, isDevtoolsNode, viewportScale } from "@rodkisten/devtools/core-utils";
import { applyImportantStyle, forceAppendToPage } from "@rodkisten/devtools/core-dom";
import { NativeProtocol } from "@rodkisten/devtools/core-protocol";
import { installDevtoolsStyles } from "@rodkisten/devtools/core-style";
import { applyTheme, isDarkTheme, resolveTheme, themes } from "@rodkisten/devtools/core-theme";
import { DevTools, devtoolsControllerStyleArtifacts } from "@rodkisten/devtools/core-controller";
import { EntryBtn } from "@rodkisten/devtools/core-entry-button";
import { Console, consoleStyleArtifacts } from "@rodkisten/devtools/panels-console";
import { Elements, elementsStyleArtifacts } from "@rodkisten/devtools/panels-elements";
import { Info, infoStyleArtifacts } from "@rodkisten/devtools/panels-info";
import { Network, networkStyleArtifacts } from "@rodkisten/devtools/panels-network";
import { Resources, resourcesStyleArtifacts } from "@rodkisten/devtools/panels-resources";
import { Settings, settingsStyleArtifacts } from "@rodkisten/devtools/panels-settings";
import { Snippets, snippetsStyleArtifacts } from "@rodkisten/devtools/panels-snippets";
import { Sources, sourcesStyleArtifacts } from "@rodkisten/devtools/panels-sources";
import { sharedStyleArtifacts } from "@rodkisten/devtools/panels-shared-components";
import { Tool } from "@rodkisten/devtools/tool";
import type {
  DevtoolsInitOptions,
  Position,
  ToolLike,
} from "@rodkisten/devtools/types";

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
  private readonly mountRetryTimers = new Set<number>();
  private contextScope: DevtoolsContextScope | null = null;
  private hostObserver: MutationObserver | null = null;

  private readonly reattachHost = (): void => {
    if (typeof document === "undefined") return;
    if (!this.host || !this.ownsHost) return;
    if (this.host.isConnected) return;
    this.forceMountHost();
  };

  private readonly onHostMutations = (): void => {
    // Ignore mutations while the host is already attached. Observing the whole
    // document with subtree:true otherwise re-enters on every page update and
    // can starve the main thread (and amplify console/debug work into a hang).
    if (!this.host || this.host.isConnected) return;
    this.reattachHost();
  };

  init(options: DevtoolsInitOptions = {}): this {
    configureDebug(options.debug);

    const normalizedOptions = normalizeInitOptions(options);
    const finishDebug = debugGroup("runtime", "init", {
      version: VERSION,
      inline: normalizedOptions.inline,
      useShadowDom: normalizedOptions.useShadowDom,
      autoScale: normalizedOptions.autoScale,
      tool: normalizedOptions.tools,
    });

    if (this.initialized) {
      debugWarn("runtime", "init skipped: already initialized");
      finishDebug();
      return this;
    }

    if (typeof document === "undefined") {
      finishDebug();
      throw new Error("RodEruda requires a browser document");
    }

    try {
      this.host = normalizedOptions.container ?? document.createElement("div");
      this.ownsHost = !normalizedOptions.container;

      debugLog("runtime", "host prepared", {
        ownsHost: this.ownsHost,
        id: this.host.id || "pending",
      });

      this.prepareHost(this.host, normalizedOptions.inline);
      this.forceMountHost();

      this.contextScope = createDevtoolsContextScope(this.host, normalizedOptions.inline);
      setDevtoolsContextOwner(this.contextScope.owner);

      this.rootTarget = this.createRenderTarget(this.host, normalizedOptions.useShadowDom);
      this.refs = renderShell(this.rootTarget, normalizedOptions.inline);
      this.contextScope.value.refs.set(this.refs);

      debugLog("runtime", "shell rendered");
      this.assertShellMounted();

      this.style = installDevtoolsStyles(this.rootTarget, [
        ...devtoolsControllerStyleArtifacts,
        ...shellStyleArtifacts,
        ...sharedStyleArtifacts,
        ...consoleStyleArtifacts,
        ...elementsStyleArtifacts,
        ...networkStyleArtifacts,
        ...infoStyleArtifacts,
        ...resourcesStyleArtifacts,
        ...settingsStyleArtifacts,
        ...sourcesStyleArtifacts,
        ...snippetsStyleArtifacts,
      ]);

      debugLog("runtime", "styles installed", {
        style: Boolean(this.style),
        root: this.rootTarget instanceof ShadowRoot ? "shadow" : "light",
      });

      this.chobitsu.setHost(this.host);

      this.devtools = new DevTools(
        this.host,
        this.shadowRoot,
        this.refs,
        normalizedOptions.inline,
        normalizedOptions.defaults,
        this.contextScope.value,
      );
      this.contextScope.value.controller.set(this.devtools);

      if (normalizedOptions.config?.devtools) {
        this.devtools.config.patch(normalizedOptions.config.devtools);
      }

      this.entryBtn = new EntryBtn(this.refs.entryButton, this.refs.root);

      this.mountSettings(normalizedOptions);
      this.mountTools(normalizedOptions.tools, normalizedOptions);

      const first = this.firstMountedTool(normalizedOptions.tools) ?? "settings";
      this.devtools.showTool(first);

      const startupEntries = [
        ...(normalizedOptions.initialLogs ?? []),
        ...(normalizedOptions.initialErrors ?? []),
      ];
      const consoleTool = this.devtools.get<Console>("console");
      if (startupEntries.length) consoleTool?.ingestInitial(startupEntries);

      const shouldDisplayStartupErrors = Boolean(
        startupEntries.length && consoleTool?.config.get("displayIfErr"),
      );
      if (!normalizedOptions.inline && !shouldDisplayStartupErrors) this.devtools.hide();
      if (shouldDisplayStartupErrors) this.devtools.showTool("console");

      this.initialized = true;
      this.installHostWatchdog();
      this.forceMountHost();

      if (normalizedOptions.autoScale && detectMobile()) {
        this.scale(1 / viewportScale());
      }

      if (normalizedOptions.inline) {
        this.entryBtn.hide();
        this.devtools.show();
      }

      finishDebug();
      return this;
    } catch (error) {
      finishDebug();
      this.rollbackFailedInit();
      throw error;
    }
  }

  destroy(): this {
    if (!this.initialized && !this.host) return this;

    const finishDebug = debugGroup("runtime", "destroy");

    this.entryBtn?.destroy();
    this.devtools?.destroy();
    this.style?.remove();
    this.chobitsu.destroy();
    setDevtoolsContextOwner(null);
    this.contextScope?.dispose();
    this.uninstallHostWatchdog();
    this.clearMountRetry();

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
    this.contextScope = null;
    this.currentScale = 1;
    this.ownsHost = false;

    finishDebug();
    return this;
  }

  get<T extends ToolLike | DevTools | EntryBtn = ToolLike | DevTools | EntryBtn>(name?: string): T | undefined {
    if (!this.checkInitialized()) return undefined;
    if (!name) return this.devtools as T;
    if (name === "entryBtn") return this.entryBtn as T;
    return this.devtools?.get(normalizeToolName(name)) as T | undefined;
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

    const normalized = normalizeToolName(name);

    debugLog("runtime", "api.remove", { name: normalized });

    this.devtools?.remove(normalized);

    return this;
  }

  show(name?: string): this {
    if (!this.checkInitialized()) return this;

    debugLog("runtime", "api.show", { name: name ?? "current" });

    if (name) this.devtools?.showTool(normalizeToolName(name));
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

  private createRenderTarget(host: HTMLElement, useShadowDom: boolean): HTMLElement | ShadowRoot {
    if (!useShadowDom || !host.attachShadow) {
      this.shadowRoot = null;
      debugInfo("runtime", "using light dom root");
      return host;
    }

    try {
      this.shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });
      debugInfo("runtime", "shadow root mounted", { reused: Boolean(host.shadowRoot) });
      return this.shadowRoot;
    } catch (error) {
      this.shadowRoot = null;
      debugWarn("runtime", "shadow root fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
      return host;
    }
  }

  private createSettingsTool(options: NormalizedInitOptions): Settings {
    const settings = new Settings();
    applyToolConfig(settings, options.config?.panels?.settings);
    return settings;
  }

  private mountSettings(options: NormalizedInitOptions): void {
    if (!this.devtools || !this.entryBtn) return;

    const settings = this.createSettingsTool(options);

    this.devtools.add(settings);
    this.entryBtn.initCfg(settings);
    this.devtools.initCfg(settings);
  }

  private mountTools(selected: string[], options: NormalizedInitOptions): void {
    if (!this.devtools) return;

    debugInfo("runtime", "mounting tools", { selected });

    for (const name of selected) {
      if (name === "settings") continue;

      const Constructor = toolConstructors[name];

      if (!Constructor) {
        debugWarn("runtime", "unknown tool skipped", { name });
        continue;
      }

      try {
        const instance = new Constructor();
        applyToolConfig(instance, options.config?.panels?.[name]);

        if (instance instanceof Network) {
          this.chobitsu.attachNetworkCapture(instance.capture);
        }

        this.devtools.add(instance);

        debugLog("runtime", "tool added", { name });
      } catch (error) {
        debugError("runtime", "tool init failed", {
          name,
          error: error instanceof Error ? error.message : String(error),
        });

        queueMicrotask(() => console.error(`[RodEruda] Unable to initialize ${name}`, error));
      }
    }
  }

  private firstMountedTool(selected: string[]): string | undefined {
    return selected.find((name) => this.devtools?.get(name));
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
      isolation: "isolate",
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
    if (this.tryMountHost()) return;

    debugWarn("runtime", "host attach deferred");
    this.scheduleMountRetries();
  }

  private tryMountHost(): boolean {
    if (!this.host || this.host.isConnected) return Boolean(this.host?.isConnected);

    if (forceAppendToPage(this.host)) {
      debugLog("runtime", "host attached");
      return true;
    }

    return false;
  }

  private scheduleMountRetries(): void {
    this.clearMountRetry();

    let attempt = 0;

    const retry = (): void => {
      if (!this.host || this.host.isConnected) return;

      if (this.tryMountHost()) {
        debugLog("runtime", "host attached after retry", { attempt });
        return;
      }

      attempt += 1;

      // Keep this cheap: short burst while the document is being created, then stop.
      if (attempt <= 10) {
        this.trackMountRetryTimeout(retry, attempt < 4 ? 16 : 100);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", retry, { once: true, capture: true });
    }

    window.addEventListener("load", retry, { once: true, capture: true });
    this.trackMountRetryTimeout(retry, 0);
  }

  private trackMountRetryTimeout(callback: () => void, delay: number): void {
    const id = window.setTimeout(() => {
      this.mountRetryTimers.delete(id);
      callback();
    }, delay);

    this.mountRetryTimers.add(id);
  }

  private clearMountRetry(): void {
    for (const id of this.mountRetryTimers) window.clearTimeout(id);
    this.mountRetryTimers.clear();
  }

  private installHostWatchdog(): void {
    if (!this.host || !this.ownsHost) return;

    this.uninstallHostWatchdog();

    try {
      this.hostObserver = new MutationObserver(this.onHostMutations);
      // Only watch top-level document structure. Subtree observation of the
      // entire page is unnecessary for host reattachment and can freeze the UI.
      this.hostObserver.observe(document.documentElement, { childList: true, subtree: false });
      if (document.body) {
        this.hostObserver.observe(document.body, { childList: true, subtree: false });
      }
      debugLog("runtime", "host watchdog observer installed");
    } catch (error) {
      debugWarn("runtime", "host watchdog observer fallback", {
        error: error instanceof Error ? error.message : String(error),
      });
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

  private assertShellMounted(): void {
    if (!this.refs?.root) {
      throw new Error("[RodEruda] Shell refs were not created.");
    }

    if (!this.host?.isConnected && this.ownsHost) {
      throw new Error("[RodEruda] Shell host is not connected to the document.");
    }

    const required: Array<[string, Element | null | undefined]> = [
      ["root", this.refs.root],
      ["entryButton", this.refs.entryButton],
      ["devtools", this.refs.devtools],
      ["tools", this.refs.tools],
      ["tabbar", this.refs.tabbar],
    ];

    const missing = required
      .filter(([, node]) => !(node instanceof Element))
      .map(([name]) => name);

    if (missing.length) {
      throw new Error(`[RodEruda] Shell refs are missing after render: ${missing.join(", ")}`);
    }
  }

  private rollbackFailedInit(): void {
    this.entryBtn?.destroy();
    this.devtools?.destroy();
    this.style?.remove();
    setDevtoolsContextOwner(null);
    this.contextScope?.dispose();
    this.uninstallHostWatchdog();
    this.clearMountRetry();

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
    this.contextScope = null;
    this.currentScale = 1;
    this.ownsHost = false;
  }

  private checkInitialized(): boolean {
    if (!this.initialized) console.error('[RodEruda] Please call "devtools.init()" first');
    return this.initialized;
  }
}

type NormalizedInitOptions = DevtoolsInitOptions & {
  inline: boolean;
  useShadowDom: boolean;
  autoScale: boolean;
  tools: string[];
};

function normalizeInitOptions(options: DevtoolsInitOptions): NormalizedInitOptions {
  const toolInput = options.tool == null
    ? [...defaultTools]
    : Array.isArray(options.tool)
      ? options.tool
      : [options.tool];

  const tools = unique(toolInput.map(normalizeToolName)).filter(Boolean);

  return {
    ...options,
    inline: options.inline === true,
    useShadowDom: options.useShadowDom !== false,
    autoScale: options.autoScale !== false,
    tools,
  };
}

function normalizeToolName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function applyToolConfig(tool: ToolLike, values: object | undefined): void {
  if (!values) return;

  const configurable = tool as ToolLike & {
    config?: {
      patch?: (values: Record<string, unknown>) => void;
    };
  };

  configurable.config?.patch?.(values as Record<string, unknown>);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
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

export { DevtoolsContext, createDevtoolsContextScope } from "@rodkisten/devtools/core-context";
export type { DevtoolsContextScope, DevtoolsContextValue } from "@rodkisten/devtools/core-context";

export type * from "@rodkisten/devtools/types";

export default api;
