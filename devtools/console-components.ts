import type { CipoCssArtifact } from "@rodkisten/cipo";
import type {
  ConsoleContextValue,
  ConsoleLevel,
} from "@rodkisten/devtools/types";
import {
  component,
  event,
  html,
  repeat,
  styled,
} from "@rodkisten/devtools/core/runtime";
import { icon } from "@rodkisten/devtools/utils";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import {
  filterArray,
  flatMap,
  includesArray,
  mapArray,
} from "@rodkisten/nascente";

export const ConsoleContext =
  createRequiredFabricaContext<ConsoleContextValue>("ConsoleContext");

export const visibleLevels: readonly ConsoleLevel[] = [
  "debug",
  "log",
  "info",
  "warn",
  "error",
];

/* *************** */
/* Styled console  */
/* *************** */

/**
 * Console layout
 *
 * ┌────────────────────────────────────┐
 * │ actions / filter                   │ auto
 * ├────────────────────────────────────┤
 * │ debug log info warn error          │ auto
 * ├────────────────────────────────────┤
 * │                                    │
 * │           scrollable logs          │ minmax(0, 1fr)
 * │                                    │
 * └────────────────────────────────────┘
 *
 * The JavaScript prompt remains independently positioned at the bottom.
 *
 * The important bit here is that ConsoleSurface itself DOES NOT scroll.
 * Only ConsoleList scrolls.
 *
 * That means the toolbar and level bar never move with the log stream.
 */
export const ConsoleSurface = styled.div("RodConsoleSurface").css`
  position: relative;

  display: grid;
  grid-template-rows:
    auto
    auto
    minmax(0, 1fr)
    auto;

  width: 100%;
  height: 100%;

  min-width: 0;
  min-height: 0;

  overflow: hidden;

  background: $background;

  touch-action: auto;
`;

/**
 * Primary console toolbar.
 *
 * This intentionally contains no log-level pills.
 * Levels get their own persistent row below this one.
 */
export const ConsoleControl = styled.div("RodConsoleControl").css`
  position: relative;

  z-index: var(--rd-z-toolbar, 2147483530);

  display: flex;
  align-items: center;

  width: 100%;
  min-width: 0;
  min-height: 40px;

  gap: 6px;

  padding: 5px 7px;

  overflow: hidden;

  border-bottom: 1px solid alpha($border / 72%);

  color: $primary;
  background: $backgroundDark;

  touch-action: auto;
`;

export const ConsoleIconButton = styled.button(
  "RodConsoleIconButton",
).css`
  @with($control-reset)
  interactive-surface

  flex: 0 0 auto;

  display: inline-grid;
  place-items: center;

  min-width: 29px;
  width: 29px;
  height: 29px;

  padding: 0;

  border: 1px solid transparent;
  border-radius: $control;

  color: $secondary;
  background: transparent;

  cursor: pointer;

  transition:
    color .14s,
    background .14s,
    border-color .14s,
    transform .1s;

  x:hover {
    color: $primary
    bg: $highlight
  }

  x:active {
    transform: scale(.94)
  }

  x:focus-visible {
    color: $primary
    border-color: $accent
    bg: $highlight
  }
`;

/**
 * Dedicated fixed level bar.
 *
 * Because this is its own CSS Grid row, it cannot "scroll upward" together
 * with the records.
 */
export const ConsoleLevelBar = styled.div("RodConsoleLevelBar").css`
  position: relative;

  z-index: var(--rd-z-toolbar, 2147483530);

  display: flex;
  align-items: center;

  width: 100%;
  min-width: 0;
  min-height: 36px;

  padding: 4px 7px;

  overflow-x: auto;
  overflow-y: hidden;

  border-bottom: 1px solid alpha($border / 66%);

  color: $foreground;
  background: alpha($backgroundDark / 94%);

  overscroll-behavior-inline: contain;

  -webkit-overflow-scrolling: touch;

  scrollbar-width: none;

  touch-action: pan-x;

  &::-webkit-scrollbar {
    display: none;
  }
`;

