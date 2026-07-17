import "@rodkisten/devtools/core/cipo-bootstrap";
import {
  renderShell,
  shellStyleArtifacts,
  type ShellRefs,
} from "@rodkisten/devtools/core/shell";
import {
  createDevtoolsContextValue,
  type DevtoolsContextValue,
} from "@rodkisten/devtools/core/context";
import {
  configureDebug,
  debugError,
  debugGroup,
  debugInfo,
  debugLog,
  debugWarn,
  getDebugConfig,
} from "@rodkisten/devtools/core/debug";
import {
  detectMobile,
  isDevtoolsNode,
  viewportScale,
} from "@rodkisten/devtools/core/utils";
import {
  applyImportantStyle,
  forceAppendToPage,
} from "@rodkisten/devtools/core/dom";
import { NativeProtocol } from "@rodkisten/devtools/core/protocol";
import { installDevtoolsStyles } from "@rodkisten/devtools/core/style";
import {
  applyTheme,
  isDarkTheme,
  resolveTheme,
  themes,
} from "@rodkisten/devtools/core/theme";
import { DevTools } from "@rodkisten/devtools/core/controller";
import { EntryBtn } from "@rodkisten/devtools/core/entry-button";
import {
  Console,
  consoleStyleArtifacts,
} from "@rodkisten/devtools/panels/console";
import {
  Elements,
  elementsStyleArtifacts,
} from "@rodkisten/devtools/panels/elements";
import {
  Info,
  infoStyleArtifacts,
} from "@rodkisten/devtools/panels/info";
import {
  Network,
  networkStyleArtifacts,
} from "@rodkisten/devtools/panels/network";
import {
  Resources,
  resourcesStyleArtifacts,
} from "@rodkisten/devtools/panels/resources";
import {
  Settings,
  settingsStyleArtifacts,
} from "@rodkisten/devtools/panels/settings";
import {
  Snippets,
  snippetsStyleArtifacts,
} from "@rodkisten/devtools/panels/snippets";
import {
  Sources,
  sourcesStyleArtifacts,
} from "@rodkisten/devtools/panels/sources";
import { sharedStyleArtifacts } from "@rodkisten/devtools/panels/shared-components";
import { Tool } from "@rodkisten/devtools/tool";
import type {
  DevtoolsInitOptions,
  Position,
  ToolLike,
} from "@rodkisten/devtools/types";
import {
  concatArrays,
  filterArray,
  filterMapArray,
  findArray,
  joinArray,
  mapArray,
  toArray,
  uniq,
} from "@rodkisten/nascente";

export const VERSION = "4.0.0-native";

/**
 * Maximum rendered width for compact boot values such as Location and URL
 * instances.
 *
 * This intentionally stays at 80 characters. Boot records often contain source
 * URLs, and reducing the limit further removes too much useful debugging
 * context, especially the script filename and cache-busting query.
 */
const MAX_BOOT_TEXT_WIDTH = 80;

const GLOBAL_BOOT_EVENTS_KEY =
  "__GLOBAL_EVENTS_BAG__";

const PRE_CAPTURE_BRIDGE_KEY =
  "__ROD_PRE_CAPTURE__";

const PRE_CAPTURE_HANDOFF_EVENT =
  "rod-devtools:pre-capture-handoff";

const RESPONSIVE_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, viewport-fit=cover";

/**
 * Ratio tolerated between the browser layout viewport and the physical screen.
 *
 * A legacy mobile layout viewport is commonly much wider than the device
 * screen, while a responsive viewport normally stays close to a 1:1 ratio.
 */
const RESPONSIVE_VIEWPORT_MAX_RATIO = 1.35;

export type ToolFactory =
  | ToolLike
  | ((api: RodDevtoolsApi) => ToolLike);

/**
 * Runtime-specific init options.
 *
 * @remarks
 * `ensureResponsiveViewport` defaults to true. On mobile pages that do not
 * expose a responsive viewport, RodEruda temporarily installs or repairs the
 * viewport meta tag so the DevTools UI is not rendered against a legacy wide
 * layout viewport.
 */
export type RodDevtoolsInitOptions =
  DevtoolsInitOptions & {
    ensureResponsiveViewport?: boolean;
  };

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

  init(
    options?: RodDevtoolsInitOptions,
  ): RodDevtoolsApi;

  destroy(): RodDevtoolsApi;

  get(
    name?: string,
  ):
    | ToolLike
    | DevTools
    | EntryBtn
    | undefined;

  add(
    tool: ToolFactory,
  ): RodDevtoolsApi;

  remove(
    name: string,
  ): RodDevtoolsApi;

  show(
    name?: string,
  ): RodDevtoolsApi;

  hide(): RodDevtoolsApi;

  scale(): number;

  scale(
    value: number,
  ): RodDevtoolsApi;

  position():
    | Position
    | undefined;

  position(
    value: Position,
  ): RodDevtoolsApi;

  isInitialized(): boolean;
}

/**
 * Shape exposed by the PRE CAPTURE userscript.
 *
 * `records` is optional because older versions may expose only the global
 * `__GLOBAL_EVENTS_BAG__` array.
 */
type PreCaptureBridge = {
  readonly records?: unknown[];
  readonly restore?: () => void;
};

type BootCaptureSnapshot = {
  readonly globalRecords:
    | unknown[]
    | null;

  readonly bridgeRecords:
    | unknown[]
    | null;

  readonly bridge:
    | PreCaptureBridge
    | null;
};

type ResponsiveViewportResult = {
  readonly checked: boolean;
  readonly responsive: boolean;
  readonly mutated: boolean;
  readonly reason: string;
  readonly cleanup: (() => void) | null;
};

declare global {
  interface Window {
    __GLOBAL_EVENTS_BAG__?: unknown[];

    __ROD_PRE_CAPTURE__?: PreCaptureBridge;

    __ROD_DEVTOOLS__?: RodDevtoolsApi;
  }
}

const util = Object.freeze({
  isErudaEl: isDevtoolsNode,
  isDevtoolsNode,
  isDarkTheme,

  getTheme: () =>
    resolveTheme(
      String(
        api
          .get<DevTools>()
          ?.config.get(
            "theme",
          )
        ?? "System preference",
      ),
    ).name,

  getDebugConfig,
  themes,
  applyTheme,
});

