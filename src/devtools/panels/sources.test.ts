// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkRecord, ToolContext } from "../types";

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

type GlobalWithUserscriptRequest = typeof globalThis & {
  GM_xmlhttpRequest?: (details: {
    onload(response: { status: number; responseText: string }): void;
  }) => unknown;
};

function createContext(
  container: HTMLElement,
  networkRecords: readonly NetworkRecord[] = [],
): ToolContext {
  const root = document.createElement("div");
  root.append(container);
  document.body.append(root);

  const network = {
    name: "network",
    active: false,
    init: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
    requests: vi.fn(() => [...networkRecords]),
  };

  return {
    root,
    shadowRoot: null,
    container,
    devtools: {
      show: vi.fn().mockReturnThis(),
      hide: vi.fn().mockReturnThis(),
      showTool: vi.fn().mockReturnThis(),
      get: vi.fn((name: string) => name === "network" ? network : undefined),
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
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function lastEditorOptions(): Parameters<typeof mocks.mountCodeEditor>[0] {
  const options = mocks.mountCodeEditor.mock.calls.at(-1)?.[0];
  expect(options).toBeDefined();
  return options!;
}

function networkRecord(url: string, responseBody: string): NetworkRecord {
  return {
    id: "request-1",
    kind: "fetch",
    method: "GET",
    url,
    requestHeaders: [],
    responseHeaders: [],
    responseBody,
    status: 200,
    startTime: 0,
    state: "finished",
  };
}

describe("Sources panel", () => {
  let tool: Sources | null = null;

  beforeEach(() => {
    document.body.replaceChildren();
    mocks.mountCodeEditor.mockClear();
    vi.unstubAllGlobals();
    delete (globalThis as GlobalWithUserscriptRequest).GM_xmlhttpRequest;
  });

  afterEach(() => {
    tool?.destroy();
    tool = null;
    document.body.replaceChildren();
    delete (globalThis as GlobalWithUserscriptRequest).GM_xmlhttpRequest;
    vi.restoreAllMocks();
  });

  it("mounts only the Fabrica shell while inactive and defers expensive source work", async () => {
    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "javascript", value: "const deferred = true;", title: "deferred.js" });
    await flush();

    expect(container.querySelector("[data-sources-body]")).toBeInstanceOf(HTMLElement);
    expect(mocks.mountCodeEditor).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("[object Object]");
  });

  it("highlights plain text through the editor instead of rendering an unstyled pre block", async () => {
    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "text", value: "plain source", title: "Fixture" });
    tool.show();
    await flush();

    const options = lastEditorOptions();
    expect(options.value).toBe("plain source");
    expect(options.language).toBe("text");
    expect(options.parent).toBeInstanceOf(HTMLElement);
    expect(options.parent.isConnected).toBe(true);
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
    tool.show();
    await flush();

    const options = lastEditorOptions();
    expect(options.parent).toBeInstanceOf(HTMLElement);
    expect(options.parent.isConnected).toBe(true);
    expect(options.lineNumbers).toBe(false);
    expect(options.lineWrapping).toBe(true);
    expect(options.language).toBe("javascript");
    expect(options.value).toContain("const answer = 42");
    expect(container.textContent).not.toContain("[object Object]");
  });

  it("renders object values as expandable DOM instead of object text", async () => {
    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "object", value: { nested: { value: 7 } }, title: "Object" });
    tool.show();
    await flush();

    expect(container.querySelector("details.roderuda-object")).toBeInstanceOf(HTMLDetailsElement);
    expect(container.textContent).not.toContain("[object Object]");
  });

  it("opens captured cross-origin JavaScript from the Network panel without fetching it again", async () => {
    const url = "https://cdn.example.test/app.js";
    const container = document.createElement("section");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    tool = new Sources();
    tool.init(container, createContext(container, [networkRecord(url, "window.answer = 42;")]));
    tool.set({ type: "javascript", value: url, url, title: url });
    tool.show();
    await flush();

    const options = lastEditorOptions();
    expect(options.language).toBe("javascript");
    expect(options.value).toContain("window.answer = 42");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses a userscript cross-origin request when browser fetch is blocked by CORS", async () => {
    const url = "https://cdn.example.test/theme.css";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    (globalThis as GlobalWithUserscriptRequest).GM_xmlhttpRequest = (details) => {
      queueMicrotask(() => details.onload({ status: 200, responseText: "body { color: red; }" }));
      return undefined;
    };

    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "css", value: url, url, title: url });
    tool.show();
    await flush();

    const options = lastEditorOptions();
    expect(options.language).toBe("css");
    expect(options.value).toContain("color: red");
    expect(options.value).not.toContain("Unable to load");
  });

  it("keeps the requested syntax highlighting and shows a readable diagnostic when every loader fails", async () => {
    const url = "https://cdn.example.test/missing.js";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS blocked")));

    const container = document.createElement("section");
    tool = new Sources();
    tool.init(container, createContext(container));
    tool.set({ type: "javascript", value: url, url, title: url });
    tool.show();
    await flush();

    const options = lastEditorOptions();
    expect(options.language).toBe("javascript");
    expect(options.value).toContain("RodEruda could not read this resource");
    expect(options.value).toContain(url);
    expect(options.value).toContain("fetch: CORS blocked");
    expect(container.textContent).not.toContain("Unable to load");
  });
});
