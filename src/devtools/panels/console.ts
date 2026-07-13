import { flushSync, store } from "../../broto";
import { html, render } from "../components/runtime";
import { ConfigStore } from "../core/config";
import { ConsoleCapture } from "../core/console-capture";
import { mountCodeEditor, type CodeEditorHandle } from "../core/code-editor";
import { copyText, icon, safeStringify } from "../utils";
import { plainText, renderValue } from "../core/serialize";
import { Tool } from "../tool";
import type { ConsoleConfig, ConsoleFilter, ConsoleLevel, ConsoleRecord, ToolContext } from "../types";
import {
  ConsoleCodeEditorHost,
  ConsoleGroup,
  ConsoleRepeat,
  ConsoleRow,
  ConsoleStack,
  ConsoleTable,
  ConsoleTableCell,
  ConsoleTableHead,
  ConsoleTableWrap,
  ConsoleTime,
  consoleStyleArtifacts,
  type ConsoleState,
  type ConsoleViewModel,
  visibleLevels,
} from "./console-components";

export { consoleStyleArtifacts };

const DEFAULT_CONSOLE_CONFIG: Readonly<ConsoleConfig> = Object.freeze({
  asyncRender: true,
  jsExecution: true,
  catchGlobalErr: true,
  overrideConsole: true,
  displayExtraInfo: false,
  displayUnenumerable: true,
  displayGetterVal: false,
  lazyEvaluation: true,
  displayIfErr: false,
  maxLogNum: "250",
  captureWatchdogMs: 250,
  captureBridgePageRealm: true,
  capturePatchPrototype: true,
  captureLockConsole: false,
  historyLimit: 100,
  hiddenErrorNoticeDelay: 350,
  logRowGap: 8,
  logRowPadding: 10,
  listBottomPadding: 84,
  filterMinWidth: 150,
  editorMinHeight: 120,
  logPreviewLines: 6,
});

const HISTORY_STORAGE_KEY = "roderuda:console-history";
const sharedCapture = new ConsoleCapture();

export class Console extends Tool {
  readonly name: string;
  readonly title = "console";
  readonly icon = icon("console");
  readonly config: ConfigStore<ConsoleConfig>;

  private readonly capture = sharedCapture;
  private readonly state = store<ConsoleState>({
    records: [],
    filterValue: null,
    filterText: "",
    history: [],
    historyIndex: 0,
    selectedRecordId: null,
    enabledLevels: [...visibleLevels],
    editorExpanded: false,
    inputValue: "",
    jsExecution: DEFAULT_CONSOLE_CONFIG.jsExecution,
    displayExtraInfo: DEFAULT_CONSOLE_CONFIG.displayExtraInfo,
    displayUnenumerable: DEFAULT_CONSOLE_CONFIG.displayUnenumerable,
    lazyEvaluation: DEFAULT_CONSOLE_CONFIG.lazyEvaluation,
    lastResult: undefined,
  }, { name: "roderuda-console" });

  private body: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private codeEditor: CodeEditorHandle | null = null;
  private codeEditorHost: HTMLElement | null = null;
  private disposeView: (() => void) | null = null;
  private renderFrame = 0;
  private scrollAfterRender = false;

