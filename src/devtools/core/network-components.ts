import type { CipoCssArtifact } from "../../cipo";
import type { RenderValue } from "../../fabrica";
import { escapeHtml, formatBytes, formatDuration, icon, truncate } from "../core/dom";
import { highlightCode, inferSourceType, withLineNumbers } from "../core/serialize";
import { component, event, html, ref, styled } from "../components/runtime";
import type { NetworkHeader, NetworkRecord } from "../types";

export type RenderPiece = RenderValue;

export interface NetworkViewModel {
  setList(node: HTMLElement | null): void;
  setDetail(node: HTMLElement | null): void;
  setFilterInput(node: HTMLInputElement | null): void;
  onAction(event: Event): void;
  onFilterInput(event: Event): void;
  openRequest(id: string): void;
}

const NetworkLayout = styled.div("RodNetworkLayout").css`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const NetworkControl = styled.div("RodNetworkControl").css`
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

const NetworkControlSpacer = styled.div("RodNetworkControlSpacer").css`
  flex: 1 1 auto;
  min-width: 4px;
`;

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
  padding-bottom: $$safeBottom;
  overflow: auto;
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
    z-index: 2;
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
    width: 50%;
    border-left: 1px solid $border;
  }
`;

const NetworkDetailTitle = styled.div("RodNetworkDetailTitle").css`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: $primary;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const NetworkDetailBody = styled.div("RodNetworkDetailBody").css`
  height: 100%;
  padding-bottom: $$safeBottom;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
`;

const NetworkTabs = styled.div("RodNetworkTabs").css`
  position: sticky;
  top: 0;
  z-index: 5;
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

const NetworkTableWrap = styled.div("RodNetworkTableWrap").css`
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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

const NetworkPre = styled.pre("RodNetworkPre").css`
  margin: 0;
  padding: 10px;
  overflow: auto;
  color: $foreground;
  font: 12px / 1.5 $font.mono;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
`;

const NetworkCode = styled.pre("RodNetworkCode").css`
  margin: 0;
  padding: 10px;
  overflow: auto;
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
  NetworkLayout,
  NetworkControl,
  NetworkControlSpacer,
  NetworkIconButton,
  NetworkSearch,
  NetworkList,
  NetworkTable,
  NetworkRow,
  NetworkName,
  NetworkStatus,
  NetworkMethod,
  NetworkDetail,
  NetworkDetailTitle,
  NetworkDetailBody,
  NetworkTabs,
  NetworkTabButton,
  NetworkPane,
  NetworkSection,
  NetworkSectionTitle,
  NetworkTableWrap,
  NetworkKvTable,
  NetworkPre,
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
    <RodNetworkLayout data-network-layout>
      <RodNetworkControl data-network-control>
        <RodNetworkIconButton type="button" data-action="record" data-active=${String(recording)} title="Record" @click=${event((click: Event) => view.onAction(click))}>${icon("record")}</RodNetworkIconButton>
        <RodNetworkIconButton type="button" data-action="clear" title="Clear" @click=${event((click: Event) => view.onAction(click))}>${icon("clear")}</RodNetworkIconButton>
        <RodNetworkControlSpacer />
        <RodNetworkSearch
          data-network-filter
          type="search"
          placeholder="Filter requests"
          aria-label="Filter network requests"
          .value=${filter}
          @input=${event((input: Event) => view.onFilterInput(input))}
          ref=${ref((node) => {
            view.setFilterInput(node as HTMLInputElement);
            return () => view.setFilterInput(null);
          })}
        />
        <RodNetworkIconButton type="button" data-action="copy" title="Copy as cURL" @click=${event((click: Event) => view.onAction(click))}>${icon("copy")}</RodNetworkIconButton>
      </RodNetworkControl>

      <RodNetworkList data-network-list ref=${ref((node) => {
        view.setList(node as HTMLElement);
        return () => view.setList(null);
      })} />

      <RodNetworkDetail data-network-detail data-active="false" ref=${ref((node) => {
        view.setDetail(node as HTMLElement);
        return () => view.setDetail(null);
      })} />
    </RodNetworkLayout>
  `;
});

