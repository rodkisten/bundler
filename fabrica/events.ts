import { effect } from "@rodkisten/broto/reactivity";
import { debugState, recordDebug } from "./debug.js";
import { registerCleanup } from "./render/cleanup.js";
import { isDirective, isSignal } from "./guards.js";
import type { EventBindingConfig, RenderValue } from "./types.js";

type DelegationRoot = Document | ShadowRoot | DocumentFragment | Element;
type RuntimeEventHandler = ((event: Event) => void) & { original?: unknown };

type DelegatedBinding = {
  token: object;
  handler: (event: Event) => void;
  config: EventBindingConfig;
};

/** Events whose platform semantics do not bubble through an ancestor delegate. */
const NON_BUBBLING_EVENTS = new Set([
  "abort",
  "beforeunload",
  "blur",
  "cancel",
  "canplay",
  "canplaythrough",
  "close",
  "cuechange",
  "durationchange",
  "emptied",
  "ended",
  "error",
  "focus",
  "invalid",
  "load",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "mouseenter",
  "mouseleave",
  "pause",
  "play",
  "playing",
  "pointerenter",
  "pointerleave",
  "progress",
  "ratechange",
  "resize",
  "scroll",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "toggle",
  "unload",
  "volumechange",
  "waiting",
]);

/** One element-local registry replaces one native listener per delegated binding. */
const delegatedHandlers = new WeakMap<Element, Map<string, DelegatedBinding>>();
/** Roots that already have a native delegated listener for each event type. */
const delegatedRoots = new WeakMap<EventTarget, Map<string, EventListener>>();
/** Event types known by the runtime, used when a detached template enters a ShadowRoot. */
const delegatedEventNames = new Set<string>();
let delegatedEventVersion = 0;
const delegationRootEventVersions = new WeakMap<EventTarget, number>();
/** Targets already dispatched by an inner root, without retaining detached elements. */
const delegatedHandledTargets = new WeakMap<Event, WeakSet<EventTarget>>();
const parsedEventCache = new Map<string, EventBindingConfig>();

/**
 * Binds an event listener with modifiers.
 *
 * @remarks
 * Safe bubbling events are delegated automatically to the owning Document or
 * ShadowRoot. Capture, passive, explicit `.direct`, and known non-bubbling
 * events keep native per-element listeners because delegation would change
 * observable browser semantics.
 *
 * @param element - Target element.
 * @param rawName - Event name and modifiers, without leading @.
 * @param value - Handler or signal of handler.
 */
export function bindEvent(
  element: Element,
  rawName: string,
  value: RenderValue,
  registerOwnerCleanup = true,
): () => void {
  const eventConfig = parseEventName(rawName);
  const optionDirective = isDirective(value) && value.kind === "eventOptions"
    ? value as unknown as { handler: EventListener; options: AddEventListenerOptions }
    : null;

  if (optionDirective) {
    Object.assign(eventConfig.options, optionDirective.options);
    value = optionDirective.handler as unknown as RenderValue;
  }

  if (shouldDelegateEvent(eventConfig)) {
    return bindDelegatedEvent(element, eventConfig, value, registerOwnerCleanup);
  }

  return bindDirectEvent(element, eventConfig, value, registerOwnerCleanup);
}

/**
 * Parses event modifiers.
 *
 * Automatic delegation is the default. `.direct` opts out while `.delegate`
 * remains supported as an explicit declaration for readability/backwards compatibility.
 */
export function parseEventName(rawName: string): EventBindingConfig {
  const cached = parsedEventCache.get(rawName);
  if (cached) {
    return { ...cached, options: { ...cached.options } };
  }

  let dotIndex = rawName.indexOf(".");
  const name = dotIndex < 0 ? rawName : rawName.slice(0, dotIndex);
  let prevent = false;
  let stop = false;
  let delegate = false;
  let direct = false;
  let once = false;
  let passive = false;
  let capture = false;

  while (dotIndex >= 0) {
    const nextDotIndex = rawName.indexOf(".", dotIndex + 1);
    const modifier = rawName.slice(dotIndex + 1, nextDotIndex < 0 ? rawName.length : nextDotIndex);

    if (modifier === "prevent") prevent = true;
    else if (modifier === "stop") stop = true;
    else if (modifier === "delegate") delegate = true;
    else if (modifier === "direct") direct = true;
    else if (modifier === "once") once = true;
    else if (modifier === "passive") passive = true;
    else if (modifier === "capture") capture = true;

    dotIndex = nextDotIndex;
  }

  const config: EventBindingConfig = {
    name,
    prevent,
    stop,
    delegate,
    direct,
    options: { once, passive, capture },
  };

  parsedEventCache.set(rawName, config);
  return { ...config, options: { ...config.options } };
}

/** Returns whether a config can preserve native semantics through bubbling delegation. */
export function shouldDelegateEvent(eventConfig: EventBindingConfig): boolean {
  if (eventConfig.direct) return false;
  if (eventConfig.options.capture || eventConfig.options.passive || eventConfig.options.signal) return false;
  if (NON_BUBBLING_EVENTS.has(eventConfig.name)) return false;
  return true;
}

