import { registerCleanup } from './dom-cleanup'
import { setPropertyOrAttribute } from './props'
import type { ComponentPayload, ElementPayload, RenderValue } from './types'

/** Callback used by payload materializers to append nested children. */
export type AppendRenderValue = (parentNode: Node, value: RenderValue, beforeNode?: Node | null) => void

/**
 * Checks whether a renderer value is an element payload from fabrica-elements.
 *
 * @param value - Unknown render value.
 * @returns Whether value has a tag payload shape.
 */
export function isElementPayload(value: unknown): value is ElementPayload {
  return Boolean(value && typeof value === 'object' && typeof (value as ElementPayload).tag === 'string')
}

/**
 * Checks whether a renderer value is a component payload from fabrica-elements.
 *
 * @param value - Unknown render value.
 * @returns Whether value has a component payload shape.
 */
export function isComponentPayload(value: unknown): value is ComponentPayload {
  return Boolean(value && typeof value === 'object' && 'component' in (value as Record<string, unknown>))
}

/**
 * Materializes a tag payload into a live DOM element.
 *
 * @param payload - Element payload.
 * @param appendValue - Renderer append function for children.
 * @returns DOM element.
 */
export function materializeElementPayload(payload: ElementPayload, appendValue: AppendRenderValue): Element {
  const element = document.createElement(payload.tag)
  applyPayloadProps(element, payload.props || {}, appendValue)
  return element
}

/**
 * Materializes a component payload by calling its component function.
 *
 * @param payload - Component payload.
 * @returns Component render value.
 */
export function materializeComponentPayload(payload: ComponentPayload): unknown {
  const componentValue = payload.component
  return typeof componentValue === 'function' ? componentValue(payload.props || {}) : null
}

/**
 * Applies payload props produced by fabrica-elements to a DOM element.
 *
 * @remarks
 * Kept outside `dom.ts` so the hot renderer can delegate payload-specific
 * behavior without growing the core part reconciler. Event props support both
 * React-like `onClick` and map-like `on: { click() {} }` forms.
 *
 * @param element - Target element.
 * @param props - Payload props.
 * @param appendValue - Renderer append function for children.
 */
export function applyPayloadProps(element: Element, props: Record<string, unknown>, appendValue: AppendRenderValue): void {
  for (const key in props) {
    const propValue = props[key]

    if (key === 'children') {
      appendValue(element, propValue as RenderValue)
      continue
    }

    if (key === 'class' || key === 'className') {
      const className = stringifyAttributeValue('class', propValue)
      if (className) element.setAttribute('class', className)
      else element.removeAttribute('class')
      continue
    }

    if (key === 'style') {
      const styleText = stringifyAttributeValue('style', propValue)
      if (styleText) element.setAttribute('style', styleText)
      else element.removeAttribute('style')
      continue
    }

    if (key === 'attrs' && propValue && typeof propValue === 'object') {
      const attrs = propValue as Record<string, unknown>
      for (const attrName in attrs) setPropertyOrAttribute(element, attrName, attrs[attrName])
      continue
    }

    if (key === 'dataset' && propValue && typeof propValue === 'object' && element instanceof HTMLElement) {
      const dataset = propValue as Record<string, unknown>
      for (const dataName in dataset) {
        const item = dataset[dataName]
        if (item == null) delete element.dataset[dataName]
        else element.dataset[dataName] = String(item)
      }
      continue
    }

    if (key === 'ref') {
      applyPayloadRef(element, propValue)
      continue
    }

    if (key === 'on' && propValue && typeof propValue === 'object') {
      const events = propValue as Record<string, unknown>
      for (const eventName in events) {
        const listener = events[eventName]
        if (typeof listener === 'function') element.addEventListener(eventName, listener as EventListener)
      }
      continue
    }

    if (key.startsWith('on') && typeof propValue === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), propValue as EventListener)
      continue
    }

    if (propValue == null || propValue === false) {
      element.removeAttribute(key)
      continue
    }

    if (propValue === true) {
      element.setAttribute(key, '')
      continue
    }

    if (!key.startsWith('data-') && !key.startsWith('aria-') && key in element) {
      try {
        ;(element as unknown as Record<string, unknown>)[key] = propValue
        continue
      } catch {}
    }

    element.setAttribute(key, stringifyAttributeValue(key, propValue))
  }
}

/** Applies a payload ref and registers its cleanup if one is returned. */
export function applyPayloadRef(element: Element, value: unknown): void {
  if (typeof value === 'function') {
    const cleanup = (value as (node: Element) => void | (() => void))(element)
    if (typeof cleanup === 'function') registerCleanup(element, cleanup)
    return
  }

  if (value && typeof value === 'object' && 'current' in (value as Record<string, unknown>)) {
    ;(value as { current: Element | null }).current = element
  }
}

/** Stringifies class/style artifacts from Cipó or plain values. */
export function stringifyAttributeValue(name: string, value: unknown): string {
  if (value == null || value === false) return ''

  if ((name === 'class' || name === 'className') && Array.isArray(value)) {
    return value.map((item) => stringifyAttributeValue(name, item)).filter(Boolean).join(' ')
  }

  if (name === 'style' && value && typeof value === 'object') {
    const styleLike = value as { cssText?: unknown; compiledCss?: unknown; value?: unknown }
    if (typeof styleLike.cssText === 'string') return styleLike.cssText
    if (typeof styleLike.compiledCss === 'string') return styleLike.compiledCss
    if (typeof styleLike.value === 'string') return styleLike.value
  }

  if ((name === 'class' || name === 'className') && value && typeof value === 'object') {
    const classLike = value as { className?: unknown; classes?: unknown; value?: unknown }
    if (typeof classLike.className === 'string') return classLike.className
    if (typeof classLike.classes === 'string') return classLike.classes
    if (typeof classLike.value === 'string') return classLike.value
  }

  return String(value)
}
