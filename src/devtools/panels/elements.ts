import { ConfigStore } from "../core/config";
import { copyText, create, debounce, delegate, describeNode, escapeHtml, icon, isDevtoolsNode, nodePath, qs, truncate } from "../core/dom";
import { getEventListeners, installEventListenerRegistry } from "../core/event-listeners";
import { ElementHighlighter } from "../core/highlighter";
import { plainText } from "../core/serialize";
import { Tool } from "../tool";
import type { ToolContext } from "../types";

interface ElementsConfig {
  overrideEventTarget: boolean;
  observeElement: boolean;
  showWhitespace: boolean;
}

type StyleRuleInfo = {
  selector: string;
  declarations: Array<{ property: string; value: string; priority: string }>;
  source?: string;
};

export class Elements extends Tool {
  readonly name = "elements";
  readonly title = "elements";
  readonly icon = "◇";
  readonly config = new ConfigStore<ElementsConfig>("elements", {
    overrideEventTarget: true,
    observeElement: true,
    showWhitespace: false,
  });
  private tree: HTMLElement | null = null;
  private crumbs: HTMLElement | null = null;
  private detail: HTMLElement | null = null;
  private selected: Element | null = null;
  private readonly expanded = new WeakSet<Node>();
  private history: Element[] = [];
  private historyIndex = -1;
  private cleanup: Array<() => void> = [];
  private observer: MutationObserver | null = null;
  private restoreEventRegistry: (() => void) | null = null;
  private highlighter: ElementHighlighter | null = null;
  private pickerCleanup: Array<() => void> = [];
  private picking = false;
  private contextMenu: HTMLElement | null = null;
  private longPressTimer = 0;
  private longPressPoint: { x: number; y: number } | null = null;
  private readonly scheduleRender = debounce(() => this.renderTree(), 80);

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    container.innerHTML = `
      <div class="roderuda-elements-layout">
        <section class="roderuda-elements-tree-side">
          <div class="roderuda-control">
            <button class="roderuda-icon-btn" type="button" data-action="back" title="Back">${icon("back")}</button>
            <button class="roderuda-icon-btn" type="button" data-action="forward" title="Forward">›</button>
            <button class="roderuda-icon-btn" type="button" data-action="refresh" title="Refresh">${icon("refresh")}</button>
            <div class="roderuda-control-spacer"></div>
            <button class="roderuda-icon-btn" type="button" data-action="inspect" title="Select an element">${icon("inspect")}</button>
            <button class="roderuda-icon-btn" type="button" data-action="copy" title="Copy element">${icon("copy")}</button>
            <button class="roderuda-icon-btn" type="button" data-action="delete" title="Delete element">${icon("delete")}</button>
          </div>
          <div class="roderuda-elements-tree-wrap"><div class="roderuda-dom-tree" data-elements-tree></div></div>
          <div class="roderuda-crumbs" data-elements-crumbs></div>
        </section>
        <section class="roderuda-detail roderuda-element-detail" data-elements-detail></section>
      </div>
    `;
    this.tree = qs(container, "[data-elements-tree]");
    this.crumbs = qs(container, "[data-elements-crumbs]");
    this.detail = qs(container, "[data-elements-detail]");
    const host = context.shadowRoot?.host instanceof HTMLElement ? context.shadowRoot.host : context.root.parentElement;
    this.highlighter = new ElementHighlighter(host);

