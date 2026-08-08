import type { CipoCssArtifact } from "@rodkisten/cipo";
import { DEVTOOLS_BUILD_BADGE, DEVTOOLS_BUILD_INFO } from "@rodkisten/devtools/core/build-info";
import { DevtoolsContext } from "@rodkisten/devtools/core/context";
import { debugLog } from "@rodkisten/devtools/core/debug";
import { component, event, html, renderInto, repeat, styled } from "@rodkisten/devtools/core/runtime";
import { icon } from "@rodkisten/devtools/core/utils";
import type { DevtoolsContextValue, DevtoolsShellRefs } from "@rodkisten/devtools/types";
import { filterArray, flatMap, joinArray, objectKeys } from "@rodkisten/nascente";


const ShellRoot = styled.div("RodDevtoolsShellRoot").css`
  position: fixed;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  min-width: 0;
  min-height: 0;
  overflow: visible;
  pointer-events: none !important;
  background: transparent !important;
  z-index: var(--rd-z-container, 2147483510);
  isolation: isolate;
  contain: style;
  color: $theme.colors.foreground;
  text(
    size: var(--rd-ui-font-size, 12px),
    lh: 1.15,
    family: $font.ui
  )
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
    min-width: 200px;
    min-height: 320px;
    overflow: hidden;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
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
    @with($control-reset)
  }

  @media (max-width: 768px) {
  :root {
    /*
     * Escala fluida no mobile:
     * 320px → 0.75  → 12px visuais
     * 768px → 0.875 → 14px visuais
     */
    --form-font-scale: clamp(
      0.75,
      calc(0.660714 + 2.790179vw),
      0.875
    );
  }

  input:not(
    [type="checkbox"],
    [type="radio"],
    [type="range"],
    [type="color"],
    [type="file"],
    [type="button"],
    [type="submit"],
    [type="reset"]
  ),
  textarea,
  select {
    /* Mantém 16px computados para impedir o zoom do Safari/iOS */
    font-size: 16px !important;

    /* Escala visual equivalente a 12–14px */
    scale: var(--form-font-scale) !important;

    /* Evita o campo encolher em direção ao centro */
    transform-origin: left center !important;
  }
}
`;

const EntryButtonView = styled.button("RodDevtoolsEntryButton").css`
  $interactive-surface

  pointer-events: auto !important
  touch-action: none
  position: fixed
  width: var(--rd-entry-button-size, 36px)
  height: var(--rd-entry-button-size, 36px)
  display: grid
  place-items: center
  padding: 0
  color: rgb(255 255 255 / .9)
  background: rgb(16 16 20 / .34)
  backdrop-filter: blur(12px) saturate(145%)
  -webkit-backdrop-filter: blur(12px) saturate(145%)
  opacity: .72
  z-index: var(--rd-z-entry, 2147483600)
  cursor: grab
  border: 1px solid rgb(255 255 255 / .28)
  rounded: $pill
  transition: opacity .2s, transform .15s, background .2s
  box-shadow: 0 4px 14px rgb(0 0 0 / .24)

  svg {
    width: 24px
    height: 24px
  }

  x:hover {
    opacity: .94
    background: rgb(16 16 20 / .52)
  }

  state(active=true) {
    opacity: 1
  }

  x:active {
    cursor: grabbing
    transform: scale(.94)
  }
`;

const DevtoolsDock = styled.section("RodDevtoolsDock").css`
  pointer-events: none !important;
  position: fixed;
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
  visibility: hidden;
  opacity: 0;
  background: $background;
  border-top: 1px solid $border;
  box-shadow: $shadow.panel;
  transition: opacity var(--rd-animation-duration, 300ms);
  overflow: hidden;
  contain: layout style paint;
  backdrop-filter: blur(var(--rd-blur, 0px));
  touch-action: pan-y pan-x;

  container(devtoolsDock) {
    inline-size
  }

  state(active=true) {
    display: block
    visibility: visible
    pointer-events: auto !important
    opacity: var(--rd-transparency, .95)
  }

  state(inline=true) {
    display: block
    position: absolute
    bottom: 0
    height: 100%
    visibility: visible
    pointer-events: auto !important
    opacity: 1
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

  group(dock, active=true) {
    visibility: visible
  }

  &::-webkit-scrollbar {
    display: none;
  }
`;


const ToolPanel = styled.section("RodDevtoolsToolPanel").css`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  touch-action: pan-y pan-x;
  background: $background;

  &[hidden] {
    display: none !important;
  }
`;

