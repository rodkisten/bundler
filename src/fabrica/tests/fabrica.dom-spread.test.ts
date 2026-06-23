// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { applySpreadValue, cleanupSpreadState } from "../dom-spread";

describe("Fabrica DOM spread helpers", () => {
  it("applies attributes, dataset, classes, style and events", () => {
    const button = document.createElement("button");
    const onClick = vi.fn();
    const state = applySpreadValue(button, {
      class: "primary",
      style: "color:red",
      attrs: { title: "Save" },
      dataset: { testId: "save" },
      onClick,
    }, { keys: new Set(), events: new Map(), refCleanup: null });

    button.click();
    expect(button.className).toBe("primary");
    expect(button.getAttribute("style")).toBe("color:red");
    expect(button.title).toBe("Save");
    expect(button.dataset.testId).toBe("save");
    expect(onClick).toHaveBeenCalledTimes(1);

    cleanupSpreadState(button, state);
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("diffs stale props and event listeners", () => {
    const button = document.createElement("button");
    const first = vi.fn();
    const second = vi.fn();
    const state = applySpreadValue(button, { disabled: true, onClick: first }, { keys: new Set(), events: new Map(), refCleanup: null });
    const next = applySpreadValue(button, { onClick: second }, state);

    expect(button.hasAttribute("disabled")).toBe(false);
    button.click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    cleanupSpreadState(button, next);
  });
});
