// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

const mocks = vi.hoisted(() => ({
  mountCodeEditor: vi.fn(() => ({
    getValue: vi.fn(() => ""),
    setValue: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock("../core/code-editor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/code-editor")>();
  return {
    ...actual,
    mountCodeEditor: mocks.mountCodeEditor,
  };
});

import { Sources } from "./sources";

function createContext(container: HTMLElement): ToolContext {
  const root = document.createElement("div");
  root.append(container);
  document.body.append(root);

  return {
    root,
    shadowRoot: null,
    container,
    devtools: {
      show: vi.fn().mockReturnThis(),
      hide: vi.fn().mockReturnThis(),
      showTool: vi.fn().mockReturnThis(),
      get: vi.fn(),
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
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Sources panel", () => {
  let tool: Sources | null = null;

  beforeEach(() => {
    document.body.replaceChildren();
    mocks.mountCodeEditor.mockClear();
  });

  afterEach(() => {
    tool?.destroy();
    tool = null;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders the Fabrica shell and text sources without stringifying components", async () => {
    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "text", value: "plain source", title: "Fixture" });
    await flush();

    expect(container.querySelector("[data-sources-body]")).toBeInstanceOf(HTMLElement);
    expect(container.textContent).toContain("plain source");
    expect(container.textContent).not.toContain("[object Object]");
    expect(container.querySelector("fabrica-component-error")).toBeNull();
  });

  it("mounts CodeMirror into a real styled host and forwards editor options", async () => {
    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.config.set("showLineNum", false);
    tool.config.set("wrapLines", true);
    tool.set({ type: "javascript", value: "const answer = 42;", title: "fixture.js" });
    await flush();

    expect(mocks.mountCodeEditor).toHaveBeenCalled();
    const options = mocks.mountCodeEditor.mock.calls.at(-1)?.[0];
    expect(options?.parent).toBeInstanceOf(HTMLElement);
    expect(options?.parent.isConnected).toBe(true);
    expect(options?.lineNumbers).toBe(false);
    expect(options?.lineWrapping).toBe(true);
    expect(options?.language).toBe("javascript");
    expect(container.textContent).not.toContain("[object Object]");
  });

  it("renders object values as expandable DOM instead of object text", async () => {
    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "object", value: { nested: { value: 7 } }, title: "Object" });
    await flush();

    expect(container.querySelector("details.roderuda-object")).toBeInstanceOf(HTMLDetailsElement);
    expect(container.textContent).not.toContain("[object Object]");
  });
});