    this.cleanup.push(delegate(container, "click", "[data-action]", (event, element) => this.handleAction(event, element)));
    this.cleanup.push(delegate(container, "click", "[data-node-id]", (event, element) => this.handleNodeClick(event, element)));
    this.cleanup.push(delegate(container, "dblclick", "[data-node-id]", (event, element) => this.handleNodeOpen(event, element)));
    this.cleanup.push(delegate(container, "contextmenu", "[data-node-id]", (event, element) => this.handleNodeMenu(event, element)));
    this.cleanup.push(delegate(container, "pointerdown", "[data-node-id]", (event, element) => this.startLongPress(event, element)));
    this.cleanup.push(delegate(container, "pointerup", "[data-node-id]", () => this.cancelLongPress()));
    this.cleanup.push(delegate(container, "pointercancel", "[data-node-id]", () => this.cancelLongPress()));
    this.cleanup.push(delegate(container, "pointermove", "[data-node-id]", (event) => this.trackLongPress(event)));
    this.cleanup.push(delegate(container, "click", "[data-elements-menu-action]", (event, element) => { void this.handleContextAction(event, element); }));
    this.cleanup.push(delegate(container, "pointerover", "[data-node-id]", (_event, element) => this.hoverNode(element)));
    this.cleanup.push(delegate(container, "pointerout", "[data-node-id]", () => this.highlighter?.hide()));
    this.cleanup.push(delegate(container, "click", "[data-crumb-index]", (_event, element) => this.select(this.crumbElement(Number(element.dataset.crumbIndex)))));
    this.cleanup.push(delegate(container, "change", "[data-attribute-name]", (event, element) => this.updateAttribute(event, element)));
    this.cleanup.push(delegate(container, "click", "[data-remove-attribute]", (_event, element) => this.removeAttribute(element)));
    this.cleanup.push(delegate(container, "change", "[data-style-property]", (event, element) => this.updateInlineStyle(event, element)));
    this.cleanup.push(delegate(container, "click", "[data-detail-section]", (_event, element) => this.toggleSection(element)));

