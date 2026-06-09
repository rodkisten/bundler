import type { ElementsAdapter, ElementsAdapterName, ElementsComponent, ElementsRecord } from './types'
import { applyProps, mergeClassIntoProps } from './props'

/**
 * Creates a DOM element through shared static prop handling.
 *
 * @param tag - Tag name.
 * @param props - Props.
 * @param className - Generated class.
 * @returns DOM element or payload fallback when document is unavailable.
 */
export function createDomElement(tag: string, props: ElementsRecord | null | undefined, className = ''): Element | ElementsRecord {
  const merged = mergeClassIntoProps(props, 'class', className)

  if (typeof document === 'undefined') {
    return { tag, props: merged }
  }

  const element = document.createElement(tag)
  applyProps(element, merged)
  return element
}

/** DOM adapter for userscript/browser output. */
export const DOM_ADAPTER: ElementsAdapter<Element | ElementsRecord> = {
  name: 'dom',
  classProp: 'class',
  mergeProps(props, className) { return mergeClassIntoProps(props, 'class', className) },
  createElement(tag, props, className) { return createDomElement(tag, props, className) },
  wrapComponent(component, className) { return createWrappedComponent(component, className, 'class') },
}

/** Solid uses `class`. */
export const SOLID_ADAPTER: ElementsAdapter = {
  name: 'solid',
  classProp: 'class',
  mergeProps(props, className) { return mergeClassIntoProps(props, 'class', className) },
  wrapComponent(component, className) { return createWrappedComponent(component, className, 'class') },
}

/** React/Preact use `className`. */
export const REACT_ADAPTER: ElementsAdapter = {
  name: 'react',
  classProp: 'className',
  mergeProps(props, className) { return mergeClassIntoProps(props, 'className', className) },
  wrapComponent(component, className) { return createWrappedComponent(component, className, 'className') },
}

/** Preact accepts className in this generic adapter path. */
export const PREACT_ADAPTER = { ...REACT_ADAPTER, name: 'preact' } satisfies ElementsAdapter

/** Payload adapter for SSR/tests or framework ownership. */
export const PAYLOAD_ADAPTER: ElementsAdapter = {
  name: 'payload',
  classProp: 'class',
  mergeProps(props, className) { return mergeClassIntoProps(props, 'class', className) },
  createElement(tag, props, className) { return { tag, props: mergeClassIntoProps(props, 'class', className) } },
  wrapComponent(component, className) { return createWrappedComponent(component, className, 'class') },
}

/**
 * Resolves a built-in or custom adapter.
 *
 * @param adapter - Adapter option.
 * @returns Adapter object.
 */
export function resolveAdapter(adapter: ElementsAdapterName | ElementsAdapter | undefined): ElementsAdapter {
  if (!adapter) return DOM_ADAPTER
  if (typeof adapter !== 'string') return adapter
  if (adapter === 'solid') return SOLID_ADAPTER
  if (adapter === 'react') return REACT_ADAPTER
  if (adapter === 'preact') return PREACT_ADAPTER
  if (adapter === 'payload') return PAYLOAD_ADAPTER
  return DOM_ADAPTER
}

/**
 * Wraps any component-like value by merging a class prop before invocation.
 *
 * @param component - Component function or opaque component value.
 * @param className - Generated class.
 * @param classProp - Adapter class prop.
 * @returns Component wrapper.
 */
export function createWrappedComponent(component: unknown, className: string, classProp: 'class' | 'className'): ElementsComponent {
  return function ElementsWrappedComponent(props: ElementsRecord = {}) {
    const nextProps = mergeClassIntoProps(props, classProp, className)
    if (typeof component === 'function') return (component as ElementsComponent)(nextProps)
    return { component, props: nextProps }
  }
}