  constructor({ name = "console" }: { name?: string } = {}) {
    super();
    this.name = name;
    this.config = new ConfigStore(`console:${name}`, { ...DEFAULT_CONSOLE_CONFIG });
    this.syncConfigState();
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    const view: ConsoleViewModel = {
      state: this.state,
      setBody: (node) => { this.body = node; },
      setList: (node) => { this.setList(node); },
      setInput: (node) => { this.setInput(node); },
      clear: () => this.clear(),
      copy: () => { void this.copyVisibleRecords(); },
      toggleLevel: (level) => this.toggleLevel(level),
      filter: (value) => this.filter(value),
      handleInput: (inputEvent) => this.handleInput(inputEvent),
      handleInputKey: (keyboardEvent) => this.handleInputKey(keyboardEvent),
      handleInputFocus: () => this.handleInputFocus(),
      cancelEditor: () => this.expandEditor(false),
      clearEditor: () => this.clearEditor(),
      runEditor: () => { void this.executeInput(); },
    };

    this.disposeView?.();
    this.disposeView = render(container, html`<RodConsoleView view=${view as never} />`);
    this.body = container.querySelector<HTMLElement>("[data-console-body]");
    this.setList(container.querySelector<HTMLElement>("[data-console-list]"));
    const input = container.querySelector("[data-console-input]");
    if (input instanceof HTMLTextAreaElement) this.setInput(input);
    this.capture.on("record", this.onRecord);
    this.capture.on("clear", this.onClear);
    this.hydrateCapturedRecords();
    this.hydrateHistory();

    try {
      this.capture.install({
        overrideConsole: this.config.get("overrideConsole"),
        catchGlobalErrors: this.config.get("catchGlobalErr"),
        watchdog: this.config.get("overrideConsole"),
        watchdogMs: this.config.get("captureWatchdogMs"),
        lockConsole: this.config.get("captureLockConsole"),
        patchPrototype: this.config.get("capturePatchPrototype"),
        bridgePageRealm: this.config.get("captureBridgePageRealm"),
      });
    } catch (error) {
      context.notify(`Console capture fallback: ${error instanceof Error ? error.message : String(error)}`, { type: "warning", duration: 5000 });
    }

    this.config.on("change", this.onConfigChange);
    this.applyTweakVariables();
    this.reconfigureCapture();
    this.registerSettings(context);
    this.syncConfigState();
    this.syncDom();
    flushSync();
  }

  log(...args: unknown[]): void { this.capture.record("log", args); }
  debug(...args: unknown[]): void { this.capture.record("debug", args); }
  info(...args: unknown[]): void { this.capture.record("info", args); }
  warn(...args: unknown[]): void { this.capture.record("warn", args); }
  error(...args: unknown[]): void { this.capture.record("error", args); }
  dir(...args: unknown[]): void { this.capture.record("dir", args); }
  table(...args: unknown[]): void { this.capture.record("table", args); }
  html(htmlText: string): void { this.capture.record("html", [htmlText]); }
  clear(): void { this.capture.clear(); }
  setGlobal(name: string, value: unknown): void { this.capture.setGlobal(name, value); }
  overrideConsole(): this { this.capture.overrideConsole(); return this; }
  restoreConsole(): this { this.capture.restoreConsole(); return this; }
  catchGlobalErr(): this { this.capture.enableGlobalErrors(); return this; }
  ignoreGlobalErr(): this { this.capture.disableGlobalErrors(); return this; }

  ingestInitial(entries: readonly unknown[]): void {
    for (const entry of entries) {
      if (isInitialConsoleEntry(entry)) {
        const args = entry.args ? Array.from(entry.args) : [entry.message];
        this.capture.record(entry.level ?? "error", args.length ? args : [entry]);
        continue;
      }

      this.capture.record(entry instanceof Error ? "error" : "log", [entry]);
    }

    // Startup records are part of initialization, so they must be visible before
    // init() returns even when normal console rendering is configured as async.
    this.cancelScheduledRender();
    this.syncDom();
    flushSync();
  }
  
  filter(filter: ConsoleFilter): void {
    this.state.patch({
      filterValue: typeof filter === "string" && !filter.trim() ? null : filter,
      filterText: typeof filter === "string" ? filter : "",
    }, { cause: "console:filter" });
    if (this.active) {
      this.syncDom();
      flushSync();
    }
  }

  override show(): void {
    super.show();
    if (this.input) this.mountCodeEditor(this.input);
    this.cancelScheduledRender();
    this.syncDom();
    flushSync();
    queueMicrotask(() => this.scrollToBottom());
  }

  override hide(): void {
    super.hide();
    this.cancelScheduledRender();
    this.destroyCodeEditor();
  }

