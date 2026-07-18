import { createAtomicClassName } from '@rodkisten/cipo/compiler-atomic-class-name'
import { collectRules } from '@rodkisten/cipo/compiler-at-rules'
import { addImportant } from '@rodkisten/cipo/compiler-important'
import { compileSelector, createAtomicRuleId, resolveScopedSelector, wrapContext } from '@rodkisten/cipo/compiler-selector-compile'
import { compileCss, createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from '@rodkisten/cipo/compiler-sheet-compile'
import { insertCss } from '@rodkisten/cipo/injection'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { runtime } from '@rodkisten/cipo/runtime'
import { buildSafeSource } from '@rodkisten/cipo/safe-source'
import { transformCss } from '@rodkisten/cipo/transform'
import type {
  CipoAstNode,
  CipoAtomicRule,
  CipoCssArtifact,
  CipoCssInterpolation,
  CipoCssResult,
  CipoDeclarationNode,
  CipoRuleContext,
  CipoScopedRule,
  CipoWarning,
} from '@rodkisten/cipo/types'
import { createDeclaration, hashString } from '@rodkisten/cipo/utils'

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

/** Compiles one atomic rule. */
export function compileAtomicRule(atom: CipoAtomicRule): string {
  return wrapContext(
    `${compileSelector(atom.className, atom.context)}{${createDeclaration(atom.property, atom.value)}}`,
    atom.context,
  )
}

/** Joins atomic and scope classes while preserving insertion order and uniqueness. */
export function joinClassNames(atoms: readonly CipoAtomicRule[], scopeClassName: string): string {
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

/** Creates an atomic artifact, optionally retaining scope fallbacks for runtime styled collection. */
export function createAtomicArtifact(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
  warnings: readonly CipoWarning[],
  forceImportant = false,
  thresholded = false,
): CipoCssArtifact {
  const mutableWarnings = [...warnings]
  const scopeClassName = `${runtime.config.prefix}-s-${hashString(transformedCss)}`
  const previousImportant = runtime.config.important
  runtime.config.important = previousImportant || forceImportant

  const collected = collectRules(ast, scopeClassName, mutableWarnings)
  const atoms = collected.atoms
  const scopedRules = collected.scopedRules
  const className = joinClassNames(
    atoms,
    thresholded || scopedRules.length > 0 ? scopeClassName : '',
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

function rebuildArtifact(
  artifact: CipoCssArtifact,
  atoms: readonly CipoAtomicRule[],
  scopedRules: readonly CipoScopedRule[],
): CipoCssArtifact {
  const className = joinClassNames(
    atoms,
    scopedRules.length > 0 ? artifact.scopeClassName : '',
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
