import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { describeNode, icon, nodePath, truncate } from "../core/dom";
import { plainText } from "../core/serialize";
import { devtoolsTokens } from "../core/style";
import { component, event, html, ref, styled } from "../components/runtime";

void devtoolsTokens;

export type RenderPiece = RenderValue;

export interface ElementsViewModel {
  setTree(node: HTMLElement | null): void;
  setCrumbs(node: HTMLElement | null): void;
  setDetail(node: HTMLElement | null): void;
  onAction(event: Event): void;
  onTreeScroll(): void;
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

  x:md {
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
  height: $$controlHeight;
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
  padding-bottom: calc(25px + var(--rd-safe-bottom));
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

const DomList = styled.ul("RodElementsDomList").css`
  margin: 0;
  padding-left: 15px;
  list-style: none;

  &[data-root="true"] {
    padding-left: 0;
  }
`;

const DomItem = styled.li("RodElementsDomItem").css`
  margin: 0;
  padding: 0;
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
  white-space: nowrap;

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
  height: calc(25px + $$safeBottom);
  padding-bottom: $$safeBottom;
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
  z-index: 30;
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
  padding-bottom: $$safeBottom;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const DetailSection = styled.section("RodElementsDetailSection").css`
  margin: 10px 0;
  overflow: hidden;
  border-top: 1px solid $border;
  border-bottom: 1px solid $border;
  background: $background;
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
  overflow: auto;
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
  grid-template-columns: minmax(90px, .45fr) minmax(120px, 1fr);
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
  ElementsLayout,
  ElementsTreeSide,
  ElementsControl,
  ElementsControlSpacer,
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
    <RodElementsLayout data-elements-layout>
      <RodElementsTreeSide data-elements-tree-side>
        <RodElementsControl data-elements-control>
          <RodElementsIconButton type="button" data-action="back" title="Back" @click=${event((click: Event) => view.onAction(click))}>${icon("back")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="forward" title="Forward" @click=${event((click: Event) => view.onAction(click))}>›</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="refresh" title="Refresh" @click=${event((click: Event) => view.onAction(click))}>${icon("refresh")}</RodElementsIconButton>
          <RodElementsControlSpacer />
          <RodElementsIconButton type="button" data-action="inspect" title="Select an element" @click=${event((click: Event) => view.onAction(click))}>${icon("inspect")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="copy" title="Copy element" @click=${event((click: Event) => view.onAction(click))}>${icon("copy")}</RodElementsIconButton>
          <RodElementsIconButton type="button" data-action="delete" title="Delete element" @click=${event((click: Event) => view.onAction(click))}>${icon("delete")}</RodElementsIconButton>
        </RodElementsControl>

        <RodElementsTreeWrap data-elements-tree-wrap data-roderuda-scroll-key="elements-tree" @scroll=${event(() => view.onTreeScroll())}>
          <RodElementsDomTree data-elements-tree ref=${ref((node) => {
            view.setTree(node as HTMLElement);
            return () => view.setTree(null);
          })} />
        </RodElementsTreeWrap>

        <RodElementsCrumbs data-elements-crumbs ref=${ref((node) => {
          view.setCrumbs(node as HTMLElement);
          return () => view.setCrumbs(null);
        })} />
      </RodElementsTreeSide>

      <RodElementsDetailPanel data-elements-detail data-active="false" ref=${ref((node) => {
        view.setDetail(node as HTMLElement);
        return () => view.setDetail(null);
      })} />
    </RodElementsLayout>
  `;
});

export function detailSectionTemplate(title: string, name: string, content: RenderPiece): RenderPiece {
  return html`
    <RodElementsDetailSection data-section=${name}>
      <RodElementsSectionTitle type="button" data-detail-section=${name}>
        <span>${title}</span>
        <RodElementsSectionActions data-section-actions>▾</RodElementsSectionActions>
      </RodElementsSectionTitle>
      <RodElementsSectionContent data-section-content>${content}</RodElementsSectionContent>
    </RodElementsDetailSection>
  `;
}

export function attributesTemplate(attributes: ElementAttributeModel[]): RenderPiece {
  return html`
    <RodElementsAttributesGrid>
      ${attributes.map((attribute) => attributeTemplate(attribute.name, attribute.value))}
      ${attributeTemplate("", "", true)}
    </RodElementsAttributesGrid>
  `;
}

export function attributeTemplate(name: string, value: string, empty = false): RenderPiece {
  return html`
    <RodElementsAttributeRow data-attribute-row data-original-name=${name}>
      <RodElementsAttributeInput data-attribute-name .value=${name} placeholder="attribute" />
      <RodElementsAttributeInput data-attribute-value .value=${value} placeholder="value" />
      <RodElementsIconButton type="button" title=${empty ? "Add" : "Remove"} data-remove-attribute>${empty ? "+" : "×"}</RodElementsIconButton>
    </RodElementsAttributeRow>
  `;
}

export function boxModelTemplate(style: CSSStyleDeclaration, rect: DOMRect): RenderPiece {
  const values = (prefix: string, suffix = "") => ["top", "right", "bottom", "left"]
    .map((side) => style.getPropertyValue(`${prefix}-${side}${suffix}`) || "0px")
    .join(" · ");

  const contentWidth = Math.max(
    0,
    rect.width - number(style.paddingLeft) - number(style.paddingRight) - number(style.borderLeftWidth) - number(style.borderRightWidth),
  );

  const contentHeight = Math.max(
    0,
    rect.height - number(style.paddingTop) - number(style.paddingBottom) - number(style.borderTopWidth) - number(style.borderBottomWidth),
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
}

export function computedStyleTemplate(style: CSSStyleDeclaration): RenderPiece {
  return html`
    <RodElementsTableWrap data-compact="computed">
      <RodElementsKvTable>
        <tbody>
          ${Array.from(style).sort().map((property) => html`
            <tr>
              <td>${property}</td>
              <td>${style.getPropertyValue(property)}</td>
            </tr>
          `)}
        </tbody>
      </RodElementsKvTable>
    </RodElementsTableWrap>
  `;
}

export function stylesTemplate(rules: StyleRuleModel[]): RenderPiece {
  return html`
    <div>
      ${rules.map((rule) => html`
        <RodElementsStyleRule>
          <RodElementsStyleSelector>
            ${rule.selector}${rule.source ? html`<RodElementsStyleSource> ${rule.source}</RodElementsStyleSource>` : ""}
          </RodElementsStyleSelector>

          ${rule.declarations.map((declaration) => html`
            <RodElementsStyleDeclaration data-style-declaration=${rule.editable ? "" : null} data-original-property=${rule.editable ? declaration.property : null}>
              ${rule.editable ? html`
                <RodElementsStyleDeclarationInput data-style-property data-kind="property" .value=${declaration.property} placeholder="property" />
                <RodElementsStyleDeclarationInput data-style-value .value=${`${declaration.value}${declaration.priority ? " !important" : ""}`} placeholder="value" />
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
}

export function listenersTemplate(listeners: ListenerModel[]): RenderPiece {
  if (!listeners.length) {
    return html`<RodElementsEmptyState>No tracked listeners.</RodElementsEmptyState>`;
  }

  return html`
    <div>
      ${listeners.map((entry) => html`
        <RodElementsListenerBox>
          <RodElementsListenerTitle>${entry.type} (${entry.values.length})</RodElementsListenerTitle>
          ${entry.values.map((value) => html`
            <RodElementsListenerPre>${listenerText(value.listener)}\noptions: ${JSON.stringify(value.options ?? false)}</RodElementsListenerPre>
          `)}
        </RodElementsListenerBox>
      `)}
    </div>
  `;
}

export function propertiesTemplate(properties: PropertyModel[]): RenderPiece {
  return html`
    <RodElementsTableWrap>
      <RodElementsKvTable>
        <tbody>
          ${properties.map((property) => html`
            <tr>
              <td>${property.key}</td>
              <td>${property.value}</td>
            </tr>
          `)}
        </tbody>
      </RodElementsKvTable>
    </RodElementsTableWrap>
  `;
}

export function detailTitleTemplate(element: Element, onAction: (event: Event) => void): RenderPiece {
  return html`
    <RodElementsControl data-elements-detail-control>
      <RodElementsIconButton type="button" data-action="close-detail" title="Back" @click=${event(onAction)}>${icon("back")}</RodElementsIconButton>
      <RodElementsDetailTitle>${describeNode(element)}</RodElementsDetailTitle>
      <RodElementsIconButton type="button" data-action="refresh-detail" title="Refresh" @click=${event(onAction)}>${icon("refresh")}</RodElementsIconButton>
    </RodElementsControl>
  `;
}

export function detailBodyTemplate(content: RenderPiece): RenderPiece {
  return html`<RodElementsDetailBody>${content}</RodElementsDetailBody>`;
}

export function preBlockTemplate(value: string): RenderPiece {
  return html`<RodElementsPreBlock>${value}</RodElementsPreBlock>`;
}

export function domTreeTemplate(content: RenderPiece): RenderPiece {
  return html`<RodElementsDomList data-root="true">${content}</RodElementsDomList>`;
}

export function domNodeTemplate(options: {
  nodeId: string;
  depth: number;
  selected: boolean;
  expandable: boolean;
  expanded: boolean;
  label: RenderPiece;
  children?: RenderPiece;
  moreCount?: number;
}): RenderPiece {
  return html`
    <RodElementsDomItem>
      <RodElementsDomRow data-node-id=${options.nodeId} data-node-depth=${String(options.depth)} data-selected=${String(options.selected)}>
        <RodElementsDomToggle data-toggle-node=${options.expandable ? "" : null}>${options.expandable ? (options.expanded ? "▾" : "▸") : ""}</RodElementsDomToggle>
        ${options.label}
      </RodElementsDomRow>

      ${options.expandable && options.expanded ? html`
        <RodElementsDomList>
          ${options.children ?? ""}
          ${(options.moreCount ?? 0) > 0 ? html`<RodElementsDomMoreItem>… ${options.moreCount} more nodes</RodElementsDomMoreItem>` : ""}
        </RodElementsDomList>
      ` : ""}
    </RodElementsDomItem>
  `;
}

export function nodeLabelTemplate(node: Node): RenderPiece {
  if (node.nodeType === Node.TEXT_NODE) {
    return html`<RodElementsDomText>"${truncate(node.textContent?.replace(/\s+/g, " ").trim() || "", 120)}"</RodElementsDomText>`;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return html`<RodElementsDomText>&lt;!--${truncate(node.textContent || "", 120)}--&gt;</RodElementsDomText>`;
  }

  if (!(node instanceof Element)) return node.nodeName;

  return html`
    <RodElementsDomTag>&lt;${node.tagName.toLowerCase()}</RodElementsDomTag>
    ${Array.from(node.attributes).slice(0, 12).map((attribute) => html`
      ${" "}<RodElementsDomAttrName>${attribute.name}</RodElementsDomAttrName>="<RodElementsDomAttrValue>${truncate(attribute.value, 100)}</RodElementsDomAttrValue>"
    `)}
    <RodElementsDomTag>&gt;</RodElementsDomTag>
  `;
}

export function crumbsTemplate(elements: Element[]): RenderPiece {
  return html`
    ${elements.map((element, index) => html`
      <RodElementsCrumbButton type="button" data-crumb-index=${String(index)} data-current=${String(index === elements.length - 1)}>
        ${crumbLabel(element)}
      </RodElementsCrumbButton>
    `)}
  `;
}

export function contextMenuTemplate(elementId: string): RenderPiece {
  const actions = [
    ["copy-element", "Copy element"],
    ["copy-selector", "Copy selector"],
    ["edit-attributes", "Edit attributes"],
    ["edit-props", "Edit props"],
    ["edit-class", "Edit class"],
    ["delete-element", "Delete element"],
  ] as const;

  return html`
    <RodElementsMenu role="menu" data-elements-menu data-node-id=${elementId}>
      ${actions.map(([action, label]) => html`
        <RodElementsMenuButton type="button" role="menuitem" data-elements-menu-action=${action}>${label}</RodElementsMenuButton>
      `)}
    </RodElementsMenu>
  `;
}

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