    this.config.on("change", this.onConfigChange);
    if (this.config.get("overrideEventTarget")) this.restoreEventRegistry = installEventListenerRegistry();
    this.observe();
    this.registerSettings(context);
    this.expanded.add(document.documentElement);
    this.expanded.add(document.body);
    this.select(document.body || document.documentElement, false);
    this.renderTree();
  }

  select(node: Node | null, addHistory = true): void {
    const element = node instanceof Element ? node : node?.parentElement;
    if (!element || isDevtoolsNode(element, this.context?.shadowRoot?.host as HTMLElement | undefined)) return;
    this.selected = element;
    this.expandAncestors(element);
    if (addHistory) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(element);
      this.historyIndex = this.history.length - 1;
    }
    this.renderTree();
    this.renderCrumbs();
    this.renderDetail();
    this.highlighter?.highlight(element);
    queueMicrotask(() => this.tree?.querySelector<HTMLElement>(".roderuda-dom-row.roderuda-selected")?.scrollIntoView({ block: "nearest" }));
  }

  override show(): void {
    super.show();
    if (this.selected) this.renderDetail();
  }

  override hide(): void {
    super.hide();
    this.stopPicker();
    this.highlighter?.hide();
  }

  override destroy(): void {
    this.stopPicker();
    this.cancelLongPress();
    this.closeContextMenu();
    this.highlighter = null;
    this.observer?.disconnect();
    this.observer = null;
    this.restoreEventRegistry?.();
    this.restoreEventRegistry = null;
    this.config.off("change", this.onConfigChange);
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    super.destroy();
  }

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "observeElement") value ? this.observe() : this.observer?.disconnect();
    if (key === "overrideEventTarget") {
      this.restoreEventRegistry?.();
      this.restoreEventRegistry = value ? installEventListenerRegistry() : null;
      this.renderDetail();
    }
    if (key === "showWhitespace") this.renderTree();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Elements");
    context.settings.registerSwitch(this.config, "overrideEventTarget", "Track event listeners added through EventTarget");
    context.settings.registerSwitch(this.config, "observeElement", "Automatically refresh DOM mutations");
    context.settings.registerSwitch(this.config, "showWhitespace", "Show whitespace-only text nodes");
  }

  private observe(): void {
    this.observer?.disconnect();
    if (!this.config.get("observeElement") || !document.documentElement) return;
    this.observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => !isDevtoolsNode(mutation.target, this.context?.shadowRoot?.host as HTMLElement | undefined));
      if (!relevant) return;
      this.scheduleRender();
      if (this.selected && mutations.some((mutation) => mutation.target === this.selected || this.selected?.contains(mutation.target))) this.renderDetail();
    });
    this.observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  }

  private renderTree(): void {
    if (!this.tree || !document.documentElement) return;
    const rootList = create("ul");
    rootList.append(this.renderNode(document.documentElement, 0));
    this.tree.replaceChildren(rootList);
  }

  private renderNode(node: Node, depth: number): HTMLLIElement {
    const item = create("li");
    const row = create("div", {
      className: `roderuda-dom-row${node === this.selected ? " roderuda-selected" : ""}`,
      attrs: { "data-node-id": this.nodeId(node), "data-node-depth": depth },
    });
    const children = this.visibleChildren(node);
    const expandable = children.length > 0;
    const toggle = create("span", {
      className: "roderuda-dom-toggle",
      text: expandable ? (this.expanded.has(node) ? "▾" : "▸") : "",
      attrs: expandable ? { "data-toggle-node": "" } : undefined,
    });
    row.append(toggle, this.renderNodeLabel(node));
    item.append(row);

    if (expandable && this.expanded.has(node)) {
      const list = create("ul");
      const limited = children.slice(0, 300);
      for (const child of limited) list.append(this.renderNode(child, depth + 1));
      if (children.length > limited.length) list.append(create("li", { text: `… ${children.length - limited.length} more nodes` }));
      item.append(list);
    }
    return item;
  }

  private renderNodeLabel(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) return create("span", { className: "roderuda-dom-text", text: `"${truncate(node.textContent?.replace(/\s+/g, " ").trim() || "", 120)}"` });
    if (node.nodeType === Node.COMMENT_NODE) return create("span", { className: "roderuda-dom-text", text: `<!--${truncate(node.textContent || "", 120)}-->` });
    if (!(node instanceof Element)) return document.createTextNode(node.nodeName);
    const fragment = document.createDocumentFragment();
    fragment.append(create("span", { className: "roderuda-dom-tag", text: `<${node.tagName.toLowerCase()}` }));
    for (const attribute of Array.from(node.attributes).slice(0, 12)) {
      fragment.append(document.createTextNode(" "));
      fragment.append(create("span", { className: "roderuda-dom-attr-name", text: attribute.name }));
      fragment.append(document.createTextNode('="'));
      fragment.append(create("span", { className: "roderuda-dom-attr-value", text: truncate(attribute.value, 100) }));
      fragment.append(document.createTextNode('"'));
    }
    fragment.append(create("span", { className: "roderuda-dom-tag", text: ">" }));
    return fragment;
  }

  private visibleChildren(node: Node): Node[] {
    const host = this.context?.shadowRoot?.host as HTMLElement | undefined;
    return Array.from(node.childNodes).filter((child) => {
      if (isDevtoolsNode(child, host)) return false;
      if (!this.config.get("showWhitespace") && child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) return false;
      return true;
    });
  }

  private renderCrumbs(): void {
    if (!this.crumbs || !this.selected) return;
    const elements: Element[] = [];
    let current: Element | null = this.selected;
    while (current) {
      elements.unshift(current);
      current = current.parentElement;
    }
    this.crumbs.replaceChildren(...elements.map((element, index) => create("button", {
      text: crumbLabel(element),
      attrs: { type: "button", "data-crumb-index": index },
    })));
    this.crumbs.dataset.crumbPath = elements.map((element) => this.nodeId(element)).join(",");
    this.crumbs.scrollLeft = this.crumbs.scrollWidth;
  }

  private crumbElement(index: number): Element | null {
    const ids = this.crumbs?.dataset.crumbPath?.split(",") ?? [];
    return this.resolveNode(ids[index] || "") as Element | null;
  }

  private renderDetail(): void {
    const element = this.selected;
    if (!this.detail || !element) return;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const matchedRules = getMatchedRules(element);
    const listeners = getEventListeners(element);
    const attributes = Array.from(element.attributes);

    this.detail.innerHTML = `
      <div class="roderuda-control">
        <button class="roderuda-icon-btn" type="button" data-action="close-detail" title="Back">${icon("back")}</button>
        <div class="roderuda-detail-title">${escapeHtml(describeNode(element))}</div>
        <button class="roderuda-icon-btn" type="button" data-action="refresh-detail" title="Refresh">${icon("refresh")}</button>
      </div>
      <div class="roderuda-detail-body">
        ${this.detailSection("Attributes", "attributes", `
          <div class="roderuda-element-attributes">
            ${attributes.map((attribute) => attributeRow(attribute.name, attribute.value)).join("")}
            ${attributeRow("", "", true)}
          </div>
        `)}
        ${this.detailSection("Text Content", "text", `<pre class="roderuda-pre">${escapeHtml(element.textContent || "")}</pre>`)}
        ${this.detailSection("Box Model", "box", boxModelHtml(style, rect))}
        ${this.detailSection("Computed Style", "computed", computedStyleHtml(style))}
        ${this.detailSection("Styles", "styles", stylesHtml(element, matchedRules))}
        ${this.detailSection("Event Listeners", "listeners", listenersHtml(listeners))}
        ${this.detailSection("Properties", "properties", propertiesHtml(element))}
      </div>
    `;
    this.detail.classList.add("roderuda-active");
  }

  private detailSection(title: string, name: string, content: string): string {
    return `<section class="roderuda-section" data-section="${name}"><button class="roderuda-section-title" type="button" data-detail-section="${name}"><span>${escapeHtml(title)}</span><span class="roderuda-section-actions">▾</span></button><div class="roderuda-section-content">${content}</div></section>`;
  }

  private handleNodeClick(event: Event, element: HTMLElement): void {
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!node) return;
    if ((event.target as Element)?.hasAttribute("data-toggle-node")) {
      if (this.expanded.has(node)) this.expanded.delete(node);
      else this.expanded.add(node);
      this.renderTree();
      return;
    }
    this.select(node);
  }

  private handleNodeOpen(event: Event, element: HTMLElement): void {
    event.preventDefault();
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!node) return;
    this.select(node);
    this.detail?.classList.add("roderuda-active");
  }

  private handleNodeMenu(event: Event, element: HTMLElement): void {
    event.preventDefault();
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!(node instanceof Element)) return;
    this.select(node);
    const pointer = event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : { x: 16, y: 16 };
    this.openContextMenu(node, pointer.x, pointer.y);
  }

  private startLongPress(event: Event, element: HTMLElement): void {
    if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent) || event.pointerType === "mouse") return;
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!(node instanceof Element)) return;
    this.cancelLongPress();
    this.longPressPoint = { x: event.clientX, y: event.clientY };
    this.longPressTimer = window.setTimeout(() => {
      this.select(node);
      this.openContextMenu(node, this.longPressPoint?.x ?? event.clientX, this.longPressPoint?.y ?? event.clientY);
      this.cancelLongPress();
    }, 550);
  }

  private trackLongPress(event: Event): void {
    if (typeof PointerEvent === "undefined" || !(event instanceof PointerEvent) || !this.longPressPoint || !this.longPressTimer) return;
    if (Math.hypot(event.clientX - this.longPressPoint.x, event.clientY - this.longPressPoint.y) > 12) this.cancelLongPress();
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
    this.longPressTimer = 0;
    this.longPressPoint = null;
  }

  private openContextMenu(element: Element, x: number, y: number): void {
    this.closeContextMenu();
    const menu = create("div", { className: "roderuda-elements-menu", attrs: { role: "menu", "data-elements-menu": "", "data-node-id": this.nodeId(element) } });
    const actions = [
      ["copy-element", "Copy element"],
      ["copy-selector", "Copy selector"],
      ["edit-attributes", "Edit attributes"],
      ["edit-props", "Edit props"],
      ["edit-class", "Edit class"],
      ["delete-element", "Delete element"],
    ] as const;
    for (const [action, label] of actions) {
      menu.append(create("button", { text: label, attrs: { type: "button", role: "menuitem", "data-elements-menu-action": action } }));
    }
    this.contextMenu = menu;
    this.context?.root.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    const close = (event: Event): void => {
      if (event.target instanceof Node && menu.contains(event.target)) return;
      this.closeContextMenu();
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (event: Event): void => {
      if (event instanceof KeyboardEvent && event.key === "Escape") close(event);
    };
    queueMicrotask(() => {
      document.addEventListener("pointerdown", close, true);
      document.addEventListener("keydown", onKey, true);
    });
  }

  private closeContextMenu(): void {
    this.contextMenu?.remove();
    this.contextMenu = null;
  }

  private async handleContextAction(event: Event, button: HTMLElement): Promise<void> {
    event.preventDefault();
    const node = this.resolveNode(button.closest<HTMLElement>("[data-elements-menu]")?.dataset.nodeId || "");
    this.closeContextMenu();
    if (!(node instanceof Element)) return;
    this.select(node);
    switch (button.dataset.elementsMenuAction) {
      case "copy-element":
        await copyText(node.outerHTML);
        this.context?.notify("Element copied", { type: "success" });
        break;
      case "copy-selector":
        await copyText(nodePath(node));
        this.context?.notify("Selector copied", { type: "success" });
        break;
      case "edit-attributes":
        await this.editAttributes(node);
        break;
      case "edit-props":
        await this.editProps(node);
        break;
      case "edit-class":
        await this.editClass(node);
        break;
      case "delete-element":
        this.deleteSelected();
        break;
    }
  }

  private hoverNode(element: HTMLElement): void {
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (node instanceof Element) this.highlighter?.highlight(node);
  }

  private handleAction(event: Event, element: HTMLElement): void {
    event.preventDefault();
    switch (element.dataset.action) {
      case "back":
        this.navigate(-1);
        break;
      case "forward":
        this.navigate(1);
        break;
      case "refresh":
      case "refresh-detail":
        this.renderTree();
        this.renderDetail();
        break;
      case "inspect":
        this.picking ? this.stopPicker() : this.startPicker(element);
        break;
      case "copy":
        if (this.selected) void copyText(this.selected.outerHTML).then(() => this.context?.notify("Element copied", { type: "success" }));
        break;
      case "delete":
        this.deleteSelected();
        break;
      case "close-detail":
        this.detail?.classList.remove("roderuda-active");
        break;
    }
  }

  private navigate(delta: number): void {
    const next = this.historyIndex + delta;
    if (next < 0 || next >= this.history.length) return;
    this.historyIndex = next;
    this.select(this.history[next]!, false);
  }

  private deleteSelected(): void {
    const element = this.selected;
    if (!element || element === document.documentElement || element === document.body) return;
    const next = element.parentElement;
    element.remove();
    if (next) this.select(next);
  }

  private async editAttributes(element: Element): Promise<void> {
    const current = Array.from(element.attributes).map((attribute) => `${attribute.name}=${attribute.value}`).join("\n");
    const next = await this.context?.prompt("Edit attributes as name=value, one per line", current);
    if (next == null) return;
    try {
      for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
      for (const line of next.split(/\r?\n/g)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const index = trimmed.indexOf("=");
        const name = (index < 0 ? trimmed : trimmed.slice(0, index)).trim();
        const value = index < 0 ? "" : trimmed.slice(index + 1);
        if (name) element.setAttribute(name, value);
      }
      this.renderTree();
      this.renderDetail();
    } catch (error) {
      this.context?.notify(plainText(error), { type: "error" });
    }
  }

  private async editClass(element: Element): Promise<void> {
    const next = await this.context?.prompt("Edit class", element.getAttribute("class") ?? "");
    if (next == null) return;
    if (next.trim()) element.setAttribute("class", next);
    else element.removeAttribute("class");
    this.renderTree();
    this.renderDetail();
  }

  private async editProps(element: Element): Promise<void> {
    const current = JSON.stringify({ id: element.id, title: element.getAttribute("title") ?? "", textContent: element.textContent ?? "" }, null, 2);
    const next = await this.context?.prompt("Edit simple props as JSON", current);
    if (next == null) return;
    try {
      const props = JSON.parse(next) as Record<string, unknown>;
      for (const [key, value] of Object.entries(props)) {
        if (key === "textContent") element.textContent = value == null ? "" : String(value);
        else if (key in element) (element as unknown as Record<string, unknown>)[key] = value;
        else if (value == null || value === false) element.removeAttribute(key);
        else element.setAttribute(key, value === true ? "" : String(value));
      }
      this.renderTree();
      this.renderDetail();
    } catch (error) {
      this.context?.notify(`Invalid props JSON: ${plainText(error)}`, { type: "error" });
    }
  }

  private startPicker(button: HTMLElement): void {
    this.stopPicker();
    this.picking = true;
    button.classList.add("roderuda-active");
    this.context?.devtools.hide();
    const host = this.context?.shadowRoot?.host as HTMLElement | undefined;
    const move = (event: PointerEvent): void => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (target && !isDevtoolsNode(target, host)) this.highlighter?.highlight(target);
    };
    const choose = (event: PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      const target = document.elementFromPoint(event.clientX, event.clientY);
      this.stopPicker();
      this.context?.devtools.show().showTool("elements");
      if (target && !isDevtoolsNode(target, host)) this.select(target);
    };
    const cancel = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      this.stopPicker();
      this.context?.devtools.show();
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerdown", choose, true);
    document.addEventListener("keydown", cancel, true);
    this.pickerCleanup.push(
      () => document.removeEventListener("pointermove", move, true),
      () => document.removeEventListener("pointerdown", choose, true),
      () => document.removeEventListener("keydown", cancel, true),
      () => button.classList.remove("roderuda-active"),
    );
  }

  private stopPicker(): void {
    this.picking = false;
    for (const cleanup of this.pickerCleanup.splice(0)) cleanup();
    this.highlighter?.hide();
  }

  private updateAttribute(event: Event, input: HTMLElement): void {
    const selected = this.selected;
    if (!(selected instanceof HTMLElement || selected instanceof SVGElement) || !(event.target instanceof HTMLInputElement)) return;
    const row = input.closest<HTMLElement>(".roderuda-attribute-row");
    const nameInput = row?.querySelector<HTMLInputElement>("[data-attribute-name]");
    const valueInput = row?.querySelector<HTMLInputElement>("[data-attribute-value]");
    const original = row?.dataset.originalName || "";
    const name = nameInput?.value.trim() || "";
    const value = valueInput?.value ?? "";
    try {
      if (original && original !== name) selected.removeAttribute(original)
      if (name) {
        selected.setAttribute(name, value);
        if (row) row.dataset.originalName = name;
      }
      this.renderTree();
    } catch (error) {
      this.context?.notify(plainText(error), { type: "error" });
    }
  }

  private removeAttribute(button: HTMLElement): void {
    if (!this.selected) return;
    const row = button.closest<HTMLElement>(".roderuda-attribute-row");
    const name = row?.dataset.originalName;
    if (name) this.selected.removeAttribute(name);
    row?.remove();
    this.renderTree();
  }

  private updateInlineStyle(event: Event, input: HTMLElement): void {
    const selected = this.selected;
    if (!(selected instanceof HTMLElement || selected instanceof SVGElement) || !(event.target instanceof HTMLInputElement)) return;
    const row = input.closest<HTMLElement>(".roderuda-style-declaration");
    const propertyInput = row?.querySelector<HTMLInputElement>("[data-style-property]");
    const valueInput = row?.querySelector<HTMLInputElement>("[data-style-value]");
    const previous = row?.dataset.originalProperty || "";
    const property = propertyInput?.value.trim() || "";
    const value = valueInput?.value.trim() || "";
    if (previous && previous !== property) selected.style.removeProperty(previous);
    if (property && value) {
      const important = /\s*!important\s*$/i.test(value);
      selected.style.setProperty(property, value.replace(/\s*!important\s*$/i, ""), important ? "important" : "");
      if (row) row.dataset.originalProperty = property;
    } else if (property) {
      selected.style.removeProperty(property);
    }
    this.renderDetail();
    this.highlighter?.highlight(selected);
  }

  private toggleSection(button: HTMLElement): void {
    const section = button.closest<HTMLElement>(".roderuda-section");
    const content = section?.querySelector<HTMLElement>(".roderuda-section-content");
    if (!section || !content) return;
    const hidden = content.classList.toggle("roderuda-hidden");
    const marker = button.querySelector<HTMLElement>(".roderuda-section-actions");
    if (marker) marker.textContent = hidden ? "▸" : "▾";
  }

  private expandAncestors(node: Node): void {
    let current: Node | null = node.parentNode;
    while (current) {
      this.expanded.add(current);
      current = current.parentNode;
    }
  }

  private readonly nodeIds = new WeakMap<Node, string>();
  private readonly idNodes = new Map<string, WeakRef<Node> | Node>();
  private nodeSequence = 0;

  private nodeId(node: Node): string {
    let id = this.nodeIds.get(node);
    if (id) return id;
    id = `node-${++this.nodeSequence}`;
    this.nodeIds.set(node, id);
    this.idNodes.set(id, typeof WeakRef !== "undefined" ? new WeakRef(node) : node);
    return id;
  }

  private resolveNode(id: string): Node | null {
    const value = this.idNodes.get(id);
    if (!value) return null;
    return value instanceof WeakRef ? value.deref() ?? null : value;
  }
}

