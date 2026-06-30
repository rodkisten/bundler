import { Emitter } from "./emitter";
import { ElementHighlighter } from "./highlighter";
import { isDevtoolsNode, nodePath, safeStringify } from "./dom";
import { NetworkCapture } from "./network-capture";
import type { NetworkRecord } from "../types";

interface ProtocolEvents {
  event: [method: string, params: unknown];
  [key: string]: unknown[];
}

interface ProtocolResponse<T = unknown> {
  result?: T;
  error?: { code: number; message: string };
}

type NodeDescription = {
  nodeId: number;
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName: string;
  nodeValue: string;
  childNodeCount: number;
  attributes?: string[];
  children?: NodeDescription[];
  documentURL?: string;
  baseURL?: string;
};

type DomainListener = (...args: any[]) => void;

type DomainFacade = {
  on(event: string, listener: DomainListener): DomainFacade;
  off(event: string, listener: DomainListener): DomainFacade;
  [method: string]: any;
};

/**
 * Local compatibility implementation for the subset of Chobitsu/CDP exposed by
 * RodEruda. Everything runs against browser APIs in the current page.
 */
export class NativeProtocol extends Emitter<ProtocolEvents> {
  private nodeIds = new WeakMap<Node, number>();
  private readonly nodes = new Map<number, Node>();
  private readonly objects = new Map<number, unknown>();
  private highlighter = new ElementHighlighter();
  private sequence = 1;
  private enabledDomains = new Set<string>();
  private networkCapture = new NetworkCapture();
  private ownsNetworkCapture = true;
  private networkBound = false;
  private networkStages = new Map<string, { response: boolean; finished: boolean }>();
  private inspectCleanup: Array<() => void> = [];
  private devtoolsHost: HTMLElement | null = null;

  setHost(host: HTMLElement | null): this {
    this.devtoolsHost = host;
    this.highlighter.destroy();
    this.highlighter = new ElementHighlighter(host);
    return this;
  }

  attachNetworkCapture(capture: NetworkCapture): this {
    if (capture === this.networkCapture) return this;
    this.unbindNetwork();
    if (this.ownsNetworkCapture) this.networkCapture.destroy();
    this.networkCapture = capture;
    this.ownsNetworkCapture = false;
    if (this.enabledDomains.has("Network")) this.bindNetwork();
    return this;
  }

