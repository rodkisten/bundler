import { Emitter } from "@rodkisten/devtools/core-emitter";
import type { NetworkHeader, NetworkRecord } from "@rodkisten/devtools/types";
import { filterMapArray, mapArray, mapIterable, mapJoinIterable, someIterable, splitLines, toArray } from "@rodkisten/nascente";

interface NetworkEvents {
  request: [record: NetworkRecord];
  update: [record: NetworkRecord];
  clear: [];
}

type XMLHttpRequestMeta = {
  record: NetworkRecord;
  headers: NetworkHeader[];
};

type BridgeEnvelope = {
  phase: "request" | "update";
  record: NetworkRecord;
};

const BRIDGE_EVENT = "__roderuda_network_bridge_v3__";
const BRIDGE_CLEANUP_EVENT = "__roderuda_network_bridge_cleanup_v3__";
const LOCAL_FETCH_MARKER = "__roderudaNetworkCaptureWrapperV3";
const PAGE_FETCH_MARKER = "__roderudaNetworkPageBridgeV3";
const LOCAL_XHR_MARKER = "__roderudaNetworkXhrV3";
const PAGE_XHR_MARKER = "__roderudaNetworkPageXhrV3";

export class NetworkCapture extends Emitter<NetworkEvents> {
  private readonly records = new Map<string, NetworkRecord>();
  private sequence = 0;
  private installed = false;
  /** Balanced retain count because Network, Resources, Sources and CDP share one capture. */
  private installations = 0;
  private recording = true;
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private originalXhrSetHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;
  private originalWebSocket: typeof WebSocket | null = null;
  private readonly xhrMeta = new WeakMap<XMLHttpRequest, XMLHttpRequestMeta>();
  private performanceObserver: PerformanceObserver | null = null;
  private bridgeCleanup: (() => void) | null = null;

  install(): void {
    this.installations += 1;
    if (this.installed) return;
    this.installed = true;
    this.installPageRealmBridge();
    this.patchFetch();
    this.patchXhr();
    this.patchWebSocket();
    this.observeResources();
  }

  destroy(): void {
    if (this.installations > 0) this.installations -= 1;
    if (this.installations > 0 || !this.installed) return;
    this.installed = false;

    if (this.originalFetch) globalThis.fetch = this.originalFetch;
    if (this.originalXhrOpen && typeof XMLHttpRequest !== "undefined") XMLHttpRequest.prototype.open = this.originalXhrOpen;
    if (this.originalXhrSend && typeof XMLHttpRequest !== "undefined") XMLHttpRequest.prototype.send = this.originalXhrSend;
    if (this.originalXhrSetHeader && typeof XMLHttpRequest !== "undefined") XMLHttpRequest.prototype.setRequestHeader = this.originalXhrSetHeader;
    if (typeof XMLHttpRequest !== "undefined") {
      try { delete (XMLHttpRequest.prototype as typeof XMLHttpRequest.prototype & Record<string, unknown>)[LOCAL_XHR_MARKER]; } catch {}
    }
    if (this.originalWebSocket) globalThis.WebSocket = this.originalWebSocket;

    this.originalFetch = null;
    this.originalXhrOpen = null;
    this.originalXhrSend = null;
    this.originalXhrSetHeader = null;
    this.originalWebSocket = null;

    this.performanceObserver?.disconnect();
    this.performanceObserver = null;
    this.bridgeCleanup?.();
    this.bridgeCleanup = null;
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
    return toArray(this.records.values());
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

  private acceptBridgeEnvelope(envelope: BridgeEnvelope): void {
    if (!this.recording || !isNetworkRecord(envelope.record)) return;

    const existing = this.records.get(envelope.record.id);
    if (!existing) {
      const record = normalizeBridgeRecord(envelope.record);
      this.records.set(record.id, record);
      this.emit("request", record);
      if (envelope.phase === "update") this.emit("update", record);
      return;
    }

    Object.assign(existing, normalizeBridgeRecord(envelope.record));
    this.emit("update", existing);
  }

  private createRecord(kind: NetworkRecord["kind"], method: string, url: string): NetworkRecord {
    return {
      id: `${kind}-${Date.now().toString(36)}-${(++this.sequence).toString(36)}`,
      kind,
      method: method.toUpperCase(),
      url,
      requestHeaders: [],
      responseHeaders: [],
      startTime: typeof performance !== "undefined" ? performance.now() : Date.now(),
      state: "pending",
    };
  }

  private installPageRealmBridge(): void {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const onBridge = (event: Event): void => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== "string") return;
      try {
        this.acceptBridgeEnvelope(JSON.parse(detail) as BridgeEnvelope);
      } catch {}
    };

