import { debugState } from "@/debug";
import { registerCleanup } from "@/dom-cleanup";
import { isSignal } from "@/guards";
import { effect } from "@/reactivity";
import type { EventBindingConfig, RenderValue } from "@/types";

/** Documents that already have a delegated listener for each event. */
const delegatedEvents = new WeakMap<Document, Set<string>>();

/**
 * Binds an event listener with modifiers.
 *
 * @param element - Target element.
 * @param rawName - Event name and modifiers, without leading @.
 * @param value - Handler or signal of handler.
 *
 * @example
 * ```ts
 * bindEvent(button, "click.prevent.stop", onClick);
 * ```
 */
export function bindEvent(element: Element, rawName: string, value: RenderValue): void {
  const eventConfig = parseEventName(rawName);

  if (eventConfig.delegate) {
    bindDelegatedEvent(element, eventConfig, value);
    return;
  }

  let previousHandler: (((event: Event) => void) & { original?: unknown }) | null = null;

  const update = (): void => {
    const handler = isSignal(value) ? value() : value;

    if (previousHandler && previousHandler.original === handler) {
      return;
    }

    if (previousHandler) {
      element.removeEventListener(eventConfig.name, previousHandler, eventConfig.options);
      previousHandler = null;
    }

    if (typeof handler !== "function") {
      return;
    }

    previousHandler = createEventHandler(element, handler as (event: Event) => void, eventConfig);
    element.addEventListener(eventConfig.name, previousHandler, eventConfig.options);
  };

  const dispose = isSignal(value) ? effect(update) : (update(), null);

  if (dispose) {
    registerCleanup(element, dispose);
  }

  registerCleanup(element, () => {
    if (previousHandler) {
      element.removeEventListener(eventConfig.name, previousHandler, eventConfig.options);
    }
  });
}

/**
 * Parses event modifiers.
 *
 * @param rawName - Raw event name such as `click.prevent.stop`.
 * @returns Parsed event config.
 */
export function parseEventName(rawName: string): EventBindingConfig {
  const parts = rawName.split(".");
  const name = parts.shift() || rawName;
  const modifiers = new Set(parts);

  return {
    name,
    prevent: modifiers.has("prevent"),
    stop: modifiers.has("stop"),
    delegate: modifiers.has("delegate"),
    options: {
      once: modifiers.has("once"),
      passive: modifiers.has("passive"),
      capture: modifiers.has("capture"),
    },
  };
}

/**
 * Creates a listener wrapper that applies modifiers before calling user code.
 *
 * @param element - Bound element.
 * @param handler - User handler.
 * @param eventConfig - Parsed event configuration.
 * @returns Wrapped listener.
 */
function createEventHandler(
  element: Element,
  handler: (event: Event) => void,
  eventConfig: EventBindingConfig,
): ((event: Event) => void) & { original?: unknown } {
  const wrapped = ((event: Event): void => {
    if (eventConfig.prevent && !eventConfig.options.passive) {
      event.preventDefault();
    }

    if (eventConfig.stop) {
      event.stopPropagation();
    }

    handler.call(element, event);
  }) as ((event: Event) => void) & { original?: unknown };

  wrapped.original = handler;
  return wrapped;
}

/**
 * Binds an event through document-level delegation.
 *
 * @param element - Target element.
 * @param eventConfig - Parsed event configuration.
 * @param value - Handler value.
 */
function bindDelegatedEvent(element: Element, eventConfig: EventBindingConfig, value: RenderValue): void {
  const handler = isSignal(value) ? value() : value;

  if (typeof handler !== "function") {
    return;
  }

  const target = element as Element & {
    __fabricaDelegatedHandlers?: Record<string, (event: Event) => void>;
  };

  target.__fabricaDelegatedHandlers ??= {};
  target.__fabricaDelegatedHandlers[eventConfig.name] = createEventHandler(
    element,
    handler as (event: Event) => void,
    eventConfig,
  );

  ensureDelegatedEvent(document, eventConfig.name);

  registerCleanup(element, () => {
    if (target.__fabricaDelegatedHandlers) {
      delete target.__fabricaDelegatedHandlers[eventConfig.name];
    }
  });
}

/**
 * Installs a document-level delegated listener once per event name.
 *
 * @param root - Document root.
 * @param eventName - Event name.
 */
function ensureDelegatedEvent(root: Document, eventName: string): void {
  let events = delegatedEvents.get(root);

  if (!events) {
    events = new Set<string>();
    delegatedEvents.set(root, events);
  }

  if (events.has(eventName)) {
    return;
  }

  events.add(eventName);
  debugState.delegatedEvents += 1;

  root.addEventListener(eventName, (event) => {
    let current: Node | null = event.target as Node | null;

    while (current && current !== root) {
      const handlers = (current as Element & {
        __fabricaDelegatedHandlers?: Record<string, (event: Event) => void>;
      }).__fabricaDelegatedHandlers;

      const delegatedHandler = handlers?.[eventName];

      if (delegatedHandler) {
        delegatedHandler(event);

        if (event.cancelBubble) {
          return;
        }
      }

      current = current.parentNode;
    }
  });
}
