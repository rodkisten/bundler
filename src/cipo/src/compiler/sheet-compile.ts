import { runtime, evictIfNeeded } from '../runtime'
import type { CipoAstNode, CipoBlockNode, CipoCssInterpolation, CipoCssResult, CipoDeclarationNode, CipoScopedRule, CipoStylesheetArtifact, CipoWarning } from '../types'
import { transformCss } from '../transform'
import { buildSafeSource } from '../safe-source'
import { parseStylesheet } from '../parser'
import { formatCss, wrapLayer } from '../format'
import { createDeclaration, hashString } from '../utils'
import { compilePropertyBlock } from '../properties'
import { addImportant } from './important'
import { compileAtomicRule } from './atomic-compile'
import { collectRules } from './at-rules'

/** Compiles atoms and scoped rules into CSS. */
export function compileCss(atoms: readonly import('../types').CipoAtomicRule[], scopedRules: readonly CipoScopedRule[]): string {
  const atomicCss = atoms.map(compileAtomicRule).join('\n')
  const scopedCss = scopedRules.map(compileScopedRule).join('\n')
  return formatCss([wrapLayer('atomic', atomicCss), wrapLayer('scoped', scopedCss)].filter(Boolean).join('\n'))
}

/** Compiles one scoped rule. */
export function compileScopedRule(rule: CipoScopedRule): string {
  const declarations = rule.declarations.map(declaration => createDeclaration(declaration.property, runtime.config.important ? addImportant(declaration.value) : declaration.value)).join('')
  return importWrapContext(`${rule.selector}{${declarations}}`, rule.context)
}

function importWrapContext(rule: string, context: import('../types').CipoRuleContext): string {
  let output = rule
  if (context.mediaQuery) output = `@media ${context.mediaQuery}{${output}}`
  if (context.notBreakpoint) {
    const query = runtime.config.breakpoints[context.notBreakpoint]
    if (query) output = `@media not all and ${query}{${output}}`
  }
  if (context.supports) output = `@supports ${context.supports}{${output}}`
  if (context.container) output = `@container ${context.container}{${output}}`
  if (context.layer) output = `@layer ${context.layer}{${output}}`
  return output
}

/** Compiles explicit full stylesheet CSS. */
export function compileSheetCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoStylesheetArtifact {
  const rawCss = buildSafeSource(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'sheet-important' : 'sheet')
  const cached = getCachedArtifact(cacheKey)

  if (cached && isStylesheetArtifactLike(cached)) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createStylesheetArtifact(rawCss, transformedCss, ast, warnings, important)

  setCachedArtifact(cacheKey, artifact)
  return artifact
}

