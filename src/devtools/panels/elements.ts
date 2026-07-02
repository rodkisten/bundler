import type { CipoCssArtifact } from "../../cipo";
import { ConfigStore } from "../core/config";
import { copyText, debounce, delegate, describeNode, icon, isDevtoolsNode, nodePath, truncate } from "../core/dom";
import { getEventListeners, installEventListenerRegistry } from "../core/event-listeners";
import { ElementHighlighter } from "../core/highlighter";
import { plainText } from "../core/serialize";
import { devtoolsTokens } from "../core/style";
import { Tool } from "../tool";
import { component, event, html, ref, render, styled } from "../components/runtime";
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

type SelectOptions = {
  addHistory?: boolean;
  expandAncestors?: boolean;
  reveal?: boolean;
  highlight?: boolean;
};

interface ElementsViewModel {
  setTree(node: HTMLElement | null): void;
  setTreeWrap(node: HTMLElement | null): void;
  setCrumbs(node: HTMLElement | null): void;
  setDetail(node: HTMLElement | null): void;
  onAction(event: Event): void;
  onTreeScroll(): void;
}

void devtoolsTokens;

/* *************** */
/* Styled elements */
/* *************** */

const ElementsLayout = styled.div("RodElementsLayout").css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const ElementsTreeSide = styled.section("RodElementsTreeSide").css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  @media (min-width: 680px) {
    width: 50%;
    border-right: 1px solid $border;
  }
`;

const ElementsControl = styled.div("RodElementsControl").css`
  position: absolute;
  inset: 0 0 auto 0;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 40px;
  padding: 7px 8px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
`;

const ElementsControlSpacer = styled.div("RodElementsControlSpacer").css`
  flex: 1 1 auto;
  min-width: 4px;
`;

const ElementsIconButton = styled.button("RodElementsIconButton").css`
  appearance: none;
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border: 0;
  border-radius: $control;
  color: $primary;
  background: transparent;
  cursor: pointer;
  font-size: 17px;
  transition: color .18s, background .18s, transform .1s;

  &:hover {
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    color: $accent;
    transform: scale(.94);
  }

  &[data-active="true"] {
    color: $accent;
    background: $highlight;
  }

  &:disabled {
    opacity: .45;
    pointer-events: none;
  }
`;

const ElementsTreeWrap = styled.div("RodElementsTreeWrap").css`
  width: 100%;
  height: 100%;
  padding-top: 40px;
  padding-bottom: calc(25px + env(safe-area-inset-bottom, 0px));
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const DomTree = styled.div("RodElementsDomTree").css`
  min-width: max-content;
  padding: 5px 0 12px 12px;
  font: 12px / 1.45 $font.mono;

  ul {
    margin: 0;
    padding-left: 15px;
    list-style: none;
  }
`;

const DomRow = styled.div("RodElementsDomRow").css`
  position: relative;
  min-height: 20px;
  padding: 1px 8px 1px 2px;
  cursor: default;
  white-space: nowrap;

  &:hover {
    background: $highlight;
  }

  &[data-selected="true"] {
    color: $selectedForeground;
    background: $contrast;
  }
`;

const DomToggle = styled.span("RodElementsDomToggle").css`
  display: inline-block;
  width: 13px;
  color: $operator;
  cursor: pointer;
`;

const DomTag = styled.span("RodElementsDomTag").css`
  color: $tag;
`;

const DomAttrName = styled.span("RodElementsDomAttrName").css`
  color: $attr;
`;

const DomAttrValue = styled.span("RodElementsDomAttrValue").css`
  color: $string;
`;

const DomText = styled.span("RodElementsDomText").css`
  color: $foreground;
  white-space: pre;
`;

const ElementsCrumbs = styled.div("RodElementsCrumbs").css`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  height: calc(25px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-x: auto;
  border-top: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-size: 11px;
  white-space: nowrap;
`;

const CrumbButton = styled.button("RodElementsCrumbButton").css`
  appearance: none;
  padding: 5px 8px;
  border: 0;
  color: $primary;
  background: transparent;
  cursor: pointer;

  &[data-current="true"] {
    background: $highlight;
  }
`;

const DetailPanel = styled.section("RodElementsDetailPanel").css`
  position: absolute;
  inset: 0;
  z-index: 30;
  display: none;
  padding-top: 40px;
  background: $background;

  &[data-active="true"] {
    display: block;
  }

  @media (min-width: 680px) {
    right: 0;
    left: auto;
    display: block;
    width: 50%;
    border-left: 1px solid $border;

    [data-action="close-detail"] {
      display: none;
    }
  }
`;

