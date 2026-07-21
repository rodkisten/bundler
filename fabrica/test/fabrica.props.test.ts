/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { rawHtml } from "@rodkisten/fabrica";
import { applyProps } from "../bindings/props.js";

describe("Fabrica object prop patches", () => {
  it("reconciles class map keys across repeated patches", () => {
    const element = document.createElement("div");

    applyProps(element, {
      class: { active: true, stale: true },
    });
    applyProps(element, {
      class: { active: true },
    });

    expect(element.classList.contains("active")).toBe(true);
    expect(element.classList.contains("stale")).toBe(false);
  });

  it("reconciles style map keys across repeated patches", () => {
    const element = document.createElement("div");

    applyProps(element, {
      style: { color: "red", marginTop: "10px" },
    });
    applyProps(element, {
      style: { color: "blue" },
    });

    expect(element.style.color).toBe("blue");
    expect(element.style.marginTop).toBe("");
  });

  it("reuses special-attribute state for nested data reconciliation", () => {
    const element = document.createElement("div");

    applyProps(element, {
      ":data": { activePanel: "sources", staleKey: "remove-me" },
    });
    applyProps(element, {
      ":data": { activePanel: "console" },
    });

    expect(element.dataset.activePanel).toBe("console");
    expect(element.hasAttribute("data-stale-key")).toBe(false);
  });

  it("requires an explicit raw HTML wrapper for HTML sinks", () => {
    const element = document.createElement("div");

    expect(() => {
      applyProps(element, { html: "<strong>unsafe</strong>" });
    }).toThrow(TypeError);

    applyProps(element, {
      html: rawHtml("<strong>explicit</strong>"),
    });

    expect(element.innerHTML).toBe("<strong>explicit</strong>");
  });
});