export const ConsoleLevels = styled.div("RodConsoleLevels").css`
  display: flex;
  flex: 0 0 auto;
  align-items: center;

  gap: 4px;

  min-width: max-content;
`;

export const ConsoleLevelButton = styled.button(
  "RodConsoleLevelButton",
).css`
  @with(appearance(none))
  interactive-surface

  flex: 0 0 auto;

  height: 27px;

  padding: 0 9px;

  border: 1px solid alpha($border / 76%);
  border-radius: $pill;

  color: $secondary;
  background: alpha($background / 20%);

  text(11px / 1 / 600)
  font-family: $font.ui;

  cursor: pointer;

  transition:
    color .14s,
    background .14s,
    border-color .14s,
    opacity .14s,
    transform .1s;

  x:hover {
    color: $primary
    bg: $highlight
  }

  x:active {
    transform: scale(.96)
  }

  state(active=true) {
    color: $selectedForeground
    border-color: alpha($accent / 45%)
    bg: alpha($highlight / 86%)
  }

  &[data-level="debug"] {
    opacity: .82;
  }

  &[data-level="warn"][data-active="true"] {
    color: $warningFg;
    border-color: alpha($warningBorder / 80%);
    background: alpha($warningBg / 72%);
  }

  &[data-level="error"][data-active="true"] {
    color: $errorFg;
    border-color: alpha($errorBorder / 80%);
    background: alpha($errorBg / 72%);
  }
`;

export const ConsoleControlSpacer = styled.div(
  "RodConsoleControlSpacer",
).css`
  flex: 1 1 auto;

  min-width: 0;
`;

export const ConsoleFilter = styled.input("RodConsoleFilter").css`
  flex: 1 1 180px;

  width: auto;
  min-width: 90px;
  max-width: 360px;
  height: 29px;

  padding: 4px 10px;

  border: 1px solid alpha($border / 80%);
  border-radius: $pill;

  outline: none;

  color: $primary;
  background: alpha($background / 58%);

  text(12px / 1.2)
  font-family: $font.ui;

  user-select: text;
  -webkit-user-select: text;

  touch-action: manipulation;

  transition:
    border-color .14s,
    background .14s;

  &::placeholder {
    color: $comment;
    opacity: .78;
  }

  &:focus {
    border-color: alpha($accent / 68%);
    background: alpha($background / 86%);
  }
`;

/**
 * THE console scroll container.
 *
 * Nothing above this node participates in the vertical scroll.
 */
export const ConsoleList = styled.div("RodConsoleList").css`
  position: relative;

  width: 100%;
  height: 100%;

  min-width: 0;
  min-height: 0;

  /*
   * The REPL is a real grid row now, not an overlay. Keep only a small visual
   * tail so the final log does not feel glued to the prompt.
   */
  padding:
    2px
    0
    var(--rd-console-bottom-padding, 6px);

  overflow-x: hidden;
  overflow-y: auto;

  overscroll-behavior: contain;

  -webkit-overflow-scrolling: touch;

  touch-action: pan-y;

  scrollbar-gutter: stable;

  text(11.5px / 1.42)
  font-family: $font.mono;

  user-select: text;
  -webkit-user-select: text;
`;

/**
 * Log record.
 *
 * Records are intentionally dense, but no longer "terminal dump dense".
 *
 * A little vertical rhythm makes complex objects much easier to scan on a
 * phone without wasting half the viewport per record.
 */
