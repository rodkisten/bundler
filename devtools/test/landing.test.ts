// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  createLandingBookmarklet,
  createLandingInitOptions,
  createLandingTokenCss,
  createLandingUserscript,
  DEFAULT_LANDING_STATE,
  DEFAULT_LANDING_TOKENS,
  normalizeInjectableScriptUrl,
  parseLandingState,
  resolveInjectableDevtoolsApi,
  selectedLandingPanels,
  serializeLandingState,
} from "@rodkisten/devtools/landing.functions";

describe("DevTools landing configuration", () => {
  it("creates strongly shaped init options from the visual configuration", () => {
    const options = createLandingInitOptions({
      ...DEFAULT_LANDING_STATE,
      displaySize: 64,
      maxLogs: 900,
      sourceWrapLines: false,
    });

    expect(options.tool).toEqual([
      "console",
      "elements",
      "network",
      "resources",
      "sources",
      "info",
      "snippets",
    ]);
    expect(options.defaults?.displaySize).toBe(64);
    expect(options.config?.panels?.console?.maxLogNum).toBe("900");
    expect(options.config?.panels?.sources?.wrapLines).toBe(false);
  });

  it("keeps Console as a safe fallback when every panel is unchecked", () => {
    expect(selectedLandingPanels({
      console: false,
      elements: false,
      network: false,
      resources: false,
      sources: false,
      info: false,
      snippets: false,
    })).toEqual(["console"]);
  });

  it("round-trips persisted landing state without losing panel flags", () => {
    const state = {
      ...DEFAULT_LANDING_STATE,
      loadEruda: true,
      panels: {
        ...DEFAULT_LANDING_STATE.panels,
        resources: false,
      },
    };

    expect(parseLandingState(serializeLandingState(state))).toEqual(state);
  });

  it("rejects executable and data protocols for injected script URLs", () => {
    expect(() => normalizeInjectableScriptUrl("javascript:alert(1)")).toThrow(/Unsupported script protocol/);
    expect(() => normalizeInjectableScriptUrl("data:text/javascript,alert(1)")).toThrow(/Unsupported script protocol/);
    expect(normalizeInjectableScriptUrl("https://rod.migos.club/bundler/devtools.iife.js")).toContain("devtools.iife.js");
  });

  it("generates a complete userscript and bookmarklet", () => {
    const state = { ...DEFAULT_LANDING_STATE, loadEruda: true };
    const userscript = createLandingUserscript(state);
    const bookmarklet = createLandingBookmarklet(state);

    expect(userscript).toContain("// ==UserScript==");
    expect(userscript).toContain("devtools.iife.js");
    expect(userscript).toContain("eruda@latest/eruda.js");
    expect(bookmarklet.startsWith("javascript:")).toBe(true);
  });

  it("resolves the API through common IIFE export shapes", () => {
    const api = {
      init: () => api,
      destroy: () => api,
      show: () => api,
      hide: () => api,
    };

    expect(resolveInjectableDevtoolsApi({ DevTools: { api } })).toBe(api);
    expect(resolveInjectableDevtoolsApi({ DevTools: { default: { api } } })).toBe(api);
    expect(resolveInjectableDevtoolsApi({ Rod: { DevTools: { api } } })).toBe(api);
  });

  it("exports the public design token contract as CSS custom properties", () => {
    const css = createLandingTokenCss(DEFAULT_LANDING_TOKENS);
    expect(css).toContain("--landing-color-accent: #c6ff00");
    expect(css).toContain("--landing-shadow-offset: 10px");
    expect(css).toContain("--landing-noise-opacity: 0.08");
  });
});
