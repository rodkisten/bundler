import type {
  ElementsComponent,
  ElementsComponentRegistry,
  StyledRegistrationStatus,
  StyledRegistryCollision,
  StyledRegistryOptions,
} from './types'

/** Shared symbol allows independently bundled Cipó/Fabrica runtimes to handshake. */
const REGISTRY_LISTENERS = Symbol.for('rod.fabrica.registry.listeners')

/** Event name is also emitted for non-Rod integrations and browser diagnostics. */
export const FABRICA_REGISTRY_READY_EVENT = 'fabrica:registry-ready'

type RegistryListener = (registry: ElementsComponentRegistry) => void

type PendingRegistration = {
  readonly name: string
  readonly component: ElementsComponent
  readonly collision: StyledRegistryCollision
}

type MutableRegistryOptions = {
  autoRegister: boolean
  collision: StyledRegistryCollision
  registry?: ElementsComponentRegistry | (() => ElementsComponentRegistry | undefined)
  onWarning?: (message: string) => void
}

/**
 * Small per-factory registry coordinator.
 *
 * @remarks
 * The bridge performs no polling. Named components either register immediately,
 * queue in a Map, or flush when Fabrica announces readiness through a shared
 * `Symbol.for()` listener set. This works when Cipó and Fabrica are shipped as
 * separate IIFE bundles, ESM modules, tests or userscripts.
 */
export class StyledRegistryBridge {
  readonly #pending = new Map<string, PendingRegistration>()
  readonly #listener: RegistryListener
  #explicitRegistry: ElementsComponentRegistry | undefined
  #options: MutableRegistryOptions
  #unsubscribe: (() => void) | undefined

  constructor(options: StyledRegistryOptions = {}) {
    this.#options = normalizeOptions(options)
    this.#listener = (registry) => {
      if (!this.#explicitRegistry) this.#explicitRegistry = registry
      this.flush()
    }
  }

