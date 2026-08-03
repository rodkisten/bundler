import { isDevtoolsNode, describeNode } from "@rodkisten/devtools/utils";
import { mapArray } from "@rodkisten/nascente";

const HIGHLIGHT_DURATION = 850;
const OVERLAY_CLASS = "__roderuda-overlay__";
const INTERNAL_ATTRIBUTE = "data-roderuda-internal";

type Sides = { top: number; right: number; bottom: number; left: number };
type DOMRectLike = { left: number; top: number; width: number; height: number };

/**
 * Paint-only element highlighter.
 *
 * The host is deliberately 0×0 and every visual child is `position: fixed`.
 * There is never a viewport-sized hit-test surface, even on iOS WebKit.
 */
export class ElementHighlighter {
  private host: HTMLDivElement | null = null;
  private label: HTMLDivElement | null = null;
  private boxes: HTMLDivElement[] = [];
  private selected: Element | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private frame = 0;
  private hideTimer = 0;
  private trackingCleanup: (() => void) | null = null;
  private showLabel = true;
  private destroyed = false;

  constructor(private readonly devtoolsHost?: HTMLElement | null) {}

  highlight(element: Element, label = true, duration = HIGHLIGHT_DURATION): void {
    if (this.destroyed || !this.canHighlight(element)) return;

    this.ensure();
    if (!this.host) return;

    this.selected = element;
    this.showLabel = label;
    this.stopTracking();
    this.draw();

    if (!Number.isFinite(duration) || duration <= 0) {
      this.startTracking(element);
    }

    this.scheduleHide(duration);
  }

  hide(): void {
    this.selected = null;
    this.stopTracking();
    this.cancelScheduledDraw();
    this.cancelScheduledHide();
    this.host?.remove();
    this.host = null;
    this.label = null;
    this.boxes = [];
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
  }

  private canHighlight(element: Element): boolean {
    if (!element.isConnected) return false;
    if (isDevtoolsNode(element, this.devtoolsHost)) return false;
    if (element.closest?.(`.${OVERLAY_CLASS},[${INTERNAL_ATTRIBUTE}]`)) return false;

    const root = element.getRootNode();
    return !(root instanceof ShadowRoot && (
      root.host.classList.contains(OVERLAY_CLASS)
      || root.host.hasAttribute(INTERNAL_ATTRIBUTE)
    ));
  }

  private ensure(): void {
    if (this.host?.isConnected && this.boxes.length === 4 && this.label) return;
    this.hide();

    const host = document.createElement("div");
    host.className = OVERLAY_CLASS;
    host.setAttribute(INTERNAL_ATTRIBUTE, "highlighter");
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("role", "presentation");
    setImportant(host, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "0",
      height: "0",
      minWidth: "0",
      minHeight: "0",
      margin: "0",
      padding: "0",
      border: "0",
      overflow: "visible",
      pointerEvents: "none",
      userSelect: "none",
      WebkitUserSelect: "none",
      background: "transparent",
      zIndex: "2147483580",
      contain: "style",
    });

    const layers = [
      ["rgb(246 178 107 / 32%)", "rgb(246 178 107 / 90%)"],
      ["rgb(255 229 153 / 36%)", "rgb(255 229 153 / 90%)"],
      ["rgb(147 196 125 / 36%)", "rgb(147 196 125 / 90%)"],
      ["rgb(111 168 220 / 38%)", "rgb(111 168 220 / 92%)"],
    ] as const;

    this.boxes = mapArray(layers, ([background, outline]) => {
      const box = document.createElement("div");
      box.setAttribute("aria-hidden", "true");
      setImportant(box, {
        position: "fixed",
        display: "block",
        left: "0",
        top: "0",
        width: "0",
        height: "0",
        minWidth: "0",
        minHeight: "0",
        margin: "0",
        padding: "0",
        border: "0",
        borderRadius: "0",
        background,
        outline: `1px solid ${outline}`,
        pointerEvents: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        transform: "none",
        transition: "none",
        animation: "none",
      });
      host.appendChild(box);
      return box;
    });

    const label = document.createElement("div");
    label.setAttribute("aria-hidden", "true");
    setImportant(label, {
      position: "fixed",
      display: "none",
      left: "0",
      top: "0",
      maxWidth: "min(90vw, 520px)",
      minWidth: "0",
      minHeight: "0",
      margin: "0",
      padding: "4px 6px",
      border: "0",
      borderRadius: "4px",
      overflow: "hidden",
      color: "#fff",
      background: "#111",
      boxShadow: "0 3px 14px rgb(0 0 0 / 35%)",
      font: '11px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      pointerEvents: "none",
      userSelect: "none",
      WebkitUserSelect: "none",
      transform: "none",
      transition: "none",
      animation: "none",
    });
    host.appendChild(label);

