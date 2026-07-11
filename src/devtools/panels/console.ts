import { flushSync, store } from "../../broto";
import { html, render } from "../components/runtime";
import { ConfigStore } from "../core/config";
import { ConsoleCapture } from "../core/console-capture";
import { mountCodeEditor, type CodeEditorHandle } from "../core/code-editor";
import { copyText, icon, safeStringify } from "../utils";
import { plainText } from "../core/serialize";
import { Tool } from "../tool";
import type { ConsoleLevel, ConsoleRecord, ToolContext } from "../types";
import {
  ConsoleCodeEditorHost,
  ConsoleGroup,
  ConsoleRepeat,
  ConsoleRow,
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

interface ConsoleConfig {
  asyncRender: boolean;
  jsExecution: boolean;
  catchGlobalErr: boolean;
  overrideConsole: boolean;
  displayExtraInfo: boolean;
  displayUnenumerable: boolean;
  displayGetterVal: boolean;
  lazyEvaluation: boolean;
  displayIfErr: boolean;
  maxLogNum: string;
}

type Filter = string | RegExp | ((record: ConsoleRecord) => boolean) | null;

const DEFAULT_CONSOLE_CONFIG: Readonly<ConsoleConfig> = Object.freeze({
  asyncRender: true,
  jsExecution: true,
  catchGlobalErr: true,
  overrideConsole: true,
  displayExtraInfo: false,
  displayUnenumerable: true,
  displayGetterVal: false,
  lazyEvaluation: true,
  displayIfErr: true,
  maxLogNum: "250",
});

const HISTORY_STORAGE_KEY = "roderuda:console-history";
const HISTORY_LIMIT = 100;
const sharedCapture = new ConsoleCapture();

try {
  sharedCapture.install({ overrideConsole: true, catchGlobalErrors: true });
} catch {}

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
  private restoreCaptureRecord: (() => void) | null = null;

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
    this.patchCaptureRecord();
    this.hydrateCapturedRecords();
    this.hydrateHistory();

    try {
      this.capture.install({
        overrideConsole: true,
        catchGlobalErrors: true,
        watchdog: true,
        watchdogMs: 1000,
        lockConsole: false,
        patchPrototype: false,
      });
    } catch (error) {
      context.notify(`Console capture fallback: ${error instanceof Error ? error.message : String(error)}`, { type: "warning", duration: 5000 });
    }

    this.config.on("change", this.onConfigChange);
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

  filter(filter: Filter): void {
    this.state.patch({
      filterValue: typeof filter === "string" && !filter.trim() ? null : filter,
      filterText: typeof filter === "string" ? filter : "",
    }, { cause: "console:filter" });
    this.syncDom();
    flushSync();
  }

  override show(): void {
    super.show();
    queueMicrotask(() => this.scrollToBottom());
  }

  override destroy(): void {
    this.capture.off("record", this.onRecord);
    this.capture.off("clear", this.onClear);
    this.restoreCaptureRecord?.();
    this.restoreCaptureRecord = null;
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
    const history = readHistory();
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
    this.syncDom();
    if (!this.config.get("asyncRender")) flushSync();
    this.scrollToBottom();
    if (record.level === "error" && this.config.get("displayIfErr")) this.context?.devtools.show().showTool(this.name);
  };

  private patchCaptureRecord(): void {
    if (this.restoreCaptureRecord) return;
    const capture = this.capture;
    const original = capture.record.bind(capture);
    capture.record = ((level: ConsoleLevel, args: unknown[], extra: Partial<ConsoleRecord> = {}) => {
      const record = original(level, args, extra);
      if (!this.state.records.peek().some((candidate) => candidate.id === record.id)) this.onRecord(record);
      return record;
    }) as ConsoleCapture["record"];
    this.restoreCaptureRecord = () => {
      if (capture.record !== original) capture.record = original as ConsoleCapture["record"];
    };
  }

  private readonly onClear = (): void => {
    this.state.patch({ records: [], selectedRecordId: null }, { cause: "console:clear" });
    this.syncDom();
    flushSync();
  };

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "overrideConsole" && value) this.capture.forceIntercept();
    if (key === "catchGlobalErr") value ? this.capture.enableGlobalErrors() : this.capture.disableGlobalErrors();
    if (key === "jsExecution" || key === "displayExtraInfo" || key === "displayUnenumerable" || key === "lazyEvaluation") {
      this.syncConfigState();
      this.syncDom();
      flushSync();
    }
    if (key === "maxLogNum") {
      this.trimRecords();
      this.syncDom();
      flushSync();
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
    const settings = context.settings;
    settings.registerSeparator();
    settings.registerText("Console");
    settings.registerSwitch(this.config, "asyncRender", "Asynchronous rendering");
    settings.registerSwitch(this.config, "jsExecution", "Enable JavaScript execution");
    settings.registerSwitch(this.config, "catchGlobalErr", "Catch global errors");
    settings.registerSwitch(this.config, "overrideConsole", "Override window.console");
    settings.registerSwitch(this.config, "displayExtraInfo", "Display timestamps and extra information");
    settings.registerSwitch(this.config, "displayUnenumerable", "Display non-enumerable properties");
    settings.registerSwitch(this.config, "displayGetterVal", "Read getter values");
    settings.registerSwitch(this.config, "lazyEvaluation", "Lazy object evaluation");
    settings.registerSwitch(this.config, "displayIfErr", "Open Console when an error occurs");
    settings.registerSelect(this.config, "maxLogNum", "Maximum log count", ["infinite", "500", "250", "125", "100", "50", "10"]);
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
    if (!node) {
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
    });
  }

  private destroyCodeEditor(): void {
    this.codeEditor?.destroy();
    this.codeEditor = null;
    this.codeEditorHost?.remove();
    this.codeEditorHost = null;
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
    const history = appendHistory(this.state.history.peek(), code);
    writeHistory(history);
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
  if (record.level === "table") row.append(renderTable(record.args[0]));
  else row.append(document.createTextNode(record.args.map(plainText).join(" ")));
  if (displayExtraInfo) row.append(ConsoleTime({ children: new Date(record.timestamp).toLocaleTimeString() }) as Node);
  return row;
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

function readHistory(): string[] {
  try {
    const value = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeHistory(history: readonly string[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
  } catch {}
}

function appendHistory(history: readonly string[], code: string): string[] {
  const trimmed = code.trim();
  if (!trimmed) return [...history];
  const next = history.at(-1) === trimmed ? [...history] : [...history, trimmed];
  return next.slice(-HISTORY_LIMIT);
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
