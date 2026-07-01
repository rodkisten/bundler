// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync } from "../../broto";
import { Console, consoleStyleArtifacts } from "./console";
import type {
  DevtoolsControllerLike,
  SettingsLike,
  ToolContext,
  ToolLike,
} from "../types";

function createContext(container: HTMLElement): ToolContext {
  const settings = {
    name: "settings",
    active: false,
    init: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
    registerText: vi.fn(() => "text"),
    registerSeparator: vi.fn(() => "separator"),
    registerButton: vi.fn(() => "button"),
    registerSwitch: vi.fn(() => "switch"),
    registerSelect: vi.fn(() => "select"),
    registerRange: vi.fn(() => "range"),
    removeSetting: vi.fn(),
  } satisfies SettingsLike;

  const devtools = {} as DevtoolsControllerLike;
  Object.assign(devtools, {
    show: vi.fn(() => devtools),
    hide: vi.fn(() => devtools),
    toggle: vi.fn(() => devtools),
    add: vi.fn((_tool: ToolLike) => devtools),
    remove: vi.fn((_name: string) => devtools),
    get: vi.fn(() => undefined),
    showTool: vi.fn((_name: string) => devtools),
    notify: vi.fn(),
    getRoot: vi.fn(() => container),
    isVisible: vi.fn(() => true),
  });

  return {
    root: container,
    shadowRoot: null,
    container,
    devtools,
    settings,
    notify: vi.fn(),
    prompt: vi.fn(async () => null),
    confirm: vi.fn(async () => true),
  };
}

function settle(): Promise<void> {
  flushSync();
  return Promise.resolve().then(() => {
    flushSync();
  });
}

describe("RodEruda Fabrica console panel", () => {
  let container: HTMLElement;
  let consoleTool: Console;
  let context: ToolContext;

  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    container = document.createElement("section");
    document.body.append(container);

    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(
        () => callback(performance.now()),
        0,
      ),
    });

    consoleTool = new Console({ name: "console-test" });
    consoleTool.config.patch({
      overrideConsole: false,
      catchGlobalErr: false,
      asyncRender: false,
    });
    context = createContext(container);
    consoleTool.init(container, context);
    flushSync();
  });

  afterEach(() => {
    consoleTool.destroy();
    vi.restoreAllMocks();
  });

  it("exports the static Cipó artifacts used by the ShadowRoot injector", () => {
    expect(consoleStyleArtifacts.length).toBeGreaterThan(10);
    expect(consoleStyleArtifacts.every((artifact) => artifact.kind === "cipo.css")).toBe(true);
    expect(consoleStyleArtifacts.some((artifact) => artifact.compiledCss.includes("data-level=\"warn\""))).toBe(true);
  });

  it("mounts the shell through named Fabrica styled components", () => {
    expect(container.querySelector("[data-console-body]")).toBeInstanceOf(HTMLElement);
    expect(container.querySelector("[data-console-list]")).toBeInstanceOf(HTMLElement);
    expect(container.querySelector("[data-console-input]")).toBeInstanceOf(HTMLTextAreaElement);
    expect(container.querySelector("[data-console-filter]")).toBeInstanceOf(HTMLInputElement);

    const body = container.querySelector<HTMLElement>("[data-console-body]");
    expect(body?.className).toContain("roderuda-console");
    expect(body?.className).toMatch(/rd-(?:s|width|height)-/);
  });

  it("renders records reactively and groups consecutive equal values", async () => {
    consoleTool.log("hello", 42);
    await settle();

    let rows = container.querySelectorAll<HTMLElement>(".roderuda-console-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("hello");
    expect(rows[0]?.textContent).toContain("42");

    consoleTool.log("hello", 42);
    await settle();

    rows = container.querySelectorAll<HTMLElement>(".roderuda-console-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector(".roderuda-console-repeat")?.textContent).toBe("2");
  });

  it("filters through @input and toggles levels through @click", async () => {
    consoleTool.info("visible info");
    consoleTool.error("hidden error");
    await settle();

    const filter = container.querySelector<HTMLInputElement>("[data-console-filter]")!;
    filter.value = "visible";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    let rows = container.querySelectorAll<HTMLElement>(".roderuda-console-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("visible info");

    filter.value = "";
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const errorLevel = container.querySelector<HTMLButtonElement>('[data-level="error"]')!;
    errorLevel.click();
    await settle();

    rows = container.querySelectorAll<HTMLElement>(".roderuda-console-row");
    expect(Array.from(rows).some((row) => row.dataset.level === "error")).toBe(false);
    expect(errorLevel.getAttribute("aria-pressed")).toBe("false");
  });

  it("renders table records with Fabrica repeat directives", async () => {
    consoleTool.table([
      { name: "Cipó", score: 10 },
      { name: "Fábrica", score: 11 },
    ]);
    await settle();

    const table = container.querySelector<HTMLTableElement>(".roderuda-table");
    expect(table).not.toBeNull();
    expect(Array.from(table!.querySelectorAll("th")).map((cell) => cell.textContent)).toEqual([
      "(index)",
      "name",
      "score",
    ]);
    expect(table!.textContent).toContain("Fábrica");
  });

  it("executes JavaScript from the textarea and keeps command history", async () => {
    const input = container.querySelector<HTMLTextAreaElement>("[data-console-input]")!;
    input.value = "20 + 22";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));

    await settle();
    await settle();

    const rows = Array.from(
      container.querySelectorAll<HTMLElement>(".roderuda-console-row"),
    );
    expect(rows.some((row) => row.dataset.level === "command" && row.textContent?.includes("20 + 22"))).toBe(true);
    expect(rows.some((row) => row.dataset.level === "result" && row.textContent?.includes("42"))).toBe(true);
    expect(input.value).toBe("");

    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    }));
    await settle();
    expect(input.value).toBe("20 + 22");
  });

  it("reacts to configuration without remounting the editor input", async () => {
    const input = container.querySelector<HTMLTextAreaElement>("[data-console-input]")!;
    consoleTool.config.set("jsExecution", false);
    await settle();

    expect(container.querySelector("[data-console-input-wrap]")?.classList.contains("roderuda-hidden")).toBe(true);
    expect(container.querySelector<HTMLTextAreaElement>("[data-console-input]")).toBe(input);

    consoleTool.config.set("jsExecution", true);
    consoleTool.config.set("displayExtraInfo", true);
    consoleTool.warn("timestamped");
    await settle();

    expect(container.querySelector("[data-console-input-wrap]")?.classList.contains("roderuda-hidden")).toBe(false);
    expect(container.querySelector(".roderuda-console-time")).not.toBeNull();
  });
});
