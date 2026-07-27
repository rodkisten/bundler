/**
 * @tool DevTools (eruda fork)
 * @global DevTools
 * @package devtools
 * @tags devtools browser mobile
 * @description Fork of Eruda using Mata/Folclore tools.
 */
import api, {
  applyTheme,
  Console,
  createDevtoolsContextValue,
  DevTools as DevToolsController,
  DevtoolsContext,
  Elements,
  EntryBtn,
  Info,
  isDarkTheme,
  NativeProtocol,
  Network,
  resolveTheme,
  Resources,
  Settings,
  Snippets,
  Sources,
  themes,
  Tool,
  VERSION,
  type RodDevtoolsApi,
  type RodDevtoolsInitOptions,
  type ToolFactory,
} from "@rodkisten/devtools";
import type { Position } from "@rodkisten/devtools/types";

/**
 * Browser-global surface published by the standalone IIFE/UMD bundles.
 *
 * @remarks
 * Library-mode IIFEs normally expose a module namespace, forcing consumers to
 * call `DevTools.default.init()` or `DevTools.api.init()`. This facade keeps the
 * package's named exports available while presenting the lifecycle API directly
 * at `globalThis.DevTools`, matching established browser DevTools libraries.
 */
export interface DevtoolsBrowserGlobal extends RodDevtoolsApi {
  readonly api: RodDevtoolsApi;
  readonly default: RodDevtoolsApi;
  readonly devtools: RodDevtoolsApi;
  readonly eruda: RodDevtoolsApi;
  readonly VERSION: string;
  readonly DevTools: typeof DevToolsController;
  readonly EntryBtn: typeof EntryBtn;
  readonly NativeProtocol: typeof NativeProtocol;
  readonly themes: typeof themes;
  readonly applyTheme: typeof applyTheme;
  readonly resolveTheme: typeof resolveTheme;
  readonly isDarkTheme: typeof isDarkTheme;
  readonly createDevtoolsContextValue: typeof createDevtoolsContextValue;
  readonly DevtoolsContext: typeof DevtoolsContext;
}

/**
 * Stable browser facade delegating every stateful operation to the package
 * singleton. Methods return the facade so `DevTools.init().show()` remains
 * fluent without exposing bundler-specific namespace details.
 */
class RodDevtoolsBrowserGlobal implements DevtoolsBrowserGlobal {
  readonly api = api;
  readonly default = api;
  readonly devtools = api;
  readonly eruda = api;

  readonly VERSION = VERSION;
  readonly version = api.version;
  readonly util = api.util;
  readonly chobitsu = api.chobitsu;

  readonly Tool = Tool;
  readonly Console = Console;
  readonly Elements = Elements;
  readonly Network = Network;
  readonly Sources = Sources;
  readonly Resources = Resources;
  readonly Info = Info;
  readonly Snippets = Snippets;
  readonly Settings = Settings;

  readonly DevTools = DevToolsController;
  readonly EntryBtn = EntryBtn;
  readonly NativeProtocol = NativeProtocol;
  readonly themes = themes;
  readonly applyTheme = applyTheme;
  readonly resolveTheme = resolveTheme;
  readonly isDarkTheme = isDarkTheme;
  readonly createDevtoolsContextValue = createDevtoolsContextValue;
  readonly DevtoolsContext = DevtoolsContext;

  init(options?: RodDevtoolsInitOptions): this {
    api.init(options);
    return this;
  }

  destroy(): this {
    api.destroy();
    return this;
  }

  get(name?: string): ReturnType<RodDevtoolsApi["get"]> {
    return api.get(name);
  }

  add(tool: ToolFactory): this {
    api.add(tool);
    return this;
  }

  remove(name: string): this {
    api.remove(name);
    return this;
  }

  show(name?: string): this {
    api.show(name);
    return this;
  }

  hide(): this {
    api.hide();
    return this;
  }

  scale(): number;
  scale(value: number): this;
  scale(value?: number): number | this {
    if (value === undefined) return api.scale();

    api.scale(value);
    return this;
  }

  position(): Position | undefined;
  position(value: Position): this;
  position(value?: Position): Position | undefined | this {
    if (value === undefined) return api.position();

    api.position(value);
    return this;
  }

  isInitialized(): boolean {
    return api.isInitialized();
  }
}

const browserGlobal: DevtoolsBrowserGlobal = new RodDevtoolsBrowserGlobal();
const browserScope = globalThis as typeof globalThis & {
  DevTools?: DevtoolsBrowserGlobal;
  __ROD_DEVTOOLS__?: RodDevtoolsApi;
};

/*
 * Assign explicitly instead of relying only on the bundler's outer `var`.
 * Userscript managers may execute @require files inside a wrapper where the
 * generated variable is lexical and therefore absent from `globalThis`.
 */
browserScope.DevTools = browserGlobal;
browserScope.__ROD_DEVTOOLS__ = browserGlobal;

export default browserGlobal;
