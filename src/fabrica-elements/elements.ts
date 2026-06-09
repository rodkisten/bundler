import { HTML_TAGS } from '../cipo/src/constants'
import { resolveAdapter } from './adapters'
import type { ElementFactoryOptions, ElementTagFactory, ElementsAdapter, ElementsFactory, ElementsRecord } from './types'

/**
 * Creates a generic tag factory for static element/component payloads.
 *
 * @remarks
 * Fábrica can use this for `elements.div({ ... })` while Cipó uses the styled
 * layer. The factory does not know about CSS, signals or rendering. It only
 * delegates prop normalization to the selected adapter.
 *
 * @param options - Factory options.
 * @returns Callable tag factory.
 *
 * @example DOM usage
 * ```ts
 * const elements = createElementFactory({ adapter: 'dom' })
 * const button = elements.button({ children: 'Save' })
 * ```
 */
export function createElementFactory<Output = unknown>(options: ElementFactoryOptions<Output> = {}): ElementsFactory<Output> {
  const base = ((tag: string) => createTagFactory<Output>(tag, options)) as ElementsFactory<Output>

  if (typeof Proxy === 'undefined') {
    installTagFactories(base, options)
    return base
  }

  return new Proxy(base, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver)
      if (typeof property === 'string') return createTagFactory<Output>(property, options)
      return undefined
    },
  })
}

function createTagFactory<Output>(tag: string, options: ElementFactoryOptions<Output>, defaultProps?: ElementsRecord): ElementTagFactory<Output> {
  const factory = ((props: ElementsRecord = {}) => {
    const merged = defaultProps ? { ...defaultProps, ...props } : props
    if (options.createElement) return options.createElement(tag, merged)
    const adapter = resolveFactoryAdapter(options)
    return adapter.createElement ? adapter.createElement(tag, merged, '') as Output : ({ tag, props: adapter.mergeProps(merged, '') } as Output)
  }) as ElementTagFactory<Output>

  factory.attrs = (nextDefaultProps: ElementsRecord) => createTagFactory(tag, options, defaultProps ? { ...defaultProps, ...nextDefaultProps } : nextDefaultProps)

  return factory
}

function resolveFactoryAdapter(options: ElementFactoryOptions): ElementsAdapter {
  const value = typeof options.adapter === 'function' ? options.adapter() : options.adapter
  return resolveAdapter(value)
}

function installTagFactories<Output>(target: ElementsFactory<Output>, options: ElementFactoryOptions<Output>): void {
  for (let index = 0; index < HTML_TAGS.length; index += 1) {
    const tag = HTML_TAGS[index]
    Object.defineProperty(target, tag, { configurable: true, enumerable: false, value: createTagFactory(tag, options) })
  }
}