/**
 * Ensures all currently known delegated event types are installed for a DOM destination.
 *
 * @remarks
 * Templates are compiled while detached, before their eventual ShadowRoot is
 * knowable. The renderer calls this when inserting into a destination so the
 * shadow boundary receives the same one-listener-per-event delegation model.
 */
export function connectDelegatedEventRoot(destination: Node, insertedRoot?: Node): void {
  const root = getDelegationRootForNode(destination);
  if (delegationRootEventVersions.get(root) !== delegatedEventVersion) {
    for (const eventName of delegatedEventNames) {
      ensureDelegatedEvent(root, eventName);
    }
    delegationRootEventVersions.set(root, delegatedEventVersion);
  }

  if (insertedRoot && insertedRoot !== root) {
    removeDelegatedRootListeners(insertedRoot);
  }
}

/** Moves transient fragment delegation to the public detached HTML result root. */
export function transferDelegatedEventRoot(from: Node, to: Node): void {
  if (from === to) return;
  const events = delegatedRoots.get(from);
  if (!events || events.size === 0) return;

  const targetRoot = to as DelegationRoot;
  for (const eventName of events.keys()) {
    ensureDelegatedEvent(targetRoot, eventName);
  }
  removeDelegatedRootListeners(from);
}

function bindDirectEvent(
  element: Element,
  eventConfig: EventBindingConfig,
  value: RenderValue,
  registerOwnerCleanup: boolean,
): () => void {
  let previousHandler: RuntimeEventHandler | null = null;
  let disposeEffect: (() => void) | null = null;
  let disposed = false;

  const update = (): void => {
    if (disposed) return;
    const handler = isSignal(value) ? value() : value;

    if (previousHandler && previousHandler.original === handler) return;

    if (previousHandler) {
      element.removeEventListener(eventConfig.name, previousHandler, eventConfig.options);
      previousHandler = null;
    }

    if (typeof handler !== "function") return;

    previousHandler = createDirectEventHandler(element, handler as (event: Event) => void, eventConfig);
    element.addEventListener(eventConfig.name, previousHandler, eventConfig.options);
    debugState.directEventBindings += 1;
    recordDebug({
      kind: "event-binding",
      eventName: eventConfig.name,
      mode: "direct",
      currentTarget: describeTarget(element),
    });
  };

  if (isSignal(value)) disposeEffect = effect(update, { scheduler: "sync" });
  else update();

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    disposeEffect?.();
    disposeEffect = null;
    if (previousHandler) {
      element.removeEventListener(eventConfig.name, previousHandler, eventConfig.options);
      previousHandler = null;
    }
  };

  if (registerOwnerCleanup) registerCleanup(element, cleanup);
  return cleanup;
}

function createDirectEventHandler(
  element: Element,
  handler: (event: Event) => void,
  eventConfig: EventBindingConfig,
): RuntimeEventHandler {
  const wrapped = ((event: Event): void => {
    applyConfiguredModifiers(event, eventConfig);
    debugState.eventHandlerCalls += 1;
    recordDebug({
      kind: "event-handler",
      eventName: eventConfig.name,
      mode: "direct",
      target: describeTarget(event.target),
      currentTarget: describeTarget(element),
    });
    handler.call(element, event);
  }) as RuntimeEventHandler;

  wrapped.original = handler;
  return wrapped;
}

function bindDelegatedEvent(
  element: Element,
  eventConfig: EventBindingConfig,
  value: RenderValue,
  registerOwnerCleanup: boolean,
): () => void {
  const token = {};
  let previousOriginal: unknown = Symbol("initial-handler");
  let disposeEffect: (() => void) | null = null;
  let disposed = false;

  const update = (): void => {
    if (disposed) return;
    const handler = isSignal(value) ? value() : value;
    const handlers = getOrCreateDelegatedHandlers(element);

    if (Object.is(previousOriginal, handler)) return;
    previousOriginal = handler;

    if (typeof handler !== "function") {
      if (handlers.get(eventConfig.name)?.token === token) handlers.delete(eventConfig.name);
      return;
    }

    handlers.set(eventConfig.name, {
      token,
      handler: handler as (event: Event) => void,
      config: eventConfig,
    });

    if (!delegatedEventNames.has(eventConfig.name)) {
      delegatedEventNames.add(eventConfig.name);
      delegatedEventVersion += 1;
    }
    ensureDelegatedEvent(getDelegationRoot(element), eventConfig.name);
    debugState.delegatedBindings += 1;
    recordDebug({
      kind: "event-binding",
      eventName: eventConfig.name,
      mode: "delegated",
      currentTarget: describeTarget(element),
    });
  };

  if (isSignal(value)) disposeEffect = effect(update, { scheduler: "sync" });
  else update();

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    disposeEffect?.();
    disposeEffect = null;
    const handlers = delegatedHandlers.get(element);
    if (handlers?.get(eventConfig.name)?.token === token) handlers.delete(eventConfig.name);
    if (handlers?.size === 0) delegatedHandlers.delete(element);
  };

  if (registerOwnerCleanup) registerCleanup(element, cleanup);
  return cleanup;
}

