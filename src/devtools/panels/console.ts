import { computed, flushSync, store, type Signal, type Store } from "../../broto";
import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import {
  component,
  event,
  html,
  ref,
  render,
  repeat,
  styled,
  when,
} from "../components/runtime";
import { ConfigStore } from "../core/config";
import { ConsoleCapture } from "../core/console-capture";
import { copyText, formatTime, icon } from "../core/dom";
import { devtoolsTokens } from "../core/style";
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
  readonly visibleRecords: Signal<readonly ConsoleRecord[]>;
  setBody(node: HTMLElement | null): void;
  setInput(node: HTMLTextAreaElement | null): void;
  clear(): void;
  copy(): void;
  toggleLevel(level: ConsoleLevel): void;
  filter(value: string): void;
  selectRecord(id: number): void;
  handleInput(event: Event): void;
  handleInputKey(event: KeyboardEvent): void;
  handleInputFocus(): void;
  cancelEditor(): void;
  clearEditor(): void;
  runEditor(): void;
  selectNode(node: Node): void;
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

/*
 * Importing the configuration artifact before declaring styled components keeps
 * this isolated Devtools Fabrica instance on the same Cipó design-system
 * contract as the shell. The value itself is intentionally not rendered.
 */
void devtoolsTokens;

/* *************** */
/* Styled console  */
/* *************** */

const ConsoleSurface = styled.div("RodConsoleSurface").css`
  width: 100%;
  height: 100%;
  padding-bottom: calc(25px + var(--rd-safe-bottom));
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-color: $border transparent;
  background: $background;

  &.roderuda-console-no-execution {
    padding-bottom: 0;
  }
`;

const ConsoleControl = styled.div("RodConsoleControl").css`
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
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
  flex: 0 0 auto;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: $control;
  color: $primary;
  background: transparent;
  cursor: pointer;
  font-size: 17px;
  transition: color .18s, background .18s, transform .1s;

  &:hover {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    color: $accent;
    transform: scale(.94);
  }

  &:focus-visible {
    outline: 2px solid alpha($accent / 55%);
    outline-offset: 1px;
  }
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
  cursor: pointer;
  font-size: 11px;
  text-transform: capitalize;

  &:hover,
  &.roderuda-active {
    color: $selectedForeground;
    background: $highlight;
  }

  &:focus-visible {
    outline: 2px solid alpha($accent / 55%);
    outline-offset: 1px;
  }
`;

const ConsoleControlSpacer = styled.div("RodConsoleControlSpacer").css`
  flex: 1 1 auto;
  min-width: 4px;
`;

const ConsoleFilter = styled.input("RodConsoleFilter").css`
  min-width: 0;
  max-width: 260px;
  height: 27px;
  flex: 1 1 120px;
  padding: 4px 9px;
  border: 1px solid $border;
  border-radius: $section;
  outline: none;
  color: $primary;
  background: $background;
  user-select: text;

  &:focus {
    border-color: $accent;
    box-shadow: 0 0 0 2px alpha($accent / 18%);
  }
`;

const ConsoleList = styled.div("RodConsoleList").css`
  font: 12px / 1.45 $font.mono;
  user-select: text;
`;

const ConsoleRow = styled.div("RodConsoleRow").css`
  position: relative;
  min-height: 25px;
  padding-top: 4px;
  padding-right: 35px;
  padding-bottom: 4px;
  padding-left: calc(9px + var(--rd-console-depth, 0) * 14px);
  border-bottom: 1px solid alpha($border / 65%);
  color: $foreground;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
  cursor: default;

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

  &.roderuda-selected {
    outline: 1px solid alpha($accent / 45%);
    outline-offset: -1px;
    background: alpha($highlight / 70%);
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
  height: calc(25px + var(--rd-safe-bottom));
  padding-bottom: var(--rd-safe-bottom);
  border-top: 1px solid $border;
  background: $background;

  &.roderuda-hidden {
    display: none !important;
  }

  &.roderuda-expanded {
    top: 0;
    height: 100%;
    padding: 40px 0 calc(44px + var(--rd-safe-bottom));
  }
`;

const ConsolePrompt = styled.span("RodConsolePrompt").css`
  display: grid;
  place-items: center;
  width: 25px;
  color: $accent;
  font: 700 15px / 1 $font.mono;

  .roderuda-expanded & {
    display: none;
  }
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
  user-select: text;
  font: 13px / 1.4 $font.mono;

  .roderuda-expanded & {
    padding: 10px;
  }
`;

