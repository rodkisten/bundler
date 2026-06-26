import { HTML_TAGS } from './html-tags'
import { resolveAdapter } from './adapters'
import { composeProps } from './composition'
import { applyProps } from './props'
import { StyledRegistryBridge } from './registry'
import type {
  ElementsAdapter,
  ElementsComponent,
  ElementsRecord,
  NamedStyledBuilder,
  StyledAttrs,
  StyledBuilder,
  StyledComponent,
  StyledComponentOptions,
  StyledDomResult,
  StyledFactory,
  StyledFactoryOptions,
  StyledNamedComponentOptions,
  StyledRegistryCollision,
  StyledRegistryOptions,
  StyledTagFactory,
} from './types'
import { isDomElement } from './utils'

/**
 * Creates a styled-component-like factory from an external style compiler.
 *
 * @remarks
 * Cipó supplies `createStyle`; Fabrica Elements owns component creation,
 * polymorphic `as`, attrs, adapter output, metadata and optional Fabrica registry
 * registration. Named components register through a structural bridge without
 * importing Fabrica, so independently bundled globals remain loosely coupled.
 */
export function createStyledFactory<Artifact = unknown>(options: StyledFactoryOptions<Artifact>): StyledFactory<Artifact> {
  const registry = new StyledRegistryBridge(options)
  const styledTagCache = Object.create(null) as Record<string, StyledTagFactory<Artifact> | undefined>
  const getStyledTagFactory = (tag: string): StyledTagFactory<Artifact> => (
    styledTagCache[tag] ?? (styledTagCache[tag] = createStyledTagFactory(tag, options, registry))
  )

  const base = ((target: unknown, name?: string) => (
    styledCore(target, name, options, registry, getStyledTagFactory)
  )) as StyledFactory<Artifact>

  Object.defineProperties(base, {
    component: {
      enumerable: false,
      value(name: string, componentOptions: StyledNamedComponentOptions = {}) {
        const target = componentOptions.as ?? 'div'
        const builder = typeof target === 'string'
          ? getStyledTagFactory(target)(name, componentOptions)
          : createNamedBuilder(target, name, componentOptions, options, registry)
        return builder
      },
    },
    connectRegistry: {
      enumerable: false,
      value: registry.connect.bind(registry),
    },
    disconnectRegistry: {
      enumerable: false,
      value: registry.disconnect.bind(registry),
    },
    configureRegistry: {
      enumerable: false,
      value: (next: StyledRegistryOptions) => registry.configure(next),
    },
    flushRegistry: {
      enumerable: false,
      value: registry.flush.bind(registry),
    },
    pendingComponents: {
      enumerable: false,
      value: registry.pendingNames.bind(registry),
    },
  })

  if (typeof Proxy === 'undefined') {
    installStyledTagFactories(base, getStyledTagFactory)
    return base
  }

  return new Proxy(base, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver)
      if (typeof property === 'string') return getStyledTagFactory(property)
      return undefined
    },
  })
}

function styledCore<Artifact>(
  target: unknown,
  name: string | undefined,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  getStyledTagFactory: (tag: string) => StyledTagFactory<Artifact>,
): StyledBuilder {
  if (isDomElement(target)) return createDomElementBuilder(target, options)
  if (typeof target === 'string') return getStyledTagFactory(target)
  return createComponentBuilder(target, name, options, registry)
}

function createDomElementBuilder<ElementType extends Element, Artifact>(
  element: ElementType,
  options: StyledFactoryOptions<Artifact>,
): StyledBuilder<StyledDomResult<ElementType, Artifact>> {
  return {
    css(strings, ...values) {
      const resolved = options.createStyle(strings, values)
      applyClassNameToElement(element, resolved.className)
      return { element, artifact: resolved.artifact, className: resolved.className }
    },
    named() {
      throw new Error('[Fabrica Elements] Existing DOM elements cannot be registered as reusable named components.')
    },
  }
}

function createComponentBuilder<Props extends ElementsRecord, Artifact>(
  component: unknown,
  name: string | undefined,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
): StyledBuilder<StyledComponent<Props, Artifact>> {
  return {
    css(strings, ...values) {
      return createStyledComponent(component, name, undefined, options.createStyle(strings, values), options, registry) as StyledComponent<Props, Artifact>
    },
    named(nextName, componentOptions) {
      return createNamedBuilder(component, nextName, componentOptions, options, registry) as NamedStyledBuilder<StyledComponent<Props, Artifact>>
    },
  }
}

function createStyledTagFactory<Artifact>(
  tag: string,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  defaultAttrs?: StyledAttrs,
): StyledTagFactory<Artifact> {
  const compile = (
    strings: TemplateStringsArray,
    values: readonly unknown[],
    name?: string,
    componentOptions?: StyledComponentOptions,
  ): StyledComponent<ElementsRecord, Artifact> => (
    createStyledComponent(tag, name, mergeAttrs(defaultAttrs, componentOptions?.attrs), options.createStyle(strings, values), options, registry, componentOptions?.collision)
  )

  const factory = ((first: string | TemplateStringsArray, ...rest: readonly unknown[]) => {
    if (isTemplateStringsArray(first)) return compile(first, rest)
    if (typeof first === 'string') return createNamedBuilder(tag, first, rest[0] as StyledComponentOptions | undefined, options, registry, defaultAttrs)
    throw new TypeError('[Fabrica Elements] styled tag factories expect a component name or a template literal.')
  }) as StyledTagFactory<Artifact>

  factory.css = (strings, ...values) => compile(strings, values)
  factory.named = (name, componentOptions) => createNamedBuilder(tag, name, componentOptions, options, registry, defaultAttrs)
  factory.attrs = (nextAttrs) => createStyledTagFactory(tag, options, registry, mergeAttrs(defaultAttrs, nextAttrs))
  return factory
}