const DetailTitle = styled.div("RodElementsDetailTitle").css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: $primary;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const DetailBody = styled.div("RodElementsDetailBody").css`
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const DetailSection = styled.section("RodElementsDetailSection").css`
  margin: 10px 0;
  border-top: 1px solid $border;
  border-bottom: 1px solid $border;
  background: $background;
  overflow: hidden;
`;

const SectionTitle = styled.button("RodElementsSectionTitle").css`
  appearance: none;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 9px 10px;
  border: 0;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
`;

const SectionActions = styled.span("RodElementsSectionActions").css`
  display: flex;
  gap: 3px;
  margin-left: auto;
`;

const SectionContent = styled.div("RodElementsSectionContent").css`
  padding: 10px;
  color: $foreground;

  &[data-hidden="true"] {
    display: none !important;
  }
`;

const AttributesGrid = styled.div("RodElementsAttributesGrid").css`
  display: grid;
  gap: 6px;
`;

const AttributeRow = styled.div("RodElementsAttributeRow").css`
  display: grid;
  grid-template-columns: minmax(80px, .45fr) minmax(120px, 1fr) 30px;
  gap: 6px;
`;

const AttributeInput = styled.input("RodElementsAttributeInput").css`
  min-width: 0;
  padding: 5px 7px;
  border: 1px solid $border;
  border-radius: $sm;
  color: $primary;
  background: $background;
  user-select: text;
`;

const TableWrap = styled.div("RodElementsTableWrap").css`
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const KvTable = styled.table("RodElementsKvTable").css`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  td {
    padding: 6px 8px;
    border-bottom: 1px solid $border;
    vertical-align: top;
    word-break: break-word;
    user-select: text;
  }

  td:first-child {
    width: 140px;
    color: $var;
    white-space: nowrap;
  }

  @media (max-width: 519px) {
    td:first-child {
      width: 105px;
    }
  }
`;

const PreBlock = styled.pre("RodElementsPreBlock").css`
  margin: 0;
  padding: 10px;
  overflow: auto;
  color: $foreground;
  font: 12px / 1.5 $font.mono;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
`;

const BoxModel = styled.div("RodElementsBoxModel").css`
  min-width: 300px;
  padding: 10px;
  text-align: center;
  font: 11px / 1.35 $font.mono;
`;

const BoxLayer = styled.div("RodElementsBoxLayer").css`
  margin: 5px;
  padding: 7px;
  border: 1px dashed $border;
  background: mix($highlight, transparent, 55%);

  &[data-layer="margin"] { background: rgb(246 178 107 / .22); }
  &[data-layer="border"] { background: rgb(255 229 153 / .25); }
  &[data-layer="padding"] { background: rgb(147 196 125 / .24); }
  &[data-layer="content"] { background: rgb(111 168 220 / .24); }
`;

const StyleRule = styled.div("RodElementsStyleRule").css`
  margin-bottom: 9px;
  padding: 8px;
  border: 1px solid $border;
  border-radius: $md;
  font: 12px / 1.45 $font.mono;
`;

const StyleSelector = styled.div("RodElementsStyleSelector").css`
  color: $tag;
  word-break: break-word;
`;

const StyleDeclaration = styled.div("RodElementsStyleDeclaration").css`
  display: grid;
  grid-template-columns: minmax(90px, .45fr) minmax(120px, 1fr);
  gap: 6px;
  padding-left: 13px;
`;

const StyleDeclarationInput = styled.input("RodElementsStyleDeclarationInput").css`
  min-width: 0;
  border: 0;
  outline: none;
  color: $string;
  background: transparent;
  font: inherit;
  user-select: text;

  &[data-kind="property"] {
    color: $var;
  }
`;

const ListenerBox = styled.div("RodElementsListenerBox").css`
  margin-bottom: 9px;
  padding: 0;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $md;
  font: 12px / 1.45 $font.mono;
`;

const ListenerTitle = styled.strong("RodElementsListenerTitle").css`
  display: block;
  padding: 7px 9px;
  color: $primary;
  background: $backgroundDark;
`;

const ListenerPre = styled.pre("RodElementsListenerPre").css`
  margin: 0;
  padding: 8px;
  overflow: auto;
  font: 11px / 1.4 $font.mono;
  user-select: text;
`;

const EmptyState = styled.div("RodElementsEmptyState").css`
  display: grid;
  min-height: 80px;
  place-content: center;
  padding: 24px;
  color: $foreground;
  text-align: center;
`;

