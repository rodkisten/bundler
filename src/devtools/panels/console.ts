import { debugLog } from "../core/debug";
import { icon } from "../core/dom";
import type { CipoCssArtifact } from "../../cipo";
import { html, ref, renderInto, repeat, signal, styled, uiState } from "./runtime";

const EMPTY_PANELS = signal<string[]>([]);

const ShellRoot = styled.div("RodDevtoolsShellRoot").css`
  min-width: 200px;
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  isolation: isolate;
  contain: layout style paint;
  color: $foreground;
  font-family: $font.ui;
  font-size: 14px;
  line-height: 1.35;
  direction: ltr;
  text-align: left;

  &[data-inline="true"] {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 320px;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: none;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
    color: inherit;
  }

  button {
    appearance: none;
    border: 0;
    margin: 0;
  }
`;

const EntryButtonView = styled.button("RodDevtoolsEntryButton").css`
  touch-action: none;
  user-select: none;
  position: fixed;
  width: $$entrySize;
  height: $$entrySize;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: $panel;
  background: black;
  color: white;
  opacity: .3;
  z-index: $$entryZ;
  cursor: grab;
  font: 700 23px / 1 $font.ui;
  box-shadow: $shadow.entry;
  transition: opacity .3s, transform .15s;

  &:hover,
  &:active,
  &[data-active="true"] {
    opacity: .82;
  }

  &:active {
    cursor: grabbing;
    transform: scale(.96);
  }
`;

const DevtoolsDock = styled.section("RodDevtoolsDock").css`
  pointer-events: auto;
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 80%;
  z-index: $$toolsZ;
  display: none;
  padding-top: $$tabHeight;
  opacity: 0;
  overflow: hidden;
  contain: layout style paint;
  background: $background;
  border-top: 1px solid $border;
  box-shadow: $shadow.panel;
  transition: opacity .3s;

  &[data-inline="true"] {
    position: absolute;
    height: 100%;
    display: block;
    opacity: 1;
  }
`;

const Resizer = styled.div("RodDevtoolsResizer").css`
  position: absolute;
  left: 0;
  top: -18px;
  z-index: $$entryZ;
  width: 100%;
  height: 30px;
  touch-action: none;
  cursor: row-resize;

  &::after {
    content: "";
    display: block;
    width: 64px;
    height: 6px;
    margin: 12px auto 0;
    border-radius: $pill;
    background: mix($primary, transparent, 55%);
    box-shadow: $shadow.entry;
  }
`;

const Tabbar = styled.nav("RodDevtoolsTabbar").css`
  position: absolute;
  inset: 0 0 auto 0;
  height: $$tabHeight;
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  background: $backgroundDark;
  border-bottom: 1px solid $border;
  color: $primary;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Tools = styled.main("RodDevtoolsTools").css`
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

const Notifications = styled.div("RodDevtoolsNotifications").css`
  pointer-events: none;
  position: absolute;
  top: 48px;
  left: 50%;
  z-index: 1000;
  width: min(92%, 440px);
  display: grid;
  gap: 7px;
  transform: translateX(-50%);
`;

const ModalRoot = styled.div("RodDevtoolsModalRoot").css`
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: $$overlayZ;
  display: none;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / .45);
  backdrop-filter: blur(2px);

  &[data-active="true"] {
    display: grid;
    pointer-events: auto;
  }
`;

const SHELL_STYLED_COMPONENTS = Object.freeze([
  ShellRoot,
  EntryButtonView,
  DevtoolsDock,
  Resizer,
  Tabbar,
  Tools,
  Notifications,
  ModalRoot,
]);

export const shellStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  SHELL_STYLED_COMPONENTS
    .flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

export interface ShellRefs {
  root: HTMLElement;
  entryButton: HTMLButtonElement;
  devtools: HTMLElement;
  resizer: HTMLElement;
  tabbar: HTMLElement;
  tools: HTMLElement;
  notifications: HTMLElement;
  modalRoot: HTMLElement;
}

