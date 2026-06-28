import { warnDeprecated } from "./deprecations";
import type {
  Component,
  ComponentLike,
  ComponentProps,
  ComponentRegistry,
  ComponentRegistryOptions,
  RegistryCollision,
  RegistryRegistrationOptions,
} from "./types";

const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9_$.-]*$/;

/** Normalizes names once at registry boundaries instead of on every render. */
export function normalizeComponentName(name: unknown): string {
  if (typeof name !== "string") return name == null ? "" : String(name).trim();
  const length = name.length;
  if (length === 0) return "";

  // Component names emitted by the template compiler are already normalized.
  // Avoid allocating a second string on the registry's hottest lookup path.
  const first = name.charCodeAt(0);
  const last = name.charCodeAt(length - 1);
  return first > 32 && last > 32 ? name : name.trim();
}

/** Returns whether a name is safe for uppercase component-tag syntax. */
export function isRegisteredComponentName(name: unknown): boolean {
  return COMPONENT_NAME_RE.test(normalizeComponentName(name));
}

/**
 * Map-backed registry with an optional parent overlay.
 *
 * @remarks
 * Resolution is intentionally one `Map.get()` in the common case. Forked
 * registries add one predictable parent lookup and never clone component
 * functions. This keeps isolated plugins cheap while allowing copy-on-write
 * design-system overrides.
 */
export class FabricaComponentRegistry implements ComponentRegistry {
  readonly #components = new Map<string, ComponentLike>();
  readonly #resolveCache = new Map<string, { version: number; value: ComponentLike | undefined }>();
  #parent: ComponentRegistry | undefined;
  #version = 0;
  readonly name: string;

  constructor(options: ComponentRegistryOptions = {}) {
    this.name = normalizeComponentName(options.name) || "registry";
    this.#parent = options.parent;

    if (options.entries) {
      for (const [name, component] of options.entries) {
        this.register(name, component, { collision: "replace" });
      }
    }
  }

  get parent(): ComponentRegistry | undefined {
    return this.#parent;
  }

  get size(): number {
    return this.#components.size;
  }

  get version(): number {
    return this.#version + (this.#parent?.version ?? 0);
  }

  register<T extends ComponentLike>(
    name: string,
    component: T,
    options: RegistryRegistrationOptions = {},
  ): T {
    const normalized = normalizeComponentName(name);
    if (!normalized) {
      throw new Error("[Fabrica] Component registry needs a non-empty name.");
    }
    if (typeof component !== "function") {
      throw new TypeError("[Fabrica] Component registry expects a function component.");
    }

    const own = this.#components.get(normalized);
    if (own === component) return component;

    const collision = options.collision ?? "replace";
    const existing = own ?? this.#parent?.resolve(normalized);

    // Reusing an inherited definition should not allocate a redundant overlay
    // entry or invalidate registry consumers that watch the version counter.
    if (!own && existing === component) return component;

    if (existing && existing !== component) {
      if (collision === "keep") return existing as T;
      if (collision === "error") {
        throw new Error(`[Fabrica] Component registry collision for "${normalized}".`);
      }
      if (collision === "warn") {
        options.onWarning?.(
          `[Fabrica] Component "${normalized}" already exists in registry "${this.name}"; keeping the existing component.`,
        );
        if (!options.onWarning && typeof console !== "undefined") {
          console.warn(
            `[Fabrica] Component "${normalized}" already exists in registry "${this.name}"; keeping the existing component.`,
          );
        }
        return existing as T;
      }
    }

    if (this.#components.get(normalized) !== component) {
      this.#components.set(normalized, component);
      this.#version += 1;
      this.#resolveCache.clear();
    }

    return component;
  }

  unregister(name: string): boolean {
    const removed = this.#components.delete(normalizeComponentName(name));
    if (removed) {
      this.#version += 1;
      this.#resolveCache.clear();
    }
    return removed;
  }

  resolve(name: string): ComponentLike | undefined {
    const normalized = normalizeComponentName(name);
    if (!normalized) return undefined;

    const own = this.#components.get(normalized);
    if (own) return own;

    const parent = this.#parent;
    if (!parent) return undefined;

    const version = parent.version;
    const cached = this.#resolveCache.get(normalized);
    if (cached && cached.version === version) return cached.value;

    const value = parent.resolve(normalized);
    this.#resolveCache.set(normalized, { version, value });
    return value;
  }

  has(name: string, ownOnly = false): boolean {
    const normalized = normalizeComponentName(name);
    return this.#components.has(normalized) || (!ownOnly && Boolean(this.#parent?.has(normalized)));
  }

