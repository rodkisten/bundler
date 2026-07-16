import type { Store } from "@rodkisten/broto";
import type { ConsoleFilter as ConsoleFilterValue, ConsoleLevel, ConsoleRecord } from "@rodkisten/devtools/types";
import { component, event, html,  styled } from "@rodkisten/devtools/core-runtime";
import { icon } from "@rodkisten/devtools/utils";
import { createRequiredFabricaContext } from "@rodkisten/fabrica/runtime";
import { includesArray, mapArray } from "@rodkisten/nascente";

export interface ConsoleState extends Record<string, unknown> {
  records: ConsoleRecord[];
  filterValue: ConsoleFilterValue;
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

export interface ConsoleViewModel {
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

export const ConsoleViewContext = createRequiredFabricaContext<ConsoleViewModel>("ConsoleViewContext");

export const visibleLevels: readonly ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];

/* *************** */
/* Styled console  */
/* *************** */

export const ConsoleSurface = styled.div("RodConsoleSurface").css`
  width: 100%;
  height: 100%;
  padding-bottom: calc(var(--rd-console-bottom-padding, 84px) + var(--rd-safe-bottom));
  scroll-padding-bottom: calc(var(--rd-console-bottom-padding, 84px) + var(--rd-safe-bottom));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  background: $background;
  scrollbar-gutter: stable;

  &[data-js-execution="false"] {
    padding-bottom: 0;
  }
`;

export const ConsoleControl = styled.div("RodConsoleControl").css`
  position: absolute;
  inset: 0 0 auto 0;
  z-index: var(--rd-z-toolbar, 2147483530);
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 7px 9px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  scrollbar-gutter: stable;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
`;

export const ConsoleIconButton = styled.button("RodConsoleIconButton").css`
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

export const ConsoleLevels = styled.div("RodConsoleLevels").css`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
`;

export const ConsoleLevelButton = styled.button("RodConsoleLevelButton").css`
  appearance: none;
  height: 28px;
  padding: 0 9px;
  border: 1px solid $border;
  border-radius: $pill;
  color: $foreground;
  background: transparent;

  &[data-active="true"] {
    color: $selectedForeground;
    background: $highlight;
  }
`;

export const ConsoleControlSpacer = styled.div("RodConsoleControlSpacer").css`
  flex: 1 1 auto;
`;

export const ConsoleFilter = styled.input("RodConsoleFilter").css`
  min-width: var(--rd-console-filter-min-width, 150px);
  max-width: 280px;
  height: 30px;
  flex: 1 0 var(--rd-console-filter-min-width, 150px);
  padding: 5px 10px;
  border: 1px solid $border;
  border-radius: $pill;
  color: $primary;
  background: $background;
`;

export const ConsoleList = styled.div("RodConsoleList").css`
  padding: 66px var(--rd-panel-padding, 12px) calc(var(--rd-console-bottom-padding, 84px) + var(--rd-safe-bottom));
  font: 12px / 1.5 $font.mono;
  user-select: text;
  overflow-x: hidden;
`;

export const ConsoleRow = styled.div("RodConsoleRow").css`
  position: relative;
  min-height: 31px;
  margin: 0 0 var(--rd-console-row-gap, 8px);
  padding: var(--rd-console-row-padding, 10px) 42px var(--rd-console-row-padding, 10px) calc(13px + var(--rd-console-depth, 0) * 14px);
  border: 1px solid alpha($border / 72%);
  border-radius: $md;
  border-bottom: 1px solid alpha($border / 65%);
  color: $foreground;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: pointer;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: var(--rd-console-preview-lines, 6);
  overflow: hidden;

  &[data-expanded="true"] {
    display: block;
    -webkit-line-clamp: unset;
    overflow: visible;
  }

  &[data-level="debug"] { color: $comment; }
  &[data-level="info"] { color: $link; }
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


export const ConsoleStack = styled.pre("RodConsoleStack").css`
  margin: 8px 0 0;
  padding: 8px 10px;
  overflow: auto;
  border: 1px solid alpha($border / 68%);
  border-radius: $sm;
  color: $secondary;
  background: alpha($backgroundDark / 72%);
  font: 11px / 1.45 $font.mono;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

export const ConsoleRepeat = styled.span("RodConsoleRepeat").css`
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

export const ConsoleGroup = styled.span("RodConsoleGroup").css`
  display: inline-block;
  width: 14px;
  color: $operator;
`;

export const ConsoleTime = styled.span("RodConsoleTime").css`
  position: absolute;
  top: 5px;
  right: 7px;
  opacity: .55;
  font: 10px / 1.3 $font.ui;
`;

export const ConsoleInputWrap = styled.div("RodConsoleInputWrap").css`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--rd-z-sticky, 2147483540);
  display: flex;
  align-items: stretch;
  height: calc(25px + var(--rd-safe-bottom));
  padding-bottom: var(--rd-safe-bottom);
  border-top: 1px solid $border;
  background: $background;

  &[data-js-execution="false"] {
    display: none !important;
  }

  &[data-expanded="true"] {
    top: 0;
    height: 100%;
    padding: 40px 0 calc(44px + var(--rd-safe-bottom));
  }
`;

export const ConsolePrompt = styled.span("RodConsolePrompt").css`
  display: grid;
  place-items: center;
  width: 25px;
  color: $accent;
  font: 700 15px / 1 $font.mono;
`;

export const ConsoleInput = styled.textarea("RodConsoleInput").css`
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

export const ConsoleCodeEditorHost = styled.div("RodConsoleCodeEditorHost").css`
  flex: 1;
  min-width: 0;
  min-height: 100%;
  color: $primary;
  width: 100%;

