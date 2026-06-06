import type { CipoAstNode, CipoDeclarationNode, CipoWarning } from './types'
import { findMatchingBrace, findTopLevelColon, parseFunctionCall, splitTopLevel, warn } from './utils'
import { normalizePropertyDeclaration } from './values'
import { runtime } from './runtime'

/**
 * Parses transformed CSS into a small AST.
 *
 * @param input - Transformed CSS source.
 * @param warnings - Warning sink.
 * @returns AST nodes.
 *
 * @example
 * ```ts
 * parseStylesheet('px:4;x:hover{bg:$brand;}', [])
 * // declaration + block nodes
 * ```
 */
export function parseStylesheet(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  return parseBlockBody(input, warnings)
}

/**
 * Parses declarations/directives and nested blocks.
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

    const blockName = buffer.trim()
    buffer = ''
    const endIndex = findMatchingBrace(input, index)

    if (endIndex < 0) {
      warn(runtime, warnings, 'unclosed-block', `Block "${blockName}" is missing a closing brace.`, input.slice(index))
      buffer += input.slice(index)
      break
    }

    const body = input.slice(index + 1, endIndex)
    nodes.push({ type: 'block', name: blockName, body: parseBlockBody(body, warnings), source: `${blockName}{${body}}` })
    index = endIndex + 1
  }

  appendDeclarationsAndDirectives(nodes, buffer, warnings)
  return nodes
}

/**
 * Parses semicolon-separated declarations and alias function declarations.
 *
 * @param nodes - Output node list.
 * @param input - CSS declaration source.
 * @param warnings - Warning sink.
 * @returns Nothing.
 */
export function appendDeclarationsAndDirectives(nodes: CipoAstNode[], input: string, warnings: CipoWarning[]): void {
  for (const chunk of splitTopLevel(input, ';')) {
    const source = chunk.trim()
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
 * Parses old directive syntax.
 *
 * @param source - Directive source.
 * @param warnings - Warning sink.
 * @returns Directive node or null.
 */
export function parseDirective(source: string, warnings: CipoWarning[]) {
  const match = source.match(/^@([a-zA-Z][\w-]*)\(([\s\S]*)\)$/)
  if (!match || match[1] === undefined || match[2] === undefined) {
    warn(runtime, warnings, 'invalid-directive', `Invalid directive "${source}".`, source)
    return null
  }

  return { type: 'directive' as const, name: match[1], args: splitTopLevel(match[2], ','), source }
}

/**
 * Supports function-like declaration helpers that remain useful, e.g. text(...).
 *
 * @param source - Declaration candidate.
 * @param warnings - Warning sink.
 * @returns Generated declaration nodes.
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
 * Parses a raw declaration list into nodes.
 *
 * @param input - Declaration source.
 * @param warnings - Warning sink.
 * @returns Declaration/directive nodes.
 */
export function parseDeclarations(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  const nodes: CipoAstNode[] = []
  appendDeclarationsAndDirectives(nodes, input, warnings)
  return nodes
}