  override destroy(): void {
    this.cancelScheduledRender();
    this.capture.off("record", this.onRecord);
    this.capture.off("clear", this.onClear);
    this.config.off("change", this.onConfigChange);
    this.disposeView?.();
    this.disposeView = null;
    this.body = null;
    this.list = null;
    this.input = null;
    this.destroyCodeEditor();
    this.state.patch({ records: [], selectedRecordId: null, inputValue: "", editorExpanded: false }, { cause: "console:destroy" });
    super.destroy();
  }

  private hydrateCapturedRecords(): void {
    const records = this.capture.getRecords();
    if (!records.length || this.state.records.peek().length) return;
    this.state.records.set([...records]);
  }

  private hydrateHistory(): void {
    const history = readHistory(this.config.get("historyLimit"));
    this.state.patch({ history, historyIndex: history.length }, { cause: "console:history-hydrate" });
  }

  private readonly onRecord = (record: ConsoleRecord): void => {
    const records = [...this.state.records.peek()];
    const last = records.at(-1);
    if (last && sameRecord(last, record)) {
      records[records.length - 1] = { ...last, repeat: (last.repeat ?? 1) + 1, timestamp: record.timestamp };
    } else {
      records.push(record);
    }
    this.state.records.set(records);
    this.trimRecords();

    // Console errors belong in the Console panel. Never turn captured errors
    // into global toasts: rendering a toast can itself fail and previously
    // created a capture -> toast -> error -> capture feedback loop.

    if (!this.active) return;

    if (this.config.get("asyncRender")) {
      this.scheduleDomSync(true);
    } else {
      this.syncDom();
      flushSync();
      this.scrollToBottom();
    }
  };


