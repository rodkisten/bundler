import { runtime } from './runtime'
import type { CipoAstNode, CipoAtomicRule, CipoDeclarationNode, CipoRuleContext, CipoScopedRule, CipoWarning } from './types'
import { formatCss, wrapLayer } from './format'
import { createDeclaration, hashString, normalizeCss, splitTopLevel, warn } from './utils'
import { parseDeclarations } from './parser'
import { expandWithCompat } from './transform'

/**
 * Collects atomic and scoped rules from an AST.
 *
 * @param nodes - AST nodes.
 * @param scopeClassName - Generated scope class.
 * @param warnings - Warning sink.
 * @returns Atomic and scoped rules.
 */
export function collectRules(nodes: readonly CipoAstNode[], scopeClassName: string, warnings: CipoWarning[]) {
  const atoms: CipoAtomicRule[] = []
  const scopedRules: CipoScopedRule[] = []
  collect(nodes, {}, atoms, scopedRules, warnings, scopeClassName)
  return { atoms, scopedRules }
}

function collect(nodes: readonly CipoAstNode[], context: CipoRuleContext, atoms: CipoAtomicRule[], scopedRules: CipoScopedRule[], warnings: CipoWarning[], scopeClassName: string): void {
  for (const node of nodes) {
    if (node.type === 'declaration') {
      collectDeclaration(node, context, atoms)
      continue
    }

    if (node.type === 'directive') {
      if (node.name === 'with') {
        const expanded = expandWithCompat(`@with(${node.args.join(',')});`, warnings)
        collect(parseDeclarations(expanded, warnings), context, atoms, scopedRules, warnings, scopeClassName)
      }
      continue
    }

    collectBlock(node.name, node.body, context, atoms, scopedRules, warnings, scopeClassName)
  }
}

function collectDeclaration(declaration: CipoDeclarationNode, context: CipoRuleContext, atoms: CipoAtomicRule[]): void {
  const responsive = expandResponsiveDeclaration(declaration)
  if (!responsive) {
    atoms.push(createAtomicRule(declaration, context))
    return
  }

  for (const item of responsive) {
    atoms.push(createAtomicRule({ ...declaration, value: item.value, source: `${declaration.property}:${item.value}` }, resolveBreakpointContext(context, item.breakpoint)))
  }
}

function collectBlock(name: string, body: readonly CipoAstNode[], context: CipoRuleContext, atoms: CipoAtomicRule[], scopedRules: CipoScopedRule[], warnings: CipoWarning[], scopeClassName: string): void {
  const normalized = name.trim()

  if (normalized.startsWith('x:not(')) {
    const breakpoint = normalized.replace(/^x:not\(/, '').replace(/\)$/, '').trim()
    collect(body, { ...context, notBreakpoint: breakpoint }, atoms, scopedRules, warnings, scopeClassName)
    return
  }

  if (normalized.startsWith('x:')) {
    const contextParts = normalized.slice(2).split(':').map(part => part.trim()).filter(Boolean)
    let nextContext = context
    let consumed = false

    for (const part of contextParts) {
      if (part in runtime.config.breakpoints) {
        nextContext = resolveBreakpointContext(nextContext, part)
        consumed = true
        continue
      }
      if (part === 'dark') {
        nextContext = { ...nextContext, dark: true }
        consumed = true
        continue
      }
      if (part === 'motion-safe') {
        nextContext = { ...nextContext, mediaQuery: '(prefers-reduced-motion: no-preference)' }
        consumed = true
        continue
      }
      if (part === 'motion-reduce') {
        nextContext = { ...nextContext, mediaQuery: '(prefers-reduced-motion: reduce)' }
        consumed = true
        continue
      }
      if (isPseudoName(part)) {
        nextContext = { ...nextContext, pseudo: `:${part}` }
        consumed = true
      }
    }

    if (consumed) {
      collect(body, nextContext, atoms, scopedRules, warnings, scopeClassName)
      return
    }
  }

  if (runtime.variantRegistry.has(normalized)) {
    for (const selector of runtime.variantRegistry.get(normalized) ?? []) {
      scopedRules.push({ selector: resolveScopedSelector(scopeClassName, selector), declarations: body.filter(isDeclarationNode), context })
    }
    return
  }

  const declarations = body.filter(isDeclarationNode)
  if (declarations.length === 0) {
    warn(runtime, warnings, 'empty-scoped-rule', `Scoped rule "${normalized}" has no declarations.`, normalized)
    return
  }

  scopedRules.push({ selector: resolveScopedSelector(scopeClassName, normalized), declarations, context })
}

/**
 * Creates or reuses an atomic rule.
 *
 * @param declaration - Declaration node.
 * @param context - Rule context.
 * @returns Atomic rule.
 */
