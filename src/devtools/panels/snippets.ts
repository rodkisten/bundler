import { copyText, create, delegate, escapeHtml, isDevtoolsNode, safeStringify } from "../core/dom";
import { Tool } from "../tool";
import type { SnippetItem, ToolContext } from "../types";

interface OverlayController {
  stop(): void;
}

function openWindow(title: string, body: string): Window | null {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return null;
  popup.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#101114;color:#eee;margin:0;padding:20px}pre{white-space:pre-wrap;word-break:break-word}table{border-collapse:collapse;width:100%}th,td{padding:7px;border:1px solid #3b3d42;text-align:left}</style><h1>${escapeHtml(title)}</h1>${body}`);
  popup.document.close();
  return popup;
}

function addBorderOverlay(): OverlayController {
  const style = document.createElement("style");
  style.dataset.roderudaSnippet = "border-all";
  style.textContent = `*{outline:2px dashed #707d8b!important;outline-offset:-3px!important}`;
  document.documentElement.append(style);
  return { stop: () => style.remove() };
}

function startMonitor(): OverlayController {
  const panel = document.createElement("div");
  panel.dataset.roderudaSnippet = "monitor";
  Object.assign(panel.style, {
    position: "fixed",
    inset: "8px 8px auto auto",
    zIndex: "2147483647",
    padding: "8px 10px",
    borderRadius: "7px",
    background: "rgba(12,13,16,.9)",
    color: "#dfe4ea",
    font: "11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
    pointerEvents: "none",
    whiteSpace: "pre",
    boxShadow: "0 8px 28px rgba(0,0,0,.35)",
  });
  document.documentElement.append(panel);
  let frames = 0;
  let previous = performance.now();
  let fps = 0;
  let raf = 0;
  let stopped = false;
  const render = (now: number) => {
    if (stopped) return;
    frames += 1;
    if (now - previous >= 500) {
      fps = Math.round((frames * 1000) / (now - previous));
      frames = 0;
      previous = now;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      panel.textContent = [
        `FPS   ${String(fps).padStart(3, " ")}`,
        `DOM   ${document.getElementsByTagName("*").length}`,
        `HEAP  ${memory ? `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MiB` : "n/a"}`,
        `VIEW  ${innerWidth} × ${innerHeight}`,
      ].join("\n");
    }
    raf = requestAnimationFrame(render);
  };
  raf = requestAnimationFrame(render);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      panel.remove();
    },
  };
}

function startTouchVisualizer(): OverlayController {
  const layer = document.createElement("div");
  layer.dataset.roderudaSnippet = "touches";
  Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647" });
  document.documentElement.append(layer);
  const circles = new Map<number, HTMLElement>();
  const render = (event: TouchEvent) => {
    const active = new Set<number>();
    for (const touch of Array.from(event.touches)) {
      active.add(touch.identifier);
      let circle = circles.get(touch.identifier);
      if (!circle) {
        circle = document.createElement("div");
        Object.assign(circle.style, {
          position: "absolute",
          width: "42px",
          height: "42px",
          margin: "-21px 0 0 -21px",
          borderRadius: "50%",
          border: "2px solid #55d6ff",
          background: "rgba(85,214,255,.18)",
          boxShadow: "0 0 0 4px rgba(0,0,0,.22)",
        });
        layer.append(circle);
        circles.set(touch.identifier, circle);
      }
      circle.style.transform = `translate(${touch.clientX}px,${touch.clientY}px)`;
    }
    for (const [id, circle] of circles) {
      if (!active.has(id)) {
        circle.remove();
        circles.delete(id);
      }
    }
  };
  document.addEventListener("touchstart", render, true);
  document.addEventListener("touchmove", render, true);
  document.addEventListener("touchend", render, true);
  document.addEventListener("touchcancel", render, true);
  return {
    stop() {
      document.removeEventListener("touchstart", render, true);
      document.removeEventListener("touchmove", render, true);
      document.removeEventListener("touchend", render, true);
      document.removeEventListener("touchcancel", render, true);
      layer.remove();
    },
  };
}

