import { isDevtoolsNode } from "./dom";

export class ElementHighlighter {
  private host: HTMLDivElement | null = null;
  private label: HTMLDivElement | null = null;
  private boxes: HTMLDivElement[] = [];
  private selected: Element | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;

  constructor(private readonly devtoolsHost?: HTMLElement | null) {}

  highlight(element: Element, label = true): void {
    if (isDevtoolsNode(element, this.devtoolsHost)) return;
    this.ensure();
    this.selected = element;
    this.draw(label);
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.scheduleDraw(label));
      this.resizeObserver.observe(element);
    }
  }

  hide(): void {
    this.selected = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.host?.remove();
    this.host = null;
    this.label = null;
    this.boxes = [];
    cancelAnimationFrame(this.frame);
  }

  destroy(): void {
    this.hide();
  }

  private ensure(): void {
    if (this.host?.isConnected) return;
    const host = document.createElement("div");
    host.className = "__roderuda-overlay__";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;";
    const colors = [
      "rgb(246 178 107 / .32)",
      "rgb(255 229 153 / .36)",
      "rgb(147 196 125 / .36)",
      "rgb(111 168 220 / .38)",
    ];
    this.boxes = colors.map((color) => {
      const box = document.createElement("div");
      box.style.cssText = `position:absolute;background:${color};outline:1px solid ${color.replace("/.3", "/.9")};`;
      host.appendChild(box);
      return box;
    });
    this.label = document.createElement("div");
    this.label.style.cssText = "position:absolute;max-width:min(90vw,520px);padding:5px 7px;border-radius:4px;background:#111;color:#fff;box-shadow:0 3px 14px rgb(0 0 0/.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    host.appendChild(this.label);
    document.documentElement.appendChild(host);
    this.host = host;
  }

  private scheduleDraw(label: boolean): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw(label));
  }

  private draw(showLabel: boolean): void {
    const element = this.selected;
    if (!element?.isConnected || !this.host) {
      this.hide();
      return;
    }
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const margin = sides(style, "margin");
    const border = sides(style, "border");
    const padding = sides(style, "padding");
    const layers = [
      expand(rect, margin),
      expand(rect, { top: 0, right: 0, bottom: 0, left: 0 }),
      shrink(rect, border),
      shrink(rect, addSides(border, padding)),
    ];

    for (let index = 0; index < this.boxes.length; index += 1) {
      const layer = layers[index]!;
      const box = this.boxes[index]!;
      Object.assign(box.style, {
        left: `${Math.round(layer.left)}px`,
        top: `${Math.round(layer.top)}px`,
        width: `${Math.max(0, Math.round(layer.width))}px`,
        height: `${Math.max(0, Math.round(layer.height))}px`,
      });
    }

    if (!this.label) return;
    this.label.hidden = !showLabel;
    if (!showLabel) return;
    const id = element.id ? `#${element.id}` : "";
    const classes = Array.from(element.classList).slice(0, 4).map((name) => `.${name}`).join("");
    this.label.textContent = `${element.tagName.toLowerCase()}${id}${classes}  ${Math.round(rect.width)} × ${Math.round(rect.height)}`;
    const labelHeight = 26;
    const top = rect.top > labelHeight + 5 ? rect.top - labelHeight - 3 : Math.min(innerHeight - labelHeight, rect.bottom + 3);
    this.label.style.left = `${Math.max(2, Math.min(innerWidth - 260, rect.left))}px`;
    this.label.style.top = `${Math.max(2, top)}px`;
  }
}

type Sides = { top: number; right: number; bottom: number; left: number };

function sides(style: CSSStyleDeclaration, type: "margin" | "border" | "padding"): Sides {
  const suffix = type === "border" ? "Width" : "";
  return {
    top: number(style[`${type}Top${suffix}` as keyof CSSStyleDeclaration] as string),
    right: number(style[`${type}Right${suffix}` as keyof CSSStyleDeclaration] as string),
    bottom: number(style[`${type}Bottom${suffix}` as keyof CSSStyleDeclaration] as string),
    left: number(style[`${type}Left${suffix}` as keyof CSSStyleDeclaration] as string),
  };
}

function number(value: string): number {
  return Number.parseFloat(value) || 0;
}

function addSides(left: Sides, right: Sides): Sides {
  return { top: left.top + right.top, right: left.right + right.right, bottom: left.bottom + right.bottom, left: left.left + right.left };
}

function expand(rect: DOMRect, sidesValue: Sides): DOMRectLike {
  return {
    left: rect.left - sidesValue.left,
    top: rect.top - sidesValue.top,
    width: rect.width + sidesValue.left + sidesValue.right,
    height: rect.height + sidesValue.top + sidesValue.bottom,
  };
}

function shrink(rect: DOMRect, sidesValue: Sides): DOMRectLike {
  return {
    left: rect.left + sidesValue.left,
    top: rect.top + sidesValue.top,
    width: rect.width - sidesValue.left - sidesValue.right,
    height: rect.height - sidesValue.top - sidesValue.bottom,
  };
}

type DOMRectLike = { left: number; top: number; width: number; height: number };
