import { collectRules } from '../at-rules'
import { createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from '../cache'
import { compileCss } from '../emitter'
import { joinAtomicClassNames } from './utils'
import { insertCss } from '../../injection'
import { parseStylesheet } from '../../syntax/parser'
import { runtime } from '../../runtime'
import { buildSafeSource } from '../../transform/source'
import { transformCss } from '../../transform/index'
import type {
  CipoAstNode,
  CipoAtomicRule,
  CipoCssArtifact,
  CipoCssInterpolation,
  CipoCssResult,
  CipoScopedRule,
  CipoWarning,
} from '../../types'
import { hashString, hashString64 } from '../../utils'
import { assertGeneratedNameIdentity } from '../hash-registry'
import { resolveScopedSelector } from '../selector'

export { createAtomicRule } from './rule'
export { compileAtomicRule } from '../emitter'

/** Applies streaming promotion for explicit atomic.css calls. */
export function partitionPromotedAtoms(
  atoms: readonly CipoAtomicRule[],
  scopeClassName: string,
): { readonly atoms: readonly CipoAtomicRule[]; readonly scopedRules: CipoScopedRule[] } {
  const minUses = runtime.config.atomic.minUses
  if (minUses <= 1) return { atoms, scopedRules: [] }

  const promoted: CipoAtomicRule[] = []
  const scopedRules: CipoScopedRule[] = []
  const seen = new Set<string>()

  for (const atom of atoms) {
    if (seen.has(atom.id)) continue
    seen.add(atom.id)

    const nextCount = (runtime.atomicUsageCounts.get(atom.id) || 0) + 1
    runtime.atomicUsageCounts.set(atom.id, nextCount)

    if (nextCount >= minUses) {
      runtime.atomicSingleUseFallbacks.delete(atom.id)
      promoted.push(atom)
      continue
    }

    runtime.atomicSingleUseFallbacks.set(atom.id, atom)
    scopedRules.push({
      selector: resolveScopedSelector(scopeClassName, '', atom.context),
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

/** Backwards-compatible class-list helper. */
export function joinClassNames(atoms: readonly CipoAtomicRule[], scopeClassName: string): string {
  return joinAtomicClassNames(scopeClassName, atoms)
}

/** Compiles explicit atomic.css with threshold-aware streaming promotion. */
export function compileAtomicCss(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
  important: boolean,
): CipoCssArtifact {
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
  const candidate = createAtomicArtifact(rawCss, transformedCss, ast, warnings, important, false)
  const partitioned = partitionPromotedAtoms(candidate.atoms, candidate.scopeClassName)
  const scopedRules = [...partitioned.scopedRules, ...candidate.scopedRules]
  const artifact = rebuildArtifact(candidate, partitioned.atoms, scopedRules)

  insertCss(artifact.compiledCss)
  if (cacheable) setCachedArtifact(cacheKey, artifact)
  return artifact
}

/**
 * Creates an atomic artifact without mutating `runtime.config.important`.
 * Force-important is propagated explicitly through rule collection.
 */
export function createAtomicArtifact(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
  warnings: readonly CipoWarning[],
  forceImportant = false,
  thresholded = false,
): CipoCssArtifact {
  const mutableWarnings = [...warnings]
  const scopeClassName = `${runtime.config.prefix}-s-${hashString64(transformedCss)}`
  assertGeneratedNameIdentity(scopeClassName, `scope|${transformedCss}`)

  const collected = collectRules(ast, scopeClassName, mutableWarnings, forceImportant)
  const atoms = collected.atoms
  const scopedRules = collected.scopedRules
  const className = joinAtomicClassNames(
    thresholded || scopedRules.length > 0 ? scopeClassName : '',
    atoms,
  )
  const fallbackRules: CipoScopedRule[] = thresholded
    ? atoms.map((atom) => ({
        selector: resolveScopedSelector(scopeClassName, '', atom.context),
        declarations: [{
          type: 'declaration' as const,
          property: atom.property,
          value: atom.value,
          source: atom.source,
        }],
        context: atom.context,
      }))
    : []
  const compiledCss = compileCss(
    thresholded ? [] : atoms,
    [...fallbackRules, ...scopedRules],
  )

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

function rebuildArtifact(
  artifact: CipoCssArtifact,
  atoms: readonly CipoAtomicRule[],
  scopedRules: readonly CipoScopedRule[],
): CipoCssArtifact {
  const className = joinAtomicClassNames(
    scopedRules.length > 0 ? artifact.scopeClassName : '',
    atoms,
  )
  const compiledCss = compileCss(atoms, scopedRules)

  return {
    ...artifact,
    className,
    atoms,
    scopedRules,
    compiledCss,
    debug: {
      ...artifact.debug,
      atoms,
      scopedRules,
    },
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
  }
}

function isAtomicCssArtifactLike(artifact: CipoCssResult): artifact is CipoCssArtifact {
  return Boolean(artifact && 'kind' in artifact && artifact.kind === 'cipo.css')
}
