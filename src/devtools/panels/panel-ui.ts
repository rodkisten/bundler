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
  const root = document.createElement("section");
  root.className = ["roderuda-panel-shell", options.className].filter(Boolean).join(" ");

  if (options.title != null) {
    root.append(renderPanelHeader(options));
  }

  const body = document.createElement("div");
  body.className = [options.bodyClassName, options.scroll === false ? "" : "roderuda-scroll"].filter(Boolean).join(" ");
  if (options.bodyAttr) body.setAttribute(options.bodyAttr, "");

  root.append(body);
  target.append(root);
  return { root, body };
}

function renderPanelHeader(options: PanelShellOptions): HTMLElement {
  const header = document.createElement("header");
  header.className = "roderuda-section-title";

  const title = document.createElement("span");
  title.textContent = options.title ?? "";
  header.append(title);

  if (options.actions?.length) {
    const actions = document.createElement("div");
    actions.className = "roderuda-section-actions";
    for (const item of options.actions) {
      const button = document.createElement("button");
      button.className = item.className ?? "roderuda-text-btn";
      button.type = "button";
      button.title = item.title ?? item.label;
      button.dataset.action = item.action;
      button.textContent = item.label;
      button.addEventListener("click", (click) => options.onAction?.(click, item.action));
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
