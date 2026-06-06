import type { CipoStyleObject } from './types'
import { normalizePropertyDeclaration } from './values'
import { isPlainObject, toKebabCase } from './utils'

/**
 * Converts object style syntax to Cipó DSL declarations.
 *
 * @remarks
 * This is used by `css({ ... })`, `inline.css({ ... })` and recipe object parts.
 * It intentionally goes through the same declaration normalizer as template CSS,
 * so aliases like `px`, `bg`, `rounded` and `text` behave the same everywhere.
 *
 * @param styleObject - Style object.
 * @returns CSS declaration text.
 *
 * @example
 * ```ts
 * styleObjectToCss({ px: 2, bg: '$brand' })
 * // 'padding-inline:calc(var(--cipo-spacing) * 2);background:var(--cipo-colors-brand);'
 * ```
 */
export function styleObjectToCss(styleObject: CipoStyleObject): string {
  let output = ''

  for (const [key, value] of Object.entries(styleObject)) {
    if (value === null || value === undefined) continue

    if (isPlainObject(value)) {
      output += `${key}{${styleObjectToCss(value as CipoStyleObject)}}`
      continue
    }

    const declarations = normalizePropertyDeclaration(toKebabCase(key), String(value))
    output += declarations.map(declaration => `${declaration.property}:${declaration.value};`).join('')
  }

  return output
}