export const ConsoleRow = styled.div("RodConsoleRow").css`
  position: relative;

  display: block;

  width: 100%;
  min-width: 0;
  min-height: 24px;

  margin: 0 0 var(--rd-console-row-gap, 0px);

  /*
   * Keep logs dense on phones. Group indentation is deliberately shallow and
   * is clamped by the renderer, preventing a page with many unbalanced
   * console.group() calls from pushing every DevTools record halfway across
   * the screen. Timestamps are opt-in, so do not reserve 62px permanently.
   */
  padding:
    var(--rd-console-row-padding, 4px)
    8px
    var(--rd-console-row-padding, 4px)
    calc(5px + var(--rd-console-depth, 0) * 7px);

  border: 0;
  border-left: 2px solid transparent;
  border-bottom: 1px solid alpha($border / 34%);

  border-radius: 0;

  color: $foreground;
  background: transparent;

  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: normal;

  overflow: visible;

  cursor: text;

  transition:
    background .1s,
    border-color .1s;

  x:hover {
    bg: alpha($highlight / 24%)
  }

  /*
   * Regular console.log
   */
  variant(level) {
    log {
      color: $foreground
    }

    /*
     * Debug information is intentionally quieter.
     */
    debug {
      color: $comment
      bg: alpha($backgroundDark / 12%)
    }

    /*
     * Info should be distinguishable without becoming electric blue soup.
     */
    info {
      color: $foreground
      border-left-color: alpha($link / 60%)
      bg: alpha($link / 4%)
    }

    /*
     * Warnings receive a subtle surface and stronger left rail instead of a
     * giant full-width yellow block.
     */
    warn {
      color: $warningFg
      border-left-color: $warningBorder
      border-bottom-color: alpha($warningBorder / 42%)
      bg: alpha($warningBg / 36%)
    }

    /*
     * Same idea for errors. The stripe carries most of the severity signal,
     * leaving the content readable.
     */
    error {
      color: $errorFg
      border-left-color: $errorBorder
      border-bottom-color: alpha($errorBorder / 42%)
      bg: alpha($errorBg / 38%)
    }

    /*
     * User-entered commands.
     */
    command {
      color: $accent
      border-left-color: alpha($accent / 62%)
      bg: alpha($accent / 4%)
    }

    /*
     * Evaluation result.
     */
    result {
      color: $primary
      border-left-color: alpha($primary / 22%)
    }
  }
`;

/**
 * Stack traces are visually secondary to the error message itself.
 */
export const ConsoleStack = styled.pre("RodConsoleStack").css`
  margin:
    5px
    0
    2px
    3px;

  padding: 6px 8px;

  max-width: 100%;

  overflow-x: auto;
  overflow-y: visible;

  border: 1px solid alpha($border / 54%);
  border-radius: $sm;

  color: $secondary;
  background: alpha($backgroundDark / 58%);

  text(10.5px / 1.42)
  font-family: $font.mono;

  white-space: pre-wrap;
  overflow-wrap: anywhere;

  -webkit-overflow-scrolling: touch;

  touch-action: pan-x;

  user-select: text;
  -webkit-user-select: text;
`;

export const ConsoleRepeat = styled.span("RodConsoleRepeat").css`
  display: inline-grid;
  place-items: center;

  min-width: 17px;
  height: 17px;

  margin-right: 5px;

  padding: 0 4px;

  border: 1px solid alpha($border / 58%);
  border-radius: $pill;

  color: $primary;
  background: alpha($highlight / 74%);

  text(9px / 1 / 700)
  font-family: $font.ui;

  vertical-align: 1px;

  user-select: none;
  -webkit-user-select: none;
`;

export const ConsoleGroup = styled.span("RodConsoleGroup").css`
  display: inline-grid;
  place-items: center;

  width: 14px;
  height: 16px;

  margin-right: 2px;

  color: $operator;

  text-align: center;

  user-select: none;
  -webkit-user-select: none;
`;

