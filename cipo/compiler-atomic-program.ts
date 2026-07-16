import { addImportant } from '@rodkisten/cipo/compiler-important'
import { compileSelector, resolveScopedSelector, wrapContext } from '@rodkisten/cipo/compiler-selector-compile'
import { formatCss, wrapLayer } from '@rodkisten/cipo/format'
import { runtime } from '@rodkisten/cipo/runtime'
import type { CipoAtomicRule, CipoCssArtifact, CipoDeclarationNode, CipoScopedRule } from '@rodkisten/cipo/types'
import { createDeclaration } from '@rodkisten/cipo/utils'

/** Final shared stylesheet produced from a set of component artifacts. */
export interface CipoAtomicStylesheetProgram {
  /** One stylesheet containing promoted atoms and scoped one-use fallbacks. */
  readonly cssText: string
  /** Final minimal class list for each input artifact. */
  readonly classNames: ReadonlyMap<CipoCssArtifact, string>
  /** Globally promoted atomic rules, deduplicated by rule id. */
  readonly atoms: readonly CipoAtomicRule[]
  /** Component/nested rules plus single-use fallbacks. */
  readonly scopedRules: readonly CipoScopedRule[]
}

/** Compiles one atomic rule without depending on the component artifact compiler. */
export function compileAtomicProgramRule(atom: CipoAtomicRule): string {
  return wrapContext(
    `${compileSelector(atom.className, atom.context)}{${createDeclaration(atom.property, atom.value)}}`,
    atom.context,
  )
}

/** Compiles one scoped rule. */
export function compileAtomicProgramScopedRule(rule: CipoScopedRule): string {
  const declarations = rule.declarations
    .map((declaration) => createDeclaration(
      declaration.property,
      runtime.config.important ? addImportant(declaration.value) : declaration.value,
    ))
    .join('')

  return wrapContext(`${rule.selector}{${declarations}}`, rule.context)
}

/** Compiles a complete shared atomic/scoped stylesheet. */
export function compileAtomicStylesheet(
  atoms: readonly CipoAtomicRule[],
  scopedRules: readonly CipoScopedRule[],
): string {
  const atomicCss = atoms.map(compileAtomicProgramRule).join('\n')
  const scopedCss = scopedRules.map(compileAtomicProgramScopedRule).join('\n')
  return formatCss(
    [wrapLayer('atomic', atomicCss), wrapLayer('scoped', scopedCss)]
      .filter(Boolean)
      .join('\n'),
  )
}

/**
 * Finalizes component artifacts as one shared stylesheet.
 *
 * @remarks
 * Atomic usage is counted per component artifact, not per duplicate declaration
 * inside one component. Rules that reach `minUses` are emitted once as shared
 * atoms. Rules below the threshold remain scoped to their component class. This
 * makes a two-use threshold useful in practice: the first occurrence is a safe
 * scoped fallback and the second occurrence promotes both components to one atom.
 */
export function finalizeAtomicArtifacts(
  artifacts: readonly CipoCssArtifact[],
  minUses = runtime.config.atomic.minUses,
): CipoAtomicStylesheetProgram {
  const threshold = Number.isFinite(minUses)
    ? Math.max(1, Math.trunc(minUses))
    : Number.POSITIVE_INFINITY
  const usage = new Map<string, number>()
  const canonicalAtoms = new Map<string, CipoAtomicRule>()

  for (const artifact of artifacts) {
    const seen = new Set<string>()
    for (const atom of artifact.atoms) {
      canonicalAtoms.set(atom.id, canonicalAtoms.get(atom.id) ?? atom)
      if (seen.has(atom.id)) continue
      seen.add(atom.id)
      usage.set(atom.id, (usage.get(atom.id) ?? 0) + 1)
    }
  }

  const promotedAtoms: CipoAtomicRule[] = []
  const promotedIds = new Set<string>()
  for (const [id, atom] of canonicalAtoms) {
    if ((usage.get(id) ?? 0) < threshold) continue
    promotedIds.add(id)
    promotedAtoms.push(atom)
  }

  const classNames = new Map<CipoCssArtifact, string>()
  const scopedRules: CipoScopedRule[] = []
  const scopedKeys = new Set<string>()

  for (const artifact of artifacts) {
    const artifactAtoms: CipoAtomicRule[] = []
    const seenAtoms = new Set<string>()
    let needsScopeClass = artifact.scopedRules.length > 0

    for (const atom of artifact.atoms) {
      if (seenAtoms.has(atom.id)) continue
      seenAtoms.add(atom.id)

      if (promotedIds.has(atom.id)) {
        artifactAtoms.push(atom)
        continue
      }

      needsScopeClass = true
      pushScopedRule(
        scopedRules,
        scopedKeys,
        createAtomicFallbackRule(atom, artifact.scopeClassName),
      )
    }

    for (const rule of artifact.scopedRules) {
      pushScopedRule(scopedRules, scopedKeys, rule)
    }

    classNames.set(
      artifact,
      joinAtomicClassNames(artifactAtoms, needsScopeClass ? artifact.scopeClassName : ''),
    )
  }

  return {
    cssText: compileAtomicStylesheet(promotedAtoms, scopedRules),
    classNames,
    atoms: Object.freeze(promotedAtoms.slice()),
    scopedRules: Object.freeze(scopedRules.slice()),
  }
}

/** Creates a component-scoped fallback for one atom below the promotion threshold. */
export function createAtomicFallbackRule(
  atom: CipoAtomicRule,
  scopeClassName: string,
): CipoScopedRule {
  const declaration: CipoDeclarationNode = {
    type: 'declaration',
    property: atom.property,
    value: atom.value,
    source: atom.source,
  }

  return {
    selector: resolveScopedSelector(scopeClassName, ''),
    declarations: [declaration],
    context: atom.context,
  }
}

/** Joins a component scope class and promoted atoms with stable deduplication. */
export function joinAtomicClassNames(
  atoms: readonly CipoAtomicRule[],
  scopeClassName: string,
): string {
  const seen = new Set<string>()
  const output: string[] = []

  if (scopeClassName) {
    seen.add(scopeClassName)
    output.push(scopeClassName)
  }

  for (const atom of atoms) {
    if (seen.has(atom.className)) continue
    seen.add(atom.className)
    output.push(atom.className)
  }

  return output.join(' ')
}

function pushScopedRule(
  output: CipoScopedRule[],
  seen: Set<string>,
  rule: CipoScopedRule,
): void {
  const key = scopedRuleKey(rule)
  if (seen.has(key)) return
  seen.add(key)
  output.push(rule)
}

function scopedRuleKey(rule: CipoScopedRule): string {
  const declarations = rule.declarations
    .map((declaration) => `${declaration.property}:${declaration.value}`)
    .join(';')
  const context = rule.context
  return [
    rule.selector,
    declarations,
    context.breakpoint ?? '',
    context.mediaQuery ?? '',
    context.notBreakpoint ?? '',
    context.pseudo ?? '',
    context.selector ?? '',
    context.dark ? '1' : '0',
    context.supports ?? '',
    context.container ?? '',
    context.layer ?? '',
  ].join('|')
}
