import { HTML_TAGS } from './html-tags'
import { resolveAdapter } from './adapters'
import { applyProps, mergeClassIntoProps } from './props'
import type {
  ElementsAdapter,
  ElementsComponent,
  ElementsRecord,
  StyledBuilder,
  StyledDomResult,
  StyledFactory,
  StyledFactoryOptions,
  StyledTagFactory,
} from './types'
import { isDomElement } from './utils'

/**
 * Creates a styled-component-like factory from a style compiler.
 *
 * @remarks
 * This is the bridge Cipó uses instead of owning element creation itself. Cipó
 * provides `createStyle`, and Fabrica Elements handles DOM tags, wrapped
 * components, attrs, adapters and class merging.
 *
 * @param options - Styled factory options.
 * @returns Callable styled factory.
 *
 * @example Cipó integration
 * ```ts
 * export const cipo = createStyledFactory({
 *   createStyle(strings, values) {
 *     const artifact = assertAtomicCssArtifact(css(strings, ...values))
 *     return { className: artifact.className, artifact }
 *   },
 * })
 * ```
 */
export function createStyledFactory<Artifact = unknown>(options: StyledFactoryOptions<Artifact>): StyledFactory<Artifact> {
  const styledTagCache = Object.create(null) as Record<string, StyledTagFactory<Artifact> | undefined>
  const getStyledTagFactory = (tag: string): StyledTagFactory<Artifact> => styledTagCache[tag] ?? (styledTagCache[tag] = createStyledTagFactory(tag, options))
  const base = ((target: unknown) => styledCore(target, options, getStyledTagFactory)) as StyledFactory<Artifact>

  if (typeof Proxy === 'undefined') {
    installStyledTagFactories(base, options, getStyledTagFactory)
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

function styledCore<Artifact>(target: unknown, options: StyledFactoryOptions<Artifact>, getStyledTagFactory: (tag: string) => StyledTagFactory<Artifact>): StyledBuilder {
  if (isDomElement(target)) return createDomElementBuilder(target, options)
  if (typeof target === 'string') return getStyledTagFactory(target)
  return createComponentBuilder(target, options)
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
  }
}

function createComponentBuilder<Props extends ElementsRecord, Artifact>(component: unknown, options: StyledFactoryOptions<Artifact>): StyledBuilder<ElementsComponent<Props>> {
  return {
    css(strings, ...values) {
      const resolved = options.createStyle(strings, values)
      const adapter = resolveFactoryAdapter(options)
      const wrapped = adapter.wrapComponent?.(component, resolved.className) ?? createWrappedComponent(component, resolved.className, adapter.classProp)
      return wrapped as ElementsComponent<Props>
    },
  }
}

function createStyledTagFactory<Artifact>(tag: string, options: StyledFactoryOptions<Artifact>, defaultProps?: ElementsRecord): StyledTagFactory<Artifact> {
  return {
    css(strings, ...values) {
      const resolved = options.createStyle(strings, values)
      const adapter = resolveFactoryAdapter(options)

      return function StyledTag(props: ElementsRecord = {}) {
        const merged = defaultProps ? { ...defaultProps, ...props } : props
        if (adapter.createElement) return adapter.createElement(tag, merged, resolved.className)
        return { tag, props: adapter.mergeProps(merged, resolved.className) }
      }
    },
    attrs(nextDefaultProps) {
      return createStyledTagFactory(tag, options, defaultProps ? { ...defaultProps, ...nextDefaultProps } : nextDefaultProps)
    },
  }
}

function createWrappedComponent(component: unknown, className: string, classProp: 'class' | 'className'): ElementsComponent {
  return function WrappedComponent(props: ElementsRecord = {}) {
    const nextProps = mergeClassIntoProps(props, classProp, className)
    if (typeof component === 'function') return (component as ElementsComponent)(nextProps)
    return { component, props: nextProps }
  }
}

function applyClassNameToElement(element: Element, className: string): void {
  const current = element.getAttribute('class') ?? ''
  applyProps(element, { class: `${current} ${className}` })
}

function resolveFactoryAdapter(options: StyledFactoryOptions): ElementsAdapter {
  const value = typeof options.adapter === 'function' ? options.adapter() : options.adapter
  return resolveAdapter(value)
}

function installStyledTagFactories<Artifact>(target: StyledFactory<Artifact>, _options: StyledFactoryOptions<Artifact>, getStyledTagFactory: (tag: string) => StyledTagFactory<Artifact>): void {
  for (let index = 0; index < HTML_TAGS.length; index += 1) {
    const tag = HTML_TAGS[index]
    Object.defineProperty(target, tag, { configurable: true, enumerable: false, value: getStyledTagFactory(tag) })
  }
}
