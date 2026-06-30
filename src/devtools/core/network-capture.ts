import { Emitter } from "./emitter";
import type { NetworkHeader, NetworkRecord } from "../types";

interface NetworkEvents {
  request: [record: NetworkRecord];
  update: [record: NetworkRecord];
  clear: [];
}

type XMLHttpRequestMeta = {
  record: NetworkRecord;
  headers: NetworkHeader[];
};

export class NetworkCapture extends Emitter<NetworkEvents> {
  private readonly records = new Map<string, NetworkRecord>();
  private sequence = 0;
  private installed = false;
  private recording = true;
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private originalXhrSetHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;
  private originalWebSocket: typeof WebSocket | null = null;
  private readonly xhrMeta = new WeakMap<XMLHttpRequest, XMLHttpRequestMeta>();
  private performanceObserver: PerformanceObserver | null = null;

  install(): void {
    if (this.installed) return;
    this.installed = true;
    this.patchFetch();
    this.patchXhr();
    this.patchWebSocket();
    this.observeResources();
  }

  destroy(): void {
    if (!this.installed) return;
    this.installed = false;
    if (this.originalFetch) globalThis.fetch = this.originalFetch;
    if (this.originalXhrOpen) XMLHttpRequest.prototype.open = this.originalXhrOpen;
    if (this.originalXhrSend) XMLHttpRequest.prototype.send = this.originalXhrSend;
    if (this.originalXhrSetHeader) XMLHttpRequest.prototype.setRequestHeader = this.originalXhrSetHeader;
    if (this.originalWebSocket) globalThis.WebSocket = this.originalWebSocket;
    this.performanceObserver?.disconnect();
    this.performanceObserver = null;
    this.removeAllListeners();
  }

  setRecording(recording: boolean): void {
    this.recording = recording;
  }

  isRecording(): boolean {
    return this.recording;
  }

  clear(): void {
    this.records.clear();
    this.emit("clear");
  }

  requests(): NetworkRecord[] {
    return [...this.records.values()];
  }

  get(id: string): NetworkRecord | undefined {
    return this.records.get(id);
  }

  private add(record: NetworkRecord): void {
    if (!this.recording) return;
    this.records.set(record.id, record);
    this.emit("request", record);
  }

  private update(record: NetworkRecord): void {
    if (!this.records.has(record.id)) return;
    this.emit("update", record);
  }

  private createRecord(kind: NetworkRecord["kind"], method: string, url: string): NetworkRecord {
    return {
      id: `${kind}-${Date.now().toString(36)}-${(++this.sequence).toString(36)}`,
      kind,
      method: method.toUpperCase(),
      url,
      requestHeaders: [],
      responseHeaders: [],
      startTime: performance.now(),
      state: "pending",
    };
  }