export const ConsoleExternalBadge = styled.span(
  "RodConsoleExternalBadge",
).css`
  display: inline-flex;
  align-items: center;

  max-width: 74px;
  height: 15px;

  margin:
    0
    5px
    0
    1px;

  padding: 0 5px;

  overflow: hidden;

  border: 1px solid alpha($border / 58%);
  border-radius: $pill;

  color: $secondary;
  background: alpha($backgroundDark / 46%);

  opacity: .8;

  text(8.5px / 1 / 650)
  font-family: $font.ui;

  letter-spacing: .02em;
  text-transform: uppercase;

  text-overflow: ellipsis;
  white-space: nowrap;

  vertical-align: 1px;

  user-select: none;
  -webkit-user-select: none;
`;

/**
 * Timestamp should be useful without being the loudest thing in every line.
 */
export const ConsoleTime = styled.span("RodConsoleTime").css`
  position: absolute;

  top: 3px;
  right: 5px;

  max-width: 52px;
  padding-left: 5px;
  border-radius: $sm;
  background: alpha($background / 92%);

  overflow: hidden;

  color: $comment;

  opacity: .48;

  text(9px / 1.35, tabular)
  font-family: $font.ui;

  text-overflow: ellipsis;
  white-space: nowrap;

  pointer-events: none;

  user-select: none;
  -webkit-user-select: none;
`;

/* *********************** */
/* JavaScript console input */
/* *********************** */

export const ConsoleInputWrap = styled.div("RodConsoleInputWrap").css`
  position: relative;
  grid-row: 4;

  z-index: var(--rd-z-sticky, 2147483540);

  display: flex;
  align-items: stretch;

  width: 100%;
  min-width: 0;
  min-height: calc(42px + var(--rd-safe-bottom));
  height: calc(42px + var(--rd-safe-bottom));

  padding-bottom: var(--rd-safe-bottom);

  border-top: 1px solid alpha($border / 82%);

  background: alpha($background / 98%);

  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  &:focus-within {
    border-top-color: alpha($accent / 56%);
    background: $background;
  }

  &:jsExecution='false' {
    !display: none
  }

  /*
   * Expanded editor is the only mode allowed to overlay the console. Normal
   * REPL input is a dedicated grid row, so it can never be buried under logs
   * or the Safari bottom toolbar while the panel itself remains visible.
   */
  state(expanded=true) {
    position: absolute
    inset: 0
    z-index: var(--rd-z-sticky, 2147483540)
    width: 100%
    height: 100%
    min-height: 100%
    p: 0 0 calc(46px + var(--rd-safe-bottom))
    bg: $background
  }
`;

export const ConsolePrompt = styled.span("RodConsolePrompt").css`
  display: grid;
  flex: 0 0 auto;
  place-items: center;

  width: 30px;

  color: $accent;

  text(15px / 1 / 700)
  font-family: $font.mono;

  user-select: none;
  -webkit-user-select: none;
`;

export const ConsoleInput = styled.textarea("RodConsoleInput").css`
  flex: 1 1 auto;

  width: 100%;
  min-width: 0;

  padding: 8px 8px 6px 0;

  resize: none;

  outline: none;
  border: 0;

  color: $primary;
  background: transparent;

  text(13px / 1.35)
  font-family: $font.mono;

  user-select: text;
  -webkit-user-select: text;

  touch-action: auto;
`;

export const ConsoleCodeEditorHost = styled.div(
  "RodConsoleCodeEditorHost",
).css`
  flex: 1;

  width: 100%;

  min-width: 0;
  min-height: 100%;

  color: $primary;

  .cm-editor {
    width: 100%;
    height: 100%;

    background: transparent;

    outline: none;
  }

  .cm-scroller {
    overflow: auto;

    -webkit-overflow-scrolling: touch;

    touch-action: pan-y pan-x;
  }

  .cm-content {
    min-height: 100%;

    padding: 8px 8px 8px 2px;
  }
`;

export const ConsoleEditorActions = styled.div(
  "RodConsoleEditorActions",
).css`
  position: absolute;

  right: 0;
  bottom: var(--rd-safe-bottom);
  left: 0;

  display: none;

  height: 46px;

  border-top: 1px solid $border;

  background: $backgroundDark;

  state(expanded=true) {
    flex
  }
`;

