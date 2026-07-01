import { event, html, ref, renderInto, styled } from "../components/runtime";

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

type MutablePanelShellRefs = {
  -readonly [Key in keyof PanelShellRefs]?: PanelShellRefs[Key];
};

const PanelRoot = styled.section("RodDevtoolsPanelRoot").css`
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.header("RodDevtoolsPanelHeader").css`
  min-height: 38px;
`;

const PanelActions = styled.div("RodDevtoolsPanelActions").css`
  margin-left: auto;
`;

const PanelBody = styled.div("RodDevtoolsPanelBody").css`
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
`;

const PanelButton = styled.button("RodDevtoolsPanelButton").css`
  appearance: none;
`;

export function renderPanelShell(target: HTMLElement, options: PanelShellOptions = {}): PanelShellRefs {
  const refs: MutablePanelShellRefs = {};
  const rootClassName = ["roderuda-panel-shell", options.className].filter(Boolean).join(" ");
  const bodyClassName = [
    options.bodyClassName,
    options.scroll === false ? "" : "roderuda-scroll",
  ].filter(Boolean).join(" ");

  renderInto(target, html`
    <RodDevtoolsPanelRoot
      class=${rootClassName}
      ref=${ref((node) => { refs.root = node as HTMLElement; })}
    >
      ${options.title == null ? null : html`
        <RodDevtoolsPanelHeader class="roderuda-section-title">
          <span>${options.title}</span>
          ${options.actions?.length ? html`
            <RodDevtoolsPanelActions class="roderuda-section-actions">
              ${options.actions.map((item) => html`
                <RodDevtoolsPanelButton
                  class=${item.className ?? "roderuda-text-btn"}
                  type="button"
                  title=${item.title ?? item.label}
                  data-action=${item.action}
                  ref=${ref((node) => applyAttrs(node as HTMLElement, item.attrs))}
                  @click=${event((click: Event) => options.onAction?.(click, item.action))}
                >${item.label}</RodDevtoolsPanelButton>
              `)}
            </RodDevtoolsPanelActions>
          ` : null}
        </RodDevtoolsPanelHeader>
      `}
      <RodDevtoolsPanelBody
        class=${bodyClassName}
        ref=${ref((node) => {
          const element = node as HTMLElement;
          refs.body = element;
          if (options.bodyAttr) element.setAttribute(options.bodyAttr, "");
        })}
      ></RodDevtoolsPanelBody>
    </RodDevtoolsPanelRoot>
  `);

  const root = refs.root ?? target.querySelector<HTMLElement>(".roderuda-panel-shell");
  const body = refs.body ?? (options.bodyAttr ? target.querySelector<HTMLElement>(`[${options.bodyAttr}]`) : null);
  if (!root || !body) throw new Error("[RodEruda] Panel shell did not mount");
  return { root, body };
}

function applyAttrs(element: HTMLElement, attrs?: PanelAction["attrs"]): void {
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) element.removeAttribute(name);
    else element.setAttribute(name, value === true ? "" : String(value));
  }
}