function featureRows(): Array<[string, boolean]> {
  return [
    ["Web Components", "customElements" in window],
    ["Shadow DOM", "attachShadow" in Element.prototype],
    ["Service Worker", "serviceWorker" in navigator],
    ["WebSocket", "WebSocket" in window],
    ["WebRTC", "RTCPeerConnection" in window],
    ["WebGL 2", Boolean(document.createElement("canvas").getContext("webgl2"))],
    ["WebGPU", "gpu" in navigator],
    ["IndexedDB", "indexedDB" in window],
    ["Cache Storage", "caches" in window],
    ["Clipboard API", "clipboard" in navigator],
    ["File System Access", "showOpenFilePicker" in window],
    ["View Transitions", "startViewTransition" in document],
    ["Container Queries", CSS.supports("container-type", "inline-size")],
    [":has()", CSS.supports("selector(:has(*))")],
  ];
}

export class Snippets extends Tool {
  readonly name = "snippets";
  readonly title = "snippets";
  readonly icon = "✂";
  private snippets: SnippetItem[] = [];
  private body: HTMLElement | null = null;
  private cleanup: Array<() => void> = [];
  private activeOverlays = new Map<string, OverlayController>();

  constructor() {
    super();
    this.snippets = this.defaultSnippets();
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    container.innerHTML = `
      <section class="roderuda-section roderuda-snippets">
        <header class="roderuda-section-title">
          <span>Snippets</span>
          <div class="roderuda-section-actions">
            <button class="roderuda-text-btn" type="button" data-action="add">Add</button>
            <button class="roderuda-text-btn" type="button" data-action="reset">Reset</button>
          </div>
        </header>
        <div class="roderuda-cards roderuda-scroll" data-snippets-body></div>
      </section>`;
    this.body = container.querySelector<HTMLElement>("[data-snippets-body]");
    this.cleanup.push(delegate(container, "click", "[data-action]", (_event, element) => {
      const action = element.dataset.action;
      if (action === "run") void this.execute(Number(element.dataset.index));
      if (action === "remove") this.remove(this.snippets[Number(element.dataset.index)]?.name ?? "");
      if (action === "reset") this.reset();
      if (action === "add") void this.addInteractive();
    }));
    this.render();
  }

  add(name: string, run: () => unknown | Promise<unknown>, description?: string): this;
  add(name: string, description: string, run: () => unknown | Promise<unknown>): this;
  add(name: string, runOrDescription: string | (() => unknown | Promise<unknown>), descriptionOrRun?: string | (() => unknown | Promise<unknown>)): this {
    const run = typeof runOrDescription === "function"
      ? runOrDescription
      : typeof descriptionOrRun === "function"
        ? descriptionOrRun
        : () => undefined;
    const description = typeof runOrDescription === "string"
      ? runOrDescription
      : typeof descriptionOrRun === "string"
        ? descriptionOrRun
        : "Custom snippet";
    const existing = this.snippets.find((snippet) => snippet.name === name);
    if (existing) Object.assign(existing, { description, run });
    else this.snippets.push({ name, description, run });
    this.render();
    return this;
  }

  run(name: string): this {
    const index = this.snippets.findIndex((snippet) => snippet.name === name);
    if (index >= 0) void this.execute(index);
    return this;
  }

  get(name: string): SnippetItem | undefined {
    return this.snippets.find((snippet) => snippet.name === name);
  }

  remove(name: string): this {
    this.snippets = this.snippets.filter((snippet) => snippet.name !== name);
    this.activeOverlays.get(name)?.stop();
    this.activeOverlays.delete(name);
    this.render();
    return this;
  }

  clear(): this {
    for (const overlay of this.activeOverlays.values()) overlay.stop();
    this.activeOverlays.clear();
    this.snippets = [];
    this.render();
    return this;
  }

  reset(): this {
    this.clear();
    this.snippets = this.defaultSnippets();
    this.render();
    return this;
  }

  override destroy(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    for (const overlay of this.activeOverlays.values()) overlay.stop();
    this.activeOverlays.clear();
    this.body = null;
    super.destroy();
  }

