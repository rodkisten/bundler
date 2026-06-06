import { DEFAULT_LAYER_DECLARATION } from './constants'
import { runtime } from './runtime'
import type { CipoLayerName } from './types'
import { normalizeCss } from './utils'

/**
 * Wraps generated CSS in a named cascade layer when layers are enabled.
 *
 * @param layer - Cipó layer name.
 * @param cssText - CSS body.
 * @returns Layer-wrapped CSS or raw CSS.
 *
 * @example
 * ```ts
 * wrapLayer('atomic', '.x{color:red;}')
 * // '@layer cipo.atomic{.x{color:red;}}'
 * ```
 */
export function wrapLayer(layer: CipoLayerName, cssText: string): string {
  if (!runtime.config.layers || !cssText.trim()) return cssText
  return `@layer cipo.${layer}{${cssText}}`
}

/**
 * Returns the static layer order declaration.
 *
 * @returns CSS layer declaration.
 */
export function getLayerDeclaration(): string {
  return DEFAULT_LAYER_DECLARATION
}

/**
 * Formats CSS according to runtime output settings.
 *
 * @param cssText - CSS text.
 * @returns Pretty or minified CSS.
 */
export function formatCss(cssText: string): string {
  return runtime.config.minify ? normalizeCss(cssText) : prettyCss(cssText)
}

/**
 * Pretty formatter purposely tiny enough for runtime usage.
 *
 * @remarks
 * This is not a full CSS formatter. It understands braces and semicolons, which
 * is enough for generated CSS where the compiler controls the structure.
 *
 * @param cssText - Generated CSS.
 * @returns Readable CSS.
 */
export function prettyCss(cssText: string): string {
  let output = ''
  let token = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index]

    if (quote) {
      token += char
      if (char === quote && cssText[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      token += char
      continue
    }

    if (char === '{') {
      output += `${indent(depth)}${token.trim()} {\n`
      depth += 1
      token = ''
      continue
    }

    if (char === '}') {
      if (token.trim()) output += `${indent(depth)}${token.trim()}\n`
      depth = Math.max(0, depth - 1)
      output += `${indent(depth)}}\n`
      token = ''
      continue
    }

    if (char === ';') {
      output += `${indent(depth)}${token.trim()};\n`
      token = ''
      continue
    }

    token += char
  }

  if (token.trim()) output += `${indent(depth)}${token.trim()}`
  return output.trim()
}

/**
 * Formats inline declarations.
 *
 * @param cssText - Declaration list.
 * @returns Inline-safe CSS text.
 */
export function formatInlineCss(cssText: string): string {
  if (runtime.config.minify) return normalizeCss(cssText)
  return cssText.replace(/;/g, '; ').replace(/\s+/g, ' ').trim()
}

function indent(depth: number): string {
  return '  '.repeat(depth)
}
