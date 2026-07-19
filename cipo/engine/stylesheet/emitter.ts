import { compilePropertyBlock } from '../../properties'
import { runtime } from '../../runtime'
import type { CipoAstNode, CipoBlockNode, CipoDeclarationNode } from '../../types'
import { classifyAtRule, isStylesheetAtRuleName } from '../at-rule-kinds'
import { addImportant } from '../important'
import { isCipoPseudoName } from '../pseudos'
import { applyConfiguredScopeToSelectors } from '../selector'
import { formatStylesheetText } from './format'
import {
  appendPseudoToSelectors,
  copyStrings,
  joinSelectors,
  prefixSelectors,
  resolveNestedSelectors,
  splitRuntimeContextParts,
  splitSelectorList,
} from './selectors'

/** Compiles a parsed full stylesheet AST into CSS text. */
export function compileStylesheetText(ast: readonly CipoAstNode[], forceImportant = false): string {
  let cssText = ''
  for (let index = 0; index < ast.length; index += 1) {
    const chunk = compileStylesheetNode(ast[index]!, [], forceImportant)
    if (chunk) cssText += cssText ? `\n${chunk}` : chunk
  }
  return formatStylesheetText(cssText)
}

function compileStylesheetNode(node: CipoAstNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  if (node.type === 'declaration') {
    return parentSelectors.length > 0
      ? compileStylesheetRule(parentSelectors, [node], forceImportant)
      : compileDeclaration(node, forceImportant)
  }
  if (node.type === 'directive') return ''
  return compileStylesheetBlock(node, parentSelectors, forceImportant)
}

function compileStylesheetBlock(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  const name = block.name.trim()
  if (isStylesheetAtRuleName(name)) return compileStylesheetAtRule(block, parentSelectors, forceImportant)
  if (name === 'reduce-motion') {
    return wrapStylesheetRuntimeWrapper('@media (prefers-reduced-motion: reduce)', block, parentSelectors, forceImportant)
  }
  const supports = readRuntimeWrapperArgument(name, 'supports')
  if (supports !== undefined) {
    return supports === null ? '' : wrapStylesheetRuntimeWrapper(`@supports (${supports})`, block, parentSelectors, forceImportant)
  }
  const layer = readRuntimeWrapperArgument(name, 'layer')
  if (layer !== undefined) {
    return layer === null ? '' : wrapStylesheetRuntimeWrapper(`@layer ${layer}`, block, parentSelectors, forceImportant)
  }
  const container = readRuntimeWrapperArgument(name, 'container')
  if (container !== undefined) {
    return container === null ? '' : wrapStylesheetRuntimeWrapper(`@container ${container}`, block, parentSelectors, forceImportant)
  }
  if (name.startsWith('x:')) return compileStylesheetRuntimeBlock(block, parentSelectors, forceImportant)

  const selectors = resolveNestedSelectors(parentSelectors, splitSelectorList(name))
  const declarations: CipoDeclarationNode[] = []
  let output = ''

  for (const child of block.body) {
    if (child.type === 'declaration') { declarations.push(child); continue }
    if (child.type !== 'block') continue
    if (declarations.length > 0) {
      const rule = compileStylesheetRule(selectors, declarations, forceImportant)
      output += output ? `\n${rule}` : rule
      declarations.length = 0
    }
    const nested = compileStylesheetBlock(child, selectors, forceImportant)
    if (nested) output += output ? `\n${nested}` : nested
  }

  if (declarations.length > 0) {
    const rule = compileStylesheetRule(selectors, declarations, forceImportant)
    output += output ? `\n${rule}` : rule
  }
  return output
}