  private readonly onClear = (): void => {
    this.state.patch({ records: [], selectedRecordId: null }, { cause: "console:clear" });
    if (!this.active) return;
    this.cancelScheduledRender();
    this.syncDom();
    flushSync();
  };

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (["overrideConsole", "captureWatchdogMs", "captureBridgePageRealm", "capturePatchPrototype", "captureLockConsole"].includes(key)) this.reconfigureCapture();
    if (key === "catchGlobalErr") value ? this.capture.enableGlobalErrors() : this.capture.disableGlobalErrors();
    if (["logRowGap", "logRowPadding", "listBottomPadding", "filterMinWidth", "editorMinHeight", "logPreviewLines"].includes(key)) this.applyTweakVariables();
    if (key === "jsExecution" || key === "displayExtraInfo" || key === "displayUnenumerable" || key === "lazyEvaluation") {
      this.syncConfigState();
      if (this.active) {
        this.syncDom();
        flushSync();
      }
    }
    if (key === "maxLogNum") {
      this.trimRecords();
      if (this.active) {
        this.syncDom();
        flushSync();
      }
    }
  };

  private syncConfigState(): void {
    this.state.patch({
      jsExecution: this.config.get("jsExecution"),
      displayExtraInfo: this.config.get("displayExtraInfo"),
      displayUnenumerable: this.config.get("displayUnenumerable"),
      lazyEvaluation: this.config.get("lazyEvaluation"),
    }, { cause: "console:config-sync" });
  }

  private registerSettings(context: ToolContext): void {
    context.settings.registerConfigGroup({
      title: "Console",
      config: this.config,
      settings: [
        { kind: "switch", key: "asyncRender", label: "Asynchronous rendering" },
        { kind: "switch", key: "jsExecution", label: "Enable JavaScript execution" },
        { kind: "switch", key: "catchGlobalErr", label: "Catch global errors" },
        { kind: "switch", key: "overrideConsole", label: "Override window.console" },
        { kind: "switch", key: "captureBridgePageRealm", label: "Capture logs from the page realm" },
        { kind: "switch", key: "capturePatchPrototype", label: "Patch Console.prototype" },
        { kind: "switch", key: "captureLockConsole", label: "Protect console hooks from replacement" },
        { kind: "number", key: "captureWatchdogMs", label: "Console re-hook interval (ms)", options: { min: 50, max: 5000, step: 50 } },
        { kind: "switch", key: "displayExtraInfo", label: "Display timestamps and extra information" },
        { kind: "switch", key: "displayUnenumerable", label: "Display non-enumerable properties" },
        { kind: "switch", key: "displayGetterVal", label: "Read getter values" },
        { kind: "switch", key: "lazyEvaluation", label: "Lazy object evaluation" },
        { kind: "switch", key: "displayIfErr", label: "Legacy hidden-error notice (toasts are suppressed for safety)" },
        { kind: "select", key: "maxLogNum", label: "Maximum log count", selections: ["infinite", "1000", "500", "250", "125", "100", "50", "10"] },
        { kind: "number", key: "historyLimit", label: "Command history limit", options: { min: 0, max: 1000, step: 10 } },
        { kind: "number", key: "hiddenErrorNoticeDelay", label: "Hidden error batching delay (ms)", options: { min: 0, max: 5000, step: 50 } },
        { kind: "number", key: "logRowGap", label: "Log row spacing", options: { min: 0, max: 32, step: 1 } },
        { kind: "number", key: "logRowPadding", label: "Log row padding", options: { min: 2, max: 32, step: 1 } },
        { kind: "number", key: "listBottomPadding", label: "Console bottom scroll padding", options: { min: 0, max: 320, step: 4 } },
        { kind: "number", key: "filterMinWidth", label: "Filter minimum width", options: { min: 80, max: 480, step: 10 } },
        { kind: "number", key: "editorMinHeight", label: "Expanded editor minimum height", options: { min: 60, max: 600, step: 10 } },
        { kind: "number", key: "logPreviewLines", label: "Collapsed log preview lines", options: { min: 1, max: 100, step: 1 } },
      ],
    });
  }

  private reconfigureCapture(): void {
    if (!this.config.get("overrideConsole")) {
      this.capture.restoreConsole();
      return;
    }
    this.capture.overrideConsole({
      watchdog: true,
      watchdogMs: this.config.get("captureWatchdogMs"),
      patchPrototype: this.config.get("capturePatchPrototype"),
      lockConsole: this.config.get("captureLockConsole"),
      bridgePageRealm: this.config.get("captureBridgePageRealm"),
    });
  }

  private applyTweakVariables(): void {
    const target = this.container;
    if (!target) return;
    target.style.setProperty("--rd-console-row-gap", `${this.config.get("logRowGap")}px`);
    target.style.setProperty("--rd-console-row-padding", `${this.config.get("logRowPadding")}px`);
    target.style.setProperty("--rd-console-bottom-padding", `${this.config.get("listBottomPadding")}px`);
    target.style.setProperty("--rd-console-filter-min-width", `${this.config.get("filterMinWidth")}px`);
    target.style.setProperty("--rd-console-editor-min-height", `${this.config.get("editorMinHeight")}px`);
    target.style.setProperty("--rd-console-preview-lines", String(this.config.get("logPreviewLines")));
  }

  private visibleRecords(): readonly ConsoleRecord[] {
    return this.state.records.peek().filter((record) => this.matches(record));
  }

  private matches(record: ConsoleRecord): boolean {
    const level = normalizeVisibleLevel(record.level);
    if (!this.state.enabledLevels.peek().includes(level)) return false;
    const filterValue = this.state.filterValue.peek();
    if (!filterValue) return true;
    if (typeof filterValue === "function") return filterValue(record);
    const text = record.args.map(plainText).join(" ");
    if (filterValue instanceof RegExp) {
      filterValue.lastIndex = 0;
      return filterValue.test(text);
    }
    return text.toLowerCase().includes(filterValue.toLowerCase());
  }

  private trimRecords(): void {
    const value = this.config.get("maxLogNum");
    const max = value === "infinite" ? 0 : Number(value);
    const records = this.state.records.peek();
    if (max > 0 && records.length > max) this.state.records.set(records.slice(records.length - max));
  }

  private toggleLevel(level: ConsoleLevel): void {
    const enabled = this.state.enabledLevels.peek();
    const next = enabled.includes(level) ? enabled.filter((candidate) => candidate !== level) : [...enabled, level];
    this.state.enabledLevels.set(next);
    this.syncDom();
    flushSync();
  }

  private handleInput(eventValue: Event): void {
    this.state.inputValue.set((eventValue.currentTarget as HTMLTextAreaElement).value);
  }

  private setInput(node: HTMLTextAreaElement | null): void {
    this.input = node;
    if (!node || !this.active) {
      this.destroyCodeEditor();
      return;
    }
    this.mountCodeEditor(node);
  }

  private setList(node: HTMLElement | null): void {
    this.list = node;
    if (node) this.renderRecords();
  }

  private mountCodeEditor(textarea: HTMLTextAreaElement): void {
    if (this.codeEditor || !textarea.parentElement) return;
    const host = ConsoleCodeEditorHost({ class: "roderuda-console-codemirror" }) as HTMLElement;
    textarea.before(host);
    textarea.hidden = true;
    this.codeEditorHost = host;
    this.codeEditor = mountCodeEditor({
      parent: host,
      value: this.state.inputValue.peek(),
      language: "javascript",
      dark: this.context?.root.classList.contains("roderuda-dark") ?? true,
      completions: (context) => consoleCompletions(context),
      onChange: (value) => {
        this.state.inputValue.set(value);
        textarea.value = value;
      },
      onRun: () => { void this.executeInput(); },
      activateCompletionOnTyping: false,
    });
  }

  private destroyCodeEditor(): void {
    this.codeEditor?.destroy();
    this.codeEditor = null;
    this.codeEditorHost?.remove();
    this.codeEditorHost = null;
    if (this.input) this.input.hidden = false;
  }

  private handleInputFocus(): void {
    const value = this.state.inputValue.peek();
    if (value.includes("\n") || value.length > 80) this.expandEditor(true);
  }

  private handleInputKey(eventValue: KeyboardEvent): void {
    const value = this.state.inputValue.peek();
    if (eventValue.key === "Enter" && !eventValue.shiftKey && !eventValue.altKey && !eventValue.ctrlKey && !eventValue.metaKey) {
      eventValue.preventDefault();
      void this.executeInput();
      return;
    }
    if ((eventValue.metaKey || eventValue.ctrlKey) && eventValue.key === "Enter") {
      eventValue.preventDefault();
      void this.executeInput();
      return;
    }
    if (eventValue.key === "ArrowUp" && !value.includes("\n")) {
      eventValue.preventDefault();
      const nextIndex = Math.max(0, this.state.historyIndex.peek() - 1);
      this.state.patch({ historyIndex: nextIndex, inputValue: this.state.history.peek()[nextIndex] ?? "" }, { cause: "console:history-up" });
      this.syncDom();
      flushSync();
      return;
    }
    if (eventValue.key === "ArrowDown" && !value.includes("\n")) {
      eventValue.preventDefault();
      const nextIndex = Math.min(this.state.history.peek().length, this.state.historyIndex.peek() + 1);
      this.state.patch({ historyIndex: nextIndex, inputValue: this.state.history.peek()[nextIndex] ?? "" }, { cause: "console:history-down" });
      this.syncDom();
      flushSync();
      return;
    }
    if (eventValue.key === "Escape") this.expandEditor(false);
    if (eventValue.key === "Enter" && eventValue.shiftKey) this.expandEditor(true);
  }

  private async executeInput(): Promise<void> {
    const code = this.state.inputValue.peek().trim();
    if (!code) return;
    const history = appendHistory(this.state.history.peek(), code, this.config.get("historyLimit"));
    writeHistory(history, this.config.get("historyLimit"));
    this.state.patch({ history, historyIndex: history.length, inputValue: "", editorExpanded: false }, { cause: "console:execute" });
    this.syncDom();
    flushSync();
    this.capture.record("command", [code]);
    try {
      const result = await executeJavaScript(code, { $_: this.state.lastResult.peek(), $0: this.selectedRecord()?.args[0], devtools: this.context?.devtools, globals: this.capture.getGlobals() });
      this.state.lastResult.set(result);
      this.capture.record("result", [result]);
    } catch (error) {
      this.capture.record("error", [error]);
    }
    this.syncDom();
    flushSync();
  }

  private expandEditor(expanded: boolean): void {
    this.state.setPath("editorExpanded", expanded);
    this.syncDom();
    flushSync();
    if (expanded) queueMicrotask(() => this.input?.focus());
  }

  private clearEditor(): void {
    this.state.inputValue.set("");
    this.syncDom();
    flushSync();
    this.input?.focus();
  }

  private selectedRecord(): ConsoleRecord | null {
    const id = this.state.selectedRecordId.peek();
    return id == null ? null : this.state.records.peek().find((record) => record.id === id) ?? null;
  }

  private async copyVisibleRecords(): Promise<void> {
    await copyText(this.visibleRecords().map((record) => record.args.map(plainText).join(" ")).join("\n"));
    this.context?.notify("Console copied", { type: "success" });
  }

  private scheduleDomSync(scrollAfterRender = false): void {
    this.scrollAfterRender ||= scrollAfterRender;
    if (this.renderFrame || !this.active) return;

    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = 0;
      if (!this.active) return;
      this.syncDom();
      flushSync();
      if (this.scrollAfterRender) this.scrollToBottom();
      this.scrollAfterRender = false;
    });
  }

  private cancelScheduledRender(): void {
    if (this.renderFrame) cancelAnimationFrame(this.renderFrame);
    this.renderFrame = 0;
    this.scrollAfterRender = false;
  }

  private syncDom(): void {
    const wrap = this.container?.querySelector<HTMLElement>("[data-console-input-wrap]");
    if (wrap) {
      wrap.dataset.jsExecution = String(this.state.jsExecution.peek());
      wrap.dataset.expanded = String(this.state.editorExpanded.peek());
    }
    if (this.input && this.input.value !== this.state.inputValue.peek()) this.input.value = this.state.inputValue.peek();
    if (this.codeEditor && this.codeEditor.getValue() !== this.state.inputValue.peek()) this.codeEditor.setValue(this.state.inputValue.peek());
    for (const button of Array.from(this.container?.querySelectorAll<HTMLButtonElement>("[data-level]") ?? [])) {
      const enabled = this.state.enabledLevels.peek().includes(button.dataset.level as ConsoleLevel);
      button.dataset.active = String(enabled);
      button.setAttribute("aria-pressed", String(enabled));
    }
    this.renderRecords();
  }

  private renderRecords(): void {
    if (!this.list) return;
    this.list.replaceChildren();
    const records = this.visibleRecords();
    if (!records.length) {
      const empty = document.createElement("span");
      empty.className = "roderuda-visually-hidden";
      empty.textContent = "No console records";
      this.list.append(empty);
      return;
    }
    for (const record of records) this.list.append(renderRecord(record, this.state.displayExtraInfo.peek()));
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (this.body) this.body.scrollTop = this.body.scrollHeight;
    });
  }
}