function crumbLabel(element: Element): string {
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${Array.from(element.classList).slice(0, 1).map((name) => `.${name}`).join("")}`;
}

function attributeRow(name: string, value: string, empty = false): string {
  return `<div class="roderuda-attribute-row" data-original-name="${escapeHtml(name)}"><input data-attribute-name value="${escapeHtml(name)}" placeholder="attribute"><input data-attribute-value value="${escapeHtml(value)}" placeholder="value"><button class="roderuda-icon-btn" type="button" data-remove-attribute title="Remove">${empty ? "+" : "×"}</button></div>`;
}

function boxModelHtml(style: CSSStyleDeclaration, rect: DOMRect): string {
  const values = (prefix: string, suffix = "") => ["top", "right", "bottom", "left"].map((side) => style.getPropertyValue(`${prefix}-${side}${suffix}`) || "0px").join(" · ");
  const contentWidth = Math.max(0, rect.width - number(style.paddingLeft) - number(style.paddingRight) - number(style.borderLeftWidth) - number(style.borderRightWidth));
  const contentHeight = Math.max(0, rect.height - number(style.paddingTop) - number(style.paddingBottom) - number(style.borderTopWidth) - number(style.borderBottomWidth));
  return `<div class="roderuda-table-wrap"><div class="roderuda-box-model"><div class="roderuda-box-layer" data-layer="margin">margin ${escapeHtml(values("margin"))}<div class="roderuda-box-layer" data-layer="border">border ${escapeHtml(values("border", "-width"))}<div class="roderuda-box-layer" data-layer="padding">padding ${escapeHtml(values("padding"))}<div class="roderuda-box-layer" data-layer="content">${contentWidth.toFixed(1)} × ${contentHeight.toFixed(1)}</div></div></div></div></div></div>`;
}

function computedStyleHtml(style: CSSStyleDeclaration): string {
  const rows: string[] = [];
  for (const property of Array.from(style).sort()) rows.push(`<tr><td>${escapeHtml(property)}</td><td>${escapeHtml(style.getPropertyValue(property))}</td></tr>`);
  return `<div class="roderuda-table-wrap" style="max-height:300px"><table class="roderuda-kv"><tbody>${rows.join("")}</tbody></table></div>`;
}

function stylesHtml(element: Element, rules: StyleRuleInfo[]): string {
  const inline = Array.from(element instanceof HTMLElement ? element.style : []).map((property) => ({ property, value: (element as HTMLElement).style.getPropertyValue(property), priority: (element as HTMLElement).style.getPropertyPriority(property) }));
  const allRules = [{ selector: "element.style", declarations: [...inline, { property: "", value: "", priority: "" }] }, ...rules];
  return allRules.map((rule, ruleIndex) => `<div class="roderuda-style-rule"><div class="roderuda-style-selector">${escapeHtml(rule.selector)}${rule.source ? ` <small>${escapeHtml(rule.source)}</small>` : ""}</div>${rule.declarations.map((declaration) => ruleIndex === 0
    ? `<div class="roderuda-style-declaration" data-original-property="${escapeHtml(declaration.property)}"><input data-style-property value="${escapeHtml(declaration.property)}" placeholder="property"><input data-style-value value="${escapeHtml(`${declaration.value}${declaration.priority ? " !important" : ""}`)}" placeholder="value"></div>`
    : `<div class="roderuda-style-declaration"><span>${escapeHtml(declaration.property)}</span><span>${escapeHtml(`${declaration.value}${declaration.priority ? " !important" : ""}`)}</span></div>`).join("")}</div>`).join("");
}

function listenersHtml(listeners: Readonly<Record<string, readonly { listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }[]>>): string {
  const entries = Object.entries(listeners);
  if (!entries.length) return `<div class="roderuda-empty" style="height:auto;min-height:80px"><span>No tracked listeners.</span></div>`;
  return entries.map(([type, values]) => `<div class="roderuda-listener"><strong>${escapeHtml(type)} (${values.length})</strong>${values.map((value) => `<pre>${escapeHtml(listenerText(value.listener))}\noptions: ${escapeHtml(JSON.stringify(value.options ?? false))}</pre>`).join("")}</div>`).join("");
}

function listenerText(listener: EventListenerOrEventListenerObject): string {
  if (typeof listener === "function") return listener.toString();
  return listener.handleEvent?.toString() || String(listener);
}

function propertiesHtml(element: Element): string {
  const rows: string[] = [];
  const keys = Reflect.ownKeys(element).slice(0, 100);
  for (const key of keys) {
    let value: unknown;
    try { value = Reflect.get(element, key); } catch (error) { value = error; }
    rows.push(`<tr><td>${escapeHtml(String(key))}</td><td>${escapeHtml(truncate(plainText(value), 300))}</td></tr>`);
  }
  rows.unshift(`<tr><td>selector</td><td>${escapeHtml(nodePath(element))}</td></tr>`);
  return `<div class="roderuda-table-wrap"><table class="roderuda-kv"><tbody>${rows.join("")}</tbody></table></div>`;
}

function getMatchedRules(element: Element): StyleRuleInfo[] {
  const output: StyleRuleInfo[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    collectRules(rules, element, output, sheet.href || "inline");
  }
  return output.reverse();
}

function collectRules(rules: CSSRuleList, element: Element, output: StyleRuleInfo[], source: string): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      try {
        if (!element.matches(rule.selectorText)) continue;
      } catch {
        continue;
      }
      output.push({
        selector: rule.selectorText,
        source,
        declarations: Array.from(rule.style).map((property) => ({ property, value: rule.style.getPropertyValue(property), priority: rule.style.getPropertyPriority(property) })),
      });
    } else if ("cssRules" in rule) {
      try { collectRules((rule as CSSGroupingRule).cssRules, element, output, source); } catch { /* ignored */ }
    }
  }
}

function number(value: string): number { return Number.parseFloat(value) || 0; }
