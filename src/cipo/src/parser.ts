import type { CipoAstNode, CipoDeclarationNode, CipoWarning } from './types'
import { findMatchingBrace, findTopLevelColon, parseFunctionCall, splitTopLevel, warn } from './utils'
import { normalizePropertyDeclaration } from './values'
import { runtime } from './runtime'

/**
 * Parses transformed CSS into Cipó's tiny AST.
 *
 * @remarks
 * This parser is intentionally small and fast. It is not a full CSS parser; it
 * only needs to understand the Cipó authoring surface:
 *
 * - declarations with optional semicolons;
 * - standalone aliases such as `glass` and `center`;
 * - function declarations such as `text(...)`;
 * - nested blocks such as `x:md { ... }` and `&:hover { ... }`;
 * - full stylesheet roots such as `.card { ... }` and `@media { ... }`.
 *
 * The important performance rule is that declarations are tokenized in one pass
 * instead of repeatedly splitting and reparsing the same text. This avoids the
 * Safari mobile freezes that appeared when semicolons were omitted.
 *
 * @param input - Transformed CSS source.
 * @param warnings - Warning sink for recoverable parser issues.
 * @returns Parsed AST nodes.
 *
 * @example Optional semicolons
 * ```ts
 * parseStylesheet(`
 *   px: 4
 *   py: 3
 *   bg: $brand
 * `, [])
 * // declaration nodes for padding-inline, padding-block and background
 * ```
 *
 * @example Nested runtime blocks
 * ```ts
 * parseStylesheet(`
 *   px: 4
 *
 *   x:md {
 *     px: 6
 *   }
 * `, [])
 * // declaration node + block node
 * ```
 */
export function parseStylesheet(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  return parseBlockBody(input, warnings)
}

/**
 * Parses declarations/directives and nested blocks from a block body.
 *
 * @remarks
 * When a `{` is found, this parser separates the trailing block selector from
 * any declarations that came before it. That matters for semicolon-free Cipó:
 *
 * ```css
 * px: 4
 * py: 3
 * x:md {
 *   px: 6
 * }
 * ```
 *
 * Before this implementation, the buffer before `{` became one giant block name,
 * causing invalid CSS, warning storms and browser freezes. Now `px` and `py` are
 * flushed first, then `x:md` becomes the block name.
 *
 * @param input - CSS block body.
 * @param warnings - Warning sink.
 * @returns AST nodes.
 */
export function parseBlockBody(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  const nodes: CipoAstNode[] = []
  let buffer = ''
  let index = 0

  while (index < input.length) {
    const char = input[index]

    if (char !== '{') {
      buffer += char
      index += 1
      continue
    }

    const { before, blockName } = splitBufferBeforeBlock(buffer)
    appendDeclarationsAndDirectives(nodes, before, warnings)
    buffer = ''

    if (!blockName) {
      warn(runtime, warnings, 'missing-block-name', 'A CSS block is missing its selector or runtime context.', input.slice(Math.max(0, index - 40), index + 40))
    }

    const endIndex = findMatchingBrace(input, index)

    if (endIndex < 0) {
      warn(runtime, warnings, 'unclosed-block', `Block "${blockName}" is missing a closing brace.`, input.slice(index))
      buffer += input.slice(index)
      break
    }

    const body = input.slice(index + 1, endIndex)
    nodes.push({
      type: 'block',
      name: blockName,
      body: parseBlockBody(body, warnings),
      source: `${blockName}{${body}}`,
    })

    index = endIndex + 1
  }

  appendDeclarationsAndDirectives(nodes, buffer, warnings)
  return nodes
}

/**
 * Parses a raw declaration list into nodes.
 *
 * @param input - Declaration source.
 * @param warnings - Warning sink.
 * @returns Declaration/directive nodes.
 *
 * @example
 * ```ts
 * parseDeclarations('px: 4\npy: 3', [])
 * // two declaration nodes
 * ```
 */
export function parseDeclarations(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  const nodes: CipoAstNode[] = []
  appendDeclarationsAndDirectives(nodes, input, warnings)
  return nodes
}

/**
 * Parses declarations, directives and declaration helpers.
 *
 * @remarks
 * Semicolons are optional. Newlines are accepted as declaration separators when
 * the current statement is complete and parentheses/brackets are balanced.
 *
 * @param nodes - Output node list.
 * @param input - CSS declaration source.
 * @param warnings - Warning sink.
 * @returns Nothing.
 */
export function appendDeclarationsAndDirectives(nodes: CipoAstNode[], input: string, warnings: CipoWarning[]): void {
  const tokens = tokenizeDeclarations(input)

  for (const source of tokens) {
    if (!source) continue

    if (source.startsWith('@')) {
      const directive = parseDirective(source, warnings)
      if (directive) nodes.push(directive)
      continue
    }

    const functionDeclaration = parseDeclarationFunction(source, warnings)
    if (functionDeclaration.length > 0) {
      nodes.push(...functionDeclaration)
      continue
    }

    const colonIndex = findTopLevelColon(source)
    if (colonIndex <= 0) {
      warn(runtime, warnings, 'invalid-declaration', `Invalid declaration "${source}".`, source)
      continue
    }

    const rawProperty = source.slice(0, colonIndex).trim()
    const rawValue = source.slice(colonIndex + 1).trim()
    nodes.push(...normalizePropertyDeclaration(rawProperty, rawValue))
  }
}

