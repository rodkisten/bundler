import { ConfigStore } from "../core/config";
import { ConsoleCapture } from "../core/console-capture";
import { copyText, create, delegate, formatTime, icon, qs } from "../core/dom";
import { plainText, renderValue } from "../core/serialize";
import { Tool } from "../tool";
import type { ConsoleLevel, ConsoleRecord, ToolContext } from "../types";

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

const visibleLevels: readonly ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];

export class Console extends Tool {
  readonly name: string;
  readonly title = "console";
  readonly icon = "⌘";
  readonly config: ConfigStore<ConsoleConfig>;
  private readonly capture = new ConsoleCapture();
  private records: ConsoleRecord[] = [];
  private enabledLevels = new Set<ConsoleLevel>(visibleLevels);
  private filterValue: Filter = null;
  private body: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private input: HTMLTextAreaElement | null = null;
  private inputWrap: HTMLElement | null = null;
  private cleanup: Array<() => void> = [];
  private history: string[] = [];
  private historyIndex = 0;
  private lastResult: unknown;
  private selectedRecord: ConsoleRecord | null = null;
  private renderQueued = false;

  constructor({ name = "console" }: { name?: string } = {}) {
    super();
    this.name = name;
    this.config = new ConfigStore(`console:${name}`, {
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
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    container.innerHTML = `
      <div class="roderuda-console roderuda-scroll roderuda-with-control" data-console-body>
        <div class="roderuda-control">
          <button class="roderuda-icon-btn" type="button" data-action="clear" title="Clear">${icon("clear")}</button>
          <div class="roderuda-console-levels">
            ${visibleLevels.map((level) => `<button class="roderuda-console-level roderuda-active" type="button" data-level="${level}">${level}</button>`).join("")}
          </div>
          <div class="roderuda-control-spacer"></div>
          <input class="roderuda-search" data-console-filter type="search" placeholder="Filter" aria-label="Filter console">
          <button class="roderuda-icon-btn" type="button" data-action="copy" title="Copy console">${icon("copy")}</button>
        </div>
        <div class="roderuda-console-list" data-console-list></div>
      </div>
      <div class="roderuda-console-input-wrap" data-console-input-wrap>
        <span class="roderuda-console-prompt">›</span>
        <textarea class="roderuda-console-input" data-console-input rows="1" spellcheck="false" autocomplete="off" aria-label="JavaScript console"></textarea>
        <div class="roderuda-console-editor-actions">
          <button type="button" data-action="cancel-editor">Cancel</button>
          <button type="button" data-action="clear-editor">Clear</button>
          <button type="button" data-action="run-editor">Run</button>
        </div>
      </div>
    `;
    this.body = qs(container, "[data-console-body]");
    this.list = qs(container, "[data-console-list]");
    this.input = qs(container, "[data-console-input]");
    this.inputWrap = qs(container, "[data-console-input-wrap]");

    this.cleanup.push(delegate(container, "click", "[data-action]", (event, element) => this.handleAction(event, element)));
    this.cleanup.push(delegate(container, "click", "[data-level]", (_event, element) => this.toggleLevel(element)));
    this.cleanup.push(delegate(container, "click", ".roderuda-console-row", (_event, element) => this.selectRecord(element)));
    this.cleanup.push(this.listen(qs<HTMLInputElement>(container, "[data-console-filter]"), "input", (event) => {
      this.filter((event.target as HTMLInputElement).value);
    }));
    this.cleanup.push(this.listen(this.input, "keydown", (event) => this.handleInputKey(event as KeyboardEvent)));
    this.cleanup.push(this.listen(this.input, "focus", () => {
      if (this.input?.value.includes("\n") || (this.input?.value.length ?? 0) > 80) this.expandEditor(true);
    }));

    this.capture.on("record", this.onRecord);
    this.capture.on("clear", this.onClear);
    this.capture.install({ overrideConsole: this.config.get("overrideConsole"), catchGlobalErrors: this.config.get("catchGlobalErr") });
    this.config.on("change", this.onConfigChange);
    this.registerSettings(context);
    this.applyConfig();
  }

  log(...args: unknown[]): void { this.capture.record("log", args); }
  debug(...args: unknown[]): void { this.capture.record("debug", args); }
  info(...args: unknown[]): void { this.capture.record("info", args); }
  warn(...args: unknown[]): void { this.capture.record("warn", args); }
  error(...args: unknown[]): void { this.capture.record("error", args); }
  dir(...args: unknown[]): void { this.capture.record("dir", args); }
  table(...args: unknown[]): void { this.capture.record("table", args); }
  html(html: string): void { this.capture.record("html", [html]); }
  clear(): void { this.capture.clear(); }
  setGlobal(name: string, value: unknown): void { this.capture.setGlobal(name, value); }
  overrideConsole(): this { this.capture.overrideConsole(); return this; }
  restoreConsole(): this { this.capture.restoreConsole(); return this; }
  catchGlobalErr(): this { this.capture.enableGlobalErrors(); return this; }
  ignoreGlobalErr(): this { this.capture.disableGlobalErrors(); return this; }

  filter(filter: Filter): void {
    this.filterValue = typeof filter === "string" && !filter.trim() ? null : filter;
    this.render();
  }

  override show(): void {
    super.show();
    queueMicrotask(() => this.scrollToBottom());
  }

  override destroy(): void {
    this.capture.off("record", this.onRecord);
    this.capture.off("clear", this.onClear);
    this.capture.destroy();
    this.config.off("change", this.onConfigChange);
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.records = [];
    super.destroy();
  }

  private readonly onRecord = (record: ConsoleRecord): void => {
    const last = this.records.at(-1);
    if (last && sameRecord(last, record)) {
      last.repeat = (last.repeat ?? 1) + 1;
      last.timestamp = record.timestamp;
    } else {
      this.records.push(record);
    }
    this.trimRecords();
    if (this.config.get("asyncRender")) this.scheduleRender();
    else this.render();
    if (record.level === "error" && this.config.get("displayIfErr")) {
      this.context?.devtools.show().showTool(this.name);
    }
  };

  private readonly onClear = (): void => {
    this.records = [];
    this.selectedRecord = null;
    this.render();
  };

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "overrideConsole") value ? this.capture.overrideConsole() : this.capture.restoreConsole();
    if (key === "catchGlobalErr") value ? this.capture.enableGlobalErrors() : this.capture.disableGlobalErrors();
    if (key === "jsExecution") this.applyConfig();
    if (key === "maxLogNum") {
      this.trimRecords();
      this.render();
    }
  };

