import { uiElement } from "../components/runtime";

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

export function renderPanelShell(target: HTMLElement, options: PanelShellOptions = {}): PanelShellRefs {
  target.replaceChildren();
  const root = uiElement("section", {
    className: ["roderuda-panel-shell", options.className].filter(Boolean).join(" "),
  });

  if (options.title != null) {
    root.append(renderPanelHeader(options));
  }

  const body = uiElement("div", {
    className: [options.bodyClassName, options.scroll === false ? "" : "roderuda-scroll"].filter(Boolean).join(" "),
  });
  if (options.bodyAttr) body.setAttribute(options.bodyAttr, "");

  root.append(body);
  target.append(root);
  return { root, body };
}

function renderPanelHeader(options: PanelShellOptions): HTMLElement {
  const header = uiElement("header", { className: "roderuda-section-title" });
  header.append(uiElement("span", { text: options.title ?? "" }));

  if (options.actions?.length) {
    const actions = uiElement("div", { className: "roderuda-section-actions" });
    for (const item of options.actions) {
      const button = uiElement("button", {
        className: item.className ?? "roderuda-text-btn",
        text: item.label,
        attrs: {
          type: "button",
          title: item.title ?? item.label,
          "data-action": item.action,
        },
        on: {
          click: (click) => options.onAction?.(click, item.action),
        },
      });
      applyAttrs(button, item.attrs);
      actions.append(button);
    }
    header.append(actions);
  }

  return header;
}

function applyAttrs(element: HTMLElement, attrs?: PanelAction["attrs"]): void {
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) element.removeAttribute(name);
    else element.setAttribute(name, value === true ? "" : String(value));
  }
}
