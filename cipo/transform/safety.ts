import { installNativePropertyGuards } from '../native-property-guards'
import { runtime } from '../runtime'
import { mapCssCodeSegments } from '../syntax/css-lexer'
import { splitTopLevel, toKebabMixed } from '../utils'

const NATIVE_SLASH_TOKEN = 'var(--cipo-internal-native-slash-7f3c, /)'
const NATIVE_SLASH_PROPERTIES = /^(?:font|grid(?:-[\w-]+)?|aspect-ratio)$/i

let nativePropertyGuardsInstalled = false

/**
 * Applies lexical protection passes before the runtime DSL is expanded.
 *
 * @remarks
 * All textual rewrites are constrained to CSS code segments. Quoted strings and
 * comments are opaque, which prevents design-language conveniences from changing
 * semantic text such as `content: "{ foo"` or custom-property string payloads.
 */
export function prepareCoreCssInput(input: string): string {
  if (!nativePropertyGuardsInstalled) {
    installNativePropertyGuards()
    nativePropertyGuardsInstalled = true
  }

  const properties = normalizePropertyDirectiveNames(input)
  const compact = normalizeCompactRuntimeBlocks(properties)
  const sized = expandCoreSizeCalls(compact)
  return protectNativeSlashes(sized)
}

/** Applies the final lexical restoration passes after helper/theme expansion. */
export function finalizeCoreCssOutput(input: string): string {
  return joinNestedSelectorLists(resolveRemainingRuntimeVars(restoreNativeSlashes(input)))
}

/** Normalizes template chunks without entering quoted CSS strings/comments. */
export function normalizeTemplateChunk(value: string): string {
  return protectNativeSlashes(joinNestedSelectorLists(normalizeCompactRuntimeBlocks(value)))
}