  configure(options: StyledRegistryOptions): void {
    this.#options = {
      ...this.#options,
      ...options,
      autoRegister: options.autoRegister ?? this.#options.autoRegister,
      collision: options.collision ?? this.#options.collision,
    }
    if (options.registry && typeof options.registry !== 'function') this.#explicitRegistry = unwrapRegistry(options.registry)
    this.flush()
  }

  connect(registry: ElementsComponentRegistry): number {
    const resolved = unwrapRegistry(registry)
    assertRegistry(resolved)
    this.#explicitRegistry = resolved
    return this.flush()
  }

  disconnect(registry?: ElementsComponentRegistry): void {
    const resolved = registry ? unwrapRegistry(registry) : undefined
    if (!resolved || this.#explicitRegistry === resolved) this.#explicitRegistry = undefined
  }

  register(
    name: string,
    component: ElementsComponent,
    collision = this.#options.collision,
    force = false,
  ): StyledRegistrationStatus {
    const normalizedName = normalizeName(name)
    if (!normalizedName) throw new Error('[Fabrica Elements] Named styled components require a non-empty name.')
    if (typeof component !== 'function') throw new TypeError('[Fabrica Elements] Registry components must be functions.')
    if (!force && !this.#options.autoRegister) return 'disabled'

    const registry = this.resolveRegistry()
    if (!registry) {
      this.#pending.set(normalizedName, { name: normalizedName, component, collision })
      this.#ensureSubscription()
      return 'queued'
    }

    this.#pending.delete(normalizedName)
    return registerIntoRegistry(registry, normalizedName, component, collision, this.#warn)
  }

  unregister(name: string): boolean {
    const normalizedName = normalizeName(name)
    this.#pending.delete(normalizedName)
    const registry = this.resolveRegistry()
    return Boolean(normalizedName && registry && unregisterNamedComponent(registry, normalizedName))
  }

  flush(): number {
    const registry = this.resolveRegistry()
    if (!registry || this.#pending.size === 0) return 0

    const queued = Array.from(this.#pending.values())
    let applied = 0
    for (let index = 0; index < queued.length; index += 1) {
      const item = queued[index]!
      const status = registerIntoRegistry(registry, item.name, item.component, item.collision, this.#warn)
      if (status !== 'queued' && status !== 'disabled') {
        this.#pending.delete(item.name)
        applied += 1
      }
    }
    if (this.#pending.size === 0) this.#releaseSubscription()
    return applied
  }

  #ensureSubscription(): void {
    if (!this.#unsubscribe) this.#unsubscribe = subscribeRegistryReady(this.#listener)
  }

  #releaseSubscription(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
  }

  pendingNames(): readonly string[] {
    return Object.freeze(Array.from(this.#pending.keys()))
  }

  resolveRegistry(): ElementsComponentRegistry | undefined {
    if (this.#explicitRegistry) return this.#explicitRegistry
    const configured = this.#options.registry
    if (configured) {
      const registry = unwrapRegistry(typeof configured === 'function' ? configured() : configured)
      if (registry) return registry
    }
    return resolveGlobalFabricaRegistry()
  }

  readonly #warn = (message: string): void => {
    if (this.#options.onWarning) {
      this.#options.onWarning(message)
      return
    }
    if (typeof console !== 'undefined' && typeof console.warn === 'function') console.warn(message)
  }
}

/** Announces a registry to every independently created styled factory bridge. */
export function notifyFabricaRegistryReady(registry: ElementsComponentRegistry): void {
  const resolved = unwrapRegistry(registry)
  assertRegistry(resolved)
  const listeners = getRegistryListeners()
  const callbacks = Array.from(listeners)
  for (let index = 0; index < callbacks.length; index += 1) callbacks[index]?.(resolved)

  const target = resolveEventTarget()
  const CustomEventConstructor = (globalThis as typeof globalThis & { CustomEvent?: typeof CustomEvent }).CustomEvent
  if (target && typeof CustomEventConstructor === 'function') {
    target.dispatchEvent(new CustomEventConstructor(FABRICA_REGISTRY_READY_EVENT, { detail: resolved }))
  }
}

/** Returns a structural global Fabrica registry when its bundle is installed. */
export function resolveGlobalFabricaRegistry(): ElementsComponentRegistry | undefined {
  const candidate = (globalThis as typeof globalThis & { Fabrica?: unknown }).Fabrica
  const resolved = unwrapRegistry(candidate)
  return isRegistry(resolved) ? resolved : undefined
}

function subscribeRegistryReady(listener: RegistryListener): () => void {
  const listeners = getRegistryListeners()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getRegistryListeners(): Set<RegistryListener> {
  const target = globalThis as typeof globalThis & Record<PropertyKey, unknown>
  let listeners = target[REGISTRY_LISTENERS] as Set<RegistryListener> | undefined
  if (!listeners) {
    listeners = new Set<RegistryListener>()
    Object.defineProperty(target, REGISTRY_LISTENERS, {
      configurable: true,
      enumerable: false,
      value: listeners,
    })
  }
  return listeners
}

function registerIntoRegistry(
  registry: ElementsComponentRegistry,
  name: string,
  component: ElementsComponent,
  collision: StyledRegistryCollision,
  warn: (message: string) => void,
): StyledRegistrationStatus {
  const existing = resolveRegisteredComponent(registry, name)
  if (!existing) {
    registerNamedComponent(registry, name, component, collision)
    return 'registered'
  }
  if (existing === component) return 'existing'

  if (collision === 'ignore') return 'ignored'
  if (collision === 'error') {
    throw new Error(`[Fabrica Elements] Component registry collision for "${name}".`)
  }
  if (collision === 'warn') {
    warn(`[Fabrica Elements] Component "${name}" already exists; keeping the registered component.`)
    return 'ignored'
  }

  unregisterNamedComponent(registry, name)
  registerNamedComponent(registry, name, component, collision)
  return 'replaced'
}

function normalizeOptions(options: StyledRegistryOptions): MutableRegistryOptions {
  return {
    autoRegister: options.autoRegister ?? false,
    collision: options.collision ?? 'warn',
    registry: options.registry,
    onWarning: options.onWarning,
  }
}

function normalizeName(name: string): string {
  return String(name || '').trim()
}

function unwrapRegistry(value: unknown): ElementsComponentRegistry | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as ElementsComponentRegistry
  if (candidate.registry && candidate.registry !== candidate) return unwrapRegistry(candidate.registry)
  return candidate
}

function resolveRegisteredComponent(registry: ElementsComponentRegistry, name: string): unknown {
  return registry.resolve?.(name) ?? registry.resolveComponent?.(name)
}

function registerNamedComponent(
  registry: ElementsComponentRegistry,
  name: string,
  component: ElementsComponent,
  collision: StyledRegistryCollision,
): unknown {
  if (typeof registry.register === 'function') {
    const mappedCollision = collision === 'ignore' ? 'keep' : collision
    return registry.register(name, component, { collision: mappedCollision })
  }
  return registry.registerComponent?.(name, component)
}

function unregisterNamedComponent(registry: ElementsComponentRegistry, name: string): boolean {
  if (typeof registry.unregister === 'function') return registry.unregister(name)
  return registry.unregisterComponent?.(name) ?? false
}

function assertRegistry(value: unknown): asserts value is ElementsComponentRegistry {
  if (!isRegistry(value)) {
    throw new TypeError('[Fabrica Elements] Registry must expose register()/resolve() or legacy registerComponent()/resolveComponent().')
  }
}

function isRegistry(value: unknown): value is ElementsComponentRegistry {
  if (!value || typeof value !== 'object') return false
  const registry = unwrapRegistry(value)
  return Boolean(
    registry && (
      (typeof registry.register === 'function' && typeof registry.resolve === 'function') ||
      (typeof registry.registerComponent === 'function' && typeof registry.resolveComponent === 'function')
    )
  )
}

function resolveEventTarget(): EventTarget | undefined {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') return window
  if (typeof (globalThis as { dispatchEvent?: unknown }).dispatchEvent === 'function') return globalThis as unknown as EventTarget
  return undefined
}