const ConsoleEditorActions = styled.div("RodConsoleEditorActions").css`
  position: absolute;
  right: 0;
  bottom: var(--rd-safe-bottom);
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
  cursor: pointer;

  &:hover {
    color: $selectedForeground;
    background: $highlight;
  }

  &:last-child {
    border-right: 0;
    color: $accent;
  }
`;

const ConsoleTableWrap = styled.div("RodConsoleTableWrap").css`
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const ConsoleTable = styled.table("RodConsoleTable").css`
  width: 100%;
  border-collapse: collapse;
  color: inherit;
  font: 12px / 1.4 $font.ui;

  tbody tr:hover {
    background: alpha($highlight / 70%);
  }
`;

const ConsoleTableHead = styled.th("RodConsoleTableHead").css`
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 30px;
  padding: 7px 9px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  text-align: left;
  vertical-align: top;
  word-break: break-word;
  white-space: nowrap;
  font-weight: 600;
`;

const ConsoleTableCell = styled.td("RodConsoleTableCell").css`
  min-height: 30px;
  padding: 7px 9px;
  border-bottom: 1px solid $border;
  text-align: left;
  vertical-align: top;
  word-break: break-word;
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
  ConsoleEditorActions,
  ConsoleEditorButton,
  ConsoleTableWrap,
  ConsoleTable,
  ConsoleTableHead,
  ConsoleTableCell,
]);

/** Static Cipó artifacts that must be injected into the Devtools ShadowRoot. */
export const consoleStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  CONSOLE_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

