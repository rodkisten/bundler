import { runtime } from '../runtime'
import type { CipoAtomicRule, CipoDeclarationNode, CipoRuleContext, CipoScopedRule } from '../types'
import { createDeclaration, hashString } from '../utils'
import { addImportant } from './important'
import { compileSelector, createAtomicRuleId, resolveScopedSelector, wrapContext } from './selector-compile'
import { createAtomicClassName } from './atomic-class-name'

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
 * Applies the configured atomic promotion threshold.
 *
 * Declarations below `atomic.minUses` stay inside the artifact scope class so
 * one-off rules do not pollute the shared atomic sheet. Once a declaration is
 * seen often enough, future artifacts reuse the shared atom.
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
        important: false,
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

import type { CipoAstNode, CipoCssArtifact, CipoCssInterpolation, CipoCssResult, CipoWarning } from '../types'
import { transformCss } from '../transform'
import { buildSafeSource } from '../safe-source'
import { parseStylesheet } from '../parser'
import { insertCss } from '../injection'
import { collectRules } from './at-rules'
import { compileCss, createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from './sheet-compile'

/** Compiles explicit atomic CSS and injects its generated rules. */
export function compileAtomicCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoCssArtifact {
  const rawCss = buildSafeSource(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'atomic-important' : 'atomic')
  const cacheable = runtime.config.atomic.minUses <= 1
  const cached = cacheable ? getCachedArtifact(cacheKey) : undefined

  if (cached && isAtomicCssArtifactLike(cached)) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createAtomicArtifact(rawCss, transformedCss, ast, warnings, important)

  insertCss(artifact.compiledCss)
  if (cacheable) setCachedArtifact(cacheKey, artifact)
  return artifact
}

/** Creates the legacy atomic/component artifact. */
export function createAtomicArtifact(rawCss: string, transformedCss: string, ast: readonly CipoAstNode[], warnings: readonly CipoWarning[], forceImportant = false): CipoCssArtifact {
  const mutableWarnings = [...warnings]
  const scopeClassName = `${runtime.config.prefix}-s-${hashString(transformedCss)}`
  const previousImportant = runtime.config.important
  runtime.config.important = previousImportant || forceImportant
  const collected = collectRules(ast, scopeClassName, mutableWarnings)
  const promoted = partitionPromotedAtoms(collected.atoms, scopeClassName)
  const atoms = promoted.atoms
  const scopedRules = [...promoted.scopedRules, ...collected.scopedRules]
  const className = joinClassNames(atoms, scopedRules.length > 0 ? scopeClassName : '')
  const compiledCss = compileCss(atoms, scopedRules)
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
