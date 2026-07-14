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
} from "../broto";
import { defineComponent } from "./component";
import type {
  Component,
  ComponentChildren,
  ContextToken,
  ReactiveContextToken,
  Signal,
} from "./types";

/** Creates a Fabrica context backed by Broto's owner tree. */
export const createFabricaContext = createContext;

/** Creates a context that throws when no ancestor provider exists. */
export const createRequiredFabricaContext = createRequiredContext;

/** Creates a context whose value is a writable Broto signal. */
export const createReactiveFabricaContext = createReactiveContext;

export interface ContextProviderProps<Value> {
  value: Value;
  children?: ComponentChildren;
}

/**
 * Creates a portable provider component for a context token.
 *
 * The provider carries no DOM of its own and preserves the logical owner tree.
 */
export function createContextProvider<Value>(
  context: ContextToken<Value>,
  name = `${context.description}Provider`,
): Component<ContextProviderProps<Value>> {
  return defineComponent<ContextProviderProps<Value>>(name, (props, componentContext) => {
    componentContext.provide(context, props.value);
    return props.children ?? null;
  });
}

/** Creates a provider component specialized for reactive contexts. */
export function createReactiveContextProvider<Value>(
  context: ReactiveContextToken<Value>,
  name = `${context.description}Provider`,
): Component<ContextProviderProps<Value | Signal<Value>>> {
  return defineComponent<ContextProviderProps<Value | Signal<Value>>>(name, (props) => {
    provideReactiveContext(context, props.value);
    return props.children ?? null;
  });
}

export {
  hasContext,
  provide,
  provideReactiveContext,
  requireContext,
  requireReactiveContext,
  useContext,
  useReactiveContext,
};