function wrapStylesheetRuntimeWrapper(
  wrapper: string,
  block: CipoBlockNode,
  parentSelectors: readonly string[],
  forceImportant: boolean,
): string {
  let body = ''
  for (const child of block.body) {
    const chunk = compileStylesheetNode(child, parentSelectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }
  return body ? `${wrapper}{${body}}` : ''
}

function compileStylesheetRuntimeBlock(
  block: CipoBlockNode,
  parentSelectors: readonly string[],
  forceImportant: boolean,
): string {
  if (parentSelectors.length === 0) return ''
  let selectors = copyStrings(parentSelectors)
  const wrappers: string[] = []
  const name = block.name.trim()

  if (name.startsWith('x:not(')) {
    const breakpoint = name.replace(/^x:not\(/, '').replace(/\)$/, '').trim()
    const query = runtime.config.breakpoints[breakpoint]
    if (query) wrappers.push(`@media not all and ${query}`)
  } else {
    for (const part of splitRuntimeContextParts(name.slice(2))) {
      if (part in runtime.config.breakpoints) {
        const query = runtime.config.breakpoints[part]
        if (query) wrappers.push(`@media ${query}`)
        continue
      }
      if (part.startsWith('cq(')) { wrappers.push(`@container ${part.slice(3, -1).trim()}`); continue }
      if (part === 'dark') { selectors = prefixSelectors(runtime.config.darkSelector, selectors); continue }
      if (part === 'motion-safe') { wrappers.push('@media (prefers-reduced-motion: no-preference)'); continue }
      if (part === 'motion-reduce') { wrappers.push('@media (prefers-reduced-motion: reduce)'); continue }
      if (isCipoPseudoName(part)) { selectors = appendPseudoToSelectors(selectors, part); continue }
      runtime.warningSink.push({
        code: 'cipo-unknown-runtime-context',
        message: `Unknown runtime context: x:${part}`,
        source: block.name,
      })
    }
  }

  let body = ''
  for (const child of block.body) {
    const chunk = compileStylesheetNode(child, selectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }
  for (let index = wrappers.length - 1; index >= 0; index -= 1) body = `${wrappers[index]}{${body}}`
  return body
}

function compileStylesheetAtRule(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  const name = block.name.trim()
  const kind = classifyAtRule(name)
  if (name.startsWith('@property')) {
    const propertyName = name.slice('@property'.length).trim()
    const declarations = block.body.filter((node): node is CipoDeclarationNode => node.type === 'declaration')
    return compilePropertyBlock(propertyName, declarations)
  }
  if (kind === 'keyframes') return compileKeyframesAtRule(block)
  if (kind === 'declaration-block') return compileDeclarationBlockAtRule(block)

  let body = ''
  for (const child of block.body) {
    const chunk = compileStylesheetNode(child, parentSelectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }
  return body ? `${name}{${body}}` : ''
}

function compileDeclarationBlockAtRule(block: CipoBlockNode): string {
  let body = ''
  for (const child of block.body) if (child.type === 'declaration') body += compileDeclaration(child, false, true)
  return body ? `${block.name.trim()}{${body}}` : ''
}

function compileKeyframesAtRule(block: CipoBlockNode): string {
  let body = ''
  for (const child of block.body) {
    if (child.type !== 'block') continue
    const declarations = child.body.filter((node): node is CipoDeclarationNode => node.type === 'declaration')
    if (declarations.length === 0) continue
    let declarationText = ''
    for (const declaration of declarations) declarationText += compileDeclaration(declaration, false, true)
    body += `${child.name.trim()}{${declarationText}}`
  }
  return body ? `${block.name.trim()}{${body}}` : ''
}

function compileStylesheetRule(
  selectors: readonly string[],
  declarations: readonly CipoDeclarationNode[],
  forceImportant: boolean,
): string {
  let body = ''
  for (const declaration of declarations) body += compileDeclaration(declaration, forceImportant)
  return `${joinSelectors(applyConfiguredScopeToSelectors(selectors))}{${body}}`
}

function compileDeclaration(
  declaration: CipoDeclarationNode,
  forceImportant: boolean,
  suppressImportant = false,
): string {
  const important = !suppressImportant && (runtime.config.important || forceImportant)
  return `${declaration.property}:${important ? addImportant(declaration.value) : declaration.value};`
}

/** Parses one function-style runtime wrapper and rejects malformed or empty arguments. */
function readRuntimeWrapperArgument(name: string, wrapper: string): string | null | undefined {
  const prefix = `${wrapper}(`
  if (!name.startsWith(prefix)) return undefined
  if (!name.endsWith(')')) return null
  const value = name.slice(prefix.length, -1).trim()
  return value || null
}
