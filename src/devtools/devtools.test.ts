// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import devtools, { Console, Info, Settings, Snippets, Sources } from "./index";

function polyfillBrowserApis(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  });
  Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent });
  Object.defineProperty(window.screen, "orientation", {
    configurable: true,
    value: { type: "portrait-primary", angle: 0, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0) });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: (id: number) => clearTimeout(id) });
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
}

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
    devtools.init({ autoScale: false }).destroy().init({ autoScale: false, useShadowDom: false });
    expect(devtools.isInitialized()).toBe(true);
    expect(document.querySelector("#roderuda .roderuda-container")).not.toBeNull();
  });
});