export function createAtomicRule(declaration: CipoDeclarationNode, context: CipoRuleContext): CipoAtomicRule {
  const value = runtime.config.important ? addImportant(declaration.value) : declaration.value
  const id = [normalizeCss(declaration.property), normalizeCss(value), context.mediaQuery ?? '', context.pseudo ?? '', context.dark ? 'dark' : '', context.notBreakpoint ?? '', context.supports ?? '', context.container ?? ''].join('|')
  const cached = runtime.atomicCache.get(id)
  if (cached) return cached

  const atom: CipoAtomicRule = {
    id,
    className: `${runtime.config.prefix}-a-${hashString(id)}`,
    property: declaration.property,
    value,
    context,
    source: declaration.source,
  }

  runtime.atomicCache.set(id, atom)
  runtime.debugAtoms.set(atom.className, atom)
  return atom
}

/**
 * Compiles atoms and scoped rules into CSS.
 *
 * @param atoms - Atomic rules.
 * @param scopedRules - Scoped rules.
 * @returns Formatted CSS.
 */
export function compileCss(atoms: readonly CipoAtomicRule[], scopedRules: readonly CipoScopedRule[]): string {
  const atomicCss = atoms.map(compileAtomicRule).join('\n')
  const scopedCss = scopedRules.map(compileScopedRule).join('\n')
  return formatCss([wrapLayer('atomic', atomicCss), wrapLayer('scoped', scopedCss)].filter(Boolean).join('\n'))
}

/**
 * Compiles one atomic rule.
 *
 * @param atom - Atomic rule.
 * @returns CSS rule.
 */
export function compileAtomicRule(atom: CipoAtomicRule): string {
  return wrapContext(`${compileSelector(atom.className, atom.context)}{${createDeclaration(atom.property, atom.value)}}`, atom.context)
}

/**
 * Compiles one scoped rule.
 *
 * @param rule - Scoped rule.
 * @returns CSS rule.
 */
export function compileScopedRule(rule: CipoScopedRule): string {
  const declarations = rule.declarations.map(declaration => createDeclaration(declaration.property, runtime.config.important ? addImportant(declaration.value) : declaration.value)).join('')
  return wrapContext(`${rule.selector}{${declarations}}`, rule.context)
}

export function compileSelector(className: string, context: CipoRuleContext): string {
  let selector = `.${className}`
  if (context.pseudo) selector += context.pseudo
  if (context.dark) selector = `${runtime.config.darkSelector} ${selector}`
  return selector
}

export function wrapContext(rule: string, context: CipoRuleContext): string {
  let output = rule
  if (context.mediaQuery) output = `@media ${context.mediaQuery}{${output}}`
  if (context.notBreakpoint) {
    const query = runtime.config.breakpoints[context.notBreakpoint]
    if (query) output = `@media not all and ${query}{${output}}`
  }
  if (context.supports) output = `@supports ${context.supports}{${output}}`
  if (context.container) output = `@container ${context.container}{${output}}`
  return output
}

export function addImportant(value: string): string {
  return /\s!important\s*$/i.test(value) ? value : `${value} !important`
}

export function joinClassNames(atoms: readonly CipoAtomicRule[], scopeClassName: string): string {
  const seen = new Set<string>()
  const output: string[] = []
  if (scopeClassName) { seen.add(scopeClassName); output.push(scopeClassName) }
  for (const atom of atoms) if (!seen.has(atom.className)) { seen.add(atom.className); output.push(atom.className) }
  return output.join(' ')
}

function expandResponsiveDeclaration(declaration: CipoDeclarationNode): Array<{ readonly breakpoint: string; readonly value: string }> | null {
  const parts = splitTopLevel(declaration.value, ',')
  const output: Array<{ readonly breakpoint: string; readonly value: string }> = []
  let hasResponsive = false

  for (const part of parts) {
    const match = part.trim().match(/^x:([a-zA-Z][\w-]*)\(([\s\S]*)\)$/)
    if (!match || match[1] === undefined || match[2] === undefined || !(match[1] in runtime.config.breakpoints)) {
      output.push({ breakpoint: 'base', value: part.trim() })
      continue
    }
    hasResponsive = true
    output.push({ breakpoint: match[1], value: match[2].trim() })
  }

  return hasResponsive ? output : null
}

function resolveBreakpointContext(context: CipoRuleContext, breakpoint: string): CipoRuleContext {
  const mediaQuery = runtime.config.breakpoints[breakpoint]
  return mediaQuery ? { ...context, breakpoint, mediaQuery } : context
}

function resolveScopedSelector(scopeClassName: string, selector: string): string {
  if (!selector) return `.${scopeClassName}`
  if (selector.includes('&')) return selector.replaceAll('&', `.${scopeClassName}`)
  return `.${scopeClassName} ${selector}`
}

function isDeclarationNode(node: CipoAstNode): node is CipoDeclarationNode {
  return node.type === 'declaration'
}

function isPseudoName(name: string): boolean {
  return ['hover','focus','active','disabled','checked','focus-visible','focus-within','visited','first-child','last-child','before','after','target','open'].includes(name)
}
