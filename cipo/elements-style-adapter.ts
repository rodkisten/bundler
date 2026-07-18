import type { ElementsAdapter, ElementsAdapterName, ElementsRecord } from '@rodkisten/fabrica-elements'
import { runtime } from './runtime'

/** Returns whether the active component adapter expects a JavaScript style object. */
export function needsObjectStyleAdapter(): boolean {
  return runtime.config.adapter === 'react' || runtime.config.adapter === 'preact'
}

/** Resolves the active Cipó adapter to the shared Fábrica Elements adapter contract. */
export function resolveElementsAdapter(): ElementsAdapterName | ElementsAdapter {
  return runtime.config.adapter as ElementsAdapterName | ElementsAdapter
}

/** Converts inline declaration text into a React/Preact-compatible style object. */
export function inlineCssTextToObject(cssText: string): ElementsRecord {
  const output: ElementsRecord = {}
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index <= cssText.length; index += 1) {
    const char = cssText[index] ?? ';'

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') { depth += 1; continue }
    if (char === ')' || char === ']') { depth = Math.max(0, depth - 1); continue }
    if (char !== ';' || depth !== 0) continue

    const declaration = cssText.slice(start, index).trim()
    start = index + 1
    if (!declaration) continue
    const colon = declaration.indexOf(':')
    if (colon <= 0) continue
    const property = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    if (property && value) output[toStylePropertyName(property)] = value
  }

  return output
}

function toStylePropertyName(property: string): string {
  if (property.startsWith('--')) return property
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}