  list(options: { inherited?: boolean } = {}): Map<string, ComponentLike> {
    const inherited = options.inherited !== false;
    const output = inherited && this.#parent
      ? this.#parent.list({ inherited: true })
      : new Map<string, ComponentLike>();

    for (const [name, component] of this.#components) output.set(name, component);
    return output;
  }

  clear(options: { inherited?: boolean } = {}): void {
    if (this.#components.size > 0) {
      this.#components.clear();
      this.#version += 1;
      this.#resolveCache.clear();
    }
    if (options.inherited) this.#parent?.clear({ inherited: true });
  }

  import(
    source: ComponentRegistry,
    options: RegistryRegistrationOptions & { namespace?: string } = {},
  ): number {
    const namespace = normalizeComponentName(options.namespace);
    let imported = 0;

    for (const [name, component] of source.list({ inherited: true })) {
      this.register(namespace ? `${namespace}${name}` : name, component, options);
      imported += 1;
    }

    return imported;
  }

  fork(name = `${this.name}:fork`): ComponentRegistry {
    return new FabricaComponentRegistry({ name, parent: this });
  }

  snapshot(name = `${this.name}:snapshot`): ComponentRegistry {
    return new FabricaComponentRegistry({
      name,
      entries: this.list({ inherited: true }),
    });
  }

  setParent(parent: ComponentRegistry | undefined): void {
    let cursor = parent;
    while (cursor) {
      if (cursor === this) {
        throw new Error("[Fabrica] Component registry inheritance cannot contain cycles.");
      }
      cursor = cursor.parent;
    }

    if (this.#parent === parent) return;
    this.#parent = parent;
    this.#version += 1;
    this.#resolveCache.clear();
  }

  /** @deprecated Use `registry.register(name, component)` or `instance.use(component)`. */
  registerComponent<T extends ComponentLike>(name: string, component: T): T {
    warnDeprecated(
      "registry.registerComponent",
      "[Fabrica] registry.registerComponent(name, component) is deprecated. Use registry.register(name, component), instance.component(name, factory), or instance.use(definition).",
    );
    return this.register(name, component);
  }

  /** @deprecated Use `registry.unregister(name)`. */
  unregisterComponent(name: string): boolean {
    return this.unregister(name);
  }

  /** @deprecated Use `registry.resolve(name)`. */
  resolveComponent(name: string): ComponentLike | undefined {
    return this.resolve(name);
  }

  /** @deprecated Use `registry.list()`. */
  listComponents(): Map<string, ComponentLike> {
    return this.list();
  }

  /** @deprecated Use `registry.clear()`. */
  clearComponents(): void {
    this.clear();
  }
}

/** Creates an isolated or parent-backed component registry. */
export function createComponentRegistry(options: ComponentRegistryOptions = {}): ComponentRegistry {
  return new FabricaComponentRegistry(options);
}

/** Default singleton registry used by the compatibility/global API. */
export const defaultComponentRegistry = createComponentRegistry({ name: "default" });

/** Fast structural registry resolver used by instance and adapter APIs. */
export function resolveRegistry(value: unknown): ComponentRegistry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as {
    registry?: unknown;
    resolve?: unknown;
    register?: unknown;
    resolveComponent?: unknown;
    registerComponent?: unknown;
  };

  if (candidate.registry) return resolveRegistry(candidate.registry);
  if (typeof candidate.resolve === "function" && typeof candidate.register === "function") {
    return value as ComponentRegistry;
  }

  if (typeof candidate.resolveComponent === "function" && typeof candidate.registerComponent === "function") {
    return createLegacyRegistryAdapter(value as LegacyRegistryShape);
  }

  return undefined;
}

type LegacyRegistryShape = {
  registerComponent(name: string, component: ComponentLike): unknown;
  unregisterComponent?(name: string): boolean;
  resolveComponent(name: string): ComponentLike | undefined;
  listComponents?(): Map<string, ComponentLike>;
  clearComponents?(): void;
};

const legacyRegistryAdapters = new WeakMap<object, ComponentRegistry>();

function createLegacyRegistryAdapter(legacy: LegacyRegistryShape): ComponentRegistry {
  const cached = legacyRegistryAdapters.get(legacy as object);
  if (cached) return cached;

  const adapter: ComponentRegistry = {
    name: "legacy-adapter",
    get size() {
      return legacy.listComponents?.().size ?? 0;
    },
    get version() {
      return 0;
    },
    register(name, component) {
      legacy.registerComponent(name, component);
      return component;
    },
    unregister(name) {
      return legacy.unregisterComponent?.(name) ?? false;
    },
    resolve(name) {
      return legacy.resolveComponent(name);
    },
    has(name) {
      return Boolean(legacy.resolveComponent(name));
    },
    list() {
      return legacy.listComponents?.() ?? new Map();
    },
    clear() {
      legacy.clearComponents?.();
    },
    import(source, options) {
      let count = 0;
      for (const [name, component] of source.list()) {
        this.register(options?.namespace ? `${options.namespace}${name}` : name, component, options);
        count += 1;
      }
      return count;
    },
    fork(name) {
      return new FabricaComponentRegistry({ name, parent: this });
    },
    snapshot(name) {
      return new FabricaComponentRegistry({ name, entries: this.list() });
    },
    setParent() {
      throw new Error("[Fabrica] Legacy registry adapters cannot change parent registry.");
    },
    registerComponent(name, component) {
      legacy.registerComponent(name, component);
      return component;
    },
    unregisterComponent(name) {
      return legacy.unregisterComponent?.(name) ?? false;
    },
    resolveComponent(name) {
      return legacy.resolveComponent(name);
    },
    listComponents() {
      return legacy.listComponents?.() ?? new Map();
    },
    clearComponents() {
      legacy.clearComponents?.();
    },
  };

  legacyRegistryAdapters.set(legacy as object, adapter);
  return adapter;
}

/** Type-level compatibility helper for external adapters. */
export type RegisteredComponent<Props extends object = ComponentProps> = Component<Props>;
export type { RegistryCollision };
