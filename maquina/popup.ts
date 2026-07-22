export interface MaquinaPopupPoint {
  readonly left: number;
  readonly top: number;
  readonly height: number;
}

export interface MaquinaPopupBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface MaquinaPopupPlacementOptions {
  readonly anchor: MaquinaPopupPoint;
  readonly bounds: MaquinaPopupBounds;
  readonly preferredWidth: number;
  readonly preferredHeight: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly gap?: number;
}

export interface MaquinaPopupPlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly side: "above" | "below";
}

/**
 * Places a completion popup inside the visible editor/viewport intersection.
 *
 * The result is independent of DOM APIs so geometry regressions can be tested
 * deterministically, including mobile visual-viewport constraints.
 */
export function computePopupPlacement(
  options: MaquinaPopupPlacementOptions,
): MaquinaPopupPlacement {
  const gap = Math.max(0, options.gap ?? 6);
  const bounds = normalizeBounds(options.bounds);
  const availableWidth = Math.max(1, bounds.right - bounds.left);
  const minWidth = Math.min(
    availableWidth,
    Math.max(1, options.minWidth ?? 220),
  );
  const maxWidth = Math.min(
    availableWidth,
    Math.max(minWidth, options.maxWidth ?? 440),
  );
  const width = clamp(
    options.preferredWidth,
    minWidth,
    maxWidth,
  );
  const anchorBottom = options.anchor.top + options.anchor.height;
  const spaceBelow = Math.max(0, bounds.bottom - anchorBottom - gap);
  const spaceAbove = Math.max(0, options.anchor.top - bounds.top - gap);
  const side = choosePopupSide(
    options.preferredHeight,
    spaceAbove,
    spaceBelow,
  );
  const availableHeight = side === "below" ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(1, availableHeight);
  const renderedHeight = Math.min(
    Math.max(1, options.preferredHeight),
    maxHeight,
  );
  const desiredTop = side === "below"
    ? anchorBottom + gap
    : options.anchor.top - gap - renderedHeight;
  const top = clamp(
    desiredTop,
    bounds.top,
    Math.max(bounds.top, bounds.bottom - renderedHeight),
  );
  const left = clamp(
    options.anchor.left,
    bounds.left,
    Math.max(bounds.left, bounds.right - width),
  );

  return {
    left,
    top,
    width,
    maxHeight,
    side,
  };
}

function choosePopupSide(
  preferredHeight: number,
  spaceAbove: number,
  spaceBelow: number,
): "above" | "below" {
  if (spaceBelow >= preferredHeight) {
    return "below";
  }

  if (spaceAbove >= preferredHeight) {
    return "above";
  }

  return spaceBelow >= spaceAbove ? "below" : "above";
}

function normalizeBounds(
  bounds: MaquinaPopupBounds,
): MaquinaPopupBounds {
  return {
    left: Math.min(bounds.left, bounds.right),
    top: Math.min(bounds.top, bounds.bottom),
    right: Math.max(bounds.left, bounds.right),
    bottom: Math.max(bounds.top, bounds.bottom),
  };
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum);
}
