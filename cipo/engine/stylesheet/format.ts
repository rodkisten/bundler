import { runtime } from '../../runtime'
import { minifyCssText } from '../../syntax/css-lexer'

/** Serializes generated stylesheet text according to the active compiler/runtime config. */
export function formatStylesheetText(cssText: string): string {
  return runtime.config.minify ? minifyCssText(cssText) : prettyStylesheetText(cssText)
}

function prettyStylesheetText(cssText: string): string {
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
    if (char === '"' || char === "'") { quote = char; token += char; continue }
    if (char === '{') { output += `${indent(depth)}${token.trim()} {\n`; token = ''; depth += 1; continue }
    if (char === '}') {
      if (token.trim()) { output += `${indent(depth)}${token.trim()}\n`; token = '' }
      depth = Math.max(0, depth - 1)
      output += `${indent(depth)}}\n`
      continue
    }
    if (char === ';') { output += `${indent(depth)}${token.trim()};\n`; token = ''; continue }
    token += char
  }
  if (token.trim()) output += `${indent(depth)}${token.trim()}`
  return output.trim()
}

function indent(depth: number): string {
  return '  '.repeat(depth)
}
