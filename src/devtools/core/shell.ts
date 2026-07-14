import { debugLog } from "./debug";
import { icon } from "./utils";
import type { CipoCssArtifact } from "../../cipo";
import { component, html, renderInto, repeat, signal, styled, uiState } from "./runtime";
import { DevtoolsContext } from "./context";
import { DEVTOOLS_BUILD_BADGE, DEVTOOLS_BUILD_INFO } from "./build-info";

const EMPTY_PANELS = signal<string[]>([]);

const ShellRoot = styled.div("RodDevtoolsShellRoot").css`
  min-width: 200px;
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: var(--rd-z-container, 2147483510);
  transform: translateZ(1px);
  isolation: isolate;
  contain: layout style paint;
  color: $foreground;
  font-family: $font.ui;
  font-size: var(--rd-ui-font-size, 14px);
  line-height: 1.35;
  direction: ltr;
  text-align: left;
  --rd-safe-top: env(safe-area-inset-top, 0px);
  --rd-safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--rd-safe-area-minimum, 20px));
  --rd-visual-viewport-top: 0px;
  --rd-visual-viewport-height: 100dvh;

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
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: none;
  }

  input,
  textarea,
  pre,
  code,
  [contenteditable="true"],
  .cm-editor,
  .cm-content {
    user-select: text;
    -webkit-user-select: text;
    -webkit-touch-callout: default;
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
  position: fixed;
  width: var(--rd-entry-button-size, $$entrySize);
  height: var(--rd-entry-button-size, $$entrySize);
  display: grid;
  place-items: center;
  border-radius: $panel;
  background: black;
  color: white;
  opacity: .6;
  z-index: var(--rd-z-entry, 2147483600);
  cursor: grab;
  user-select: none;
  font: 700 23px / 1 $font.ui;
  transition: opacity .3s, transform .15s;
  box-shadow: $shadow.entry;

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
  bottom: calc(var(--rd-safe-bottom) + var(--rd-dock-bottom-gap, 0px));
  width: 100%;
  height: min(
    calc(80% - var(--rd-safe-bottom)),
    calc(var(--rd-visual-viewport-height, 100dvh) - var(--rd-visual-viewport-top, 0px) - var(--rd-safe-top, env(safe-area-inset-top, 0px)) - var(--rd-safe-bottom) - 12px)
  );
  max-height: calc(var(--rd-visual-viewport-height, 100dvh) - var(--rd-visual-viewport-top, 0px) - var(--rd-safe-top, env(safe-area-inset-top, 0px)) - var(--rd-safe-bottom) - 12px);
  z-index: var(--rd-z-dock, 2147483520);
  display: none;
  padding-top: var(--rd-tab-height, $$tabHeight);
  opacity: 0;
  background: $background;
  border-top: 1px solid $border;
  box-shadow: $shadow.panel;
  transition: opacity var(--rd-animation-duration, 300ms);
  overflow: hidden;
  contain: layout style paint;
 backdrop-filter: blur(var(--rd-blur, 0px));

  &[data-inline="true"] {
    position: absolute;
    bottom: 0;
    height: 100%;
    display: block;
    opacity: 1;
  }
`;

const Resizer = styled.div("RodDevtoolsResizer").css`
  position: absolute;
  left: 0;
  top: calc(var(--rd-resizer-height, 30px) * -.6);
  width: 100%;
  height: var(--rd-resizer-height, 30px);
  touch-action: none;
  cursor: row-resize;
  z-index: var(--rd-z-resizer, 2147483590);

  &::after {
    content: "";
    display: block;
    width: var(--rd-resizer-handle-width, 64px);
    height: var(--rd-resizer-handle-height, 6px);
    margin: 12px auto 0;
    border-radius: $pill;
    background: mix($primary, transparent, 55%);
    box-shadow: $shadow.entry;
  }
`;

const Tabbar = styled.nav("RodDevtoolsTabbar").css`
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: var(--rd-tab-height, $$tabHeight);
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  background: $backgroundDark;
  border-bottom: 1px solid $border;
  color: $primary;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    display: none;
  }
`;


