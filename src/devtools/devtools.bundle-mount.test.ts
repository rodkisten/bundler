// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
import devtools from "./index";

const bundlePath = path.resolve(process.cwd(), "dist/devtools.iife.js");

const compiledPanelMarkers = [
  "RodConsoleView",
  "RodElementsView",
  "RodNetworkView",
  "RodResourcesView",
] as const;

function polyfillBrowserApis(): void {
  Object.defineProperty(globalThis, "TextEncoder", { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, "TextDecoder", { configurable: true, value: TextDecoder });
  const NativeUint8Array = new TextEncoder().encode("").constructor;
  Object.defineProperty(globalThis, "Uint8Array", { configurable: true, value: NativeUint8Array });
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

  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }

  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
}

function runtimeFromWindow(): typeof devtools | undefined {
  const api = (window as Window & { DevTools?: typeof devtools }).DevTools;

  return (
    (api as { devtools?: typeof devtools; default?: typeof devtools } | undefined)?.devtools
    ?? (api as { default?: typeof devtools } | undefined)?.default
    ?? api
  );
}

function shadowRoot(): ShadowRoot {
  const host = document.querySelector<HTMLElement>("#roderuda");

  expect(host).toBeInstanceOf(HTMLElement);
  expect(host?.shadowRoot).not.toBeNull();

  return host!.shadowRoot!;
}

