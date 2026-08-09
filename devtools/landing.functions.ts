import type {
  DebugLevel,
  DevtoolsInitOptions,
  InitialConsoleBag,
} from "@rodkisten/devtools/types";
import { filterArray, includesArray } from "@rodkisten/nascente";

export const DEFAULT_DEVTOOLS_BUNDLE_URL =
  "https://rod.migos.club/bundler/devtools.iife.js";
export const DEFAULT_ERUDA_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/eruda@latest/eruda.js";

export const LANDING_PANEL_NAMES = [
  "console",
  "elements",
  "react",
  "network",
  "resources",
  "sources",
  "info",
  "snippets",
] as const;

export type LandingPanelName = (typeof LANDING_PANEL_NAMES)[number];
export type LandingTheme = "AMOLED" | "Dark" | "Light" | "System preference";

export interface LandingPanelSelection {
  readonly console: boolean;
  readonly elements: boolean;
  readonly react: boolean;
  readonly network: boolean;
  readonly resources: boolean;
  readonly sources: boolean;
  readonly info: boolean;
  readonly snippets: boolean;
}

export interface DevtoolsLandingState {
  readonly bundleUrl: string;
  readonly erudaUrl: string;
  readonly loadDevtools: boolean;
  readonly loadEruda: boolean;
  readonly cacheBust: boolean;
  readonly reinitialize: boolean;
  readonly openAfterInject: boolean;
  readonly useShadowDom: boolean;
  readonly autoScale: boolean;
  readonly inline: boolean;
  readonly debugEnabled: boolean;
  readonly debugLevel: DebugLevel;
  readonly captureStartupErrors: boolean;
  readonly displayIfErr: boolean;
  readonly theme: LandingTheme;
  readonly initialTool: LandingPanelName;
  readonly displaySize: number;
  readonly transparency: number;
  readonly blur: number;
  readonly maxLogs: number;
  readonly editorFontSize: number;
  readonly panels: LandingPanelSelection;
  readonly reactAutoRefresh: boolean;
  readonly reactSearchValues: boolean;
  readonly reactHideHostNodes: boolean;
  readonly reactMaxVisibleFibers: number;
  readonly reactMaxDomScanNodes: number;
  readonly reactMaxGlobalProperties: number;
  readonly reactFallbackPollMs: number;
  readonly overrideConsole: boolean;
  readonly catchGlobalErr: boolean;
  readonly bridgePageRealm: boolean;
  readonly patchConsolePrototype: boolean;
  readonly showWhitespace: boolean;
  readonly wrapDomRows: boolean;
  readonly preserveNetworkLog: boolean;
  readonly captureResponseBody: boolean;
  readonly sourceLineNumbers: boolean;
  readonly sourceFormatting: boolean;
  readonly sourceWrapLines: boolean;
}

export interface LandingTokenState {
  readonly background: string;
  readonly surface: string;
  readonly ink: string;
  readonly accent: string;
  readonly hot: string;
  readonly electric: string;
  readonly borderWidth: number;
  readonly radius: number;
  readonly shadowOffset: number;
  readonly noiseOpacity: number;
}

export interface InjectableDevtoolsApi {
  init(options?: DevtoolsInitOptions): InjectableDevtoolsApi;
  destroy(): InjectableDevtoolsApi;
  show(name?: string): InjectableDevtoolsApi;
  hide(): InjectableDevtoolsApi;
  isInitialized?(): boolean;
}

export interface InjectableErudaApi {
  init(options?: object): unknown;
  destroy?(): unknown;
  show?(): unknown;
  hide?(): unknown;
}

export interface LandingGlobalCandidate {
  readonly api?: unknown;
  readonly default?: unknown;
  readonly DevTools?: unknown;
  readonly Rod?: unknown;
  readonly RodDevtools?: unknown;
  readonly __ROD_DEVTOOLS__?: unknown;
  readonly eruda?: unknown;
}

