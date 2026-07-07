import { debugLog } from "../core/debug";
import { icon } from "../core/dom";
import type { CipoCssArtifact } from "../../cipo";
import { html, ref, renderInto, repeat, signal, styled, uiState } from "./runtime";

const EMPTY_PANELS = signal<string[]>([]);
const ShellRoot = styled.div("RodDevtoolsShellRoot").css`
  position: relative;
  width: 100%;
  height: 100%;
`;

const EntryButtonView = styled.button("RodDevtoolsEntryButton").css`
  z-index: 99999999;
  touch-action: none;
  user-select: none;
`;

const DevtoolsDock = styled.section("RodDevtoolsDock").css`
  contain: layout style paint;
`;

const Resizer = styled.div("RodDevtoolsResizer").css`
  touch-action: none;
`;

const Tabbar = styled.nav("RodDevtoolsTabbar").css`
  overscroll-behavior-x: contain;
`;

const Tools = styled.main("RodDevtoolsTools").css`
  min-width: 0;
  min-height: 0;
`;

const Notifications = styled.div("RodDevtoolsNotifications").css`
  pointer-events: none;
`;

const ModalRoot = styled.div("RodDevtoolsModalRoot").css`
  pointer-events: none;
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
  SHELL_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
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
  debugLog("shell", "render:start", { inline, target: target instanceof ShadowRoot ? "shadow" : "element" });
  uiState.setPath("shell.inline", inline);

  renderInto(target, () => html`
    <RodDevtoolsShellRoot
      class=${`roderuda-container${inline ? " roderuda-inline" : ""}`}
      data-roderuda-root
      data-roderuda-shell-ref="root"
      ref=${ref<HTMLElement>((node) => {
        refs.root = node;
        uiState.setPath("shell.mounted", true);
        return () => uiState.setPath("shell.mounted", false);
      })}
    >
      <RodDevtoolsEntryButton
        class="roderuda-entry-btn"
        type="button"
        aria-label="Open developer tools"
        title="RodEruda"
        data-roderuda-shell-ref="entryButton"
        ref=${ref<HTMLButtonElement>((node) => { refs.entryButton = node; })}
      >${icon("bug")}</RodDevtoolsEntryButton>

      <RodDevtoolsDock
        class="roderuda-dev-tools"
        aria-label="Developer tools"
        aria-hidden="true"
        data-roderuda-shell-ref="devtools"
        ref=${ref<HTMLElement>((node) => { refs.devtools = node; })}
      >
        <RodDevtoolsResizer
          class="roderuda-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize developer tools"
          data-roderuda-shell-ref="resizer"
          ref=${ref<HTMLElement>((node) => { refs.resizer = node; })}
        />
        <RodDevtoolsTabbar
          class="roderuda-tabbar"
          aria-label="Developer tools panels"
          data-roderuda-shell-ref="tabbar"
          ref=${ref<HTMLElement>((node) => { refs.tabbar = node; })}
        >
          ${repeat(EMPTY_PANELS, (name) => name, ({ item }) => html`<span hidden>${item()}</span>`)}
        </RodDevtoolsTabbar>
        <RodDevtoolsTools
          class="roderuda-tools"
          data-roderuda-shell-ref="tools"
          ref=${ref<HTMLElement>((node) => { refs.tools = node; })}
        />
        <RodDevtoolsNotifications
          class="roderuda-notifications"
          aria-live="polite"
          data-roderuda-shell-ref="notifications"
          ref=${ref<HTMLElement>((node) => { refs.notifications = node; })}
        />
        <RodDevtoolsModalRoot
          class="roderuda-modal-root"
          role="presentation"
          data-roderuda-shell-ref="modalRoot"
          ref=${ref<HTMLElement>((node) => { refs.modalRoot = node; })}
        />
      </RodDevtoolsDock>
    </RodDevtoolsShellRoot>
  `);

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
  if (missing.length) throw new Error(`[RodEruda] Shell did not mount: ${missing.join(", ")}`);
  return refs as ShellRefs;
}


function assignShellRef(refs: Partial<ShellRefs>, key: keyof ShellRefs, node: Element): void {
  if (key === "entryButton") {
    refs.entryButton = node as HTMLButtonElement;
    return;
  }
  refs[key] = node as HTMLElement;
}