/** Makes compact runtime blocks declaration-safe outside quoted content. */
export function normalizeCompactRuntimeBlocks(input: string): string {
  return mapCssCodeSegments(input, (segment) => segment
    .replace(/\{[ \t]+(?=[#$a-zA-Z_-])/g, '{\n')
    .replace(/;[ \t]*\}/g, ';\n}'))
}

/**
 * Expands standalone `size(...)` declarations into width/height aliases.
 * Arguments are split only at top level so nested native CSS functions survive.
 */
export function expandCoreSizeCalls(input: string): string {
  return mapCssCodeSegments(input, (segment) => segment.replace(
    /(^|[;{}\n])(\s*)size\(([^{}\n;]*)\)(?=\s*(?:;|\n|}|$))/g,
    (_all, edge: string, spacing: string, raw: string) => {
      const parts = splitTopLevel(raw, ',')
      const width = (parts[0] || '').trim()
      const height = (parts[1] || width).trim()
      if (!width) return `${edge}${spacing}`
      return `${edge}${spacing}w: ${width};\n${spacing}h: ${height}`
    },
  ))
}

/** Converts declarative `@property $$name` headers to prefixed custom properties. */
export function normalizePropertyDirectiveNames(input: string): string {
  return mapCssCodeSegments(input, (segment) => {
    const marker = '@property $$'
    const parts = segment.split(marker)
    if (parts.length === 1) return segment

    let output = parts[0] || ''
    for (let index = 1; index < parts.length; index += 1) {
      const part = parts[index] || ''
      let end = 0
      while (end < part.length && /[a-zA-Z0-9_.-]/.test(part[end] || '')) end += 1
      const name = toKebabMixed(part.slice(0, end).replace(/[._]+/g, '-'))
      output += `@property --${runtime.config.prefix}-${name}${part.slice(end)}`
    }
    return output
  })
}

/**
 * Protects native slash grammar in `font`, `grid*` and `aspect-ratio` values.
 *
 * @remarks
 * The declaration scanner tracks strings, comments and parentheses instead of
 * running a whole-source regular expression. This supports quoted font families
 * and compact syntax such as `font:16px/1.4 "Inter"` without touching `/` inside
 * strings or comments.
 */
export function protectNativeSlashes(input: string): string {
  const ranges = findDeclarationValueRanges(input)
    .filter((range) => NATIVE_SLASH_PROPERTIES.test(range.property))
    .reverse()

  let output = input
  for (const range of ranges) {
    const value = output.slice(range.start, range.end)
    const protectedValue = replaceUnquotedSlashes(value, NATIVE_SLASH_TOKEN)
    if (protectedValue === value) continue
    output = output.slice(0, range.start) + protectedValue + output.slice(range.end)
  }
  return output
}

/** Restores private native slash markers emitted by `protectNativeSlashes`. */
export function restoreNativeSlashes(input: string): string {
  return input.split(NATIVE_SLASH_TOKEN).join('/')
}

/** Resolves deferred value-side `$$name` references outside strings/comments. */
export function resolveRemainingRuntimeVars(input: string): string {
  return mapCssCodeSegments(input, (segment) => segment.replace(
    /(?<![\w-])\$\$([a-zA-Z_][\w.-]*)(?![\w.-])(?!\s*:)/g,
    (_match, name: string) => {
      const normalized = name
        .replace(/[._]+/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
      return `var(--${runtime.config.prefix}-${normalized})`
    },
  ))
}

/** Repairs multiline nested selector continuations without rewriting quoted text. */
export function joinNestedSelectorLists(input: string): string {
  return mapCssCodeSegments(input, (segment) => {
    const lines = segment.split(/\r?\n/)
    const output: string[] = []

    for (let index = 0; index < lines.length; index += 1) {
      let line = lines[index] || ''
      while (line.trimEnd().endsWith(',') && index + 1 < lines.length) {
        const next = lines[index + 1] || ''
        const selector = next.trimStart()
        if (!selector.startsWith('&')) break
        line = `${line.trimEnd()}${selector}`
        index += 1
      }
      output.push(line)
    }

    return output.join('\n').replace(/&:\s+(?=[a-zA-Z_-])/g, '&:')
  })
}

interface DeclarationValueRange {
  readonly property: string
  readonly start: number
  readonly end: number
}

function findDeclarationValueRanges(input: string): DeclarationValueRange[] {
  const ranges: DeclarationValueRange[] = []
  let segmentStart = 0
  let quote = ''
  let escaped = false
  let blockComment = false
  let parenDepth = 0

  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index] ?? ''
    const next = input[index + 1] ?? ''

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(') {
      parenDepth += 1
      continue
    }
    if (char === ')' && parenDepth > 0) {
      parenDepth -= 1
      continue
    }

    if (parenDepth === 0 && char === ':') {
      const rawProperty = input.slice(segmentStart, index).trim()
      const property = rawProperty.replace(/^.*[;{}\n\r]/s, '').trim()
      if (!property || !/^-?[A-Za-z][\w-]*$/.test(property)) continue
      const end = findDeclarationEnd(input, index + 1)
      ranges.push({ property, start: index + 1, end })
      index = Math.max(index, end - 1)
      segmentStart = end < input.length && input[end] === '}' ? end : end + 1
      parenDepth = 0
      continue
    }

    if (parenDepth === 0 && (char === ';' || char === '{' || char === '}' || char === '\n' || char === '\r')) {
      segmentStart = index + 1
    }
  }

  return ranges
}

function findDeclarationEnd(input: string, start: number): number {
  let quote = ''
  let escaped = false
  let blockComment = false
  let parenDepth = 0

  for (let index = start; index < input.length; index += 1) {
    const char = input[index]!
    const next = input[index + 1] ?? ''
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(') parenDepth += 1
    else if (char === ')' && parenDepth > 0) parenDepth -= 1
    else if (parenDepth === 0 && (char === ';' || char === '}' || char === '\n' || char === '\r')) return index
  }
  return input.length
}

function replaceUnquotedSlashes(input: string, replacement: string): string {
  return mapCssCodeSegments(input, (segment) => segment.replaceAll('/', replacement))
}