  .cm-editor {
    height: 100%;
    background: transparent;
    outline: none;
  }

  .cm-content {
    padding: 3px 8px 3px 0;
  }
`;

export const ConsoleEditorActions = styled.div("RodConsoleEditorActions").css`
  position: absolute;
  right: 0;
  bottom: var(--rd-safe-bottom);
  left: 0;
  display: none;
  height: 44px;
  border-top: 1px solid $border;
  background: $backgroundDark;

  &[data-expanded="true"] {
    display: flex;
  }
`;

export const ConsoleEditorButton = styled.button("RodConsoleEditorButton").css`
  appearance: none;
  flex: 1;
  border: 0;
  border-right: 1px solid $border;
  color: $primary;
  background: transparent;

  align-content: flex-end;
  justify-content: flex-end;
`;

export const ConsoleTableWrap = styled.div("RodConsoleTableWrap").css`
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
`;

export const ConsoleTable = styled.table("RodConsoleTable").css`
  width: 100%;
  border-collapse: collapse;
  color: inherit;
  font: 12px / 1.4 $font.ui;
`;

export const ConsoleTableHead = styled.th("RodConsoleTableHead").css`
  padding: 7px 9px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  text-align: left;
`;

export const ConsoleTableCell = styled.td("RodConsoleTableCell").css`
  padding: 7px 9px;
  border-bottom: 1px solid $border;
  text-align: left;
`;


component("RodConsoleView", function RodConsoleView(_props, ctx) {
  const view = ctx.useRequiredContext(ConsoleViewContext);
  const { state } = view;
  
  return html`
    <RodConsoleSurface
      :data=${{ jsExecution: state.jsExecution(),
                consoleBody: true, 
                roderudaScrollKey: "console"
             }}
      ref=${(node: HTMLElement) => {
        view.setBody(node as HTMLElement);
        return () => view.setBody(null);
      }}
    >
      <RodConsoleControl>
        <RodConsoleIconButton type="button" title="Clear" :action="clear" @click=${event.click((click) => { click.preventDefault(); view.clear(); })}>${icon("clear")}</RodConsoleIconButton>
        <RodConsoleLevels role="group" :label="Console levels">
          ${mapArray(visibleLevels, (level) => html`
            <RodConsoleLevelButton
              :data=${{ active: includesArray(state.enabledLevels(), level),
                        level: level,
                      }}
              type="button"
              aria-pressed=${() => includesArray(state.enabledLevels(), level)}
              @click=${event.click((levelEvent) => { 
                levelEvent.preventDefault(); 
                view.toggleLevel(level); })}
            >
            ${level}
          </RodConsoleLevelButton>
          `)}
        </RodConsoleLevels>
        <RodConsoleControlSpacer />
        <RodConsoleFilter :consoleFilter type="search" placeholder="Filter logs…" aria-label="Filter console records" .value=${state.filterText} @input=${event.input<HTMLInputElement>((inputEvent) => view.filter(inputEvent.currentTarget.value))} />
        <RodConsoleIconButton type="button" title="Copy console" :action="copy" @click=${event.click((copyEvent) => { copyEvent.preventDefault(); view.copy(); })}>${icon("copy")}</RodConsoleIconButton>
      </RodConsoleControl>
      <RodConsoleList :consoleList ref=${(node: HTMLElement) => {
        view.setList(node as HTMLElement);
        return () => view.setList(null);
      }}>
        <span class="roderuda-visually-hidden">No console records</span>
      </RodConsoleList>
    </RodConsoleSurface>
    <RodConsoleInputWrap :jsExecution=${state.jsExecution} :expanded=${state.editorExpanded} :consoleInputWrap >
      <RodConsolePrompt>›</RodConsolePrompt>
      <RodConsoleInput
        :consoleInput
        rows="1"
        spellcheck="false"
        autocomplete="off"
        aria-label="JavaScript console"
        .value=${state.inputValue}
        ref=${(node: HTMLTextAreaElement) => {
          view.setInput(node);
          return () => view.setInput(null);
        }}
        @input=${event.input((inputEvent) => view.handleInput(inputEvent))}
        @keydown=${event.keydown((keyboardEvent) => view.handleInputKey(keyboardEvent))}
        @focus=${event.focus(() => view.handleInputFocus())}
      />
      <RodConsoleEditorButton type="button" :action="run-inline" title="Run code" aria-label="Run code" @click=${event.click(() => view.runEditor())}>▶</RodConsoleEditorButton>
      <RodConsoleEditorActions 
      :expanded=${state.editorExpanded}>
        <RodConsoleEditorButton type="button" :action="cancel-editor" @click=${event.click(() => view.cancelEditor())}>Cancel</RodConsoleEditorButton>
        <RodConsoleEditorButton type="button" :action="clear-editor" @click=${event.click(() => view.clearEditor())}>Clear</RodConsoleEditorButton>
        <RodConsoleEditorButton type="button"  :action="run-editor" @click=${event.click(() => view.runEditor())}>Run</RodConsoleEditorButton>
      </RodConsoleEditorActions>
    </RodConsoleInputWrap>
  `;
});