export function renderShell(target: HTMLElement | ShadowRoot, inline = false): ShellRefs {
  const refs = {} as Partial<ShellRefs>;

  debugLog("shell", "render:start", {
    inline,
    target: target instanceof ShadowRoot ? "shadow" : "element",
  });

  uiState.setPath("shell.inline", inline);

  renderInto(target, () => html`
    <RodDevtoolsShellRoot
      data-inline=${String(inline)}
      data-roderuda-root
      data-roderuda-shell-ref="root"
      ref=${ref<HTMLElement>((node) => {
        refs.root = node;
        uiState.setPath("shell.mounted", true);
        return () => uiState.setPath("shell.mounted", false);
      })}
    >
      <RodDevtoolsEntryButton
        type="button"
        aria-label="Open developer tools"
        title="RodEruda"
        data-roderuda-shell-ref="entryButton"
        ref=${ref<HTMLButtonElement>((node) => {
          refs.entryButton = node;
        })}
      >
        ${icon("bug")}
      </RodDevtoolsEntryButton>

      <RodDevtoolsDock
        data-inline=${String(inline)}
        aria-label="Developer tools"
        aria-hidden="true"
        data-roderuda-shell-ref="devtools"
        ref=${ref<HTMLElement>((node) => {
          refs.devtools = node;
        })}
      >
        <RodDevtoolsResizer
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize developer tools"
          data-roderuda-shell-ref="resizer"
          ref=${ref<HTMLElement>((node) => {
            refs.resizer = node;
          })}
        />

        <RodDevtoolsTabbar
          aria-label="Developer tools panels"
          data-roderuda-shell-ref="tabbar"
          ref=${ref<HTMLElement>((node) => {
            refs.tabbar = node;
          })}
        >
          ${repeat(EMPTY_PANELS, (name) => name, ({ item }) => html`<span hidden>${item()}</span>`)}
        </RodDevtoolsTabbar>

        <RodDevtoolsTools
          data-roderuda-shell-ref="tools"
          ref=${ref<HTMLElement>((node) => {
            refs.tools = node;
          })}
        />

        <RodDevtoolsNotifications
          aria-live="polite"
          data-roderuda-shell-ref="notifications"
          ref=${ref<HTMLElement>((node) => {
            refs.notifications = node;
          })}
        />

        <RodDevtoolsModalRoot
          data-active="false"
          role="presentation"
          data-roderuda-shell-ref="modalRoot"
          ref=${ref<HTMLElement>((node) => {
            refs.modalRoot = node;
          })}
        />
      </RodDevtoolsDock>
    </RodDevtoolsShellRoot>
  `);

  const shellRefs = assertShellRefs(refs, target);

  debugLog("shell", "render:end", { refs: Object.keys(shellRefs) });

  return shellRefs;
}

function assertShellRefs(refs: Partial<ShellRefs>, target: HTMLElement | ShadowRoot): ShellRefs {
  const keys = [
    "root",
    "entryButton",
    "devtools",
    "resizer",
    "tabbar",
    "tools",
    "notifications",
    "modalRoot",
  ] as const;

  for (const key of keys) {
    if (refs[key]) continue;

    const node = target.querySelector(`[data-roderuda-shell-ref="${key}"]`);
    if (node) assignShellRef(refs, key, node);
  }

  const missing = keys.filter((key) => !refs[key]);
  if (missing.length) {
    throw new Error(`[RodEruda] Shell did not mount: ${missing.join(", ")}`);
  }

  return refs as ShellRefs;
}

function assignShellRef(refs: Partial<ShellRefs>, key: keyof ShellRefs, node: Element): void {
  if (key === "entryButton") {
    refs.entryButton = node as HTMLButtonElement;
    return;
  }

  refs[key] = node as HTMLElement;
}