    document.addEventListener(BRIDGE_EVENT, onBridge as EventListener);
    this.bridgeCleanup = () => {
      document.removeEventListener(BRIDGE_EVENT, onBridge as EventListener);
      try { document.dispatchEvent(new CustomEvent(BRIDGE_CLEANUP_EVENT)); } catch {}
    };

    const globalScope = globalThis as typeof globalThis & {
      unsafeWindow?: Window & typeof globalThis & Record<string, unknown>;
    };
    const unsafe = globalScope.unsafeWindow;

    /*
     * Prefer a direct page-window patch. Userscript managers commonly expose
     * unsafeWindow even when inline scripts are blocked by CSP. The bridge
     * itself only touches constructors from the supplied realm, so Request,
     * Response, Blob and XHR checks remain correct across isolated worlds.
     */
    if (unsafe) {
      try {
        pageRealmNetworkBridge(
          unsafe,
          BRIDGE_EVENT,
          BRIDGE_CLEANUP_EVENT,
          PAGE_FETCH_MARKER,
          LOCAL_FETCH_MARKER,
          PAGE_XHR_MARKER,
        );
        return;
      } catch {}
    }

    /* Capture calls made in the current realm too. In an ordinary page build
     * this is already the page realm; in an extension world it complements the
     * injected bridge below. */
    try {
      pageRealmNetworkBridge(
        window as Window & typeof globalThis & Record<string, unknown>,
        BRIDGE_EVENT,
        BRIDGE_CLEANUP_EVENT,
        PAGE_FETCH_MARKER,
        LOCAL_FETCH_MARKER,
        PAGE_XHR_MARKER,
      );
    } catch {}

    const parent = document.documentElement || document.head || document.body;
    if (!parent) return;

    const source = `;(${pageRealmNetworkBridge.toString()})(window,${JSON.stringify(BRIDGE_EVENT)},${JSON.stringify(BRIDGE_CLEANUP_EVENT)},${JSON.stringify(PAGE_FETCH_MARKER)},${JSON.stringify(LOCAL_FETCH_MARKER)},${JSON.stringify(PAGE_XHR_MARKER)});`;
    const script = document.createElement("script");
    const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
    if (nonce) script.nonce = nonce;
    script.textContent = source;

    try {
      parent.appendChild(script);
      script.remove();
    } catch {
      script.remove();
    }

