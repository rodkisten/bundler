/**
 * @tool RodEruda Devtools
 * @global RodDevtools
 * @package devtools
 * @tags devtools console network elements mobile userscripts
 * @description Dependency-free browser developer tools implemented in TypeScript with Cipo and Fábrica.
 */
import { renderShell, type ShellRefs } from "./components/shell";
import { detectMobile, isDevtoolsNode, viewportScale } from "./core/dom";
import { NativeProtocol } from "./core/protocol";
import { installDevtoolsStyles } from "./core/style";
import { applyTheme, isDarkTheme, resolveTheme, themes } from "./core/theme";
import { DevTools } from "./devtools-controller";
import { EntryBtn } from "./entry-button";
import { Console } from "./panels/console";
import { Elements } from "./panels/elements";
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

  init(options: DevtoolsInitOptions = {}): this {
    if (this.initialized) return this;
    if (typeof document === "undefined") throw new Error("RodEruda requires a browser document");

    this.host = options.container ?? document.createElement("div");
    this.ownsHost = !options.container;
    if (!this.host.isConnected) document.documentElement.append(this.host);
    if (!this.host.id) this.host.id = "roderuda";
    this.host.classList.add("__chobitsu-hide__", "__roderuda-host__");
    this.host.style.all = "initial";
    this.host.contentEditable = "false";

    const useShadowDom = options.useShadowDom !== false;
    if (useShadowDom && this.host.attachShadow) {
      this.shadowRoot = this.host.shadowRoot ?? this.host.attachShadow({ mode: "open" });
      this.rootTarget = this.shadowRoot;
    } else {
      this.rootTarget = this.host;
    }

    this.style = installDevtoolsStyles(this.rootTarget);
    this.refs = renderShell(this.rootTarget, options.inline === true);
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
    for (const name of selected) {
      const Constructor = toolConstructors[name.toLowerCase()];
      if (!Constructor || name.toLowerCase() === "settings") continue;
      try {
        const instance = new Constructor();
        if (instance instanceof Network) this.chobitsu.attachNetworkCapture(instance.capture);
        this.devtools.add(instance);
      } catch (error) {
        queueMicrotask(() => console.error(`[RodEruda] Unable to initialize ${name}`, error));
      }
    }

    const first = selected.find((name) => this.devtools?.get(name)) ?? "settings";
    this.devtools.showTool(first);
    this.initialized = true;

    if (options.autoScale !== false && detectMobile()) this.scale(1 / viewportScale());
    if (options.inline) {
      this.entryBtn.hide();
      this.devtools.show();
    }
    return this;
  }

  destroy(): this {
    if (!this.initialized) return this;
    this.entryBtn?.destroy();
    this.devtools?.destroy();
    this.style?.remove();
    this.chobitsu.destroy();
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
    this.devtools?.add(value);
    return this;
  }

  remove(name: string): this {
    if (!this.checkInitialized()) return this;
    this.devtools?.remove(name);
    return this;
  }

  show(name?: string): this {
    if (!this.checkInitialized()) return this;
    if (name) this.devtools?.showTool(name);
    else this.devtools?.show();
    return this;
  }

  hide(): this {
    if (!this.checkInitialized()) return this;
    this.devtools?.hide();
    return this;
  }

  scale(): number;
  scale(value: number): this;
  scale(value?: number): number | this {
    if (value == null) return this.currentScale;
    this.currentScale = Number.isFinite(value) && value > 0 ? value : 1;
    this.devtools?.setScale(this.currentScale);
    return this;
  }

  position(): Position | undefined;
  position(value: Position): this;
  position(value?: Position): Position | undefined | this {
    if (!this.checkInitialized()) return value ? this : undefined;
    if (value) {
      this.entryBtn?.setPos(value);
      return this;
    }
    return this.entryBtn?.getPos();
  }

  isInitialized(): boolean {
    return this.initialized;
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