export const DEFAULT_LANDING_STATE: DevtoolsLandingState = Object.freeze({
  bundleUrl: DEFAULT_DEVTOOLS_BUNDLE_URL,
  erudaUrl: DEFAULT_ERUDA_BUNDLE_URL,
  loadDevtools: true,
  loadEruda: false,
  cacheBust: true,
  reinitialize: true,
  openAfterInject: true,
  useShadowDom: true,
  autoScale: true,
  inline: false,
  debugEnabled: true,
  debugLevel: "info",
  captureStartupErrors: true,
  displayIfErr: false,
  theme: "AMOLED",
  initialTool: "console",
  displaySize: 72,
  transparency: 0.94,
  blur: 18,
  maxLogs: 500,
  editorFontSize: 12,
  panels: {
    console: true,
    elements: true,
    react: true,
    network: true,
    resources: true,
    sources: true,
    info: true,
    snippets: true,
  },
  reactAutoRefresh: true,
  reactSearchValues: true,
  reactHideHostNodes: false,
  reactMaxVisibleFibers: 5_000,
  reactMaxDomScanNodes: 25_000,
  reactMaxGlobalProperties: 4_000,
  reactFallbackPollMs: 1_500,
  overrideConsole: true,
  catchGlobalErr: true,
  bridgePageRealm: true,
  patchConsolePrototype: true,
  showWhitespace: false,
  wrapDomRows: true,
  preserveNetworkLog: true,
  captureResponseBody: true,
  sourceLineNumbers: true,
  sourceFormatting: true,
  sourceWrapLines: true,
});

export const DEFAULT_LANDING_TOKENS: LandingTokenState = Object.freeze({
  background: "#07060d",
  surface: "#f4efe3",
  ink: "#101019",
  accent: "#c6ff00",
  hot: "#ff2bd6",
  electric: "#5f7cff",
  borderWidth: 3,
  radius: 18,
  shadowOffset: 10,
  noiseOpacity: 0.08,
});

export function normalizeInjectableScriptUrl(value: string): string {
  // const url = new URL(value.trim(), globalThis.location?.href ?? "https://rod.migos.club/");
  const url = new URL(value.trim(), globalThis.location?.href ?? "https://rod.migos.club/");

  if (!/^https?:$/.test(url.protocol)) {
    throw new TypeError(`Unsupported script protocol: ${url.protocol}`);
  }

  return url.href;
}

export function selectedLandingPanels(selection: LandingPanelSelection): LandingPanelName[] {
  const panels = filterArray(LANDING_PANEL_NAMES, (name) => selection[name]);
  return panels.length ? panels : ["console"];
}

export function resolveInitialLandingTool(state: DevtoolsLandingState): LandingPanelName {
  const panels = selectedLandingPanels(state.panels);
  return includesArray(panels, state.initialTool) ? state.initialTool : panels[0]!;
}

export function createLandingInitOptions(
  state: DevtoolsLandingState,
  startupEntries: InitialConsoleBag = [],
): DevtoolsInitOptions {
  const tools = selectedLandingPanels(state.panels);

  return {
    tool: tools,
    autoScale: state.autoScale,
    useShadowDom: state.useShadowDom,
    inline: state.inline,
    defaults: {
      transparency: clamp(state.transparency, 0.2, 1),
      displaySize: clamp(state.displaySize, 20, 100),
      theme: state.theme,
      blur: clamp(state.blur, 0, 80),
    },
    config: {
      devtools: {
        transparency: clamp(state.transparency, 0.2, 1),
        displaySize: clamp(state.displaySize, 20, 100),
        blur: clamp(state.blur, 0, 80),
        theme: state.theme,
      },
      panels: {
        console: {
          overrideConsole: state.overrideConsole,
          catchGlobalErr: state.catchGlobalErr,
          displayIfErr: state.displayIfErr,
          maxLogNum: String(Math.round(clamp(state.maxLogs, 10, 10_000))),
          captureBridgePageRealm: state.bridgePageRealm,
          capturePatchPrototype: state.patchConsolePrototype,
        },
        elements: {
          showWhitespace: state.showWhitespace,
          wrapLines: state.wrapDomRows,
        },
        react: {
          autoRefresh: state.reactAutoRefresh,
          searchValues: state.reactSearchValues,
          hideHostNodes: state.reactHideHostNodes,
          maxVisibleFibers: Math.round(clamp(state.reactMaxVisibleFibers, 250, 50_000)),
          maxDomScanNodes: Math.round(clamp(state.reactMaxDomScanNodes, 500, 150_000)),
          maxGlobalProperties: Math.round(clamp(state.reactMaxGlobalProperties, 100, 20_000)),
          fallbackPollMs: Math.round(clamp(state.reactFallbackPollMs, 500, 15_000)),
        },
        network: {
          preserveLog: state.preserveNetworkLog,
          captureResponseBody: state.captureResponseBody,
        },
        sources: {
          showLineNum: state.sourceLineNumbers,
          formatCode: state.sourceFormatting,
          wrapLines: state.sourceWrapLines,
          editorFontSize: Math.round(clamp(state.editorFontSize, 8, 32)),
        },
      },
    },
    debug: {
      enabled: state.debugEnabled,
      level: state.debugLevel,
    },
    initialLogs: state.captureStartupErrors ? startupEntries : [],
    initialErrors: [],
  };
}

