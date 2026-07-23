import type { CipoCssArtifact } from "@rodkisten/cipo";
import { icon } from "@rodkisten/devtools/utils";
import { component, event, html, repeat, styled, when } from "@rodkisten/devtools/core/runtime";
import type { NetworkContextValue } from "@rodkisten/devtools/types";
import "@rodkisten/devtools/panels/shared-components";
import { networkRowTemplate, networkDetailTemplate } from "@rodkisten/devtools/panels/network.functions";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import { filterArray, findArray, flatMap } from "@rodkisten/nascente";
export { networkListTemplate, networkRowTemplate, networkDetailTemplate } from "@rodkisten/devtools/panels/network.functions";


export const NetworkContext = createRequiredFabricaContext<NetworkContextValue>("NetworkContext");

const NetworkIconButton = styled.button("RodNetworkIconButton").css`
  @with($control-reset)
  interactive-surface

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

  x:hover {
    color: $selectedForeground
    bg: $highlight
  }

  x:active {
    transform: scale(.94)
    color: $accent
  }

  state(active=true) {
    color: $accent
    bg: $highlight
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

  x:focus {
    border-color: $accent
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

  x:hover {
    bg: $highlight
  }

  &:state='pending' {
    opacity: .78
  }

  state(selected=true) {
    color: $selectedForeground
    bg: $contrast
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
  text(11px / 1.5, tabular)
  font-family: $font.mono

  &:status^='2',
  &:status^='3' {
    color: $success
  }

  &:status^='4',
  &:status^='5' {
    color: $danger
  }
`;

const NetworkMethod = styled.span("RodNetworkMethod").css`
  color: $accent;
  text(11px / 1.5)
  font-family: $font.mono
`;

const NetworkDetail = styled.section("RodNetworkDetail").css`
  position: absolute;
  inset: 0;
  z-index: var(--rd-z-dropdown, 2147483550);
  display: none;
  padding-top: $$controlHeight;
  background: $background;

  state(active=true) {
    block
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
  @with($control-reset)
  interactive-surface

  flex: 0 0 auto;
  padding: 9px 11px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: $primary;
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  state(active=true) {
    color: $accent
    border-bottom-color: $accent
  }
`;

const NetworkPane = styled.div("RodNetworkPane").css`
  display: none;
  padding: 10px;

  state(active=true) {
    block
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
  text(12px / 1.5)
  font-family: $font.mono
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
  filterArray(flatMap(NETWORK_STYLED_COMPONENTS, (styledComponent) => styledComponent.artifacts), (artifact): artifact is CipoCssArtifact => artifact.kind === "cipo.css"),
);

component("RodNetworkView", function RodNetworkView(_props, ctx) {
  const network = ctx.useRequiredContext(NetworkContext);
  const selectedRecord = () => {
    const id = network.selectedId();
    return id ? findArray(network.records(), (record) => record.id === id) ?? null : null;
  };

  return html`
    <RodSharedPanelLayout :networkLayout>
      <RodSharedControlBar :networkControl>
        <RodNetworkIconButton type="button" :action="record" :active=${network.recording} title="Record" @click=${event.click((click) => network.onAction(click))}>${icon("record")}</RodNetworkIconButton>
        <RodNetworkIconButton type="button" :action="clear" title="Clear" @click=${event.click((click) => network.onAction(click))}>${icon("clear")}</RodNetworkIconButton>
        <RodSharedControlSpacer />
        <RodNetworkSearch
          :networkFilter
          type="search"
          placeholder="Filter requests"
          aria-label="Filter network requests"
          .value=${network.filter}
          @input=${event.input((input) => network.onFilterInput(input))}
        />
        <RodNetworkIconButton type="button" :action="copy" title="Copy as cURL" @click=${event.click((click) => network.onAction(click))}>${icon("copy")}</RodNetworkIconButton>
      </RodSharedControlBar>

      <RodNetworkList :networkList>
        ${when(
          () => network.records().length > 0,
          () => html`
            <RodNetworkTable>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                ${repeat(
                  network.records,
                  (record) => record.id,
                  ({ item }) => () => networkRowTemplate(
                    item(),
                    () => network.selectedId() === item().id,
                    network.openRequest,
                  ),
                )}
              </tbody>
            </RodNetworkTable>
          `,
          () => html`
            <RodNetworkEmpty>
              <strong>No requests</strong>
              <span>fetch, XHR, WebSocket and resource timing entries appear here.</span>
            </RodNetworkEmpty>
          `,
        )}
      </RodNetworkList>

      <RodNetworkDetail :networkDetail :active=${network.detailOpen}>
        ${() => {
          const record = selectedRecord();
          if (!record || !network.detailOpen()) return null;
          return networkDetailTemplate(record, {
            activeTab: network.activeDetailTab(),
            captureResponseBody: network.captureResponseBody(),
            bodyPreviewLimit: network.bodyPreviewLimit(),
            onAction: (actionEvent) => network.onAction(actionEvent),
            onTab: (tabEvent) => network.switchDetailTab((tabEvent.currentTarget as HTMLElement).dataset.detailTab || "headers"),
          });
        }}
      </RodNetworkDetail>
    </RodSharedPanelLayout>
  `;
});