    (document.documentElement || document.body)?.appendChild(host);
    this.host = host;
    this.label = label;
  }

  private startTracking(element: Element): void {
    const redraw = () => this.scheduleDraw();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(redraw);
      try { this.resizeObserver.observe(element); } catch { this.resizeObserver.disconnect(); this.resizeObserver = null; }
    }

    if (typeof MutationObserver !== "undefined") {
      this.mutationObserver = new MutationObserver(redraw);
      try {
        this.mutationObserver.observe(element, {
          attributes: true,
          attributeFilter: ["class", "style", "hidden", "open"],
        });
      } catch {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    }

    window.addEventListener("scroll", redraw, { capture: true, passive: true });
    window.addEventListener("resize", redraw, { passive: true });
    window.addEventListener("orientationchange", redraw, { passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", redraw, { passive: true });
    viewport?.addEventListener("scroll", redraw, { passive: true });

    this.trackingCleanup = () => {
      window.removeEventListener("scroll", redraw, true);
      window.removeEventListener("resize", redraw);
      window.removeEventListener("orientationchange", redraw);
      viewport?.removeEventListener("resize", redraw);
      viewport?.removeEventListener("scroll", redraw);
    };
  }

  private stopTracking(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    this.trackingCleanup?.();
    this.trackingCleanup = null;
  }

  private scheduleHide(duration: number): void {
    this.cancelScheduledHide();
    if (!Number.isFinite(duration) || duration <= 0) return;
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      this.hide();
    }, duration);
  }

  private scheduleDraw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private cancelScheduledDraw(): void {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private cancelScheduledHide(): void {
    if (!this.hideTimer) return;
    window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
  }

  private draw(): void {
    const element = this.selected;
    if (!element?.isConnected || !this.host?.isConnected || !this.label || this.boxes.length !== 4) {
      this.hide();
      return;
    }

    let rect: DOMRect;
    let style: CSSStyleDeclaration;
    try {
      rect = element.getBoundingClientRect();
      style = getComputedStyle(element);
    } catch {
      this.hide();
      return;
    }

    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) {
      this.hide();
      return;
    }

    const margin = readSides(style, "margin");
    const border = readSides(style, "border");
    const padding = readSides(style, "padding");
    const layers = [
      expand(rect, margin),
      normalizeRect(rect),
      shrink(rect, border),
      shrink(rect, addSides(border, padding)),
    ];

    for (let index = 0; index < this.boxes.length; index += 1) {
      applyFixedRect(this.boxes[index]!, layers[index]!);
    }

    this.drawLabel(element, rect);
  }

  private drawLabel(element: Element, rect: DOMRect): void {
    const label = this.label;
    if (!label) return;
    label.style.setProperty("display", this.showLabel ? "block" : "none", "important");
    if (!this.showLabel) return;

    label.textContent = describeNode(element);
    label.style.setProperty("left", "0px", "important");
    label.style.setProperty("top", "0px", "important");

    const measured = label.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const width = Math.max(1, measured.width);
    const height = Math.max(1, measured.height);
    const above = rect.top - height - 4;
    const below = rect.bottom + 4;
    const top = above >= 2 ? above : below + height <= viewportHeight - 2 ? below : clamp(rect.top, 2, viewportHeight - height - 2);
    const left = clamp(rect.left, 2, viewportWidth - width - 2);

    label.style.setProperty("left", `${roundPixel(left)}px`, "important");
    label.style.setProperty("top", `${roundPixel(top)}px`, "important");
  }
}

function readSides(style: CSSStyleDeclaration, type: "margin" | "border" | "padding"): Sides {
  const suffix = type === "border" ? "Width" : "";
  const read = (side: "Top" | "Right" | "Bottom" | "Left") => parseCssNumber(style[`${type}${side}${suffix}` as keyof CSSStyleDeclaration] as string);
  return { top: read("Top"), right: read("Right"), bottom: read("Bottom"), left: read("Left") };
}

function parseCssNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addSides(left: Sides, right: Sides): Sides {
  return { top: left.top + right.top, right: left.right + right.right, bottom: left.bottom + right.bottom, left: left.left + right.left };
}

function normalizeRect(rect: DOMRect): DOMRectLike {
  return { left: rect.left, top: rect.top, width: Math.max(0, rect.width), height: Math.max(0, rect.height) };
}

function expand(rect: DOMRect, sides: Sides): DOMRectLike {
  return { left: rect.left - sides.left, top: rect.top - sides.top, width: Math.max(0, rect.width + sides.left + sides.right), height: Math.max(0, rect.height + sides.top + sides.bottom) };
}

function shrink(rect: DOMRect, sides: Sides): DOMRectLike {
  return { left: rect.left + sides.left, top: rect.top + sides.top, width: Math.max(0, rect.width - sides.left - sides.right), height: Math.max(0, rect.height - sides.top - sides.bottom) };
}

function applyFixedRect(element: HTMLElement, rect: DOMRectLike): void {
  element.style.setProperty("left", `${roundPixel(rect.left)}px`, "important");
  element.style.setProperty("top", `${roundPixel(rect.top)}px`, "important");
  element.style.setProperty("width", `${roundPixel(Math.max(0, rect.width))}px`, "important");
  element.style.setProperty("height", `${roundPixel(Math.max(0, rect.height))}px`, "important");
}

function setImportant(element: HTMLElement, styles: Record<string, string>): void {
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value, "important");
  }
}

function roundPixel(value: number): number {
  const ratio = window.devicePixelRatio || 1;
  return Math.round(value * ratio) / ratio;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return maximum < minimum ? minimum : Math.min(maximum, Math.max(minimum, value));
}
