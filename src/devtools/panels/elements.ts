import { ConfigStore } from "../core/config";
import { getEventListeners, installEventListenerRegistry } from "../core/event-listeners";
import { ElementHighlighter } from "../core/highlighter";
import { plainText } from "../core/serialize";
import { Tool } from "../tool";
import type { ToolContext } from "../types";
import { copyText, debounce, delegate, icon, isDevtoolsNode, nodePath } from "../utils";
import { asElement, html, render } from "../components/runtime";
import {
  ElementsAttributesView,
  ElementsBoxModelView,
  ElementsComputedStyleView,
  ElementsContextMenuView,
  ElementsCrumbsView,
  ElementsDetailBodyView,
  ElementsDetailHeaderView,
  ElementsDetailSectionView,
  ElementsDomNodeView,
  ElementsDomTreeView,
  ElementsListenersView,
  ElementsNodeLabelView,
  ElementsPreBlockView,
  ElementsPropertiesView,
  ElementsStylesView,
  elementsStyleArtifacts,
  listenerModels,
  propertyModels,
  styleRuleModels,
  type ElementsViewModel,
  type RenderPiece,
  type StyleRuleInfo,
} from "./elements-components";

export { elementsStyleArtifacts };

interface ElementsConfig {
  overrideEventTarget: boolean;
  observeElement: boolean;
  showWhitespace: boolean;
}

type SelectOptions = {
  addHistory?: boolean;
  expandAncestors?: boolean;
  reveal?: boolean;
  highlight?: boolean;
};

type ContextMenuCleanup = () => void;

export class Elements extends Tool {
  readonly name = "elements";
  readonly title = "elements";
  readonly icon = icon("elements");

  readonly config = new ConfigStore<ElementsConfig>("elements", {
    overrideEventTarget: true,
    observeElement: true,
    showWhitespace: false,
  });

  private container: HTMLElement | null = null;
  private tree: HTMLElement | null = null;
  private crumbs: HTMLElement | null = null;
  private detail: HTMLElement | null = null;
  private selected: Element | null = null;

  private readonly expanded = new WeakSet<Node>();
  private readonly nodeIds = new WeakMap<Node, string>();
  private readonly idNodes = new Map<string, WeakRef<Node> | Node>();

  private history: Element[] = [];
  private historyIndex = -1;
  private nodeSequence = 0;

  private cleanup: Array<() => void> = [];
  private pickerCleanup: Array<() => void> = [];
  private longPressCleanup: Array<() => void> = [];

  private observer: MutationObserver | null = null;
  private restoreEventRegistry: (() => void) | null = null;
  private highlighter: ElementHighlighter | null = null;
  private disposeView: (() => void) | null = null;

  private contextMenu: HTMLElement | null = null;
  private contextMenuCleanup: ContextMenuCleanup | null = null;

  private picking = false;
  private isUserScrolling = false;
  private suppressNextClickUntil = 0;

  private longPressTimer = 0;
  private longPressPoint: { x: number; y: number } | null = null;
  private scrollIdleTimer = 0;

  private readonly scheduleRender = debounce(() => {
    this.renderTree();
  }, 80);

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    this.container = container;

