import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { escapeHtml, formatBytes, formatDuration, icon, truncate } from "../utils";
import { highlightCode, inferSourceType, withLineNumbers } from "../core/serialize";
import { component, event, html,  styled } from "../core/runtime";
import type { NetworkHeader, NetworkRecord } from "../types";
import "./shared-components";
import { networkListTemplate, networkRowTemplate, networkDetailTemplate, detailTabTemplate, sectionTableTemplate, headerTableTemplate, sectionPreTemplate, messagesTableTemplate, prettyBody, safeUrl } from "./network.functions";
export { networkListTemplate, networkRowTemplate, networkDetailTemplate } from "./network.functions";


export interface NetworkViewModel {
  setList(node: HTMLElement | null): void;
  setDetail(node: HTMLElement | null): void;
  setFilterInput(node: HTMLInputElement | null): void;
  onAction(event: Event): void;
  onFilterInput(event: Event): void;
  openRequest(id: string): void;
}


const NetworkIconButton = styled.button("RodNetworkIconButton").css`
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
    color: $selectedForeground;
    background: $highlight;
  }

  &:active {
    transform: scale(.94);
    color: $accent;
  }

  &[data-active="true"] {
    color: $accent;
    background: $highlight;
  }
`;

const NetworkSearch = styled.input("RodNetworkSearch").css`
  min-width: 0;
  width: min(46vw, 220px);
  height: 28px;
  padding: 0 9px;
  border: 1px solid $border;
  border-radius: $control;
  color: $primary;
  background: $background;
  font: inherit;
  font-size: 12px;
  outline: none;

  &:focus {
    border-color: $accent;
  }
`;

const NetworkList = styled.div("RodNetworkList").css`
  width: 100%;
  height: 100%;
  padding-top: $$controlHeight;
  padding-bottom: calc(var(--rd-network-bottom-padding, 96px) + var(--rd-safe-bottom));
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const NetworkTable = styled.table("RodNetworkTable").css`
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  color: $foreground;
  font-size: 12px;

  th { padding: 7px 8px; border-bottom: 1px solid $border; text-align: left; vertical-align: middle; white-space: nowrap; }
  td { padding: 7px 8px; border-bottom: 1px solid $border; text-align: left; vertical-align: middle; white-space: nowrap; }

  th {
    position: sticky;
    top: 0;
    z-index: var(--rd-z-sticky, 2147483540);
    color: $primary;
    background: $backgroundDark;
    font-weight: 600;
  }
`;

const NetworkRow = styled.tr("RodNetworkRow").css`
  cursor: pointer;

  &:hover {
    background: $highlight;
  }

  &[data-state="pending"] {
    opacity: .78;
  }

  &[data-selected="true"] {
    color: $selectedForeground;
    background: $contrast;
  }
`;

const NetworkName = styled.div("RodNetworkName").css`
  max-width: 280px;
  overflow: hidden;
  color: $primary;
  text-overflow: ellipsis;
`;

const NetworkStatus = styled.span("RodNetworkStatus").css`
  display: inline-flex;
  min-width: 34px;
  justify-content: center;
  padding: 1px 6px;
  border-radius: $sm;
  color: $primary;
  background: $highlight;
  font: 11px / 1.5 $font.mono;

  &[data-status^="2"],
  &[data-status^="3"] {
    color: $success;
  }

  &[data-status^="4"],
  &[data-status^="5"] {
    color: $danger;
  }
`;

const NetworkMethod = styled.span("RodNetworkMethod").css`
  color: $accent;
  font: 11px / 1.5 $font.mono;
`;

const NetworkDetail = styled.section("RodNetworkDetail").css`
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
    width: 50%;
    border-left: 1px solid $border;
  }
`;


const NetworkTabs = styled.div("RodNetworkTabs").css`
  position: sticky;
  top: 0;
  z-index: var(--rd-z-toolbar, 2147483530);
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid $border;
  background: $backgroundDark;
  -webkit-overflow-scrolling: touch;
`;

const NetworkTabButton = styled.button("RodNetworkTabButton").css`
  appearance: none;
  flex: 0 0 auto;
  padding: 9px 11px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &[data-active="true"] {
    color: $accent;
    border-bottom-color: $accent;
  }
