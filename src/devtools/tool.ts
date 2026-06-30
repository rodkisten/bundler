import type { ToolContext, ToolLike } from "./types";

export abstract class Tool implements ToolLike {
  abstract readonly name: string;
  readonly title?: string;
  readonly icon?: string;
  active = false;
  protected container: HTMLElement | null = null;
  protected context: ToolContext | null = null;

  init(container: HTMLElement, context: ToolContext): void | Promise<void> {
    this.container = container;
    this.context = context;
  }

  show(): void {
    this.active = true;
    this.container?.classList.add("roderuda-active");
  }

  hide(): void {
    this.active = false;
    this.container?.classList.remove("roderuda-active");
  }

  destroy(): void {
    this.container?.remove();
    this.container = null;
    this.context = null;
  }
}

export function asTool(value: ToolLike): ToolLike {
  return value;
}