/**
 * Tokenizes declarations while allowing semicolons to be optional.
 *
 * @remarks
 * The tokenizer is line-aware and keeps nested function arguments intact. It is
 * deliberately conservative: it flushes on semicolons, on complete declaration
 * lines, and on standalone alias/helper lines.
 *
 * @param input - Declaration body.
 * @returns Declaration-like tokens.
 *
 * @example
 * ```ts
 * tokenizeDeclarations('px: 4\npy: 3\ntext(size: lg, lh: 1.1)')
 * // ['px: 4', 'py: 3', 'text(size: lg, lh: 1.1)']
 * ```
 */
export function tokenizeDeclarations(input: string): string[] {
  const output: string[] = []
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      buffer += char
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }

    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)

    if (char === ';' && depth === 0) {
      pushToken(output, buffer)
      buffer = ''
      continue
    }

    if ((char === '\n' || char === '\r') && depth === 0) {
      if (isCompleteDeclarationToken(buffer)) {
        pushToken(output, buffer)
        buffer = ''
      } else {
        buffer += ' '
      }
      continue
    }

    buffer += char
  }

  pushToken(output, buffer)
  return output
}

/**
 * Parses old directive syntax.
 *
 * @param source - Directive source.
 * @param warnings - Warning sink.
 * @returns Directive node or null.
 */
export function parseDirective(source: string, warnings: CipoWarning[]) {
  const match = source.match(/^@([a-zA-Z][\w-]*)\(([^]*)\)$/)
  if (!match || match[1] === undefined || match[2] === undefined) {
    warn(runtime, warnings, 'invalid-directive', `Invalid directive "${source}".`, source)
    return null
  }

  return { type: 'directive' as const, name: match[1], args: splitTopLevel(match[2], ','), source }
}

/**
 * Supports function-like declaration helpers that remain useful, e.g. text(...).
 *
 * @remarks
 * This intentionally ignores normal declarations such as `bg: var(...)` and
 * `color: color-mix(...)`. Only true top-level helper calls are handled here.
 * That prevents warnings like "Unknown declaration helper bg: var(...)".
 *
 * @param source - Declaration candidate.
 * @param warnings - Warning sink.
 * @returns Generated declaration nodes.
 *
 * @example
 * ```ts
 * parseDeclarationFunction('text(size: lg, weight: 800)', [])
 * // font-size + font-weight declarations
 * ```
 */
export function parseDeclarationFunction(source: string, warnings: CipoWarning[]): CipoDeclarationNode[] {
  const call = parseFunctionCall(source)
  if (!call) return []

  if (call.name === 'text') {
    return normalizePropertyDeclaration('text', call.args.join(','))
  }

  warn(runtime, warnings, 'unknown-function-declaration', `Unknown declaration helper "${call.name}(...)".`, source)
  return []
}

/**
 * Separates declarations before a nested block from the trailing block name.
 *
 * @param buffer - Text accumulated before `{`.
 * @returns Prefix declarations and block name.
 */
function splitBufferBeforeBlock(buffer: string): { readonly before: string; readonly blockName: string } {
  const trimmedEnd = buffer.replace(/\s+$/g, '')
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = trimmedEnd.length - 1; index >= 0; index -= 1) {
    const char = trimmedEnd[index]

    if (quote) {
      if (char === quote && trimmedEnd[index - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === ')' || char === ']') depth += 1
    else if (char === '(' || char === '[') depth = Math.max(0, depth - 1)

    if (depth === 0 && (char === ';' || char === '\n' || char === '\r')) {
      return {
        before: trimmedEnd.slice(0, index),
        blockName: trimmedEnd.slice(index + 1).trim(),
      }
    }
  }

  return { before: '', blockName: trimmedEnd.trim() }
}

/**
 * Appends one token when it contains meaningful content.
 *
 * @param output - Token list.
 * @param value - Current buffer value.
 * @returns Nothing.
 */
function pushToken(output: string[], value: string): void {
  const token = value.trim()
  if (token) output.push(token)
}

/**
 * Checks whether a line-level token is complete enough to flush.
 *
 * @param value - Current token candidate.
 * @returns Whether the token should be emitted.
 */
function isCompleteDeclarationToken(value: string): boolean {
  const token = value.trim()
  if (!token) return false
  if (token.endsWith(',') || token.endsWith(':')) return false
  if (findTopLevelColon(token) > 0) return true
  if (parseFunctionCall(token)) return true
  return /^[a-zA-Z_][\w-]*$/.test(token)
}
