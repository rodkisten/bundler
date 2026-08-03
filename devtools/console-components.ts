import type { CipoCssArtifact } from "@rodkisten/cipo";
import type { ConsoleContextValue, ConsoleLevel } from "@rodkisten/devtools/types";
import { component, event, html, repeat, styled } from "@rodkisten/devtools/core/runtime";
import { icon } from "@rodkisten/devtools/utils";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import { filterArray, flatMap, includesArray, mapArray } from "@rodkisten/nascente";

export const ConsoleContext = createRequiredFabricaContext<ConsoleContextValue>("ConsoleContext");

export const visibleLevels: readonly ConsoleLevel[] = ["debug", "log", "info", "warn", "error"];

/* *************** */
/* Styled console  */
/* *************** */

export const ConsoleSurface = styled.div("RodConsoleSurface").css`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  touch-action: pan-y pan-x;
  -webkit-overflow-scrolling: touch;
  background: $background;
  scrollbar-gutter: stable;
`;

export const ConsoleControl = styled.div("RodConsoleControl").css`
  position: absolute;
  inset: 0 0 auto 0;
  z-index: var(--rd-z-toolbar, 2147483530);
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 4px 6px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  scrollbar-gutter: stable;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
`;

export const ConsoleIconButton = styled.button("RodConsoleIconButton").css`
  @with($control-reset)
  interactive-surface

  inline-grid
  place-items: center
  min-width: 28px
  h: 28px
  rounded: $control
  color: $primary
  bg: transparent
`;

export const ConsoleLevels = styled.div("RodConsoleLevels").css`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
`;

export const ConsoleLevelButton = styled.button("RodConsoleLevelButton").css`
  @with(appearance(none))
  interactive-surface

  h: 28px
  p: 0 9px
  border: 1px solid $border
  rounded: $pill
  color: $foreground
  bg: transparent

  state(active=true) {
    color: $selectedForeground
    bg: $highlight
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
  min-height: 100%;
  padding: 44px 0 calc(28px + var(--rd-safe-bottom));
  text(11px / 1.25)
  font-family: $font.mono
  user-select: text;
  overflow-x: hidden;
`;

export const ConsoleRow = styled.div("RodConsoleRow").css`
  position: relative;
  min-height: 17px;
  margin: 0;
  padding: 0 5px 0 calc(5px + var(--rd-console-depth, 0) * 11px);
  border: 0;
  border-bottom: 1px solid alpha($border / 58%);
  border-radius: 0;
  color: $foreground;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: visible;
  cursor: text;

  x:hover {
    bg: alpha($highlight / 42%)
  }

  variant(level) {
    debug { color: $comment }
    info { color: $link }

    warn {
      color: $warningFg
      border-bottom-color: $warningBorder
      bg: $warningBg
    }

    error {
      color: $errorFg
      border-bottom-color: $errorBorder
      bg: $errorBg
    }

    command { color: $accent }
    result { color: $primary }
  }
`;


export const ConsoleStack = styled.pre("RodConsoleStack").css`
  margin: 3px 0 1px 12px;
  padding: 4px 6px;
  overflow: auto;
  border: 1px solid alpha($border / 68%);
  border-radius: $sm;
  color: $secondary;
  background: alpha($backgroundDark / 72%);
  text(10px / 1.35)
  font-family: $font.mono
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
  text(10px / 1)
  font-family: $font.ui
`;

export const ConsoleGroup = styled.span("RodConsoleGroup").css`
  display: inline-block;
  width: 14px;
  color: $operator;
`;

export const ConsoleExternalBadge = styled.span("RodConsoleExternalBadge").css`
  display: inline-flex;
  align-items: center;
  max-width: 64px;
  height: 12px;
  margin: 1px 4px 0 0;
  padding: 0 3px;
  overflow: hidden;
  border: 1px solid alpha($border / 72%);
  border-radius: 3px;
  color: $secondary;
  background: alpha($backgroundDark / 52%);
  opacity: .72;
  text(8px / 1 / 650)
  font-family: $font.ui
  letter-spacing: .025em;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: 1px;
  user-select: none;
`;

export const ConsoleTime = styled.span("RodConsoleTime").css`
  position: absolute;
  top: 1px;
  right: 4px;
  opacity: .55;
  text(10px / 1.3, tabular)
  font-family: $font.ui
`;

export const ConsoleInputWrap = styled.div("RodConsoleInputWrap").css`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--rd-z-sticky, 2147483540);
  display: flex;
  align-items: stretch;
  height: calc(27px + var(--rd-safe-bottom));
  padding-bottom: var(--rd-safe-bottom);
  border-top: 1px solid $border;
  background: $background;

  &:jsExecution='false' {
    !display: none
  }

  state(expanded=true) {
    top: 0
    h-full
    p: 40px 0 calc(44px + var(--rd-safe-bottom))
  }
`;

export const ConsolePrompt = styled.span("RodConsolePrompt").css`
  display: grid;
  place-items: center;
  width: 25px;
  color: $accent;
  text(15px / 1 / 700)
  font-family: $font.mono
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
  text(13px / 1.4)
  font-family: $font.mono
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

  state(expanded=true) {
    flex
  }
`;

export const ConsoleEditorButton = styled.button("RodConsoleEditorButton").css`
  @with($control-reset)
  interactive-surface

  flex: 1
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
  text(12px / 1.4)
  font-family: $font.ui
`;

export const ConsoleTableHead = styled.th("RodConsoleTableHead").css`
  padding: 4px 6px;
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
  ConsoleStack,
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
  filterArray(flatMap(CONSOLE_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts), (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodConsoleView", function RodConsoleView(_props, ctx) {
  const view = ctx.useRequiredContext(ConsoleContext);
  const { state } = view;

  ctx.effect(() => {
    view.syncEditorValue(state.inputValue());
  });

  return html`
    <RodConsoleSurface
      :jsExecution=${state.jsExecution}
      :consoleBody
      :roderudaScrollKey="console"
      ref=${(node: HTMLElement) => {
        view.setScrollContainer(node);
        return () => view.setScrollContainer(null);
      }}
    >
      <RodConsoleControl>
        <RodConsoleIconButton type="button" title="Clear" :action="clear" @click=${event.click((click) => { click.preventDefault(); view.clear(); })}>${icon("clear")}</RodConsoleIconButton>
        <RodConsoleLevels role="group" :label="Console levels">
          ${mapArray(visibleLevels, (level) => html`
            <RodConsoleLevelButton
              :active=${() => includesArray(state.enabledLevels(), level)}
              :level=${level}
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
      <RodConsoleList :consoleList>
        ${repeat(
          () => view.visibleRecords(),
          (record) => record.id,
          ({ item }) => () => view.renderRecord(item()),
          { empty: () => html`<span class="roderuda-visually-hidden">No console records</span>` },
        )}
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

