import type { InitialConsoleEntry } from "./types";
import {
  createLandingBookmarklet,
  createLandingInitOptions,
  createLandingTokenCss,
  createLandingUserscript,
  DEFAULT_LANDING_STATE,
  DEFAULT_LANDING_TOKENS,
  LANDING_PANEL_NAMES,
  normalizeInjectableScriptUrl,
  parseLandingState,
  parseLandingTokens,
  resolveInjectableDevtoolsApi,
  resolveInitialLandingTool,
  resolveInjectableErudaApi,
  serializeLandingState,
  serializeLandingTokens,
  type DevtoolsLandingState,
  type InjectableDevtoolsApi,
  type LandingGlobalCandidate,
  type LandingPanelName,
  type LandingTheme,
  type LandingTokenState,
} from "./landing.functions";

const STATE_STORAGE_KEY = "rod.devtools.landing.state.v1";
const TOKEN_STORAGE_KEY = "rod.devtools.landing.tokens.v1";
const SCRIPT_TIMEOUT_MS = 20_000;
const MAX_STARTUP_ENTRIES = 250;

interface LandingElements {
  readonly form: HTMLFormElement;
  readonly injectButton: HTMLButtonElement;
  readonly openButton: HTMLButtonElement;
  readonly hideButton: HTMLButtonElement;
  readonly destroyButton: HTMLButtonElement;
  readonly erudaButton: HTMLButtonElement;
  readonly copyUserscriptButton: HTMLButtonElement;
  readonly copyBookmarkletButton: HTMLButtonElement;
  readonly copyConfigButton: HTMLButtonElement;
  readonly copyTokensButton: HTMLButtonElement;
  readonly resetButton: HTMLButtonElement;
  readonly preview: HTMLElement;
  readonly status: HTMLElement;
  readonly statusLabel: HTMLElement;
  readonly statusLog: HTMLElement;
  readonly tokenForm: HTMLFormElement;
  readonly displaySizeOutput: HTMLOutputElement;
  readonly transparencyOutput: HTMLOutputElement;
  readonly blurOutput: HTMLOutputElement;
  readonly maxLogsOutput: HTMLOutputElement;
  readonly fontSizeOutput: HTMLOutputElement;
  readonly borderWidthOutput: HTMLOutputElement;
  readonly radiusOutput: HTMLOutputElement;
  readonly shadowOutput: HTMLOutputElement;
  readonly noiseOutput: HTMLOutputElement;
}

interface ScriptLoadOptions {
  readonly id: string;
  readonly url: string;
  readonly cacheBust: boolean;
  readonly replaceExisting: boolean;
}

const startupEntries: InitialConsoleEntry[] = [];
let activeApi: InjectableDevtoolsApi | null = null;
let erudaActive = false;
let actionSequence = 0;

captureStartupFailures();

const elements = resolveLandingElements();
const initialState = readStoredState();
const initialTokens = readStoredTokens();

writeStateToForm(elements.form, initialState);
writeTokensToForm(elements.tokenForm, initialTokens);
applyLandingTokens(initialTokens);
synchronizeOutputs();
refreshPreview();
setStatus("READY", "Configuration loaded. The browser laboratory is armed.", "ready");

for (const input of Array.from(elements.form.elements)) {
  input.addEventListener("input", onConfigurationInput);
  input.addEventListener("change", onConfigurationInput);
}

for (const input of Array.from(elements.tokenForm.elements)) {
  input.addEventListener("input", onTokenInput);
  input.addEventListener("change", onTokenInput);
}

elements.form.addEventListener("submit", (submitEvent) => {
  submitEvent.preventDefault();
  void injectConfiguredTools();
});

elements.openButton.addEventListener("click", openDevtools);
elements.hideButton.addEventListener("click", hideDevtools);
elements.destroyButton.addEventListener("click", destroyDevtools);
elements.erudaButton.addEventListener("click", () => void toggleEruda());
elements.copyUserscriptButton.addEventListener("click", () => void copyUserscript());
elements.copyBookmarkletButton.addEventListener("click", () => void copyBookmarklet());
elements.copyConfigButton.addEventListener("click", () => void copyConfiguration());
elements.copyTokensButton.addEventListener("click", () => void copyTokens());
elements.resetButton.addEventListener("click", resetLanding);

