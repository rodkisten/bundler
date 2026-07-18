import { addImportant } from './important'
import { compileSelector, wrapContext } from './selector'
import { formatCss, wrapLayer } from '../format'
import { runtime } from '../runtime'
import type { CipoAtomicRule, CipoScopedRule } from '../types'
import { createDeclaration } from '../utils'
import { createCompiledRule, type CipoCompiledRule } from './ir'

/** Converts one atomic rule into compiler IR. */
export function atomicRuleToIr(atom: CipoAtomicRule): CipoCompiledRule {
  return createCompiledRule(
    [compileSelector(atom.className, atom.context)],
    [{ property: atom.property, value: atom.value }],
    atom.context,
  )
}

/** Converts one component-scoped rule into compiler IR. */
export function scopedRuleToIr(rule: CipoScopedRule): CipoCompiledRule {
  return createCompiledRule(
    [rule.selector],
    rule.declarations.map((declaration) => ({
      property: declaration.property,
      value: runtime.config.important ? addImportant(declaration.value) : declaration.value,
    })),
    rule.context,
  )
}

/** Serializes one compiler-owned IR rule at the final emission boundary. */
export function serializeCompiledRule(rule: CipoCompiledRule): string {
  const declarations = rule.declarations
    .map((declaration) => createDeclaration(declaration.property, declaration.value))
    .join('')
  return wrapContext(`${rule.selectors.join(',')}{${declarations}}`, rule.context)
}

/** Compiles a single atomic rule. */
export function compileAtomicRule(atom: CipoAtomicRule): string {
  return serializeCompiledRule(atomicRuleToIr(atom))
}

/** Compiles a component-scoped rule using the shared IR emitter. */
export function compileScopedRule(rule: CipoScopedRule): string {
  return serializeCompiledRule(scopedRuleToIr(rule))
}

/** Compiles atoms and scoped rules into canonical layered CSS output. */
export function compileCss(
  atoms: readonly CipoAtomicRule[],
  scopedRules: readonly CipoScopedRule[],
): string {
  const atomicCss = atoms.map(compileAtomicRule).join('\n')
  const scopedCss = scopedRules.map(compileScopedRule).join('\n')
  return formatCss(
    [wrapLayer('atomic', atomicCss), wrapLayer('scoped', scopedCss)]
      .filter(Boolean)
      .join('\n'),
  )
}