export function createLandingUserscript(state: DevtoolsLandingState): string {
  const bundleUrl = normalizeInjectableScriptUrl(state.bundleUrl);
  const erudaUrl = normalizeInjectableScriptUrl(state.erudaUrl);
  const options = createLandingInitOptions(state);
  const serializedOptions = JSON.stringify(options, null, 2);
  const requires = [
    state.loadDevtools ? `// @require      ${bundleUrl}` : "",
    state.loadEruda ? `// @require      ${erudaUrl}` : "",
  ].filter(Boolean).join("\n");
  const devtoolsInit = state.loadDevtools
    ? `
  const candidate =
    typeof DevTools !== "undefined"
      ? DevTools
      : globalThis.DevTools;
  const api =
    typeof candidate?.init === "function"
      ? candidate
      : candidate?.api ?? candidate?.default?.api ?? candidate?.default;

  if (!api || typeof api.init !== "function") {
    console.error("[Rod DevTools] DevTools API was not found.");
  } else {
    ${state.reinitialize ? "api.destroy?.();" : "// Preserve an existing initialized instance."}
    api.init(${indent(serializedOptions, 4)});
    ${state.openAfterInject ? `api.show?.(${JSON.stringify(resolveInitialLandingTool(state))});` : ""}
  }
`
    : "";
  const erudaInit = state.loadEruda
    ? `
  ${state.reinitialize ? "globalThis.eruda?.destroy?.();" : ""}
  globalThis.eruda?.init?.();
`
    : "";

  return `// ==UserScript==
// @name         🧪 Rod DevTools Launcher
// @namespace    https://rod.dev/userscripts
// @version      2.0.0
// @description  Inject Rod DevTools with React Fiber capture and mobile-safe diagnostics.
// @match        *://*/*
// @run-at       document-start
// @noframes
${requires}
// @grant        none
// ==/UserScript==

(function launchRodDevTools() {
  "use strict";
${devtoolsInit}${erudaInit}})();
`;
}

export function createLandingBookmarklet(state: DevtoolsLandingState): string {
  const bundleUrl = normalizeInjectableScriptUrl(state.bundleUrl);
  const erudaUrl = normalizeInjectableScriptUrl(state.erudaUrl);
  const options = createLandingInitOptions(state);
  const cacheSuffix = state.cacheBust ? "(u.includes('?')?'&landing=':'?landing=')+Date.now()" : "''";
  const devtoolsStep = state.loadDevtools
    ? `await l(${JSON.stringify(bundleUrl)});const c=globalThis.DevTools,a=typeof c?.init==='function'?c:c?.api??c?.default?.api??c?.default;if(!a?.init)throw new Error('Rod DevTools API not found');${state.reinitialize ? "a.destroy?.();" : ""}a.init(${JSON.stringify(options)});${state.openAfterInject ? `a.show?.(${JSON.stringify(resolveInitialLandingTool(state))});` : ""}`
    : "";
  const erudaStep = state.loadEruda
    ? `await l(${JSON.stringify(erudaUrl)});${state.reinitialize ? "globalThis.eruda?.destroy?.();" : ""}globalThis.eruda?.init?.();`
    : "";
  const source = `(async()=>{const d=document,l=u=>new Promise((r,j)=>{const s=d.createElement('script');s.src=u+${cacheSuffix};s.onload=()=>r();s.onerror=()=>j(new Error('Unable to load '+u));d.documentElement.append(s)});${devtoolsStep}${erudaStep}})()`;
  return `javascript:${encodeURIComponent(source)}`;
}

export function resolveInjectableDevtoolsApi(scope: LandingGlobalCandidate): InjectableDevtoolsApi | null {
  const candidates: unknown[] = [
    scope.__ROD_DEVTOOLS__,
    scope.api,
    scope.default,
    objectValue(scope.default, "api"),
    scope.DevTools,
    objectValue(scope.DevTools, "api"),
    objectValue(scope.DevTools, "default"),
    objectValue(objectValue(scope.DevTools, "default"), "api"),
    scope.RodDevtools,
    objectValue(scope.RodDevtools, "api"),
    scope.Rod,
    objectValue(scope.Rod, "api"),
    objectValue(scope.Rod, "DevTools"),
    objectValue(objectValue(scope.Rod, "DevTools"), "api"),
  ];

  for (const candidate of candidates) {
    if (isInjectableDevtoolsApi(candidate)) return candidate;
  }

  return null;
}