/* *************** */
/* Fabrica views   */
/* *************** */

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
        <RodConsoleIconButton
          class="roderuda-icon-btn"
          type="button"
          title="Clear"
          aria-label="Clear console"
          data-action="clear"
          @click=${event((actionEvent: Event) => {
            actionEvent.preventDefault();
            view.clear();
          })}
        >${icon("clear")}</RodConsoleIconButton>

        <RodConsoleLevels class="roderuda-console-levels" role="group" aria-label="Console levels">
          ${visibleLevels.map((level) => html`
            <RodConsoleLevelButton
              class=${() => view.state.enabledLevels().includes(level)
                ? "roderuda-console-level roderuda-active"
                : "roderuda-console-level"}
              type="button"
              data-level=${level}
              aria-pressed=${() => String(view.state.enabledLevels().includes(level))}
              @click=${event((levelEvent: Event) => {
                levelEvent.preventDefault();
                view.toggleLevel(level);
              })}
            >${level}</RodConsoleLevelButton>
          `)}
        </RodConsoleLevels>

        <RodConsoleControlSpacer class="roderuda-control-spacer" />

        <RodConsoleFilter
          class="roderuda-search"
          data-console-filter
          type="search"
          placeholder="Filter"
          aria-label="Filter console"
          .value=${() => view.state.filterText()}
          @input=${event((inputEvent: Event) => {
            view.filter((inputEvent.currentTarget as HTMLInputElement).value);
          })}
        />

        <RodConsoleIconButton
          class="roderuda-icon-btn"
          type="button"
          title="Copy console"
          aria-label="Copy console"
          data-action="copy"
          @click=${event((copyEvent: Event) => {
            copyEvent.preventDefault();
            view.copy();
          })}
        >${icon("copy")}</RodConsoleIconButton>
      </RodConsoleControl>

      <RodConsoleList class="roderuda-console-list" data-console-list>
        ${repeat(
          view.visibleRecords,
          (record) => record.id,
          ({ item }) => html`
            <RodConsoleRecordView view=${view as never} record=${item as never} />
          `,
          {
            empty: () => html`<span class="roderuda-visually-hidden">No console records</span>`,
          },
        )}
      </RodConsoleList>
    </RodConsoleSurface>

    <RodConsoleInputWrap
      class=${() => [
        "roderuda-console-input-wrap",
        view.state.jsExecution() ? "" : "roderuda-hidden",
        view.state.editorExpanded() ? "roderuda-expanded" : "",
      ].filter(Boolean).join(" ")}
      data-console-input-wrap
    >
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
        <RodConsoleEditorButton
          type="button"
          data-action="cancel-editor"
          @click=${event(() => view.cancelEditor())}
        >Cancel</RodConsoleEditorButton>
        <RodConsoleEditorButton
          type="button"
          data-action="clear-editor"
          @click=${event(() => view.clearEditor())}
        >Clear</RodConsoleEditorButton>
        <RodConsoleEditorButton
          type="button"
          data-action="run-editor"
          @click=${event(() => view.runEditor())}
        >Run</RodConsoleEditorButton>
      </RodConsoleEditorActions>
    </RodConsoleInputWrap>
  `;
});

component("RodConsoleRecordView", function RodConsoleRecordView(props) {
  const view = props.view as ConsoleViewModel;
  const recordSignal = props.record as Signal<ConsoleRecord>;
  const readRecord = (): ConsoleRecord => recordSignal();

  return html`
    <RodConsoleRow
      class=${() => view.state.selectedRecordId() === readRecord().id
        ? "roderuda-console-row roderuda-selected"
        : "roderuda-console-row"}
      data-level=${() => readRecord().level}
      data-record-id=${() => String(readRecord().id)}
      aria-selected=${() => String(view.state.selectedRecordId() === readRecord().id)}
      style=${() => `--rd-console-depth:${readRecord().groupDepth}`}
      @click=${event(() => view.selectRecord(readRecord().id))}
    >
      ${when(
        () => (readRecord().repeat ?? 1) > 1,
        () => html`
          <RodConsoleRepeat class="roderuda-console-repeat">
            ${() => String(readRecord().repeat ?? 1)}
          </RodConsoleRepeat>
        `,
      )}

      ${when(
        () => readRecord().collapsed != null,
        () => html`
          <RodConsoleGroup class="roderuda-console-group">
            ${() => readRecord().collapsed ? "▸" : "▾"}
          </RodConsoleGroup>
        `,
      )}

      ${() => renderRecordPayload(readRecord(), view)}

      ${when(
        () => view.state.displayExtraInfo(),
        () => html`
          <RodConsoleTime class="roderuda-console-time">
            ${() => formatTime(readRecord().timestamp)}
          </RodConsoleTime>
        `,
      )}
    </RodConsoleRow>
  `;
});

component("RodConsoleTableView", function RodConsoleTableView(props) {
  const value = props.value;
  const data = normalizeTable(value);

  if (!data.rows.length) {
    return html`
      <RodConsoleTableWrap class="roderuda-table-wrap">
        ${renderValue(value)}
      </RodConsoleTableWrap>
    `;
  }

  return html`
    <RodConsoleTableWrap class="roderuda-table-wrap">
      <RodConsoleTable class="roderuda-table">
        <thead>
          <tr>
            ${repeat(
              data.columns,
              (column) => column,
              ({ item: column }) => html`
                <RodConsoleTableHead>${column}</RodConsoleTableHead>
              `,
            )}
          </tr>
        </thead>
        <tbody>
          ${repeat(
            data.rows,
            (_row, index) => index,
            ({ item: row }) => html`
              <tr>
                ${repeat(
                  data.columns,
                  (column) => column,
                  ({ item: column }) => html`
                    <RodConsoleTableCell>
                      ${() => renderValue(row()[column()], { maxDepth: 2, maxEntries: 20 })}
                    </RodConsoleTableCell>
                  `,
                )}
              </tr>
            `,
          )}
        </tbody>
      </RodConsoleTable>
    </RodConsoleTableWrap>
  `;
});

function renderRecordPayload(record: ConsoleRecord, view: ConsoleViewModel): RenderValue {
  if (record.level === "html") {
    return html`<span>${String(record.args[0] ?? "")}</span>`;
  }

  if (record.level === "table") {
    return html`<RodConsoleTableView value=${record.args[0] as never} />`;
  }

  const output: RenderValue[] = [];

  record.args.forEach((argument, index) => {
    if (index > 0) output.push(" ");
    output.push(renderValue(argument, {
      maxDepth: view.state.lazyEvaluation() ? 4 : 2,
      maxEntries: view.state.displayUnenumerable() ? 100 : 50,
      onNodeSelect: (node) => view.selectNode(node),
    }));
  });

  return output;
}

/* *************** */
/* Console tool    */
/* *************** */

export class Console extends Tool {
  readonly name: string;
  readonly title = "console";
  readonly icon = "⌘";
  readonly config: ConfigStore<ConsoleConfig>;

  private readonly capture = new ConsoleCapture();
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
  }, {
    name: "roderuda-console",
  });

  private readonly visibleRecords = computed<readonly ConsoleRecord[]>(() => {
    return this.state.records().filter((record) => this.matches(record));
  });

  private body: HTMLElement | null = null;
  private input: HTMLTextAreaElement | null = null;
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
      visibleRecords: this.visibleRecords,
      setBody: (node) => { this.body = node; },
      setInput: (node) => { this.input = node; },
      clear: () => this.clear(),
      copy: () => { void this.copyVisibleRecords(); },
      toggleLevel: (level) => this.toggleLevel(level),
      filter: (value) => this.filter(value),
      selectRecord: (id) => this.selectRecord(id),
      handleInput: (inputEvent) => this.handleInput(inputEvent),
      handleInputKey: (keyboardEvent) => this.handleInputKey(keyboardEvent),
      handleInputFocus: () => this.handleInputFocus(),
      cancelEditor: () => this.expandEditor(false),
      clearEditor: () => this.clearEditor(),
      runEditor: () => { void this.executeInput(); },
      selectNode: (node) => this.selectNode(node),
    };

    this.disposeView?.();
    this.disposeView = render(container, html`<RodConsoleView view=${view as never} />`);

    this.capture.on("record", this.onRecord);
    this.capture.on("clear", this.onClear);

    try {
      this.capture.install({
        overrideConsole: this.config.get("overrideConsole"),
        catchGlobalErrors: this.config.get("catchGlobalErr"),
      });
    } catch (error) {
      context.notify(
        `Console capture fallback: ${error instanceof Error ? error.message : String(error)}`,
        { type: "warning", duration: 5000 },
      );
    }

    this.config.on("change", this.onConfigChange);
    this.registerSettings(context);
    this.syncConfigState();
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
    flushSync();
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
    this.disposeView?.();
    this.disposeView = null;
    this.body = null;
    this.input = null;
    this.state.patch({
      records: [],
      selectedRecordId: null,
      inputValue: "",
      editorExpanded: false,
    }, { cause: "console:destroy" });
    super.destroy();
  }

  private readonly onRecord = (record: ConsoleRecord): void => {
    const records = [...this.state.records.peek()];
    const last = records.at(-1);

    if (last && sameRecord(last, record)) {
      records[records.length - 1] = {
        ...last,
        repeat: (last.repeat ?? 1) + 1,
        timestamp: record.timestamp,
      };
    } else {
      records.push(record);
    }

    this.state.records.set(records);
    this.trimRecords();

    if (!this.config.get("asyncRender")) {
      flushSync();
    }

    this.scrollToBottom();

    if (record.level === "error" && this.config.get("displayIfErr")) {
      this.context?.devtools.show().showTool(this.name);
    }
  };

  private readonly onClear = (): void => {
    this.state.patch({
      records: [],
      selectedRecordId: null,
    }, { cause: "console:clear" });
    flushSync();
  };

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "overrideConsole") {
      value ? this.capture.overrideConsole() : this.capture.restoreConsole();
    }

    if (key === "catchGlobalErr") {
      value ? this.capture.enableGlobalErrors() : this.capture.disableGlobalErrors();
    }

    if (
      key === "jsExecution" ||
      key === "displayExtraInfo" ||
      key === "displayUnenumerable" ||
      key === "lazyEvaluation"
    ) {
      this.syncConfigState();
      flushSync();
    }

    if (key === "maxLogNum") {
      this.trimRecords();
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
    settings.registerSelect(
      this.config,
      "maxLogNum",
      "Maximum log count",
      ["infinite", "500", "250", "125", "100", "50", "10"],
    );
  }

  private matches(record: ConsoleRecord): boolean {
    const level = normalizeVisibleLevel(record.level);

    if (!this.state.enabledLevels().includes(level)) {
      return false;
    }

    const filterValue = this.state.filterValue();

    if (!filterValue) {
      return true;
    }

    if (typeof filterValue === "function") {
      return filterValue(record);
    }

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

    if (max > 0 && records.length > max) {
      this.state.records.set(records.slice(records.length - max));
    }
  }

  private toggleLevel(level: ConsoleLevel): void {
    const enabled = this.state.enabledLevels.peek();
    const next = enabled.includes(level)
      ? enabled.filter((candidate) => candidate !== level)
      : [...enabled, level];

    this.state.enabledLevels.set(next);
    flushSync();
  }

  private selectRecord(id: number): void {
    this.state.setPath("selectedRecordId", Number.isFinite(id) ? id : null);
  }

  private handleInput(eventValue: Event): void {
    this.state.inputValue.set((eventValue.currentTarget as HTMLTextAreaElement).value);
  }

  private handleInputFocus(): void {
    const value = this.state.inputValue.peek();
    if (value.includes("\n") || value.length > 80) {
      this.expandEditor(true);
    }
  }

  private handleInputKey(eventValue: KeyboardEvent): void {
    const value = this.state.inputValue.peek();

    if (
      eventValue.key === "Enter" &&
      !eventValue.shiftKey &&
      !eventValue.altKey &&
      !eventValue.ctrlKey &&
      !eventValue.metaKey
    ) {
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
      this.state.patch({
        historyIndex: nextIndex,
        inputValue: this.state.history.peek()[nextIndex] ?? "",
      }, { cause: "console:history-up" });
      flushSync();
      return;
    }

    if (eventValue.key === "ArrowDown" && !value.includes("\n")) {
      eventValue.preventDefault();
      const nextIndex = Math.min(
        this.state.history.peek().length,
        this.state.historyIndex.peek() + 1,
      );
      this.state.patch({
        historyIndex: nextIndex,
        inputValue: this.state.history.peek()[nextIndex] ?? "",
      }, { cause: "console:history-down" });
      flushSync();
      return;
    }

    if (eventValue.key === "Escape") {
      this.expandEditor(false);
      return;
    }

    if (eventValue.key === "Enter" && eventValue.shiftKey) {
      this.expandEditor(true);
    }
  }

  private async executeInput(): Promise<void> {
    const code = this.state.inputValue.peek().trim();

    if (!code) {
      return;
    }

    const history = [...this.state.history.peek(), code];
    this.state.patch({
      history,
      historyIndex: history.length,
      inputValue: "",
      editorExpanded: false,
    }, { cause: "console:execute" });
    flushSync();

    this.capture.record("command", [code]);

    try {
      const result = await executeJavaScript(code, {
        $_: this.state.lastResult.peek(),
        $0: this.selectedRecord()?.args[0],
        devtools: this.context?.devtools,
        globals: this.capture.getGlobals(),
      });

      this.state.lastResult.set(result);
      this.capture.record("result", [result]);
    } catch (error) {
      this.capture.record("error", [error]);
    }
  }

  private expandEditor(expanded: boolean): void {
    this.state.setPath("editorExpanded", expanded);
    flushSync();

    if (expanded) {
      queueMicrotask(() => this.input?.focus());
    }
  }

  private clearEditor(): void {
    this.state.inputValue.set("");
    flushSync();
    this.input?.focus();
  }

  private selectedRecord(): ConsoleRecord | null {
    const id = this.state.selectedRecordId.peek();
    return id == null
      ? null
      : this.state.records.peek().find((record) => record.id === id) ?? null;
  }

  private selectNode(node: Node): void {
    if (!(node instanceof Element)) {
      return;
    }

    this.context?.devtools
      .get<{ select(selectedNode: Element): void } & Tool>("elements")
      ?.select(node);
    this.context?.devtools.showTool("elements");
  }

  private async copyVisibleRecords(): Promise<void> {
    const text = this.visibleRecords.peek()
      .map((record) => record.args.map(plainText).join(" "))
      .join("\n");

    await copyText(text);
    this.context?.notify("Console copied", { type: "success" });
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (!this.body) {
        return;
      }

      this.body.scrollTop = this.body.scrollHeight;
    });
  }
}

function normalizeVisibleLevel(level: ConsoleLevel): ConsoleLevel {
  return level === "command" ||
    level === "result" ||
    level === "html" ||
    level === "table" ||
    level === "dir"
    ? "log"
    : level;
}

function sameRecord(left: ConsoleRecord, right: ConsoleRecord): boolean {
  if (
    left.level !== right.level ||
    left.groupDepth !== right.groupDepth ||
    left.args.length !== right.args.length
  ) {
    return false;
  }

  return left.args.every((value, index) => Object.is(value, right.args[index]));
}

function normalizeTable(value: unknown): {
  columns: string[];
  rows: Array<Record<string, unknown>>;
} {
  if (Array.isArray(value)) {
    const rows = value.map((item, index) => {
      if (item && typeof item === "object") {
        return { "(index)": index, ...(item as Record<string, unknown>) };
      }

      return { "(index)": index, Value: item };
    });

    return {
      columns: [...new Set(rows.flatMap((row) => Object.keys(row)))],
      rows,
    };
  }

  if (value && typeof value === "object") {
    const rows = Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object") {
        return { "(index)": key, ...(item as Record<string, unknown>) };
      }

      return { "(index)": key, Value: item };
    });

    return {
      columns: [...new Set(rows.flatMap((row) => Object.keys(row)))],
      rows,
    };
  }

  return { columns: [], rows: [] };
}

async function executeJavaScript(
  code: string,
  context: {
    $_: unknown;
    $0: unknown;
    devtools: unknown;
    globals: ReadonlyMap<string, unknown>;
  },
): Promise<unknown> {
  const names = ["$_", "$0", "devtools", ...context.globals.keys()];
  const values = [context.$_, context.$0, context.devtools, ...context.globals.values()];
  const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor as new (
    ...args: string[]
  ) => (...functionValues: unknown[]) => Promise<unknown>;

  try {
    const expression = new AsyncFunction(
      ...names,
      `"use strict"; return await (${code});`,
    );
    return await expression(...values);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    const statements = new AsyncFunction(...names, `"use strict"; ${code}`);
    return await statements(...values);
  }
}
