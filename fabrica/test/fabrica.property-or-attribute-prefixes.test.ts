/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import {
  setPropertyOrAttribute,
} from "../bindings/property-or-attribute";

describe("Fábrica object prop prefixes", () => {
  it("preserves false data and aria values as strings", () => {
    const button = document.createElement("button");

    setPropertyOrAttribute(button, "data-active", false);
    setPropertyOrAttribute(button, "aria-expanded", false);

    expect(button.dataset.active).toBe("false");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("applies property, boolean, and conditional-class prefixes", () => {
    const input = document.createElement("input");

    setPropertyOrAttribute(input, ".spellcheck", "false");
    setPropertyOrAttribute(input, "?disabled", true);
    setPropertyOrAttribute(input, "class:active", true);

    expect(input.spellcheck).toBe(false);
    expect(input.disabled).toBe(true);
    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.classList.contains("active")).toBe(true);
  });
});
