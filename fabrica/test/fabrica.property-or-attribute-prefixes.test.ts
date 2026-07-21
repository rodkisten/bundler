/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { applyProps } from "../bindings/props.js";

describe("Fábrica object prop prefixes", () => {
  it("applies property, boolean, and conditional-class prefixes", () => {
    const input = document.createElement("input");

    applyProps(input, {
      ".value": "fixture",
      ".spellcheck": "false",
      "?disabled": true,
      "class:active": true,
    });

    expect(input.value).toBe("fixture");
    expect(input.spellcheck).toBe(false);
    expect(input.disabled).toBe(true);
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.classList.contains("active")).toBe(true);

    applyProps(input, {
      ".spellcheck": "true",
      "?disabled": false,
      "class:active": false,
    });

    expect(input.spellcheck).toBe(true);
    expect(input.disabled).toBe(false);
    expect(input.hasAttribute("disabled")).toBe(false);
    expect(input.classList.contains("active")).toBe(false);
  });
});