`;

const NetworkPane = styled.div("RodNetworkPane").css`
  display: none;
  padding: 10px;

  &[data-active="true"] {
    display: block;
  }
`;

const NetworkSection = styled.section("RodNetworkSection").css`
  margin: 0 0 10px;
  overflow: hidden;
  border: 1px solid $border;
  border-radius: $md;
  background: $background;
`;

const NetworkSectionTitle = styled.div("RodNetworkSectionTitle").css`
  padding: 8px 10px;
  border-bottom: 1px solid $border;
  color: $primary;
  background: $backgroundDark;
  font-weight: 600;
`;


const NetworkKvTable = styled.table("RodNetworkKvTable").css`
  width: 100%;
  border-collapse: collapse;
  color: inherit;
  font-size: 12px;

  td {
    padding: 7px 9px;
    border-bottom: 1px solid $border;
    vertical-align: top;
    word-break: break-word;
    user-select: text;
  }

  td:first-child {
    width: 145px;
    color: $var;
    white-space: nowrap;
  }
`;


const NetworkCode = styled.pre("RodNetworkCode").css`
  margin: 0;
  padding: 10px;
  overflow-y: auto;
  overflow-x: hidden;
  color: $foreground;
  font: 12px / 1.5 $font.mono;
  white-space: pre;
  user-select: text;
`;

const NetworkEmpty = styled.div("RodNetworkEmpty").css`
  display: grid;
  min-height: 140px;
  place-content: center;
  gap: 5px;
  padding: 24px;
  color: $foreground;
  text-align: center;

  strong {
    color: $primary;
  }

  span {
    color: $comment;
    font-size: 12px;
  }
`;

const NETWORK_STYLED_COMPONENTS = Object.freeze([
  NetworkIconButton,
  NetworkSearch,
  NetworkList,
  NetworkTable,
  NetworkRow,
  NetworkName,
  NetworkStatus,
  NetworkMethod,
  NetworkDetail,
  NetworkTabs,
  NetworkTabButton,
  NetworkPane,
  NetworkSection,
  NetworkSectionTitle,
  NetworkKvTable,
  NetworkCode,
  NetworkEmpty,
]);

export const networkStyleArtifacts: readonly CipoCssArtifact[] = Object.freeze(
  NETWORK_STYLED_COMPONENTS.flatMap((styledComponent) => styledComponent.artifacts)
    .filter((artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodNetworkView", function RodNetworkView(props) {
  const view = props.view as NetworkViewModel;
  const filter = props.filter as string;
  const recording = props.recording as boolean;

  return html`
    <RodSharedPanelLayout data-network-layout>
      <RodSharedControlBar data-network-control>
        <RodNetworkIconButton type="button" data-action="record" data-active=${String(recording)} title="Record" @click=${event.click((click) => view.onAction(click))}>${icon("record")}</RodNetworkIconButton>
        <RodNetworkIconButton type="button" data-action="clear" title="Clear" @click=${event.click((click) => view.onAction(click))}>${icon("clear")}</RodNetworkIconButton>
        <RodSharedControlSpacer />
        <RodNetworkSearch
          data-network-filter
          type="search"
          placeholder="Filter requests"
          aria-label="Filter network requests"
          .value=${filter}
          @input=${event.input((input) => view.onFilterInput(input))}
          ref=${(node) => {
            view.setFilterInput(node as HTMLInputElement);
            return () => view.setFilterInput(null);
          }}
        />
        <RodNetworkIconButton type="button" data-action="copy" title="Copy as cURL" @click=${event.click((click) => view.onAction(click))}>${icon("copy")}</RodNetworkIconButton>
      </RodSharedControlBar>

      <RodNetworkList data-network-list ref=${(node) => {
        view.setList(node as HTMLElement);
        return () => view.setList(null);
      }} />

      <RodNetworkDetail data-network-detail data-active="false" ref=${(node) => {
        view.setDetail(node as HTMLElement);
        return () => view.setDetail(null);
      }} />
    </RodSharedPanelLayout>
  `;
});
