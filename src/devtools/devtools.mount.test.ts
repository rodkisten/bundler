// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import devtools from "./index";

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

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: MouseEvent,
  });

  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
  });

  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    value: (id: number) => clearTimeout(id),
  });

  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
}

describe("RodEruda devtools mount", () => {
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

  it("mounts the shell, settings and selected panels inside a shadow root", () => {
    devtools.init({ autoScale: false, tool: ["console", "info", "snippets"], defaults: { theme: "AMOLED" } });

    const host = document.querySelector<HTMLElement>("#roderuda");
    const root = host?.shadowRoot?.querySelector<HTMLElement>("[data-roderuda-root]");
    expect(devtools.isInitialized()).toBe(true);
    expect(host).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot).not.toBeNull();
    expect(root).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot?.querySelector("[data-roderuda-shell-ref='tabbar']")).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot?.querySelector("[data-roderuda-shell-ref='tools']")).toBeInstanceOf(HTMLElement);
    expect(host?.style.getPropertyValue("--background")).toBe("#000000");
    expect(root?.style.getPropertyValue("--background")).toBe("#000000");

    expect(devtools.get("settings")).toBeDefined();
    expect(devtools.get("console")).toBeDefined();
    expect(devtools.get("info")).toBeDefined();
    expect(devtools.get("snippets")).toBeDefined();
  });

  it("renders styled/Fabrica panels and injects their Cipó styles", () => {
    devtools.init({ autoScale: false, tool: ["elements", "resources", "network", "console"], defaults: { theme: "AMOLED" } });

    const host = document.querySelector<HTMLElement>("#roderuda");
    const root = host?.shadowRoot;
    expect(root).not.toBeNull();

    devtools.show("elements");
    expect(root?.querySelector("fabrica-component-error")).toBeNull();
    const layout = root?.querySelector<HTMLElement>("[data-elements-layout]");
    expect(layout).toBeInstanceOf(HTMLElement);
    expect(root?.querySelector("[data-elements-tree]")).toBeInstanceOf(HTMLElement);

    devtools.show("resources");
    expect(root?.querySelector("fabrica-component-error")).toBeNull();
    expect(root?.querySelector("[data-resources-body]")).toBeInstanceOf(HTMLElement);
    expect(root?.textContent).toContain("Local Storage");

    devtools.show("network");
    expect(root?.querySelector("fabrica-component-error")).toBeNull();
    expect(root?.querySelector("[data-network-list]")).toBeInstanceOf(HTMLElement);

    const styleText = Array.from(root?.querySelectorAll("style") ?? [])
      .map((style) => style.textContent ?? "")
      .join("\n");
    const generatedClass = layout?.className.split(/\s+/).find(Boolean) ?? "missing-elements-class";

    expect(styleText).toContain(generatedClass);
    expect(styleText).toMatch(/(?:\.roderuda-tools|overflow)/);
    expect(styleText).toContain("var(--rd-colors-background)");
    expect(styleText).not.toMatch(/(?:^|[^A-Za-z0-9_-])\$background\b/);
    expect(styleText).not.toMatch(/(?:^|[^A-Za-z0-9_-])\$border\b/);
    expect(root?.querySelector("#cipo-runtime-style, style[data-cipo='runtime']")).toBeInstanceOf(HTMLStyleElement);
    expect(document.getElementById("cipo-runtime-style")).toBeNull();
  });
});
