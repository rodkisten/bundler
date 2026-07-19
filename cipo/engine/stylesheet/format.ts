import { runtime } from '../../runtime'
import { minifyCssText } from '../../syntax/css-lexer'
import { isEscapedAt } from '../../runtime-dsl/shared'

/** Serializes generated stylesheet text according to the active compiler/runtime config. */
export function formatStylesheetText(cssText: string): string {
  return runtime.config.minify ? minifyCssText(cssText) : prettyStylesheetText(cssText)
}

/**
 * Formats stylesheet text while treating strings and comments as opaque lexical segments.
 * Structural punctuation inside either form therefore cannot affect indentation depth.
 */
function prettyStylesheetText(cssText: string): string {
  let output = ''
  let token = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index] ?? ''
    const next = cssText[index + 1] ?? ''

    if (quote) {
      token += char
      if (char === quote && !isEscapedAt(cssText, index)) quote = null
      continue
    }

    if (char === '/' && next === '*') {
      const end = cssText.indexOf('*/', index + 2)
      const commentEnd = end < 0 ? cssText.length : end + 2
      token += cssText.slice(index, commentEnd)
      index = commentEnd - 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      token += char
      continue
    }

    if (char === '{') {
      output += `${indent(depth)}${token.trim()} {\n`
      token = ''
      depth += 1
      continue
    }

    if (char === '}') {
      if (token.trim()) {
        output += `${indent(depth)}${token.trim()}\n`
        token = ''
      }
      depth = Math.max(0, depth - 1)
      output += `${indent(depth)}}\n`
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

function indent(depth: number): string {
  return '  '.repeat(depth)
}