function renderRecord(record: ConsoleRecord, displayExtraInfo: boolean): HTMLElement {
  const row = ConsoleRow({
    "data-level": record.level,
    "data-record-id": String(record.id),
    style: `--rd-console-depth: ${record.groupDepth}`,
  }) as HTMLElement;

  if ((record.repeat ?? 1) > 1) row.append(ConsoleRepeat({ children: String(record.repeat ?? 1) }) as Node);
  if (record.collapsed != null) row.append(ConsoleGroup({ children: record.collapsed ? "▸" : "▾" }) as Node);

  const output = document.createElement("div");
  output.className = "roderuda-console-output";

  if (record.level === "table") {
    output.append(renderTable(record.args[0]));
  } else {
    appendFormattedConsoleArgs(output, record.args);
  }

  row.append(output);

  if (record.stack) {
    const stack = ConsoleStack() as HTMLElement;
    stack.textContent = record.stack;
    row.append(stack);
  }

  if (displayExtraInfo) row.append(ConsoleTime({ children: new Date(record.timestamp).toLocaleTimeString() }) as Node);
  row.dataset.expanded = "false";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-expanded", "false");

  const toggle = (): void => {
    const expanded = row.dataset.expanded !== "true";
    row.dataset.expanded = String(expanded);
    row.setAttribute("aria-expanded", String(expanded));
  };

  row.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("details,summary,a,button,input,textarea,select")) return;
    toggle();
  });
  row.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
  return row;
}