window.addEventListener("keydown", (keyboardEvent) => {
  const modifier = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
  if (!modifier || keyboardEvent.key !== "Enter") return;
  keyboardEvent.preventDefault();
  void injectConfiguredTools();
});

function resolveLandingElements(): LandingElements {
  return {
    form: requiredElement("#devtools-config", HTMLFormElement),
    injectButton: requiredElement("#inject-devtools", HTMLButtonElement),
    openButton: requiredElement("#open-devtools", HTMLButtonElement),
    hideButton: requiredElement("#hide-devtools", HTMLButtonElement),
    destroyButton: requiredElement("#destroy-devtools", HTMLButtonElement),
    erudaButton: requiredElement("#toggle-eruda", HTMLButtonElement),
    copyUserscriptButton: requiredElement("#copy-userscript", HTMLButtonElement),
    copyBookmarkletButton: requiredElement("#copy-bookmarklet", HTMLButtonElement),
    copyConfigButton: requiredElement("#copy-config", HTMLButtonElement),
    copyTokensButton: requiredElement("#copy-tokens", HTMLButtonElement),
    resetButton: requiredElement("#reset-landing", HTMLButtonElement),
    preview: requiredElement("#configuration-preview", HTMLElement),
    status: requiredElement("#runtime-status", HTMLElement),
    statusLabel: requiredElement("#runtime-status-label", HTMLElement),
    statusLog: requiredElement("#runtime-status-log", HTMLElement),
    tokenForm: requiredElement("#token-lab", HTMLFormElement),
    displaySizeOutput: requiredElement("#display-size-output", HTMLOutputElement),
    transparencyOutput: requiredElement("#transparency-output", HTMLOutputElement),
    blurOutput: requiredElement("#blur-output", HTMLOutputElement),
    maxLogsOutput: requiredElement("#max-logs-output", HTMLOutputElement),
    fontSizeOutput: requiredElement("#font-size-output", HTMLOutputElement),
    borderWidthOutput: requiredElement("#border-width-output", HTMLOutputElement),
    radiusOutput: requiredElement("#radius-output", HTMLOutputElement),
    shadowOutput: requiredElement("#shadow-output", HTMLOutputElement),
    noiseOutput: requiredElement("#noise-output", HTMLOutputElement),
  };
}

function onConfigurationInput(): void {
  const state = readStateFromForm(elements.form);
  writeStorage(STATE_STORAGE_KEY, serializeLandingState(state));
  synchronizeOutputs();
  refreshPreview();
}

function onTokenInput(): void {
  const tokens = readTokensFromForm(elements.tokenForm);
  applyLandingTokens(tokens);
  writeStorage(TOKEN_STORAGE_KEY, serializeLandingTokens(tokens));
  synchronizeOutputs();
}

async function injectConfiguredTools(): Promise<void> {
  const sequence = ++actionSequence;
  const state = readStateFromForm(elements.form);
  elements.injectButton.disabled = true;
  setStatus("INJECTING", "Loading external browser tooling…", "busy");

  try {
    if (state.loadEruda) {
      await loadExternalScript({
        id: "rod-landing-eruda-script",
        url: state.erudaUrl,
        cacheBust: state.cacheBust,
        replaceExisting: state.reinitialize,
      });
      initializeEruda(state.reinitialize);
      erudaActive = true;
      appendStatusLine("Eruda loaded and initialized.");
    }

    if (state.loadDevtools) {
      await loadExternalScript({
        id: "rod-landing-devtools-script",
        url: state.bundleUrl,
        cacheBust: state.cacheBust,
        replaceExisting: state.reinitialize,
      });

      const api = resolveApiFromWindow();
      if (!api) throw new Error("RodEruda loaded, but its public API could not be resolved.");

      if (state.reinitialize) api.destroy();

      api.init(createLandingInitOptions(
        state,
        state.captureStartupErrors ? startupEntries : [],
      ));

      activeApi = api;

      if (state.openAfterInject) api.show(resolveInitialLandingTool(state));
      appendStatusLine(`RodEruda initialized with ${selectedPanelCount(state)} panels.`);
    }

    if (sequence !== actionSequence) return;
    setStatus("ONLINE", "Injection complete. The page is now inspectable.", "success");
  } catch (error) {
    setStatus("FAILED", errorMessage(error), "error");
    appendStatusLine(errorStack(error));
  } finally {
    if (sequence === actionSequence) elements.injectButton.disabled = false;
  }
}

