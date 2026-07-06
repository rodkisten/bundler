// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import devtools from "./index";

const bundlePath = path.resolve(process.cwd(), "dist/devtools.iife.js");

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

describe("RodEruda IIFE bundle mount", () => {
  beforeEach(() => {
    polyfillBrowserApis();
    document.documentElement.innerHTML = "<head><title>Fixture</title></head><body><main id='app'>Hello</main></body>";
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    const api = (window as Window & { DevTools?: typeof devtools }).DevTools;
    const runtime = (api as { devtools?: typeof devtools; default?: typeof devtools; destroy?: typeof devtools.destroy } | undefined)?.devtools
      ?? (api as { default?: typeof devtools } | undefined)?.default
      ?? api;
    runtime?.destroy?.();
    vi.restoreAllMocks();
  });

  it("mounts the shell from the built IIFE bundle", async () => {
    if (!fs.existsSync(bundlePath)) {
      const { build } = await import("vite");
      const config = ((await import("./vite.config")).default as any);
      await build({
        ...config,
        configFile: false,
        build: {
          ...config.build,
          emptyOutDir: false,
          outDir: path.resolve(process.cwd(), "dist"),
          minify: false,
          lib: {
            ...config.build.lib,
            formats: ["iife"],
            fileName: () => "devtools.iife.js",
          },
        },
      });
    }

    expect(fs.existsSync(bundlePath)).toBe(true);

    window.eval(fs.readFileSync(bundlePath, "utf8"));
    const api = (window as Window & { DevTools?: typeof devtools }).DevTools;
    expect(api).toBeDefined();

    const runtime = (api as { devtools?: typeof devtools; default?: typeof devtools }).devtools
      ?? (api as { default?: typeof devtools }).default
      ?? api;

    runtime.init({ autoScale: false, tool: ["console", "info"], debug: false });

    const host = document.querySelector<HTMLElement>("#roderuda");
    const root = host?.shadowRoot?.querySelector<HTMLElement>(".roderuda-container");

    expect(runtime.isInitialized()).toBe(true);
    expect(host).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot).not.toBeNull();
    expect(root).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot?.querySelector(".roderuda-entry-btn")).toBeInstanceOf(HTMLElement);
    expect(host?.shadowRoot?.querySelector("fabrica-component-error")).toBeNull();
    expect(runtime.get("console")).toBeDefined();
    expect(runtime.get("info")).toBeDefined();
  });
});