  private applyConfig(): void {
    this.inputWrap?.classList.toggle("roderuda-hidden", !this.config.get("jsExecution"));
    this.body?.style.setProperty("padding-bottom", this.config.get("jsExecution") ? "calc(25px + var(--rd-safe-bottom))" : "0");
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

  private render(): void {
    if (!this.list) return;
    const fragment = document.createDocumentFragment();
    for (const record of this.records) {
      if (!this.matches(record)) continue;
      fragment.append(this.renderRecord(record));
    }
    this.list.replaceChildren(fragment);
    this.scrollToBottom();
  }

  private renderRecord(record: ConsoleRecord): HTMLElement {
    const row = create("div", {
      className: "roderuda-console-row",
      attrs: {
        "data-level": record.level,
        "data-record-id": record.id,
        style: `padding-left:${9 + record.groupDepth * 14}px`,
      },
    });
    if (record.repeat && record.repeat > 1) row.append(create("span", { className: "roderuda-console-repeat", text: String(record.repeat) }));
    if (record.collapsed != null) row.append(create("span", { className: "roderuda-console-group", text: record.collapsed ? "▸" : "▾" }));

    if (record.level === "html") {
      const content = create("span");
      content.innerHTML = String(record.args[0] ?? "");
      row.append(content);
    } else if (record.level === "table") {
      row.append(this.renderTable(record.args[0]));
    } else {
      record.args.forEach((argument, index) => {
        if (index > 0) row.append(document.createTextNode(" "));
        row.append(renderValue(argument, {
          maxDepth: this.config.get("lazyEvaluation") ? 4 : 2,
          maxEntries: this.config.get("displayUnenumerable") ? 100 : 50,
          onNodeSelect: (node) => {
            if (node instanceof Element) {
              this.context?.devtools.get<{ select(node: Element): void } & Tool>("elements")?.select(node);
              this.context?.devtools.showTool("elements");
            }
          },
        }));
      });
    }

    if (this.config.get("displayExtraInfo")) row.append(create("time", { className: "roderuda-console-time", text: formatTime(record.timestamp) }));
    return row;
  }

  private renderTable(value: unknown): HTMLElement {
    const wrapper = create("div", { className: "roderuda-table-wrap" });
    const table = create("table", { className: "roderuda-table" });
    const data = normalizeTable(value);
    if (!data.rows.length) {
      wrapper.append(renderValue(value));
      return wrapper;
    }
    const thead = create("thead");
    const headRow = create("tr");
    for (const column of data.columns) headRow.append(create("th", { text: column }));
    thead.append(headRow);
    const tbody = create("tbody");
    for (const item of data.rows) {
      const row = create("tr");
      for (const column of data.columns) {
        const cell = create("td");
        cell.append(renderValue(item[column], { maxDepth: 2, maxEntries: 20 }));
        row.append(cell);
      }
      tbody.append(row);
    }
    table.append(thead, tbody);
    wrapper.append(table);
    return wrapper;
  }

  private matches(record: ConsoleRecord): boolean {
    const level = record.level === "command" || record.level === "result" || record.level === "html" || record.level === "table" || record.level === "dir"
      ? "log"
      : record.level;
    if (!this.enabledLevels.has(level)) return false;
    if (!this.filterValue) return true;
    if (typeof this.filterValue === "function") return this.filterValue(record);
    const text = record.args.map(plainText).join(" ");
    if (this.filterValue instanceof RegExp) {
      this.filterValue.lastIndex = 0;
      return this.filterValue.test(text);
    }
    return text.toLowerCase().includes(this.filterValue.toLowerCase());
  }

  private scheduleRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    queueMicrotask(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private trimRecords(): void {
    const value = this.config.get("maxLogNum");
    const max = value === "infinite" ? 0 : Number(value);
    if (max > 0 && this.records.length > max) this.records.splice(0, this.records.length - max);
  }

  private toggleLevel(element: HTMLElement): void {
    const level = element.dataset.level as ConsoleLevel;
    if (this.enabledLevels.has(level)) this.enabledLevels.delete(level);
    else this.enabledLevels.add(level);
    element.classList.toggle("roderuda-active", this.enabledLevels.has(level));
    this.render();
  }

  private selectRecord(element: HTMLElement): void {
    const id = Number(element.dataset.recordId);
    this.selectedRecord = this.records.find((record) => record.id === id) ?? null;
  }

  private handleAction(event: Event, element: HTMLElement): void {
    event.preventDefault();
    switch (element.dataset.action) {
      case "clear":
        this.clear();
        break;
      case "copy":
        void copyText(this.records.filter((record) => this.matches(record)).map((record) => record.args.map(plainText).join(" ")).join("\n"))
          .then(() => this.context?.notify("Console copied", { type: "success" }));
        break;
      case "cancel-editor":
        this.expandEditor(false);
        break;
      case "clear-editor":
        if (this.input) this.input.value = "";
        break;
      case "run-editor":
        void this.executeInput();
        break;
    }
  }

  private handleInputKey(event: KeyboardEvent): void {
    if (!this.input) return;
    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      void this.executeInput();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void this.executeInput();
      return;
    }
    if (event.key === "ArrowUp" && !this.input.value.includes("\n")) {
      event.preventDefault();
      this.historyIndex = Math.max(0, this.historyIndex - 1);
      this.input.value = this.history[this.historyIndex] ?? "";
    } else if (event.key === "ArrowDown" && !this.input.value.includes("\n")) {
      event.preventDefault();
      this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
      this.input.value = this.history[this.historyIndex] ?? "";
    } else if (event.key === "Escape") {
      this.expandEditor(false);
    } else if (event.key === "Enter" && event.shiftKey) {
      this.expandEditor(true);
    }
  }

  private async executeInput(): Promise<void> {
    const code = this.input?.value.trim();
    if (!code || !this.input) return;
    this.history.push(code);
    this.historyIndex = this.history.length;
    this.capture.record("command", [code]);
    this.input.value = "";
    this.expandEditor(false);

    try {
      const result = await executeJavaScript(code, {
        $_: this.lastResult,
        $0: this.selectedRecord?.args[0],
        devtools: this.context?.devtools,
        globals: this.capture.getGlobals(),
      });
      this.lastResult = result;
      this.capture.record("result", [result]);
    } catch (error) {
      this.capture.record("error", [error]);
    }
  }

  private expandEditor(expanded: boolean): void {
    this.inputWrap?.classList.toggle("roderuda-expanded", expanded);
    if (expanded) this.input?.focus();
  }

  private scrollToBottom(): void {
    if (!this.body) return;
    requestAnimationFrame(() => {
      if (!this.body) return;
      this.body.scrollTop = this.body.scrollHeight;
    });
  }

  private listen(target: EventTarget, type: string, listener: EventListener): () => void {
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  }
}

function sameRecord(left: ConsoleRecord, right: ConsoleRecord): boolean {
  if (left.level !== right.level || left.groupDepth !== right.groupDepth || left.args.length !== right.args.length) return false;
  return left.args.every((value, index) => Object.is(value, right.args[index]));
}

function normalizeTable(value: unknown): { columns: string[]; rows: Array<Record<string, unknown>> } {
  if (Array.isArray(value)) {
    const rows = value.map((item, index) => {
      if (item && typeof item === "object") return { "(index)": index, ...(item as Record<string, unknown>) };
      return { "(index)": index, Value: item };
    });
    return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  if (value && typeof value === "object") {
    const rows = Object.entries(value).map(([key, item]) => item && typeof item === "object"
      ? { "(index)": key, ...(item as Record<string, unknown>) }
      : { "(index)": key, Value: item });
    return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  return { columns: [], rows: [] };
}

async function executeJavaScript(
  code: string,
  context: { $_: unknown; $0: unknown; devtools: unknown; globals: ReadonlyMap<string, unknown> },
): Promise<unknown> {
  const names = ["$_", "$0", "devtools", ...context.globals.keys()];
  const values = [context.$_, context.$0, context.devtools, ...context.globals.values()];
  const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor as new (...args: string[]) => (...values: unknown[]) => Promise<unknown>;
  try {
    const expression = new AsyncFunction(...names, `"use strict"; return await (${code});`);
    return await expression(...values);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const statements = new AsyncFunction(...names, `"use strict"; ${code}`);
    return await statements(...values);
  }
}