    const view: ElementsViewModel = {
      setTree: (node) => {
        // Never render from inside a ref callback. The parent Fábrica render may
        // still be applying parts and mounting component boundaries.
        this.tree = node;
      },
      setCrumbs: (node) => {
        this.crumbs = node;
      },
      setDetail: (node) => {
        this.detail = node;
      },
      onAction: (actionEvent) => {
        this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement);
      },
      onTreeScroll: () => {
        this.handleTreeScroll();
      },
    };

    this.disposeView?.();
    this.disposeView = render(
      container,
      html`<RodElementsView view=${view as never} />`,
    );

    // Ref callbacks are the primary path. These selectors are only defensive
    // fallbacks for compiled/runtime regressions.
    this.tree ??= container.querySelector<HTMLElement>("[data-elements-tree]");
    this.crumbs ??= container.querySelector<HTMLElement>("[data-elements-crumbs]");
    this.detail ??= container.querySelector<HTMLElement>("[data-elements-detail]");

    const host = context.shadowRoot?.host instanceof HTMLElement
      ? context.shadowRoot.host
      : context.root.parentElement;

    this.highlighter = new ElementHighlighter(host);

    this.bindDelegatedEvents(container);

    this.config.on("change", this.onConfigChange);

    if (this.config.get("overrideEventTarget")) {
      this.restoreEventRegistry = installEventListenerRegistry();
    }

    this.observe();
    this.registerSettings(context);

    if (document.documentElement) {
      this.expanded.add(document.documentElement);
    }

    if (document.body) {
      this.expanded.add(document.body);
    }

    this.select(document.body || document.documentElement, {
      addHistory: false,
      expandAncestors: true,
      reveal: false,
    });
  }

  override show(): void {
    super.show();

    if (this.selected) {
      this.renderDetail();
    }
  }

  override hide(): void {
    super.hide();

    this.stopPicker();
    this.closeContextMenu();
    this.highlighter?.hide();
  }

  override destroy(): void {
    this.stopPicker();
    this.cancelLongPress();
    this.closeContextMenu();

    if (this.scrollIdleTimer) {
      window.clearTimeout(this.scrollIdleTimer);
      this.scrollIdleTimer = 0;
    }

    this.observer?.disconnect();
    this.observer = null;

    this.restoreEventRegistry?.();
    this.restoreEventRegistry = null;

    this.config.off("change", this.onConfigChange);

    for (const cleanup of this.cleanup.splice(0)) {
      cleanup();
    }

    this.disposeView?.();
    this.disposeView = null;

    this.highlighter = null;
    this.container = null;
    this.tree = null;
    this.crumbs = null;
    this.detail = null;
    this.selected = null;

    this.history = [];
    this.historyIndex = -1;

    this.idNodes.clear();

    super.destroy();
  }

  private bindDelegatedEvents(container: HTMLElement): void {
    this.cleanup.push(
      delegate(container, "click", "[data-node-id]", (click, element) => {
        this.handleNodeClick(click, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "dblclick", "[data-node-id]", (dblclick, element) => {
        this.handleNodeOpen(dblclick, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "contextmenu", "[data-node-id]", (menuEvent, element) => {
        this.handleNodeMenu(menuEvent, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "pointerdown", "[data-node-id]", (pointerEvent, element) => {
        this.startLongPress(pointerEvent, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "pointerup", "[data-node-id]", () => {
        this.cancelLongPress();
      }),
    );

    this.cleanup.push(
      delegate(container, "pointercancel", "[data-node-id]", () => {
        this.cancelLongPress();
      }),
    );

    this.cleanup.push(
      delegate(container, "pointermove", "[data-node-id]", (pointerEvent) => {
        this.trackLongPress(pointerEvent);
      }),
    );

    this.cleanup.push(
      delegate(container, "pointerover", "[data-node-id]", (_pointerEvent, element) => {
        this.hoverNode(element);
      }),
    );

    this.cleanup.push(
      delegate(container, "pointerout", "[data-node-id]", () => {
        this.highlighter?.hide();
      }),
    );

    this.cleanup.push(
      delegate(container, "click", "[data-elements-menu-action]", (click, element) => {
        void this.handleContextAction(click, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "click", "[data-crumb-index]", (_click, element) => {
        this.select(this.crumbElement(Number(element.dataset.crumbIndex)), {
          expandAncestors: true,
          reveal: true,
        });
      }),
    );

    this.cleanup.push(
      delegate(container, "change", "[data-attribute-name]", (change, element) => {
        this.updateAttribute(change, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "click", "[data-remove-attribute]", (_click, element) => {
        this.removeAttribute(element);
      }),
    );

    this.cleanup.push(
      delegate(container, "change", "[data-style-property]", (change, element) => {
        this.updateInlineStyle(change, element);
      }),
    );

    this.cleanup.push(
      delegate(container, "click", "[data-detail-section]", (_click, element) => {
        this.toggleSection(element);
      }),
    );
  }

  private select(node: Node | null, options: SelectOptions = {}): void {
    const {
      addHistory = true,
      expandAncestors = false,
      reveal = false,
      highlight = true,
    } = options;

    const element = node instanceof Element ? node : node?.parentElement;

    if (
      !element
      || isDevtoolsNode(
        element,
        this.context?.shadowRoot?.host as HTMLElement | undefined,
      )
    ) {
      return;
    }

    this.selected = element;

    if (expandAncestors) {
      this.expandAncestors(element);
    }

    if (addHistory) {
      this.history = this.history.slice(0, this.historyIndex + 1);

      if (this.history.at(-1) !== element) {
        this.history.push(element);
        this.historyIndex = this.history.length - 1;
      }
    }

    this.renderTree();
    this.renderCrumbs();
    this.renderDetail();

    if (highlight) {
      this.highlighter?.highlight(element);
    }

    if (reveal) {
      queueMicrotask(() => {
        this.tree
          ?.querySelector<HTMLElement>("[data-selected='true']")
          ?.scrollIntoView({
            block: "nearest",
            inline: "nearest",
          });
      });
    }
  }

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "observeElement") {
      if (value) this.observe();
      else this.observer?.disconnect();
    }

    if (key === "overrideEventTarget") {
      this.restoreEventRegistry?.();
      this.restoreEventRegistry = value
        ? installEventListenerRegistry()
        : null;

      this.renderDetail();
    }

    if (key === "showWhitespace") {
      this.renderTree();
    }
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Elements");

    context.settings.registerSwitch(
      this.config,
      "overrideEventTarget",
      "Track event listeners added through EventTarget",
    );

    context.settings.registerSwitch(
      this.config,
      "observeElement",
      "Automatically refresh DOM mutations",
    );

    context.settings.registerSwitch(
      this.config,
      "showWhitespace",
      "Show whitespace-only text nodes",
    );
  }

  private observe(): void {
    this.observer?.disconnect();

    if (!this.config.get("observeElement") || !document.documentElement) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      const devtoolsHost = this.context?.shadowRoot?.host as HTMLElement | undefined;

      const relevantMutations = mutations.filter(
        (mutation) => !isDevtoolsNode(mutation.target, devtoolsHost),
      );

      if (!relevantMutations.length) {
        return;
      }

      this.scheduleRender();

      if (
        this.selected
        && relevantMutations.some(
          (mutation) =>
            mutation.target === this.selected
            || this.selected?.contains(mutation.target),
        )
      ) {
        this.renderDetail();
      }
    });

    this.observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }

  private renderTree(): void {
    if (!this.tree || !document.documentElement) return;

    render(
      this.tree,
      ElementsDomTreeView({
        content: this.renderNode(document.documentElement, 0),
      }),
    );
  }

  private renderNode(node: Node, depth: number): RenderPiece {
    const children = this.visibleChildren(node);
    const expandable = children.length > 0;
    const expanded = this.expanded.has(node);
    const limited = children.slice(0, 300);
    const moreCount = children.length - limited.length;

    return ElementsDomNodeView({
      nodeId: this.nodeId(node),
      depth,
      selected: node === this.selected,
      expandable,
      expanded,
      label: ElementsNodeLabelView({ node }),
      children: limited.map((child) => this.renderNode(child, depth + 1)),
      moreCount,
    });
  }

  private visibleChildren(node: Node): Node[] {
    const host = this.context?.shadowRoot?.host as HTMLElement | undefined;

    return Array.from(node.childNodes).filter((child) => {
      if (isDevtoolsNode(child, host)) {
        return false;
      }

      if (
        !this.config.get("showWhitespace")
        && child.nodeType === Node.TEXT_NODE
        && !child.textContent?.trim()
      ) {
        return false;
      }

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

    render(this.crumbs, ElementsCrumbsView({ elements }));

    this.crumbs.dataset.crumbPath = elements
      .map((element) => this.nodeId(element))
      .join(",");

    this.crumbs.scrollLeft = this.crumbs.scrollWidth;
  }

  private crumbElement(index: number): Element | null {
    const ids = this.crumbs?.dataset.crumbPath?.split(",") ?? [];
    const node = this.resolveNode(ids[index] ?? "");

    return node instanceof Element ? node : null;
  }

  private renderDetail(): void {
    const element = this.selected;

    if (!this.detail || !element) {
      return;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const matchedRules = getMatchedRules(element);
    const listeners = listenerModels(getEventListeners(element));

    const attributes = Array.from(element.attributes).map((attribute) => ({
      name: attribute.name,
      value: attribute.value,
    }));

    const rules = styleRuleModels(element, matchedRules);
    const properties = propertyModels(element);

    render(
      this.detail,
      html`
        ${ElementsDetailHeaderView({
          element,
          onAction: (click: Event) => {
            this.handleAction(
              click,
              click.currentTarget as HTMLElement,
            );
          },
        })}

        ${ElementsDetailBodyView({
          content: html`
            ${ElementsDetailSectionView({
              title: "Attributes",
              name: "attributes",
              content: ElementsAttributesView({ attributes }),
            })}

            ${ElementsDetailSectionView({
              title: "Text Content",
              name: "text",
              content: ElementsPreBlockView({
                value: element.textContent || "",
              }),
            })}

            ${ElementsDetailSectionView({
              title: "Box Model",
              name: "box",
              content: ElementsBoxModelView({ style, rect }),
            })}

            ${ElementsDetailSectionView({
              title: "Computed Style",
              name: "computed",
              content: ElementsComputedStyleView({ style }),
            })}

            ${ElementsDetailSectionView({
              title: "Styles",
              name: "styles",
              content: ElementsStylesView({ rules }),
            })}

            ${ElementsDetailSectionView({
              title: "Event Listeners",
              name: "listeners",
              content: ElementsListenersView({ listeners }),
            })}

            ${ElementsDetailSectionView({
              title: "Properties",
              name: "properties",
              content: ElementsPropertiesView({ properties }),
            })}
          `,
        })}
      `,
    );

    this.detail.dataset.active = "true";
  }

  private handleTreeScroll(): void {
    this.isUserScrolling = true;
    this.suppressNextClickUntil = Date.now() + 250;

    this.cancelLongPress();

    if (this.scrollIdleTimer) {
      window.clearTimeout(this.scrollIdleTimer);
    }

    this.scrollIdleTimer = window.setTimeout(() => {
      this.isUserScrolling = false;
      this.scrollIdleTimer = 0;
    }, 160);
  }

  private handleNodeClick(event: Event, element: HTMLElement): void {
    if (
      Date.now() < this.suppressNextClickUntil
      || this.isUserScrolling
    ) {
      return;
    }

    const node = this.resolveNode(element.dataset.nodeId ?? "");
    if (!node) return;

    if (
      event.target instanceof Element
      && event.target.hasAttribute("data-toggle-node")
    ) {
      if (this.expanded.has(node)) {
        this.expanded.delete(node);
      } else {
        this.expanded.add(node);
      }

      this.renderTree();
      return;
    }

    this.select(node, {
      addHistory: true,
      expandAncestors: false,
      reveal: false,
      highlight: true,
    });
  }

  private handleNodeOpen(event: Event, element: HTMLElement): void {
    event.preventDefault();

    const node = this.resolveNode(element.dataset.nodeId ?? "");
    if (!node) return;

    this.select(node, {
      addHistory: true,
      expandAncestors: true,
      reveal: true,
      highlight: true,
    });

    if (this.detail) {
      this.detail.dataset.active = "true";
    }
  }

  private handleNodeMenu(event: Event, element: HTMLElement): void {
    event.preventDefault();

    const node = this.resolveNode(element.dataset.nodeId ?? "");
    if (!(node instanceof Element)) return;

    this.select(node, {
      addHistory: true,
      expandAncestors: false,
      reveal: false,
      highlight: true,
    });

    const pointer = event instanceof MouseEvent
      ? { x: event.clientX, y: event.clientY }
      : { x: 16, y: 16 };

    this.openContextMenu(node, pointer.x, pointer.y);
  }

  private startLongPress(event: Event, element: HTMLElement): void {
    if (
      !(event instanceof PointerEvent)
      || event.pointerType === "mouse"
    ) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (
      target?.closest(
        "button,input,textarea,select,[contenteditable]",
      )
    ) {
      return;
    }

    const node = this.resolveNode(element.dataset.nodeId ?? "");
    if (!(node instanceof Element)) return;

    this.cancelLongPress();

    const startX = event.clientX;
    const startY = event.clientY;

    this.longPressPoint = {
      x: startX,
      y: startY,
    };

    const cancel = (): void => {
      this.suppressNextClickUntil = Date.now() + 250;
      this.cancelLongPress();
    };

    window.addEventListener("scroll", cancel, true);

    this.longPressCleanup.push(() => {
      window.removeEventListener("scroll", cancel, true);
    });

    this.longPressTimer = window.setTimeout(() => {
      if (this.isUserScrolling) {
        this.cancelLongPress();
        return;
      }

      this.select(node, {
        addHistory: true,
        expandAncestors: false,
        reveal: false,
        highlight: true,
      });

      this.openContextMenu(node, startX, startY);
      this.cancelLongPress();
    }, 650);
  }

  private trackLongPress(event: Event): void {
    if (
      !(event instanceof PointerEvent)
      || !this.longPressPoint
      || !this.longPressTimer
    ) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - this.longPressPoint.x,
      event.clientY - this.longPressPoint.y,
    );

    if (distance > 10) {
      this.suppressNextClickUntil = Date.now() + 250;
      this.cancelLongPress();
    }
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) {
      window.clearTimeout(this.longPressTimer);
    }

    this.longPressTimer = 0;
    this.longPressPoint = null;

    for (const cleanup of this.longPressCleanup.splice(0)) {
      cleanup();
    }
  }

  private openContextMenu(element: Element, x: number, y: number): void {
    this.closeContextMenu();

    const menu = asElement<HTMLElement>(
      ElementsContextMenuView({
        elementId: this.nodeId(element),
      }),
    );

    this.contextMenu = menu;

    // The delegated menu handlers are attached to the tool container. Appending
    // the menu to the shell root made its buttons visually present but inert.
    const menuHost = this.container ?? this.context?.root;
    menuHost?.append(menu);

    const rect = menu.getBoundingClientRect?.();

    const width =
      rect && Number.isFinite(rect.width) && rect.width > 0
        ? rect.width
        : menu.offsetWidth || 180;

    const height =
      rect && Number.isFinite(rect.height) && rect.height > 0
        ? rect.height
        : menu.offsetHeight || 220;

    const viewportWidth =
      document.documentElement.clientWidth
      || window.innerWidth
      || width + 16;

    const viewportHeight =
      document.documentElement.clientHeight
      || window.innerHeight
      || height + 16;

    menu.style.left = `${clamp(x, 8, viewportWidth - width - 8)}px`;
    menu.style.top = `${clamp(y, 8, viewportHeight - height - 8)}px`;

    const close = (closeEvent: Event): void => {
      if (
        closeEvent.target instanceof Node
        && menu.contains(closeEvent.target)
      ) {
        return;
      }

      this.closeContextMenu();
    };

    const onKey = (keyEvent: Event): void => {
      if (
        keyEvent instanceof KeyboardEvent
        && keyEvent.key === "Escape"
      ) {
        this.closeContextMenu();
      }
    };

    queueMicrotask(() => {
      if (this.contextMenu !== menu) return;

      document.addEventListener("pointerdown", close, true);
      document.addEventListener("keydown", onKey, true);

      this.contextMenuCleanup = () => {
        document.removeEventListener("pointerdown", close, true);
        document.removeEventListener("keydown", onKey, true);
      };
    });
  }

  private closeContextMenu(): void {
    this.contextMenuCleanup?.();
    this.contextMenuCleanup = null;

    this.contextMenu?.remove();
    this.contextMenu = null;
  }

  private async handleContextAction(
    event: Event,
    button: HTMLElement,
  ): Promise<void> {
    event.preventDefault();

    const menu = button.closest<HTMLElement>("[data-elements-menu]");
    const node = this.resolveNode(menu?.dataset.nodeId ?? "");

    this.closeContextMenu();

    if (!(node instanceof Element)) return;

    this.select(node, {
      addHistory: true,
      expandAncestors: false,
      reveal: false,
      highlight: true,
    });

    switch (button.dataset.elementsMenuAction) {
      case "copy-element":
        await copyText(node.outerHTML);
        this.context?.notify("Element copied", {
          type: "success",
        });
        break;

      case "copy-selector":
        await copyText(nodePath(node));
        this.context?.notify("Selector copied", {
          type: "success",
        });
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
    if (this.isUserScrolling) return;

    const node = this.resolveNode(element.dataset.nodeId ?? "");

    if (node instanceof Element) {
      this.highlighter?.highlight(node);
    }
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
        if (this.picking) this.stopPicker();
        else this.startPicker(element);
        break;

      case "copy":
        if (this.selected) {
          void copyText(this.selected.outerHTML).then(() => {
            this.context?.notify("Element copied", {
              type: "success",
            });
          });
        }
        break;

      case "delete":
        this.deleteSelected();
        break;

      case "close-detail":
        if (this.detail) {
          this.detail.dataset.active = "false";
        }
        break;
    }
  }

  private navigate(delta: number): void {
    const next = this.historyIndex + delta;

    if (next < 0 || next >= this.history.length) {
      return;
    }

    this.historyIndex = next;

    this.select(this.history[next] ?? null, {
      addHistory: false,
      expandAncestors: true,
      reveal: true,
    });
  }

  private deleteSelected(): void {
    const element = this.selected;

    if (
      !element
      || element === document.documentElement
      || element === document.body
    ) {
      return;
    }

    const next = element.parentElement;

    element.remove();

    if (next) {
      this.select(next, {
        addHistory: true,
        expandAncestors: false,
        reveal: false,
      });
    }
  }

  private async editAttributes(element: Element): Promise<void> {
    const current = Array.from(element.attributes)
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join("\n");

    const next = await this.context?.prompt(
      "Edit attributes as name=value, one per line",
      current,
    );

    if (next == null) return;

    try {
      for (const attribute of Array.from(element.attributes)) {
        element.removeAttribute(attribute.name);
      }

      for (const line of next.split(/\r?\n/g)) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const separatorIndex = trimmed.indexOf("=");

        const name = (
          separatorIndex < 0
            ? trimmed
            : trimmed.slice(0, separatorIndex)
        ).trim();

        const value =
          separatorIndex < 0
            ? ""
            : trimmed.slice(separatorIndex + 1);

        if (name) {
          element.setAttribute(name, value);
        }
      }

      this.renderTree();
      this.renderDetail();
    } catch (error) {
      this.context?.notify(plainText(error), {
        type: "error",
      });
    }
  }

  private async editClass(element: Element): Promise<void> {
    const next = await this.context?.prompt(
      "Edit class",
      element.getAttribute("class") ?? "",
    );

    if (next == null) return;

    if (next.trim()) {
      element.setAttribute("class", next);
    } else {
      element.removeAttribute("class");
    }

    this.renderTree();
    this.renderDetail();
  }

  private async editProps(element: Element): Promise<void> {
    const current = JSON.stringify(
      {
        id: element.id,
        title: element.getAttribute("title") ?? "",
        textContent: element.textContent ?? "",
      },
      null,
      2,
    );

    const next = await this.context?.prompt(
      "Edit simple props as JSON",
      current,
    );

    if (next == null) return;

    try {
      const props = JSON.parse(next) as Record<string, unknown>;

      for (const [key, value] of Object.entries(props)) {
        if (key === "textContent") {
          element.textContent = value == null ? "" : String(value);
        } else if (key in element) {
          Reflect.set(element, key, value);
        } else if (value == null || value === false) {
          element.removeAttribute(key);
        } else {
          element.setAttribute(
            key,
            value === true ? "" : String(value),
          );
        }
      }

      this.renderTree();
      this.renderDetail();
    } catch (error) {
      this.context?.notify(
        `Invalid props JSON: ${plainText(error)}`,
        {
          type: "error",
        },
      );
    }
  }

  private startPicker(button: HTMLElement): void {
    this.stopPicker();

    this.picking = true;
    button.dataset.active = "true";
    this.context?.devtools.hide();

    const host = this.context?.shadowRoot?.host as HTMLElement | undefined;

    const move = (moveEvent: PointerEvent): void => {
      const target = document.elementFromPoint(
        moveEvent.clientX,
        moveEvent.clientY,
      );

      if (target && !isDevtoolsNode(target, host)) {
        this.highlighter?.highlight(target);
      }
    };

    const choose = (chooseEvent: PointerEvent): void => {
      chooseEvent.preventDefault();
      chooseEvent.stopPropagation();

      const target = document.elementFromPoint(
        chooseEvent.clientX,
        chooseEvent.clientY,
      );

      this.stopPicker();
      this.context?.devtools.show().showTool("elements");

      if (target && !isDevtoolsNode(target, host)) {
        this.select(target, {
          expandAncestors: true,
          reveal: true,
        });
      }
    };

    const cancel = (keyEvent: KeyboardEvent): void => {
      if (keyEvent.key !== "Escape") return;

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
      () => {
        delete button.dataset.active;
      },
    );
  }

  private stopPicker(): void {
    this.picking = false;

    for (const cleanup of this.pickerCleanup.splice(0)) {
      cleanup();
    }

    this.highlighter?.hide();
  }

  private updateAttribute(event: Event, input: HTMLElement): void {
    const selected = this.selected;

    if (
      !(selected instanceof HTMLElement || selected instanceof SVGElement)
      || !(event.target instanceof HTMLInputElement)
    ) {
      return;
    }

    const row = input.closest<HTMLElement>("[data-attribute-row]");
    const nameInput = row?.querySelector<HTMLInputElement>(
      "[data-attribute-name]",
    );
    const valueInput = row?.querySelector<HTMLInputElement>(
      "[data-attribute-value]",
    );

    const original = row?.dataset.originalName ?? "";
    const name = nameInput?.value.trim() ?? "";
    const value = valueInput?.value ?? "";

    try {
      if (original && original !== name) {
        selected.removeAttribute(original);
      }

      if (name) {
        selected.setAttribute(name, value);

        if (row) {
          row.dataset.originalName = name;
        }
      }

      this.renderTree();
      this.renderDetail();
    } catch (error) {
      this.context?.notify(plainText(error), {
        type: "error",
      });
    }
  }

  private removeAttribute(button: HTMLElement): void {
    if (!this.selected) return;

    const row = button.closest<HTMLElement>("[data-attribute-row]");
    const name = row?.dataset.originalName;

    if (name) {
      this.selected.removeAttribute(name);
    }

    this.renderTree();
    this.renderDetail();
  }

  private updateInlineStyle(event: Event, input: HTMLElement): void {
    const selected = this.selected;

    if (
      !(selected instanceof HTMLElement || selected instanceof SVGElement)
      || !(event.target instanceof HTMLInputElement)
    ) {
      return;
    }

    const row = input.closest<HTMLElement>("[data-style-declaration]");
    const propertyInput = row?.querySelector<HTMLInputElement>(
      "[data-style-property]",
    );
    const valueInput = row?.querySelector<HTMLInputElement>(
      "[data-style-value]",
    );

    const previous = row?.dataset.originalProperty ?? "";
    const property = propertyInput?.value.trim() ?? "";
    const value = valueInput?.value.trim() ?? "";

    if (previous && previous !== property) {
      selected.style.removeProperty(previous);
    }

    if (property && value) {
      const important = /\s*!important\s*$/i.test(value);

      selected.style.setProperty(
        property,
        value.replace(/\s*!important\s*$/i, ""),
        important ? "important" : "",
      );

      if (row) {
        row.dataset.originalProperty = property;
      }
    } else if (property) {
      selected.style.removeProperty(property);
    }

    this.renderDetail();
    this.highlighter?.highlight(selected);
  }

  private toggleSection(button: HTMLElement): void {
    const section = button.closest<HTMLElement>("[data-section]");
    const content = section?.querySelector<HTMLElement>(
      "[data-section-content]",
    );

    if (!section || !content) return;

    const hidden = content.dataset.hidden !== "true";

    content.dataset.hidden = String(hidden);

    const marker = button.querySelector<HTMLElement>(
      "[data-section-actions]",
    );

    if (marker) {
      marker.textContent = hidden ? "▸" : "▾";
    }
  }

  private expandAncestors(node: Node): void {
    let current: Node | null = node.parentNode;

    while (current) {
      this.expanded.add(current);
      current = current.parentNode;
    }
  }

  private nodeId(node: Node): string {
    const existing = this.nodeIds.get(node);

    if (existing) {
      return existing;
    }

    const id = `node-${++this.nodeSequence}`;

    this.nodeIds.set(node, id);

    this.idNodes.set(
      id,
      typeof WeakRef !== "undefined"
        ? new WeakRef(node)
        : node,
    );

    return id;
  }

  private resolveNode(id: string): Node | null {
    const value = this.idNodes.get(id);

    if (!value) {
      return null;
    }

    if (
      typeof WeakRef !== "undefined"
      && value instanceof WeakRef
    ) {
      const node = value.deref() ?? null;

      if (!node) {
        this.idNodes.delete(id);
      }

      return node;
    }

    return value as Node;
  }
}

function getMatchedRules(element: Element): StyleRuleInfo[] {
  const output: StyleRuleInfo[] = [];

  for (const stylesheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;

    try {
      rules = stylesheet.cssRules;
    } catch {
      // Cross-origin stylesheets expose no cssRules.
      continue;
    }

    collectRules(
      rules,
      element,
      output,
      stylesheet.href || "inline",
    );
  }

  return output.reverse();
}

function collectRules(
  rules: CSSRuleList,
  element: Element,
  output: StyleRuleInfo[],
  source: string,
): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      try {
        if (!element.matches(rule.selectorText)) {
          continue;
        }
      } catch {
        // Invalid or browser-specific selectors cannot be matched safely.
        continue;
      }

      output.push({
        selector: rule.selectorText,
        source,
        declarations: Array.from(rule.style).map((property) => ({
          property,
          value: rule.style.getPropertyValue(property),
          priority: rule.style.getPropertyPriority(property),
        })),
      });

      continue;
    }

    if ("cssRules" in rule) {
      try {
        collectRules(
          (rule as CSSGroupingRule).cssRules,
          element,
          output,
          source,
        );
      } catch {
        // Some grouping rules are inaccessible depending on browser/CSP.
      }
    }
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}
