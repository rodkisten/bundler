// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElementHighlighter } from "./highlighter";

describe("ElementHighlighter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  it("removes a selection highlight automatically", () => {
    const element = document.createElement("main");
    document.body.appendChild(element);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(8, 12, 320, 180));

    const highlighter = new ElementHighlighter();
    highlighter.highlight(element);

    expect(document.querySelector(".__roderuda-overlay__")).not.toBeNull();
    vi.advanceTimersByTime(849);
    expect(document.querySelector(".__roderuda-overlay__")).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector(".__roderuda-overlay__")).toBeNull();
  });

  it("never highlights the devtools host or its descendants", () => {
    const host = document.createElement("div");
    const child = document.createElement("button");
    host.appendChild(child);
    document.body.appendChild(host);

    new ElementHighlighter(host).highlight(child);

    expect(document.querySelector(".__roderuda-overlay__")).toBeNull();
  });

  it("does not recursively inspect its own overlay", () => {
    const element = document.createElement("main");
    document.body.appendChild(element);
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(0, 0, 320, 180));

    const highlighter = new ElementHighlighter();
    highlighter.highlight(element, true, 0);
    const overlayChild = document.querySelector<HTMLElement>(".__roderuda-overlay__ > div");
    expect(overlayChild).not.toBeNull();

    highlighter.highlight(overlayChild!, true, 0);

    expect(document.querySelectorAll(".__roderuda-overlay__")).toHaveLength(1);
    highlighter.destroy();
  });
});

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
