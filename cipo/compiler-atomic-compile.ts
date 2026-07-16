import { runtime } from '@rodkisten/cipo/runtime'
import type { CipoAtomicRule, CipoDeclarationNode, CipoRuleContext, CipoScopedRule } from '@rodkisten/cipo/types'
import { createDeclaration, hashString } from '@rodkisten/cipo/utils'
import { addImportant } from '@rodkisten/cipo/compiler-important'
import { compileSelector, createAtomicRuleId, resolveScopedSelector, wrapContext } from '@rodkisten/cipo/compiler-selector-compile'
import { createAtomicClassName } from '@rodkisten/cipo/compiler-atomic-class-name'

/** Creates or reuses an atomic rule for a declaration/context pair. */
export function createAtomicRule(declaration: CipoDeclarationNode, context: CipoRuleContext): CipoAtomicRule {
  const value = runtime.config.important ? addImportant(declaration.value) : declaration.value
  const id = createAtomicRuleId(declaration.property, value, context)
  const cached = runtime.atomicCache.get(id)
  if (cached) return cached

  const atom: CipoAtomicRule = {
    id,
    className: createAtomicClassName(declaration.property, value, context, id),
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
 * Applies the legacy streaming atomic promotion threshold.
 *
 * @deprecated Runtime styled/component output now uses the global artifact
 * collector, which can retroactively promote earlier components when reuse reaches
 * the configured threshold. Kept for compatibility with direct compiler callers.
 */
export function partitionPromotedAtoms(
  atoms: readonly CipoAtomicRule[],
  scopeClassName: string,
): { readonly atoms: readonly CipoAtomicRule[]; readonly scopedRules: CipoScopedRule[] } {
  const minUses = runtime.config.atomic.minUses
  if (minUses <= 1) return { atoms, scopedRules: [] }

  const promoted: CipoAtomicRule[] = []
  const scopedRules: CipoScopedRule[] = []
  for (const atom of atoms) {
    const nextCount = (runtime.atomicUsageCounts.get(atom.id) || 0) + 1
    runtime.atomicUsageCounts.set(atom.id, nextCount)
    if (nextCount >= minUses) {
      runtime.atomicSingleUseFallbacks.delete(atom.id)
      promoted.push(atom)
      continue
    }
    runtime.atomicSingleUseFallbacks.set(atom.id, atom)
    scopedRules.push({
      selector: resolveScopedSelector(scopeClassName, ''),
      declarations: [{
        type: 'declaration',
        property: atom.property,
        value: atom.value,
        source: atom.source,
      }],
      context: atom.context,
    })
  }
  return { atoms: promoted, scopedRules }
}

/** Compiles one atomic rule. */
export function compileAtomicRule(atom: CipoAtomicRule): string {
  return wrapContext(`${compileSelector(atom.className, atom.context)}{${createDeclaration(atom.property, atom.value)}}`, atom.context)
}

/** Joins atomic and scope classes while preserving insertion order and uniqueness. */
export function joinClassNames(atoms: readonly CipoAtomicRule[], scopeClassName: string): string {
  const seen = new Set<string>()
  const output: string[] = []
  if (scopeClassName) { seen.add(scopeClassName); output.push(scopeClassName) }
  for (const atom of atoms) if (!seen.has(atom.className)) { seen.add(atom.className); output.push(atom.className) }
  return output.join(' ')
}

import type { CipoAstNode, CipoCssArtifact, CipoCssInterpolation, CipoCssResult, CipoWarning } from '@rodkisten/cipo/types'
import { transformCss } from '@rodkisten/cipo/transform'
import { buildSafeSource } from '@rodkisten/cipo/safe-source'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { insertCss, registerAtomicArtifact } from '@rodkisten/cipo/injection'
import { collectRules } from '@rodkisten/cipo/compiler-at-rules'
import { compileCss, createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from '@rodkisten/cipo/compiler-sheet-compile'

/** Compiles explicit atomic CSS and registers its generated rules. */
export function compileAtomicCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoCssArtifact {
  const rawCss = buildSafeSource(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'atomic-important' : 'atomic')
  const cacheable = runtime.config.atomic.minUses <= 1
  const cached = cacheable ? getCachedArtifact(cacheKey) : undefined

  if (cached && isAtomicCssArtifactLike(cached)) {
    insertCss(cached.compiledCss)
    return cached
  }

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createAtomicArtifact(rawCss, transformedCss, ast, warnings, important)

  if (runtime.config.atomic.minUses <= 1) insertCss(artifact.compiledCss)
  else registerAtomicArtifact(artifact)
  if (cacheable) setCachedArtifact(cacheKey, artifact)
  return artifact
}

/**
 * Creates a component artifact while preserving every atomic candidate.
 *
 * With thresholded atomization, the class list includes the stable scope class
 * and all candidate atomic classes from the first render. The shared runtime
 * stylesheet initially emits scoped fallbacks; when a later component reaches
 * the reuse threshold, it swaps those fallbacks for one shared atomic rule without
 * requiring existing DOM nodes to be rewritten.
 */
export function createAtomicArtifact(rawCss: string, transformedCss: string, ast: readonly CipoAstNode[], warnings: readonly CipoWarning[], forceImportant = false): CipoCssArtifact {
  const mutableWarnings = [...warnings]
  const scopeClassName = `${runtime.config.prefix}-s-${hashString(transformedCss)}`
  const previousImportant = runtime.config.important
  runtime.config.important = previousImportant || forceImportant
  const collected = collectRules(ast, scopeClassName, mutableWarnings)
  const atoms = collected.atoms
  const thresholded = runtime.config.atomic.minUses > 1
  const scopedRules = collected.scopedRules
  const className = joinClassNames(atoms, thresholded || scopedRules.length > 0 ? scopeClassName : '')
  const fallbackRules: CipoScopedRule[] = thresholded
    ? atoms.map((atom) => ({
        selector: resolveScopedSelector(scopeClassName, ''),
        declarations: [{
          type: 'declaration' as const,
          property: atom.property,
          value: atom.value,
          source: atom.source,
        }],
        context: atom.context,
      }))
    : []
  const compiledCss = compileCss(thresholded ? [] : atoms, [...fallbackRules, ...scopedRules])
  runtime.config.important = previousImportant
  const artifactId = `${runtime.config.prefix}-artifact-${hashString(rawCss)}`

  return {
    kind: 'cipo.css',
    className,
    scopeClassName,
    atoms,
    scopedRules,
    rawCss,
    transformedCss,
    compiledCss,
    debug: { id: artifactId, ast, atoms, scopedRules, warnings: mutableWarnings },
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: 'CipoCssArtifact',
  }
}

function isAtomicCssArtifactLike(artifact: CipoCssResult): artifact is CipoCssArtifact {
  return Boolean(artifact && 'kind' in artifact && artifact.kind === 'cipo.css')
}
