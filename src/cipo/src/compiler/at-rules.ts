import { runtime } from '../runtime'
import type { CipoAstNode, CipoAtomicRule, CipoDeclarationNode, CipoRuleContext, CipoScopedRule, CipoWarning } from '../types'
import { warn } from '../utils'
import { parseDeclarations } from '../parser'
import { expandWithCompat } from '../transform'
import { collectDeclaration, resolveBreakpointContext } from './declaration-compile'
import { resolveScopedSelector } from './selector-compile'

/** Collects atomic and scoped rules from an AST. */
export function collectRules(nodes: readonly CipoAstNode[], scopeClassName: string, warnings: CipoWarning[]) {
  const atoms: CipoAtomicRule[] = []
  const scopedRules: CipoScopedRule[] = []
  collect(nodes, {}, atoms, scopedRules, warnings, scopeClassName)
  return { atoms, scopedRules }
}

/** Recursive AST collector for atomic/component mode. */
export function collect(nodes: readonly CipoAstNode[], context: CipoRuleContext, atoms: CipoAtomicRule[], scopedRules: CipoScopedRule[], warnings: CipoWarning[], scopeClassName: string): void {
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

/** Collects one block from atomic/component mode. */
export function collectBlock(name: string, body: readonly CipoAstNode[], context: CipoRuleContext, atoms: CipoAtomicRule[], scopedRules: CipoScopedRule[], warnings: CipoWarning[], scopeClassName: string): void {
  const normalized = name.trim()

  if (normalized === 'reduce-motion') {
    collect(body, { ...context, mediaQuery: '(prefers-reduced-motion: reduce)' }, atoms, scopedRules, warnings, scopeClassName)
    return
  }

  if (normalized.startsWith('supports(')) {
    collect(body, { ...context, supports: normalized.slice('supports('.length, -1).trim() }, atoms, scopedRules, warnings, scopeClassName)
    return
  }

  if (normalized.startsWith('layer(')) {
    collect(body, { ...context, layer: normalized.slice('layer('.length, -1).trim() }, atoms, scopedRules, warnings, scopeClassName)
    return
  }

  if (normalized.startsWith('container(')) {
    collect(body, { ...context, container: normalized.slice('container('.length, -1).trim() }, atoms, scopedRules, warnings, scopeClassName)
    return
  }

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
      if (part.startsWith('cq(')) {
        nextContext = { ...nextContext, container: part.slice(3, -1).trim() }
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

/** Type guard for declaration nodes. */
export function isDeclarationNode(node: CipoAstNode): node is CipoDeclarationNode {
  return node.type === 'declaration'
}

/** Pseudo shorthands understood by atomic/component mode. */
export function isPseudoName(name: string): boolean {
  return ['hover','focus','active','disabled','checked','focus-visible','focus-within','visited','first-child','last-child','before','after','target','open'].includes(name)
}
