import { signal } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";
import { copyText, escapeHtml, icon, isDevtoolsNode, safeStringify } from "@rodkisten/devtools/utils";
import { html } from "@rodkisten/devtools/core/runtime";
import { Tool } from "@rodkisten/devtools/tool";
import type { SnippetItem, SnippetsContextValue, ToolContext } from "@rodkisten/devtools/types";
import { snippetsStyleArtifacts, SnippetsContext } from "@rodkisten/devtools/panels/snippets-components";
import { openWindow, addBorderOverlay, startMonitor, startTouchVisualizer, featureRows } from "@rodkisten/devtools/panels/snippets.functions";
import { appendArray, drainArray, escapeRegExp, filterArray, findArray, findIndexArray, includesArray, mapArray, mapJoinArray, memoizeLast, takeRight, toArray } from "@rodkisten/nascente";


export { snippetsStyleArtifacts };

const SEARCH_IGNORED_TAG_NAMES = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT"]);
const createSearchExpression = memoizeLast((query: string) => new RegExp(escapeRegExp(query), "gi"));

export interface OverlayController {
  stop(): void;
}

export class Snippets extends Tool {
  readonly name = "snippets";
  readonly title = "snippets";
  readonly icon = icon("snippets");
  private readonly snippets = signal<readonly SnippetItem[]>([], { name: "snippets.items" });
  private readonly activeNames = signal<ReadonlySet<string>>(new Set(), { name: "snippets.activeNames" });
  private cleanup: Array<() => void> = [];
  private activeOverlays = new Map<string, OverlayController>();
  private readonly view: SnippetsContextValue = {
    snippets: this.snippets,
    activeNames: this.activeNames,
    add: () => { void this.addInteractive(); },
    reset: () => { this.reset(); },
    run: (name) => { this.run(name); },
    remove: (name) => { this.remove(name); },
  };

  constructor() {
    super();
    this.snippets.set(this.defaultSnippets());
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
  }

  override renderView(): RenderValue {
    return SnippetsContext.Provider({
      value: this.view,
      children: () => html`<RodSnippetsView />`,
    });
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
    const current = this.snippets.peek();
    const existingIndex = findIndexArray(current, (snippet) => snippet.name === name);
    this.snippets.set(existingIndex >= 0
      ? mapArray(current, (snippet, index) => index === existingIndex ? { ...snippet, description, run } : snippet)
      : appendArray(current, { name, description, run }));
    return this;
  }

  run(name: string): this {
    const index = findIndexArray(this.snippets.peek(), (snippet) => snippet.name === name);
    if (index >= 0) void this.execute(index);
    return this;
  }

  get(name: string): SnippetItem | undefined {
    return findArray(this.snippets.peek(), (snippet) => snippet.name === name);
  }

  remove(name: string): this {
    this.snippets.update((items) => filterArray(items, (snippet) => snippet.name !== name));
    this.activeOverlays.get(name)?.stop();
    this.activeOverlays.delete(name);
    this.syncActiveNames();
    return this;
  }

  clear(): this {
    for (const overlay of this.activeOverlays.values()) overlay.stop();
    this.activeOverlays.clear();
    this.snippets.set([]);
    this.syncActiveNames();
    return this;
  }

  reset(): this {
    this.clear();
    this.snippets.set(this.defaultSnippets());
    return this;
  }

  override destroy(): void {
    for (const cleanup of drainArray(this.cleanup)) cleanup();
    for (const overlay of this.activeOverlays.values()) overlay.stop();
    this.activeOverlays.clear();
    this.syncActiveNames();
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

  private async execute(index: number): Promise<void> {
    const snippet = this.snippets.peek()[index];
    if (!snippet) return;
    try {
      const result = await snippet.run();
      if (result !== undefined && !this.activeOverlays.has(snippet.name)) {
        this.context?.notify(`${snippet.name}: ${typeof result === "string" ? result : safeStringify(result, 0)}`, { type: "success" });
      }
    } catch (error) {
      this.context?.notify(error instanceof Error ? error.message : String(error), { type: "error" });
    }
    this.syncActiveNames();
  }

  private syncActiveNames(): void {
    this.activeNames.set(new Set(this.activeOverlays.keys()));
  }

  private toggleOverlay(name: string, createOverlay: () => OverlayController): string {
    const current = this.activeOverlays.get(name);
    if (current) {
      current.stop();
      this.activeOverlays.delete(name);
      this.syncActiveNames();
      return "stopped";
    }
    this.activeOverlays.set(name, createOverlay());
    this.syncActiveNames();
    return "started";
  }

  private async searchText(): Promise<void> {
    const query = await this.context?.prompt("Enter the text", "");
    if (!query?.trim()) return;
    for (const wrapper of toArray(document.querySelectorAll<HTMLElement>(".roderuda-search-highlight-block"))) {
      wrapper.replaceWith(document.createTextNode(wrapper.textContent ?? ""));
    }
    document.body.normalize();
    const expression = createSearchExpression(query);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || isDevtoolsNode(parent, this.context?.shadowRoot?.host as HTMLElement | undefined)) return NodeFilter.FILTER_REJECT;
        if (SEARCH_IGNORED_TAG_NAMES.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
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
      VueRoots: toArray(document.querySelectorAll("[data-v-app], [data-vue-meta], [data-vue-root]"), (node) => node.outerHTML.slice(0, 200)),
    };
    openWindow("Vue inspection", `<pre>${escapeHtml(safeStringify(report))}</pre>`);
  }

  private showFeatures(): void {
    const rows = mapJoinArray(featureRows(), ([name, supported]) => `<tr><td>${escapeHtml(name)}</td><td>${supported ? "✓ supported" : "✕ unavailable"}</td></tr>`, "");
    openWindow("Browser features", `<table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
  }

  private showTiming(): void {
    const navigation = performance.getEntriesByType("navigation");
    const resources = takeRight(performance.getEntriesByType("resource"), 100);
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
