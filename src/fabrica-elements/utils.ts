import type { ElementsClassValue, ElementsRecord } from './types'

/**
 * Checks plain objects without depending on cross-realm constructors.
 *
 * @param value - Unknown value.
 * @returns Whether the value is a plain object.
 *
 * @example
 * ```ts
 * isPlainObject({ class: 'x' })
 * // true
 * ```
 */
export function isPlainObject(value: unknown): value is ElementsRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Checks DOM elements structurally so it works across iframes/userscripts.
 *
 * @param value - Unknown value.
 * @returns Whether it behaves like an Element.
 */
export function isDomElement(value: unknown): value is Element {
  return Boolean(value && typeof value === 'object' && (value as Element).nodeType === 1 && typeof (value as Element).nodeName === 'string')
}

/**
 * Checks DOM nodes structurally so it works across iframes/userscripts.
 *
 * @param value - Unknown value.
 * @returns Whether it behaves like a Node.
 */
export function isDomNode(value: unknown): value is Node {
  return Boolean(value && typeof value === 'object' && typeof (value as Node).nodeType === 'number' && typeof (value as Node).nodeName === 'string')
}

/**
 * Converts camelCase props to kebab-case attribute/style names.
 *
 * @param value - Input name.
 * @returns Kebab-cased name.
 *
 * @example
 * ```ts
 * toKebabCase('backgroundColor')
 * // 'background-color'
 * ```
 */
export function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

/**
 * Joins class values with array/object support.
 *
 * @remarks
 * This tiny helper is intentionally close to `clsx`, but local and predictable
 * for userscript builds. It is shared by Cipó and Fábrica to avoid each runtime
 * having its own almost-identical class merging behavior.
 *
 * @param values - Class values.
 * @returns Stable class string.
 *
 * @example
 * ```ts
 * mergeClassNames('btn', ['active'], { disabled: false, primary: true })
 * // 'btn active primary'
 * ```
 */
export function mergeClassNames(...values: readonly ElementsClassValue[]): string {
  const output: string[] = []
  appendClassValues(output, values)
  return Array.from(new Set(output)).join(' ')
}

function appendClassValues(output: string[], values: readonly ElementsClassValue[]): void {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value) continue

    if (Array.isArray(value)) {
      appendClassValues(output, value as readonly ElementsClassValue[])
      continue
    }

    if (isPlainObject(value)) {
      for (const key in value) {
        if (value[key]) output.push(key)
      }
      continue
    }

    const parts = String(value).split(/\s+/)
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const part = parts[partIndex]?.trim()
      if (part) output.push(part)
    }
  }
}

/**
 * Alias for mergeClassNames(), matching the short name used by many UI libs.
 *
 * @param values - Class values.
 * @returns Merged class string.
 *
 * @example
 * ```ts
 * cx('btn', active && 'active', ['rounded'])
 * // 'btn active rounded'
 * ```
 */
export const cx = mergeClassNames

/**
 * Creates a mutable object ref.
 *
 * @returns Ref object.
 *
 * @example
 * ```ts
 * const input = createRef<HTMLInputElement>();
 * input.current?.focus();
 * ```
 */
export function createRef<Value = Element>(): { current: Value | null } {
  return { current: null }
}

/**
 * Composes multiple object/callback refs into one callback.
 *
 * @param refs - Ref values.
 * @returns Callback ref.
 *
 * @example
 * ```ts
 * const ref = composeRefs(localRef, props.ref);
 * ```
 */
export function composeRefs<Value = Element>(...refs: readonly unknown[]): (value: Value | null) => void {
  const cleanups: Array<() => void> = []

  return (value: Value | null): void => {
    if (value === null) {
      for (let index = cleanups.length - 1; index >= 0; index -= 1) cleanups[index]?.()
      cleanups.length = 0
    }

    for (let index = 0; index < refs.length; index += 1) {
      const ref = refs[index]

      if (!ref) continue

      if (typeof ref === 'function') {
        const cleanup = (ref as (value: Value | null) => void | (() => void))(value)
        if (typeof cleanup === 'function') cleanups[cleanups.length] = cleanup
        continue
      }

      if (isPlainObject(ref) && 'current' in ref) {
        ;(ref as { current: Value | null }).current = value
      }
    }
  }
}

/**
 * Normalizes children into a flat array without boolean/null placeholders.
 *
 * @param children - Children value.
 * @returns Flat child list.
 *
 * @example
 * ```ts
 * childrenToArray(['a', null, ['b']])
 * // ['a', 'b']
 * ```
 */
export function childrenToArray(children: unknown): unknown[] {
  const output: unknown[] = []
  appendChildrenValue(output, children)
  return output
}

function appendChildrenValue(output: unknown[], value: unknown): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) appendChildrenValue(output, value[index])
    return
  }

  if (value === null || value === undefined || value === false || value === true) return
  output.push(value)
}