export function resolveInjectableErudaApi(scope: LandingGlobalCandidate): InjectableErudaApi | null {
  return isInjectableErudaApi(scope.eruda) ? scope.eruda : null;
}

export function serializeLandingState(state: DevtoolsLandingState): string {
  return JSON.stringify(state);
}

export function parseLandingState(value: string | null | undefined): DevtoolsLandingState {
  if (!value) return cloneLandingState(DEFAULT_LANDING_STATE);

  try {
    const parsed = JSON.parse(value) as Partial<DevtoolsLandingState>;
    return mergeLandingState(parsed);
  } catch {
    return cloneLandingState(DEFAULT_LANDING_STATE);
  }
}

export function serializeLandingTokens(tokens: LandingTokenState): string {
  return JSON.stringify(tokens);
}

export function parseLandingTokens(value: string | null | undefined): LandingTokenState {
  if (!value) return { ...DEFAULT_LANDING_TOKENS };

  try {
    const parsed = JSON.parse(value) as Partial<LandingTokenState>;
    return {
      background: colorValue(parsed.background, DEFAULT_LANDING_TOKENS.background),
      surface: colorValue(parsed.surface, DEFAULT_LANDING_TOKENS.surface),
      ink: colorValue(parsed.ink, DEFAULT_LANDING_TOKENS.ink),
      accent: colorValue(parsed.accent, DEFAULT_LANDING_TOKENS.accent),
      hot: colorValue(parsed.hot, DEFAULT_LANDING_TOKENS.hot),
      electric: colorValue(parsed.electric, DEFAULT_LANDING_TOKENS.electric),
      borderWidth: clampNumber(parsed.borderWidth, 1, 8, DEFAULT_LANDING_TOKENS.borderWidth),
      radius: clampNumber(parsed.radius, 0, 48, DEFAULT_LANDING_TOKENS.radius),
      shadowOffset: clampNumber(parsed.shadowOffset, 0, 30, DEFAULT_LANDING_TOKENS.shadowOffset),
      noiseOpacity: clampNumber(parsed.noiseOpacity, 0, 0.3, DEFAULT_LANDING_TOKENS.noiseOpacity),
    };
  } catch {
    return { ...DEFAULT_LANDING_TOKENS };
  }
}

export function createLandingTokenCss(tokens: LandingTokenState): string {
  return `:root {
  --landing-color-background: ${tokens.background};
  --landing-color-surface: ${tokens.surface};
  --landing-color-ink: ${tokens.ink};
  --landing-color-accent: ${tokens.accent};
  --landing-color-hot: ${tokens.hot};
  --landing-color-electric: ${tokens.electric};
  --landing-border-width: ${tokens.borderWidth}px;
  --landing-radius: ${tokens.radius}px;
  --landing-shadow-offset: ${tokens.shadowOffset}px;
  --landing-noise-opacity: ${tokens.noiseOpacity};
}`;
}