function openDevtools(): void {
  const api = activeApi ?? resolveApiFromWindow();
  if (!api) {
    setStatus("OFFLINE", "Inject RodEruda before opening it.", "warning");
    return;
  }

  const state = readStateFromForm(elements.form);
  const initialTool = resolveInitialLandingTool(state);
  api.show(initialTool);
  activeApi = api;
  setStatus("VISIBLE", `Opened the ${initialTool} panel.`, "success");
}

function hideDevtools(): void {
  const api = activeApi ?? resolveApiFromWindow();
  if (!api) return;
  api.hide();
  setStatus("HIDDEN", "RodEruda remains initialized but is no longer covering the page.", "ready");
}

function destroyDevtools(): void {
  const api = activeApi ?? resolveApiFromWindow();
  api?.destroy();
  activeApi = null;
  setStatus("DESTROYED", "RodEruda state and DOM were removed.", "warning");
}

async function toggleEruda(): Promise<void> {
  const existing = resolveInjectableErudaApi(window as unknown as LandingGlobalCandidate);

  if (existing && erudaActive) {
    existing.destroy?.();
    erudaActive = false;
    setStatus("ERUDA OFF", "The Eruda instance was destroyed.", "ready");
    return;
  }

  const state = readStateFromForm(elements.form);
  try {
    if (!existing) {
      await loadExternalScript({
        id: "rod-landing-eruda-script",
        url: state.erudaUrl,
        cacheBust: state.cacheBust,
        replaceExisting: false,
      });
    }
    initializeEruda(false);
    erudaActive = true;
    setStatus("ERUDA ON", "Eruda was injected independently.", "success");
  } catch (error) {
    setStatus("ERUDA FAILED", errorMessage(error), "error");
  }
}

async function copyUserscript(): Promise<void> {
  await copyText(createLandingUserscript(readStateFromForm(elements.form)));
  setStatus("COPIED", "Userscript copied to the clipboard.", "success");
}

async function copyBookmarklet(): Promise<void> {
  await copyText(createLandingBookmarklet(readStateFromForm(elements.form)));
  setStatus("COPIED", "Bookmarklet copied. Save it as a browser bookmark URL.", "success");
}

async function copyConfiguration(): Promise<void> {
  const options = createLandingInitOptions(readStateFromForm(elements.form));
  await copyText(JSON.stringify(options, null, 2));
  setStatus("COPIED", "Initialization options copied as JSON.", "success");
}

async function copyTokens(): Promise<void> {
  await copyText(createLandingTokenCss(readTokensFromForm(elements.tokenForm)));
  setStatus("COPIED", "Customizable CSS design tokens copied.", "success");
}

function resetLanding(): void {
  writeStateToForm(elements.form, DEFAULT_LANDING_STATE);
  writeTokensToForm(elements.tokenForm, DEFAULT_LANDING_TOKENS);
  applyLandingTokens(DEFAULT_LANDING_TOKENS);
  removeStorage(STATE_STORAGE_KEY);
  removeStorage(TOKEN_STORAGE_KEY);
  synchronizeOutputs();
  refreshPreview();
  setStatus("RESET", "The laboratory returned to its factory preset.", "ready");
}

function refreshPreview(): void {
  const state = readStateFromForm(elements.form);
  const options = createLandingInitOptions(state);
  elements.preview.textContent = `const api = DevTools.api ?? DevTools;\n\napi.init(${JSON.stringify(options, null, 2)});${state.openAfterInject ? `\napi.show(${JSON.stringify(resolveInitialLandingTool(state))});` : ""}`;
}