  domain(name: string): DomainFacade {
    const protocol = this;
    const facade: DomainFacade = {
      on(event: string, listener: DomainListener) {
        protocol.on(`${name}.${event}`, listener);
        return facade;
      },
      off(event: string, listener: DomainListener) {
        protocol.off(`${name}.${event}`, listener);
        return facade;
      },
    };
    return new Proxy(facade, {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        if (typeof property !== "string") return undefined;
        return (params: Record<string, unknown> = {}) => protocol.dispatchSync(`${name}.${property}`, params);
      },
    });
  }

  register(_name: string, _domain: unknown): this {
    // Compatibility no-op. Native domains are built in and cannot be replaced.
    return this;
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<ProtocolResponse<T>> {
    try {
      const result = await this.dispatch(method, params);
      return { result: result as T };
    } catch (error) {
      return { error: { code: -32_000, message: error instanceof Error ? error.message : String(error) } };
    }
  }

  async dispatch(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (method === "Network.clearBrowserCache") {
      if ("caches" in window) for (const name of await caches.keys()) await caches.delete(name);
      return {};
    }
    return this.dispatchSync(method, params);
  }

  dispatchSync(method: string, params: Record<string, unknown> = {}): unknown {
    const [domain, command] = method.split(".");
    if (command === "enable") {
      this.enabledDomains.add(domain);
      if (domain === "Network") this.bindNetwork();
      return {};
    }
    if (command === "disable") {
      this.enabledDomains.delete(domain);
      if (domain === "Network") this.unbindNetwork();
      if (domain === "Overlay") this.stopInspectMode();
      return {};
    }

    switch (method) {
      case "DOM.getDocument":
        return { root: this.describe(document, Number(params.depth ?? 1)) };
      case "DOM.getNodeId":
      case "DOM.getDOMNodeId": {
        const node = params.node;
        if (!(node instanceof Node)) throw new Error("A DOM node is required");
        return { nodeId: this.id(node), backendNodeId: this.id(node) };
      }
      case "DOM.getNode":
      case "DOM.getDOMNode": {
        const node = this.resolveNode(params);
        if (!node) throw new Error("Node not found");
        return { node };
      }
      case "DOM.requestNode":
      case "DOM.getNodeForLocation": {
        const node = method === "DOM.getNodeForLocation"
          ? document.elementFromPoint(Number(params.x ?? 0), Number(params.y ?? 0))
          : this.resolveNode(params);
        return { nodeId: node ? this.id(node) : 0, backendNodeId: node ? this.id(node) : 0 };
      }
      case "DOM.describeNode": {
        const node = this.resolveNode(params);
        if (!node) throw new Error("Node not found");
        return { node: this.describe(node, Number(params.depth ?? 0)) };
      }
      case "DOM.getOuterHTML": {
        const node = this.resolveNode(params);
        if (!node) throw new Error("Node not found");
        return { outerHTML: node instanceof Element ? node.outerHTML : node.textContent ?? "" };
      }
      case "DOM.setOuterHTML": {
        const node = this.resolveNode(params);
        if (!(node instanceof Element)) throw new Error("Element not found");
        node.outerHTML = String(params.outerHTML ?? "");
        return {};
      }
      case "DOM.setAttributeValue": {
        const node = this.resolveNode(params);
        if (!(node instanceof Element)) throw new Error("Element not found");
        node.setAttribute(String(params.name), String(params.value ?? ""));
        return {};
      }
      case "DOM.removeAttribute": {
        const node = this.resolveNode(params);
        if (!(node instanceof Element)) throw new Error("Element not found");
        node.removeAttribute(String(params.name));
        return {};
      }
      case "DOM.removeNode": {
        this.resolveNode(params)?.parentNode?.removeChild(this.resolveNode(params)!);
        return {};
      }
      case "DOM.getAttributes": {
        const node = this.resolveNode(params);
        return { attributes: node instanceof Element ? this.attributes(node) : [] };
      }
      case "DOM.getBoxModel": {
        const node = this.resolveNode(params);
        if (!(node instanceof Element)) throw new Error("Element not found");
        const rect = node.getBoundingClientRect();
        const quad = [rect.left, rect.top, rect.right, rect.top, rect.right, rect.bottom, rect.left, rect.bottom];
        return { model: { content: quad, padding: quad, border: quad, margin: quad, width: rect.width, height: rect.height } };
      }
      case "DOM.getNodeStackTraces": {
        const node = this.resolveNode(params);
        return { creation: { description: node ? nodePath(node) : "unknown" } };
      }
      case "Overlay.highlightNode": {
        const node = this.resolveNode(params);
        if (node instanceof Element) this.highlighter.highlight(node, params.highlightConfig !== false);
        return {};
      }
      case "Overlay.hideHighlight":
        this.highlighter.hide();
        return {};
      case "Overlay.setInspectMode":
        this.setInspectMode(String(params.mode ?? "none"));
        return {};
      case "CSS.getComputedStyleForNode": {
        const node = this.resolveNode(params);
        if (!(node instanceof Element)) throw new Error("Element not found");
        const style = getComputedStyle(node);
        return { computedStyle: Array.from(style, (name) => ({ name, value: style.getPropertyValue(name) })) };
      }
      case "CSS.getInlineStylesForNode": {
        const node = this.resolveNode(params);
        if (!(node instanceof HTMLElement || node instanceof SVGElement)) throw new Error("Element not found");
        return { inlineStyle: { cssProperties: Array.from(node.style, (name) => ({ name, value: node.style.getPropertyValue(name), important: node.style.getPropertyPriority(name) === "important" })), cssText: node.getAttribute("style") ?? "" } };
      }
      case "Runtime.evaluate": {
        const value = (0, eval)(String(params.expression ?? ""));
        return { result: this.remoteObject(value, Boolean(params.returnByValue)) };
      }
      case "Runtime.getProperties": {
        const value = this.objects.get(Number(params.objectId));
        if (value == null) return { result: [] };
        const descriptors = Object.getOwnPropertyDescriptors(Object(value));
        return {
          result: Object.entries(descriptors).map(([name, descriptor]) => ({
            name,
            value: "value" in descriptor ? this.remoteObject(descriptor.value, false) : undefined,
            get: descriptor.get ? this.remoteObject(descriptor.get, false) : undefined,
            set: descriptor.set ? this.remoteObject(descriptor.set, false) : undefined,
            enumerable: descriptor.enumerable,
            configurable: descriptor.configurable,
            writable: "writable" in descriptor ? descriptor.writable : undefined,
          })),
        };
      }
      case "Page.reload":
        location.reload();
        return {};
      case "Page.getNavigationHistory":
        return { currentIndex: 0, entries: [{ id: 1, url: location.href, userTypedURL: location.href, title: document.title, transitionType: "typed" }] };
      case "Page.navigate":
        location.href = String(params.url ?? location.href);
        return { frameId: "main" };
      case "Network.getResponseBody": {
        const record = this.networkCapture.get(String(params.requestId ?? ""));
        return { body: record?.responseBody ?? "", base64Encoded: false };
      }
      case "Network.getCookies":
      case "Storage.getCookies":
        return { cookies: this.cookies() };
      case "Network.deleteCookies":
        this.deleteCookie(String(params.name ?? ""));
        return {};
      case "Network.clearBrowserCookies":
        for (const cookie of this.cookies()) this.deleteCookie(cookie.name);
        return {};
      case "Storage.clearDataForOrigin": {
        const types = String(params.storageTypes ?? "all");
        if (types === "all" || types.includes("local_storage")) localStorage.clear();
        if (types === "all" || types.includes("session_storage")) sessionStorage.clear();
        if (types === "all" || types.includes("cookies")) for (const cookie of this.cookies()) this.deleteCookie(cookie.name);
        return {};
      }
      default:
        throw new Error(`Unsupported local protocol method: ${method}`);
    }
  }

  emitProtocol(method: string, params: unknown): void {
    if (!this.enabledDomains.has(method.split(".")[0] ?? "")) return;
    this.emit("event", method, params);
    this.emit(method, params);
  }

  destroy(): void {
    this.stopInspectMode();
    this.unbindNetwork();
    if (this.ownsNetworkCapture) this.networkCapture.destroy();
    this.highlighter.destroy();
    this.nodes.clear();
    this.nodeIds = new WeakMap<Node, number>();
    this.objects.clear();
    this.sequence = 1;
    this.enabledDomains.clear();
    this.networkStages.clear();
    this.removeAllListeners();
  }

  private id(value: Node | object): number {
    if (value instanceof Node) {
      const current = this.nodeIds.get(value);
      if (current) return current;
      const id = this.sequence++;
      this.nodeIds.set(value, id);
      this.nodes.set(id, value);
      this.objects.set(id, value);
      return id;
    }
    for (const [id, candidate] of this.objects) if (candidate === value) return id;
    const id = this.sequence++;
    this.objects.set(id, value);
    return id;
  }

  private resolveNode(params: Record<string, unknown>): Node | null {
    if (params.node instanceof Node) return params.node;
    for (const key of ["nodeId", "backendNodeId", "objectId"] as const) {
      const value = params[key];
      if (typeof value === "number" || typeof value === "string") {
        const node = this.nodes.get(Number(value));
        if (node) return node;
      }
    }
    return null;
  }

  private describe(node: Node, depth: number): NodeDescription {
    const element = node instanceof Element ? node : null;
    const id = this.id(node);
    const description: NodeDescription = {
      nodeId: id,
      backendNodeId: id,
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      localName: element?.localName ?? "",
      nodeValue: node.nodeValue ?? "",
      childNodeCount: node.childNodes.length,
    };
    if (element) description.attributes = this.attributes(element);
    if (node === document) {
      description.documentURL = location.href;
      description.baseURL = document.baseURI;
    }
    if (depth !== 0 && node.childNodes.length) {
      const nextDepth = depth < 0 ? -1 : depth - 1;
      description.children = Array.from(node.childNodes, (child) => this.describe(child, nextDepth));
    }
    return description;
  }

  private attributes(element: Element): string[] {
    return Array.from(element.attributes).flatMap(({ name, value }) => [name, value]);
  }

  private remoteObject(value: unknown, returnByValue = false): Record<string, unknown> {
    const type = value === null ? "object" : typeof value;
    const result: Record<string, unknown> = { type, description: safeStringify(value, 0) };
    if (value === null) result.subtype = "null";
    if (returnByValue || value == null || (type !== "object" && type !== "function")) result.value = value;
    if (value && (type === "object" || type === "function")) result.objectId = String(this.id(value as object));
    if (value instanceof Node) result.subtype = "node";
    if (Array.isArray(value)) result.subtype = "array";
    if (value instanceof Error) result.subtype = "error";
    return result;
  }

  private setInspectMode(mode: string): void {
    this.stopInspectMode();
    if (mode === "none") return;
    const move = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (element && !isDevtoolsNode(element, this.devtoolsHost)) this.highlighter.highlight(element, true);
    };
    const select = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element || isDevtoolsNode(element, this.devtoolsHost)) return;
      event.preventDefault();
      event.stopPropagation();
      const backendNodeId = this.id(element);
      this.emitProtocol("Overlay.inspectNodeRequested", { backendNodeId });
      this.stopInspectMode();
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerdown", select, true);
    this.inspectCleanup.push(
      () => document.removeEventListener("pointermove", move, true),
      () => document.removeEventListener("pointerdown", select, true),
    );
  }

  private stopInspectMode(): void {
    for (const cleanup of this.inspectCleanup.splice(0)) cleanup();
    this.highlighter.hide();
  }

  private bindNetwork(): void {
    if (this.networkBound) return;
    this.networkBound = true;
    this.networkCapture.on("request", this.onNetworkRequest);
    this.networkCapture.on("update", this.onNetworkUpdate);
    this.networkCapture.on("clear", this.onNetworkClear);
    this.networkCapture.install();
  }

  private unbindNetwork(): void {
    if (!this.networkBound) return;
    this.networkBound = false;
    this.networkCapture.off("request", this.onNetworkRequest);
    this.networkCapture.off("update", this.onNetworkUpdate);
    this.networkCapture.off("clear", this.onNetworkClear);
  }

  private readonly onNetworkRequest = (record: NetworkRecord): void => {
    this.networkStages.set(record.id, { response: false, finished: false });
    this.emitProtocol("Network.requestWillBeSent", {
      requestId: record.id,
      timestamp: record.startTime / 1000,
      wallTime: Date.now() / 1000,
      type: record.type ?? record.kind,
      request: { url: record.url, method: record.method, headers: Object.fromEntries(record.requestHeaders.map((header) => [header.name, header.value])), postData: record.requestBody },
    });
  };

  private readonly onNetworkUpdate = (record: NetworkRecord): void => {
    const stage = this.networkStages.get(record.id) ?? { response: false, finished: false };
    if (record.status != null && !stage.response) {
      stage.response = true;
      this.emitProtocol("Network.responseReceived", {
        requestId: record.id,
        timestamp: (record.endTime ?? performance.now()) / 1000,
        type: record.type ?? record.kind,
        response: {
          url: record.url,
          status: record.status,
          statusText: record.statusText ?? "",
          headers: Object.fromEntries(record.responseHeaders.map((header) => [header.name, header.value])),
          mimeType: record.mimeType ?? "",
          encodedDataLength: record.size ?? 0,
        },
      });
    }
    if (record.state !== "pending" && !stage.finished) {
      stage.finished = true;
      this.emitProtocol(record.state === "failed" ? "Network.loadingFailed" : "Network.loadingFinished", {
        requestId: record.id,
        timestamp: (record.endTime ?? performance.now()) / 1000,
        encodedDataLength: record.size ?? 0,
        errorText: record.error ?? "",
      });
    }
    this.networkStages.set(record.id, stage);
  };

  private readonly onNetworkClear = (): void => this.networkStages.clear();

  private cookies(): Array<{ name: string; value: string; domain: string; path: string; expires: number; size: number; httpOnly: boolean; secure: boolean; session: boolean; sameSite: string }> {
    return document.cookie.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...value] = part.split("=");
      return {
        name,
        value: value.join("="),
        domain: location.hostname,
        path: "/",
        expires: -1,
        size: part.length,
        httpOnly: false,
        secure: location.protocol === "https:",
        session: true,
        sameSite: "Lax",
      };
    });
  }

  private deleteCookie(name: string): void {
    if (!name) return;
    const encoded = encodeURIComponent(name);
    const paths = ["/", location.pathname, location.pathname.replace(/\/[^/]*$/, "") || "/"];
    for (const path of new Set(paths)) document.cookie = `${encoded}=; Max-Age=0; path=${path}`;
  }
}