const defaultTools = [
  "console",
  "elements",
  "network",
  "resources",
  "sources",
  "info",
  "snippets",
] as const;

const toolConstructors: Record<
  string,
  new () => ToolLike
> = {
  console: Console,
  elements: Elements,
  network: Network,
  resources: Resources,
  sources: Sources,
  info: Info,
  snippets: Snippets,
  settings: Settings,
};

/**
 * Reads the temporary startup capture surfaces exposed before RodEruda loads.
 *
 * Both sources are retained because PRE CAPTURE versions may expose either the
 * global bag, the controller records property, or both.
 */
function resolveBootCaptureSnapshot(): BootCaptureSnapshot {
  if (
    typeof window
    === "undefined"
  ) {
    return {
      globalRecords:
        null,

      bridgeRecords:
        null,

      bridge:
        null,
    };
  }

  const globalRecords =
    Array.isArray(
      window[
        GLOBAL_BOOT_EVENTS_KEY
      ],
    )
      ? window[
          GLOBAL_BOOT_EVENTS_KEY
        ]
      : null;

  const candidateBridge =
    window[
      PRE_CAPTURE_BRIDGE_KEY
    ];

  const bridge =
    candidateBridge
    && typeof candidateBridge
    === "object"
      ? candidateBridge
      : null;

  const bridgeRecords =
    Array.isArray(
      bridge
        ?.records,
    )
      ? bridge.records
      : null;

  return {
    globalRecords,
    bridgeRecords,
    bridge,
  };
}

/**
 * Releases the temporary PRE CAPTURE console instrumentation before RodEruda
 * installs its permanent capture layer.
 *
 * Calling the bridge directly is preferred. The custom event remains as a
 * fallback for PRE CAPTURE implementations that intentionally avoid exposing
 * the restore callback.
 */
function handoffBootCapture(
  snapshot: BootCaptureSnapshot,
): void {
  if (
    typeof window
    === "undefined"
  ) {
    return;
  }

  let restored =
    false;

  if (
    typeof snapshot
      .bridge
      ?.restore
    === "function"
  ) {
    try {
      snapshot
        .bridge
        .restore();

      restored =
        true;
    } catch (error) {
      console.warn(
        "[RodEruda] Unable to restore PRE CAPTURE bridge",
        error,
      );
    }
  }

  if (
    restored
  ) {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(
        PRE_CAPTURE_HANDOFF_EVENT,
      ),
    );
  } catch {
    /*
     * Some constrained environments may not allow custom event construction.
     * RodEruda can still initialize; only the explicit PRE CAPTURE handoff is
     * unavailable.
     */
  }
}

/**
 * Detects Location objects without relying exclusively on instanceof.
 *
 * Cross-realm Location objects may fail instanceof checks, so the intrinsic
 * object tag is also accepted.
 */
function isLocationObject(
  value: unknown,
): value is Location {
  if (
    value == null
    || typeof value
    !== "object"
  ) {
    return false;
  }

  if (
    typeof Location
    !== "undefined"
    && value
    instanceof Location
  ) {
    return true;
  }

  try {
    return Object
      .prototype
      .toString
      .call(
        value,
      )
      === "[object Location]";
  } catch {
    return false;
  }
}

/**
 * Detects URL objects without assuming that the value belongs to the current
 * JavaScript realm.
 */
function isUrlObject(
  value: unknown,
): value is URL {
  if (
    value == null
    || typeof value
    !== "object"
  ) {
    return false;
  }

  if (
    typeof URL
    !== "undefined"
    && value
    instanceof URL
  ) {
    return true;
  }

  try {
    return Object
      .prototype
      .toString
      .call(
        value,
      )
      === "[object URL]";
  } catch {
    return false;
  }
}

/**
 * Trims the middle of a text value while preserving both identifying edges.
 *
 * The default and minimum effective width are intentionally 80 characters.
 * Passing a smaller width cannot make boot source labels narrower than the
 * configured debugging contract.
 */
function trimBootText(
  value: string,
  maxWidth = MAX_BOOT_TEXT_WIDTH,
): string {
  const text =
    String(
      value,
    );

  const effectiveMaxWidth =
    Math.max(
      MAX_BOOT_TEXT_WIDTH,
      maxWidth,
    );

  if (
    text.length
    <= effectiveMaxWidth
  ) {
    return text;
  }

  const available =
    effectiveMaxWidth
    - 1;

  /*
   * Keep slightly more space on the right because source URLs typically end in
   * the most useful portion: filename, query parameters, hashes and line data.
   */
  const leftLength =
    Math.floor(
      available
      * 0.38,
    );

  const rightLength =
    available
    - leftLength;

  return `${text.slice(0, leftLength)}…${text.slice(-rightLength)}`;
}

/**
 * Compresses a hostname while preserving the first and last labels.
 *
 * Example:
 * `rod.migos.club` becomes `rod…club`.
 */
function compactHostname(
  hostname: string,
): string {
  const labels =
    hostname
      .split(".")
      .filter(
        Boolean,
      );

  if (
    labels.length
    <= 2
  ) {
    return trimBootText(
      hostname,
    );
  }

  return `${labels[0]}…${labels[labels.length - 1]}`;
}

/**
 * Compresses a non-terminal pathname segment.
 *
 * Filenames are intentionally handled separately because they carry much more
 * debugging value than intermediate directories.
 */
function compactPathSegment(
  segment: string,
): string {
  if (
    segment.length
    <= 6
  ) {
    return segment;
  }

  return `${segment.slice(0, 2)}…${segment.slice(-3)}`;
}

/**
 * Converts Location and URL values into compact source labels.
 *
 * The protocol is omitted because it rarely adds useful information in a
 * console source label. Hostname and intermediate directories are compressed,
 * while the final filename, search and hash are preserved for as long as the
 * 80-character budget allows.
 *
 * Example:
 *
 * https://rod.migos.club/bundler/devtools.canary.iife.min.js?000000000000049
 *
 * becomes:
 *
 * :rod…club/bu…ler/devtools.canary.iife.min.js?000000000000049
 */
