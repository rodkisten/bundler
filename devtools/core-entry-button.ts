import type { Position, SettingsLike } from "@rodkisten/devtools/types";
import { ConfigStore } from "@rodkisten/devtools/core-config";
import { eventPoint, on } from "@rodkisten/devtools/core-dom";
import { detectMobile } from "@rodkisten/devtools/core-utils";
import { drainArray } from "@rodkisten/nascente";

interface EntryButtonConfig {
  rememberPos: boolean;
  pos: Position | null;
}

export class EntryBtn {
  readonly config = new ConfigStore<EntryButtonConfig>("entry-button", { rememberPos: true, pos: null });
  private cleanup: Array<() => void> = [];
  private clickListener: (() => void) | null = null;
  private dragging = false;
  private moved = false;
  private lastPointerActivation = 0;
  private start = { x: 0, y: 0 };
  private origin = { x: 0, y: 0 };

  constructor(private readonly element: HTMLButtonElement, private readonly boundary: HTMLElement) {
    this.bind();
    this.resetPosition(false);
  }

  on(event: "click", listener: () => void): this {
    if (event === "click") this.clickListener = listener;
    return this;
  }

  off(event: "click", listener?: () => void): this {
    if (event === "click" && (!listener || listener === this.clickListener)) this.clickListener = null;
    return this;
  }

  initCfg(settings: SettingsLike): void {
    settings.registerSwitch(this.config, "rememberPos", "Remember Entry Button Position");
  }

  show(): this {
    this.element.hidden = false;
    return this;
  }

  hide(): this {
    this.element.hidden = true;
    return this;
  }

  setPos(position: Position): this {
    const value = this.clamp(position);
    this.element.style.left = `${value.x}px`;
    this.element.style.top = `${value.y}px`;
    if (this.config.get("rememberPos")) this.config.set("pos", value);
    return this;
  }

  getPos(): Position {
    return {
      x: Number.parseFloat(this.element.style.left) || 0,
      y: Number.parseFloat(this.element.style.top) || 0,
    };
  }

  destroy(): void {
    for (const cleanup of drainArray(this.cleanup)) cleanup();
    this.clickListener = null;
    this.element.remove();
  }

  private bind(): void {
    this.cleanup.push(on(this.element, "pointerdown", (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      this.dragging = true;
      this.moved = false;
      this.element.classList.add("roderuda-active");
      this.element.setPointerCapture?.(event.pointerId);
      this.start = eventPoint(event);
      this.origin = this.getPos();
    }));
    this.cleanup.push(on(window, "pointermove", (event: PointerEvent) => {
      if (!this.dragging) return;
      const point = eventPoint(event);
      const x = this.origin.x + point.x - this.start.x;
      const y = this.origin.y + point.y - this.start.y;
      if (Math.abs(point.x - this.start.x) > 3 || Math.abs(point.y - this.start.y) > 3) this.moved = true;
      this.setPos({ x, y });
    }));
    this.cleanup.push(on(window, "pointerup", (event: PointerEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      this.element.classList.remove("roderuda-active");
      this.element.releasePointerCapture?.(event.pointerId);
      if (!this.moved) {
        this.lastPointerActivation = Date.now();
        this.clickListener?.();
      }
      if (this.config.get("rememberPos")) this.config.set("pos", this.getPos());
    }));
    this.cleanup.push(on(this.element, "click", (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - this.lastPointerActivation < 350) return;
      if (!this.dragging && !this.moved) this.clickListener?.();
    }));
    const keepInsideViewport = () => this.resetPosition(false);
    this.cleanup.push(on(window, "resize", keepInsideViewport));
    this.cleanup.push(on(window, "orientationchange", () => this.resetPosition(true)));
    this.cleanup.push(on(screen.orientation ?? window, "change", () => this.resetPosition(true)));

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", keepInsideViewport);
      viewport.addEventListener("scroll", keepInsideViewport);
      this.cleanup.push(() => {
        viewport.removeEventListener("resize", keepInsideViewport);
        viewport.removeEventListener("scroll", keepInsideViewport);
      });
    }
  }

  private resetPosition(orientationChanged: boolean): void {
    requestAnimationFrame(() => {
      const remembered = this.config.get("pos");
      const shouldRemember = this.config.get("rememberPos") && !orientationChanged;
      const fallback = this.defaultPosition();
      this.setPos(shouldRemember && remembered ? remembered : fallback);
      if (detectMobile()) this.element.setAttribute("aria-label", "Open RodEruda developer tools");
    });
  }

  private defaultPosition(): Position {
    const viewport = this.viewportBounds();
    const size = this.element.offsetWidth || 24;
    return {
      x: viewport.right - size - viewport.margin,
      y: viewport.bottom - size - viewport.margin,
    };
  }

  private clamp(position: Position): Position {
    const viewport = this.viewportBounds();
    const size = this.element.offsetWidth || 24;
    const minX = viewport.left + viewport.margin;
    const minY = viewport.top + viewport.margin;
    const maxX = Math.max(minX, viewport.right - size - viewport.margin);
    const maxY = Math.max(minY, viewport.bottom - size - viewport.margin);

    return {
      x: Math.max(minX, Math.min(maxX, Number(position.x) || 0)),
      y: Math.max(minY, Math.min(maxY, Number(position.y) || 0)),
    };
  }

  private viewportBounds(): { left: number; top: number; right: number; bottom: number; margin: number } {
    const rect = this.boundary.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = Math.max(0, viewport?.offsetLeft ?? rect.left ?? 0);
    const top = Math.max(0, viewport?.offsetTop ?? rect.top ?? 0);
    const width = Math.max(1, viewport?.width || rect.width || innerWidth);
    const height = Math.max(1, viewport?.height || rect.height || innerHeight);

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      margin: 8,
    };
  }
}
