import { asNode, event, html, ref, styled } from "../runtime";

export interface PanelAction {
  readonly label: string;
  readonly action: string;
  readonly title?: string;
  readonly className?: string;
  readonly attrs?: Record<string, string | number | boolean | null | undefined>;
}

export interface PanelShellOptions {
  readonly className?: string;
  readonly title?: string;
  readonly bodyAttr?: string;
  readonly bodyClassName?: string;
  readonly scroll?: boolean;
  readonly actions?: readonly PanelAction[];
  readonly onAction?: (event: Event, action: string) => void;
}

export interface PanelShellRefs {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
}

const PanelShell = styled.section("RodPanelShell").css`
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
`;

const PanelHeader = styled.header("RodPanelHeader").css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 9px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font: inherit;
  font-weight: 600;
`;

const PanelTitle = styled.span("RodPanelTitle").css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PanelActions = styled.div("RodPanelActions").css`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
`;

const PanelTextButton = styled.button("RodPanelTextButton").css`
  appearance: none;
  padding: 4px 8px;
  border: 1px solid $border;
  border-radius: $sm;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    transform: scale(.96);
    color: $accent;
  }
`;

const PanelBody = styled.div("RodPanelBody").css`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;

  &[data-scroll="true"] {
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
`;

export function renderPanelShell(target: HTMLElement, options: PanelShellOptions = {}): PanelShellRefs {
  const bodyRef = { current: null as HTMLElement | null };

  const root = asNode(html`
    <RodPanelShell class=${options.className ?? ""}>
      ${options.title != null ? panelHeaderTemplate(options) : ""}
      <RodPanelBody
        class=${options.bodyClassName ?? ""}
        data-scroll=${String(options.scroll !== false)}
        ref=${ref((node) => {
          bodyRef.current = node as HTMLElement;
          return () => {
            bodyRef.current = null;
          };
        })}
      />
    </RodPanelShell>
  `) as HTMLElement;

  const body = bodyRef.current ?? root.querySelector<HTMLElement>("[data-scroll]");
  if (!body) throw new Error("Panel shell body was not rendered.");

  if (options.bodyAttr) body.setAttribute(options.bodyAttr, "");

  target.replaceChildren(root);

  return { root, body };
}

function panelHeaderTemplate(options: PanelShellOptions) {
  return html`
    <RodPanelHeader>
      <RodPanelTitle>${options.title ?? ""}</RodPanelTitle>
      ${options.actions?.length ? html`
        <RodPanelActions>
          ${options.actions.map((item) => panelActionTemplate(item, options))}
        </RodPanelActions>
      ` : ""}
    </RodPanelHeader>
  `;
}

function panelActionTemplate(item: PanelAction, options: PanelShellOptions) {
  return html`
    <RodPanelTextButton
      class=${item.className ?? ""}
      type="button"
      title=${item.title ?? item.label}
      data-action=${item.action}
      @click=${event((click: Event) => options.onAction?.(click, item.action))}
      ...${attrs(item.attrs) as never}
    >
      ${item.label}
    </RodPanelTextButton>
  `;
}

function attrs(values?: PanelAction["attrs"]): Record<string, string | null> {
  const output: Record<string, string | null> = {};
  if (!values) return output;

  for (const [name, value] of Object.entries(values)) {
    output[name] = value == null || value === false ? null : value === true ? "" : String(value);
  }

  return output;
}