function appendFormattedConsoleArgs(container: HTMLElement, args: readonly unknown[]): void {
  if (!args.length) return;
  const [first, ...rest] = args;

  if (typeof first !== "string" || !/%[sdifoOc%]/.test(first)) {
    appendInspectableValue(container, first);
    for (const value of rest) {
      container.append(document.createTextNode(" "));
      appendInspectableValue(container, value);
    }
    return;
  }

  let argIndex = 0;
  let activeStyle = "";
  const parts = first.split(/(%[sdifoOc%])/g).filter(Boolean);

  for (const part of parts) {
    if (!part.startsWith("%") || part === "%%") {
      const text = part === "%%" ? "%" : part;
      const span = document.createElement("span");
      span.textContent = text;
      if (activeStyle) span.setAttribute("style", activeStyle);
      container.append(span);
      continue;
    }

    const value = rest[argIndex++];
    if (part === "%c") {
      activeStyle = typeof value === "string" ? sanitizeConsoleStyle(value) : "";
      continue;
    }
    if (part === "%s") container.append(document.createTextNode(String(value)));
    else if (part === "%d" || part === "%i") container.append(document.createTextNode(String(Number.parseInt(String(value), 10))));
    else if (part === "%f") container.append(document.createTextNode(String(Number.parseFloat(String(value)))));
    else appendInspectableValue(container, value);
  }

  for (; argIndex < rest.length; argIndex += 1) {
    container.append(document.createTextNode(" "));
    appendInspectableValue(container, rest[argIndex]);
  }
}

