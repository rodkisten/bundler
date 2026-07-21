import { clearRange } from "../render/cleanup.js";
import type { Directive, DirectiveController } from "../types.js";
import { createKeyedController } from "./controllers/keyed.js";
import { createPortalController } from "./controllers/portal.js";
import { createRepeatController } from "./controllers/repeat.js";
import { createSuspenseController } from "./controllers/suspense.js";
import { createVirtualRepeatController } from
  "./controllers/virtual-repeat.js";
import { createWhenController } from "./controllers/when.js";
import {
  DEFAULT_DIRECTIVE_HOST,
  type DirectiveRuntimeHost,
} from "./host.js";

export { bindModelPart } from "./model.js";
export type { DirectiveRuntimeHost } from "./host.js";

/** Creates the controller responsible for one directive-owned child range. */
export function createDirectiveController(
  start: Comment,
  end: Comment,
  directive: Directive,
  host: DirectiveRuntimeHost = DEFAULT_DIRECTIVE_HOST,
): DirectiveController {
  switch (directive.kind) {
    case "when":
      return createWhenController(start, end, host);
    case "repeat":
      return createRepeatController(start, end, host);
    case "virtualRepeat":
      return createVirtualRepeatController(start, end, host);
    case "portal":
      return createPortalController(start, end, host);
    case "suspense":
      return createSuspenseController(start, end, host);
    case "keyed":
      return createKeyedController(start, end, host);
    default:
      return createFallbackController(start, end, directive.kind);
  }
}

function createFallbackController(
  start: Comment,
  end: Comment,
  kind: string,
): DirectiveController {
  return {
    kind,
    update(): void {},
    dispose(): void {
      clearRange(start, end);
    },
  };
}
