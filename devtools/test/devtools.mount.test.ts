// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { polyfillBrowserApis } from "./_tests.setup";
import devtools from "@rodkisten/devtools";

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


  it("opens and closes when the floating DevTools button is clicked", () => {
    devtools.init({ autoScale: false, tool: ["console"] });

    const root = document.querySelector<HTMLElement>("#roderuda")?.shadowRoot;
    const entry = root?.querySelector<HTMLButtonElement>(
      "[data-roderuda-shell-ref='entryButton']",
    );
    const dock = root?.querySelector<HTMLElement>(
      "[data-roderuda-shell-ref='devtools']",
    );

    expect(entry).toBeInstanceOf(HTMLButtonElement);
    expect(dock).toBeInstanceOf(HTMLElement);
    expect(devtools.get()?.isVisible()).toBe(false);
    expect(dock?.dataset.active).toBe("false");

    entry?.click();

    expect(devtools.get()?.isVisible()).toBe(true);
    expect(
      root?.querySelector<HTMLElement>("[data-roderuda-shell-ref='devtools']")?.dataset.active,
    ).toBe("true");

    entry?.click();

    expect(devtools.get()?.isVisible()).toBe(false);
    expect(
      root?.querySelector<HTMLElement>("[data-roderuda-shell-ref='devtools']")?.dataset.active,
    ).toBe("false");
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
    const emittedLayoutClass = layout?.className
      .split(/\s+/)
      .find((className) => styleText.includes(`.${className}`));

    expect(emittedLayoutClass).toBeDefined();
    expect(styleText).toMatch(/(?:\.roderuda-tools|overflow)/);
    expect(styleText).toContain("var(--rd-colors-background)");
    expect(styleText).not.toMatch(/(?:^|[^A-Za-z0-9_-])\$background\b/);
    expect(styleText).not.toMatch(/(?:^|[^A-Za-z0-9_-])\$border\b/);
    expect(root?.querySelector("#cipo-runtime-style, style[data-cipo='runtime']")).toBeInstanceOf(HTMLStyleElement);
    expect(document.getElementById("cipo-runtime-style")).toBeNull();

    const firstTab = root?.querySelector<HTMLElement>("[data-tool-tab]");
    expect(firstTab?.querySelector("svg.roderuda-lucide-icon")).toBeInstanceOf(SVGSVGElement);
    expect(firstTab?.textContent).not.toContain("[object Object]");

    devtools.show("elements");
    const firstNode = root?.querySelector<HTMLElement>("[data-node-id]");
    expect(firstNode).toBeInstanceOf(HTMLElement);
    expect(() => {
      firstNode?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 24, clientY: 32 }));
    }).not.toThrow();

    const menu = root?.querySelector<HTMLElement>("[data-elements-menu]");
    expect(menu).toBeInstanceOf(HTMLElement);
    expect(typeof menu?.getBoundingClientRect).toBe("function");
    expect(menu?.style.left).toMatch(/px$/);
    expect(menu?.style.top).toMatch(/px$/);

    const treeText = root?.querySelector<HTMLElement>("[data-elements-tree]")?.textContent ?? "";
    expect(treeText).toContain("<html");
    expect(treeText).not.toContain("&lt;html");
    expect(treeText).not.toContain("&gt;");
  });
});
