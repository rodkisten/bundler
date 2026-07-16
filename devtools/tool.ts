import type { RenderValue } from "@rodkisten/fabrica";
import type { ToolContext, ToolLike } from "@rodkisten/devtools/types";
import { debugLog } from "@rodkisten/devtools/core/debug";
import { installSectionReordering } from "@rodkisten/devtools/core/section-reorder";

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


  /** Returns panel content owned by the root Fábrica render tree. */
  renderView(): RenderValue {
    return null;
  }

  show(): void {
    this.active = true;
    debugLog("tool", "show", { name: this.name });
  }

  hide(): void {
    this.active = false;
    debugLog("tool", "hide", { name: this.name });
  }

  destroy(): void {
    debugLog("tool", "destroy", { name: this.name });
    this.disposeSectionReordering?.();
    this.disposeSectionReordering = null;
    // The panel DOM belongs to the root Fábrica tree. Removing the tool from
    // the registration signal disposes that subtree and all owned effects.
    this.container = null;
    this.context = null;
  }
}

export function asTool(tool: ToolLike): ToolLike {
  return tool;
}