function synchronizeOutputs(): void {
  const state = readStateFromForm(elements.form);
  const tokens = readTokensFromForm(elements.tokenForm);
  elements.displaySizeOutput.value = `${state.displaySize}%`;
  elements.transparencyOutput.value = state.transparency.toFixed(2);
  elements.blurOutput.value = `${state.blur}px`;
  elements.maxLogsOutput.value = String(state.maxLogs);
  elements.fontSizeOutput.value = `${state.editorFontSize}px`;
  elements.borderWidthOutput.value = `${tokens.borderWidth}px`;
  elements.radiusOutput.value = `${tokens.radius}px`;
  elements.shadowOutput.value = `${tokens.shadowOffset}px`;
  elements.noiseOutput.value = tokens.noiseOpacity.toFixed(2);
}

function readStateFromForm(form: HTMLFormElement): DevtoolsLandingState {
  const data = new FormData(form);
  const panels = Object.fromEntries(
    LANDING_PANEL_NAMES.map((panelName) => [panelName, data.has(`panel-${panelName}`)]),
  ) as unknown as DevtoolsLandingState["panels"];

  return {
    bundleUrl: fieldString(data, "bundleUrl", DEFAULT_LANDING_STATE.bundleUrl),
    erudaUrl: fieldString(data, "erudaUrl", DEFAULT_LANDING_STATE.erudaUrl),
    loadDevtools: data.has("loadDevtools"),
    loadEruda: data.has("loadEruda"),
    cacheBust: data.has("cacheBust"),
    reinitialize: data.has("reinitialize"),
    openAfterInject: data.has("openAfterInject"),
    useShadowDom: data.has("useShadowDom"),
    autoScale: data.has("autoScale"),
    inline: data.has("inline"),
    debugEnabled: data.has("debugEnabled"),
    debugLevel: fieldString(data, "debugLevel", DEFAULT_LANDING_STATE.debugLevel) as DevtoolsLandingState["debugLevel"],
    captureStartupErrors: data.has("captureStartupErrors"),
    displayIfErr: data.has("displayIfErr"),
    theme: fieldString(data, "theme", DEFAULT_LANDING_STATE.theme) as LandingTheme,
    initialTool: fieldString(data, "initialTool", DEFAULT_LANDING_STATE.initialTool) as LandingPanelName,
    displaySize: fieldNumber(data, "displaySize", DEFAULT_LANDING_STATE.displaySize),
    transparency: fieldNumber(data, "transparency", DEFAULT_LANDING_STATE.transparency),
    blur: fieldNumber(data, "blur", DEFAULT_LANDING_STATE.blur),
    maxLogs: fieldNumber(data, "maxLogs", DEFAULT_LANDING_STATE.maxLogs),
    editorFontSize: fieldNumber(data, "editorFontSize", DEFAULT_LANDING_STATE.editorFontSize),
    panels,
    overrideConsole: data.has("overrideConsole"),
    catchGlobalErr: data.has("catchGlobalErr"),
    bridgePageRealm: data.has("bridgePageRealm"),
    patchConsolePrototype: data.has("patchConsolePrototype"),
    showWhitespace: data.has("showWhitespace"),
    wrapDomRows: data.has("wrapDomRows"),
    preserveNetworkLog: data.has("preserveNetworkLog"),
    captureResponseBody: data.has("captureResponseBody"),
    sourceLineNumbers: data.has("sourceLineNumbers"),
    sourceFormatting: data.has("sourceFormatting"),
    sourceWrapLines: data.has("sourceWrapLines"),
  };
}