  private defaultSnippets(): SnippetItem[] {
    return [
      {
        name: "Border All",
        description: "Toggle an outline on every element in the page.",
        run: () => this.toggleOverlay("Border All", addBorderOverlay),
      },
      { name: "Refresh Page", description: "Add timestamp to URL and refresh.", run: () => {
        const url = new URL(location.href);
        url.searchParams.set("timestamp", String(Date.now()));
        location.replace(url.href);
      } },
      { name: "Search Text", description: "Highlight given text on page.", run: () => this.searchText() },
      { name: "Edit Page", description: "Toggle body contentEditable.", run: () => {
        document.body.contentEditable = document.body.contentEditable === "true" ? "false" : "true";
        this.context?.notify(`Edit mode ${document.body.contentEditable === "true" ? "on" : "off"}`, { type: "success" });
      } },
      { name: "Fit Screen", description: "Scale down the whole page to fit screen.", run: () => {
        const body = document.body;
        const storedScroll = body.dataset.roderudaScaled;
        if (storedScroll != null) {
          body.style.transform = "none";
          body.style.transformOrigin = "";
          delete body.dataset.roderudaScaled;
          window.scrollTo(0, Number(storedScroll) || 0);
          return;
        }
        const html = document.documentElement;
        const documentHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
        const viewportHeight = Math.max(html.clientHeight, innerHeight || 0);
        const scale = documentHeight > 0 ? viewportHeight / documentHeight : 1;
        body.dataset.roderudaScaled = String(window.scrollY);
        body.style.transformOrigin = "top left";
        body.style.transform = `scale(${scale})`;
        window.scrollTo(0, Math.max(0, documentHeight / 2 - viewportHeight / 2));
      } },
      { name: "Load Vue Plugin", description: "Inspect locally exposed Vue hooks without loading a remote plugin.", run: () => this.inspectVue() },
      { name: "Load Monitor Plugin", description: "Toggle an FPS, DOM and JavaScript memory HUD.", run: () => this.toggleOverlay("Load Monitor Plugin", startMonitor) },
      { name: "Load Features Plugin", description: "Show browser feature support.", run: () => this.showFeatures() },
      { name: "Load Timing Plugin", description: "Show Navigation Timing and resource timing data.", run: () => this.showTiming() },
      { name: "Load Code Plugin", description: "Open the Sources panel with the current document HTML.", run: () => this.openCode() },
      { name: "Load Benchmark Plugin", description: "Run a small synchronous JavaScript benchmark.", run: () => this.runBenchmark() },
      { name: "Load Geolocation Plugin", description: "Request and display the current geographic coordinates.", run: () => this.showGeolocation() },
      { name: "Load Orientation Plugin", description: "Show current screen and device orientation values.", run: () => this.showOrientation() },
      { name: "Load Touches Plugin", description: "Toggle a visual marker for active touch points.", run: () => this.toggleOverlay("Load Touches Plugin", startTouchVisualizer) },
    ];
  }

  private render(): void {
    if (!this.body) return;
    this.body.replaceChildren();
    if (!this.snippets.length) {
      this.body.append(create("div", { className: "roderuda-empty", text: "No snippets registered." }));
      return;
    }
    this.snippets.forEach((snippet, index) => {
      const active = this.activeOverlays.has(snippet.name);
      const card = create("article", { className: "roderuda-snippet-card" });
      card.append(
        create("div", { className: "roderuda-snippet-name", text: `${active ? "● " : ""}${snippet.name}` }),
        create("div", { className: "roderuda-snippet-description", text: snippet.description }),
      );
      const actions = create("div", { className: "roderuda-section-actions" });
      actions.append(
        create("button", { className: "roderuda-text-btn", text: active ? "Stop" : "Run", attrs: { type: "button", "data-action": "run", "data-index": index } }),
        create("button", { className: "roderuda-text-btn", text: "Remove", attrs: { type: "button", "data-action": "remove", "data-index": index } }),
      );
      card.append(actions);
      this.body?.append(card);
    });
  }

  private async execute(index: number): Promise<void> {
    const snippet = this.snippets[index];
    if (!snippet) return;
    try {
      const result = await snippet.run();
      if (result !== undefined && !this.activeOverlays.has(snippet.name)) {
        this.context?.notify(`${snippet.name}: ${typeof result === "string" ? result : safeStringify(result, 0)}`, { type: "success" });
      }
    } catch (error) {
      this.context?.notify(error instanceof Error ? error.message : String(error), { type: "error" });
    }
    this.render();
  }

  private toggleOverlay(name: string, createOverlay: () => OverlayController): string {
    const current = this.activeOverlays.get(name);
    if (current) {
      current.stop();
      this.activeOverlays.delete(name);
      return "stopped";
    }
    this.activeOverlays.set(name, createOverlay());
    return "started";
  }

