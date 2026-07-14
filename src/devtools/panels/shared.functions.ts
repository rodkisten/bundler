import { asNode, event, html,  styled } from "../core/runtime";
import { PanelShellOptions, PanelShellRefs, PanelAction } from "./panel-ui";

export function renderPanelShell(target: HTMLElement, options: PanelShellOptions = {}): PanelShellRefs {
  const bodyRef = { current: null as HTMLElement | null };

  const root = asNode(html`
    <RodPanelShell class=${options.className ?? ""}>
      ${options.title != null ? panelHeaderTemplate(options) : ""}
      <RodPanelBody
        class=${options.bodyClassName ?? ""}
        data-scroll=${String(options.scroll !== false)}
        ref=${(node: HTMLElement | null) => {
          bodyRef.current = node as HTMLElement;
          return () => {
            bodyRef.current = null;
          };
        }}
      />
    </RodPanelShell>
  `) as HTMLElement;

  const body = bodyRef.current ?? root.querySelector<HTMLElement>("[data-scroll]");
  if (!body) throw new Error("Panel shell body was not rendered.");

  if (options.bodyAttr) body.setAttribute(options.bodyAttr, "");

  target.replaceChildren(root);

  return { root, body };
}

export function panelHeaderTemplate(options: PanelShellOptions) {
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

export function panelActionTemplate(item: PanelAction, options: PanelShellOptions) {
  return html`
    <RodPanelTextButton
      class=${item.className ?? ""}
      type="button"
      title=${item.title ?? item.label}
      data-action=${item.action}
      @click=${event.click((click: MouseEvent) => options.onAction?.(click, item.action))}
      ...${attrs(item.attrs) as never}
    >
      ${item.label}
    </RodPanelTextButton>
  `;
}

export function attrs(values?: PanelAction["attrs"]): Record<string, string | null> {
  const output: Record<string, string | null> = {};
  if (!values) return output;

  for (const [name, value] of Object.entries(values)) {
    output[name] = value == null || value === false ? null : value === true ? "" : String(value);
  }

  return output;
}