function mergeLandingState(input: Partial<DevtoolsLandingState>): DevtoolsLandingState {
  const defaults = DEFAULT_LANDING_STATE;
  const panels: Partial<LandingPanelSelection> = input.panels ?? {};
  const initialTool = includesArray(LANDING_PANEL_NAMES, input.initialTool as LandingPanelName)
    ? input.initialTool as LandingPanelName
    : defaults.initialTool;

  return {
    bundleUrl: stringValue(input.bundleUrl, defaults.bundleUrl),
    erudaUrl: stringValue(input.erudaUrl, defaults.erudaUrl),
    loadDevtools: booleanValue(input.loadDevtools, defaults.loadDevtools),
    loadEruda: booleanValue(input.loadEruda, defaults.loadEruda),
    cacheBust: booleanValue(input.cacheBust, defaults.cacheBust),
    reinitialize: booleanValue(input.reinitialize, defaults.reinitialize),
    openAfterInject: booleanValue(input.openAfterInject, defaults.openAfterInject),
    useShadowDom: booleanValue(input.useShadowDom, defaults.useShadowDom),
    autoScale: booleanValue(input.autoScale, defaults.autoScale),
    inline: booleanValue(input.inline, defaults.inline),
    debugEnabled: booleanValue(input.debugEnabled, defaults.debugEnabled),
    debugLevel: debugLevelValue(input.debugLevel, defaults.debugLevel),
    captureStartupErrors: booleanValue(input.captureStartupErrors, defaults.captureStartupErrors),
    displayIfErr: booleanValue(input.displayIfErr, defaults.displayIfErr),
    theme: themeValue(input.theme, defaults.theme),
    initialTool,
    displaySize: clampNumber(input.displaySize, 20, 100, defaults.displaySize),
    transparency: clampNumber(input.transparency, 0.2, 1, defaults.transparency),
    blur: clampNumber(input.blur, 0, 80, defaults.blur),
    maxLogs: clampNumber(input.maxLogs, 10, 10_000, defaults.maxLogs),
    editorFontSize: clampNumber(input.editorFontSize, 8, 32, defaults.editorFontSize),
    panels: {
      console: booleanValue(panels.console, defaults.panels.console),
      elements: booleanValue(panels.elements, defaults.panels.elements),
      react: booleanValue(panels.react, defaults.panels.react),
      network: booleanValue(panels.network, defaults.panels.network),
      resources: booleanValue(panels.resources, defaults.panels.resources),
      sources: booleanValue(panels.sources, defaults.panels.sources),
      info: booleanValue(panels.info, defaults.panels.info),
      snippets: booleanValue(panels.snippets, defaults.panels.snippets),
    },
    reactAutoRefresh: booleanValue(input.reactAutoRefresh, defaults.reactAutoRefresh),
    reactSearchValues: booleanValue(input.reactSearchValues, defaults.reactSearchValues),
    reactHideHostNodes: booleanValue(input.reactHideHostNodes, defaults.reactHideHostNodes),
    reactMaxVisibleFibers: clampNumber(input.reactMaxVisibleFibers, 250, 50_000, defaults.reactMaxVisibleFibers),
    reactMaxDomScanNodes: clampNumber(input.reactMaxDomScanNodes, 500, 150_000, defaults.reactMaxDomScanNodes),
    reactMaxGlobalProperties: clampNumber(input.reactMaxGlobalProperties, 100, 20_000, defaults.reactMaxGlobalProperties),
    reactFallbackPollMs: clampNumber(input.reactFallbackPollMs, 500, 15_000, defaults.reactFallbackPollMs),
    overrideConsole: booleanValue(input.overrideConsole, defaults.overrideConsole),
    catchGlobalErr: booleanValue(input.catchGlobalErr, defaults.catchGlobalErr),
    bridgePageRealm: booleanValue(input.bridgePageRealm, defaults.bridgePageRealm),
    patchConsolePrototype: booleanValue(input.patchConsolePrototype, defaults.patchConsolePrototype),
    showWhitespace: booleanValue(input.showWhitespace, defaults.showWhitespace),
    wrapDomRows: booleanValue(input.wrapDomRows, defaults.wrapDomRows),
    preserveNetworkLog: booleanValue(input.preserveNetworkLog, defaults.preserveNetworkLog),
    captureResponseBody: booleanValue(input.captureResponseBody, defaults.captureResponseBody),
    sourceLineNumbers: booleanValue(input.sourceLineNumbers, defaults.sourceLineNumbers),
    sourceFormatting: booleanValue(input.sourceFormatting, defaults.sourceFormatting),
    sourceWrapLines: booleanValue(input.sourceWrapLines, defaults.sourceWrapLines),
  };
}

function cloneLandingState(state: DevtoolsLandingState): DevtoolsLandingState {
  return {
    ...state,
    panels: { ...state.panels },
  };
}

function isInjectableDevtoolsApi(value: unknown): value is InjectableDevtoolsApi {
  return Boolean(
    value
    && typeof value === "object"
    && typeof objectValue(value, "init") === "function"
    && typeof objectValue(value, "destroy") === "function"
    && typeof objectValue(value, "show") === "function"
    && typeof objectValue(value, "hide") === "function",
  );
}

function isInjectableErudaApi(value: unknown): value is InjectableErudaApi {
  return Boolean(value && typeof value === "object" && typeof objectValue(value, "init") === "function");
}

function objectValue(value: unknown, key: string): unknown {
  return value && (typeof value === "object" || typeof value === "function")
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, minimum, maximum)
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function colorValue(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[\da-f]{3,8}$/i.test(value) ? value : fallback;
}

function themeValue(value: unknown, fallback: LandingTheme): LandingTheme {
  return includesArray(["AMOLED", "Dark", "Light", "System preference"], String(value))
    ? value as LandingTheme
    : fallback;
}

function debugLevelValue(value: unknown, fallback: DebugLevel): DebugLevel {
  return includesArray(["trace", "debug", "info", "warn", "error", "silent"], String(value))
    ? value as DebugLevel
    : fallback;
}

function indent(value: string, amount: number): string {
  const prefix = " ".repeat(amount);
  return value.replace(/^/gm, prefix).trimStart();
}