/** Compiles a stylesheet wrapped in a scope selector. */
export function compileScopedSheetCss(selector: string, strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoStylesheetArtifact {
  const rawCss = buildSafeSource(strings, values)
  const scopedSource = `${selector}{${rawCss}}`
  const cacheKey = createArtifactCacheKey(scopedSource, important ? 'sheet-scoped-important' : 'sheet-scoped')
  const cached = getCachedArtifact(cacheKey)
  if (cached && isStylesheetArtifactLike(cached)) return cached
  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(scopedSource, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createStylesheetArtifact(rawCss, transformedCss, ast, warnings, important)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}

/** Wraps a stylesheet artifact in a named cascade layer. */
export function wrapSheetLayer(name: string, artifact: CipoStylesheetArtifact): CipoStylesheetArtifact {
  const safeName = String(name || 'components').replace(/[^a-zA-Z0-9_.-]/g, '')
  const cssText = `@layer ${safeName}{${artifact.cssText}}`
  return {
    ...artifact,
    cssText: formatStylesheetText(cssText),
    debug: { ...artifact.debug, mode: 'stylesheet' as const },
    toString: () => formatStylesheetText(cssText),
    [Symbol.toPrimitive]: () => formatStylesheetText(cssText),
  }
}

/** Stable JIT cache key for artifacts. */
export function createArtifactCacheKey(rawCss: string, mode = ''): string {
  return [runtime.configVersion, runtime.themeVersion, runtime.config.prefix, runtime.config.important ? 'important' : '', runtime.config.minify ? 'min' : 'pretty', mode, rawCss].join('|')
}

/** Creates a full stylesheet artifact. */
export function createStylesheetArtifact(rawCss: string, transformedCss: string, ast: readonly CipoAstNode[], warnings: readonly CipoWarning[], forceImportant = false): CipoStylesheetArtifact {
  const cssText = compileStylesheetText(ast, forceImportant)
  const artifactId = `${runtime.config.prefix}-stylesheet-${hashString(rawCss)}`

  return {
    kind: 'cipo.stylesheet',
    rawCss,
    transformedCss,
    cssText,
    debug: { id: artifactId, ast, warnings, mode: 'stylesheet' },
    toString: () => cssText,
    [Symbol.toPrimitive]: () => cssText,
    [Symbol.toStringTag]: 'CipoStylesheetArtifact',
  }
}

/** Decides whether a polymorphic source should compile as a full stylesheet. */
export function shouldCompileAsStylesheet(rawCss: string, transformedCss: string, ast: readonly CipoAstNode[]): boolean {
  const source = transformedCss.trim()
  if (!source) return false
  if (hasTopLevelLooseStatements(rawCss)) return false
  if (ast.length === 0) return false
  for (const node of ast) {
    if (node.type !== 'block') return false
    if (!isStylesheetRootBlock(node)) return false
  }
  return true
}

/** Compiles a parsed full stylesheet AST into CSS text. */
export function compileStylesheetText(ast: readonly CipoAstNode[], forceImportant = false): string {
  let cssText = ''
  for (let index = 0; index < ast.length; index += 1) {
    const chunk = compileStylesheetNode(ast[index], [], forceImportant)
    if (!chunk) continue
    cssText += cssText ? `\n${chunk}` : chunk
  }
  return formatStylesheetText(cssText)
}

function compileStylesheetNode(node: CipoAstNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  if (node.type === 'declaration') return parentSelectors.length > 0 ? compileStylesheetRule(parentSelectors, [node], forceImportant) : compileDeclaration(node, forceImportant)
  if (node.type === 'directive') return ''
  return compileStylesheetBlock(node, parentSelectors, forceImportant)
}

function compileStylesheetBlock(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  const name = block.name.trim()
  if (isStylesheetAtRule(name)) return compileStylesheetAtRule(block, parentSelectors, forceImportant)
  if (name === 'reduce-motion') return wrapStylesheetRuntimeWrapper('@media (prefers-reduced-motion: reduce)', block, parentSelectors, forceImportant)
  if (name.startsWith('supports(')) return wrapStylesheetRuntimeWrapper(`@supports ${name.slice('supports('.length - 1)}`, block, parentSelectors, forceImportant)
  if (name.startsWith('layer(')) return wrapStylesheetRuntimeWrapper(`@layer ${name.slice('layer('.length, -1).trim()}`, block, parentSelectors, forceImportant)
  if (name.startsWith('container(')) return wrapStylesheetRuntimeWrapper(`@container ${name.slice('container('.length, -1).trim()}`, block, parentSelectors, forceImportant)
  if (name.startsWith('x:')) return compileStylesheetRuntimeBlock(block, parentSelectors, forceImportant)

  const selectors = resolveNestedSelectors(parentSelectors, splitSelectorList(name))
  const declarations: CipoDeclarationNode[] = []
  let output = ''

  for (let index = 0; index < block.body.length; index += 1) {
    const child = block.body[index]
    if (child.type === 'declaration') { declarations.push(child); continue }
    if (child.type === 'block') {
      if (declarations.length > 0) {
        const rule = compileStylesheetRule(selectors, declarations, forceImportant)
        output += output ? `\n${rule}` : rule
        declarations.length = 0
      }
      const nested = compileStylesheetBlock(child, selectors, forceImportant)
      if (nested) output += output ? `\n${nested}` : nested
    }
  }

  if (declarations.length > 0) {
    const rule = compileStylesheetRule(selectors, declarations, forceImportant)
    output += output ? `\n${rule}` : rule
  }
  return output
}

function wrapStylesheetRuntimeWrapper(wrapper: string, block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  let body = ''
  for (let index = 0; index < block.body.length; index += 1) {
    const chunk = compileStylesheetNode(block.body[index], parentSelectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }
  return body ? `${wrapper}{${body}}` : ''
}

function compileStylesheetRuntimeBlock(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  if (parentSelectors.length === 0) return ''
  let selectors = copyStrings(parentSelectors)
  const wrappers: string[] = []
  const name = block.name.trim()

  if (name.startsWith('x:not(')) {
    const breakpoint = name.replace(/^x:not\(/, '').replace(/\)$/, '').trim()
    const query = runtime.config.breakpoints[breakpoint]
    if (query) wrappers.push(`@media not all and ${query}`)
  } else {
    const contextParts = splitRuntimeContextParts(name.slice(2))
    for (const part of contextParts) {
      if (part in runtime.config.breakpoints) { const query = runtime.config.breakpoints[part]; if (query) wrappers.push(`@media ${query}`); continue }
      if (part.startsWith('cq(')) { wrappers.push(`@container ${part.slice(3, -1).trim()}`); continue }
      if (part === 'dark') { selectors = prefixSelectors(runtime.config.darkSelector, selectors); continue }
      if (part === 'motion-safe') { wrappers.push('@media (prefers-reduced-motion: no-preference)'); continue }
      if (part === 'motion-reduce') { wrappers.push('@media (prefers-reduced-motion: reduce)'); continue }
      if (isStylesheetPseudoName(part)) selectors = appendPseudoToSelectors(selectors, part)
    }
  }

  let body = ''
  for (let index = 0; index < block.body.length; index += 1) {
    const chunk = compileStylesheetNode(block.body[index], selectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }
  for (let index = wrappers.length - 1; index >= 0; index -= 1) body = `${wrappers[index]}{${body}}`
  return body
}

function compileStylesheetAtRule(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  const name = block.name.trim()
  if (name.startsWith('@property')) {
    const propertyName = name.slice('@property'.length).trim()
    const declarations: CipoDeclarationNode[] = []
    for (let index = 0; index < block.body.length; index += 1) {
      const child = block.body[index]
      if (child.type === 'declaration') declarations.push(child)
    }
    return compilePropertyBlock(propertyName, declarations)
  }
  let body = ''
  for (let index = 0; index < block.body.length; index += 1) {
    const chunk = compileStylesheetNode(block.body[index], parentSelectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }
  return body ? `${name}{${body}}` : ''
}

function compileStylesheetRule(selectors: readonly string[], declarations: readonly CipoDeclarationNode[], forceImportant: boolean): string {
  let body = ''
  for (let index = 0; index < declarations.length; index += 1) body += compileDeclaration(declarations[index], forceImportant)
  return `${joinSelectors(selectors)}{${body}}`
}

function compileDeclaration(declaration: CipoDeclarationNode, forceImportant: boolean): string {
  const important = runtime.config.important || forceImportant
  return `${declaration.property}:${important ? addImportant(declaration.value) : declaration.value};`
}

export function formatStylesheetText(cssText: string): string {
  return runtime.config.minify ? minifyStylesheetText(cssText) : prettyStylesheetText(cssText)
}

export function injectSheetInto(target: HTMLElement | ShadowRoot | Document, cssText: string): HTMLStyleElement {
  const parent = target instanceof Document ? target.head : target
  const element = document.createElement('style')
  element.dataset.cipoSheet = 'true'
  element.textContent = cssText
  parent.append(element)
  return element
}

export function getCachedArtifact(cacheKey: string): CipoCssResult | undefined {
  if (!runtime.config.jit.enabled || !runtime.config.jit.cache) return undefined
  return runtime.artifactCache.get(cacheKey) as CipoCssResult | undefined
}

export function setCachedArtifact(cacheKey: string, artifact: CipoCssResult): void {
  if (!runtime.config.jit.enabled || !runtime.config.jit.cache) return
  runtime.artifactCache.set(cacheKey, artifact)
  evictIfNeeded(runtime.artifactCache as Map<string, unknown>)
}

function isStylesheetArtifactLike(artifact: CipoCssResult): artifact is CipoStylesheetArtifact {
  return Boolean(artifact && 'kind' in artifact && artifact.kind === 'cipo.stylesheet')
}

function hasTopLevelLooseStatements(input: string): boolean {
  let buffer = ''; let depth = 0; let quote: '"' | "'" | null = null
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quote) { buffer += char; if (char === quote && input[index - 1] !== '\\') quote = null; continue }
    if (char === '"' || char === "'") { quote = char; buffer += char; continue }
    if (char === '{') { if (depth === 0 && buffer.trim()) buffer = ''; depth += 1; continue }
    if (char === '}') { depth = Math.max(0, depth - 1); if (depth === 0) buffer = ''; continue }
    if (depth === 0) { buffer += char; if (char === ';' && buffer.trim()) return true }
  }
  return buffer.trim().length > 0
}

function isStylesheetRootBlock(node: CipoBlockNode): boolean {
  const name = node.name.trim()
  if (!name) return false
  if (name.startsWith('x:')) return false
  if (name.startsWith('&')) return false
  if (isStylesheetAtRule(name)) return true
  if (isRootSelector(name)) return true
  return false
}

function isStylesheetAtRule(name: string): boolean {
  return /^@(media|supports|container|layer|scope|keyframes|font-face|property|page|starting-style)\b/.test(name)
}

function isRootSelector(name: string): boolean {
  if (name.startsWith('.') || name.startsWith('#') || name.startsWith(':') || name.startsWith('[') || name.startsWith('*')) return true
  if (name.includes(',') || name.includes('>') || name.includes('+') || name.includes('~') || name.includes(' ')) return true
  return /^[a-z][a-z0-9-]*$/i.test(name)
}

function isStylesheetPseudoName(name: string): boolean {
  return ['hover','focus','active','disabled','checked','focus-visible','focus-within','visited','first-child','last-child','before','after','target','open'].includes(name)
}

function resolveNestedSelectors(parents: readonly string[], children: readonly string[]): readonly string[] {
  if (parents.length === 0) return children
  const output: string[] = []
  for (const parent of parents) for (const child of children) output.push(child.includes('&') ? child.replaceAll('&', parent) : `${parent} ${child}`)
  return output
}

function splitSelectorList(selector: string): readonly string[] {
  const output: string[] = []; let buffer = ''; let depth = 0; let quote: '"' | "'" | null = null
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index]
    if (quote) { buffer += char; if (char === quote && selector[index - 1] !== '\\') quote = null; continue }
    if (char === '"' || char === "'") { quote = char; buffer += char; continue }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    if (char === ',' && depth === 0) { if (buffer.trim()) output.push(buffer.trim()); buffer = ''; continue }
    buffer += char
  }
  if (buffer.trim()) output.push(buffer.trim())
  return output
}

function minifyStylesheetText(cssText: string): string {
  return cssText.replace(/\s+/g, ' ').replace(/\s*([{}:;,>+~])\s*/g, '$1').trim()
}

function prettyStylesheetText(cssText: string): string {
  let output = ''; let token = ''; let depth = 0; let quote: '"' | "'" | null = null
  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index]
    if (quote) { token += char; if (char === quote && cssText[index - 1] !== '\\') quote = null; continue }
    if (char === '"' || char === "'") { quote = char; token += char; continue }
    if (char === '{') { output += `${indent(depth)}${token.trim()} {\n`; token = ''; depth += 1; continue }
    if (char === '}') { if (token.trim()) { output += `${indent(depth)}${token.trim()}\n`; token = '' }; depth = Math.max(0, depth - 1); output += `${indent(depth)}}\n`; continue }
    if (char === ';') { output += `${indent(depth)}${token.trim()};\n`; token = ''; continue }
    token += char
  }
  if (token.trim()) output += `${indent(depth)}${token.trim()}`
  return output.trim()
}

function indent(depth: number): string { return '  '.repeat(depth) }
function copyStrings(input: readonly string[]): string[] { const output = new Array<string>(input.length); for (let index = 0; index < input.length; index += 1) output[index] = input[index]; return output }
function splitRuntimeContextParts(input: string): string[] { const output: string[] = []; let start = 0; for (let index = 0; index <= input.length; index += 1) { if (index < input.length && input[index] !== ':') continue; const part = input.slice(start, index).trim(); if (part) output.push(part); start = index + 1 } return output }
function prefixSelectors(prefix: string, selectors: readonly string[]): string[] { const output = new Array<string>(selectors.length); for (let index = 0; index < selectors.length; index += 1) output[index] = `${prefix} ${selectors[index]}`; return output }
function appendPseudoToSelectors(selectors: readonly string[], pseudo: string): string[] { const output = new Array<string>(selectors.length); for (let index = 0; index < selectors.length; index += 1) output[index] = `${selectors[index]}:${pseudo}`; return output }
function joinSelectors(selectors: readonly string[]): string { let output = ''; for (let index = 0; index < selectors.length; index += 1) output += output ? `,${selectors[index]}` : selectors[index]; return output }