function createNamedBuilder<Artifact>(
  target: unknown,
  name: string,
  componentOptions: StyledComponentOptions | undefined,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  inheritedAttrs?: StyledAttrs,
): NamedStyledBuilder<StyledComponent<ElementsRecord, Artifact>> {
  const compile = (strings: TemplateStringsArray, values: readonly unknown[]): StyledComponent<ElementsRecord, Artifact> => {
    const attrs = mergeAttrs(inheritedAttrs, componentOptions?.attrs)
    return createStyledComponent(target, name, attrs, options.createStyle(strings, values), options, registry, componentOptions?.collision)
  }
  const builder = ((strings: TemplateStringsArray, ...values: readonly unknown[]) => compile(strings, values)) as NamedStyledBuilder<StyledComponent<ElementsRecord, Artifact>>
  builder.css = (strings, ...values) => compile(strings, values)
  return builder
}

function createStyledComponent<Artifact>(
  target: unknown,
  displayName: string | undefined,
  attrs: StyledAttrs | undefined,
  resolved: { className: string; artifact: Artifact },
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  collision?: StyledRegistryCollision,
): StyledComponent<ElementsRecord, Artifact> {
  const adapter = resolveFactoryAdapter(options)
  let registeredName = displayName?.trim() || undefined

  const styledComponent = ((props: ElementsRecord = {}) => {
    const defaultProps = resolveAttrs(attrs, props)
    const merged = composeProps(defaultProps, props)
    const requestedTarget = merged.as
    if (Object.prototype.hasOwnProperty.call(merged, 'as')) delete merged.as
    return createStyledOutput(requestedTarget ?? target, merged, resolved.className, adapter)
  }) as StyledComponent<ElementsRecord, Artifact>

  Object.defineProperties(styledComponent, {
    displayName: { configurable: false, enumerable: false, value: displayName },
    className: { configurable: false, enumerable: true, value: resolved.className },
    artifact: { configurable: false, enumerable: true, value: resolved.artifact },
    target: { configurable: false, enumerable: false, value: target },
    tag: { configurable: false, enumerable: true, value: typeof target === 'string' ? target : undefined },
    registeredName: { configurable: false, enumerable: true, get: () => registeredName },
    register: {
      configurable: false,
      enumerable: false,
      value(name = registeredName, nextCollision = collision) {
        if (!name) throw new Error('[Fabrica Elements] register() requires a component name.')
        registeredName = name.trim()
        return registry.register(registeredName, styledComponent, nextCollision, true)
      },
    },
    unregister: {
      configurable: false,
      enumerable: false,
      value() {
        return registeredName ? registry.unregister(registeredName) : false
      },
    },
    withComponent: {
      configurable: false,
      enumerable: false,
      value(nextTarget: unknown) {
        return createStyledComponent(nextTarget, undefined, attrs, resolved, options, registry)
      },
    },
    toString: {
      configurable: false,
      enumerable: false,
      value: () => resolved.className,
    },
  })

  if (registeredName) registry.register(registeredName, styledComponent, collision)
  return styledComponent
}

function createStyledOutput(
  target: unknown,
  props: ElementsRecord,
  className: string,
  adapter: ElementsAdapter,
): unknown {
  if (typeof target === 'string') {
    if (adapter.createElement) return adapter.createElement(target, props, className)
    return { tag: target, props: adapter.mergeProps(props, className) }
  }

  const nextProps = adapter.mergeProps(props, className)
  if (typeof target === 'function') return (target as ElementsComponent)(nextProps)
  return { component: target, props: nextProps }
}

function resolveAttrs(attrs: StyledAttrs | undefined, props: ElementsRecord): ElementsRecord | undefined {
  if (!attrs) return undefined
  const value = typeof attrs === 'function' ? attrs(props) : attrs
  return value && typeof value === 'object' ? value : undefined
}

function mergeAttrs(left: StyledAttrs | undefined, right: StyledAttrs | undefined): StyledAttrs | undefined {
  if (!left) return right
  if (!right) return left
  return (props: ElementsRecord) => composeProps(resolveAttrs(left, props), resolveAttrs(right, props))
}

function applyClassNameToElement(element: Element, className: string): void {
  const current = element.getAttribute('class') ?? ''
  applyProps(element, { class: `${current} ${className}` })
}

function resolveFactoryAdapter(options: StyledFactoryOptions): ElementsAdapter {
  const value = typeof options.adapter === 'function' ? options.adapter() : options.adapter
  return resolveAdapter(value)
}

function installStyledTagFactories<Artifact>(
  target: StyledFactory<Artifact>,
  getStyledTagFactory: (tag: string) => StyledTagFactory<Artifact>,
): void {
  for (let index = 0; index < HTML_TAGS.length; index += 1) {
    const tag = HTML_TAGS[index]
    Object.defineProperty(target, tag, { configurable: true, enumerable: false, value: getStyledTagFactory(tag) })
  }
}

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'raw')
}
