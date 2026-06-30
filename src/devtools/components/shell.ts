import { event, html, onMount, onUnmount, portal, ref, renderInto, repeat, signal, styled, suspense, uiState } from "./runtime";

const EMPTY_PANELS = signal<string[]>([]);
const READY_RESOURCE = signal({ loading: false, error: undefined as unknown, value: true });

const ShellRoot = styled.div("RodDevtoolsShellRoot").css`
  position: relative;
  width: 100%;
  height: 100%;
`;

const EntryButtonView = styled.button("RodDevtoolsEntryButton").css`
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
  uiState.setPath("shell.inline", inline);

  renderInto(target, html`
    <RodDevtoolsShellRoot
      class=${`roderuda-container${inline ? " roderuda-inline" : ""}`}
      data-roderuda-root
      data-roderuda-shell-ref="root"
      ref=${ref((node) => {
        refs.root = node as HTMLElement;
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
        @click=${event((event: Event) => event.stopPropagation())}
        ref=${ref((node) => { refs.entryButton = node as HTMLButtonElement; })}
      >⌘</RodDevtoolsEntryButton>

      ${suspense(READY_RESOURCE, () => html`
          <RodDevtoolsDock
            class="roderuda-dev-tools"
            aria-label="Developer tools"
            aria-hidden="true"
            data-roderuda-shell-ref="devtools"
            ref=${ref((node) => { refs.devtools = node as HTMLElement; })}
          >
            <RodDevtoolsResizer
              class="roderuda-resizer"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize developer tools"
              data-roderuda-shell-ref="resizer"
              ref=${ref((node) => { refs.resizer = node as HTMLElement; })}
                />
            <RodDevtoolsTabbar
              class="roderuda-tabbar"
              aria-label="Developer tools panels"
              data-roderuda-shell-ref="tabbar"
              ref=${ref((node) => { refs.tabbar = node as HTMLElement; })}
            >
              ${repeat(EMPTY_PANELS, (name) => name, ({ item }) => html`<span hidden>${item()}</span>`)}
            </RodDevtoolsTabbar>
            <RodDevtoolsTools
              class="roderuda-tools"
              data-roderuda-shell-ref="tools"
              ref=${ref((node) => { refs.tools = node as HTMLElement; })}
                />
            <RodDevtoolsNotifications
              class="roderuda-notifications"
              aria-live="polite"
              data-roderuda-shell-ref="notifications"
              ref=${ref((node) => { refs.notifications = node as HTMLElement; })}
                />
            <RodDevtoolsModalRoot
              class="roderuda-modal-root"
              role="presentation"
              data-roderuda-shell-ref="modalRoot"
              ref=${ref((node) => { refs.modalRoot = node as HTMLElement; })}
                />
            ${portal(target, html`<span hidden data-roderuda-portal-probe></span>`)}
          </RodDevtoolsDock>
        `, () => html`<div class="roderuda-empty">Loading devtools shell…</div>`, (error) => html`<div class="roderuda-empty">${String(error)}</div>`)}
    </RodDevtoolsShellRoot>
  `);

  onMount(() => uiState.setPath("shell.mounted", true));
  onUnmount(() => uiState.setPath("shell.mounted", false));

  return assertShellRefs(refs, target);
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