export function networkListTemplate(records: NetworkRecord[], selectedId: string | null, onOpen: (id: string) => void): RenderPiece {
  if (!records.length) {
    return html`
      <RodNetworkEmpty>
        <strong>No requests</strong>
        <span>fetch, XHR, WebSocket and resource timing entries appear here.</span>
      </RodNetworkEmpty>
    `;
  }

  return html`
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
        ${records.map((record) => networkRowTemplate(record, selectedId, onOpen))}
      </tbody>
    </RodNetworkTable>
  `;
}

export function networkRowTemplate(record: NetworkRecord, selectedId: string | null, onOpen: (id: string) => void): RenderPiece {
  const url = safeUrl(record.url);
  const name = url.pathname.split("/").filter(Boolean).at(-1) || url.hostname || record.url;
  const status = record.status == null ? (record.state === "pending" ? "…" : "—") : String(record.status);

  return html`
    <RodNetworkRow data-state=${record.state} data-selected=${String(record.id === selectedId)} @click=${event(() => onOpen(record.id))}>
      <td><RodNetworkName title=${record.url}>${truncate(name, 80)}</RodNetworkName></td>
      <td><RodNetworkStatus data-status=${status}>${status}</RodNetworkStatus></td>
      <td><RodNetworkMethod data-method=${record.method}>${record.method}</RodNetworkMethod></td>
      <td>${record.type || record.kind}</td>
      <td>${formatBytes(record.size)}</td>
      <td>${formatDuration(record.duration)}</td>
    </RodNetworkRow>
  `;
}

export function networkDetailTemplate(record: NetworkRecord, options: {
  activeTab: string;
  captureResponseBody: boolean;
  onAction(event: Event): void;
  onTab(event: Event): void;
}): RenderPiece {
  const responseType = inferSourceType(record.responseBody ?? "", record.url);
  const responseCode = options.captureResponseBody
    ? (record.responseBody ?? "Response body is not available.")
    : "Response body capture is disabled.";

  const preview = responseType === "json" || responseType === "javascript" || responseType === "css" || responseType === "html"
    ? withLineNumbers(highlightCode(prettyBody(responseCode, responseType), responseType))
    : escapeHtml(responseCode);

  const timing = record.timing ?? {
    total: record.duration ?? 0,
    start: record.startTime,
    end: record.endTime ?? record.startTime,
  };

  return html`
    <RodNetworkControl>
      <RodNetworkIconButton type="button" data-action="close-detail" title="Back" @click=${event(options.onAction)}>${icon("back")}</RodNetworkIconButton>
      <RodNetworkDetailTitle title=${record.url}>${record.url}</RodNetworkDetailTitle>
      <RodNetworkIconButton type="button" data-action="copy-curl" title="Copy as cURL" @click=${event(options.onAction)}>${icon("copy")}</RodNetworkIconButton>
    </RodNetworkControl>

    <RodNetworkDetailBody>
      <RodNetworkTabs>
        ${detailTabTemplate("headers", "Headers", options.activeTab, options.onTab)}
        ${detailTabTemplate("preview", "Preview", options.activeTab, options.onTab)}
        ${detailTabTemplate("response", "Response", options.activeTab, options.onTab)}
        ${detailTabTemplate("timing", "Timing", options.activeTab, options.onTab)}
        ${record.kind === "websocket" ? detailTabTemplate("messages", "Messages", options.activeTab, options.onTab) : ""}
      </RodNetworkTabs>

      <RodNetworkPane data-detail-pane="headers" data-active=${String(options.activeTab === "headers")}>
        ${sectionTableTemplate("General", [
          ["Request URL", record.url],
          ["Request Method", record.method],
          ["Status Code", `${record.status ?? "—"} ${record.statusText ?? ""}`.trim()],
          ["Resource Type", record.type || record.kind],
          ["MIME Type", record.mimeType || "—"],
          ["From Cache", record.fromCache ? "Yes" : "No"],
        ])}
        ${headerTableTemplate("Request Headers", record.requestHeaders)}
        ${record.requestBody ? sectionPreTemplate("Request Payload", record.requestBody) : ""}
        ${headerTableTemplate("Response Headers", record.responseHeaders)}
        ${record.error ? sectionPreTemplate("Error", record.error) : ""}
      </RodNetworkPane>

      <RodNetworkPane data-detail-pane="preview" data-active=${String(options.activeTab === "preview")}>
        <RodNetworkCode>${preview}</RodNetworkCode>
      </RodNetworkPane>

      <RodNetworkPane data-detail-pane="response" data-active=${String(options.activeTab === "response")}>
        <RodNetworkPre>${responseCode}</RodNetworkPre>
      </RodNetworkPane>

      <RodNetworkPane data-detail-pane="timing" data-active=${String(options.activeTab === "timing")}>
        ${sectionTableTemplate("Timing", Object.entries(timing).map(([key, value]) => [key, formatDuration(value)]))}
      </RodNetworkPane>

      ${record.kind === "websocket" ? html`
        <RodNetworkPane data-detail-pane="messages" data-active=${String(options.activeTab === "messages")}>
          ${messagesTableTemplate(record)}
        </RodNetworkPane>
      ` : ""}
    </RodNetworkDetailBody>
  `;
}