const TabButton = styled.button("RodDevtoolsTabButton").css`
  @with($control-reset)
  interactive-surface

  position: relative;
  flex: 0 0 auto;
  min-width: var(--rd-tab-min-width, 78px);
  height: var(--rd-tab-height, 40px);
  padding: 0 var(--rd-panel-gap, 10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-transform: capitalize;
  font-size: var(--rd-tab-font-size, 12px);
  white-space: nowrap;
  transition: color .2s, background .2s;

  x:hover {
    background: mix($highlight, transparent, 70%);
  }

  state(selected=true) {
    color: $accent;
  }

  &:selected='true'::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 0;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: $accent;
  }

  slot(icon) {
    display: inline-grid
    place-items: center
  }

  slot(label) {
    truncate-inline
  }

  x:cq(devtoolsDock <= xs) {
    min-width: var(--rd-compact-tab-min-width, 58px);
    padding-inline: 7px;
  }
`;

const TabIcon = styled.span("RodDevtoolsTabIcon").css`
  display: inline-grid;
  place-items: center;
  font-size: 15px;
  line-height: 1;

  .roderuda-lucide-icon {
    display: block;
    flex: 0 0 auto;
    stroke: currentColor;
  }

  x:cq(devtoolsDock <= xs) {
    font-size: 17px;
  }
`;

const TabLabel = styled.span("RodDevtoolsTabLabel").css`
  truncate-inline

  x:container(devtoolsDock, max: xs) {
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
  color: $muted ?? $foreground;
  text(9px / 1.4 / 600)
  font-family: $font.mono;
  motion(opacity: 0 -> 1, y: 2px -> 0, duration: 180ms, easing: ease-out)
  white-space: nowrap;
  pointer-events: auto;
  user-select: text;
`;


const DockActionButton = styled.button("RodDevtoolsDockActionButton").css`
  @with($control-reset)
  $interactive-surface

  position: sticky;
  right: 4px;
  align-self: center;
  flex: 0 0 auto;
  width: 34px;
  height: 30px;
  margin: 5px 4px 5px 0;
  display: inline-grid;
  place-items: center;
  border: 1px solid $border;
  border-radius: $control;
  background: mix($backgroundDark, transparent, 82%);
  color: $primary;
  cursor: pointer;
  transition: color .18s, background .18s, transform .12s;

  x:hover {
    background: $highlight;
    color: $accent;
  }

  x:active {
    transform: scale(.92);
  }
`;

const Tools = styled.main("RodDevtoolsTools").css`
  position: absolute;
  inset: var(--rd-tab-height, $$tabHeight) 0 0;
  width: auto;
  height: auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

const Notifications = styled.div("RodDevtoolsNotifications").css`
  position: fixed;
  top: var(--rd-notification-top, 48px);
  left: 50%;
  z-index: var(--rd-z-notification, 2147483560);
  width: {
    base: min(92%, var(--rd-notification-width, 440px)),
    md: min(92%, var(--rd-notification-width, 440px))
  }
  display: grid;
  gap: 7px;
  transform: translateX(-50%);
  pointer-events: none;
`;

const ModalRoot = styled.div("RodDevtoolsModalRoot").css`
  position: fixed;
  inset: 0;
  z-index: var(--rd-z-modal, 2147483570);
  display: none;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / .45);
  backdrop-filter: blur(2px);
  pointer-events: none;

  state(active=true) {
    display: grid
    pointer-events: auto
  }

  &.roderuda-active {
    display: grid
    pointer-events: auto
  }
`;

const NotificationToast = styled.div("RodDevtoolsNotificationToast").css`
  pointer-events: auto;
  padding: 10px 12px;
  border: 1px solid $border;
  border-radius: $notification;
  color: $primary;
  background: mix($background, transparent, 94%);
  box-shadow: $shadow.notification;
  backdrop-filter: blur(14px);
  opacity: 0;
  transform: translateY(-7px) scale(.98);
  transition: opacity .18s ease-out, transform .18s ease-out;

  state(active=true) {
    opacity: 1
    transform: translateY(0) scale(1)
  }

  variant(type) {
    success {
      border-color: $success
    }

    warning {
      border-color: $warningBorder
      background: $warningBg
      color: $warningFg
    }

    error {
      border-color: $errorBorder
      background: $errorBg
      color: $errorFg
    }
  }

  compound(active: true, type: [warning, error]) {
    opacity: 1
  }
