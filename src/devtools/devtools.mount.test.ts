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
    devtools.init({ autoScale: false, tool: ["console", "info", "snippets"] });

    const host = document.querySelector<HTMLElement>("#roderuda");
    expect(devtools.isInitialized()).toBe(true);
    expect(host).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot).not.toBeNull();
    expect(host?.shadowRoot?.querySelector(".roderuda-container")).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot?.querySelector(".roderuda-tabbar")).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot?.querySelector(".roderuda-tools")).toBeInstanceOf(HTMLElement);

    expect(devtools.get("settings")).toBeDefined();
    expect(devtools.get("console")).toBeDefined();
    expect(devtools.get("info")).toBeDefined();
    expect(devtools.get("snippets")).toBeDefined();
  });
});