function writeStateToForm(form: HTMLFormElement, state: DevtoolsLandingState): void {
  setFormValue(form, "bundleUrl", state.bundleUrl);
  setFormValue(form, "erudaUrl", state.erudaUrl);
  setFormChecked(form, "loadDevtools", state.loadDevtools);
  setFormChecked(form, "loadEruda", state.loadEruda);
  setFormChecked(form, "cacheBust", state.cacheBust);
  setFormChecked(form, "reinitialize", state.reinitialize);
  setFormChecked(form, "openAfterInject", state.openAfterInject);
  setFormChecked(form, "useShadowDom", state.useShadowDom);
  setFormChecked(form, "autoScale", state.autoScale);
  setFormChecked(form, "inline", state.inline);
  setFormChecked(form, "debugEnabled", state.debugEnabled);
  setFormValue(form, "debugLevel", state.debugLevel);
  setFormChecked(form, "captureStartupErrors", state.captureStartupErrors);
  setFormChecked(form, "displayIfErr", state.displayIfErr);
  setFormValue(form, "theme", state.theme);
  setFormValue(form, "initialTool", state.initialTool);
  setFormValue(form, "displaySize", state.displaySize);
  setFormValue(form, "transparency", state.transparency);
  setFormValue(form, "blur", state.blur);
  setFormValue(form, "maxLogs", state.maxLogs);
  setFormValue(form, "editorFontSize", state.editorFontSize);

  for (const panelName of LANDING_PANEL_NAMES) {
    setFormChecked(form, `panel-${panelName}`, state.panels[panelName]);
  }

  setFormChecked(form, "overrideConsole", state.overrideConsole);
  setFormChecked(form, "catchGlobalErr", state.catchGlobalErr);
  setFormChecked(form, "bridgePageRealm", state.bridgePageRealm);
  setFormChecked(form, "patchConsolePrototype", state.patchConsolePrototype);
  setFormChecked(form, "showWhitespace", state.showWhitespace);
  setFormChecked(form, "wrapDomRows", state.wrapDomRows);
  setFormChecked(form, "preserveNetworkLog", state.preserveNetworkLog);
  setFormChecked(form, "captureResponseBody", state.captureResponseBody);
  setFormChecked(form, "sourceLineNumbers", state.sourceLineNumbers);
  setFormChecked(form, "sourceFormatting", state.sourceFormatting);
  setFormChecked(form, "sourceWrapLines", state.sourceWrapLines);
}

function readTokensFromForm(form: HTMLFormElement): LandingTokenState {
  const data = new FormData(form);
  return {
    background: fieldString(data, "tokenBackground", DEFAULT_LANDING_TOKENS.background),
    surface: fieldString(data, "tokenSurface", DEFAULT_LANDING_TOKENS.surface),
    ink: fieldString(data, "tokenInk", DEFAULT_LANDING_TOKENS.ink),
    accent: fieldString(data, "tokenAccent", DEFAULT_LANDING_TOKENS.accent),
    hot: fieldString(data, "tokenHot", DEFAULT_LANDING_TOKENS.hot),
    electric: fieldString(data, "tokenElectric", DEFAULT_LANDING_TOKENS.electric),
    borderWidth: fieldNumber(data, "tokenBorderWidth", DEFAULT_LANDING_TOKENS.borderWidth),
    radius: fieldNumber(data, "tokenRadius", DEFAULT_LANDING_TOKENS.radius),
    shadowOffset: fieldNumber(data, "tokenShadowOffset", DEFAULT_LANDING_TOKENS.shadowOffset),
    noiseOpacity: fieldNumber(data, "tokenNoiseOpacity", DEFAULT_LANDING_TOKENS.noiseOpacity),
  };
}

function writeTokensToForm(form: HTMLFormElement, tokens: LandingTokenState): void {
  setFormValue(form, "tokenBackground", tokens.background);
  setFormValue(form, "tokenSurface", tokens.surface);
  setFormValue(form, "tokenInk", tokens.ink);
  setFormValue(form, "tokenAccent", tokens.accent);
  setFormValue(form, "tokenHot", tokens.hot);
  setFormValue(form, "tokenElectric", tokens.electric);
  setFormValue(form, "tokenBorderWidth", tokens.borderWidth);
  setFormValue(form, "tokenRadius", tokens.radius);
  setFormValue(form, "tokenShadowOffset", tokens.shadowOffset);
  setFormValue(form, "tokenNoiseOpacity", tokens.noiseOpacity);
}

function applyLandingTokens(tokens: LandingTokenState): void {
  const root = document.documentElement.style;
  root.setProperty("--landing-color-background", tokens.background);
  root.setProperty("--landing-color-surface", tokens.surface);
  root.setProperty("--landing-color-ink", tokens.ink);
  root.setProperty("--landing-color-accent", tokens.accent);
  root.setProperty("--landing-color-hot", tokens.hot);
  root.setProperty("--landing-color-electric", tokens.electric);
  root.setProperty("--landing-border-width", `${tokens.borderWidth}px`);
  root.setProperty("--landing-radius", `${tokens.radius}px`);
  root.setProperty("--landing-shadow-offset", `${tokens.shadowOffset}px`);
  root.setProperty("--landing-noise-opacity", String(tokens.noiseOpacity));
}

