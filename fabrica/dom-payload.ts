import { registerCleanup } from '@rodkisten/fabrica/dom-cleanup'
import { setPropertyOrAttribute } from '@rodkisten/fabrica/props'
import type { ComponentPayload, ElementPayload, RenderValue } from '@rodkisten/fabrica/types'
import { applySpecialAttribute, createSpecialAttributeState } from "@rodkisten/fabrica/dom-special-attributes";

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


/** Component-like value that can hand DOM ownership back to Fábrica. */
type RendererPayloadComponent = ((props?: Record<string, unknown>) => unknown) & {
  renderPayload?: (props?: Record<string, unknown>) => unknown
}

/**
 * Invokes a component while preferring a renderer-owned payload when available.
 *
 * Styled factories normally return a live DOM element in standalone mode. When
 * Fábrica owns the render tree, their `renderPayload()` hook preserves complex
 * children such as component requests, directives and reactive values so the
 * renderer can materialize and dispose them with the correct lifecycle.
 */
export function invokeComponentLike(
  componentValue: unknown,
  props: Record<string, unknown>,
): unknown {
  if (typeof componentValue !== 'function') return null

  const component = componentValue as RendererPayloadComponent
  return typeof component.renderPayload === 'function'
    ? component.renderPayload(props)
    : component(props)
}

/**
 * Materializes a component payload by calling its component function.
 *
 * @param payload - Component payload.
 * @returns Component render value.
 */
export function materializeComponentPayload(payload: ComponentPayload): unknown {
  return invokeComponentLike(payload.component, payload.props || {})
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

    if (applySpecialAttribute(element, key, propValue, createSpecialAttributeState())) {
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

    if (key.startsWith('data-') || key.startsWith('aria-')) {
      if (propValue == null) element.removeAttribute(key)
      else element.setAttribute(key, String(propValue))
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

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.kind === 'ref' && typeof record.callback === 'function') {
      const cleanup = (record.callback as (node: Element) => void | (() => void))(element)
      if (typeof cleanup === 'function') registerCleanup(element, cleanup)
      return
    }

    if ('current' in record) {
      ;(value as { current: Element | null }).current = element
    }
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