function appendInspectableValue(container: HTMLElement, value: unknown): void {
  container.append(renderValue(value, {
    maxDepth: 12,
    maxEntries: 2_000,
    onNodeSelect: (node) => {
      node.dispatchEvent(new CustomEvent("roderuda:inspect-node", { bubbles: true, composed: true, detail: node }));
    },
  }));
}

function sanitizeConsoleStyle(value: string): string {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => /^(color|background(?:-color)?|font(?:-weight|-style)?|text-decoration|border(?:-color)?|padding|margin)/i.test(entry))
    .join(";");
}

function renderTable(value: unknown): HTMLElement {
  const wrap = ConsoleTableWrap() as HTMLElement;
  const data = normalizeTable(value);
  if (!data.rows.length) {
    wrap.textContent = plainText(value);
    return wrap;
  }
  const table = ConsoleTable() as HTMLTableElement;
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const column of data.columns) {
    const th = ConsoleTableHead() as HTMLTableCellElement;
    th.textContent = column;
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  for (const row of data.rows) {
    const tr = document.createElement("tr");
    for (const column of data.columns) {
      const td = ConsoleTableCell() as HTMLTableCellElement;
      td.textContent = stringifyCell(row[column]);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function stringifyCell(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return safeStringify(value, 0);
}

function normalizeVisibleLevel(level: ConsoleLevel): ConsoleLevel {
  if (level === "trace") return "debug";
  return level === "command" || level === "result" || level === "html" || level === "table" || level === "dir" ? "log" : level;
}

function sameRecord(left: ConsoleRecord, right: ConsoleRecord): boolean {
  if (left.level !== right.level || left.groupDepth !== right.groupDepth || left.args.length !== right.args.length) return false;
  return left.args.every((value, index) => Object.is(value, right.args[index]));
}

function normalizeTable(value: unknown): { columns: string[]; rows: Array<Record<string, unknown>> } {
  if (Array.isArray(value)) {
    const rows = value.map((item, index) => item && typeof item === "object" ? { "(index)": index, ...(item as Record<string, unknown>) } : { "(index)": index, Value: item });
    return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  if (value && typeof value === "object") {
    const rows = Object.entries(value).map(([key, item]) => item && typeof item === "object" ? { "(index)": key, ...(item as Record<string, unknown>) } : { "(index)": key, Value: item });
    return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  return { columns: [], rows: [] };
}

async function executeJavaScript(code: string, context: { $_: unknown; $0: unknown; devtools: unknown; globals: ReadonlyMap<string, unknown> }): Promise<unknown> {
  const queryOne = (selector: string, root: ParentNode = document) => root.querySelector(selector);
  const queryAll = (selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll(selector));
  const names = ["$_", "$0", "$", "$$", "devtools", ...context.globals.keys()];
  const values = [context.$_, context.$0, queryOne, queryAll, context.devtools, ...context.globals.values()];
  const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor as new (...args: string[]) => (...functionValues: unknown[]) => Promise<unknown>;
  try {
    const expression = new AsyncFunction(...names, `"use strict"; return await (${code});`);
    return await expression(...values);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const statements = new AsyncFunction(...names, `"use strict"; ${code}`);
    return await statements(...values);
  }
}

function readHistory(limit: number): string[] {
  try {
    const value = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-Math.max(0, limit)) : [];
  } catch {
    return [];
  }
}

function writeHistory(history: readonly string[], limit: number): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limit <= 0 ? [] : history.slice(-limit)));
  } catch {}
}