    /* Some WebKit pages reject inline script but allow a same-document blob. */
    try {
      const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const blobScript = document.createElement("script");
      blobScript.src = blobUrl;
      blobScript.onload = blobScript.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        blobScript.remove();
      };
      parent.appendChild(blobScript);
    } catch {}
  }

  private patchFetch(): void {
    if (typeof fetch !== "function") return;
    const current = globalThis.fetch as typeof fetch & Record<string, unknown>;
    if (current[LOCAL_FETCH_MARKER] || current[PAGE_FETCH_MARKER]) return;

    this.originalFetch = current;
    const original = current;
    const capture = this;

    const patched = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET"));
      const url = resolveRequestUrl(input);
      const record = capture.createRecord("fetch", method, url);

      try {
        const requestHeaders = init?.headers || (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
        record.requestHeaders = headersToArray(new Headers(requestHeaders));
      } catch {}

      capture.add(record);
      void readRequestBody(input, init).then((body) => {
        if (body !== undefined) record.requestBody = body;
        capture.update(record);
      });

      return Reflect.apply(original, globalThis, [input, init]).then((response) => {
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
        capture.update(record);

        void readResponseBody(response).then((body) => {
          record.responseBody = body;
          if (record.size == null && body != null) record.size = byteLength(body);
          capture.update(record);
        });

        return response;
      }, (error: unknown) => {
        record.endTime = performance.now();
        record.duration = record.endTime - record.startTime;
        record.state = "failed";
        record.error = error instanceof Error ? error.message : String(error);
        capture.update(record);
        throw error;
      });
    } as typeof fetch & Record<string, unknown>;

    Object.defineProperty(patched, LOCAL_FETCH_MARKER, { value: true });
    globalThis.fetch = patched;
  }

  private patchXhr(): void {
    if (typeof XMLHttpRequest === "undefined") return;
    const prototype = XMLHttpRequest.prototype as typeof XMLHttpRequest.prototype & Record<string, unknown>;
    if (prototype[LOCAL_XHR_MARKER] || prototype[PAGE_XHR_MARKER]) return;

    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    this.originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const capture = this;

    XMLHttpRequest.prototype.open = function patchedOpen(method: string, url: string | URL, async = true, username?: string | null, password?: string | null): void {
      const record = capture.createRecord("xhr", method, resolveUrl(String(url)));
      capture.xhrMeta.set(this, { record, headers: [] });
      (capture.originalXhrOpen as (...args: unknown[]) => void).call(this, method, url, async, username, password);
    };

    XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name: string, value: string): void {
      capture.xhrMeta.get(this)?.headers.push({ name, value });
      capture.originalXhrSetHeader!.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = capture.xhrMeta.get(this);
      if (meta) {
        const { record } = meta;
        record.requestHeaders = toArray(meta.headers);
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
          record.size = numberHeader(new Headers(mapArray(record.responseHeaders, (item): [string, string] => [item.name, item.value])), "content-length")
            ?? (record.responseBody ? byteLength(record.responseBody) : undefined);
          capture.update(record);
        };

        this.addEventListener("load", () => finish(this.status >= 400 ? "failed" : "complete"), { once: true });
        this.addEventListener("error", () => finish("failed", "Network error"), { once: true });
        this.addEventListener("abort", () => finish("failed", "Request aborted"), { once: true });
        this.addEventListener("timeout", () => finish("failed", "Request timed out"), { once: true });
      }
      capture.originalXhrSend!.call(this, body);
    };

    Object.defineProperty(XMLHttpRequest.prototype, LOCAL_XHR_MARKER, { value: true, configurable: true });
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
          const duplicate = someIterable(this.records.values(), (record) => record.url === entry.name && Math.abs(record.startTime - entry.startTime) < 8);
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

