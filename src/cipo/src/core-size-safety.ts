import { splitTopLevel } from './utils'

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
