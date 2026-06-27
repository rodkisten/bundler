import type { ElementsClassProp, ElementsRecord } from './types'
import { isPlainObject, mergeClassNames, toKebabCase } from './utils'

/** Event cache used by DOM prop application to replace listeners safely. */
const eventCache = new WeakMap<Element, Map<string, EventListener>>()

/**
 * Merges a generated class into adapter props.
 *
 * @param props - Existing props.
 * @param classProp - Adapter class prop name.
 * @param className - Generated class name.
 * @returns New props object.
 *
 * @example React-style merge
 * ```ts
 * mergeClassIntoProps({ className: 'extra' }, 'className', 'cipo-a-x')
 * // { className: 'extra cipo-a-x' }
 * ```
 */
export function mergeClassIntoProps(
  props: ElementsRecord | null | undefined,
  classProp: ElementsClassProp,
  className: string,
): ElementsRecord {
  const next = props ? { ...props } : {}
  next[classProp] = mergeClassNames(next[classProp] as never, className)
  return next
}

/**
 * Applies object props to a DOM element.
 *
 * @remarks
 * This is deliberately generic and small: Fábrica still owns reactive binding,
 * while this package owns static prop normalization for component factories.
 *
 * @param element - Target element.
 * @param props - Props to apply.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * applyProps(button, { class: ['btn', 'primary'], onClick: save })
 * ```
 */
export function applyProps(element: Element, props: ElementsRecord): void {
  for (const key in props) {
    const rawValue = props[key]
    const value = readElementValue(rawValue)
    if (value === null || value === undefined || value === false) continue

    if (key === 'children') {
      appendChildren(element, value)
      continue
    }

    if (key === 'class' || key === 'className') {
      const className = mergeClassNames(value as never)
      if (className) element.setAttribute('class', className)
      else element.removeAttribute('class')
      continue
    }

    if (key === 'style') {
      applyStyle(element as HTMLElement, value)
      continue
    }

    if (key === 'attrs' && isPlainObject(value)) {
      applyProps(element, value)
      continue
    }

    if (key === 'dataset' && isPlainObject(value)) {
      applyDataset(element as HTMLElement, value)
      continue
    }

    if (key === 'ref') {
      applyRef(element, rawValue)
      continue
    }

    if (key === 'on' && isPlainObject(value)) {
      applyEventMap(element, value)
      continue
    }

    if (key.startsWith('on') && typeof rawValue === 'function') {
      setEvent(element, key.slice(2).toLowerCase(), rawValue as EventListener)
      continue
    }

    setPropertyOrAttribute(element, key, value)
  }
}

/**
 * Reads signal-like values without making Fabrica Elements depend on Broto.
 *
 * @remarks
 * Static DOM factories stay framework-agnostic, but when they are invoked by
 * Fábrica component tags inside an effect, reading a Broto signal here gives
 * styled components reactive props without importing the reactivity package.
 * Plain callback props are deliberately left untouched.
 *
 * @param value - Possible signal-like value.
 * @returns Current value for signal-like inputs, otherwise the original value.
 */
function readElementValue(value: unknown): unknown {
  if (
    typeof value === 'function' &&
    typeof (value as { set?: unknown }).set === 'function' &&
    typeof (value as { update?: unknown }).update === 'function' &&
    typeof (value as { peek?: unknown }).peek === 'function' &&
    typeof (value as { subscribe?: unknown }).subscribe === 'function'
  ) {
    return (value as () => unknown)()
  }

  return value
}

/**
 * Sets a property when safe, otherwise sets/removes an attribute.
 *
 * @param element - Target element.
 * @param name - Prop or attribute name.
 * @param value - Value.
 */
export function setPropertyOrAttribute(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name)
    if (name in element && typeof (element as unknown as Record<string, unknown>)[name] === 'boolean') {
      ;(element as unknown as Record<string, unknown>)[name] = false
    }
    return
  }

  if (value === true) {
    element.setAttribute(name, '')
    if (name in element && typeof (element as unknown as Record<string, unknown>)[name] === 'boolean') {
      ;(element as unknown as Record<string, unknown>)[name] = true
    }
    return
  }

  if (!name.startsWith('data-') && !name.startsWith('aria-') && name in element) {
    try {
      ;(element as unknown as Record<string, unknown>)[name] = value
      return
    } catch {
      element.setAttribute(name, String(value))
      return
    }
  }

  element.setAttribute(name, String(value))
}

/**
 * Appends children to a DOM element.
 *
 * @param element - Parent element.
 * @param children - Child value.
 */
export function appendChildren(element: Element, children: unknown): void {
  const resolvedChildren = readElementValue(children)

  if (Array.isArray(resolvedChildren)) {
    for (let index = 0; index < resolvedChildren.length; index += 1) appendChildren(element, resolvedChildren[index])
    return
  }

  if (resolvedChildren === null || resolvedChildren === undefined || resolvedChildren === false || resolvedChildren === true) return

  if (resolvedChildren instanceof Node) {
    element.appendChild(resolvedChildren)
    return
  }

  element.appendChild(document.createTextNode(String(resolvedChildren)))
}

function applyStyle(element: HTMLElement, value: unknown): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) applyStyle(element, value[index])
    return
  }

  if (typeof value === 'string') {
    element.setAttribute('style', value)
    return
  }

  if (!isPlainObject(value)) return

  const maybeInline = value as { cssText?: unknown; kind?: unknown }
  if (maybeInline.kind === 'cipo.inline-css' && typeof maybeInline.cssText === 'string') {
    element.setAttribute('style', maybeInline.cssText)
    return
  }

  const style = element.style
  for (const key in value) {
    const item = readElementValue(value[key])
    if (item === null || item === undefined) continue
    style.setProperty(key.startsWith('--') ? key : toKebabCase(key), String(item))
  }
}

function applyDataset(element: HTMLElement, value: ElementsRecord): void {
  for (const key in value) {
    const item = readElementValue(value[key])
    if (item === null || item === undefined) delete element.dataset[key]
    else element.dataset[key] = String(item)
  }
}

function applyRef(element: Element, value: unknown): void {
  if (typeof value === 'function') {
    ;(value as (element: Element) => void)(element)
    return
  }

  if (isPlainObject(value) && 'current' in value) {
    ;(value as { current: Element | null }).current = element
  }
}

function applyEventMap(element: Element, value: ElementsRecord): void {
  for (const eventName in value) {
    const listener = value[eventName]
    if (typeof listener === 'function') setEvent(element, eventName, listener as EventListener)
  }
}

function setEvent(element: Element, eventName: string, listener: EventListener): void {
  let events = eventCache.get(element)
  if (!events) {
    events = new Map<string, EventListener>()
    eventCache.set(element, events)
  }

  const previous = events.get(eventName)
  if (previous) element.removeEventListener(eventName, previous)

  events.set(eventName, listener)
  element.addEventListener(eventName, listener)
}