function getOrCreateDelegatedHandlers(element: Element): Map<string, DelegatedBinding> {
  let handlers = delegatedHandlers.get(element);
  if (!handlers) {
    handlers = new Map<string, DelegatedBinding>();
    delegatedHandlers.set(element, handlers);
  }
  return handlers;
}

function getDelegationRoot(element: Element): DelegationRoot {
  return getDelegationRootForNode(element);
}

function getDelegationRootForNode(node: Node): DelegationRoot {
  if (node instanceof Document || node instanceof ShadowRoot || node instanceof DocumentFragment) {
    return node;
  }

  const root = node.getRootNode?.();
  if (root instanceof Document || root instanceof ShadowRoot || root instanceof DocumentFragment) {
    return root;
  }

  if (root instanceof Element) return root;
  if (node instanceof Element) return node;
  return node.ownerDocument || document;
}

function ensureDelegatedEvent(root: DelegationRoot, eventName: string): void {
  let events = delegatedRoots.get(root);
  if (!events) {
    events = new Map<string, EventListener>();
    delegatedRoots.set(root, events);
  }

  if (events.has(eventName)) return;

  const listener: EventListener = (event) => {
    dispatchDelegatedEvent(root, eventName, event);
  };
  events.set(eventName, listener);
  debugState.delegatedEvents += 1;
  root.addEventListener(eventName, listener);
}

function removeDelegatedRootListeners(root: Node): void {
  const events = delegatedRoots.get(root);
  if (!events) return;

  for (const [eventName, listener] of events) {
    root.removeEventListener(eventName, listener);
  }
  events.clear();
  delegatedRoots.delete(root);
  delegationRootEventVersions.delete(root);
}

function dispatchDelegatedEvent(root: DelegationRoot, eventName: string, event: Event): void {
  debugState.delegatedDispatches += 1;
  recordDebug({
    kind: "event-dispatch",
    eventName,
    mode: "delegated",
    target: describeTarget(event.target),
    currentTarget: describeTarget(root),
  });

  const handledTargets = getHandledTargets(event);
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];

  if (path.length > 0) {
    for (let index = 0; index < path.length; index += 1) {
      const current = path[index];
      if (current instanceof Element) {
        runDelegatedHandler(current, eventName, event, handledTargets);
        if (event.cancelBubble) break;
      }
      if (current === root) break;
    }
    return;
  }

  let current: Node | null = event.target as Node | null;
  while (current) {
    if (current instanceof Element) {
      runDelegatedHandler(current, eventName, event, handledTargets);
      if (event.cancelBubble) break;
    }
    if (current === root) break;
    current = current.parentNode;
  }
}

function runDelegatedHandler(
  element: Element,
  eventName: string,
  event: Event,
  handledTargets: WeakSet<EventTarget>,
): void {
  if (handledTargets.has(element)) return;

  const handlers = delegatedHandlers.get(element);
  const binding = handlers?.get(eventName);
  if (!binding) return;

  handledTargets.add(element);
  const { config, handler } = binding;
  const delegatedEvent = createDelegatedEventFacade(event, element);
  applyConfiguredModifiers(delegatedEvent.event, config);

  debugState.eventHandlerCalls += 1;
  recordDebug({
    kind: "event-handler",
    eventName,
    mode: "delegated",
    target: describeTarget(event.target),
    currentTarget: describeTarget(element),
  });

  try {
    handler.call(element, delegatedEvent.event);
  } finally {
    delegatedEvent.release();
    if (config.options.once) {
      handlers?.delete(eventName);
      if (handlers?.size === 0) delegatedHandlers.delete(element);
    }
  }
}

function applyConfiguredModifiers(event: Event, eventConfig: EventBindingConfig): void {
  if (eventConfig.prevent && !eventConfig.options.passive) event.preventDefault();
  if (eventConfig.stop) event.stopPropagation();
}

function getHandledTargets(event: Event): WeakSet<EventTarget> {
  let handled = delegatedHandledTargets.get(event);
  if (!handled) {
    handled = new WeakSet<EventTarget>();
    delegatedHandledTargets.set(event, handled);
  }
  return handled;
}

function createDelegatedEventFacade(
  event: Event,
  currentTarget: EventTarget,
): { event: Event; release(): void } {
  let active = true;
  const facade = new Proxy(event, {
    get(target, property) {
      if (property === "currentTarget") return active ? currentTarget : null;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return {
    event: facade,
    release(): void {
      active = false;
    },
  };
}

function describeTarget(target: unknown): string | undefined {
  if (!target) return undefined;
  if (target instanceof Document) return "document";
  if (target instanceof ShadowRoot) return "shadow-root";
  if (!(target instanceof Element)) return target.constructor?.name || typeof target;

  let description = target.tagName.toLowerCase();
  if (target.id) description += `#${target.id}`;
  if (target.classList.length > 0) {
    const classes = Array.from(target.classList).slice(0, 2);
    description += `.${classes.join(".")}`;
  }
  return description;
}