  private async searchText(): Promise<void> {
    const query = await this.context?.prompt("Enter the text", "");
    if (!query?.trim()) return;
    for (const wrapper of Array.from(document.querySelectorAll<HTMLElement>(".roderuda-search-highlight-block"))) {
      wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ""));
    }
    document.body.normalize();
    const expression = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || isDevtoolsNode(parent, this.context?.shadowRoot?.host as HTMLElement | undefined)) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        expression.lastIndex = 0;
        return node.nodeValue && expression.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    let matches = 0;
    for (const node of nodes) {
      expression.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of node.data.matchAll(expression)) {
        const index = match.index ?? 0;
        if (index > offset) fragment.append(document.createTextNode(node.data.slice(offset, index)));
        const mark = document.createElement("span");
        mark.className = "roderuda-search-highlight-block";
        const keyword = document.createElement("span");
        keyword.className = "roderuda-keyword";
        keyword.textContent = match[0];
        mark.append(keyword);
        fragment.append(mark);
        offset = index + match[0].length;
        matches += 1;
      }
      if (offset < node.data.length) fragment.append(document.createTextNode(node.data.slice(offset)));
      node.replaceWith(fragment);
    }
    this.context?.notify(matches ? `Highlighted ${matches} match${matches === 1 ? "" : "es"}` : `No match for “${query}”`, { type: matches ? "success" : "warning" });
  }

  private inspectVue(): void {
    const target = window as Window & {
      Vue?: unknown;
      __VUE__?: boolean;
      __VUE_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>;
    };
    const report = {
      VueGlobal: target.Vue ?? null,
      VueFlag: target.__VUE__ ?? false,
      DevtoolsHook: target.__VUE_DEVTOOLS_GLOBAL_HOOK__ ?? null,
      VueRoots: Array.from(document.querySelectorAll("[data-v-app], [data-vue-meta], [data-vue-root]"), (node) => node.outerHTML.slice(0, 200)),
    };
    openWindow("Vue inspection", `<pre>${escapeHtml(safeStringify(report))}</pre>`);
  }

  private showFeatures(): void {
    const rows = featureRows().map(([name, supported]) => `<tr><td>${escapeHtml(name)}</td><td>${supported ? "✓ supported" : "✕ unavailable"}</td></tr>`).join("");
    openWindow("Browser features", `<table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
  }

  private showTiming(): void {
    const navigation = performance.getEntriesByType("navigation");
    const resources = performance.getEntriesByType("resource").slice(-100);
    openWindow("Performance timing", `<pre>${escapeHtml(safeStringify({ navigation, resources }))}</pre>`);
  }

  private openCode(): void {
    const sources = this.context?.devtools.get("sources") as { set?: (payload: { type: "html"; value: string; title: string }) => unknown } | undefined;
    sources?.set?.({ type: "html", value: document.documentElement.outerHTML, title: document.title || location.href });
    this.context?.devtools.showTool("sources");
  }

  private async runBenchmark(): Promise<void> {
    const iterationsValue = await this.context?.prompt("Iterations", "1000000");
    const iterations = Math.max(1, Math.min(100_000_000, Number(iterationsValue) || 1_000_000));
    let accumulator = 0;
    const start = performance.now();
    for (let index = 0; index < iterations; index += 1) accumulator = (accumulator + Math.imul(index, 31)) | 0;
    const duration = performance.now() - start;
    const result = { iterations, durationMs: Number(duration.toFixed(3)), operationsPerSecond: Math.round(iterations / (duration / 1000)), accumulator };
    await copyText(safeStringify(result));
    this.context?.notify(`Benchmark: ${result.operationsPerSecond.toLocaleString()} ops/s`, { type: "success", duration: 5000 });
  }

  private async showGeolocation(): Promise<void> {
    if (!navigator.geolocation) throw new Error("Geolocation is unavailable");
    const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 }));
    const result = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: new Date(position.timestamp).toISOString(),
    };
    openWindow("Geolocation", `<pre>${escapeHtml(safeStringify(result))}</pre>`);
  }

  private showOrientation(): void {
    const orientation = {
      screen: { type: screen.orientation?.type, angle: screen.orientation?.angle },
      legacy: window.orientation,
      viewport: { width: innerWidth, height: innerHeight },
    };
    openWindow("Orientation", `<pre>${escapeHtml(safeStringify(orientation))}</pre>`);
  }

  private async addInteractive(): Promise<void> {
    const name = await this.context?.prompt("Snippet name", "Custom Snippet");
    if (!name) return;
    const source = await this.context?.prompt("JavaScript expression or statements", "console.log('Hello from RodEruda')");
    if (source == null) return;
    this.add(name, () => (0, eval)(source), "User-defined JavaScript snippet");
  }
}
