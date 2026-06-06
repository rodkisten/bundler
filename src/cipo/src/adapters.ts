import { HTML_TAGS } from './constants'
import type { CipoAdapter, CipoAdapterName, CipoComponent, CipoCssInterpolation, CipoDomStyledResult, CipoRecord, CipoStyledBuilder, CipoStyledTagFactory, CipoTarget } from './types'
import { css } from './css'
import { inline } from './inline'
import { runtime } from './runtime'
import { isPlainObject } from './utils'

const CLASS_PROP = 'class'
const CLASS_NAME_PROP = 'className'
const CHILDREN_PROP = 'children'

/**
 * DOM adapter used by the browser/userscript path.
 *
 * @example
 * ```ts
 * configure({ adapter: 'dom' })
 * const Button = cipo.button.css`px: 4;`
 * Button({ children: 'Save' })
 * ```
 */
export const DOM_ADAPTER: CipoAdapter = {
  name: 'dom',
  classProp: CLASS_PROP,
  mergeProps(props, className) { return mergeClassIntoProps(props, CLASS_PROP, className) },
  createElement(tag, props, className) { return createDomElement(tag, props, className) },
  wrapComponent(component, className) { return createGenericWrappedComponent(component, className, CLASS_PROP) },
}

export const SOLID_ADAPTER: CipoAdapter = {
  name: 'solid',
  classProp: CLASS_PROP,
  mergeProps(props, className) { return mergeClassIntoProps(props, CLASS_PROP, className) },
  wrapComponent(component, className) { return createGenericWrappedComponent(component, className, CLASS_PROP) },
}

export const REACT_ADAPTER: CipoAdapter = {
  name: 'react',
  classProp: CLASS_NAME_PROP,
  mergeProps(props, className) { return mergeClassIntoProps(props, CLASS_NAME_PROP, className) },
  wrapComponent(component, className) { return createGenericWrappedComponent(component, className, CLASS_NAME_PROP) },
}

export const PREACT_ADAPTER = REACT_ADAPTER

/**
 * Creates the callable styled API: `cipo.div.css`, `cipo(Component).css`,
 * `cipo(element).css`.
 *
 * @returns Callable API.
 */
export function createCipoCallable() {
  const base = cipoCore as CipoCallableRuntime

  if (typeof Proxy === 'undefined') {
    installTagFactories(base)
    return base
  }

  return new Proxy(base, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver)
      if (typeof property === 'string') return createStyledTagFactory(property)
      return undefined
    },
  }) as CipoCallableRuntime
}

export interface CipoCallableRuntime {
  <ElementType extends Element>(target: ElementType): CipoStyledBuilder<CipoDomStyledResult<ElementType>>
  <Props extends CipoRecord>(target: CipoComponent<Props>): CipoStyledBuilder<CipoComponent<Props>>
  (target: string): CipoStyledTagFactory
  [key: string]: unknown
}

function cipoCore(target: CipoTarget): CipoStyledBuilder {
  if (isElement(target)) return createDomElementBuilder(target)
  if (typeof target === 'string') return createStyledTagFactory(target)
  return createComponentBuilder(target as CipoComponent)
}

function createDomElementBuilder<ElementType extends Element>(element: ElementType): CipoStyledBuilder<CipoDomStyledResult<ElementType>> {
  return {
    css(strings, ...values) {
      const artifact = css(strings, ...values)
      applyClassNameToElement(element, artifact.className)
      return { element, artifact, className: artifact.className }
    },
  }
}

function createComponentBuilder<Props extends CipoRecord>(component: CipoComponent<Props>): CipoStyledBuilder<CipoComponent<Props>> {
  return {
    css(strings, ...values) {
      const artifact = css(strings, ...values)
      const adapter = resolveAdapter()
      return (adapter.wrapComponent?.(component, artifact.className) ?? createGenericWrappedComponent(component, artifact.className, adapter.classProp)) as CipoComponent<Props>
    },
  }
}

