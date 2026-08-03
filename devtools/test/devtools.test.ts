// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { polyfillBrowserApis } from "./_tests.setup";
import devtools, { Console, Info, Settings, Snippets, Sources } from "@rodkisten/devtools";


describe("RodEruda native devtools", () => {
  beforeEach(() => {
    polyfillBrowserApis();
    document.documentElement.innerHTML = "<head><title>Fixture</title></head><body><main id='app'>Hello</main></body>";
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    devtools.destroy();
    vi.restoreAllMocks();
  });

  it("initializes all default panels inside a shadow root", () => {
    devtools.init({ autoScale: false });
    expect(devtools.isInitialized()).toBe(true);
    expect(devtools.get("console")).toBeInstanceOf(Console);
    expect(devtools.get("sources")).toBeInstanceOf(Sources);
    expect(devtools.get("info")).toBeInstanceOf(Info);
    expect(devtools.get("snippets")).toBeInstanceOf(Snippets);
    expect(devtools.get("settings")).toBeInstanceOf(Settings);
    expect(document.querySelector("#roderuda")?.shadowRoot).not.toBeNull();
  }, 15_000);

  it("starts hidden and can ingest a startup error bag", () => {
    devtools.init({
      autoScale: false,
      tool: ["console"],
      initialErrors: [new Error("startup boom")],
    });

    expect(devtools.get()?.isVisible()).toBe(false);

    devtools.show("console");
    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    expect(shadow?.textContent).toContain("startup boom");
  });

  it("opens the Console for startup errors only when displayIfErr is enabled", () => {
    devtools.init({
      autoScale: false,
      tool: ["console"],
      initialErrors: [{ level: "error", message: "show me" }],
      config: { panels: { console: { displayIfErr: true } } },
    });

    expect(devtools.get()?.isVisible()).toBe(true);
  });

  it("shows, hides, selects tools and persists the entry position", () => {
    devtools.init({ autoScale: false });
    devtools.show("elements");
    expect(devtools.get()?.isVisible()).toBe(true);
    devtools.position({ x: 24, y: 42 });
    expect(devtools.position()).toEqual({ x: 24, y: 42 });
    devtools.hide();
    expect(devtools.get()?.isVisible()).toBe(false);
  });

  it("starts minimized and exposes a working minimize button", () => {
    devtools.init({ autoScale: false });

    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    const entryButton = shadow?.querySelector<HTMLButtonElement>("[data-roderuda-shell-ref='entryButton']");
    const minimizeButton = shadow?.querySelector<HTMLButtonElement>("[data-roderuda-shell-ref='minimizeButton']");

    expect(devtools.get()?.isVisible()).toBe(false);
    expect(entryButton?.getAttribute("aria-expanded")).toBe("false");
    expect(minimizeButton).toBeInstanceOf(HTMLButtonElement);

    devtools.show();
    expect(entryButton?.getAttribute("aria-expanded")).toBe("true");
    minimizeButton?.click();

    expect(devtools.get()?.isVisible()).toBe(false);
    expect(entryButton?.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the entry button inside the visual viewport", async () => {
    const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = new EventTarget() as EventTarget & {
      width: number;
      height: number;
      offsetLeft: number;
      offsetTop: number;
    };
    Object.assign(viewport, { width: 320, height: 480, offsetLeft: 12, offsetTop: 24 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });

    devtools.init({ autoScale: false });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    devtools.position({ x: -500, y: 9999 });
    expect(devtools.position()).toEqual({ x: 20, y: 440 });

    Object.assign(viewport, { width: 240, height: 300, offsetLeft: 30, offsetTop: 50 });
    viewport.dispatchEvent(new Event("resize"));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    expect(devtools.position()).toEqual({ x: 38, y: 286 });

    if (originalVisualViewport) Object.defineProperty(window, "visualViewport", originalVisualViewport);
    else Reflect.deleteProperty(window, "visualViewport");
  });

  it("injects shell and styled panel CSS into the shadow root", () => {
    devtools.init({ autoScale: false, tool: ["console", "elements"] });
    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    const styleText = Array.from(shadow?.querySelectorAll("style") ?? [])
      .map((style) => style.textContent ?? "")
      .join("\n");

    expect(styleText.length).toBeGreaterThan(1000);
    expect(styleText).toContain("--rd-colors-background:var(--background)");
    expect(styleText).toContain("--rd-font-ui:");
    expect(styleText).toContain("--rd-shadow-panel:");
    expect(styleText).toContain("var(--rd-colors-background)");
    expect(styleText).toContain('[data-js-execution="false"]');
    expect(styleText).toContain('[data-selected="true"]');
    expect(styleText).not.toMatch(/(?:^|[^A-Za-z0-9_-])\$(?:background|border|primary|foreground|accent|backgroundDark)\b/);
    expect(shadow?.querySelector("#cipo-runtime-style, style[data-cipo='runtime']")).toBeInstanceOf(HTMLStyleElement);
    expect(document.getElementById("cipo-runtime-style")).toBeNull();
  });

  it("renders the Elements panel tree with page DOM nodes", () => {
    devtools.init({ autoScale: false, tool: ["elements"] });
    devtools.show("elements");

    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    const tree = shadow?.querySelector<HTMLElement>("[data-elements-tree]");

    expect(tree).toBeInstanceOf(HTMLElement);
    expect(tree?.querySelector("[data-node-id]")).toBeInstanceOf(HTMLElement);
    expect(tree?.textContent).toContain("main");
    expect(shadow?.querySelector("RodElementsView, rodelementsview")).toBeNull();
    expect(shadow?.querySelector("RodElementsDomText, rodelementsdomtext, RodElementsDomTag, rodelementsdomtag")).toBeNull();
  });

  it("ingests external logs through the public API before initialization", async () => {
    devtools.ingestLogs("clear");
    devtools.ingestLogs({
      level: "info",
      args: ["queued external log", { ready: true }],
      source: "startup-worker",
      badge: "wrk",
    });

    const originalWarn = vi.fn();
    const externalConsole = { warn: originalWarn };
    const stream = devtools.ingestLogs(externalConsole, {
      source: "vendor-sdk",
      badge: "sdk",
    });

    externalConsole.warn("intercepted warning");

    devtools.init({ autoScale: false, tool: ["console"] });
    devtools.show("console");

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    const list = shadow?.querySelector<HTMLElement>("[data-console-list]");
    const badges = Array.from(
      shadow?.querySelectorAll<HTMLElement>("[title^='External log']") ?? [],
    );

    expect(list?.textContent).toContain("queued external log");
    expect(list?.textContent).toContain("intercepted warning");
    expect(badges.map((badge) => badge.textContent?.trim())).toEqual(
      expect.arrayContaining(["wrk", "sdk"]),
    );
    expect(originalWarn).toHaveBeenCalledWith("intercepted warning");

    stream.destroy();
    expect(externalConsole.warn).toBe(originalWarn);
  });

  it("captures console methods emitted on window.console without locking global object helpers", async () => {
    const defineProperty = Object.defineProperty;
    const reflectDefineProperty = Reflect.defineProperty;
    const objectAssign = Object.assign;

    devtools.init({ autoScale: false, tool: ["console"] });

    expect(Object.defineProperty).toBe(defineProperty);
    expect(Reflect.defineProperty).toBe(reflectDefineProperty);
    expect(Object.assign).toBe(objectAssign);

    console.log("captured window log");
    console.trace("captured trace");

    // Console rendering is intentionally frame-batched so log storms cannot
    // rebuild the entire list synchronously for every console call.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    const consoleText = shadow?.querySelector("[data-console-list]")?.textContent ?? "";

    expect(consoleText).toContain("captured window log");
    expect(consoleText).toContain("captured trace");
  });


  it("renders a real console filter value instead of stringifying reactive functions", () => {
    devtools.init({ autoScale: false, tool: ["console"] });
    devtools.show("console");

    const shadow = document.querySelector("#roderuda")?.shadowRoot;
    const filter = shadow?.querySelector<HTMLInputElement>("[data-console-filter]");

    expect(filter).toBeInstanceOf(HTMLInputElement);
    expect(filter?.placeholder).toBe("Filter logs…");
    expect(filter?.value).toBe("");
    expect(filter?.value).not.toContain("=>");
  });

  it("supports the public plugin API", () => {
    devtools.init({ tool: [], autoScale: false });
    const custom = {
      name: "custom",
      active: false,
      init(container: HTMLElement) { container.textContent = "custom tool"; },
      show() { this.active = true; },
      hide() { this.active = false; },
      destroy() {},
    };
    devtools.add(custom).show("custom");
    expect(devtools.get("custom")).toBe(custom);
    expect(custom.active).toBe(true);
    devtools.remove("custom");
    expect(devtools.get("custom")).toBeUndefined();
  });

  it("implements local protocol DOM and runtime commands", async () => {
    const documentResult = await devtools.chobitsu.send<{ root: { nodeName: string } }>("DOM.getDocument", { depth: 1 });
    expect(documentResult.result?.root.nodeName).toBe("#document");
    const evaluation = await devtools.chobitsu.send<{ result: { value: number } }>("Runtime.evaluate", { expression: "20 + 22", returnByValue: true });
    expect(evaluation.result?.result.value).toBe(42);
  });


  it("preserves the synchronous chobitsu domain compatibility API", () => {
    devtools.init({ autoScale: false });
    const app = document.querySelector("#app")!;
    const dom = devtools.chobitsu.domain("DOM");
    const { nodeId } = dom.getNodeId({ node: app }) as { nodeId: number };
    expect(nodeId).toBeGreaterThan(0);
    expect((dom.getNode({ nodeId }) as { node: Node }).node).toBe(app);
    expect((devtools.chobitsu.domain("Network").getCookies() as { cookies: unknown[] }).cookies).toBeInstanceOf(Array);
  });

  it("keeps the original Info and Snippets method contracts", () => {
    devtools.init({ autoScale: false });
    const info = devtools.get("info") as Info;
    info.add("Custom", "first").add("Custom", "updated");
    expect(info.get("Custom")).toBe("updated");
    expect(info.get().filter((item) => item.name === "Custom")).toHaveLength(1);

    const snippets = devtools.get("snippets") as Snippets;
    const run = vi.fn();
    snippets.add("Compatibility snippet", run, "Description").run("Compatibility snippet");
    expect(run).toHaveBeenCalledOnce();
  });

  it("can be destroyed and initialized again", () => {
    devtools.init({ autoScale: false, tool: ["console"] }).destroy().init({ autoScale: false, useShadowDom: false, tool: ["console"] });
    expect(devtools.isInitialized()).toBe(true);
    expect(document.querySelector("#roderuda [data-roderuda-root]")).not.toBeNull();
  });
});
