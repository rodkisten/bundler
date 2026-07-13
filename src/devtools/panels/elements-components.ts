import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { describeNode, icon, nodePath, truncate } from "../utils";
import { plainText } from "../core/serialize";
import { bootstrapDevtoolsCipo } from "../core/cipo-bootstrap";
import { component, event, html,  styled } from "../core/runtime";
import "./shared-components";

bootstrapDevtoolsCipo();

export interface ElementsViewModel {
  setTree(node: HTMLElement | null): void;
  setCrumbs(node: HTMLElement | null): void;
  setDetail(node: HTMLElement | null): void;
  onAction(event: Event): void;
  onTreeScroll(): void;
  wrapLines(): boolean;
}

export type ElementAttributeModel = {
  name: string;
  value: string;
};

export type StyleDeclarationModel = {
  property: string;
  value: string;
  priority: string;
};

export type StyleRuleInfo = {
  selector: string;
  declarations: StyleDeclarationModel[];
  source?: string;
};

export type StyleRuleModel = StyleRuleInfo & {
  editable: boolean;
};

export type ListenerModel = {
  type: string;
  values: readonly {
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }[];
};

export type PropertyModel = {
  key: string;
  value: string;
};

/* *************** */
/* Styled elements */
/* *************** */

const ElementsTreeSide = styled.section("RodElementsTreeSide").css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  x:md {
    width: 50%;
    border-right: 1px solid $border;
  }
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
  font: inherit;
  font-size: 17px;
  cursor: pointer;
  transition: color .18s, background .18s, transform .1s;

  &:hover {
    background: $highlight;
    color: $selectedForeground;
  }

  &:active {
    transform: scale(.94);
    color: $accent;
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
  padding-top: $$controlHeight;
  padding-bottom: calc(var(--rd-elements-bottom-padding, 96px) + var(--rd-safe-bottom));
  scroll-padding-bottom: calc(var(--rd-elements-bottom-padding, 96px) + var(--rd-safe-bottom));
  overflow-y: auto;
  overscroll-behavior: contain;
  text-wrap: wrap;
  overflow-wrap: wrap;
  white-space: wrap;
  -webkit-overflow-scrolling: touch;
`;

const DomTree = styled.div("RodElementsDomTree").css`
  min-width: max-content;
  padding: 5px 0 12px 12px;
  font: 12px / 1.45 $font.mono;

  &[data-wrap="true"] {
    min-width: 100%;
  }

  &[data-wrap="true"] RodElementsDomRow {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  ul {
    margin: 0;
    padding-left: var(--rd-elements-indent, 15px);
    list-style: none;
  }
`;

const DomList = styled.ul("RodElementsDomList").css`
  margin: 0;
  padding-left: var(--rd-elements-indent, 15px);
  list-style: none;

  &[data-root="true"] {
    padding-left: 0;
  }
`;

const DomItem = styled.li("RodElementsDomItem").css`
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  m: 0;
  p: 0;
`;

const DomMoreItem = styled.li("RodElementsDomMoreItem").css`
  min-height: 20px;
  padding: 1px 8px 1px 15px;
  color: $comment;
  white-space: nowrap;
`;

const DomRow = styled.div("RodElementsDomRow").css`
  position: relative;
  min-height: 20px;
  padding: 1px 8px 1px 2px;
  cursor: default;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: pan-y;
  white-space: normal;
  
  &:hover {
    background: $highlight;
  }

  &[data-selected="true"] {
    background: $contrast;
    color: $selectedForeground;
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
  height: calc(25px + var(--rd-safe-bottom));
  padding-bottom: var(--rd-safe-bottom);
  overflow-x: auto;
  border-top: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-size: 11px;
  white-space: nowrap;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const CrumbButton = styled.button("RodElementsCrumbButton").css`
  appearance: none;
  flex: 0 0 auto;
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
  z-index: var(--rd-z-dropdown, 2147483550);
  display: none;
  padding-top: $$controlHeight;
  background: $background;

  &[data-active="true"] {
    display: block;
  }

  x:md {
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

const DetailSection = styled.section("RodElementsDetailSection").css`
  margin: 10px 0;
  overflow: hidden;
  border-top: 1px solid $border;
  border-bottom: 1px solid $border;
  background: $background;
  user-select: none;
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
  font: inherit;
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
  font: inherit;
  user-select: text;
`;

const TableWrap = styled.div("RodElementsTableWrap").css`
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;

  &[data-compact="computed"] {
    max-height: 300px;
  }
`;

const KvTable = styled.table("RodElementsKvTable").css`
  width: 100%;
  border-collapse: collapse;
  color: inherit;
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

  x:xs {
    td:first-child {
      width: 105px;
    }
  }
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
  background: rgb(255 255 255 / .04);

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

const StyleSource = styled.small("RodElementsStyleSource").css`
  color: $comment;
`;

const StyleDeclaration = styled.div("RodElementsStyleDeclaration").css`
  display: grid;
  grid-template-columns: minmax(fit-content, .45fr) minmax(120px, 1fr);
  gap: 6px;
  padding-left: 13px;
`;

const StyleDeclarationText = styled.span("RodElementsStyleDeclarationText").css`
  color: $string;

  &[data-kind="property"] {
    color: $var;
  }
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
  overflow-y: auto;
  overflow-x: hidden;
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
  z-index: var(--rd-z-inspector, 2147483580);
  min-width: 165px;
  padding: 5px;
  border: 1px solid $border;
  border-radius: $section;
  color: $primary;
  background: $backgroundDark;
  box-shadow: $shadow.notification;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: manipulation;
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
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: $selectedForeground;
    background: $highlight;
  }
`;

const ELEMENTS_STYLED_COMPONENTS = Object.freeze([
  ElementsTreeSide,
  ElementsIconButton,
  ElementsTreeWrap,
  DomTree,
  DomList,
  DomItem,
  DomMoreItem,
  DomRow,
  DomToggle,
  DomTag,
  DomAttrName,
  DomAttrValue,
  DomText,
  ElementsCrumbs,
  CrumbButton,
  DetailPanel,
  DetailSection,
  SectionTitle,
  SectionActions,
  SectionContent,
  AttributesGrid,
  AttributeRow,
  AttributeInput,
  TableWrap,
  KvTable,
  BoxModel,
  BoxLayer,
  StyleRule,
  StyleSelector,
  StyleSource,
  StyleDeclaration,
  StyleDeclarationText,
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
    <RodSharedPanelLayout data-elements-layout>
      <RodElementsTreeSide data-elements-tree-side>
        <RodSharedControlBar data-elements-control>
          <RodElementsIconButton type="button" data-action="back" title="Back" @click=${event((click: Event) => view.onAction(click))}>${icon("back")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="forward" title="Forward" @click=${event((click: Event) => view.onAction(click))}>${icon("forward")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="refresh" title="Refresh" @click=${event((click: Event) => view.onAction(click))}>${icon("refresh")}</RodElementsIconButton>
          <RodSharedControlSpacer />
          <RodElementsIconButton type="button" data-action="inspect" title="Select an element" @click=${event((click: Event) => view.onAction(click))}>${icon("inspect")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="copy" title="Copy element" @click=${event((click: Event) => view.onAction(click))}>${icon("copy")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="delete" title="Delete element" @click=${event((click: Event) => view.onAction(click))}>${icon("delete")}</RodElementsIconButton>
        </RodSharedControlBar>

        <RodElementsTreeWrap data-elements-tree-wrap data-roderuda-scroll-key="elements-tree" @scroll=${event(() => view.onTreeScroll())}>
          <RodElementsDomTree data-elements-tree data-wrap=${String(view.wrapLines())} ref=${(node) => {
            view.setTree(node as HTMLElement);
            return () => view.setTree(null);
          }} />
        </RodElementsTreeWrap>

        <RodElementsCrumbs data-elements-crumbs ref=${(node) => {
          view.setCrumbs(node as HTMLElement);
          return () => view.setCrumbs(null);
        }} />
      </RodElementsTreeSide>

      <RodElementsDetailPanel data-elements-detail data-active="false" ref=${(node) => {
        view.setDetail(node as HTMLElement);
        return () => view.setDetail(null);
      }} />
    </RodSharedPanelLayout>
  `;
});

export const ElementsDetailSectionView = component<{
  title: string;
  name: string;
  children?: RenderValue;
  onToggle?: (event: Event) => void;
}>("RodElementsDetailSectionView", function RodElementsDetailSectionView(props) {
  return html`
    <RodElementsDetailSection data-section=${props.name} draggable="true">
      <RodElementsSectionTitle
        type="button"
        data-detail-section=${props.name}
        @click=${event((click: Event) => props.onToggle?.(click))}
      >
        <span data-section-drag-handle aria-label="Drag section">⋮⋮</span><span><strong>${props.title}</strong></span>
        <RodElementsSectionActions data-section-actions>▾</RodElementsSectionActions>
      </RodElementsSectionTitle>
      <RodElementsSectionContent data-section-content>${props.children}</RodElementsSectionContent>
    </RodElementsDetailSection>
  `;
});

export const ElementsAttributeRowView = component<{
  name: string;
  value: string;
  empty?: boolean;
  onChange?: (event: Event) => void;
  onRemove?: (event: Event) => void;
}>("RodElementsAttributeRowView", function RodElementsAttributeRowView(props) {
  return html`
    <RodElementsAttributeRow data-attribute-row data-original-name=${props.name}>
      <RodElementsAttributeInput
        data-attribute-name
        .value=${props.name}
        placeholder="attribute"
        @change=${event((change: Event) => props.onChange?.(change))}
      />
      <RodElementsAttributeInput
        data-attribute-value
        .value=${props.value}
        placeholder="value"
        @change=${event((change: Event) => props.onChange?.(change))}
      />
      <RodElementsIconButton
        type="button"
        title=${props.empty ? "Add" : "Remove"}
        data-remove-attribute
        @click=${event((click: Event) => props.onRemove?.(click))}
      >${props.empty ? "+" : "×"}</RodElementsIconButton>
    </RodElementsAttributeRow>
  `;
});

export const ElementsAttributesView = component<{
  attributes: ElementAttributeModel[];
  onChange?: (event: Event) => void;
  onRemove?: (event: Event) => void;
}>("RodElementsAttributesView", function RodElementsAttributesView(props) {
  return html`
    <RodElementsAttributesGrid>
      ${props.attributes.map((attribute) => html`
        <RodElementsAttributeRowView
          name=${attribute.name}
          value=${attribute.value}
          .onChange=${props.onChange as never}
          .onRemove=${props.onRemove as never}
        />
      `)}
      <RodElementsAttributeRowView
        name=""
        value=""
        .empty=${true}
        .onChange=${props.onChange as never}
        .onRemove=${props.onRemove as never}
      />
    </RodElementsAttributesGrid>
  `;
});

export const ElementsBoxModelView = component<{
  style: CSSStyleDeclaration;
  rect: DOMRect;
}>("RodElementsBoxModelView", function RodElementsBoxModelView(props) {
  const values = (prefix: string, suffix = "") => ["top", "right", "bottom", "left"]
    .map((side) => props.style.getPropertyValue(`${prefix}-${side}${suffix}`) || "0px")
    .join(" · ");

  const contentWidth = Math.max(
    0,
    props.rect.width - number(props.style.paddingLeft) - number(props.style.paddingRight)
      - number(props.style.borderLeftWidth) - number(props.style.borderRightWidth),
  );
  const contentHeight = Math.max(
    0,
    props.rect.height - number(props.style.paddingTop) - number(props.style.paddingBottom)
      - number(props.style.borderTopWidth) - number(props.style.borderBottomWidth),
  );

  return html`
    <RodElementsTableWrap>
      <RodElementsBoxModel>
        <RodElementsBoxLayer data-layer="margin">
          margin ${values("margin")}
          <RodElementsBoxLayer data-layer="border">
            border ${values("border", "-width")}
            <RodElementsBoxLayer data-layer="padding">
              padding ${values("padding")}
              <RodElementsBoxLayer data-layer="content">${contentWidth.toFixed(1)} × ${contentHeight.toFixed(1)}</RodElementsBoxLayer>
            </RodElementsBoxLayer>
          </RodElementsBoxLayer>
        </RodElementsBoxLayer>
      </RodElementsBoxModel>
    </RodElementsTableWrap>
  `;
});

export const ElementsComputedStyleView = component<{
  style: CSSStyleDeclaration;
}>("RodElementsComputedStyleView", function RodElementsComputedStyleView(props) {
  return html`
    <RodElementsTableWrap data-compact="computed">
      <RodElementsKvTable>
        <tbody>
          ${Array.from(props.style).sort().map((property) => html`<tr><td>${property}</td><td>${props.style.getPropertyValue(property)}</td></tr>`)}
        </tbody>
      </RodElementsKvTable>
    </RodElementsTableWrap>
  `;
});

export const ElementsStylesView = component<{
  rules: StyleRuleModel[];
  onChange?: (event: Event) => void;
}>("RodElementsStylesView", function RodElementsStylesView(props) {
  return html`
    <div>
      ${props.rules.map((rule) => html`
        <RodElementsStyleRule>
          <RodElementsStyleSelector>
            ${rule.selector}${rule.source ? html`<RodElementsStyleSource> ${rule.source}</RodElementsStyleSource>` : ""}
          </RodElementsStyleSelector>
          ${rule.declarations.map((declaration) => html`
            <RodElementsStyleDeclaration data-style-declaration=${rule.editable ? "" : null} data-original-property=${rule.editable ? declaration.property : null}>
              ${rule.editable ? html`
                <RodElementsStyleDeclarationInput data-style-property data-kind="property" .value=${declaration.property} placeholder="property" @change=${event((change: Event) => props.onChange?.(change))} />
                <RodElementsStyleDeclarationInput data-style-value .value=${`${declaration.value}${declaration.priority ? " !important" : ""}`} placeholder="value" @change=${event((change: Event) => props.onChange?.(change))} />
              ` : html`
                <RodElementsStyleDeclarationText data-kind="property">${declaration.property}</RodElementsStyleDeclarationText>
                <RodElementsStyleDeclarationText>${declaration.value}${declaration.priority ? " !important" : ""}</RodElementsStyleDeclarationText>
              `}
            </RodElementsStyleDeclaration>
          `)}
        </RodElementsStyleRule>
      `)}
    </div>
  `;
});

export const ElementsListenersView = component<{
  listeners: ListenerModel[];
}>("RodElementsListenersView", function RodElementsListenersView(props) {
  if (!props.listeners.length) return html`<RodElementsEmptyState>No tracked listeners.</RodElementsEmptyState>`;
  return html`
    <div>
      ${props.listeners.map((entry) => html`
        <RodElementsListenerBox>
          <RodElementsListenerTitle>${entry.type} (${entry.values.length})</RodElementsListenerTitle>
          ${entry.values.map((value) => html`<RodElementsListenerPre>${listenerText(value.listener)}\noptions: ${JSON.stringify(value.options ?? false)}</RodElementsListenerPre>`)}
        </RodElementsListenerBox>
      `)}
    </div>
  `;
});

export const ElementsPropertiesView = component<{
  properties: PropertyModel[];
}>("RodElementsPropertiesView", function RodElementsPropertiesView(props) {
  return html`
    <RodElementsTableWrap>
      <RodElementsKvTable>
        <tbody>
          ${props.properties.map((property) => html`<tr><td>${property.key}</td><td>${property.value}</td></tr>`)}
        </tbody>
      </RodElementsKvTable>
    </RodElementsTableWrap>
  `;
});

export const ElementsDetailHeaderView = component<{
  element: Element;
  onAction: (event: Event) => void;
}>("RodElementsDetailHeaderView", function RodElementsDetailHeaderView(props) {
  return html`
    <RodSharedControlBar data-elements-detail-control>
      <RodElementsIconButton type="button" data-action="close-detail" title="Back" @click=${event(props.onAction)}>${icon("back")}</RodElementsIconButton>
      <RodSharedDetailTitle>
        <RodElementsDomTag>&lt;${props.element.tagName.toLowerCase()}</RodElementsDomTag>
        ${props.element.id ? html`<RodElementsDomAttrName>#${props.element.id}</RodElementsDomAttrName>` : ""}
        ${Array.from(props.element.classList).slice(0, 6).map((name) => html`<RodElementsDomAttrValue>.${name}</RodElementsDomAttrValue>`)}
        <RodElementsDomTag>&gt;</RodElementsDomTag>
      </RodSharedDetailTitle>
      <RodElementsIconButton type="button" data-action="refresh-detail" title="Refresh" @click=${event(props.onAction)}>${icon("refresh")}</RodElementsIconButton>
    </RodSharedControlBar>
  `;
});

export const ElementsDetailBodyView = component<{ children?: RenderValue }>(
  "RodElementsDetailBodyView",
  (props) => html`<RodSharedScrollableBody>${props.children}</RodSharedScrollableBody>`,
);

export const ElementsPreBlockView = component<{ value: string }>(
  "RodElementsPreBlockView",
  (props) => html`<RodSharedPreBlock>${props.value}</RodSharedPreBlock>`,
);

export const ElementsDomTreeView = component<{ children?: RenderValue }>(
  "RodElementsDomTreeView",
  (props) => html`<RodElementsDomList data-root="true">${props.children}</RodElementsDomList>`,
);

export const ElementsDomNodeView = component<{
  node: Node;
  nodeId: string;
  depth: number;
  selected: boolean;
  expandable: boolean;
  expanded: boolean;
  children?: RenderValue;
  moreCount?: number;
  onClick?: (event: Event) => void;
  onDoubleClick?: (event: Event) => void;
  onContextMenu?: (event: Event) => void;
  onPointerDown?: (event: Event) => void;
  onPointerUp?: (event: Event) => void;
  onPointerCancel?: (event: Event) => void;
  onPointerMove?: (event: Event) => void;
  onPointerOver?: (event: Event) => void;
  onPointerOut?: (event: Event) => void;
}>("RodElementsDomNodeView", function RodElementsDomNodeView(props) {
  return html`
    <RodElementsDomItem>
      <RodElementsDomRow
        data-node-id=${props.nodeId}
        data-node-depth=${String(props.depth)}
        data-selected=${String(props.selected)}
        @click=${event((value: Event) => props.onClick?.(value))}
        @dblclick=${event((value: Event) => props.onDoubleClick?.(value))}
        @contextmenu=${event((value: Event) => props.onContextMenu?.(value))}
        @pointerdown=${event((value: Event) => props.onPointerDown?.(value))}
        @pointerup=${event((value: Event) => props.onPointerUp?.(value))}
        @pointercancel=${event((value: Event) => props.onPointerCancel?.(value))}
        @pointermove=${event((value: Event) => props.onPointerMove?.(value))}
        @pointerover=${event((value: Event) => props.onPointerOver?.(value))}
        @pointerout=${event((value: Event) => props.onPointerOut?.(value))}
      >
        <RodElementsDomToggle data-toggle-node=${props.expandable ? "" : null}>${props.expandable ? (props.expanded ? "▾" : "▸") : ""}</RodElementsDomToggle>
        <RodElementsNodeLabelView props=${{ node: props.node }} />
      </RodElementsDomRow>
      ${props.expandable && props.expanded ? html`
        <RodElementsDomList>
          ${props.children}
          ${(props.moreCount ?? 0) > 0 ? html`<RodElementsDomMoreItem>... ${props.moreCount} more nodes</RodElementsDomMoreItem>` : ""}
        </RodElementsDomList>
      ` : ""}
    </RodElementsDomItem>
  `;
});

export const ElementsNodeLabelView = component<{ node: Node }>(
  "RodElementsNodeLabelView",
  function RodElementsNodeLabelView(props) {
    const node = props.node;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/\s+/g, " ").trim();
      //return text ? html`<RodElementsDomText>"${truncate(text, 300)}"</RodElementsDomText>` : html`<RodElementsDomText data-empty-text>[empty text]</RodElementsDomText>`;
      return text ? html`<RodElementsDomText>"${truncate(text, 300)}"</RodElementsDomText>` : null;
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      return html`<RodElementsDomText>&lt;!--${truncate(node.textContent || "", 300)}--&gt;</RodElementsDomText>`;
    }
    if (!(node instanceof Element)) return node.nodeName;
    return html`
      <RodElementsDomTag>&lt;${node.tagName.toLowerCase()}</RodElementsDomTag>
      ${Array.from(node.attributes).slice(0, 24).map((attribute) => html`
        ${" "}<RodElementsDomAttrName>${attribute.name}</RodElementsDomAttrName>="<RodElementsDomAttrValue>${truncate(attribute.value, 200)}</RodElementsDomAttrValue>"
      `)}
      <RodElementsDomTag>&gt;</RodElementsDomTag>
    `;
  },
);

export const ElementsCrumbsView = component<{
  elements: Element[];
  onSelect?: (index: number, event: Event) => void;
}>("RodElementsCrumbsView", (props) => html`
  ${props.elements.map((element, index) => html`
    <RodElementsCrumbButton
      type="button"
      data-crumb-index=${String(index)}
      data-current=${String(index === props.elements.length - 1)}
      @click=${event((click: Event) => props.onSelect?.(index, click))}
    >${crumbLabel(element)}</RodElementsCrumbButton>
  `)}
`);

export const ElementsContextMenuView = component<{
  elementId: string;
  onAction?: (action: string, event: Event) => void;
}>("RodElementsContextMenuView", function RodElementsContextMenuView(props) {
  const actions = [
    ["open-details", "Open details"],
    ["reveal-element", "Reveal on page"],
    ["toggle-children", "Expand / collapse"],
    ["copy-element", "Copy element"],
    ["copy-selector", "Copy selector"],
    ["edit-attributes", "Edit attributes"],
    ["edit-props", "Edit props"],
    ["edit-class", "Edit class"],
    ["delete-element", "Delete element"],
  ] as const;

  return html`
    <RodElementsMenu role="menu" data-elements-menu data-node-id=${props.elementId}>
      ${actions.map(([action, label]) => html`
        <RodElementsMenuButton
          type="button"
          role="menuitem"
          data-elements-menu-action=${action}
          @click=${event((click: Event) => props.onAction?.(action, click))}
        >${label}</RodElementsMenuButton>
      `)}
    </RodElementsMenu>
  `;
});

export function styleRuleModels(element: Element, rules: StyleRuleInfo[]): StyleRuleModel[] {
  const inline = Array.from(element instanceof HTMLElement ? element.style : []).map((property) => ({
    property,
    value: (element as HTMLElement).style.getPropertyValue(property),
    priority: (element as HTMLElement).style.getPropertyPriority(property),
  }));

  return [
    {
      selector: "element.style",
      declarations: [...inline, { property: "", value: "", priority: "" }],
      editable: true,
    },
    ...rules.map((rule) => ({
      ...rule,
      editable: false,
    })),
  ];
}

export function listenerModels(
  listeners: Readonly<Record<string, readonly {
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }[]>>,
): ListenerModel[] {
  return Object.entries(listeners).map(([type, values]) => ({ type, values }));
}

export function propertyModels(element: Element): PropertyModel[] {
  const rows: PropertyModel[] = [{ key: "selector", value: nodePath(element) }];
  const keys = Reflect.ownKeys(element).slice(0, 100);

  for (const key of keys) {
    let value: unknown;

    try {
      value = Reflect.get(element, key);
    } catch (error) {
      value = error;
    }

    rows.push({
      key: String(key),
      value: truncate(plainText(value), 300),
    });
  }

  return rows;
}

export function crumbLabel(element: Element): string {
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${Array.from(element.classList).slice(0, 1).map((name) => `.${name}`).join("")}`;
}

function listenerText(listener: EventListenerOrEventListenerObject): string {
  if (typeof listener === "function") return listener.toString();
  return listener.handleEvent?.toString() || String(listener);
}

function number(value: string): number {
  return Number.parseFloat(value) || 0;
}