function detailTabTemplate(tab: string, label: string, activeTab: string, onTab: (event: Event) => void): RenderPiece {
  return html`
    <RodNetworkTabButton type="button" data-detail-tab=${tab} data-active=${String(tab === activeTab)} @click=${event(onTab)}>${label}</RodNetworkTabButton>
  `;
}

function sectionTableTemplate(title: string, rows: Array<readonly [string, unknown]>): RenderPiece {
  return html`
    <RodNetworkSection>
      <RodNetworkSectionTitle>${title}</RodNetworkSectionTitle>
      <RodNetworkTableWrap>
        <RodNetworkKvTable>
          <tbody>
            ${rows.map(([key, value]) => html`
              <tr>
                <td>${key}</td>
                <td>${String(value)}</td>
              </tr>
            `)}
          </tbody>
        </RodNetworkKvTable>
      </RodNetworkTableWrap>
    </RodNetworkSection>
  `;
}

function headerTableTemplate(title: string, headers: NetworkHeader[]): RenderPiece {
  return sectionTableTemplate(
    title,
    headers.length ? headers.map((header) => [header.name, header.value] as const) : [["—", "No headers"]],
  );
}

function sectionPreTemplate(title: string, value: string): RenderPiece {
  return html`
    <RodNetworkSection>
      <RodNetworkSectionTitle>${title}</RodNetworkSectionTitle>
      <RodNetworkPre>${value}</RodNetworkPre>
    </RodNetworkSection>
  `;
}

function messagesTableTemplate(record: NetworkRecord): RenderPiece {
  const messages = record.messages ?? [];

  return html`
    <RodNetworkTableWrap>
      <RodNetworkTable>
        <thead>
          <tr>
            <th>Direction</th>
            <th>Time</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          ${messages.map((message) => html`
            <tr>
              <td>${message.direction === "sent" ? "↑ Sent" : "↓ Received"}</td>
              <td>${new Date(message.timestamp).toLocaleTimeString()}</td>
              <td><RodNetworkPre>${message.data}</RodNetworkPre></td>
            </tr>
          `)}
        </tbody>
      </RodNetworkTable>
    </RodNetworkTableWrap>
  `;
}

function prettyBody(body: string, type: string): string {
  if (type === "json") {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }

  return body;
}

function safeUrl(value: string): URL {
  try {
    return new URL(value, location.href);
  } catch {
    return new URL(location.href);
  }
}
