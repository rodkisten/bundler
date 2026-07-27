// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { polyfillBrowserApis } from "./_tests.setup";
import fs from "node:fs";
import path from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
import devtools, { type RodDevtoolsApi } from "@rodkisten/devtools";
import type { DevtoolsBrowserGlobal } from "../browser-entry";

const bundlePath = path.resolve(process.cwd(), "dist/devtools.iife.js");

type DevtoolsWindow = Window & {
  DevTools?: DevtoolsBrowserGlobal;
  __ROD_DEVTOOLS__?: RodDevtoolsApi;
};

function browserGlobalFromWindow(): DevtoolsBrowserGlobal | undefined {
  return (window as DevtoolsWindow).DevTools;
}

function runtimeFromWindow(): RodDevtoolsApi | undefined {
  const browserGlobal = browserGlobalFromWindow();

  return browserGlobal?.api ?? browserGlobal;
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
  expect(bundle).not.toMatch(/styled(?:\$\d+)?\.[a-z]+\("Rod[A-Za-z0-9_]+".*?\.css`/s);
  expect(bundle).not.toContain("@theme {");
  expect(bundle).not.toContain("@breakpoints {");
  expect(bundle).not.toContain("theme-validation: warn");
  // The public runtime may still contain the configureFromCss implementation.
  // What must disappear from production is the raw CSS-first configuration DSL.
  // Production class and component identifiers are intentionally eligible for
  // compaction/mangling. Runtime smoke assertions below prove that every panel
  // still mounts, so the bundle check should not require debug display names.
  // TSDoc examples may contain `.css`` text; executable Rod styled templates must not.
}

function expectStylesInjected(root: ShadowRoot): void {
  const styleText = Array.from(root.querySelectorAll("style"))
    .map((style) => style.textContent ?? "")
    .join("\n");

  expect(styleText.length).toBeGreaterThan(1000);
  expect(styleText).toContain("var(--rd-colors-");
  const compiledClass = Array.from(root.querySelectorAll<HTMLElement>("[class]"))
    .flatMap((element) => Array.from(element.classList))
    .find((className) => className.startsWith("rd-") && styleText.includes(`.${className}`));

  expect(compiledClass).toBeDefined();
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
    expect(fs.existsSync(bundlePath)).toBe(true);

    const bundle = fs.readFileSync(bundlePath, "utf8");

    expectCompiledDevtoolsBundle(bundle);

    window.eval(bundle);

    const browserGlobal = browserGlobalFromWindow();
    const runtime = runtimeFromWindow();

    expect(browserGlobal).toBeDefined();
    expect(runtime).toBeDefined();
    expect(typeof browserGlobal?.init).toBe("function");
    expect(typeof browserGlobal?.destroy).toBe("function");
    expect(typeof browserGlobal?.show).toBe("function");
    expect(typeof browserGlobal?.hide).toBe("function");
    expect(browserGlobal?.api).toBe(runtime);
    expect(browserGlobal?.default).toBe(runtime);
    expect(browserGlobal?.devtools).toBe(runtime);
    expect(browserGlobal?.eruda).toBe(runtime);
    expect((window as DevtoolsWindow).__ROD_DEVTOOLS__).toBe(browserGlobal);

    const initialized = browserGlobal!.init({
      autoScale: false,
      tool: ["console", "elements", "network", "resources", "sources", "info"],
      debug: false,
    });

    expect(initialized).toBe(browserGlobal);
    expect(browserGlobal!.isInitialized()).toBe(true);
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

    const entry = root.querySelector<HTMLButtonElement>(
      "[data-roderuda-shell-ref='entryButton']",
    );
    const dock = root.querySelector<HTMLElement>(
      "[data-roderuda-shell-ref='devtools']",
    );

    expect(entry).toBeInstanceOf(HTMLButtonElement);
    expect(dock).toBeInstanceOf(HTMLElement);
    expect(runtime!.get()?.isVisible()).toBe(false);
    expect(dock?.dataset.active).toBe("false");

    // Exercise the production IIFE path. EntryBtn owns the native click and
    // must forward it to the controller instead of swallowing the activation.
    entry?.click();
    expect(runtime!.get()?.isVisible()).toBe(true);
    expect(
      root.querySelector<HTMLElement>("[data-roderuda-shell-ref='devtools']")?.dataset.active,
    ).toBe("true");

    entry?.click();
    expect(runtime!.get()?.isVisible()).toBe(false);
    expect(
      root.querySelector<HTMLElement>("[data-roderuda-shell-ref='devtools']")?.dataset.active,
    ).toBe("false");

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
    const runtimeCss = root.querySelector<HTMLStyleElement>(
      "#cipo-runtime-style, style[data-cipo='runtime']",
    )?.textContent ?? "";
    const panelHasOverflowRule = Array.from(activePanel!.classList).some(
      (className) => new RegExp(
        `\\.${className.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*\\{[^}]*overflow\\s*:\\s*hidden`,
      ).test(runtimeCss),
    );

    expect(["hidden", "clip", "visible", ""]).toContain(dockOverflowY);
    // jsdom does not consistently project stylesheet rules into computed overflow.
    // Verify the compiled class actually present on the mounted panel instead.
    expect(panelHasOverflowRule).toBe(true);
  }, 30000);
});