`;

const ModalSurface = styled.form("RodDevtoolsModalSurface").css`
  width: min(100%, var(--rd-modal-max-width, 480px));
  max-height: min(80vh, var(--rd-modal-max-height, 620px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $background;
  border: 1px solid $border;
  border-radius: $modal;
  box-shadow: $shadow.modal;
`;

const ModalBox = styled.div("RodDevtoolsModalBox").css`
  width: min(100%, var(--rd-modal-max-width, 480px));
  max-height: min(80vh, var(--rd-modal-max-height, 620px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: $background;
  border: 1px solid $border;
  border-radius: $modal;
  box-shadow: $shadow.modal;
`;

const ModalTitle = styled.div("RodDevtoolsModalTitle").css`
  padding: 13px 14px;
  color: $primary;
  font-weight: 700;
  border-bottom: 1px solid $border;
`;

const ModalBody = styled.div("RodDevtoolsModalBody").css`
  padding: 14px;
  overflow: auto;
  color: $foreground;
  user-select: text;
`;

const ModalInput = styled.input("RodDevtoolsModalInput").css`
  width: 100%;
  min-width: 0;
  margin-top: 12px;
  padding: 9px 10px;
  border: 1px solid $border;
  border-radius: $control;
  outline: none;
  background: $backgroundDark;
  color: $primary;
  user-select: text;

  x:focus {
    border-color: $accent;
  }
`;

const ModalActions = styled.div("RodDevtoolsModalActions").css`
  padding: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid $border;
`;

const TextButton = styled.button("RodDevtoolsTextButton").css`
  @with($control-reset)
  $interactive-surface

  flex: 0 0 auto;
  min-width: 74px;
  min-height: 28px;
  padding: 8px 11px;
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: $control;
  background: $backgroundDark;
  color: $primary;
  cursor: pointer;
  font: inherit;
  font-size: fluid(12px, 12px);
  transition: color .18s, background .18s, transform .1s;

  x:hover {
    background: $highlight;
    color: $selectedForeground;
  }

  x:active {
    transform: scale(.94);
    color: $accent;
  }

  state(primary=true) {
    background: $accent;
    color: white;
  }
`;


const SHELL_STYLED_COMPONENTS = Object.freeze([
  ShellRoot,
  EntryButtonView,
  DevtoolsDock,
  Resizer,
  Tabbar,
  ToolPanel,
  TabButton,
  TabIcon,
  TabLabel,
  BuildBadge,
  DockActionButton,
  Tools,
  Notifications,
  ModalRoot,
  NotificationToast,
  ModalSurface,
  ModalBox,
  ModalTitle,
  ModalBody,
  ModalInput,
  ModalActions,
  TextButton,
]);

export const shellStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  filterArray(flatMap(SHELL_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts), (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

export type ShellRefs = DevtoolsShellRefs;

export interface ShellMount {
  readonly refs: ShellRefs;
  readonly dispose: () => void;
}

interface ShellViewProps {
  refs: Partial<ShellRefs>;
}

component<ShellViewProps>("RodDevtoolsShell", function RodDevtoolsShell(props, ctx) {
  const shared = ctx.requireContext(DevtoolsContext);
  const refs = props.refs;

  return html`
    <RodDevtoolsShellRoot
      :inline=${shared.inline}
      :roderudaRoot
      :roderudaShellRef="root"
      ref=${(node: HTMLElement) => {
        refs.root = node;
      }}
    >
      <RodDevtoolsEntryButton
        type="button"
        aria-label="Open developer tools"
        aria-expanded=${() => String(shared.visible())}
        title="Open RodEruda developer tools"
        @click=${event.click((click) => {
          click.preventDefault();
          click.stopPropagation();
          shared.controller.peek()?.toggle();
        })}
        :roderudaShellRef="entryButton"
        ref=${(node: HTMLButtonElement) => {
          refs.entryButton = node;
        }}
      >
        ${icon("bug", {
           width: 36,
           height: 36,
        })}
      </RodDevtoolsEntryButton>

      <section
        class=${DevtoolsDock.className}
        data-group="dock"
        data-inline=${String(shared.inline)}
        data-active=${() => String(shared.visible())}
        aria-label="Developer tools"
        aria-hidden=${() => String(!shared.visible())}
        data-roderuda-shell-ref="devtools"
        ref=${(node: HTMLElement) => {
          refs.devtools = node;
        }}
      >
        <RodDevtoolsResizer
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize developer tools"
          :roderudaShellRef="resizer"
          @pointerdown=${event.pointerdown((pointer) => shared.controller.peek()?.beginResize?.(pointer))}
          @pointermove=${event.pointermove((pointer) => shared.controller.peek()?.updateResize?.(pointer))}
          @pointerup=${event.pointerup((pointer) => shared.controller.peek()?.endResize?.(pointer))}
          @pointercancel=${event.pointercancel((pointer) => shared.controller.peek()?.endResize?.(pointer))}
          ref=${(node: HTMLElement) => {
            refs.resizer = node;
          }}
        />

        <RodDevtoolsTabbar
          aria-label="Developer tools panels"
          :roderudaShellRef="tabbar"
          ref=${(node: HTMLElement) => {
            refs.tabbar = node;
          }}
        >
          ${repeat(shared.tools, (entry) => entry.name, ({ item }) => html`
            <RodDevtoolsTabButton
              type="button"
              role="tab"
              :toolTab=${() => item().name}
              :selected=${() => shared.activePanel() === item().name}
              aria-selected=${() => String(shared.activePanel() === item().name)}
              hidden=${() => item().disabled}
              draggable=${() => item().name === "settings" ? "false" : "true"}
              @click=${event.click((click) => {
                click.preventDefault();
                item().activate();
              })}
              @dragstart=${event.dragstart((drag) => item().dragStart(drag))}
              @dragover=${event.dragover((drag) => item().dragOver(drag))}
              @drop=${event.drop((drop) => item().drop(drop))}
            >
              <RodDevtoolsTabIcon :slot="icon">${renderToolIcon(item().icon, item().name)}</RodDevtoolsTabIcon>
              <RodDevtoolsTabLabel :slot="label">${() => item().title}</RodDevtoolsTabLabel>
            </RodDevtoolsTabButton>
          `)}
          <RodDevtoolsBuildBadge :roderudaBuildBadge title=${`Build ${DEVTOOLS_BUILD_INFO.sha} · ${DEVTOOLS_BUILD_INFO.builtAtGmtMinus3}`}>${DEVTOOLS_BUILD_BADGE}</RodDevtoolsBuildBadge>
          <RodDevtoolsDockActionButton
            type="button"
            aria-label="Minimize developer tools"
            title="Minimize"
            :roderudaShellRef="minimizeButton"
            @click=${event.click((click) => {
              click.preventDefault();
              click.stopPropagation();
              shared.controller.peek()?.hide();
            })}
          >
            ${icon("collapse", { width: 18, height: 18 })}
          </RodDevtoolsDockActionButton>
        </RodDevtoolsTabbar>

        <RodDevtoolsTools
          :roderudaShellRef="tools"
          ref=${(node: HTMLElement) => {
            refs.tools = node;
          }}
        >
          ${repeat(shared.tools, (entry) => entry.name, ({ item }) => html`
            <RodDevtoolsToolPanel
              role="tabpanel"
              :tool=${() => item().name}
              aria-label=${() => item().title}
              hidden=${() => item().disabled || shared.activePanel() !== item().name}
              ref=${(node: HTMLElement) => item().mount(node)}
            >
              ${item().view()}
            </RodDevtoolsToolPanel>
          `)}
        </RodDevtoolsTools>

        <RodDevtoolsNotifications
          aria-live="polite"
          :roderudaShellRef="notifications"
          ref=${(node: HTMLElement) => {
            refs.notifications = node;
          }}
        >
          ${repeat(shared.notifications, (entry) => entry.id, ({ item }) => html`
            <RodDevtoolsNotificationToast
              role=${() => item().type === "error" ? "alert" : "status"}
              :type=${() => item().type}
              :active=${() => item().active()}
              :notification=${() => item().id}
              @click=${event.click((click) => {
                click.preventDefault();
                item().dismiss();
              })}
            >
              ${() => item().message}
            </RodDevtoolsNotificationToast>
          `)}
        </RodDevtoolsNotifications>

        <RodDevtoolsModalRoot
          role="presentation"
          :active=${() => shared.modal() != null}
          :roderudaShellRef="modalRoot"
          ref=${(node: HTMLElement) => {
            refs.modalRoot = node;
          }}
        >
          ${shared.modal}
        </RodDevtoolsModalRoot>
      </section>
    </RodDevtoolsShellRoot>
  `;
});

/** Mounts the whole DevTools application under one Fábrica context provider. */
export function renderShell(
  target: HTMLElement | ShadowRoot,
  shared: DevtoolsContextValue,
): ShellMount {
  const refs = {} as Partial<ShellRefs>;

  debugLog("shell", "render:start", {
    inline: shared.inline,
    target: target instanceof ShadowRoot ? "shadow" : "element",
  });

  const dispose = renderInto(target, html`
    <${DevtoolsContext.Provider} props=${{ value: shared }}>
      <RodDevtoolsShell .refs=${refs} />
    </${DevtoolsContext.Provider}>
  `);

  const shellRefs = assertShellRefs(refs, target);
  shared.refs.set(shellRefs);

  debugLog("shell", "render:end", { refs: objectKeys(shellRefs) });

  return { refs: shellRefs, dispose };
}

function renderToolIcon(value: Node | string | undefined, name: string): Node | string {
  if (typeof value === "string") return value;
  if (value instanceof Node) return value.cloneNode(true);

  const fallback = icon(name);
  return fallback instanceof Node ? fallback.cloneNode(true) : name.slice(0, 1).toUpperCase();
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

  const missing = filterArray(keys, (key) => !refs[key]);
  if (missing.length) {
    throw new Error(`[RodEruda] Shell did not mount: ${joinArray(missing, ", ")}`);
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
