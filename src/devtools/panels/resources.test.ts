// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SourcePayload, ToolContext } from "../types";
import { Resources } from "./resources";

function createFixture(): {
  tool: Resources;
  container: HTMLElement;
  sourcesSet: ReturnType<typeof vi.fn>;
  showTool: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement("section");
  const root = document.createElement("div");
  root.append(container);
  document.body.append(root);

  const sourcesSet = vi.fn();
  const sources = {
    name: "sources",
    active: false,
    init: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
    set: sourcesSet,
  };
  const showTool = vi.fn();

  const context = {
    root,
    shadowRoot: null,
    container,
    devtools: {
      show: vi.fn().mockReturnThis(),
      hide: vi.fn().mockReturnThis(),
      showTool,
      get: vi.fn((name: string) => name === "sources" ? sources : undefined),
    },
    settings: {
      registerSeparator: vi.fn(),
      registerText: vi.fn(),
      registerSwitch: vi.fn(),
      registerSelect: vi.fn(),
      registerRange: vi.fn(),
      registerButton: vi.fn(),
    },
    notify: vi.fn(),
    prompt: vi.fn(),
    confirm: vi.fn(),
  } as unknown as ToolContext;

  const tool = new Resources();
  tool.init(container, context);

  return { tool, container, sourcesSet, showTool };
}

describe("Resources panel", () => {
  let tool: Resources | null = null;

  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    tool?.destroy();
    tool = null;
    vi.restoreAllMocks();
  });

  it("defers page-wide resource discovery until the panel becomes active", () => {
    const resourceEntries = vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    const fixture = createFixture();
    tool = fixture.tool;

    expect(fixture.container.querySelector("[data-resources-body]")).toBeInstanceOf(HTMLElement);
    expect(fixture.container.textContent).not.toContain("Local Storage");
    expect(resourceEntries).not.toHaveBeenCalled();

    tool.show();

    expect(fixture.container.textContent).toContain("Local Storage");
    expect(fixture.container.textContent).toContain("Stylesheets");
    expect(fixture.container.textContent).not.toContain("[object Object]");
    expect(resourceEntries).toHaveBeenCalledWith("resource");
  });


  it("ignores unrelated page mutations and refreshes only for resource changes", async () => {
    vi.useFakeTimers();
    const resourceEntries = vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    const fixture = createFixture();
    tool = fixture.tool;
    tool.show();
    resourceEntries.mockClear();

    const unrelated = document.createElement("div");
    unrelated.textContent = "ordinary app mutation";
    document.body.append(unrelated);
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    expect(resourceEntries).not.toHaveBeenCalled();

    const image = document.createElement("img");
    image.src = "/fixture.png";
    document.body.append(image);
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    expect(resourceEntries).toHaveBeenCalledWith("resource");

    vi.useRealTimers();
  });

  it("routes external scripts to Sources with a typed payload", () => {
    const script = document.createElement("script");
    script.src = "https://cdn.example.test/application.js";
    document.head.append(script);

    const fixture = createFixture();
    tool = fixture.tool;
    tool.show();

    const link = Array.from(fixture.container.querySelectorAll<HTMLAnchorElement>("a"))
      .find((candidate) => candidate.href === script.src);
    expect(link).toBeInstanceOf(HTMLAnchorElement);

    link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(fixture.sourcesSet).toHaveBeenCalledTimes(1);
    const payload = fixture.sourcesSet.mock.calls[0]?.[0] as SourcePayload;
    expect(payload).toMatchObject({
      type: "javascript",
      value: script.src,
      url: script.src,
      title: script.src,
    });
    expect(fixture.showTool).toHaveBeenCalledWith("sources");
  });
});