function pageRealmNetworkBridge(
  scope: Window & typeof globalThis & Record<string, unknown>,
  eventName: string,
  cleanupEventName: string,
  pageMarker: string,
  localMarker: string,
  xhrMarker: string,
): void {
  if (scope.__roderudaNetworkBridgeInstalledV3) return;
  scope.__roderudaNetworkBridgeInstalledV3 = true;

  const pageDocument = scope.document;
  const PageCustomEvent = scope.CustomEvent;
  const PageHeaders = scope.Headers;
  const PageRequest = scope.Request;
  const PageURL = scope.URL;
  const PageURLSearchParams = scope.URLSearchParams;
  const PageFormData = scope.FormData;
  const PageFile = scope.File;
  const PageBlob = scope.Blob;
  const PageArrayBuffer = scope.ArrayBuffer;
  const PageTextEncoder = scope.TextEncoder;
  const PageXMLHttpRequest = scope.XMLHttpRequest;
  let sequence = 0;

  const now = (): number => scope.performance?.now?.() ?? Date.now();
  const emit = (phase: "request" | "update", record: Record<string, unknown>): void => {
    try {
      pageDocument.dispatchEvent(new PageCustomEvent(eventName, {
        detail: JSON.stringify({ phase, record }),
      }));
    } catch {}
  };
  const headers = (value: Headers | null | undefined): Array<{ name: string; value: string }> => {
    const output: Array<{ name: string; value: string }> = [];
    try { value?.forEach((headerValue, name) => output.push({ name, value: headerValue })); } catch {}
    return output;
  };
  const bodyText = async (body: unknown): Promise<string | undefined> => {
    if (body == null) return undefined;
    if (typeof body === "string") return body;
    if (PageURLSearchParams && body instanceof PageURLSearchParams) return body.toString();
    if (PageFormData && body instanceof PageFormData) {
      const values: string[] = [];
      body.forEach((value, key) => values.push(`${key}=${PageFile && value instanceof PageFile ? `[File ${value.name}]` : String(value)}`));
      return values.join("&");
    }
    if (PageBlob && body instanceof PageBlob) {
      try { return await body.text(); } catch { return `[Blob ${body.size} bytes, ${body.type || "unknown"}]`; }
    }
    if (PageArrayBuffer && body instanceof PageArrayBuffer) return `[ArrayBuffer ${body.byteLength} bytes]`;
    if (PageArrayBuffer?.isView?.(body)) {
      const view = body as ArrayBufferView;
      return `[${view.constructor.name} ${view.byteLength} bytes]`;
    }
    try { return JSON.stringify(body); } catch { return String(body); }
  };
  const responseBody = async (response: Response): Promise<string | undefined> => {
    const contentType = response.headers.get("content-type") || "";
    try {
      if (/^(image|audio|video|font)\//i.test(contentType) || /octet-stream/i.test(contentType)) {
        const buffer = await response.clone().arrayBuffer();
        return `[Binary ${buffer.byteLength} bytes]`;
      }
      return await response.clone().text();
    } catch { return undefined; }
  };

  const nativeFetch = scope.fetch;
  let patchedFetch: typeof fetch | null = null;
  if (
    typeof nativeFetch === "function"
    && !(nativeFetch as typeof fetch & Record<string, unknown>)[pageMarker]
    && !(nativeFetch as typeof fetch & Record<string, unknown>)[localMarker]
  ) {
    patchedFetch = function roderudaPageFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const request = PageRequest && input instanceof PageRequest ? input : null;
      const method = String(init?.method || request?.method || "GET").toUpperCase();
      let url = request?.url || String(input);
      try { url = new PageURL(url, scope.location.href).href; } catch {}

      let requestHeaders: Array<{ name: string; value: string }> = [];
      try {
        requestHeaders = headers(new PageHeaders(init?.headers || request?.headers));
      } catch {}

      const record: Record<string, unknown> = {
        id: `fetch-page-${Date.now().toString(36)}-${(++sequence).toString(36)}`,
        kind: "fetch",
        method,
        url,
        requestHeaders,
        responseHeaders: [],
        startTime: now(),
        state: "pending",
      };
      emit("request", record);

      if (init?.body != null) {
        void bodyText(init.body).then((body) => {
          record.requestBody = body;
          emit("update", record);
        });
      } else if (request && method !== "GET" && method !== "HEAD") {
        void request.clone().text().then((body) => {
          record.requestBody = body;
          emit("update", record);
        }).catch(() => {});
      }

      return Reflect.apply(nativeFetch, scope, [input, init]).then((response: Response) => {
        record.status = response.status;
        record.statusText = response.statusText;
        record.redirected = response.redirected;
        record.type = response.type;
        record.mimeType = response.headers.get("content-type") || undefined;
        record.responseHeaders = headers(response.headers);
        record.endTime = now();
        record.duration = Number(record.endTime) - Number(record.startTime);
        record.state = response.ok || response.status < 400 ? "complete" : "failed";
        const contentLength = response.headers.get("content-length");
        const length = contentLength == null || contentLength.trim() === ""
          ? Number.NaN
          : Number(contentLength);
        if (Number.isFinite(length) && length >= 0) record.size = length;
        emit("update", record);

        void responseBody(response).then((body) => {
          record.responseBody = body;
          if (record.size == null && body != null) {
            try {
              record.size = PageTextEncoder ? new PageTextEncoder().encode(body).byteLength : body.length;
            } catch { record.size = body.length; }
          }
          emit("update", record);
        });
        return response;
      }, (error: unknown) => {
        record.endTime = now();
        record.duration = Number(record.endTime) - Number(record.startTime);
        record.state = "failed";
        record.error = error instanceof Error ? error.message : String(error);
        emit("update", record);
        throw error;
      });
    } as typeof fetch;

    Object.defineProperty(patchedFetch, pageMarker, { value: true });
    scope.fetch = patchedFetch;
  }

  const xhrPrototype = PageXMLHttpRequest?.prototype ?? null;
  const nativeOpen = xhrPrototype?.open;
  const nativeSend = xhrPrototype?.send;
  const nativeSetHeader = xhrPrototype?.setRequestHeader;
  const xhrMeta = new WeakMap<XMLHttpRequest, {
    record: Record<string, unknown>;
    headers: Array<{ name: string; value: string }>;
  }>();

  if (
    xhrPrototype
    && nativeOpen
    && nativeSend
    && nativeSetHeader
    && !(xhrPrototype as typeof XMLHttpRequest.prototype & Record<string, unknown>)[xhrMarker]
  ) {
    xhrPrototype.open = function(method: string, url: string | URL, async = true, username?: string | null, password?: string | null): void {
      let resolved = String(url);
      try { resolved = new PageURL(resolved, scope.location.href).href; } catch {}
      const record: Record<string, unknown> = {
        id: `xhr-page-${Date.now().toString(36)}-${(++sequence).toString(36)}`,
        kind: "xhr",
        method: String(method).toUpperCase(),
        url: resolved,
        requestHeaders: [],
        responseHeaders: [],
        startTime: now(),
        state: "pending",
      };
      xhrMeta.set(this, { record, headers: [] });
      Reflect.apply(nativeOpen, this, [method, url, async, username, password]);
    };

    xhrPrototype.setRequestHeader = function(name: string, value: string): void {
      xhrMeta.get(this)?.headers.push({ name, value });
      Reflect.apply(nativeSetHeader, this, [name, value]);
    };

    xhrPrototype.send = function(body?: Document | XMLHttpRequestBodyInit | null): void {
      const meta = xhrMeta.get(this);
      if (meta) {
        const record = meta.record;
        record.requestHeaders = meta.headers.slice();
        emit("request", record);
        void bodyText(body).then((text) => {
          record.requestBody = text;
          emit("update", record);
        });

        const finish = (state: "complete" | "failed", error?: string): void => {
          record.status = this.status;
          record.statusText = this.statusText;
          record.mimeType = this.getResponseHeader("content-type") || undefined;
          record.endTime = now();
          record.duration = Number(record.endTime) - Number(record.startTime);
          record.state = state;
          record.error = error;
          const raw = this.getAllResponseHeaders();
          record.responseHeaders = raw.split(/\r?\n/).filter(Boolean).map((line) => {
            const index = line.indexOf(":");
            return index < 0
              ? { name: line, value: "" }
              : { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
          });
          try {
            if (this.responseType === "" || this.responseType === "text") record.responseBody = this.responseText;
            else if (this.responseType === "json") record.responseBody = JSON.stringify(this.response);
            else if (PageArrayBuffer && this.response instanceof PageArrayBuffer) record.responseBody = `[Binary ${this.response.byteLength} bytes]`;
            else if (PageBlob && this.response instanceof PageBlob) record.responseBody = `[Blob ${this.response.size} bytes]`;
          } catch {}
          emit("update", record);
        };

        this.addEventListener("load", () => finish(this.status >= 400 ? "failed" : "complete"), { once: true });
        this.addEventListener("error", () => finish("failed", "Network error"), { once: true });
        this.addEventListener("abort", () => finish("failed", "Request aborted"), { once: true });
        this.addEventListener("timeout", () => finish("failed", "Request timed out"), { once: true });
      }
      Reflect.apply(nativeSend, this, [body]);
    };

    Object.defineProperty(xhrPrototype, xhrMarker, { value: true, configurable: true });
  }

  const cleanup = (): void => {
    if (patchedFetch && scope.fetch === patchedFetch) scope.fetch = nativeFetch;
    if (xhrPrototype && nativeOpen && nativeSend && nativeSetHeader) {
      xhrPrototype.open = nativeOpen;
      xhrPrototype.send = nativeSend;
      xhrPrototype.setRequestHeader = nativeSetHeader;
      try { delete (xhrPrototype as typeof XMLHttpRequest.prototype & Record<string, unknown>)[xhrMarker]; } catch {}
    }
    try { delete scope.__roderudaNetworkBridgeInstalledV3; } catch {}
    pageDocument.removeEventListener(cleanupEventName, cleanup);
  };
  pageDocument.addEventListener(cleanupEventName, cleanup, { once: true });
}

