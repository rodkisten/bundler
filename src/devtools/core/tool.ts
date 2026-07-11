import type { ToolContext, ToolLike } from "../types";
import { debugLog } from "./debug";
import { installSectionReordering } from "./section-reorder";

export abstract class Tool implements ToolLike {
  abstract readonly name: string;
  readonly title?: string;
  readonly icon?: Node | string;
  active = false;
  protected container: HTMLElement | null = null;
  protected context: ToolContext | null = null;
  private disposeSectionReordering: (() => void) | null = null;

  init(container: HTMLElement, context: ToolContext): void | Promise<void> {
    this.container = container;
    this.context = context;
    this.disposeSectionReordering?.();
    this.disposeSectionReordering = installSectionReordering(container, `roderuda:section-order:${this.name}`);
    debugLog("tool", "init", { name: this.name, title: this.title ?? this.name });
  }

  show(): void {
    this.active = true;
    this.container?.classList.add("roderuda-active");
    debugLog("tool", "show", { name: this.name });
  }

  hide(): void {
    this.active = false;
    this.container?.classList.remove("roderuda-active");
    debugLog("tool", "hide", { name: this.name });
  }

  destroy(): void {
    debugLog("tool", "destroy", { name: this.name });
    this.disposeSectionReordering?.();
    this.disposeSectionReordering = null;
    this.container?.remove();
    this.container = null;
    this.context = null;
  }
}

export function asTool(tool: ToolLike): ToolLike {
  return tool;
}