function formatBootLocation(
  value:
    | Location
    | URL,
): string {
  try {
    const href =
      value.href;

    const parsed =
      value
      instanceof URL
        ? value
        : new URL(
            href,
          );

    const host =
      compactHostname(
        parsed.hostname,
      );

    const port =
      parsed.port
        ? `:${parsed.port}`
        : "";

    const segments =
      parsed.pathname
        .split("/")
        .filter(
          Boolean,
        );

    const lastIndex =
      segments.length
      - 1;

    const pathname =
      segments.length
        ? `/${
            segments
              .map(
                (
                  segment,
                  index,
                ) =>
                  index
                  === lastIndex
                    ? segment
                    : compactPathSegment(
                        segment,
                      ),
              )
              .join("/")
          }`
        : "";

    const compact =
      [
        ":",
        host,
        port,
        pathname,
        parsed.search,
        parsed.hash,
      ].join("");

    return trimBootText(
      compact,
    );
  } catch {
    try {
      return trimBootText(
        String(
          value,
        ),
      );
    } catch {
      return "[Location]";
    }
  }
}

/**
 * Normalizes values captured during startup without eagerly serializing normal
 * objects.
 *
 * Keeping ordinary objects intact allows the Console panel to inspect them
 * interactively. Only Location and URL are converted because their default
 * object representation is noisy while their href is the useful information.
 */
function normalizeBootValue(
  value: unknown,
): unknown {
  if (
    isLocationObject(
      value,
    )
    || isUrlObject(
      value,
    )
  ) {
    return formatBootLocation(
      value,
    );
  }

  return value;
}

/**
 * Normalizes the conventional startup record shape produced by PRE CAPTURE.
 *
 * Only the args array is cloned. The original boot bag is never mutated.
 */
function normalizeBootEntry(
  entry: unknown,
): unknown {
  if (
    entry == null
    || typeof entry
    !== "object"
    || Array.isArray(
      entry,
    )
  ) {
    return normalizeBootValue(
      entry,
    );
  }

  const record =
    entry as Record<
      string,
      unknown
    >;

  const args =
    record.args;

  if (
    !Array.isArray(
      args,
    )
  ) {
    return entry;
  }

  let changed =
    false;

  const normalizedArgs =
    args.map(
      (value) => {
        const normalized =
          normalizeBootValue(
            value,
          );

        if (
          normalized
          !== value
        ) {
          changed =
            true;
        }

        return normalized;
      },
    );

  if (
    !changed
  ) {
    return entry;
  }

  return {
    ...record,

    args:
      normalizedArgs,
  };
}

/**
 * Merges boot records and explicit init records without replaying the same
 * object twice when callers manually pass `window.__GLOBAL_EVENTS_BAG__`.
 *
 * Object identity is used for deduplication. Primitive entries are preserved
 * because two equal strings can represent two legitimate independent logs.
 */
