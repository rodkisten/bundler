import { signal } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";
import { ConfigStore } from "@rodkisten/devtools/core/config";
import { getEventListeners, installEventListenerRegistry } from "@rodkisten/devtools/core/event-listeners";
import { ElementHighlighter } from "@rodkisten/devtools/core/highlighter";
import { plainText } from "@rodkisten/devtools/core/serialize";
import { Tool } from "@rodkisten/devtools/tool";
import type { Cleanup, ElementsConfig, ElementsContextValue, ToolContext } from "@rodkisten/devtools/types";
import { copyText, icon, isDevtoolsNode, nodePath } from "@rodkisten/devtools/utils";
import { html } from "@rodkisten/devtools/core/runtime";
import {
  elementsStyleArtifacts,
  listenerModels,
  propertyModels,
  styleRuleModels,
  ElementsContext,
  ElementsContextMenuView,
  ElementsDomTreeView,
  ElementsDomNodeView,
} from "@rodkisten/devtools/panels/elements-components";
import { getMatchedRules, clamp, meaningfulText } from "@rodkisten/devtools/panels/elements.functions";
import { at, drainArray, filterArray, forEachObject, includesArray, mapArray, mapJoinArray, someArray, splitLines, take, toArray } from "@rodkisten/nascente";


export { elementsStyleArtifacts };

type SelectOptions = {
  addHistory?: boolean;
  expandAncestors?: boolean;
  reveal?: boolean;
  highlight?: boolean;
};

export class Elements extends Tool {
  readonly name = "elements";
  readonly title = "elements";
  readonly icon = icon("elements");

  readonly config = new ConfigStore<ElementsConfig>("elements", {
    overrideEventTarget: true,
    observeElement: true,
    showWhitespace: false,
    wrapLines: true,
    highlightDuration: 850,
    persistentHighlight: false,
    mutationRenderDelay: 80,
    detailRenderDelay: 120,
    longPressDuration: 650,
    longPressMoveTolerance: 10,
    contextMenuMargin: 8,
    treeBottomPadding: 96,
    rowIndent: 14,
    maxVisibleChildren: 300,
  });

