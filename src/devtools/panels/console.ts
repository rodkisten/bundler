import { flushSync, store, type Store } from "../../broto";
import type { CipoCssArtifact } from "../../cipo";
import { component, event, html, ref, render, styled } from "../components/runtime";
import { ConfigStore } from "../core/config";
import { ConsoleCapture } from "../core/console-capture";
import { mountCodeEditor, type CodeEditorHandle } from "../core/code-editor";
import { copyText, formatTime, icon, safeStringify } from "../core/dom";
import { devtoolsTokens } from "../core/style";
import { plainText } from "../core/serialize";
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

interface ConsoleState extends Record<string, unknown> {
  records: ConsoleRecord[];
  filterValue: Filter;
  filterText: string;
  history: string[];
  historyIndex: number;
  selectedRecordId: number | null;
  enabledLevels: ConsoleLevel[];
  editorExpanded: boolean;
  inputValue: string;
  jsExecution: boolean;
  displayExtraInfo: boolean;
  displayUnenumerable: boolean;
  lazyEvaluation: boolean;
  lastResult: unknown;
}

interface ConsoleViewModel {
  readonly state: Store<ConsoleState>;
  setBody(node: HTMLElement | null): void;
  setList(node: HTMLElement | null): void;
  setInput(node: HTMLTextAreaElement | null): void;
  clear(): void;
  copy(): void;
  toggleLevel(level: ConsoleLevel): void;
  filter(value: string): void;
  handleInput(event: Event): void;
  handleInputKey(event: KeyboardEvent): void;
  handleInputFocus(): void;
  cancelEditor(): void;
  clearEditor(): void;
  runEditor(): void;
}

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

const visibleLevels: readonly ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];
const HISTORY_STORAGE_KEY = "roderuda:console-history";
const HISTORY_LIMIT = 100;
const sharedCapture = new ConsoleCapture();

try {
  sharedCapture.install({ overrideConsole: true, catchGlobalErrors: true });
} catch {}

void devtoolsTokens;

/* *************** */
/* Styled console  */
/* *************** */

const ConsoleSurface = styled.div("RodConsoleSurface").css`
  width: 100%;
  height: 100%;
  padding-bottom: calc(25px + env(safe-area-inset-bottom, 0px));
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: $background;

  &.roderuda-console-no-execution {
    padding-bottom: 0;
  }
`;

const ConsoleControl = styled.div("RodConsoleControl").css`
  position: absolute;
  inset: 0 0 auto 0;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  padding: 7px 8px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
`;

const ConsoleIconButton = styled.button("RodConsoleIconButton").css`
  appearance: none;
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  border: 0;
  border-radius: $control;
  color: $primary;
  background: transparent;
`;

const ConsoleLevels = styled.div("RodConsoleLevels").css`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const ConsoleLevelButton = styled.button("RodConsoleLevelButton").css`
  appearance: none;
  height: 24px;
  padding: 0 6px;
  border: 0;
  border-radius: $md;
  color: $foreground;
  background: transparent;

  &.roderuda-active {
    color: $selectedForeground;
    background: $highlight;
  }
`;

const ConsoleControlSpacer = styled.div("RodConsoleControlSpacer").css`
  flex: 1 1 auto;
`;

const ConsoleFilter = styled.input("RodConsoleFilter").css`
  min-width: 0;
  max-width: 260px;
  height: 27px;
  flex: 1 1 120px;
  padding: 4px 9px;
  border: 1px solid $border;
  border-radius: $section;
  color: $primary;
  background: $background;
`;

const ConsoleList = styled.div("RodConsoleList").css`
  font: 12px / 1.45 $font.mono;
  user-select: text;
`;

const ConsoleRow = styled.div("RodConsoleRow").css`
  position: relative;
  min-height: 25px;
  padding: 4px 35px 4px calc(9px + var(--rd-console-depth, 0) * 14px);
  border-bottom: 1px solid alpha($border / 65%);
  color: $foreground;
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  &[data-level="warn"] {
    color: $warningFg;
    border-color: $warningBorder;
    background: $warningBg;
  }

  &[data-level="error"] {
    color: $errorFg;
    border-color: $errorBorder;
    background: $errorBg;
  }

  &[data-level="command"] {
    color: $accent;
  }

  &[data-level="result"] {
    color: $primary;
  }
`;

const ConsoleRepeat = styled.span("RodConsoleRepeat").css`
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  margin-right: 5px;
  padding: 0 4px;
  border-radius: $pill;
  color: white;
  background: $accent;
  font: 10px / 1 $font.ui;
`;

const ConsoleGroup = styled.span("RodConsoleGroup").css`
  display: inline-block;
  width: 14px;
  color: $operator;
`;

const ConsoleTime = styled.time("RodConsoleTime").css`
  position: absolute;
  top: 5px;
  right: 7px;
  opacity: .55;
  font: 10px / 1.3 $font.ui;
