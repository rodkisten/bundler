import type { RenderValue } from "../../fabrica";
import { escapeHtml, formatBytes, formatDuration, icon, truncate } from "../utils";
import { highlightCode, inferSourceType, withLineNumbers } from "../core/serialize";
import { event, html } from "../core/runtime";
import type { NetworkHeader, NetworkRecord } from "../types";

export function networkListTemplate(records: NetworkRecord[], selectedId: string | null, onOpen: (id: string) => void): RenderValue {
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

export function networkRowTemplate(record: NetworkRecord, selectedId: string | null, onOpen: (id: string) => void): RenderValue {
  const url = safeUrl(record.url);
  const name = url.pathname.split("/").filter(Boolean).at(-1) || url.hostname || record.url;
  const status = record.status == null ? (record.state === "pending" ? "…" : "—") : String(record.status);
  const URL_MAX_LENGTH = 120; // 80
  
  return html`
    <RodNetworkRow :state=${record.state} :selected=${record.id === selectedId} @click=${event.click(() => onOpen(record.id))}>
      <td><RodNetworkName title=${record.url}>${truncate(name, URL_MAX_LENGTH)}</RodNetworkName></td>
      <td><RodNetworkStatus :status=${status}>${status}</RodNetworkStatus></td>
      <td><RodNetworkMethod :method=${record.method}>${record.method}</RodNetworkMethod></td>
      <td>${record.type || record.kind}</td>
      <td>${formatBytes(record.size)}</td>
      <td>${formatDuration(record.duration)}</td>
    </RodNetworkRow>
  `;
}

export function networkDetailTemplate(record: NetworkRecord, options: {
  activeTab: string;
  captureResponseBody: boolean;
  bodyPreviewLimit: number;
  onAction(event: Event): void;
  onTab(event: Event): void;
}): RenderValue {
  const responseType = inferSourceType(record.responseBody ?? "", record.url);
  const rawResponseCode = options.captureResponseBody
    ? (record.responseBody ?? "Response body is not available.")
    : "Response body capture is disabled.";
  const responseCode = rawResponseCode.length > options.bodyPreviewLimit
    ? `${rawResponseCode.slice(0, options.bodyPreviewLimit)}
… truncated ${rawResponseCode.length - options.bodyPreviewLimit} characters`
    : rawResponseCode;

  const preview = responseType === "json" || responseType === "javascript" || responseType === "css" || responseType === "html"
    ? withLineNumbers(highlightCode(prettyBody(responseCode, responseType), responseType))
    : escapeHtml(responseCode);

  const timing = record.timing ?? {
    total: record.duration ?? 0,
    start: record.startTime,
    end: record.endTime ?? record.startTime,
  };

  return html`
    <RodSharedControlBar>
      <RodNetworkIconButton type="button" :action="close-detail" title="Back" @click=${event.click(options.onAction)}>${icon("back")}</RodNetworkIconButton>
      <RodSharedDetailTitle title=${record.url}>${record.url}</RodSharedDetailTitle>
      <RodNetworkIconButton type="button" :action="copy-curl" title="Copy as cURL" @click=${event.click(options.onAction)}>${icon("copy")}</RodNetworkIconButton>
    </RodSharedControlBar>

    <RodSharedScrollableBody>
      <RodNetworkTabs>
        ${detailTabTemplate("headers", "Headers", options.activeTab, options.onTab)}
        ${detailTabTemplate("preview", "Preview", options.activeTab, options.onTab)}
        ${detailTabTemplate("response", "Response", options.activeTab, options.onTab)}
        ${detailTabTemplate("timing", "Timing", options.activeTab, options.onTab)}
        ${record.kind === "websocket" ? detailTabTemplate("messages", "Messages", options.activeTab, options.onTab) : ""}
      </RodNetworkTabs>

      <RodNetworkPane :detailPane="headers" :active=${options.activeTab === "headers"}>
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

      <RodNetworkPane :detailPane="preview" :active=${options.activeTab === "preview"}>
        <RodNetworkCode>${preview}</RodNetworkCode>
      </RodNetworkPane>

      <RodNetworkPane :detailPane="response" :active=${options.activeTab === "response"}>
        <RodSharedPreBlock>${responseCode}</RodSharedPreBlock>
      </RodNetworkPane>

      <RodNetworkPane :detailPane="timing" :active=${options.activeTab === "timing"}>
        ${sectionTableTemplate("Timing", Object.entries(timing).map(([key, value]) => [key, formatDuration(value)]))}
      </RodNetworkPane>

      ${record.kind === "websocket" ? html`
        <RodNetworkPane :detailPane="messages" :active=${options.activeTab === "messages"}>
          ${messagesTableTemplate(record)}
        </RodNetworkPane>
      ` : ""}
    </RodSharedScrollableBody>
  `;
}

export function detailTabTemplate(tab: string, label: string, activeTab: string, onTab: (event: Event) => void): RenderValue {
  return html`
    <RodNetworkTabButton type="button" :detailTab=${tab} :active=${tab === activeTab} @click=${event.click(onTab)}>${label}</RodNetworkTabButton>
  `;
}

export function sectionTableTemplate(title: string, rows: Array<readonly [string, unknown]>): RenderValue {
  return html`
    <RodNetworkSection>
      <RodNetworkSectionTitle>${title}</RodNetworkSectionTitle>
      <RodSharedTableWrap>
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
      </RodSharedTableWrap>
    </RodNetworkSection>
  `;
}

export function headerTableTemplate(title: string, headers: NetworkHeader[]): RenderValue {
  return sectionTableTemplate(
    title,
    headers.length ? headers.map((header) => [header.name, header.value] as const) : [["—", "No headers"]],
  );
}

export function sectionPreTemplate(title: string, value: string): RenderValue {
  return html`
    <RodNetworkSection>
      <RodNetworkSectionTitle>${title}</RodNetworkSectionTitle>
      <RodSharedPreBlock>${value}</RodSharedPreBlock>
    </RodNetworkSection>
  `;
}

export function messagesTableTemplate(record: NetworkRecord): RenderValue {
  const messages = record.messages ?? [];

  return html`
    <RodSharedTableWrap>
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
              <td><RodSharedPreBlock>${message.data}</RodSharedPreBlock></td>
            </tr>
          `)}
        </tbody>
      </RodNetworkTable>
    </RodSharedTableWrap>
  `;
}

export function prettyBody(body: string, type: string): string {
  if (type === "json") {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }

  return body;
}

export function safeUrl(value: string): URL {
  try {
    return new URL(value, location.href);
  } catch {
    return new URL(location.href);
  }
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function toCurl(record: NetworkRecord): string {
  const parts = ["curl", "-X", record.method, shellQuote(record.url)];

  for (const header of record.requestHeaders) {
    parts.push("-H", shellQuote(`${header.name}: ${header.value}`));
  }

  if (record.requestBody) {
    parts.push("--data-raw", shellQuote(record.requestBody));
  }

  return parts.join(" ");
}