export const ConsoleEditorButton = styled.button(
  "RodConsoleEditorButton",
).css`
  @with($control-reset)
  interactive-surface

  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-width: 34px;

  padding: 0 10px;

  border: 0;
  border-right: 1px solid alpha($border / 70%);

  color: $primary;
  background: transparent;

  font: inherit;

  cursor: pointer;

  touch-action: manipulation;

  x:hover {
    bg: $highlight
  }

  x:active {
    bg: alpha($highlight / 72%)
  }

  &[data-action="run-inline"] {
    flex: 0 0 36px;

    width: 36px;

    padding: 0;

    border-right: 0;
    border-left: 1px solid alpha($border / 64%);

    color: $accent;
  }

  &[data-action="run-editor"] {
    color: $accent;
  }
`;

/* *************** */
/* Console tables  */
/* *************** */

export const ConsoleTableWrap = styled.div("RodConsoleTableWrap").css`
  width: 100%;
  max-width: 100%;

  margin: 4px 0;

  overflow-x: auto;
  overflow-y: hidden;

  border: 1px solid alpha($border / 56%);
  border-radius: $sm;

  -webkit-overflow-scrolling: touch;

  touch-action: pan-x;
`;

export const ConsoleTable = styled.table("RodConsoleTable").css`
  width: 100%;

  border-collapse: collapse;

  color: inherit;

  text(11px / 1.4)
  font-family: $font.ui;
`;

export const ConsoleTableHead = styled.th("RodConsoleTableHead").css`
  padding: 5px 7px;

  border-bottom: 1px solid alpha($border / 70%);

  color: $primary;
  background: alpha($backgroundDark / 84%);

  text-align: left;
  white-space: nowrap;

  font-weight: 650;
`;

export const ConsoleTableCell = styled.td("RodConsoleTableCell").css`
  padding: 6px 7px;

  border-bottom: 1px solid alpha($border / 42%);

  text-align: left;
  vertical-align: top;

  word-break: break-word;
`;

/* **************** */
/* Style artifacts  */
/* **************** */