const ElementsMenu = styled.div("RodElementsMenu").css`
  position: fixed;
  z-index: 2147483647;
  min-width: 165px;
  padding: 5px;
  border: 1px solid $border;
  border-radius: $section;
  color: $primary;
  background: $backgroundDark;
  box-shadow: $shadow.notification;
`;

const ElementsMenuButton = styled.button("RodElementsMenuButton").css`
  appearance: none;
  display: block;
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: $sm;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }
`;

const ELEMENTS_STYLED_COMPONENTS = Object.freeze([
  ElementsLayout,
  ElementsTreeSide,
  ElementsControl,
  ElementsControlSpacer,
  ElementsIconButton,
  ElementsTreeWrap,
  DomTree,
  DomRow,
  DomToggle,
  DomTag,
  DomAttrName,
  DomAttrValue,
  DomText,
  ElementsCrumbs,
  CrumbButton,
  DetailPanel,
  DetailTitle,
  DetailBody,
  DetailSection,
  SectionTitle,
  SectionActions,
  SectionContent,
  AttributesGrid,
  AttributeRow,
  AttributeInput,
  TableWrap,
  KvTable,
  PreBlock,
  BoxModel,
  BoxLayer,
  StyleRule,
  StyleSelector,
  StyleDeclaration,
  StyleDeclarationInput,
  ListenerBox,
  ListenerTitle,
  ListenerPre,
  EmptyState,
  ElementsMenu,
  ElementsMenuButton,
]);

