import { splitTopLevel } from './utils'

/**
 * Expands standalone `size(...)` declarations into Cipó width and height aliases.
 *
 * @remarks
 * The expansion runs before declaration parsing so `size(...)` is never reported
 * as an unknown helper. Arguments are split at the top level, which preserves
 * commas inside nested CSS functions. A single argument applies to both axes;
 * a second argument overrides the height.
 *
 * @param input - CSS source that may contain standalone `size(...)` declarations.
 * @returns CSS where each supported call is replaced by `w` and `h` declarations.
 *
 * @example
 * ```ts
 * expandCoreSizeCalls('size(16px)')
 * // 'w: 16px;\nh: 16px'
 * ```
 */
export function expandCoreSizeCalls(input: string): string {
  return input.replace(
    /(^|[;{}\n])(\s*)size\(([^{}\n;]*)\)(?=\s*(?:;|\n|}|$))/g,
    (_all, edge: string, spacing: string, raw: string) => {
      const parts = splitTopLevel(raw, ',')
      const width = (parts[0] || '').trim()
      const height = (parts[1] || width).trim()
      if (!width) return `${edge}${spacing}`
      return `${edge}${spacing}w: ${width};\n${spacing}h: ${height}`
    },
  )
}