`;

const ConsoleInputWrap = styled.div("RodConsoleInputWrap").css`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  align-items: stretch;
  height: calc(25px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid $border;
  background: $background;

  &.roderuda-hidden {
    display: none !important;
  }

  &.roderuda-expanded {
    top: 0;
    height: 100%;
    padding: 40px 0 calc(44px + env(safe-area-inset-bottom, 0px));
  }
`;

const ConsolePrompt = styled.span("RodConsolePrompt").css`
  display: grid;
  place-items: center;
  width: 25px;
  color: $accent;
  font: 700 15px / 1 $font.mono;
`;

const ConsoleInput = styled.textarea("RodConsoleInput").css`
  flex: 1;
  min-width: 0;
  padding: 3px 8px 3px 0;
  resize: none;
  outline: none;
  border: 0;
  color: $primary;
  background: transparent;
  font: 13px / 1.4 $font.mono;
`;

const ConsoleCodeEditorHost = styled.div("RodConsoleCodeEditorHost").css`
  flex: 1;
  min-width: 0;
  min-height: 100%;
  color: $primary;

  .cm-editor {
    height: 100%;
    background: transparent;
    outline: none;
  }

  .cm-content {
    padding: 3px 8px 3px 0;
  }
`;

const ConsoleEditorActions = styled.div("RodConsoleEditorActions").css`
  position: absolute;
  right: 0;
  bottom: env(safe-area-inset-bottom, 0px);
  left: 0;
  display: none;
  height: 44px;
  border-top: 1px solid $border;
  background: $backgroundDark;

  .roderuda-expanded & {
    display: flex;
  }
`;

const ConsoleEditorButton = styled.button("RodConsoleEditorButton").css`
  appearance: none;
  flex: 1;
  border: 0;
  border-right: 1px solid $border;
  color: $primary;
  background: transparent;
`;

const ConsoleTableWrap = styled.div("RodConsoleTableWrap").css`
  width: 100%;
  overflow: auto;
`;

const ConsoleTable = styled.table("RodConsoleTable").css`
  width: 100%;
  border-collapse: collapse;
  color: inherit;
  font: 12px / 1.4 $font.ui;
`;

const ConsoleTableHead = styled.th("RodConsoleTableHead").css`
  padding: 7px 9px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  text-align: left;
`;

const ConsoleTableCell = styled.td("RodConsoleTableCell").css`
  padding: 7px 9px;
  border-bottom: 1px solid $border;
  text-align: left;
`;

const CONSOLE_STYLED_COMPONENTS = Object.freeze([
  ConsoleSurface,
  ConsoleControl,
  ConsoleIconButton,
  ConsoleLevels,
  ConsoleLevelButton,
  ConsoleControlSpacer,
  ConsoleFilter,
  ConsoleList,
  ConsoleRow,
  ConsoleRepeat,
  ConsoleGroup,
  ConsoleTime,
  ConsoleInputWrap,
  ConsolePrompt,
  ConsoleInput,
  ConsoleCodeEditorHost,
  ConsoleEditorActions,
  ConsoleEditorButton,
  ConsoleTableWrap,
  ConsoleTable,
  ConsoleTableHead,
  ConsoleTableCell,
]);

export const consoleStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  CONSOLE_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodConsoleView", function RodConsoleView(props) {
  const view = props.view as ConsoleViewModel;
  return html`
    <RodConsoleSurface
      class=${() => [
        "roderuda-console",
        "roderuda-scroll",
        "roderuda-with-control",
        view.state.jsExecution() ? "" : "roderuda-console-no-execution",
      ].filter(Boolean).join(" ")}
      data-console-body
      data-roderuda-scroll-key="console"
      ref=${ref((node) => {
        view.setBody(node as HTMLElement);
        return () => view.setBody(null);
      })}
    >
      <RodConsoleControl class="roderuda-control">
        <RodConsoleIconButton class="roderuda-icon-btn" type="button" title="Clear" data-action="clear" @click=${event((click: Event) => { click.preventDefault(); view.clear(); })}>${icon("clear")}</RodConsoleIconButton>
        <RodConsoleLevels class="roderuda-console-levels" role="group" aria-label="Console levels">
          ${visibleLevels.map((level) => html`
            <RodConsoleLevelButton
              class=${() => view.state.enabledLevels().includes(level) ? "roderuda-console-level roderuda-active" : "roderuda-console-level"}
              type="button"
              data-level=${level}
              aria-pressed=${() => String(view.state.enabledLevels().includes(level))}
              @click=${event((levelEvent: Event) => { 
                levelEvent.preventDefault(); 
                view.toggleLevel(level); })}
            >
            ${level}
          </RodConsoleLevelButton>
          `)}
        </RodConsoleLevels>
        <RodConsoleControlSpacer class="roderuda-control-spacer" />
        <RodConsoleFilter class="roderuda-search" data-console-filter type="search" placeholder="Filter" aria-label="Filter console" .value=${() => view.state.filterText()} @input=${event((inputEvent: Event) => view.filter((inputEvent.currentTarget as HTMLInputElement).value))} />
        <RodConsoleIconButton class="roderuda-icon-btn" type="button" title="Copy console" data-action="copy" @click=${event((copyEvent: Event) => { copyEvent.preventDefault(); view.copy(); })}>${icon("copy")}</RodConsoleIconButton>
      </RodConsoleControl>
      <RodConsoleList class="roderuda-console-list" data-console-list ref=${ref((node) => {
        view.setList(node as HTMLElement);
        return () => view.setList(null);
      })}>
        <span class="roderuda-visually-hidden">No console records</span>
      </RodConsoleList>
    </RodConsoleSurface>
    <RodConsoleInputWrap class=${() => ["roderuda-console-input-wrap", view.state.jsExecution() ? "" : "roderuda-hidden", view.state.editorExpanded() ? "roderuda-expanded" : ""].filter(Boolean).join(" ")} data-console-input-wrap>
      <RodConsolePrompt class="roderuda-console-prompt">›</RodConsolePrompt>
      <RodConsoleInput
        class="roderuda-console-input"
        data-console-input
        rows="1"
        spellcheck="false"
        autocomplete="off"
        aria-label="JavaScript console"
        .value=${() => view.state.inputValue()}
        ref=${ref((node) => {
          view.setInput(node as HTMLTextAreaElement);
          return () => view.setInput(null);
        })}
        @input=${event((inputEvent: Event) => view.handleInput(inputEvent))}
        @keydown=${event<KeyboardEvent>((keyboardEvent) => view.handleInputKey(keyboardEvent))}
        @focus=${event(() => view.handleInputFocus())}
      />
      <RodConsoleEditorActions class="roderuda-console-editor-actions">
        <RodConsoleEditorButton type="button" data-action="cancel-editor" @click=${event(() => view.cancelEditor())}>Cancel</RodConsoleEditorButton>
        <RodConsoleEditorButton type="button" data-action="clear-editor" @click=${event(() => view.clearEditor())}>Clear</RodConsoleEditorButton>
        <RodConsoleEditorButton type="button" data-action="run-editor" @click=${event(() => view.runEditor())}>Run</RodConsoleEditorButton>
      </RodConsoleEditorActions>
    </RodConsoleInputWrap>
  `;
});

export class Console extends Tool {
  readonly name: string;
  readonly title = "console";
  readonly icon = "⌘";
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
      setList: (node) => { this.list = node; },
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
    this.capture.on("record", this.onRecord);
    this.capture.on("clear", this.onClear);
    this.hydrateCapturedRecords();
    this.hydrateHistory();

    try {
      this.capture.install({
        overrideConsole: this.config.get("overrideConsole"),
        catchGlobalErrors: this.config.get("catchGlobalErr"),
      });
      if (!this.config.get("overrideConsole")) this.capture.restoreConsole();
      if (!this.config.get("catchGlobalErr")) this.capture.disableGlobalErrors();
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

  private readonly onClear = (): void => {
    this.state.patch({ records: [], selectedRecordId: null }, { cause: "console:clear" });
    this.syncDom();
    flushSync();
  };

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "overrideConsole") value ? this.capture.overrideConsole() : this.capture.restoreConsole();
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
      wrap.classList.toggle("roderuda-hidden", !this.state.jsExecution.peek());
      wrap.classList.toggle("roderuda-expanded", this.state.editorExpanded.peek());
    }
    if (this.input && this.input.value !== this.state.inputValue.peek()) this.input.value = this.state.inputValue.peek();
    if (this.codeEditor && this.codeEditor.getValue() !== this.state.inputValue.peek()) this.codeEditor.setValue(this.state.inputValue.peek());
    for (const button of Array.from(this.container?.querySelectorAll<HTMLButtonElement>("[data-level]") ?? [])) {
      const enabled = this.state.enabledLevels.peek().includes(button.dataset.level as ConsoleLevel);
      button.classList.toggle("roderuda-active", enabled);
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
  const row = document.createElement("div");
  row.className = "roderuda-console-row";
  row.dataset.level = record.level;
  row.dataset.recordId = String(record.id);
  row.style.setProperty("--rd-console-depth", String(record.groupDepth));
  if ((record.repeat ?? 1) > 1) {
    const repeat = document.createElement("span");
    repeat.className = "roderuda-console-repeat";
    repeat.textContent = String(record.repeat ?? 1);
    row.append(repeat);
  }
  if (record.collapsed != null) {
    const group = document.createElement("span");
    group.className = "roderuda-console-group";
    group.textContent = record.collapsed ? "▸" : "▾";
    row.append(group);
  }
  if (record.level === "table") row.append(renderTable(record.args[0]));
  else row.append(document.createTextNode(record.args.map(plainText).join(" ")));
  if (displayExtraInfo) {
    const time = document.createElement("time");
    time.className = "roderuda-console-time";
    time.textContent = formatTime(record.timestamp);
    row.append(time);
  }
  return row;
}

function renderTable(value: unknown): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "roderuda-table-wrap";
  const data = normalizeTable(value);
  if (!data.rows.length) {
    wrap.textContent = plainText(value);
    return wrap;
  }
  const table = document.createElement("table");
  table.className = "roderuda-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const column of data.columns) {
    const th = document.createElement("th");
    th.textContent = column;
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  for (const row of data.rows) {
    const tr = document.createElement("tr");
    for (const column of data.columns) {
      const td = document.createElement("td");
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
