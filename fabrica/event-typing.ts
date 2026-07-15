/** Event with a strongly typed currentTarget for template handlers. */
export type FabricaEvent<
  NativeEvent extends Event,
  CurrentTarget extends EventTarget = HTMLElement,
> = Omit<NativeEvent, "currentTarget"> & {
  readonly currentTarget: CurrentTarget;
};

/** User-augmentable custom event map for application-specific events. */
export interface FabricaCustomEventMap {}

/** Native and custom event names understood by the typed event helper. */
export type FabricaEventName = keyof GlobalEventHandlersEventMap | keyof FabricaCustomEventMap;

/** Resolves an event name to its native or application-defined event type. */
export type FabricaEventFor<Name extends FabricaEventName> =
  Name extends keyof FabricaCustomEventMap
    ? FabricaCustomEventMap[Name] extends Event
      ? FabricaCustomEventMap[Name]
      : Event
    : Name extends keyof GlobalEventHandlersEventMap
      ? GlobalEventHandlersEventMap[Name]
      : Event;

/** Callback accepted by a named template event binding. */
export type FabricaEventHandler<
  Name extends FabricaEventName,
  CurrentTarget extends EventTarget = DefaultEventTarget<Name>,
> = (event: FabricaEvent<FabricaEventFor<Name>, CurrentTarget>) => void;

/** Practical defaults for the event families whose target type is unambiguous. */
export type DefaultEventTarget<Name extends FabricaEventName> =
  Name extends "input" | "beforeinput" | "change" | "invalid" | "select" ? HTMLInputElement
    : Name extends "submit" | "reset" | "formdata" ? HTMLFormElement
      : Name extends "load" | "error" ? HTMLElement
        : HTMLElement;

/** Callable identity helper enriched with one strongly typed property per event name. */
export type FabricaEventHelper = {
  <EventType extends Event = Event, CurrentTarget extends EventTarget = HTMLElement>(
    handler: (event: FabricaEvent<EventType, CurrentTarget>) => void,
  ): (event: FabricaEvent<EventType, CurrentTarget>) => void;
} & {
  readonly [Name in FabricaEventName]: <CurrentTarget extends EventTarget = DefaultEventTarget<Name>>(
    handler: FabricaEventHandler<Name, CurrentTarget>,
  ) => FabricaEventHandler<Name, CurrentTarget>;
};

/**
 * Creates the typed event helper used by `@click`, `@pointerup`, and friends.
 * Runtime behavior is intentionally zero-cost: every call returns its handler.
 */
export function createEventHelper(): FabricaEventHelper {
  const identity = ((handler: (event: Event) => void) => handler) as unknown as FabricaEventHelper;

  return new Proxy(identity, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
      return target;
    },
  });
}

/** Default singleton helper for package-level imports. */
export const event = createEventHelper();