export const elementsStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  ELEMENTS_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodElementsView", function RodElementsView(props) {
  const view = props.view as ElementsViewModel;
  return html`
    <RodElementsLayout data-elements-layout>
      <RodElementsTreeSide data-elements-tree-side>
        <RodElementsControl data-elements-control>
          <RodElementsIconButton type="button" data-action="back" title="Back" @click=${event((click: Event) => view.onAction(click))}>${html.unsafe(icon("back"))}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="forward" title="Forward" @click=${event((click: Event) => view.onAction(click))}>›</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="refresh" title="Refresh" @click=${event((click: Event) => view.onAction(click))}>${html.unsafe(icon("refresh"))}</RodElementsIconButton>
          <RodElementsControlSpacer />
          <RodElementsIconButton type="button" data-action="inspect" title="Select an element" @click=${event((click: Event) => view.onAction(click))}>${html.unsafe(icon("inspect"))}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="copy" title="Copy element" @click=${event((click: Event) => view.onAction(click))}>${html.unsafe(icon("copy"))}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="delete" title="Delete element" @click=${event((click: Event) => view.onAction(click))}>${html.unsafe(icon("delete"))}</RodElementsIconButton>
        </RodElementsControl>
        <RodElementsTreeWrap
          data-elements-tree-wrap
          data-roderuda-scroll-key="elements-tree"
          ref=${ref((node) => {
            view.setTreeWrap(node as HTMLElement);
            return () => view.setTreeWrap(null);
          })}
          @scroll=${event(() => view.onTreeScroll())}
        >
          <RodElementsDomTree
            data-elements-tree
            ref=${ref((node) => {
              view.setTree(node as HTMLElement);
              return () => view.setTree(null);
            })}
          />
        </RodElementsTreeWrap>
        <RodElementsCrumbs
          data-elements-crumbs
          ref=${ref((node) => {
            view.setCrumbs(node as HTMLElement);
            return () => view.setCrumbs(null);
          })}
        />
      </RodElementsTreeSide>
      <RodElementsDetailPanel
        data-elements-detail
        data-active="false"
        ref=${ref((node) => {
          view.setDetail(node as HTMLElement);
          return () => view.setDetail(null);
        })}
      />
    </RodElementsLayout>
  `;
});

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
  private treeWrap: HTMLElement | null = null;
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
  private isUserScrolling = false;
  private suppressNextClickUntil = 0;
  private scrollIdleTimer = 0;
  private pointerStart: { x: number; y: number } | null = null;
  private longPressCleanup: Array<() => void> = [];
  private disposeView: (() => void) | null = null;

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    const view: ElementsViewModel = {
      setTree: (node) => { this.tree = node; },
      setTreeWrap: (node) => { this.treeWrap = node; },
      setCrumbs: (node) => { this.crumbs = node; },
      setDetail: (node) => { this.detail = node; },
      onAction: (actionEvent) => this.handleAction(actionEvent, actionEvent.currentTarget as HTMLElement),
      onTreeScroll: () => this.handleTreeScroll(),
    };

    this.disposeView?.();
    this.disposeView = render(container, html`<RodElementsView view=${view as never} />`);

    const host = context.shadowRoot?.host instanceof HTMLElement ? context.shadowRoot.host : context.root.parentElement;
    this.highlighter = new ElementHighlighter(host);

    this.cleanup.push(delegate(container, "click", "[data-node-id]", (click, element) => this.handleNodeClick(click, element)));
    this.cleanup.push(delegate(container, "dblclick", "[data-node-id]", (dblclick, element) => this.handleNodeOpen(dblclick, element)));
    this.cleanup.push(delegate(container, "contextmenu", "[data-node-id]", (menuEvent, element) => this.handleNodeMenu(menuEvent, element)));
    this.cleanup.push(delegate(container, "pointerdown", "[data-node-id]", (pointerEvent, element) => this.startLongPress(pointerEvent, element)));
    this.cleanup.push(delegate(container, "pointerup", "[data-node-id]", () => this.cancelLongPress()));
    this.cleanup.push(delegate(container, "pointercancel", "[data-node-id]", () => this.cancelLongPress()));
    this.cleanup.push(delegate(container, "pointermove", "[data-node-id]", (pointerEvent) => this.trackLongPress(pointerEvent)));
    this.cleanup.push(delegate(container, "click", "[data-elements-menu-action]", (click, element) => { void this.handleContextAction(click, element); }));
    this.cleanup.push(delegate(container, "pointerover", "[data-node-id]", (_pointerEvent, element) => this.hoverNode(element)));
    this.cleanup.push(delegate(container, "pointerout", "[data-node-id]", () => this.highlighter?.hide()));
    this.cleanup.push(delegate(container, "click", "[data-crumb-index]", (_click, element) => {
      this.select(this.crumbElement(Number(element.dataset.crumbIndex)), {
        expandAncestors: true,
        reveal: true,
      });
    }));
    this.cleanup.push(delegate(container, "change", "[data-attribute-name]", (change, element) => this.updateAttribute(change, element)));
    this.cleanup.push(delegate(container, "click", "[data-remove-attribute]", (_click, element) => this.removeAttribute(element)));
    this.cleanup.push(delegate(container, "change", "[data-style-property]", (change, element) => this.updateInlineStyle(change, element)));
    this.cleanup.push(delegate(container, "click", "[data-detail-section]", (_click, element) => this.toggleSection(element)));

    this.config.on("change", this.onConfigChange);
    if (this.config.get("overrideEventTarget")) this.restoreEventRegistry = installEventListenerRegistry();
    this.observe();
    this.registerSettings(context);
    this.expanded.add(document.documentElement);
    this.expanded.add(document.body);
    this.select(document.body || document.documentElement, {
      addHistory: false,
      expandAncestors: true,
      reveal: false,
    });
    this.renderTree();
  }

  private select(node: Node | null, options: SelectOptions = {}): void {
    const {
      addHistory = true,
      expandAncestors = false,
      reveal = false,
      highlight = true,
    } = options;

    const element = node instanceof Element ? node : node?.parentElement;
    if (!element || isDevtoolsNode(element, this.context?.shadowRoot?.host as HTMLElement | undefined)) return;

    this.selected = element;
    if (expandAncestors) this.expandAncestors(element);

    if (addHistory) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      if (this.history[this.history.length - 1] !== element) {
        this.history.push(element);
        this.historyIndex = this.history.length - 1;
      }
    }

    this.renderTree();
    this.renderCrumbs();
    this.renderDetail();
    if (highlight) this.highlighter?.highlight(element);

    if (reveal) {
      queueMicrotask(() => {
        this.tree
          ?.querySelector<HTMLElement>("[data-selected='true']")
          ?.scrollIntoView({ block: "nearest" });
      });
    }
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
    this.disposeView?.();
    this.disposeView = null;
    this.tree = null;
    this.treeWrap = null;
    this.crumbs = null;
    this.detail = null;
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
    const rootList = document.createElement("ul");
    rootList.append(this.renderNode(document.documentElement, 0));
    this.tree.replaceChildren(rootList);
  }

  private renderNode(node: Node, depth: number): HTMLLIElement {
    const item = document.createElement("li");
    const row = styledNode<HTMLDivElement>(DomRow({
      attrs: {
        "data-node-id": this.nodeId(node),
        "data-node-depth": String(depth),
        "data-selected": String(node === this.selected),
      },
    }));
    const children = this.visibleChildren(node);
    const expandable = children.length > 0;
    const toggle = styledNode<HTMLSpanElement>(DomToggle({
      attrs: expandable ? { "data-toggle-node": "" } : undefined,
      children: expandable ? (this.expanded.has(node) ? "▾" : "▸") : "",
    }));
    row.append(toggle, this.renderNodeLabel(node));
    item.append(row);

    if (expandable && this.expanded.has(node)) {
      const list = document.createElement("ul");
      const limited = children.slice(0, 300);
      for (const child of limited) list.append(this.renderNode(child, depth + 1));
      if (children.length > limited.length) {
        const more = document.createElement("li");
        more.textContent = `… ${children.length - limited.length} more nodes`;
        list.append(more);
      }
      item.append(list);
    }
    return item;
  }

  private renderNodeLabel(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) {
      return styledNode<HTMLSpanElement>(DomText({ children: `"${truncate(node.textContent?.replace(/\s+/g, " ").trim() || "", 120)}"` }));
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      return styledNode<HTMLSpanElement>(DomText({ children: `<!--${truncate(node.textContent || "", 120)}-->` }));
    }
    if (!(node instanceof Element)) return document.createTextNode(node.nodeName);

    const fragment = document.createDocumentFragment();
    fragment.append(styledNode<HTMLSpanElement>(DomTag({ children: `<${node.tagName.toLowerCase()}` })));
    for (const attribute of Array.from(node.attributes).slice(0, 12)) {
      fragment.append(document.createTextNode(" "));
      fragment.append(styledNode<HTMLSpanElement>(DomAttrName({ children: attribute.name })));
      fragment.append(document.createTextNode('="'));
      fragment.append(styledNode<HTMLSpanElement>(DomAttrValue({ children: truncate(attribute.value, 100) })));
      fragment.append(document.createTextNode('"'));
    }
    fragment.append(styledNode<HTMLSpanElement>(DomTag({ children: ">" })));
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
    this.crumbs.replaceChildren(...elements.map((element, index) => styledNode<HTMLButtonElement>(CrumbButton({
      type: "button",
      attrs: {
        "data-crumb-index": String(index),
        "data-current": String(index === elements.length - 1),
      },
      children: crumbLabel(element),
    }))));
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

    const control = styledNode<HTMLDivElement>(ElementsControl());
    control.append(
      iconButton("back", "close-detail", "Back"),
      styledNode<HTMLDivElement>(DetailTitle({ children: describeNode(element) })),
      iconButton("refresh", "refresh-detail", "Refresh"),
    );

    const body = styledNode<HTMLDivElement>(DetailBody());
    body.append(
      this.detailSection("Attributes", "attributes", attributesHtml(attributes)),
      this.detailSection("Text Content", "text", preBlock(element.textContent || "")),
      this.detailSection("Box Model", "box", boxModelNode(style, rect)),
      this.detailSection("Computed Style", "computed", computedStyleNode(style)),
      this.detailSection("Styles", "styles", stylesNode(element, matchedRules)),
      this.detailSection("Event Listeners", "listeners", listenersNode(listeners)),
      this.detailSection("Properties", "properties", propertiesNode(element)),
    );

    this.detail.replaceChildren(control, body);
    this.detail.dataset.active = "true";
  }

  private detailSection(title: string, name: string, content: Node): HTMLElement {
    const section = styledNode<HTMLElement>(DetailSection({ attrs: { "data-section": name } }));
    const titleButton = styledNode<HTMLButtonElement>(SectionTitle({
      type: "button",
      attrs: { "data-detail-section": name },
      children: [document.createTextNode(title), styledNode<HTMLSpanElement>(SectionActions({ children: "▾" }))],
    }));
    const contentElement = styledNode<HTMLDivElement>(SectionContent({ children: content }));
    section.append(titleButton, contentElement);
    return section;
  }

  private handleTreeScroll(): void {
    this.isUserScrolling = true;
    this.suppressNextClickUntil = Date.now() + 250;
    this.cancelLongPress();

    if (this.scrollIdleTimer) window.clearTimeout(this.scrollIdleTimer);
    this.scrollIdleTimer = window.setTimeout(() => {
      this.isUserScrolling = false;
    }, 160);
  }

  private handleNodeClick(event: Event, element: HTMLElement): void {
    if (Date.now() < this.suppressNextClickUntil || this.isUserScrolling) return;
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!node) return;

    if ((event.target as Element)?.hasAttribute("data-toggle-node")) {
      if (this.expanded.has(node)) this.expanded.delete(node);
      else this.expanded.add(node);
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
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!node) return;
    this.select(node, {
      addHistory: true,
      expandAncestors: true,
      reveal: true,
      highlight: true,
    });
    if (this.detail) this.detail.dataset.active = "true";
  }

  private handleNodeMenu(event: Event, element: HTMLElement): void {
    event.preventDefault();
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!(node instanceof Element)) return;
    this.select(node, {
      addHistory: true,
      expandAncestors: false,
      reveal: false,
      highlight: true,
    });
    const pointer = event instanceof MouseEvent ? { x: event.clientX, y: event.clientY } : { x: 16, y: 16 };
    this.openContextMenu(node, pointer.x, pointer.y);
  }

  private startLongPress(event: Event, element: HTMLElement): void {
    if (!(event instanceof PointerEvent) || event.pointerType === "mouse") return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button,input,textarea,select,[contenteditable]")) return;
    const node = this.resolveNode(element.dataset.nodeId || "");
    if (!(node instanceof Element)) return;

    this.cancelLongPress();
    const startX = event.clientX;
    const startY = event.clientY;
    this.pointerStart = { x: startX, y: startY };
    this.longPressPoint = { x: startX, y: startY };

    const cancel = (): void => {
      this.suppressNextClickUntil = Date.now() + 250;
      this.cancelLongPress();
    };

    window.addEventListener("scroll", cancel, true);
    this.longPressCleanup.push(() => window.removeEventListener("scroll", cancel, true));

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
    if (!(event instanceof PointerEvent) || !this.longPressPoint || !this.longPressTimer) return;
    const distance = Math.hypot(event.clientX - this.longPressPoint.x, event.clientY - this.longPressPoint.y);
    if (distance > 10) {
      this.suppressNextClickUntil = Date.now() + 250;
      this.cancelLongPress();
    }
  }

  private cancelLongPress(): void {
    if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
    this.longPressTimer = 0;
    this.longPressPoint = null;
    this.pointerStart = null;
    for (const cleanup of this.longPressCleanup.splice(0)) cleanup();
  }

  private openContextMenu(element: Element, x: number, y: number): void {
    this.closeContextMenu();
    const menu = styledNode<HTMLDivElement>(ElementsMenu({
      attrs: {
        role: "menu",
        "data-elements-menu": "",
        "data-node-id": this.nodeId(element),
      },
    }));
    const actions = [
      ["copy-element", "Copy element"],
      ["copy-selector", "Copy selector"],
      ["edit-attributes", "Edit attributes"],
      ["edit-props", "Edit props"],
      ["edit-class", "Edit class"],
      ["delete-element", "Delete element"],
    ] as const;
    for (const [action, label] of actions) {
      menu.append(styledNode<HTMLButtonElement>(ElementsMenuButton({
        type: "button",
        attrs: { role: "menuitem", "data-elements-menu-action": action },
        children: label,
      })));
    }
    this.contextMenu = menu;
    this.context?.root.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    const close = (closeEvent: Event): void => {
      if (closeEvent.target instanceof Node && menu.contains(closeEvent.target)) return;
      this.closeContextMenu();
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (keyEvent: Event): void => {
      if (keyEvent instanceof KeyboardEvent && keyEvent.key === "Escape") close(keyEvent);
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
    this.select(node, {
      addHistory: true,
      expandAncestors: false,
      reveal: false,
      highlight: true,
    });

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
    if (this.isUserScrolling) return;
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
        if (this.detail) this.detail.dataset.active = "false";
        break;
    }
  }

  private navigate(delta: number): void {
    const next = this.historyIndex + delta;
    if (next < 0 || next >= this.history.length) return;
    this.historyIndex = next;
    this.select(this.history[next]!, {
      addHistory: false,
      expandAncestors: true,
      reveal: true,
    });
  }

  private deleteSelected(): void {
    const element = this.selected;
    if (!element || element === document.documentElement || element === document.body) return;
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
    button.dataset.active = "true";
    this.context?.devtools.hide();
    const host = this.context?.shadowRoot?.host as HTMLElement | undefined;
    const move = (moveEvent: PointerEvent): void => {
      const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (target && !isDevtoolsNode(target, host)) this.highlighter?.highlight(target);
    };
    const choose = (chooseEvent: PointerEvent): void => {
      chooseEvent.preventDefault();
      chooseEvent.stopPropagation();
      const target = document.elementFromPoint(chooseEvent.clientX, chooseEvent.clientY);
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
      () => { delete button.dataset.active; },
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
    const row = input.closest<HTMLElement>("[data-attribute-row]");
    const nameInput = row?.querySelector<HTMLInputElement>("[data-attribute-name]");
    const valueInput = row?.querySelector<HTMLInputElement>("[data-attribute-value]");
    const original = row?.dataset.originalName || "";
    const name = nameInput?.value.trim() || "";
    const value = valueInput?.value ?? "";
    try {
      if (original && original !== name) selected.removeAttribute(original);
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
    const row = button.closest<HTMLElement>("[data-attribute-row]");
    const name = row?.dataset.originalName;
    if (name) this.selected.removeAttribute(name);
    row?.remove();
    this.renderTree();
  }

  private updateInlineStyle(event: Event, input: HTMLElement): void {
    const selected = this.selected;
    if (!(selected instanceof HTMLElement || selected instanceof SVGElement) || !(event.target instanceof HTMLInputElement)) return;
    const row = input.closest<HTMLElement>("[data-style-declaration]");
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
    const section = button.closest<HTMLElement>("[data-section]");
    const content = section?.querySelector<HTMLElement>("[data-section-content]");
    if (!section || !content) return;
    const hidden = content.dataset.hidden !== "true";
    content.dataset.hidden = String(hidden);
    const marker = button.querySelector<HTMLElement>("[data-section-actions]");
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

function styledNode<T extends Element>(node: unknown): T {
  return node as T;
}

function iconButton(iconName: string, action: string, title: string): HTMLButtonElement {
  const button = styledNode<HTMLButtonElement>(ElementsIconButton({
    type: "button",
    title,
    attrs: { "data-action": action },
  }));
  button.innerHTML = icon(iconName);
  return button;
}

function crumbLabel(element: Element): string {
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${Array.from(element.classList).slice(0, 1).map((name) => `.${name}`).join("")}`;
}

function attributesHtml(attributes: Attr[]): HTMLElement {
  const grid = styledNode<HTMLDivElement>(AttributesGrid());
  for (const attribute of attributes) grid.append(attributeRow(attribute.name, attribute.value));
  grid.append(attributeRow("", "", true));
  return grid;
}

function attributeRow(name: string, value: string, empty = false): HTMLElement {
  const row = styledNode<HTMLDivElement>(AttributeRow({
    attrs: {
      "data-attribute-row": "",
      "data-original-name": name,
    },
  }));
  row.append(
    styledNode<HTMLInputElement>(AttributeInput({ attrs: { "data-attribute-name": "" }, value: name, placeholder: "attribute" })),
    styledNode<HTMLInputElement>(AttributeInput({ attrs: { "data-attribute-value": "" }, value, placeholder: "value" })),
    styledNode<HTMLButtonElement>(ElementsIconButton({
      type: "button",
      title: empty ? "Add" : "Remove",
      attrs: { "data-remove-attribute": "" },
      children: empty ? "+" : "×",
    })),
  );
  return row;
}

function preBlock(value: string): HTMLElement {
  return styledNode<HTMLElement>(PreBlock({ children: value }));
}

function boxModelNode(style: CSSStyleDeclaration, rect: DOMRect): HTMLElement {
  const values = (prefix: string, suffix = "") => ["top", "right", "bottom", "left"].map((side) => style.getPropertyValue(`${prefix}-${side}${suffix}`) || "0px").join(" · ");
  const contentWidth = Math.max(0, rect.width - number(style.paddingLeft) - number(style.paddingRight) - number(style.borderLeftWidth) - number(style.borderRightWidth));
  const contentHeight = Math.max(0, rect.height - number(style.paddingTop) - number(style.paddingBottom) - number(style.borderTopWidth) - number(style.borderBottomWidth));

  const wrap = styledNode<HTMLDivElement>(TableWrap());
  const model = styledNode<HTMLDivElement>(BoxModel());
  const margin = styledNode<HTMLDivElement>(BoxLayer({ attrs: { "data-layer": "margin" }, children: `margin ${values("margin")}` }));
  const border = styledNode<HTMLDivElement>(BoxLayer({ attrs: { "data-layer": "border" }, children: `border ${values("border", "-width")}` }));
  const padding = styledNode<HTMLDivElement>(BoxLayer({ attrs: { "data-layer": "padding" }, children: `padding ${values("padding")}` }));
  const content = styledNode<HTMLDivElement>(BoxLayer({ attrs: { "data-layer": "content" }, children: `${contentWidth.toFixed(1)} × ${contentHeight.toFixed(1)}` }));
  padding.append(content);
  border.append(padding);
  margin.append(border);
  model.append(margin);
  wrap.append(model);
  return wrap;
}

function computedStyleNode(style: CSSStyleDeclaration): HTMLElement {
  const wrap = styledNode<HTMLDivElement>(TableWrap({ style: { "max-height": "300px" } }));
  const table = styledNode<HTMLTableElement>(KvTable());
  const body = document.createElement("tbody");
  for (const property of Array.from(style).sort()) body.append(tableRow(property, style.getPropertyValue(property)));
  table.append(body);
  wrap.append(table);
  return wrap;
}

function stylesNode(element: Element, rules: StyleRuleInfo[]): HTMLElement {
  const fragment = document.createDocumentFragment();
  const inline = Array.from(element instanceof HTMLElement ? element.style : []).map((property) => ({
    property,
    value: (element as HTMLElement).style.getPropertyValue(property),
    priority: (element as HTMLElement).style.getPropertyPriority(property),
  }));
  const allRules = [{ selector: "element.style", declarations: [...inline, { property: "", value: "", priority: "" }] }, ...rules];

  allRules.forEach((rule, ruleIndex) => {
    const ruleElement = styledNode<HTMLDivElement>(StyleRule());
    const selector = styledNode<HTMLDivElement>(StyleSelector());
    selector.textContent = rule.selector;
    if (rule.source) {
      const small = document.createElement("small");
      small.textContent = ` ${rule.source}`;
      selector.append(small);
    }
    ruleElement.append(selector);

    for (const declaration of rule.declarations) {
      const declarationElement = styledNode<HTMLDivElement>(StyleDeclaration({
        attrs: ruleIndex === 0 ? { "data-style-declaration": "", "data-original-property": declaration.property } : undefined,
      }));
      if (ruleIndex === 0) {
        declarationElement.append(
          styledNode<HTMLInputElement>(StyleDeclarationInput({ attrs: { "data-style-property": "", "data-kind": "property" }, value: declaration.property, placeholder: "property" })),
          styledNode<HTMLInputElement>(StyleDeclarationInput({ attrs: { "data-style-value": "" }, value: `${declaration.value}${declaration.priority ? " !important" : ""}`, placeholder: "value" })),
        );
      } else {
        const property = document.createElement("span");
        const value = document.createElement("span");
        property.textContent = declaration.property;
        value.textContent = `${declaration.value}${declaration.priority ? " !important" : ""}`;
        declarationElement.append(property, value);
      }
      ruleElement.append(declarationElement);
    }
    fragment.append(ruleElement);
  });

  const container = document.createElement("div");
  container.append(fragment);
  return container;
}

function listenersNode(listeners: Readonly<Record<string, readonly { listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }[]>>): HTMLElement {
  const container = document.createElement("div");
  const entries = Object.entries(listeners);
  if (!entries.length) {
    container.append(styledNode<HTMLDivElement>(EmptyState({ children: "No tracked listeners." })));
    return container;
  }

  for (const [type, values] of entries) {
    const box = styledNode<HTMLDivElement>(ListenerBox());
    box.append(styledNode<HTMLElement>(ListenerTitle({ children: `${type} (${values.length})` })));
    for (const value of values) {
      box.append(styledNode<HTMLPreElement>(ListenerPre({ children: `${listenerText(value.listener)}\noptions: ${JSON.stringify(value.options ?? false)}` })));
    }
    container.append(box);
  }
  return container;
}

function listenerText(listener: EventListenerOrEventListenerObject): string {
  if (typeof listener === "function") return listener.toString();
  return listener.handleEvent?.toString() || String(listener);
}

function propertiesNode(element: Element): HTMLElement {
  const wrap = styledNode<HTMLDivElement>(TableWrap());
  const table = styledNode<HTMLTableElement>(KvTable());
  const body = document.createElement("tbody");
  body.append(tableRow("selector", nodePath(element)));
  const keys = Reflect.ownKeys(element).slice(0, 100);
  for (const key of keys) {
    let value: unknown;
    try { value = Reflect.get(element, key); } catch (error) { value = error; }
    body.append(tableRow(String(key), truncate(plainText(value), 300)));
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}

function tableRow(key: string, value: string): HTMLTableRowElement {
  const row = document.createElement("tr");
  const keyCell = document.createElement("td");
  const valueCell = document.createElement("td");
  keyCell.textContent = key;
  valueCell.textContent = value;
  row.append(keyCell, valueCell);
  return row;
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