function createStyledTagFactory(tag: string, defaultProps?: CipoRecord): CipoStyledTagFactory {
  return {
    css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) {
      const artifact = css(strings, ...values)
      const adapter = resolveAdapter()

      return function CipoStyledTag(props: CipoRecord = {}) {
        const merged = defaultProps ? { ...defaultProps, ...props } : props
        if (adapter.createElement) return adapter.createElement(tag, merged, artifact.className)
        return { tag, props: adapter.mergeProps(merged, artifact.className) }
      }
    },
    attrs(nextDefaultProps: CipoRecord) {
      return createStyledTagFactory(tag, defaultProps ? { ...defaultProps, ...nextDefaultProps } : nextDefaultProps)
    },
  }
}

function createGenericWrappedComponent(component: unknown, className: string, classProp: 'class' | 'className'): CipoComponent {
  return function CipoWrappedComponent(props: CipoRecord = {}) {
    const nextProps = mergeClassIntoProps(props, classProp, className)
    if (typeof component === 'function') return (component as CipoComponent)(nextProps)
    return { component, props: nextProps }
  }
}

function createDomElement(tag: string, props: CipoRecord | null | undefined, className: string): Element | CipoRecord {
  if (typeof document === 'undefined') return { tag, props: mergeClassIntoProps(props, CLASS_PROP, className) }

  const element = document.createElement(tag)
  const merged = mergeClassIntoProps(props, CLASS_PROP, className)
  applyPropsToElement(element, merged)
  return element
}

function applyPropsToElement(element: Element, props: CipoRecord): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue
    if (key === CHILDREN_PROP) { appendChildren(element, value); continue }
    if (key === CLASS_PROP || key === CLASS_NAME_PROP) { applyClassNameToElement(element, String(value)); continue }
    if (key === 'style') { applyStyle(element as HTMLElement, value); continue }
    if (key.startsWith('on') && typeof value === 'function') { element.addEventListener(key.slice(2).toLowerCase(), value as EventListener); continue }
    if (value === true) { element.setAttribute(key, ''); continue }
    element.setAttribute(key, String(value))
  }
}

function appendChildren(element: Element, children: unknown): void {
  if (Array.isArray(children)) { for (const child of children) appendChildren(element, child); return }
  if (children === null || children === undefined || children === false) return
  if (children instanceof Node) { element.appendChild(children); return }
  element.appendChild(document.createTextNode(String(children)))
}

function applyStyle(element: HTMLElement, value: unknown): void {
  if (isPlainObject(value) && value.kind === 'cipo.inline-css') { element.setAttribute('style', String(value)); return }
  if (isPlainObject(value)) { element.setAttribute('style', inline.css(value as never).cssText); return }
  if (typeof value === 'string') element.setAttribute('style', inline.css([value] as unknown as TemplateStringsArray).cssText)
}

function applyClassNameToElement(element: Element, className: string): void {
  for (const part of className.split(/\s+/)) if (part) element.classList.add(part)
}

function mergeClassIntoProps(props: CipoRecord | null | undefined, classProp: 'class' | 'className', className: string): CipoRecord {
  const next = props ? { ...props } : {}
  const existing = next[classProp]
  next[classProp] = existing ? `${String(existing)} ${className}` : className
  return next
}

function resolveAdapter(): CipoAdapter {
  const selected = runtime.config.adapter
  if (typeof selected !== 'string') return selected
  if (selected === 'solid') return SOLID_ADAPTER
  if (selected === 'react') return REACT_ADAPTER
  if (selected === 'preact') return PREACT_ADAPTER
  return DOM_ADAPTER
}

function installTagFactories(target: CipoCallableRuntime): void {
  for (const tag of HTML_TAGS) Object.defineProperty(target, tag, { configurable: true, enumerable: false, value: createStyledTagFactory(tag) })
}

function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element
}