  public container: HTMLElement | null = null;
  public tree: HTMLElement | null = null;
  public crumbs: HTMLElement | null = null;
  private readonly treeRevision = signal(0, { name: "elements.treeRevision" });
  private readonly crumbsRevision = signal(0, { name: "elements.crumbsRevision" });
  private readonly detailRevision = signal(0, { name: "elements.detailRevision" });
  private readonly selectedState = signal<Element | null>(null, { name: "elements.selected" });
  private readonly detailsOpenState = signal(false, { name: "elements.detailsOpen" });
  private readonly wrapLinesState = signal(this.config.get("wrapLines"), { name: "elements.wrapLines" });
  private readonly contextMenuState = signal<{ element: Element; x: number; y: number } | null>(null, { name: "elements.contextMenu" });
  private readonly view: ElementsContextValue = {
    treeRevision: this.treeRevision,
    crumbsRevision: this.crumbsRevision,
    detailRevision: this.detailRevision,
    selected: this.selectedState,
    detailsOpen: this.detailsOpenState,
    wrapLines: this.wrapLinesState,
    setTreeViewport: (node) => { this.tree = node; },
    setCrumbsViewport: (node) => { this.crumbs = node; },
    onAction: (actionEvent) => this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement),
    onTreeScroll: () => this.handleTreeScroll(),
    treeView: () => this.renderTreeContent(),
    crumbsView: () => this.renderCrumbsContent(),
    detailView: () => this.renderDetailContent(),
    contextMenuView: () => this.contextMenuContent(),
  };

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

  private contextMenu: HTMLElement | null = null;
  private contextMenuCleanup: Cleanup | null = null;

  private picking = false;
  private isUserScrolling = false;
  private suppressNextClickUntil = 0;

  private longPressTimer = 0;
  private longPressPoint: { x: number; y: number } | null = null;
  private scrollIdleTimer = 0;

  private treeInvalidationTimer = 0;
  private detailInvalidationTimer = 0;

  /** Coalesces noisy external DOM mutations into one reactive revision write. */
  private scheduleTreeInvalidation(): void {
    window.clearTimeout(this.treeInvalidationTimer);
    this.treeInvalidationTimer = window.setTimeout(() => {
      this.treeInvalidationTimer = 0;
      if (this.active) this.invalidateTree();
    }, this.config.get("mutationRenderDelay"));
  }

  /** Coalesces detail-only mutations without rebuilding the DOM tree. */
  private scheduleDetailInvalidation(): void {
    window.clearTimeout(this.detailInvalidationTimer);
    this.detailInvalidationTimer = window.setTimeout(() => {
      this.detailInvalidationTimer = 0;
      if (this.active) this.invalidateDetail();
    }, this.config.get("detailRenderDelay"));
  }

  /** Current inspected element. Reads stay non-tracking outside component expressions. */
  get selected(): Element | null {
    return this.selectedState.peek();
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    this.container = container;


    const host = context.shadowRoot?.host instanceof HTMLElement
      ? context.shadowRoot.host
      : context.root.parentElement;

    this.highlighter = new ElementHighlighter(host);

    this.config.on("change", this.onConfigChange);
    this.applyTweakVariables();

    if (this.config.get("overrideEventTarget")) {
      this.restoreEventRegistry = installEventListenerRegistry();
    }

    this.registerSettings(context);

    // Keep the panel shell mounted, but defer document traversal and the
    // full-page MutationObserver until Elements is actually visible. Large
    // application DOMs otherwise consume the main thread while another tool
    // is selected.
    this.selectedState.set(document.body || document.documentElement);
    if (document.documentElement) this.expanded.add(document.documentElement);
    if (document.body) this.expanded.add(document.body);
  }


  override renderView(): RenderValue {
    return ElementsContext.Provider({
      value: this.view,
      children: () => html`<RodElementsView />`,
    });
  }

  override show(): void {
    super.show();

    if (!this.selected) {
      this.selectedState.set(document.body || document.documentElement);
    }
    if (this.selected) this.expandAncestors(this.selected);

    this.observe();
    this.invalidateTree();
    this.invalidateCrumbs();
    if (this.detailsOpenState.peek()) this.invalidateDetail();
  }

  override hide(): void {
    super.hide();

    this.observer?.disconnect();
    this.stopPicker();
    this.closeContextMenu();
    this.highlighter?.hide();
  }

  override destroy(): void {
    this.stopPicker();
    this.cancelLongPress();
    this.closeContextMenu();

    window.clearTimeout(this.treeInvalidationTimer);
    window.clearTimeout(this.detailInvalidationTimer);

    if (this.scrollIdleTimer) {
      window.clearTimeout(this.scrollIdleTimer);
      this.scrollIdleTimer = 0;
    }

    this.observer?.disconnect();
    this.observer = null;

    this.restoreEventRegistry?.();
    this.restoreEventRegistry = null;

    this.config.off("change", this.onConfigChange);

    for (const cleanup of drainArray(this.cleanup)) {
      cleanup();
    }

    this.highlighter?.destroy();
    this.highlighter = null;
    this.container = null;
    this.tree = null;
    this.crumbs = null;
    this.selectedState.set(null);
    this.detailsOpenState.set(false);
    this.contextMenuState.set(null);

    this.history = [];
    this.historyIndex = -1;

    this.idNodes.clear();

    super.destroy();
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

    this.selectedState.set(element);
    if (this.active) {
      this.invalidateCrumbs();
      if (this.detailsOpenState.peek()) this.invalidateDetail();
    }

    if (expandAncestors) {
      this.expandAncestors(element);
    }

    if (addHistory) {
      this.history = take(this.history, this.historyIndex + 1);

      if (at(this.history, -1) !== element) {
        this.history.push(element);
        this.historyIndex = this.history.length - 1;
      }
    }


    if (highlight && (this.active || this.picking)) {
      this.highlighter?.highlight(element, true, this.config.get("persistentHighlight") ? 0 : this.config.get("highlightDuration"));
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
      if (value && this.active) this.observe();
      else this.observer?.disconnect();
    }

    if (key === "overrideEventTarget") {
      this.restoreEventRegistry?.();
      this.restoreEventRegistry = value
        ? installEventListenerRegistry()
        : null;

      if (this.active) this.invalidateDetail();
    }

    if (key === "wrapLines") {
      this.wrapLinesState.set(Boolean(value));
    }

    if (includesArray(["treeBottomPadding", "rowIndent"], key)) this.applyTweakVariables();

    if ((key === "showWhitespace" || key === "maxVisibleChildren") && this.active) {
      this.invalidateTree();
    }
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerConfigGroup({
      title: "Elements",
      config: this.config,
      settings: [
        { kind: "switch", key: "overrideEventTarget", label: "Track EventTarget listeners" },
        { kind: "switch", key: "observeElement", label: "Automatically refresh DOM mutations" },
        { kind: "switch", key: "showWhitespace", label: "Show whitespace-only text nodes" },
        { kind: "switch", key: "wrapLines", label: "Soft wrap long DOM rows" },
        { kind: "number", key: "highlightDuration", label: "Highlight duration (ms)", options: { min: 0, max: 10000, step: 50 } },
        { kind: "switch", key: "persistentHighlight", label: "Keep selected node highlighted" },
        { kind: "number", key: "mutationRenderDelay", label: "DOM mutation update delay (ms)", options: { min: 0, max: 2000, step: 10 } },
        { kind: "number", key: "detailRenderDelay", label: "Details update delay (ms)", options: { min: 0, max: 2000, step: 10 } },
        { kind: "number", key: "longPressDuration", label: "Long press duration (ms)", options: { min: 150, max: 2000, step: 25 } },
        { kind: "number", key: "longPressMoveTolerance", label: "Long press movement tolerance", options: { min: 2, max: 60, step: 1 } },
        { kind: "number", key: "contextMenuMargin", label: "Context menu edge margin", options: { min: 0, max: 64, step: 1 } },
        { kind: "number", key: "treeBottomPadding", label: "DOM tree bottom padding", options: { min: 0, max: 320, step: 4 } },
        { kind: "number", key: "rowIndent", label: "DOM nesting indentation", options: { min: 4, max: 40, step: 1 } },
        { kind: "number", key: "maxVisibleChildren", label: "Maximum children per expanded node", options: { min: 25, max: 5000, step: 25 } },
      ],
    });
  }

  private applyTweakVariables(): void {
    if (!this.container) return;
    this.container.style.setProperty("--rd-elements-bottom-padding", `${this.config.get("treeBottomPadding")}px`);
    this.container.style.setProperty("--rd-elements-indent", `${this.config.get("rowIndent")}px`);
  }

  private observe(): void {
    this.observer?.disconnect();

    if (!this.active || !this.config.get("observeElement") || !document.documentElement) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      const devtoolsHost = this.context?.shadowRoot?.host as HTMLElement | undefined;

      const relevantMutations = filterArray(mutations, (mutation) => !isDevtoolsNode(mutation.target, devtoolsHost));

      if (!this.active || !relevantMutations.length) return;

      // Collapsed branches have no mounted rows below them, so rebuilding the
      // visible tree for mutations deep inside those branches only burns CPU.
      // Their contents are read fresh when the user expands the branch.
      if (someArray(relevantMutations, (mutation) => this.mutationTouchesVisibleTree(mutation))) {
        this.scheduleTreeInvalidation();
      }

      if (
        this.selected
        && someArray(relevantMutations, (mutation) =>
            mutation.target === this.selected
            || (this.selected?.contains(mutation.target) ?? false))
      ) {
        this.scheduleDetailInvalidation();
      }
    });

    this.observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }

  private mutationTouchesVisibleTree(mutation: MutationRecord): boolean {
    const target = mutation.target;

    if (mutation.type === "childList") {
      return this.isNodeVisibleInTree(target) && this.expanded.has(target);
    }

    return this.isNodeVisibleInTree(target);
  }

  private isNodeVisibleInTree(node: Node): boolean {
    let current: Node | null = node.nodeType === Node.TEXT_NODE
      ? node.parentNode
      : node;

    while (current && current !== document.documentElement) {
      const parent = current.parentNode;
      if (!parent || !this.expanded.has(parent)) return false;
      current = parent;
    }

    return current === document.documentElement;
  }

  private invalidateTree(): void {
    this.treeRevision.update((current) => current + 1);
  }

  private renderTreeContent(): RenderValue {
    // Keep the shell mounted, but do not walk the inspected page until this
    // panel is active. show() bumps treeRevision and materializes the tree.
    if (!this.active || !document.documentElement) return null;

    return ElementsDomTreeView({
      children: this.renderNode(document.documentElement, 0),
    });
  }

  private renderNode(node: Node, depth: number): import("@rodkisten/fabrica").RenderValue {
    const children = this.visibleChildren(node);
    const expandable = children.length > 0;
    const expanded = this.expanded.has(node);
    const limited = take(children, this.config.get("maxVisibleChildren"));
    const moreCount = children.length - limited.length;
    const nodeId = this.nodeId(node);

    return ElementsDomNodeView({
      node,
      nodeId,
      depth,
      selected: () => this.selectedState() === node,
      expandable,
      expanded,
      moreCount,
      onClick: (click: Event) => this.handleNodeClick(click, click.currentTarget as HTMLElement),
      onDoubleClick: (doubleClick: Event) => this.handleNodeOpen(doubleClick, doubleClick.currentTarget as HTMLElement),
      onContextMenu: (menuEvent: Event) => this.handleNodeMenu(menuEvent, menuEvent.currentTarget as HTMLElement),
      onPointerDown: (pointerEvent: Event) => this.startLongPress(pointerEvent, pointerEvent.currentTarget as HTMLElement),
      onPointerUp: () => this.cancelLongPress(),
      onPointerCancel: () => this.cancelLongPress(),
      onPointerMove: (pointerEvent: Event) => this.trackLongPress(pointerEvent),
      onPointerOver: (pointerEvent: Event) => this.hoverNode(pointerEvent, pointerEvent.currentTarget as HTMLElement),
      onPointerOut: () => this.highlighter?.hide(),
      children: expanded
        ? mapArray(limited, (child) => this.renderNode(child, depth + 1))
        : null,
    });
  }

  private visibleChildren(node: Node): Node[] {
    const host = this.context?.shadowRoot?.host as HTMLElement | undefined;

    return filterArray(node.childNodes, (child) => {
      if (isDevtoolsNode(child, host)) {
        return false;
      }

      if (
        !this.config.get("showWhitespace")
        && child.nodeType === Node.TEXT_NODE
        && !meaningfulText(child.textContent)
      ) {
        return false;
      }

      return true;
    });
  }

  private invalidateCrumbs(): void {
    this.crumbsRevision.update((current) => current + 1);
  }

  private renderCrumbsContent(): RenderValue {
    if (!this.selected) return null;

    const elements: Element[] = [];
    let current: Element | null = this.selected;

    while (current) {
      elements.unshift(current);
      current = current.parentElement;
    }

    queueMicrotask(() => {
      if (this.crumbs) this.crumbs.scrollLeft = this.crumbs.scrollWidth;
    });

    return html`
      <RodElementsCrumbsView
        props=${{
          elements,
          onSelect: (index: number) => {
            this.select(elements[index] ?? null, {
              expandAncestors: true,
              reveal: true,
            });
          },
        }}
      />
    `;
  }

  private invalidateDetail(): void {
    this.detailRevision.update((current) => current + 1);
  }

  private renderDetailContent(): RenderValue {
    const element = this.selected;
    if (!element) return null;

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const matchedRules = getMatchedRules(element);
    const listeners = listenerModels(getEventListeners(element));
    const attributes = mapArray(element.attributes, (attribute) => ({
      name: attribute.name,
      value: attribute.value,
    }));
    const rules = styleRuleModels(element, matchedRules);
    const properties = propertyModels(element);
    const toggle = (toggleEvent: Event) => this.toggleSection(toggleEvent.currentTarget as HTMLElement);

    return html`
      <RodElementsDetailHeaderView props=${{
        element,
        onAction: (click: Event) => this.handleAction(click, click.currentTarget as HTMLElement),
      }} />
      <RodElementsDetailBodyView>
        <RodElementsDetailSectionView props=${{ title: "Attributes", name: "attributes", onToggle: toggle }}>
          <RodElementsAttributesView props=${{
            attributes,
            onChange: (change: Event) => this.updateAttribute(change, change.currentTarget as HTMLElement),
            onRemove: (click: Event) => this.removeAttribute(click.currentTarget as HTMLElement),
          }} />
        </RodElementsDetailSectionView>
        <RodElementsDetailSectionView props=${{ title: "Styles", name: "styles", onToggle: toggle }}>
          <RodElementsStylesView props=${{
            rules,
            onChange: (change: Event) => this.updateInlineStyle(change, change.currentTarget as HTMLElement),
          }} />
        </RodElementsDetailSectionView>
        <RodElementsDetailSectionView props=${{ title: "Properties", name: "properties", onToggle: toggle }}>
          <RodElementsPropertiesView props=${{ properties }} />
        </RodElementsDetailSectionView>
        <RodElementsDetailSectionView props=${{ title: "Text Content", name: "text", onToggle: toggle }}>
          <RodElementsPreBlockView value=${element.textContent || ""} />
        </RodElementsDetailSectionView>
        <RodElementsDetailSectionView props=${{ title: "Box Model", name: "box", onToggle: toggle }}>
          <RodElementsBoxModelView props=${{ style, rect }} />
        </RodElementsDetailSectionView>
        <RodElementsDetailSectionView props=${{ title: "Computed Style", name: "computed", onToggle: toggle }}>
          <RodElementsComputedStyleView props=${{ style }} />
        </RodElementsDetailSectionView>
        <RodElementsDetailSectionView props=${{ title: "Event Listeners", name: "listeners", onToggle: toggle }}>
          <RodElementsListenersView props=${{ listeners }} />
        </RodElementsDetailSectionView>
      </RodElementsDetailBodyView>
    `;
  }

  private handleTreeScroll(): void {
    this.isUserScrolling = true;
    this.suppressNextClickUntil = Date.now() + 250;

    this.cancelLongPress();

    window.clearTimeout(this.treeInvalidationTimer);
    window.clearTimeout(this.detailInvalidationTimer);

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

      this.invalidateTree();
      return;
    }

    this.detailsOpenState.set(false);
    this.select(node, {
      addHistory: true,
      expandAncestors: false,
      reveal: false,
      highlight: false,
    });
    this.invalidateDetail();
  }

  private handleNodeOpen(event: Event, element: HTMLElement): void {
    event.preventDefault();

    const node = this.resolveNode(element.dataset.nodeId ?? "");
    if (!node) return;

    this.detailsOpenState.set(true);
    this.select(node, {
      addHistory: true,
      expandAncestors: true,
      reveal: false,
      highlight: true,
    });
    this.invalidateDetail();
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

    event.preventDefault();
    element.setPointerCapture?.(event.pointerId);

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
    }, this.config.get("longPressDuration"));
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

    if (distance > this.config.get("longPressMoveTolerance")) {
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

    for (const cleanup of drainArray(this.longPressCleanup)) {
      cleanup();
    }
  }

  private openContextMenu(element: Element, x: number, y: number): void {
    this.closeContextMenu();
    this.contextMenuState.set({ element, x, y });
  }

  private contextMenuContent(): RenderValue {
    const state = this.contextMenuState();
    if (!state) return null;

    return ElementsContextMenuView({
      elementId: this.nodeId(state.element),
      onAction: (_action: string, click: Event) => {
        void this.handleContextAction(click, click.currentTarget as HTMLElement);
      },
      menuRef: (node: HTMLElement) => this.mountContextMenu(node, state.x, state.y),
    });
  }

  private mountContextMenu(menu: HTMLElement, x: number, y: number): Cleanup {
    this.contextMenu = menu;
    const menuHost = this.container ?? this.context?.root;
    const hostRect = menuHost?.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportOffsetX = viewport?.offsetLeft ?? 0;
    const viewportOffsetY = viewport?.offsetTop ?? 0;
    const localX = x + viewportOffsetX - (hostRect?.left ?? 0);
    const localY = y + viewportOffsetY - (hostRect?.top ?? 0);
    const rect = menu.getBoundingClientRect?.();
    const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : menu.offsetWidth || 180;
    const height = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : menu.offsetHeight || 220;
    const availableWidth = hostRect?.width || viewport?.width || window.innerWidth || width + 16;
    const availableHeight = hostRect?.height || viewport?.height || window.innerHeight || height + 16;
    const margin = this.config.get("contextMenuMargin");

    menu.style.left = `${clamp(localX, margin, availableWidth - width - margin)}px`;
    menu.style.top = `${clamp(localY, margin, availableHeight - height - margin)}px`;

    const close = (closeEvent: Event): void => {
      if (closeEvent.target instanceof Node && menu.contains(closeEvent.target)) return;
      this.closeContextMenu();
    };
    const onKey = (keyEvent: Event): void => {
      if (keyEvent instanceof KeyboardEvent && keyEvent.key === "Escape") this.closeContextMenu();
    };

    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", onKey, true);

    const cleanup = (): void => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey, true);
      if (this.contextMenu === menu) this.contextMenu = null;
      if (this.contextMenuCleanup === cleanup) this.contextMenuCleanup = null;
    };
    this.contextMenuCleanup = cleanup;
    return cleanup;
  }

  private closeContextMenu(): void {
    this.contextMenuCleanup?.();
    this.contextMenuCleanup = null;
    this.contextMenu = null;
    this.contextMenuState.set(null);
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

      case "open-details":
        this.detailsOpenState.set(true);
        this.invalidateDetail();
        break;

      case "reveal-element":
        this.selected?.scrollIntoView({ block: "center", inline: "nearest" });
        break;

      case "toggle-children":
        if (this.selected) {
          if (this.expanded.has(this.selected)) this.expanded.delete(this.selected);
          else this.expanded.add(this.selected);
          this.invalidateTree();
        }
        break;

      case "delete-element":
        this.deleteSelected();
        break;
    }
  }

  private hoverNode(pointerEvent: Event, element: HTMLElement): void {
    if (
      !this.active
      || this.picking
      || this.isUserScrolling
      || !(pointerEvent instanceof PointerEvent)
      || pointerEvent.pointerType !== "mouse"
    ) {
      return;
    }

    const node = this.resolveNode(element.dataset.nodeId ?? "");
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
        this.invalidateTree();
        this.invalidateDetail();
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
        this.detailsOpenState.set(false);
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
    const current = mapJoinArray(element.attributes, (attribute) => `${attribute.name}=${attribute.value}`, "\n");

    const next = await this.context?.prompt(
      "Edit attributes as name=value, one per line",
      current,
    );

    if (next == null) return;

    try {
      for (const attribute of toArray(element.attributes)) {
        element.removeAttribute(attribute.name);
      }

      for (const line of splitLines(next)) {
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

      this.invalidateTree();
      this.invalidateDetail();
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

    this.invalidateTree();
    this.invalidateDetail();
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

      forEachObject(props, (value, key) => {
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
      });

      this.invalidateTree();
      this.invalidateDetail();
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
        this.highlighter?.highlight(target, true, 0);
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
        this.detailsOpenState.set(false);
        this.select(target, {
          expandAncestors: true,
          reveal: false,
          highlight: true,
        });
      }
    };

    const cancel = (keyEvent: KeyboardEvent): void => {
      if (keyEvent.key !== "Escape") return;

      this.stopPicker();
      this.context?.devtools.show();
    };

    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", choose, true);
    document.addEventListener("keydown", cancel, true);

    this.pickerCleanup.push(
      () => document.removeEventListener("pointermove", move, true),
      () => document.removeEventListener("pointerup", choose, true),
      () => document.removeEventListener("keydown", cancel, true),
      () => {
        delete button.dataset.active;
      },
    );
  }

  private stopPicker(): void {
    this.picking = false;

    for (const cleanup of drainArray(this.pickerCleanup)) {
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

      this.invalidateTree();
      this.invalidateDetail();
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

    this.invalidateTree();
    this.invalidateDetail();
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

    this.invalidateDetail();
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