  private patchFetch(): void {
    if (typeof fetch !== "function") return;
    this.originalFetch = fetch.bind(globalThis);
    const capture = this;
    globalThis.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const request = input instanceof Request ? input : new Request(input, init);
      const record = capture.createRecord("fetch", init?.method || request.method || "GET", request.url);
      record.requestHeaders = headersToArray(new Headers(init?.headers || request.headers));
      record.requestBody = await readRequestBody(input, init);
      capture.add(record);

      try {
        const response = await capture.originalFetch!(input, init);
        record.status = response.status;
        record.statusText = response.statusText;
        record.redirected = response.redirected;
        record.type = response.type;
        record.mimeType = response.headers.get("content-type") || undefined;
        record.responseHeaders = headersToArray(response.headers);
        record.endTime = performance.now();
        record.duration = record.endTime - record.startTime;
        record.size = numberHeader(response.headers, "content-length");
        record.state = response.ok || response.status < 400 ? "complete" : "failed";
        void readResponseBody(response).then((body) => {
          record.responseBody = body;
          if (record.size == null && body != null) record.size = new Blob([body]).size;
          capture.update(record);
        });
        capture.update(record);
        return response;
      } catch (error) {
        record.endTime = performance.now();
        record.duration = record.endTime - record.startTime;
        record.state = "failed";
        record.error = error instanceof Error ? error.message : String(error);
        capture.update(record);
        throw error;
      }
    };
  }

  private patchXhr(): void {
    if (typeof XMLHttpRequest === "undefined") return;
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    this.originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const capture = this;

    XMLHttpRequest.prototype.open = function patchedOpen(
      method: string,
      url: string | URL,
      async = true,
      username?: string | null,
      password?: string | null,
    ): void {
      const record = capture.createRecord("xhr", method, new URL(String(url), location.href).href);
      capture.xhrMeta.set(this, { record, headers: [] });
      (capture.originalXhrOpen as (...args: any[]) => void).call(this, method, url, async, username, password);
    };

    XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name: string, value: string): void {
      capture.xhrMeta.get(this)?.headers.push({ name, value });
      capture.originalXhrSetHeader!.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = capture.xhrMeta.get(this);
      if (meta) {
        const { record } = meta;
        record.requestHeaders = [...meta.headers];
        record.requestBody = bodyToText(body);
        capture.add(record);

        const finish = (state: "complete" | "failed", error?: string): void => {
          record.status = this.status;
          record.statusText = this.statusText;
          record.responseHeaders = parseRawHeaders(this.getAllResponseHeaders());
          record.mimeType = this.getResponseHeader("content-type") || undefined;
          record.endTime = performance.now();
          record.duration = record.endTime - record.startTime;
          record.state = state;
          record.error = error;
          record.responseBody = xhrResponseText(this);
          record.size = numberHeader(new Headers(record.responseHeaders.map((item): [string, string] => [item.name, item.value])), "content-length")
            ?? (record.responseBody ? new Blob([record.responseBody]).size : undefined);
          capture.update(record);
        };

        this.addEventListener("load", () => finish(this.status >= 400 ? "failed" : "complete"), { once: true });
        this.addEventListener("error", () => finish("failed", "Network error"), { once: true });
        this.addEventListener("abort", () => finish("failed", "Request aborted"), { once: true });
        this.addEventListener("timeout", () => finish("failed", "Request timed out"), { once: true });
      }
      capture.originalXhrSend!.call(this, body);
    };
  }

  private patchWebSocket(): void {
    if (typeof WebSocket === "undefined") return;
    this.originalWebSocket = WebSocket;
    const NativeWebSocket = WebSocket;
    const capture = this;

    class CapturedWebSocket extends NativeWebSocket {
      private readonly __record: NetworkRecord;

      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.__record = capture.createRecord("websocket", "GET", String(url));
        this.__record.messages = [];
        capture.add(this.__record);
        this.addEventListener("open", () => {
          this.__record.status = 101;
          this.__record.statusText = "Switching Protocols";
          this.__record.state = "complete";
          capture.update(this.__record);
        });
        this.addEventListener("message", (event) => {
          this.__record.messages!.push({ direction: "received", data: bodyToText(event.data) || "", timestamp: Date.now() });
          capture.update(this.__record);
        });
        this.addEventListener("close", (event) => {
          this.__record.endTime = performance.now();
          this.__record.duration = this.__record.endTime - this.__record.startTime;
          this.__record.statusText = event.reason || `Closed (${event.code})`;
          capture.update(this.__record);
        });
        this.addEventListener("error", () => {
          this.__record.state = "failed";
          this.__record.error = "WebSocket error";
          capture.update(this.__record);
        });
      }

      override send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        this.__record.messages!.push({ direction: "sent", data: bodyToText(data) || "", timestamp: Date.now() });
        capture.update(this.__record);
        (NativeWebSocket.prototype.send as (this: WebSocket, data: string | ArrayBuffer | Blob | ArrayBufferView<ArrayBuffer>) => void).call(this, data as string | ArrayBuffer | Blob | ArrayBufferView<ArrayBuffer>);
      }
    }

    Object.defineProperties(CapturedWebSocket, {
      CONNECTING: { value: NativeWebSocket.CONNECTING },
      OPEN: { value: NativeWebSocket.OPEN },
      CLOSING: { value: NativeWebSocket.CLOSING },
      CLOSED: { value: NativeWebSocket.CLOSED },
    });
    globalThis.WebSocket = CapturedWebSocket as typeof WebSocket;
  }

  private observeResources(): void {
    if (typeof PerformanceObserver === "undefined") return;
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry instanceof PerformanceResourceTiming)) continue;
          const duplicate = [...this.records.values()].some((record) => record.url === entry.name && Math.abs(record.startTime - entry.startTime) < 5);
          if (duplicate || !this.recording) continue;
          const record = this.createRecord("resource", "GET", entry.name);
          record.startTime = entry.startTime;
          record.endTime = entry.responseEnd;
          record.duration = entry.duration;
          record.size = entry.transferSize || entry.encodedBodySize || undefined;
          record.type = entry.initiatorType;
          record.fromCache = entry.transferSize === 0 && entry.decodedBodySize > 0;
          record.state = "complete";
          record.timing = {
            queueing: Math.max(0, entry.domainLookupStart - entry.startTime),
            dns: Math.max(0, entry.domainLookupEnd - entry.domainLookupStart),
            connect: Math.max(0, entry.connectEnd - entry.connectStart),
            request: Math.max(0, entry.responseStart - entry.requestStart),
            response: Math.max(0, entry.responseEnd - entry.responseStart),
          };
          this.add(record);
          this.update(record);
        }
      });
      this.performanceObserver.observe({ type: "resource", buffered: true });
    } catch {
      this.performanceObserver = null;
    }
  }
}

function headersToArray(headers: Headers): NetworkHeader[] {
  return [...headers.entries()].map(([name, value]) => ({ name, value }));
}

function parseRawHeaders(raw: string): NetworkHeader[] {
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf(":");
    return index < 0 ? { name: line, value: "" } : { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
  });
}

function numberHeader(headers: Headers, name: string): number | undefined {
  const value = Number(headers.get(name));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<string | undefined> {
  if (init?.body != null) return bodyToText(init.body);
  if (input instanceof Request && input.method !== "GET" && input.method !== "HEAD") {
    try {
      return await input.clone().text();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function readResponseBody(response: Response): Promise<string | undefined> {
  const contentType = response.headers.get("content-type") || "";
  if (/^(image|audio|video|font)\//i.test(contentType) || /octet-stream/i.test(contentType)) {
    try {
      const buffer = await response.clone().arrayBuffer();
      return `[Binary ${buffer.byteLength} bytes]`;
    } catch {
      return undefined;
    }
  }
  try {
    return await response.clone().text();
  } catch {
    return undefined;
  }
}

function xhrResponseText(xhr: XMLHttpRequest): string | undefined {
  try {
    if (xhr.responseType === "" || xhr.responseType === "text") return xhr.responseText;
    if (xhr.responseType === "json") return JSON.stringify(xhr.response);
    if (xhr.response instanceof ArrayBuffer) return `[Binary ${xhr.response.byteLength} bytes]`;
    if (xhr.response instanceof Blob) return `[Blob ${xhr.response.size} bytes]`;
    return bodyToText(xhr.response);
  } catch {
    return undefined;
  }
}

function bodyToText(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    return [...body.entries()].map(([key, value]) => `${key}=${value instanceof File ? `[File ${value.name}]` : value}`).join("&");
  }
  if (body instanceof Blob) return `[Blob ${body.size} bytes, ${body.type || "unknown"}]`;
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[${body.constructor.name} ${body.byteLength} bytes]`;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}