function expectCompiledDevtoolsBundle(bundle: string): void {
  expect(bundle).toContain("createCompiledTemplate");

  expect(bundle).not.toMatch(/component\("Rod[A-Za-z0-9_]+".*?html`/s);
  expect(bundle).not.toMatch(/styled\.[a-z]+\("Rod[A-Za-z0-9_]+".*?\.css`/s);
  // The bundle may legitimately include createStyled for independently
  // shipped packages such as Maquina. Panel-local assertions below verify that
  // RodEruda's own named styled components were compiled.

  for (const marker of compiledPanelMarkers) {
    const index = bundle.indexOf(marker);
    expect(index, `${marker} should be present in bundle`).toBeGreaterThanOrEqual(0);

    const nearby = bundle.slice(Math.max(0, index - 800), index + 3000);

    expect(nearby, `${marker} should be compiled`).toContain("createCompiledTemplate");
    expect(nearby, `${marker} should not keep raw html tag`).not.toContain("html`");
    expect(nearby, `${marker} should not keep raw styled css tag`).not.toContain(".css`");
  }
}

function expectStylesInjected(root: ShadowRoot): void {
  const styleText = Array.from(root.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");

  expect(styleText.length).toBeGreaterThan(1000);
  expect(styleText).toContain("var(--rd-colors-background)");
  expect(styleText).toMatch(/\.rd-/);
  expect(root.querySelector("#cipo-runtime-style, style[data-cipo='runtime']")).toBeInstanceOf(HTMLStyleElement);
  expect(document.getElementById("cipo-runtime-style")).toBeNull();

  const tokenPattern =
    /(?:^|[^A-Za-z0-9_-])\$(?:background|backgroundDark|border|primary|foreground|accent|comment|danger|success|selectedForeground|highlight|contrast|operator|tag|attr|string|var)\b|\$font\.(?:ui|mono)\b|\$shadow\.[a-zA-Z_][\w.]*|\$\$(?:safeBottom|controlHeight)\b/g;

  const leakedTokens = [...styleText.matchAll(tokenPattern)].map((match) => {
    const index = match.index ?? 0;

    return {
      token: match[0],
      context: styleText.slice(Math.max(0, index - 80), index + 120),
    };
  });

  expect(leakedTokens).toEqual([]);
}

function expectVisiblePanel(root: ShadowRoot, name: string): HTMLElement {
  const panel = root.querySelector<HTMLElement>(`[data-tool="${name}"]`);

  expect(panel, `panel "${name}" should exist`).toBeInstanceOf(HTMLElement);
  expect(panel?.hidden, `panel "${name}" should not be hidden`).toBe(false);
  expect(panel?.childElementCount, `panel "${name}" should render children`).toBeGreaterThan(0);
  return panel!;
}

function expectHiddenPanel(root: ShadowRoot, name: string): HTMLElement {
  const panel = root.querySelector<HTMLElement>(`[data-tool="${name}"]`);

  expect(panel, `panel "${name}" should exist`).toBeInstanceOf(HTMLElement);
  expect(panel?.hidden, `panel "${name}" should be hidden`).toBe(true);

  return panel!;
}

function expectSelectedTab(root: ShadowRoot, name: string): void {
  const tab = root.querySelector<HTMLElement>(`[data-tool-tab="${name}"]`);

  expect(tab, `tab "${name}" should exist`).toBeInstanceOf(HTMLElement);
  expect(tab?.getAttribute("aria-selected")).toBe("true");
  expect(tab?.dataset.selected).toBe("true");
}

function expectPanelMounted(root: ShadowRoot, name: string): HTMLElement {
  const tab = root.querySelector<HTMLElement>(`[data-tool-tab="${name}"]`);
  const panel = root.querySelector<HTMLElement>(`[data-tool="${name}"]`);

  expect(tab, `tab "${name}" should be rendered`).toBeInstanceOf(HTMLElement);
  expect(panel, `panel "${name}" should be rendered`).toBeInstanceOf(HTMLElement);
  expect(panel?.childElementCount, `panel "${name}" should have rendered content`).toBeGreaterThan(0);

  return panel!;
}

describe("RodEruda IIFE bundle mount", () => {
  beforeEach(() => {
    polyfillBrowserApis();
    document.documentElement.innerHTML = "<head><title>Fixture</title></head><body><main id='app'>Hello</main></body>";
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    runtimeFromWindow()?.destroy?.();
    vi.restoreAllMocks();
  });

  it("mounts the shell and renders styled Fabrica panels from the built IIFE bundle", async () => {
    fs.rmSync(bundlePath, { force: true });

    const { build } = await import("vite");
    const config = (await import("./vite.config")).default as any;

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

    expect(fs.existsSync(bundlePath)).toBe(true);

    const bundle = fs.readFileSync(bundlePath, "utf8");

    expectCompiledDevtoolsBundle(bundle);

    window.eval(bundle);

    const runtime = runtimeFromWindow();
    expect(runtime).toBeDefined();

    runtime!.init({
      autoScale: false,
      tool: ["console", "elements", "network", "resources", "sources", "info"],
      debug: false,
    });

    expect(runtime!.isInitialized()).toBe(true);
    expect(runtime!.get("console")).toBeDefined();
    expect(runtime!.get("elements")).toBeDefined();
    expect(runtime!.get("network")).toBeDefined();
    expect(runtime!.get("resources")).toBeDefined();
    expect(runtime!.get("sources")).toBeDefined();
    expect(runtime!.get("info")).toBeDefined();

    const root = shadowRoot();

    expect(root.querySelector("[data-roderuda-root]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-roderuda-shell-ref='entryButton']")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-roderuda-shell-ref='devtools']")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-roderuda-shell-ref='tabbar']")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-roderuda-shell-ref='tools']")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("fabrica-component-error")).toBeNull();
    expect(root.querySelector("[data-roderuda-shell-ref='tabbar']")?.textContent).not.toContain("[object Object]");

    expectStylesInjected(root);

    expect(root.querySelectorAll("[data-tool-tab]").length).toBeGreaterThanOrEqual(7);

    const tools = root.querySelector<HTMLElement>("[data-roderuda-shell-ref='tools']");
    expect(tools).toBeInstanceOf(HTMLElement);

    for (const name of ["console", "elements", "network", "resources", "sources", "info"]) {
      expectPanelMounted(root, name);
    }

    runtime!.show("console");
    expectSelectedTab(root, "console");
    expectVisiblePanel(root, "console");
    expectHiddenPanel(root, "elements");

    expect(root.querySelector("[data-console-body]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-console-list]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-console-input]")).toBeInstanceOf(HTMLElement);

    console.log("bundle console smoke");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(root.querySelector("[data-console-list]")?.textContent ?? "").toContain("bundle console smoke");

    runtime!.show("elements");
    expectSelectedTab(root, "elements");
    expectVisiblePanel(root, "elements");
    expectHiddenPanel(root, "console");

    expect(root.querySelector("[data-elements-layout]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-elements-tree]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-elements-detail]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-node-id]")).toBeInstanceOf(HTMLElement);

    const elementsPanel = root.querySelector<HTMLElement>('[data-tool="elements"]');
    expect(elementsPanel?.textContent).toContain("<html");
    expect(elementsPanel?.textContent).not.toContain("[object Object]");
    expect(elementsPanel?.querySelector("fabrica-component-error")).toBeNull();

    runtime!.show("network");
    expectSelectedTab(root, "network");
    expectVisiblePanel(root, "network");

    expect(root.querySelector("[data-network-layout]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-network-list]")).toBeInstanceOf(HTMLElement);
    expect(root.querySelector("[data-network-detail]")).toBeInstanceOf(HTMLElement);

    runtime!.show("resources");
    expectSelectedTab(root, "resources");
    expectVisiblePanel(root, "resources");

    expect(root.querySelector("[data-resources-body]")).toBeInstanceOf(HTMLElement);
    expect(root.textContent).toContain("Local Storage");
    expect(root.textContent).toContain("Session Storage");
    expect(root.textContent).toContain("Images");

    runtime!.show("info");
    expectSelectedTab(root, "info");
    expectVisiblePanel(root, "info");

    expect(root.textContent).toContain("Page information");
    expect(root.textContent).toContain("Location");
    expect(root.textContent).toContain("User Agent");

    const devtoolsDock = root.querySelector<HTMLElement>("[data-roderuda-shell-ref='devtools']");
    const activePanel = root.querySelector<HTMLElement>('[data-tool="info"]');

    expect(devtoolsDock).toBeInstanceOf(HTMLElement);
    expect(activePanel).toBeInstanceOf(HTMLElement);

    const dockOverflowY = getComputedStyle(devtoolsDock!).overflowY;
    const panelOverflow = getComputedStyle(activePanel!).overflow;

    expect(["hidden", "clip", "visible", ""]).toContain(dockOverflowY);
    expect(["hidden", "clip"]).toContain(panelOverflow);
  }, 30000);
});