const CONSOLE_STYLED_COMPONENTS = Object.freeze([
  ConsoleSurface,
  ConsoleControl,
  ConsoleIconButton,
  ConsoleLevelBar,
  ConsoleLevels,
  ConsoleLevelButton,
  ConsoleControlSpacer,
  ConsoleFilter,
  ConsoleList,
  ConsoleRow,
  ConsoleStack,
  ConsoleRepeat,
  ConsoleGroup,
  ConsoleExternalBadge,
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

export const consoleStyleArtifacts: readonly CipoCssArtifact[] =
  Object.freeze(
    filterArray(
      flatMap(
        CONSOLE_STYLED_COMPONENTS,
        (styledComponent) => styledComponent.artifacts,
      ),
      (artifact): artifact is CipoCssArtifact =>
        artifact.kind === "cipo.css",
    ),
  );

/* *************** */
/* Console view    */
/* *************** */

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
    >
      <!--
        Primary console control row.

        This remains structurally above the scroll container, therefore it
        never travels with the records.
      -->
      <RodConsoleControl>
        <RodConsoleIconButton
          type="button"
          title="Clear console"
          aria-label="Clear console"
          :action="clear"
          @click=${event.click((click) => {
            click.preventDefault();
            view.clear();
          })}
        >
          ${icon("clear")}
        </RodConsoleIconButton>

        <RodConsoleFilter
          :consoleFilter
          type="search"
          placeholder="Filter logs…"
          aria-label="Filter console records"
          .value=${state.filterText}
          @input=${event.input<HTMLInputElement>(
            (inputEvent) => {
              view.filter(
                inputEvent.currentTarget.value,
              );
            },
          )}
        />

        <RodConsoleIconButton
          type="button"
          title="Copy console"
          aria-label="Copy console"
          :action="copy"
          @click=${event.click((copyEvent) => {
            copyEvent.preventDefault();
            view.copy();
          })}
        >
          ${icon("copy")}
        </RodConsoleIconButton>
      </RodConsoleControl>

      <!--
        Levels get their own persistent row.

        This is the important structural change requested for mobile:
        shell/tabs -> toolbar -> levels -> scrolling records.
      -->
      <RodConsoleLevelBar :consoleLevelBar>
        <RodConsoleLevels
          role="group"
          aria-label="Console levels"
        >
          ${mapArray(
            visibleLevels,
            (level) => html`
              <RodConsoleLevelButton
                :active=${() =>
                  includesArray(
                    state.enabledLevels(),
                    level,
                  )}
                :level=${level}
                type="button"
                aria-pressed=${() =>
                  includesArray(
                    state.enabledLevels(),
                    level,
                  )}
                @click=${event.click(
                  (levelEvent) => {
                    levelEvent.preventDefault();
                    view.toggleLevel(level);
                  },
                )}
              >
                ${level}
              </RodConsoleLevelButton>
            `,
          )}
        </RodConsoleLevels>
      </RodConsoleLevelBar>

      <!--
        ConsoleList is now the only vertical scrolling element in the normal
        console layout.
      -->
      <RodConsoleList
        :consoleList
        :roderudaScrollKey="console"
        ref=${(node: HTMLElement) => {
          view.setScrollContainer(node);

          return () => {
            view.setScrollContainer(null);
          };
        }}
      >
        ${repeat(
          () => view.visibleRecords(),
          (record) => record.id,
          ({ item }) =>
            () =>
              view.renderRecord(item()),
          {
            empty: () => html`
              <span class="roderuda-visually-hidden">
                No console records
              </span>
            `,
          },
        )}
      </RodConsoleList>

      <!--
        JavaScript prompt is the fourth grid row. It remains reachable on iOS
        without overlaying the final log record.
      -->
      <RodConsoleInputWrap
      :jsExecution=${state.jsExecution}
      :expanded=${state.editorExpanded}
      :consoleInputWrap
    >
      <RodConsolePrompt>
        ›
      </RodConsolePrompt>

      <RodConsoleInput
        :consoleInput
        rows="1"
        spellcheck="false"
        autocomplete="off"
        aria-label="JavaScript console"
        .value=${state.inputValue}
        ref=${(node: HTMLTextAreaElement) => {
          view.setInput(node);

          return () => {
            view.setInput(null);
          };
        }}
        @input=${event.input(
          (inputEvent) => {
            view.handleInput(inputEvent);
          },
        )}
        @keydown=${event.keydown(
          (keyboardEvent) => {
            view.handleInputKey(
              keyboardEvent,
            );
          },
        )}
        @focus=${event.focus(() => {
          view.handleInputFocus();
        })}
      />

      <RodConsoleEditorButton
        type="button"
        :action="run-inline"
        title="Run code"
        aria-label="Run code"
        @click=${event.click(() => {
          view.runEditor();
        })}
      >
        ▶
      </RodConsoleEditorButton>

      <RodConsoleEditorActions
        :expanded=${state.editorExpanded}
      >
        <RodConsoleEditorButton
          type="button"
          :action="cancel-editor"
          @click=${event.click(() => {
            view.cancelEditor();
          })}
        >
          Cancel
        </RodConsoleEditorButton>

        <RodConsoleEditorButton
          type="button"
          :action="clear-editor"
          @click=${event.click(() => {
            view.clearEditor();
          })}
        >
          Clear
        </RodConsoleEditorButton>

        <RodConsoleEditorButton
          type="button"
          :action="run-editor"
          @click=${event.click(() => {
            view.runEditor();
          })}
        >
          Run
        </RodConsoleEditorButton>
      </RodConsoleEditorActions>
      </RodConsoleInputWrap>
    </RodConsoleSurface>
  `;
});
