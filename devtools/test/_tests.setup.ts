// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

export function polyfillBrowserApis(): void {
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


const hoistedMocks = vi.hoisted(() => {
  const copyText = vi.fn<(...args: unknown[]) => Promise<void>>(
    async () => undefined,
  );

  const restoreEventRegistry = vi.fn();
  const installEventListenerRegistry = vi.fn(
    () => restoreEventRegistry,
  );

  const getEventListeners = vi.fn(() => ({
    click: [
      {
        listener: (() => undefined) as EventListener,
        options: false,
      },
    ],
  }));

  const highlighterInstances: Array<{
    highlight: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    copyText,
    restoreEventRegistry,
    installEventListenerRegistry,
    getEventListeners,
    highlighterInstances,
    mountCodeEditor: vi.fn(() => ({
      getValue: vi.fn(() => ""),
      setValue: vi.fn(),
      focus: vi.fn(),
      destroy: vi.fn(),
    })),
  };
});

export function getMocks(): typeof hoistedMocks {
  return hoistedMocks;
}

vi.mock("@rodkisten/devtools/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rodkisten/devtools/utils")>();

  return {
    ...actual,
    copyText: hoistedMocks.copyText,
  };
});

vi.mock("@rodkisten/devtools/core-event-listeners", () => ({
  getEventListeners: hoistedMocks.getEventListeners,
  installEventListenerRegistry: hoistedMocks.installEventListenerRegistry,
}));


vi.mock("@rodkisten/devtools/core-code-editor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rodkisten/devtools/core-code-editor")>();
  return {
    ...actual,
    mountCodeEditor: hoistedMocks.mountCodeEditor,
  };
});

vi.mock("@rodkisten/devtools/core-highlighter", () => ({
  ElementHighlighter: class ElementHighlighter {
    readonly highlight = vi.fn();
    readonly hide = vi.fn();
    readonly destroy = vi.fn(() => this.hide());

    constructor(_host?: HTMLElement) {
      hoistedMocks.highlighterInstances.push(this);
    }
  },
}));