function collectStartupEntries(
  snapshot: BootCaptureSnapshot,
  options: NormalizedInitOptions,
): unknown[] {
  const sources: Array<
    readonly unknown[]
    | null
    | undefined
  > = [
    snapshot.globalRecords,
    snapshot.bridgeRecords,
    options.initialLogs,
    options.initialErrors,
  ];

  const seenSources =
    new Set<
      readonly unknown[]
    >();

  const seenObjects =
    new WeakSet<object>();

  const entries: unknown[] =
    [];

  for (
    const source
    of sources
  ) {
    if (
      !source
      || seenSources.has(
        source,
      )
    ) {
      continue;
    }

    seenSources.add(
      source,
    );

    for (
      const entry
      of source
    ) {
      if (
        entry
        && typeof entry
        === "object"
      ) {
        if (
          seenObjects.has(
            entry,
          )
        ) {
          continue;
        }

        seenObjects.add(
          entry,
        );
      }

      entries.push(
        normalizeBootEntry(
          entry,
        ),
      );
    }
  }

  return entries;
}

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

  private host:
    | HTMLElement
    | null = null;

  private rootTarget:
    | HTMLElement
    | ShadowRoot
    | null = null;

  private shadowRoot:
    | ShadowRoot
    | null = null;

  private refs:
    | ShellRefs
    | null = null;

  private devtools:
    | DevTools
    | null = null;

  private entryBtn:
    | EntryBtn
    | null = null;

  private style:
    | HTMLStyleElement
    | null = null;

  private currentScale = 1;

  private ownsHost = false;

  private reattachTimer = 0;

  private readonly mountRetryTimers =
    new Set<number>();

  private sharedContext:
    | DevtoolsContextValue
    | null =
    null;

  private disposeRoot:
    | (() => void)
    | null =
    null;

  private hostObserver:
    | MutationObserver
    | null =
    null;

  /**
   * Restores the viewport metadata that existed before RodEruda initialization.
   *
   * This keeps the responsive-viewport intervention scoped to the DevTools
   * lifetime instead of permanently mutating the inspected page.
   */
  private viewportMetaCleanup:
    | (() => void)
    | null = null;

  private readonly reattachHost =
    (): void => {
      if (
        typeof document
        === "undefined"
      ) {
        return;
      }

      if (
        !this.host
        || !this.ownsHost
      ) {
        return;
      }

      if (
        this.host.isConnected
      ) {
        return;
      }

      this.forceMountHost();
    };

  private readonly onHostMutations =
    (): void => {
      /*
       * Ignore mutations while the host is already attached. Observing the
       * whole document with subtree:true otherwise re-enters on every page
       * update and can starve the main thread.
       */
      if (
        !this.host
        || this.host.isConnected
      ) {
        return;
      }

      this.reattachHost();
    };

  init(
    options: RodDevtoolsInitOptions = {},
  ): this {
    if (
      this.initialized
    ) {
      configureDebug(
        options.debug,
      );

      debugWarn(
        "runtime",
        "init skipped: already initialized",
      );

      return this;
    }

    if (
      typeof document
      === "undefined"
    ) {
      throw new Error(
        "RodEruda requires a browser document",
      );
    }

    /*
     * Snapshot the boot buffer before touching console instrumentation. PRE
     * CAPTURE is then released so RodEruda can install its own permanent
     * wrappers without a later restore removing them.
     */
    const bootCapture =
      resolveBootCaptureSnapshot();

    handoffBootCapture(
      bootCapture,
    );

    configureDebug(
      options.debug,
    );

    const normalizedOptions =
      normalizeInitOptions(
        options,
      );

    const finishDebug =
      debugGroup(
        "runtime",
        "init",
        {
          version:
            VERSION,

          inline:
            normalizedOptions
              .inline,

          useShadowDom:
            normalizedOptions
              .useShadowDom,

          autoScale:
            normalizedOptions
              .autoScale,

          ensureResponsiveViewport:
            normalizedOptions
              .ensureResponsiveViewport,

          tool:
            normalizedOptions
              .tools,

          bootCapture: {
            globalRecords:
              bootCapture
                .globalRecords
                ?.length
              ?? 0,

            bridgeRecords:
              bootCapture
                .bridgeRecords
                ?.length
              ?? 0,

            bridge:
              Boolean(
                bootCapture
                  .bridge,
              ),
          },
        },
      );

    try {
      /*
       * Resolve the inspected page viewport before creating any fixed-position
       * DevTools UI. Legacy mobile pages can expose a ~980 CSS-pixel layout
       * viewport, causing an otherwise correct 100vw interface to appear tiny.
       */
      const viewportResult =
        normalizedOptions
          .ensureResponsiveViewport
          ? ensureResponsiveViewport()
          : createSkippedViewportResult(
              "disabled",
            );

      this.viewportMetaCleanup =
        viewportResult.cleanup;

      debugInfo(
        "runtime",
        "responsive viewport check",
        {
          checked:
            viewportResult
              .checked,

          responsive:
            viewportResult
              .responsive,

          mutated:
            viewportResult
              .mutated,

          reason:
            viewportResult
              .reason,

          layoutWidth:
            getLayoutViewportWidth(),

          screenWidth:
            getPhysicalScreenWidth(),
        },
      );

      this.host =
        normalizedOptions
          .container
        ?? document.createElement(
          "div",
        );

      this.ownsHost =
        !normalizedOptions
          .container;

      debugLog(
        "runtime",
        "host prepared",
        {
          ownsHost:
            this.ownsHost,

          id:
            this.host.id
            || "pending",
        },
      );

      this.prepareHost(
        this.host,
        normalizedOptions.inline,
      );

      this.forceMountHost();

      this.sharedContext =
        createDevtoolsContextValue(
          this.host,
          normalizedOptions.inline,
        );

      this.rootTarget =
        this.createRenderTarget(
          this.host,
          normalizedOptions.useShadowDom,
        );

      const shellMount =
        renderShell(
          this.rootTarget,
          this.sharedContext,
        );

      this.refs =
        shellMount.refs;

      this.disposeRoot =
        shellMount.dispose;

      debugLog(
        "runtime",
        "shell rendered",
      );

      this.assertShellMounted();

      this.style =
        installDevtoolsStyles(
          this.rootTarget,
          concatArrays(
            shellStyleArtifacts,
            sharedStyleArtifacts,
            consoleStyleArtifacts,
            elementsStyleArtifacts,
            networkStyleArtifacts,
            infoStyleArtifacts,
            resourcesStyleArtifacts,
            settingsStyleArtifacts,
            sourcesStyleArtifacts,
            snippetsStyleArtifacts,
          ),
        );

      debugLog(
        "runtime",
        "styles installed",
        {
          style:
            Boolean(
              this.style,
            ),

          root:
            this.rootTarget
            instanceof ShadowRoot
              ? "shadow"
              : "light",
        },
      );

      this.chobitsu.setHost(
        this.host,
      );

      this.devtools =
        new DevTools(
          this.host,
          this.shadowRoot,
          this.refs,
          normalizedOptions.inline,
          normalizedOptions.defaults,
          this.sharedContext,
        );

      this.sharedContext
        .controller
        .set(
          this.devtools,
        );

      if (
        normalizedOptions
          .config
          ?.devtools
      ) {
        this.devtools
          .config
          .patch(
            normalizedOptions
              .config
              .devtools,
          );
      }

      this.entryBtn =
        new EntryBtn(
          this.refs
            .entryButton,
          this.refs
            .root,
        );

      this.mountSettings(
        normalizedOptions,
      );

      this.mountTools(
        normalizedOptions.tools,
        normalizedOptions,
      );

      const first =
        this.firstMountedTool(
          normalizedOptions.tools,
        )
        ?? "settings";

      this.devtools
        .showTool(
          first,
        );

      /*
       * PRE CAPTURE records are discovered automatically.
       *
       * Explicit initialLogs and initialErrors remain supported and are merged
       * with the boot bag. Object identity prevents the common case where the
       * caller passes __GLOBAL_EVENTS_BAG__ manually from being replayed twice.
       */
      const startupEntries =
        collectStartupEntries(
          bootCapture,
          normalizedOptions,
        );

      const consoleTool =
        this.devtools
          .get<Console>(
            "console",
          );

      if (
        startupEntries.length
      ) {
        consoleTool
          ?.ingestInitial(
            startupEntries as Parameters<
              Console["ingestInitial"]
            >[0],
          );
      }

      debugInfo(
        "runtime",
        "startup records ingested",
        {
          count:
            startupEntries
              .length,

          bootGlobal:
            bootCapture
              .globalRecords
              ?.length
            ?? 0,

          bootBridge:
            bootCapture
              .bridgeRecords
              ?.length
            ?? 0,

          explicitLogs:
            normalizedOptions
              .initialLogs
              ?.length
            ?? 0,

          explicitErrors:
            normalizedOptions
              .initialErrors
              ?.length
            ?? 0,
        },
      );

      const shouldDisplayStartupErrors =
        Boolean(
          startupEntries.length
          && consoleTool
            ?.config.get(
              "displayIfErr",
            ),
        );

      if (
        !normalizedOptions.inline
        && !shouldDisplayStartupErrors
      ) {
        this.devtools
          .hide();
      }

      if (
        shouldDisplayStartupErrors
      ) {
        this.devtools
          .showTool(
            "console",
          );
      }

      this.initialized =
        true;

      this.installHostWatchdog();

      this.forceMountHost();

      /*
       * When RodEruda just installed or repaired the viewport meta tag, the
       * previous viewportScale() value can still represent the legacy wide
       * viewport during the current synchronous task. Keep scale at 1 and let
       * the browser reflow against width=device-width instead of applying the
       * stale inverse scale and shrinking the DevTools again.
       */
      if (
        normalizedOptions
          .autoScale
        && detectMobile()
      ) {
        if (
          viewportResult
            .mutated
        ) {
          this.scale(
            1,
          );

          this.scheduleViewportScaleRefresh();
        } else {
          this.scale(
            1
            / viewportScale(),
          );
        }
      }

      if (
        normalizedOptions.inline
      ) {
        this.entryBtn
          .hide();

        this.devtools
          .show();
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
    if (
      !this.initialized
      && !this.host
    ) {
      return this;
    }

    const finishDebug =
      debugGroup(
        "runtime",
        "destroy",
      );

    this.entryBtn
      ?.destroy();

    this.devtools
      ?.destroy();

    this.style
      ?.remove();

    this.chobitsu
      .destroy();

    this.disposeRoot
      ?.();

    this.uninstallHostWatchdog();

    this.clearMountRetry();

    this.restoreViewportMeta();

    if (
      this.ownsHost
    ) {
      this.host
        ?.remove();
    } else {
      this.host
        ?.replaceChildren();
    }

    this.initialized =
      false;

    this.host =
      null;

    this.rootTarget =
      null;

    this.shadowRoot =
      null;

    this.refs =
      null;

    this.devtools =
      null;

    this.entryBtn =
      null;

    this.style =
      null;

    this.sharedContext =
      null;

    this.disposeRoot =
      null;

    this.currentScale =
      1;

    this.ownsHost =
      false;

    finishDebug();

    return this;
  }

  get<
    T extends
      | ToolLike
      | DevTools
      | EntryBtn =
      | ToolLike
      | DevTools
      | EntryBtn,
  >(
    name?: string,
  ): T | undefined {
    if (
      !this.checkInitialized()
    ) {
      return undefined;
    }

    if (
      !name
    ) {
      return this.devtools
        as T;
    }

    if (
      name
      === "entryBtn"
    ) {
      return this.entryBtn
        as T;
    }

    return this.devtools
      ?.get(
        normalizeToolName(
          name,
        ),
      )
      as T
      | undefined;
  }

  add(
    tool: ToolFactory,
  ): this {
    if (
      !this.checkInitialized()
    ) {
      return this;
    }

    const value =
      typeof tool
      === "function"
        ? tool(
            this,
          )
        : tool;

    debugLog(
      "runtime",
      "api.add",
      {
        name:
          value.name,
      },
    );

    this.devtools
      ?.add(
        value,
      );

    return this;
  }

  remove(
    name: string,
  ): this {
    if (
      !this.checkInitialized()
    ) {
      return this;
    }

    const normalized =
      normalizeToolName(
        name,
      );

    debugLog(
      "runtime",
      "api.remove",
      {
        name:
          normalized,
      },
    );

    this.devtools
      ?.remove(
        normalized,
      );

    return this;
  }

  show(
    name?: string,
  ): this {
    if (
      !this.checkInitialized()
    ) {
      return this;
    }

    debugLog(
      "runtime",
      "api.show",
      {
        name:
          name
          ?? "current",
      },
    );

    if (
      name
    ) {
      this.devtools
        ?.showTool(
          normalizeToolName(
            name,
          ),
        );
    } else {
      this.devtools
        ?.show();
    }

    return this;
  }

  hide(): this {
    if (
      !this.checkInitialized()
    ) {
      return this;
    }

    debugLog(
      "runtime",
      "api.hide",
    );

    this.devtools
      ?.hide();

    return this;
  }

  scale(): number;

  scale(
    value: number,
  ): this;

  scale(
    value?: number,
  ): number | this {
    if (
      value == null
    ) {
      return this.currentScale;
    }

    this.currentScale =
      Number.isFinite(
        value,
      )
      && value > 0
        ? value
        : 1;

    debugLog(
      "runtime",
      "scale",
      {
        value:
          this.currentScale,
      },
    );

    this.devtools
      ?.setScale(
        this.currentScale,
      );

    return this;
  }

  position():
    | Position
    | undefined;

  position(
    value: Position,
  ): this;

  position(
    value?: Position,
  ):
    | Position
    | undefined
    | this {
    if (
      !this.checkInitialized()
    ) {
      return value
        ? this
        : undefined;
    }

    if (
      value
    ) {
      debugLog(
        "runtime",
        "position:set",
        {
          x:
            value.x,

          y:
            value.y,
        },
      );

      this.entryBtn
        ?.setPos(
          value,
        );

      return this;
    }

    return this.entryBtn
      ?.getPos();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private createRenderTarget(
    host: HTMLElement,
    useShadowDom: boolean,
  ): HTMLElement | ShadowRoot {
    if (
      !useShadowDom
      || !host.attachShadow
    ) {
      this.shadowRoot =
        null;

      debugInfo(
        "runtime",
        "using light dom root",
      );

      return host;
    }

    try {
      const reused =
        Boolean(
          host.shadowRoot,
        );

      this.shadowRoot =
        host.shadowRoot
        ?? host.attachShadow(
          {
            mode:
              "open",
          },
        );

      debugInfo(
        "runtime",
        "shadow root mounted",
        {
          reused,
        },
      );

      return this.shadowRoot;
    } catch (error) {
      this.shadowRoot =
        null;

      debugWarn(
        "runtime",
        "shadow root fallback",
        {
          error:
            error
            instanceof Error
              ? error.message
              : String(
                  error,
                ),
        },
      );

      return host;
    }
  }

  private createSettingsTool(
    options: NormalizedInitOptions,
  ): Settings {
    const settings =
      new Settings();

    applyToolConfig(
      settings,
      options
        .config
        ?.panels
        ?.settings,
    );

    return settings;
  }

  private mountSettings(
    options: NormalizedInitOptions,
  ): void {
    if (
      !this.devtools
      || !this.entryBtn
    ) {
      return;
    }

    const settings =
      this.createSettingsTool(
        options,
      );

    this.devtools.add(
      settings,
    );

    this.entryBtn.initCfg(
      settings,
    );

    this.devtools.initCfg(
      settings,
    );
  }

  private mountTools(
    selected: string[],
    options: NormalizedInitOptions,
  ): void {
    if (
      !this.devtools
    ) {
      return;
    }

    debugInfo(
      "runtime",
      "mounting tools",
      {
        selected,
      },
    );

    for (
      const name
      of selected
    ) {
      if (
        name
        === "settings"
      ) {
        continue;
      }

      const Constructor =
        toolConstructors[
          name
        ];

      if (
        !Constructor
      ) {
        debugWarn(
          "runtime",
          "unknown tool skipped",
          {
            name,
          },
        );

        continue;
      }

      try {
        const instance =
          new Constructor();

        applyToolConfig(
          instance,
          options
            .config
            ?.panels
            ?.[name],
        );

        if (
          instance
          instanceof Network
        ) {
          this.chobitsu
            .attachNetworkCapture(
              instance.capture,
            );
        }

        this.devtools.add(
          instance,
        );

        debugLog(
          "runtime",
          "tool added",
          {
            name,
          },
        );
      } catch (error) {
        debugError(
          "runtime",
          "tool init failed",
          {
            name,

            error:
              error
              instanceof Error
                ? error.message
                : String(
                    error,
                  ),
          },
        );

        queueMicrotask(
          () =>
            console.error(
              `[RodEruda] Unable to initialize ${name}`,
              error,
            ),
        );
      }
    }
  }

  private firstMountedTool(
    selected: string[],
  ): string | undefined {
    return findArray(
      selected,
      (name) =>
        Boolean(
          this.devtools
            ?.get(
              name,
            ),
        ),
    );
  }

  private prepareHost(
    host: HTMLElement,
    inline: boolean,
  ): void {
    if (
      !host.id
    ) {
      host.id =
        "roderuda";
    }

    host.classList.add(
      "__chobitsu-hide__",
      "__roderuda-host__",
    );

    host.setAttribute(
      "data-roderuda-force-mounted",
      "true",
    );

    host.contentEditable =
      "false";

    host.setAttribute(
      "aria-live",
      "off",
    );

    host.setAttribute(
      "role",
      "presentation",
    );

    applyImportantStyle(
      host,
      inline
        ? {
            all:
              "initial",

            display:
              "block",

            position:
              "relative",

            width:
              "100%",

            height:
              "100%",

            minWidth:
              "320px",

            minHeight:
              "320px",

            zIndex:
              "2147483647",

            pointerEvents:
              "auto",

            contain:
              "layout style paint",

            isolation:
              "isolate",
          }
        : {
            all:
              "initial",

            display:
              "block",

            position:
              "fixed",

            inset:
              "0",

            width:
              "100vw",

            height:
              "100vh",

            minWidth:
              "0",

            minHeight:
              "0",

            margin:
              "0",

            padding:
              "0",

            border:
              "0",

            overflow:
              "visible",

            zIndex:
              "2147483647",

            pointerEvents:
              "none",

            contain:
              "layout style paint",

            isolation:
              "isolate",
          },
    );
  }

  private forceMountHost(): void {
    if (
      !this.host
      || !this.ownsHost
    ) {
      return;
    }

    if (
      this.host.isConnected
    ) {
      return;
    }

    if (
      this.tryMountHost()
    ) {
      return;
    }

    debugWarn(
      "runtime",
      "host attach deferred",
    );

    this.scheduleMountRetries();
  }

  private tryMountHost(): boolean {
    if (
      !this.host
      || this.host.isConnected
    ) {
      return Boolean(
        this.host
          ?.isConnected,
      );
    }

    if (
      forceAppendToPage(
        this.host,
      )
    ) {
      debugLog(
        "runtime",
        "host attached",
      );

      return true;
    }

    return false;
  }

  private scheduleMountRetries(): void {
    this.clearMountRetry();

    let attempt =
      0;

    const retry =
      (): void => {
        if (
          !this.host
          || this.host.isConnected
        ) {
          return;
        }

        if (
          this.tryMountHost()
        ) {
          debugLog(
            "runtime",
            "host attached after retry",
            {
              attempt,
            },
          );

          return;
        }

        attempt +=
          1;

        /*
         * Keep this cheap: short burst while the document is being created,
         * then stop.
         */
        if (
          attempt <= 10
        ) {
          this.trackMountRetryTimeout(
            retry,
            attempt < 4
              ? 16
              : 100,
          );
        }
      };

    if (
      document.readyState
      === "loading"
    ) {
      document.addEventListener(
        "DOMContentLoaded",
        retry,
        {
          once:
            true,

          capture:
            true,
        },
      );
    }

    window.addEventListener(
      "load",
      retry,
      {
        once:
          true,

        capture:
          true,
      },
    );

    this.trackMountRetryTimeout(
      retry,
      0,
    );
  }

  private trackMountRetryTimeout(
    callback: () => void,
    timeout: number,
  ): void {
    const id =
      window.setTimeout(
        () => {
          this.mountRetryTimers
            .delete(
              id,
            );

          callback();
        },
        timeout,
      );

    this.mountRetryTimers
      .add(
        id,
      );
  }

  private clearMountRetry(): void {
    for (
      const id
      of this.mountRetryTimers
    ) {
      window.clearTimeout(
        id,
      );
    }

    this.mountRetryTimers
      .clear();
  }

  private installHostWatchdog(): void {
    if (
      !this.host
      || !this.ownsHost
    ) {
      return;
    }

    this.uninstallHostWatchdog();

    try {
      this.hostObserver =
        new MutationObserver(
          this.onHostMutations,
        );

      /*
       * Only watch top-level document structure. Subtree observation of the
       * entire page is unnecessary for host reattachment and can freeze UI.
       */
      this.hostObserver.observe(
        document.documentElement,
        {
          childList:
            true,

          subtree:
            false,
        },
      );

      if (
        document.body
      ) {
        this.hostObserver.observe(
          document.body,
          {
            childList:
              true,

            subtree:
              false,
          },
        );
      }

      debugLog(
        "runtime",
        "host watchdog observer installed",
      );
    } catch (error) {
      debugWarn(
        "runtime",
        "host watchdog observer fallback",
        {
          error:
            error
            instanceof Error
              ? error.message
              : String(
                  error,
                ),
        },
      );
    }

    this.reattachTimer =
      window.setInterval(
        this.reattachHost,
        1000,
      );

    window.addEventListener(
      "pageshow",
      this.reattachHost,
      true,
    );

    window.addEventListener(
      "focus",
      this.reattachHost,
      true,
    );
  }

  private uninstallHostWatchdog(): void {
    if (
      this.reattachTimer
    ) {
      window.clearInterval(
        this.reattachTimer,
      );

      this.reattachTimer =
        0;
    }

    this.hostObserver
      ?.disconnect();

    this.hostObserver =
      null;

    window.removeEventListener(
      "pageshow",
      this.reattachHost,
      true,
    );

    window.removeEventListener(
      "focus",
      this.reattachHost,
      true,
    );
  }

  private assertShellMounted(): void {
    if (
      !this.refs
        ?.root
    ) {
      throw new Error(
        "[RodEruda] Shell refs were not created.",
      );
    }

    if (
      !this.host
        ?.isConnected
      && this.ownsHost
    ) {
      throw new Error(
        "[RodEruda] Shell host is not connected to the document.",
      );
    }

    const required: Array<
      [
        string,
        Element
        | null
        | undefined,
      ]
    > = [
      [
        "root",
        this.refs.root,
      ],
      [
        "entryButton",
        this.refs.entryButton,
      ],
      [
        "devtools",
        this.refs.devtools,
      ],
      [
        "tools",
        this.refs.tools,
      ],
      [
        "tabbar",
        this.refs.tabbar,
      ],
    ];

    const missing =
      filterMapArray(
        required,
        (
          [
            ,
            node,
          ],
        ) =>
          !(
            node
            instanceof Element
          ),
        (
          [
            name,
          ],
        ) =>
          name,
      );

    if (
      missing.length
    ) {
      throw new Error(
        `[RodEruda] Shell refs are missing after render: ${joinArray(missing, ", ")}`,
      );
    }
  }

  /**
   * Re-evaluates autoscale after a viewport-meta mutation has had a chance to
   * trigger browser layout.
   */
  private scheduleViewportScaleRefresh(): void {
    requestAnimationFrame(
      () => {
        if (
          !this.initialized
          || !this.devtools
        ) {
          return;
        }

        const scale =
          viewportScale();

        const next =
          Number.isFinite(
            scale,
          )
          && scale > 0
            ? 1 / scale
            : 1;

        debugInfo(
          "runtime",
          "viewport scale refreshed",
          {
            viewportScale:
              scale,

            scale:
              next,
          },
        );

        this.scale(
          next,
        );
      },
    );
  }

  /**
   * Restores viewport metadata modified during initialization.
   */
  private restoreViewportMeta(): void {
    const cleanup =
      this.viewportMetaCleanup;

    this.viewportMetaCleanup =
      null;

    if (
      !cleanup
    ) {
      return;
    }

    try {
      cleanup();

      debugInfo(
        "runtime",
        "viewport meta restored",
      );
    } catch (error) {
      debugWarn(
        "runtime",
        "viewport meta restore failed",
        {
          error:
            error
            instanceof Error
              ? error.message
              : String(
                  error,
                ),
        },
      );
    }
  }

  private rollbackFailedInit(): void {
    this.entryBtn
      ?.destroy();

    this.devtools
      ?.destroy();

    this.style
      ?.remove();

    this.disposeRoot
      ?.();

    this.uninstallHostWatchdog();

    this.clearMountRetry();

    this.restoreViewportMeta();

    if (
      this.ownsHost
    ) {
      this.host
        ?.remove();
    } else {
      this.host
        ?.replaceChildren();
    }

    this.initialized =
      false;

    this.host =
      null;

    this.rootTarget =
      null;

    this.shadowRoot =
      null;

    this.refs =
      null;

    this.devtools =
      null;

    this.entryBtn =
      null;

    this.style =
      null;

    this.sharedContext =
      null;

    this.disposeRoot =
      null;

    this.currentScale =
      1;

    this.ownsHost =
      false;
  }

  private checkInitialized(): boolean {
    if (
      !this.initialized
    ) {
      console.error(
        '[RodEruda] Please call "devtools.init()" first',
      );
    }

    return this.initialized;
  }
}

type NormalizedInitOptions =
  RodDevtoolsInitOptions & {
    inline: boolean;
    useShadowDom: boolean;
    autoScale: boolean;
    ensureResponsiveViewport: boolean;
    tools: string[];
  };

function normalizeInitOptions(
  options: RodDevtoolsInitOptions,
): NormalizedInitOptions {
  const toolInput =
    options.tool == null
      ? toArray(
          defaultTools,
        )
      : Array.isArray(
          options.tool,
        )
        ? options.tool
        : [
            options.tool,
          ];

  const tools =
    filterArray(
      uniq(
        mapArray(
          toolInput,
          normalizeToolName,
        ),
      ),
      Boolean,
    );

  return {
    ...options,

    inline:
      options.inline
      === true,

    useShadowDom:
      options.useShadowDom
      !== false,

    autoScale:
      options.autoScale
      !== false,

    ensureResponsiveViewport:
      options
        .ensureResponsiveViewport
      !== false,

    tools,
  };
}

function normalizeToolName(
  name: string,
): string {
  return String(
    name
    || "",
  )
    .trim()
    .toLowerCase();
}

function applyToolConfig(
  tool: ToolLike,
  values:
    | object
    | undefined,
): void {
  if (
    !values
  ) {
    return;
  }

  const configurable =
    tool as ToolLike & {
      config?: {
        patch?: (
          values: Record<
            string,
            unknown
          >,
        ) => void;
      };
    };

  configurable
    .config
    ?.patch?.(
      values as Record<
        string,
        unknown
      >,
    );
}

/**
 * Detects whether the current mobile document already uses a responsive
 * viewport and temporarily repairs it when necessary.
 *
 * @remarks
 * A responsive meta declaration is the strongest signal. When none exists,
 * the runtime compares the effective layout viewport against the physical
 * screen width. This catches legacy mobile pages whose browser layout viewport
 * is substantially wider than the device.
 */
function ensureResponsiveViewport(): ResponsiveViewportResult {
  if (
    typeof document
    === "undefined"
    || typeof window
    === "undefined"
  ) {
    return createSkippedViewportResult(
      "document-unavailable",
    );
  }

  if (
    !detectMobile()
  ) {
    return {
      checked:
        true,

      responsive:
        true,

      mutated:
        false,

      reason:
        "non-mobile",

      cleanup:
        null,
    };
  }

  const existing =
    document.querySelector<
      HTMLMetaElement
    >(
      'meta[name="viewport" i]',
    );

  const existingContent =
    existing
      ?.getAttribute(
        "content",
      )
      ?.trim()
    ?? "";

  if (
    hasDeviceWidthViewport(
      existingContent,
    )
  ) {
    return {
      checked:
        true,

      responsive:
        true,

      mutated:
        false,

      reason:
        "meta-device-width",

      cleanup:
        null,
    };
  }

  if (
    isViewportWidthResponsive()
  ) {
    return {
      checked:
        true,

      responsive:
        true,

      mutated:
        false,

      reason:
        existing
          ? "responsive-layout-existing-meta"
          : "responsive-layout",

      cleanup:
        null,
    };
  }

  if (
    existing
  ) {
    const originalContent =
      existing.getAttribute(
        "content",
      );

    existing.setAttribute(
      "content",
      mergeResponsiveViewportContent(
        existingContent,
      ),
    );

    debugWarn(
      "runtime",
      "non-responsive viewport meta repaired",
      {
        previous:
          originalContent
          ?? "",

        next:
          existing.content,
      },
    );

    return {
      checked:
        true,

      responsive:
        false,

      mutated:
        true,

      reason:
        "existing-meta-repaired",

      cleanup:
        () => {
          if (
            originalContent
            == null
          ) {
            existing
              .removeAttribute(
                "content",
              );
          } else {
            existing
              .setAttribute(
                "content",
                originalContent,
              );
          }
        },
    };
  }

  const meta =
    document.createElement(
      "meta",
    );

  meta.name =
    "viewport";

  meta.content =
    RESPONSIVE_VIEWPORT_CONTENT;

  meta.dataset
    .roderudaViewport =
    "true";

  const head =
    ensureDocumentHead();

  head.appendChild(
    meta,
  );

  debugWarn(
    "runtime",
    "responsive viewport meta installed",
    {
      content:
        meta.content,
    },
  );

  return {
    checked:
      true,

    responsive:
      false,

    mutated:
      true,

    reason:
      "meta-created",

    cleanup:
      () => {
        meta.remove();
      },
  };
}

/**
 * Returns true when the current layout viewport is already reasonably close to
 * the physical screen width.
 */
function isViewportWidthResponsive(): boolean {
  const layoutWidth =
    getLayoutViewportWidth();

  const screenWidth =
    getPhysicalScreenWidth();

  if (
    layoutWidth <= 0
    || screenWidth <= 0
  ) {
    return false;
  }

  return (
    layoutWidth
    / screenWidth
  ) <= RESPONSIVE_VIEWPORT_MAX_RATIO;
}

/**
 * Returns the effective CSS-pixel width used for page layout.
 */
function getLayoutViewportWidth(): number {
  const documentWidth =
    document
      .documentElement
      ?.clientWidth
    ?? 0;

  const windowWidth =
    window.innerWidth
    || 0;

  const visualWidth =
    window
      .visualViewport
      ?.width
    ?? 0;

  /*
   * On legacy mobile viewport pages, visualViewport and innerWidth may expose
   * the wide layout viewport. Taking the largest non-zero value makes that
   * condition explicit instead of accidentally classifying it as responsive.
   */
  return Math.max(
    documentWidth,
    windowWidth,
    visualWidth,
  );
}

/**
 * Returns the physical screen width in CSS pixels when available.
 */
function getPhysicalScreenWidth(): number {
  const width =
    window.screen
      ?.width
    ?? 0;

  const availableWidth =
    window.screen
      ?.availWidth
    ?? 0;

  if (
    width > 0
    && availableWidth > 0
  ) {
    return Math.min(
      width,
      availableWidth,
    );
  }

  return Math.max(
    width,
    availableWidth,
  );
}

/**
 * Detects a responsive width declaration without depending on declaration
 * ordering or whitespace.
 */
function hasDeviceWidthViewport(
  content: string,
): boolean {
  return /(?:^|,)\s*width\s*=\s*device-width\s*(?:,|$)/i.test(
    content,
  );
}

/**
 * Preserves safe existing viewport directives while forcing the responsive
 * width contract needed by the DevTools UI.
 */
function mergeResponsiveViewportContent(
  content: string,
): string {
  const directives =
    content
      .split(",")
      .map(
        (part) =>
          part.trim(),
      )
      .filter(
        Boolean,
      )
      .filter(
        (part) =>
          !/^width\s*=/i.test(
            part,
          ),
      );

  const hasInitialScale =
    directives.some(
      (part) =>
        /^initial-scale\s*=/i.test(
          part,
        ),
    );

  const hasViewportFit =
    directives.some(
      (part) =>
        /^viewport-fit\s*=/i.test(
          part,
        ),
    );

  return [
    "width=device-width",

    ...(
      hasInitialScale
        ? []
        : [
            "initial-scale=1",
          ]
    ),

    ...(
      hasViewportFit
        ? []
        : [
            "viewport-fit=cover",
          ]
    ),

    ...directives,
  ].join(
    ", ",
  );
}

/**
 * Returns the existing document head or creates one for very early document
 * start injection.
 */
function ensureDocumentHead(): HTMLHeadElement {
  if (
    document.head
  ) {
    return document.head;
  }

  const existing =
    document
      .documentElement
      ?.querySelector<
        HTMLHeadElement
      >(
        "head",
      );

  if (
    existing
  ) {
    return existing;
  }

  const head =
    document.createElement(
      "head",
    );

  document
    .documentElement
    ?.prepend(
      head,
    );

  return head;
}

function createSkippedViewportResult(
  reason: string,
): ResponsiveViewportResult {
  return {
    checked:
      false,

    responsive:
      false,

    mutated:
      false,

    reason,

    cleanup:
      null,
  };
}

export const api =
  new RodDevtoolsRuntime();

if (
  typeof window
  !== "undefined"
) {
  window.__ROD_DEVTOOLS__ =
    api;

  console.log(
    "DevTools installed",
    window.__ROD_DEVTOOLS__,
  );
}

export const devtools =
  api;

export const eruda =
  api;

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

export {
  DevtoolsContext,
  createDevtoolsContextValue,
} from "@rodkisten/devtools/core/context";

export type {
  DevtoolsContextValue,
  DevtoolsToolRegistration,
} from "@rodkisten/devtools/core/context";

export type * from "@rodkisten/devtools/types";

export default api;