const BuildBadge = styled.span("RodDevtoolsBuildBadge").css`
  position: sticky;
  right: 4px;
  align-self: center;
  flex: 0 0 auto;
  margin-inline: auto 6px;
  padding: 2px 6px;
  border: 1px solid $border;
  border-radius: $pill;
  background: mix($backgroundDark, transparent, 88%);
  color: $muted;
  font: 600 9px / 1.4 $font.mono;
  white-space: nowrap;
  pointer-events: auto;
  user-select: text;
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
  position: absolute;
  top: var(--rd-notification-top, 48px);
  left: 50%;
  z-index: var(--rd-z-notification, 2147483560);
  width: min(92%, var(--rd-notification-width, 440px));
  display: grid;
  gap: 7px;
  transform: translateX(-50%);
  pointer-events: none;
`;

const ModalRoot = styled.div("RodDevtoolsModalRoot").css`
  position: absolute;
  inset: 0;
  z-index: var(--rd-z-modal, 2147483570);
  display: none;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / .45);
  backdrop-filter: blur(2px);
  pointer-events: none;

  &[data-active="true"],
  &.roderuda-active {
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
  BuildBadge,
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

interface ShellViewProps {
  refs: Partial<ShellRefs>;
}

component<ShellViewProps>("RodDevtoolsShell", function RodDevtoolsShell(props, ctx) {
  const { inline } = ctx.requireContext(DevtoolsContext);
  const refs = props.refs;

  return html`
    <RodDevtoolsShellRoot
      :inline=${inline}
      :roderudaRoot
      :roderudaShellRef="root"
      ref=${(node) => {
        refs.root = node;
        uiState.setPath("shell.mounted", true);
        return () => uiState.setPath("shell.mounted", false);
      }}
    >
      <RodDevtoolsEntryButton
        type="button"
        aria-label="Open developer tools"
        title="RodEruda"
        :roderudaShellRef="entryButton"
        ref=${(node) => {
          refs.entryButton = node;
        }}
      >
        ${icon("bug")}
      </RodDevtoolsEntryButton>

      <RodDevtoolsDock
        :inline=${inline}
        aria-label="Developer tools"
        aria-hidden="true"
        :roderudaShellRef="devtools"
        ref=${(node) => {
          refs.devtools = node;
        }}
      >
        <RodDevtoolsResizer
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize developer tools"
          :roderudaShellRef="resizer"
          ref=${(node) => {
            refs.resizer = node;
          }}
        />

        <RodDevtoolsTabbar
          aria-label="Developer tools panels"
          :roderudaShellRef="tabbar"
          ref=${(node) => {
            refs.tabbar = node;
          }}
        >
          ${repeat(EMPTY_PANELS, (name) => name, ({ item }) => html`<span hidden>${item()}</span>`)}
          <RodDevtoolsBuildBadge :roderudaBuildBadge title=${`Build ${DEVTOOLS_BUILD_INFO.sha} · ${DEVTOOLS_BUILD_INFO.builtAtGmtMinus3}`}>${DEVTOOLS_BUILD_BADGE}</RodDevtoolsBuildBadge>
        </RodDevtoolsTabbar>

        <RodDevtoolsTools
          :roderudaShellRef="tools"
          ref=${(node) => {
            refs.tools = node;
          }}
        />

        <RodDevtoolsNotifications
          aria-live="polite"
          :roderudaShellRef="notifications"
          ref=${(node) => {
            refs.notifications = node;
          }}
        />

        <RodDevtoolsModalRoot
          role="presentation"
          :roderudaShellRef="modalRoot"
          ref=${(node) => {
            refs.modalRoot = node;
          }}
        />
      </RodDevtoolsDock>
    </RodDevtoolsShellRoot>
  `;
});

export function renderShell(target: HTMLElement | ShadowRoot, inline = false): ShellRefs {
  const refs = {} as Partial<ShellRefs>;

  debugLog("shell", "render:start", {
    inline,
    target: target instanceof ShadowRoot ? "shadow" : "element",
  });

  uiState.setPath("shell.inline", inline);

  renderInto(target, () => html`<RodDevtoolsShell .refs=${refs} />`);

  debugLog("shell", "mounted");
  uiState.setPath("shell.mounted", true);

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