function appendHistory(history: readonly string[], code: string, limit: number): string[] {
  const trimmed = code.trim();
  if (!trimmed) return [...history];
  const next = history.at(-1) === trimmed ? [...history] : [...history, trimmed];
  return limit <= 0 ? [] : next.slice(-limit);
}

function consoleCompletions(context: { 
    matchBefore(pattern: RegExp): { from: number; text: string } | null }
    ): { from: number; options: Array<{ label: string; type?: string; detail?: string }> } | null {
  const options = new Map<string, { label: string; type?: string; detail?: string }>();
  const word = context.matchBefore(/[$\w.]+$/);
  
  if (!word) return null;
  
  const add = (label: string, type = "variable", detail = "") => { if (label) options.set(label, { label, type, detail }); };
  for (const label of ["$", "$$", "$0", "$_", "window", "document", "console", "localStorage", "sessionStorage", "devtools"]) { 
    add(label, "variable"); 
  }

  const dot = word.text.lastIndexOf(".");
 
  if (dot >= 0) {
    const rootName = word.text.slice(0, dot);
    const prefix = word.text.slice(dot + 1);
    const root = resolveCompletionRoot(rootName);
   
    if (root) {
      for (const key of collectPropertyNames(root, prefix)) add(key, "property", rootName);
      return { from: word.from + dot + 1, options: [...options.values()].filter((item) => item.label.startsWith(prefix)).slice(0, 100) };
    }
  }

  return { from: word.from, options: [...options.values()].filter((item) => item.label.startsWith(word.text)).slice(0, 100) };
}

function resolveCompletionRoot(name: string): unknown {
  if (name === "window") return window;
  if (name === "document") return document;
  if (name === "console") return console;
  if (name === "localStorage") return localStorage;
  if (name === "sessionStorage") return sessionStorage;
  return undefined;
}

function collectPropertyNames(value: unknown, prefix: string): string[] {
  const names = new Set<string>();
  let current = value;
  let depth = 0;
  while (current && depth < 4) {
    try {
      for (const name of Object.getOwnPropertyNames(current)) if (!prefix || name.startsWith(prefix)) names.add(name);
    } catch {}
    current = Object.getPrototypeOf(current);
    depth += 1;
  }
  return [...names].sort();
}

function isInitialConsoleEntry(value: unknown): value is { level?: ConsoleLevel; args?: readonly unknown[]; message?: unknown; timestamp?: number; stack?: string } {
  return value !== null && typeof value === "object" && !(value instanceof Error) && ("args" in value || "message" in value || "level" in value);
}