function isNetworkRecord(value: unknown): value is NetworkRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<NetworkRecord>;
  return typeof record.id === "string"
    && typeof record.url === "string"
    && typeof record.method === "string"
    && (record.kind === "fetch" || record.kind === "xhr" || record.kind === "resource" || record.kind === "websocket");
}

function normalizeBridgeRecord(record: NetworkRecord): NetworkRecord {
  return {
    ...record,
    requestHeaders: Array.isArray(record.requestHeaders) ? record.requestHeaders : [],
    responseHeaders: Array.isArray(record.responseHeaders) ? record.responseHeaders : [],
    state: record.state || "pending",
  };
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return resolveUrl(String(input));
}

function resolveUrl(value: string): string {
  try { return new URL(value, typeof location !== "undefined" ? location.href : "http://localhost/").href; }
  catch { return value; }
}

function headersToArray(headers: Headers): NetworkHeader[] {
  return mapIterable(headers.entries(), ([name, value]) => ({ name, value }));
}

function parseRawHeaders(raw: string): NetworkHeader[] {
  return filterMapArray(splitLines(raw), Boolean, (line) => {
    const index = line.indexOf(":");
    return index < 0 ? { name: line, value: "" } : { name: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
  });
}

function numberHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw == null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function readRequestBody(input: RequestInfo | URL, init?: RequestInit): Promise<string | undefined> {
  if (init?.body != null) return bodyToTextAsync(init.body);
  if (typeof Request !== "undefined" && input instanceof Request && input.method !== "GET" && input.method !== "HEAD") {
    try { return await input.clone().text(); } catch { return undefined; }
  }
  return undefined;
}

async function readResponseBody(response: Response): Promise<string | undefined> {
  const contentType = response.headers.get("content-type") || "";
  if (/^(image|audio|video|font)\//i.test(contentType) || /octet-stream/i.test(contentType)) {
    try {
      const buffer = await response.clone().arrayBuffer();
      return `[Binary ${buffer.byteLength} bytes]`;
    } catch { return undefined; }
  }
  try { return await response.clone().text(); } catch { return undefined; }
}

function xhrResponseText(xhr: XMLHttpRequest): string | undefined {
  try {
    if (xhr.responseType === "" || xhr.responseType === "text") return xhr.responseText;
    if (xhr.responseType === "json") return JSON.stringify(xhr.response);
    if (xhr.response instanceof ArrayBuffer) return `[Binary ${xhr.response.byteLength} bytes]`;
    if (xhr.response instanceof Blob) return `[Blob ${xhr.response.size} bytes]`;
    return bodyToText(xhr.response);
  } catch { return undefined; }
}

async function bodyToTextAsync(body: unknown): Promise<string | undefined> {
  if (body instanceof Blob) {
    try { return await body.text(); } catch { return bodyToText(body); }
  }
  return bodyToText(body);
}

function bodyToText(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body instanceof FormData) {
    return mapJoinIterable(body.entries(), ([key, value]) => `${key}=${value instanceof File ? `[File ${value.name}]` : value}`, "&");
  }
  if (body instanceof Blob) return `[Blob ${body.size} bytes, ${body.type || "unknown"}]`;
  if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength} bytes]`;
  if (ArrayBuffer.isView(body)) return `[${body.constructor.name} ${body.byteLength} bytes]`;
  try { return JSON.stringify(body); } catch { return String(body); }
}

function byteLength(value: string): number {
  try { return new TextEncoder().encode(value).byteLength; }
  catch { return value.length; }
}

/** Shared page-realm capture used by Network, Resources and Sources. */
export const sharedNetworkCapture = new NetworkCapture();
