import {
  createContext,
  createReactiveContext,
  createRequiredContext,
  hasContext,
  provide,
  provideReactiveContext,
  requireContext,
  requireReactiveContext,
  useContext,
  useReactiveContext,
  useRequiredContext,
} from "@rodkisten/broto";
import { defineComponent } from "@rodkisten/fabrica/component";
import type {
  Component,
  ComponentChildren,
  ContextToken,
  ReactiveContextToken,
  Signal,
} from "@rodkisten/fabrica/types";

export interface ContextProviderProps<Value> {
  value: Value;
  children?: ComponentChildren;
}

export type FabricaContext<Value> = ContextToken<Value> & {
  /** Portable DOM-less provider for this context. */
  readonly Provider: Component<ContextProviderProps<Value>>;
};

export type ReactiveFabricaContext<Value> = ReactiveContextToken<Value> & {
  /** Portable DOM-less provider that accepts a value or an existing signal. */
  readonly Provider: Component<ContextProviderProps<Value | Signal<Value>>>;
};

/** Creates a Fábrica context with an attached portable Provider component. */
export function createFabricaContext<Value>(
  defaultValue: Value,
  description?: string,
): FabricaContext<Value>;
export function createFabricaContext<Value = undefined>(
  defaultValue?: Value,
  description = "FabricaContext",
): FabricaContext<Value> {
  const token = arguments.length > 0
    ? createContext(defaultValue, description)
    : createContext<Value>();
  return attachProvider(token, createContextProvider);
}

/** Creates a required Fábrica context with an attached Provider component. */
export function createRequiredFabricaContext<Value>(
  description = "RequiredFabricaContext",
): FabricaContext<Value> {
  return attachProvider(createRequiredContext<Value>(description), createContextProvider);
}

/** Creates a reactive signal context with an attached Provider component. */
export function createReactiveFabricaContext<Value>(
  initialValue: Value,
  description = "ReactiveFabricaContext",
): ReactiveFabricaContext<Value> {
  return attachProvider(createReactiveContext(initialValue, description), createReactiveContextProvider);
}

/**
 * Creates a DOM-less provider component.
 *
 * The exact value reference is stored on the provider owner. Stores, services,
 * signals and ordinary objects are never cloned, snapshotted or unwrapped.
 */
export function createContextProvider<Value>(
  context: ContextToken<Value>,
  name = `${context.description}Provider`,
): Component<ContextProviderProps<Value>> {
  const Provider = defineComponent<ContextProviderProps<Value>>(name, (props, componentContext) => {
    componentContext.provide(context, props.value);
    return props.children ?? null;
  });

  Object.defineProperty(Provider, "preserveSignalProps", {
    configurable: false,
    enumerable: false,
    value: new Set(["value"]),
  });

  return Provider;
}

/** Creates a provider component specialized for reactive signal contexts. */
export function createReactiveContextProvider<Value>(
  context: ReactiveContextToken<Value>,
  name = `${context.description}Provider`,
): Component<ContextProviderProps<Value | Signal<Value>>> {
  const Provider = defineComponent<ContextProviderProps<Value | Signal<Value>>>(name, (props, componentContext) => {
    componentContext.provideReactiveContext(context, props.value);
    return props.children ?? null;
  });

  Object.defineProperty(Provider, "preserveSignalProps", {
    configurable: false,
    enumerable: false,
    value: new Set(["value"]),
  });

  return Provider;
}

function attachProvider<Value, Token extends ContextToken<Value>>(
  token: Token,
  providerFactory: (context: Token, name?: string) => Component<any>,
): Token & { readonly Provider: Component<any> } {
  const context = { ...token } as Token & { readonly Provider: Component<any> };
  Object.defineProperty(context, "Provider", {
    value: providerFactory(context, `${context.description}Provider`),
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(context);
}

export {
  hasContext,
  provide,
  provideReactiveContext,
  requireContext,
  requireReactiveContext,
  useContext,
  useReactiveContext,
  useRequiredContext,
};
