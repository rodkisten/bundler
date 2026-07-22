import { describe, expect, it } from "vitest";
import { computePopupPlacement } from "@rodkisten/maquina/popup";

function renderedHeight(
  preferredHeight: number,
  maxHeight: number,
): number {
  return Math.min(preferredHeight, maxHeight);
}

describe("Maquina completion popup placement", () => {
  it("flips above the caret near the bottom edge", () => {
    const preferredHeight = 220;
    const placement = computePopupPlacement({
      anchor: {
        left: 180,
        top: 430,
        height: 24,
      },
      bounds: {
        left: 8,
        top: 8,
        right: 312,
        bottom: 472,
      },
      preferredWidth: 300,
      preferredHeight,
    });

    expect(placement.side).toBe("above");
    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(
      placement.top +
        renderedHeight(preferredHeight, placement.maxHeight),
    ).toBeLessThanOrEqual(472);
  });

  it("never exceeds narrow visual viewport bounds", () => {
    const preferredHeight = 400;
    const placement = computePopupPlacement({
      anchor: {
        left: 290,
        top: 220,
        height: 24,
      },
      bounds: {
        left: 12,
        top: 20,
        right: 308,
        bottom: 460,
      },
      preferredWidth: 600,
      preferredHeight,
    });
    const height = renderedHeight(
      preferredHeight,
      placement.maxHeight,
    );

    expect(placement.left).toBeGreaterThanOrEqual(12);
    expect(placement.left + placement.width).toBeLessThanOrEqual(308);
    expect(placement.top).toBeGreaterThanOrEqual(20);
    expect(placement.top + height).toBeLessThanOrEqual(460);
  });

  it("uses the space below when it can fit the popup", () => {
    const placement = computePopupPlacement({
      anchor: {
        left: 40,
        top: 40,
        height: 24,
      },
      bounds: {
        left: 8,
        top: 8,
        right: 400,
        bottom: 700,
      },
      preferredWidth: 260,
      preferredHeight: 200,
    });

    expect(placement.side).toBe("below");
    expect(placement.top).toBeGreaterThan(64);
  });
});
