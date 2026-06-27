import { HTML_TAGS } from './html-tags'
import { resolveAdapter } from './adapters'
import { composeProps } from './composition'
import { applyProps } from './props'
import { StyledRegistryBridge } from './registry'
import type {
  ElementsAdapter,
  ElementsComponent,
  ElementsRecord,
  ElementsResolvedStyle,
  ElementsStyleInput,
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
import { isDomElement, isPlainObject, mergeClassNames } from './utils'

type DynamicStyle<Props extends ElementsRecord, Artifact> = (
  props: Props,
) => ElementsStyleInput<Props, Artifact>

type ResolvedStyleSet<Artifact> = {
  className: string
  style?: unknown
  artifacts: Artifact[]
}

type StylePlan<Props extends ElementsRecord, Artifact> = {
  staticStyle: ResolvedStyleSet<Artifact>
  dynamicStyles: readonly DynamicStyle<Props, Artifact>[]
}

const EMPTY_PROPS: ElementsRecord = Object.freeze({})
const MAX_STYLE_RESOLUTION_DEPTH = 24

/**
 * Creates a styled-component-like factory from an external style compiler.
 *
 * @remarks
 * Cipó supplies `createStyle` and `resolveStyle`; Fabrica Elements owns
 * component creation, polymorphic `as`, attrs, adapter output, metadata and the
 * optional Fabrica registry bridge. Style definitions may be tagged templates,
 * precompiled artifacts, arrays, conditionals or prop-driven functions.
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
        return typeof target === 'string'
          ? getStyledTagFactory(target)(name, componentOptions)
          : createNamedBuilder(target, name, componentOptions, options, registry)
      },
    },
    connectRegistry: { enumerable: false, value: registry.connect.bind(registry) },
    disconnectRegistry: { enumerable: false, value: registry.disconnect.bind(registry) },
    configureRegistry: { enumerable: false, value: (next: StyledRegistryOptions) => registry.configure(next) },
    flushRegistry: { enumerable: false, value: registry.flush.bind(registry) },
    pendingComponents: { enumerable: false, value: registry.pendingNames.bind(registry) },
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
): unknown {
  if (isDomElement(target)) return createDomElementBuilder(target, options)
  if (typeof target === 'string') return getStyledTagFactory(target)
  return createComponentBuilder(target, name, options, registry)
}

function createDomElementBuilder<ElementType extends Element, Artifact>(
  element: ElementType,
  options: StyledFactoryOptions<Artifact>,
): StyledBuilder<ElementsRecord, Artifact, StyledDomResult<ElementType, Artifact>> {
  const applyPlan = (plan: StylePlan<ElementsRecord, Artifact>): StyledDomResult<ElementType, Artifact> => {
    const resolved = resolveStylePlan(plan, EMPTY_PROPS, options)
    applyResolvedStyleToElement(element, resolved)
    const artifacts = Object.freeze(resolved.artifacts.slice())
    return {
      element,
      className: resolved.className,
      artifacts,
      artifact: metadataArtifact(artifacts),
    }
  }

  const builder = ((first: unknown, ...values: readonly unknown[]) => (
    isTemplateStringsArray(first)
      ? applyPlan(createTemplateStylePlan(first, values, options))
      : applyPlan(createStylePlan(first as ElementsStyleInput<ElementsRecord, Artifact>, options))
  )) as StyledBuilder<ElementsRecord, Artifact, StyledDomResult<ElementType, Artifact>>

  builder.css = (strings, ...values) => applyPlan(createTemplateStylePlan(strings, values, options))
  builder.named = () => {
    throw new Error('[Fabrica Elements] Existing DOM elements cannot be registered as reusable named components.')
  }
  return builder
}

function createComponentBuilder<Props extends ElementsRecord, Artifact>(
  component: unknown,
  name: string | undefined,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
): StyledBuilder<Props, Artifact, StyledComponent<Props, Artifact>> {
  const compilePlan = (plan: StylePlan<Props, Artifact>) => (
    createStyledComponent(component, name, undefined, plan, options, registry) as StyledComponent<Props, Artifact>
  )

  const builder = ((first: unknown, ...values: readonly unknown[]) => (
    isTemplateStringsArray(first)
      ? compilePlan(createTemplateStylePlan(first, values, options) as StylePlan<Props, Artifact>)
      : compilePlan(createStylePlan(first as ElementsStyleInput<Props, Artifact>, options))
  )) as StyledBuilder<Props, Artifact, StyledComponent<Props, Artifact>>

  builder.css = (strings, ...values) => compilePlan(createTemplateStylePlan(strings, values, options) as StylePlan<Props, Artifact>)
  builder.named = (nextName, componentOptions) => (
    createNamedBuilder(component, nextName, componentOptions, options, registry) as NamedStyledBuilder<Props, Artifact, StyledComponent<Props, Artifact>>
  )
  return builder
}

function createStyledTagFactory<Artifact>(
  tag: string,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  defaultAttrs?: StyledAttrs,
): StyledTagFactory<Artifact> {
  const compilePlan = (
    plan: StylePlan<ElementsRecord, Artifact>,
    name?: string,
    componentOptions?: StyledComponentOptions,
  ): StyledComponent<ElementsRecord, Artifact> => (
    createStyledComponent(
      tag,
      name,
      mergeAttrs(defaultAttrs, componentOptions?.attrs),
      plan,
      options,
      registry,
      componentOptions?.collision,
    )
  )

  const factory = ((first: unknown, ...rest: readonly unknown[]) => {
    if (isTemplateStringsArray(first)) return compilePlan(createTemplateStylePlan(first, rest, options))
    if (typeof first === 'string') {
      return createNamedBuilder(tag, first, rest[0] as StyledComponentOptions | undefined, options, registry, defaultAttrs)
    }
    return compilePlan(createStylePlan(first as ElementsStyleInput<ElementsRecord, Artifact>, options))
  }) as StyledTagFactory<Artifact>

  factory.css = (strings, ...values) => compilePlan(createTemplateStylePlan(strings, values, options))
  factory.named = (name, componentOptions) => createNamedBuilder(tag, name, componentOptions, options, registry, defaultAttrs)
  factory.attrs = (nextAttrs) => createStyledTagFactory(tag, options, registry, mergeAttrs(defaultAttrs, nextAttrs))
  return factory
}

function createNamedBuilder<Props extends ElementsRecord, Artifact>(
  target: unknown,
  name: string,
  componentOptions: StyledComponentOptions<Props> | undefined,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  inheritedAttrs?: StyledAttrs<Props>,
): NamedStyledBuilder<Props, Artifact, StyledComponent<Props, Artifact>> {
  const compilePlan = (plan: StylePlan<Props, Artifact>): StyledComponent<Props, Artifact> => {
    const attrs = mergeAttrs(inheritedAttrs, componentOptions?.attrs)
    return createStyledComponent(
      target,
      name,
      attrs,
      plan,
      options,
      registry,
      componentOptions?.collision,
    ) as StyledComponent<Props, Artifact>
  }

  const builder = ((first: unknown, ...values: readonly unknown[]) => (
    isTemplateStringsArray(first)
      ? compilePlan(createTemplateStylePlan(first, values, options) as StylePlan<Props, Artifact>)
      : compilePlan(createStylePlan(first as ElementsStyleInput<Props, Artifact>, options))
  )) as NamedStyledBuilder<Props, Artifact, StyledComponent<Props, Artifact>>

  builder.css = (strings, ...values) => compilePlan(createTemplateStylePlan(strings, values, options) as StylePlan<Props, Artifact>)
  return builder
}

function createStyledComponent<Props extends ElementsRecord, Artifact>(
  target: unknown,
  displayName: string | undefined,
  attrs: StyledAttrs<Props> | undefined,
  plan: StylePlan<Props, Artifact>,
  options: StyledFactoryOptions<Artifact>,
  registry: StyledRegistryBridge,
  collision?: StyledRegistryCollision,
): StyledComponent<Props, Artifact> {
  const adapter = resolveFactoryAdapter(options)
  const staticArtifacts = Object.freeze(plan.staticStyle.artifacts.slice())
  let registeredName = displayName?.trim() || undefined

  const styledComponent = ((props: Props = {} as Props) => {
    const defaultProps = resolveAttrs(attrs, props)
    const merged = composeProps(defaultProps, props)
    const requestedTarget = merged.as
    if (Object.prototype.hasOwnProperty.call(merged, 'as')) delete merged.as

    const resolved = plan.dynamicStyles.length > 0
      ? resolveStylePlan(plan, merged as Props, options)
      : plan.staticStyle
    applyResolvedStyleToProps(merged, resolved)
    return createStyledOutput(requestedTarget ?? target, merged, resolved.className, adapter)
  }) as StyledComponent<Props, Artifact>

  Object.defineProperties(styledComponent, {
    displayName: { configurable: false, enumerable: false, value: displayName },
    className: { configurable: false, enumerable: true, value: plan.staticStyle.className },
    artifact: { configurable: false, enumerable: true, value: metadataArtifact(staticArtifacts) },
    artifacts: { configurable: false, enumerable: true, value: staticArtifacts },
    dynamicStyles: { configurable: false, enumerable: true, value: plan.dynamicStyles.length > 0 },
    target: { configurable: false, enumerable: false, value: target },
    tag: { configurable: false, enumerable: true, value: typeof target === 'string' ? target : undefined },
    registeredName: { configurable: false, enumerable: true, get: () => registeredName },
    register: {
      configurable: false,
      enumerable: false,
      value(name = registeredName, nextCollision = collision) {
        if (!name) throw new Error('[Fabrica Elements] register() requires a component name.')
        registeredName = name.trim()
        return registry.register(registeredName, styledComponent as ElementsComponent, nextCollision, true)
      },
    },
    unregister: {
      configurable: false,
      enumerable: false,
      value() { return registeredName ? registry.unregister(registeredName) : false },
    },
    withComponent: {
      configurable: false,
      enumerable: false,
      value(nextTarget: unknown) {
        return createStyledComponent(nextTarget, undefined, attrs, plan, options, registry)
      },
    },
    toString: { configurable: false, enumerable: false, value: () => plan.staticStyle.className },
  })

  if (registeredName) registry.register(registeredName, styledComponent as ElementsComponent, collision)
  return styledComponent
}

function createTemplateStylePlan<Props extends ElementsRecord, Artifact>(
  strings: TemplateStringsArray,
  values: readonly unknown[],
  options: StyledFactoryOptions<Artifact>,
): StylePlan<Props, Artifact> {
  const resolved = normalizeResolvedStyle(options.createStyle(strings, values))
  return { staticStyle: resolved, dynamicStyles: [] }
}

function createStylePlan<Props extends ElementsRecord, Artifact>(
  input: ElementsStyleInput<Props, Artifact>,
  options: StyledFactoryOptions<Artifact>,
): StylePlan<Props, Artifact> {
  const staticInputs: unknown[] = []
  const dynamicStyles: DynamicStyle<Props, Artifact>[] = []
  collectStylePlanInputs(input, staticInputs, dynamicStyles, 0)
  const staticStyle = resolveCollectedInputs(staticInputs, EMPTY_PROPS as Props, options)
  return { staticStyle, dynamicStyles }
}

function collectStylePlanInputs<Props extends ElementsRecord, Artifact>(
  input: ElementsStyleInput<Props, Artifact>,
  staticInputs: unknown[],
  dynamicStyles: DynamicStyle<Props, Artifact>[],
  depth: number,
): void {
  if (depth > MAX_STYLE_RESOLUTION_DEPTH) {
    throw new Error('[Fabrica Elements] Styled input nesting exceeded the safe resolution depth.')
  }
  if (input === null || input === undefined || input === false) return
  if (typeof input === 'function') {
    dynamicStyles.push(input as DynamicStyle<Props, Artifact>)
    return
  }
  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index += 1) {
      collectStylePlanInputs(input[index] as ElementsStyleInput<Props, Artifact>, staticInputs, dynamicStyles, depth + 1)
    }
    return
  }
  staticInputs.push(input)
}

function resolveStylePlan<Props extends ElementsRecord, Artifact>(
  plan: StylePlan<Props, Artifact>,
  props: Props,
  options: StyledFactoryOptions<Artifact>,
): ResolvedStyleSet<Artifact> {
  const output = cloneResolvedStyle(plan.staticStyle)
  for (let index = 0; index < plan.dynamicStyles.length; index += 1) {
    resolveStyleInput(plan.dynamicStyles[index]!(props), props, options, output, 0)
  }
  return output
}

function resolveCollectedInputs<Props extends ElementsRecord, Artifact>(
  inputs: readonly unknown[],
  props: Props,
  options: StyledFactoryOptions<Artifact>,
): ResolvedStyleSet<Artifact> {
  const output = emptyResolvedStyle<Artifact>()
  for (let index = 0; index < inputs.length; index += 1) {
    resolveStyleInput(inputs[index] as ElementsStyleInput<Props, Artifact>, props, options, output, 0)
  }
  return output
}

function resolveStyleInput<Props extends ElementsRecord, Artifact>(
  input: ElementsStyleInput<Props, Artifact>,
  props: Props,
  options: StyledFactoryOptions<Artifact>,
  output: ResolvedStyleSet<Artifact>,
  depth: number,
): void {
  if (depth > MAX_STYLE_RESOLUTION_DEPTH) {
    throw new Error('[Fabrica Elements] Styled input nesting exceeded the safe resolution depth.')
  }
  if (input === null || input === undefined || input === false) return
  if (typeof input === 'function') {
    const dynamic = input as DynamicStyle<Props, Artifact>
    resolveStyleInput(dynamic(props), props, options, output, depth + 1)
    return
  }
  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index += 1) {
      resolveStyleInput(input[index] as ElementsStyleInput<Props, Artifact>, props, options, output, depth + 1)
    }
    return
  }

  const resolved = resolveStyleLeaf(input, props, options)
  mergeResolvedStyle(output, resolved)
}

function resolveStyleLeaf<Props extends ElementsRecord, Artifact>(
  input: unknown,
  props: Props,
  options: StyledFactoryOptions<Artifact>,
): ElementsResolvedStyle<Artifact> {
  if (isResolvedStyle<Artifact>(input)) return input
  if (typeof input === 'string') return { className: input }
  if (hasClassName(input)) return { className: input.className, artifact: input as Artifact }
  if (options.resolveStyle) return options.resolveStyle(input, props)
  throw new TypeError('[Fabrica Elements] Unsupported styled input. Provide resolveStyle() for custom artifacts.')
}

function normalizeResolvedStyle<Artifact>(resolved: ElementsResolvedStyle<Artifact>): ResolvedStyleSet<Artifact> {
  const artifacts: Artifact[] = []
  if (resolved.artifact !== undefined) artifacts.push(resolved.artifact)
  return {
    className: mergeClassNames(resolved.className),
    style: resolved.style,
    artifacts,
  }
}

function mergeResolvedStyle<Artifact>(
  output: ResolvedStyleSet<Artifact>,
  resolved: ElementsResolvedStyle<Artifact>,
): void {
  output.className = mergeClassNames(output.className, resolved.className)
  if (resolved.style !== undefined) output.style = mergeStyleValues(output.style, resolved.style)
  if (resolved.artifact !== undefined && !output.artifacts.includes(resolved.artifact)) {
    output.artifacts.push(resolved.artifact)
  }
}

function applyResolvedStyleToProps(props: ElementsRecord, resolved: ResolvedStyleSet<unknown>): void {
  if (resolved.style !== undefined) props.style = mergeStyleValues(resolved.style, props.style)
}

function applyResolvedStyleToElement(element: Element, resolved: ResolvedStyleSet<unknown>): void {
  if (resolved.className) applyClassNameToElement(element, resolved.className)
  if (resolved.style !== undefined) applyProps(element, { style: resolved.style })
}

function mergeStyleValues(generated: unknown, caller: unknown): unknown {
  if (generated === undefined) return caller
  if (caller === undefined) return generated
  if (typeof generated === 'string' && typeof caller === 'string') {
    const left = generated.trim().replace(/;+$/g, '')
    const right = caller.trim().replace(/^;+/g, '')
    return left && right ? `${left};${right}` : left || right
  }
  if (isPlainObject(generated) && isPlainObject(caller) && !isInlineStyleArtifact(generated) && !isInlineStyleArtifact(caller)) {
    return { ...generated, ...caller }
  }
  return [generated, caller]
}

function isInlineStyleArtifact(value: ElementsRecord): boolean {
  return value.kind === 'cipo.inline-css' && typeof value.cssText === 'string'
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

function resolveAttrs<Props extends ElementsRecord>(attrs: StyledAttrs<Props> | undefined, props: Props): ElementsRecord | undefined {
  if (!attrs) return undefined
  const value = typeof attrs === 'function' ? attrs(props) : attrs
  return value && typeof value === 'object' ? value : undefined
}

function mergeAttrs<Props extends ElementsRecord>(
  left: StyledAttrs<Props> | undefined,
  right: StyledAttrs<Props> | undefined,
): StyledAttrs<Props> | undefined {
  if (!left) return right
  if (!right) return left
  return (props: Props) => composeProps(resolveAttrs(left, props), resolveAttrs(right, props))
}

function applyClassNameToElement(element: Element, className: string): void {
  const current = element.getAttribute('class') ?? ''
  applyProps(element, { class: mergeClassNames(current, className) })
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

function emptyResolvedStyle<Artifact>(): ResolvedStyleSet<Artifact> {
  return { className: '', artifacts: [] }
}

function cloneResolvedStyle<Artifact>(value: ResolvedStyleSet<Artifact>): ResolvedStyleSet<Artifact> {
  return { className: value.className, style: value.style, artifacts: value.artifacts.slice() }
}

function metadataArtifact<Artifact>(artifacts: readonly Artifact[]): Artifact | readonly Artifact[] | undefined {
  if (artifacts.length === 0) return undefined
  return artifacts.length === 1 ? artifacts[0] : artifacts
}

function isTemplateStringsArray(value: unknown): value is TemplateStringsArray {
  return Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'raw')
}

function isResolvedStyle<Artifact>(value: unknown): value is ElementsResolvedStyle<Artifact> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { className?: unknown }).className === 'string' &&
    (Object.prototype.hasOwnProperty.call(value, 'artifact') || Object.prototype.hasOwnProperty.call(value, 'style'))
  )
}

function hasClassName(value: unknown): value is { readonly className: string } {
  return Boolean(value && typeof value === 'object' && typeof (value as { className?: unknown }).className === 'string')
}