async function loadExternalScript(options: ScriptLoadOptions): Promise<void> {
  const normalizedUrl = normalizeInjectableScriptUrl(options.url);
  const existing = document.getElementById(options.id) as HTMLScriptElement | null;

  if (existing && !options.replaceExisting && existing.dataset.loaded === "true") return;
  existing?.remove();

  const script = document.createElement("script");
  script.id = options.id;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.referrerPolicy = "no-referrer";
  script.src = appendCacheBust(normalizedUrl, options.cacheBust);

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out while loading ${normalizedUrl}`));
    }, SCRIPT_TIMEOUT_MS);

    script.addEventListener("load", () => {
      window.clearTimeout(timeout);
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });

    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error(`Unable to load ${normalizedUrl}`));
    }, { once: true });

    document.head.append(script);
  });
}

function resolveApiFromWindow(): InjectableDevtoolsApi | null {
  return resolveInjectableDevtoolsApi(window as unknown as LandingGlobalCandidate);
}

function initializeEruda(reinitialize: boolean): void {
  const api = resolveInjectableErudaApi(window as unknown as LandingGlobalCandidate);
  if (!api) throw new Error("Eruda loaded, but its global API could not be resolved.");
  if (reinitialize) api.destroy?.();
  api.init();
}

function captureStartupFailures(): void {
  window.addEventListener("error", (errorEvent) => {
    pushStartupEntry({
      level: "error",
      args: [errorEvent.error ?? errorEvent.message],
      message: errorEvent.message,
      timestamp: Date.now(),
      stack: errorEvent.error instanceof Error ? errorEvent.error.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (rejectionEvent) => {
    const reason = rejectionEvent.reason;
    pushStartupEntry({
      level: "error",
      args: [reason],
      message: reason instanceof Error ? reason.message : String(reason),
      timestamp: Date.now(),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

function pushStartupEntry(entry: InitialConsoleEntry): void {
  startupEntries.push(entry);
  if (startupEntries.length > MAX_STARTUP_ENTRIES) startupEntries.splice(0, startupEntries.length - MAX_STARTUP_ENTRIES);
}

function setStatus(label: string, message: string, state: string): void {
  elements.status.dataset.state = state;
  elements.statusLabel.textContent = label;
  elements.statusLog.textContent = message;
}

function appendStatusLine(message: string): void {
  elements.statusLog.textContent = `${elements.statusLog.textContent}\n${message}`.trim();
}

function readStoredState(): DevtoolsLandingState {
  return parseLandingState(readStorage(STATE_STORAGE_KEY));
}

function readStoredTokens(): LandingTokenState {
  return parseLandingTokens(readStorage(TOKEN_STORAGE_KEY));
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing and embedded documents can deny storage without making the landing unusable.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage is an enhancement, not a runtime dependency.
  }
}

function selectedPanelCount(state: DevtoolsLandingState): number {
  return LANDING_PANEL_NAMES.filter((panelName) => state.panels[panelName]).length;
}

function appendCacheBust(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("landing", String(Date.now()));
  return parsed.href;
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function fieldString(data: FormData, name: string, fallback: string): string {
  const value = data.get(name);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function fieldNumber(data: FormData, name: string, fallback: number): number {
  const value = Number(data.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function setFormValue(form: HTMLFormElement, name: string, value: string | number): void {
  const control = form.elements.namedItem(name);
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) control.value = String(value);
}

function setFormChecked(form: HTMLFormElement, name: string, checked: boolean): void {
  const control = form.elements.namedItem(name);
  if (control instanceof HTMLInputElement) control.checked = checked;
}

function requiredElement<ElementType extends Element>(selector: string, constructor: { new(): ElementType }): ElementType {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) throw new Error(`Landing element not found: ${selector}`);
  return element;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorStack(error: unknown): string {
  return error instanceof Error && error.stack ? error.stack : errorMessage(error);
}
