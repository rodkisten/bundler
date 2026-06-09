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
