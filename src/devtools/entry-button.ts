import { ConfigStore } from "./core/config";
import { detectMobile, eventPoint, on } from "./core/dom";
import type { Position, SettingsLike } from "./types";

interface EntryButtonConfig extends Record<string, unknown> {
  rememberPos: boolean;
  pos: Position | null;
}

export class EntryBtn {
  readonly config = new ConfigStore<EntryButtonConfig>("entry-button", { rememberPos: true, pos: null });
  private cleanup: Array<() => void> = [];
  private clickListener: (() => void) | null = null;
  private dragging = false;
  private moved = false;
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
    if (this.config.get<boolean>("rememberPos")) this.config.set("pos", value);
    return this;
  }

  getPos(): Position {
    return {
      x: Number.parseFloat(this.element.style.left) || 0,
      y: Number.parseFloat(this.element.style.top) || 0,
    };
  }

  destroy(): void {
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    this.clickListener = null;
    this.element.remove();
  }

  private bind(): void {
    this.cleanup.push(on(this.element, "pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;
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
      if (!this.moved) this.clickListener?.();
      if (this.config.get<boolean>("rememberPos")) this.config.set("pos", this.getPos());
    }));
    this.cleanup.push(on(window, "resize", () => this.resetPosition(false)));
    this.cleanup.push(on(screen.orientation ?? window, "change", () => this.resetPosition(true)));
  }

  private resetPosition(orientationChanged: boolean): void {
    requestAnimationFrame(() => {
      const remembered = this.config.get<Position | null>("pos");
      const shouldRemember = this.config.get<boolean>("rememberPos") && !orientationChanged;
      const fallback = this.defaultPosition();
      this.setPos(shouldRemember && remembered ? remembered : fallback);
      if (detectMobile()) this.element.setAttribute("aria-label", "Open RodEruda developer tools");
    });
  }

  private defaultPosition(): Position {
    const size = this.element.offsetWidth || 40;
    return { x: Math.max(0, innerWidth - size - 10), y: Math.max(0, innerHeight - size - 10) };
  }

  private clamp(position: Position): Position {
    const rect = this.boundary.getBoundingClientRect();
    const width = rect.width || innerWidth;
    const height = rect.height || innerHeight;
    const size = this.element.offsetWidth || 40;
    return {
      x: Math.max(0, Math.min(width - size, Number(position.x) || 0)),
      y: Math.max(0, Math.min(height - size, Number(position.y) || 0)),
    };
  }
}
