import { batch, computed, effect, memo, signal, untrack } from "../broto/reactivity";
import { createRoot, getOwner, handleOwnerError, provide, runWithOwner, useContext } from "../broto/owner";
import { resource } from "../broto/resources";
import { debugState } from "./debug";
import { registerCleanup } from "./dom-cleanup";
import { appendValue } from "./dom";
import { ref } from "./directives";
import {
  defaultComponentRegistry,
  normalizeComponentName,
  resolveRegistry,
} from "./component-registry";
import { warnDeprecated } from "./deprecations";
import {
  getCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "./runtime-context";
import type {
  Cleanup,
  Component,
  ComponentContext,
  ComponentDefinitionOptions,
  ComponentFactory,
  ComponentLike,
  ComponentProps,
  ComponentRenderRequest,
  ComponentUseOptions,
  RenderValue,
} from "./types";

let componentId = 0;

type RuntimeApiShape = {
  html: ComponentContext["html"];
  jsx: ComponentContext["jsx"];
  component: ComponentContext["component"];
  use(component: ComponentLike, options?: ComponentUseOptions): unknown;
  registry: ReturnType<typeof resolveRegistry>;
};

/**
 * Creates a reusable UI component in the default Fabrica instance.
 *
 * @remarks
 * `component("Name", factory)` is the preferred minifier-safe API. Named
 * components register automatically in the current/default instance registry.
 * Anonymous components remain private and can be installed later with
 * `instance.use(definition)`.
 *
 * The legacy `component(function Name(){})` implicit-name registration path is
 * preserved for compatibility, but emits one migration warning because
 * minifiers and wrappers can rename the function unexpectedly.
 */
export function component<Props extends object = ComponentProps>(
  factory: ComponentFactory<Props>,
): Component<Props>;
export function component<Props extends object = ComponentProps>(
  name: string,
  factory: ComponentFactory<Props>,
  options?: ComponentDefinitionOptions,
): Component<Props>;
export function component<Props extends object = ComponentProps>(
  nameOrFactory: string | ComponentFactory<Props>,
  maybeFactory?: ComponentFactory<Props>,
  options: ComponentDefinitionOptions = {},
): Component<Props> {
  const runtime = getCurrentFabricaRuntime();
  return createRuntimeComponent(runtime, nameOrFactory, maybeFactory, options);
}

/**
 * Creates a portable, unregistered component definition.
 *
 * @remarks
 * Portable definitions use the materializing instance through `ctx.html`,
 * `ctx.component`, `ctx.registry` and `ctx.instance`, so the same definition can
 * be installed into isolated, shared or forked registries without closing over
 * a specific Fabrica singleton.
 */
export function defineComponent<Props extends object = ComponentProps>(
  name: string,
  factory: ComponentFactory<Props>,
): Component<Props> {
  const normalizedName = normalizeComponentName(name);
  if (!normalizedName) {
    throw new Error("[Fabrica] defineComponent() needs a non-empty name.");
  }
  return createComponentDefinition(normalizedName, factory, true);
}

/** Internal instance-bound component factory used by createFabrica(). */
export function createRuntimeComponent<Props extends object = ComponentProps>(
  runtime: ReturnType<typeof getCurrentFabricaRuntime>,
  nameOrFactory: string | ComponentFactory<Props>,
  maybeFactory?: ComponentFactory<Props>,
  options: ComponentDefinitionOptions = {},
): Component<Props> {
  const explicitName = typeof nameOrFactory === "string"
    ? normalizeComponentName(nameOrFactory)
    : "";
  const factory = typeof nameOrFactory === "function" ? nameOrFactory : maybeFactory;

  if (typeof factory !== "function") {
    throw new TypeError("[Fabrica] component() expects a factory function.");
  }

  const inferredName = explicitName || normalizeComponentName(factory.name);
  const displayName = inferredName || "AnonymousComponent";
  const definition = createComponentDefinition(displayName, factory, false);
  const shouldRegister = options.register !== false && displayName !== "AnonymousComponent";

  if (!explicitName && inferredName) {
    warnDeprecated(
      "component.implicit-name",
      "[Fabrica] component(function Name(){}) implicit registry registration is deprecated. Use component(\"Name\", factory) for minifier-safe registration or defineComponent(\"Name\", factory) for a portable definition.",
    );
  }

  if (shouldRegister) {
    runtime.registry.register(displayName, definition, options);
  }

  return definition;
}

function createComponentDefinition<Props extends object>(
  displayName: string,
  factory: ComponentFactory<Props>,
  portable: boolean,
): Component<Props> {
  if (typeof factory !== "function") {
    throw new TypeError("[Fabrica] Component definitions require a factory function.");
  }

  const renderComponent = ((
    props?: Props & { children?: RenderValue | readonly RenderValue[] },
  ): ComponentRenderRequest<Props> => ({
    __kind: "componentRender",
    component: renderComponent as Component<Props>,
    props: (props ?? {}) as Props & { children?: RenderValue | readonly RenderValue[] },
  })) as Component<Props>;

  Object.defineProperties(renderComponent, {
    __kind: { value: "component", enumerable: false },
    displayName: { value: displayName, enumerable: false },
    registryName: { value: displayName === "AnonymousComponent" ? undefined : displayName, enumerable: false },
    portable: { value: portable, enumerable: false },
    factory: { value: factory, enumerable: false },
    register: {
      enumerable: false,
      value(target?: unknown, options: ComponentUseOptions = {}) {
        const runtime = getCurrentFabricaRuntime();
        const registry = resolveRegistry(target) ?? runtime.registry;
        const name = normalizeComponentName(options.name || renderComponent.registryName || renderComponent.displayName);
        if (!name) throw new Error("[Fabrica] Anonymous components need an explicit registration name.");
        registry.register(name, renderComponent, options);
        return renderComponent;
      },
    },
    unregister: {
      enumerable: false,
      value(target?: unknown, name?: string) {
        const runtime = getCurrentFabricaRuntime();
        const registry = resolveRegistry(target) ?? runtime.registry;
        return registry.unregister(normalizeComponentName(name || renderComponent.registryName || renderComponent.displayName));
      },
    },
  });

  debugState.components += 1;
  return renderComponent;
}

/**
 * @deprecated Use `component("Name", factory)`, `defineComponent()` plus
 * `instance.use()`, or `instance.registry.register()`.
 */
export function registerComponent<Props extends object = ComponentProps>(
  name: string,
  componentValue: Component<Props>,
): Component<Props>;
/** @deprecated Use the instance/registry APIs instead. */
export function registerComponent<Props extends ComponentProps = ComponentProps>(
  name: string,
  componentValue: (props?: Props & { children?: RenderValue | readonly RenderValue[] }) => unknown,
): (props?: Props & { children?: RenderValue | readonly RenderValue[] }) => unknown;
export function registerComponent(name: string, componentValue: unknown): unknown {
  warnDeprecated(
    "registerComponent",
    "[Fabrica] registerComponent(name, component) is deprecated. Use component(\"Name\", factory), instance.use(definition), or instance.registry.register(name, component).",
  );

  return defaultComponentRegistry.register(
    normalizeComponentName(name),
    componentValue as ComponentLike,
  );
}

/** Removes a component from the default singleton registry. */
export function unregisterComponent(name: string): boolean {
  return defaultComponentRegistry.unregister(name);
}

/** Resolves a component from the current/default instance registry. */
export function resolveComponent(name: string): ComponentLike | undefined {
  return getCurrentFabricaRuntime().registry.resolve(name);
}

/** Returns a snapshot of current/default registered components. */
export function listComponents(): Map<string, ComponentLike> {
  return getCurrentFabricaRuntime().registry.list();
}

/** Clears current/default named components. */
export function clearComponents(): void {
  getCurrentFabricaRuntime().registry.clear();
}

/**
 * Materializes a component render request into a DOM range.
 *
 * @remarks
 * The active Fabrica runtime is captured before ownership creation and restored
 * around setup and child insertion. Reactive updates therefore keep resolving
 * named tags against the instance that originally mounted the component.
 */
export function materializeComponent<Props extends object>(
  request: ComponentRenderRequest<Props>,
): DocumentFragment {
  const runtime = getCurrentFabricaRuntime();
  const displayName = request.component.displayName || request.component.factory?.name || "AnonymousComponent";
  const factory = request.component.factory as ComponentFactory<Props> | undefined;

  if (!factory) {
    throw new Error(`[Fabrica] Component ${displayName} has no factory.`);
  }

  const mountCallbacks: Array<() => void | Cleanup> = [];
  const start = document.createComment(`fabrica:component:${displayName}:start`);
  const end = document.createComment(`fabrica:component:${displayName}:end`);
  const fragment = document.createDocumentFragment();

  let componentDispose: Cleanup | null = null;
  let componentOwner: Parameters<typeof runWithOwner>[0] | null = null;
  const parentOwner = getOwner();

  const [content, dispose] = createRoot<RenderValue>((disposeOwner, owner) => {
    const instance = runtime.api as RuntimeApiShape;
    const context: ComponentContext = {
      name: displayName,
      instance,
      registry: runtime.registry,
      html: instance.html,
      jsx: instance.jsx,
      component: instance.component,
      owner,
      id: `fabrica-${++componentId}`,
      signal,
      effect,
      computed,
      memo,
      batch,
      untrack,
      resource,
      onMount(callback) {
        mountCallbacks.push(callback);
      },
      onUnmount(callback) {
        runWithOwner(owner, () => {
          owner.cleanups.push(callback);
        });
      },
      onDispose(callback) {
        runWithOwner(owner, () => {
          owner.cleanups.push(callback);
        });
      },
      provide(contextToken, value) {
        return runWithOwner(owner, () => provide(contextToken, value));
      },
      useContext(contextToken) {
        return runWithOwner(owner, () => useContext(contextToken));
      },
      ref(callback) {
        return ref((node) => {
          const cleanup = callback(node);
          if (typeof cleanup === "function") owner.cleanups.push(cleanup);
        });
      },
    };

    componentDispose = disposeOwner;
    componentOwner = owner;

    try {
      return runWithFabricaRuntime(runtime, () => factory(request.props, context));
    } catch (error) {
      if (!handleOwnerError(error, owner)) throw error;
      return null;
    }
  }, { name: displayName, parent: parentOwner });

  fragment.append(start);

  runWithFabricaRuntime(runtime, () => {
    if (componentOwner) {
      runWithOwner(componentOwner, () => appendValue(fragment, content));
    } else {
      appendValue(fragment, content);
    }
  });

  fragment.append(end);

  registerCleanup(start, () => {
    componentDispose?.();
    dispose();
    componentDispose = null;
    mountCallbacks.length = 0;
  });

  queueMicrotask(() => {
    if (!start.isConnected) return;

    for (let index = 0; index < mountCallbacks.length; index += 1) {
      try {
        const cleanup = runWithFabricaRuntime(runtime, () => mountCallbacks[index]?.());
        if (typeof cleanup === "function") registerCleanup(start, cleanup);
      } catch (error) {
        handleOwnerError(error, null);
      }
    }

    mountCallbacks.length = 0;
  });

  return fragment;
}
