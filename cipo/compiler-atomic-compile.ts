import { runtime } from '@rodkisten/cipo/runtime'
import type { CipoAtomicRule, CipoDeclarationNode, CipoRuleContext, CipoScopedRule } from '@rodkisten/cipo/types'
import { hashString } from '@rodkisten/cipo/utils'
import { addImportant } from '@rodkisten/cipo/compiler-important'
import { createAtomicRuleId, resolveScopedSelector } from '@rodkisten/cipo/compiler-selector-compile'
import { createAtomicClassName } from '@rodkisten/cipo/compiler-atomic-class-name'
import {
  compileAtomicProgramRule,
  compileAtomicStylesheet,
  createAtomicFallbackRule,
  joinAtomicClassNames,
} from '@rodkisten/cipo/compiler-atomic-program'

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
 * Legacy streaming promotion helper.
 *
 * @deprecated Component/styled compilation now uses the shared-program finalizer,
 * which can promote a declaration retroactively when its second use appears.
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
  return compileAtomicProgramRule(atom)
}

/** Joins atomic and scope classes while preserving insertion order and uniqueness. */
export function joinClassNames(atoms: readonly CipoAtomicRule[], scopeClassName: string): string {
  return joinAtomicClassNames(atoms, scopeClassName)
}

import type { CipoAstNode, CipoCssArtifact, CipoCssInterpolation, CipoCssResult, CipoWarning } from '@rodkisten/cipo/types'
import { transformCss } from '@rodkisten/cipo/transform'
import { buildSafeSource } from '@rodkisten/cipo/safe-source'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { insertCss, registerAtomicArtifact } from '@rodkisten/cipo/injection'
import { collectRules } from '@rodkisten/cipo/compiler-at-rules'
import { createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from '@rodkisten/cipo/compiler-sheet-compile'

export interface CreateAtomicArtifactOptions {
  /** Build compiler override for a deterministic component scope class. */
  readonly scopeClassName?: string
  /** Registers thresholded artifacts in the shared runtime stylesheet. Defaults to true. */
  readonly register?: boolean
}

/** Compiles explicit atomic CSS and injects/registers its generated rules. */
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

  // Classic minUses:1 artifacts are already final and can use the append-only
  // fast path. Thresholded artifacts are registered by createAtomicArtifact()
  // and rebuild the single shared atomic sheet when promotion changes.
  if (runtime.config.atomic.minUses <= 1) insertCss(artifact.compiledCss)
  if (cacheable) setCachedArtifact(cacheKey, artifact)
  return artifact
}

/**
 * Creates an atomic/component artifact.
 *
 * @remarks
 * With a promotion threshold greater than one, every declaration remains in the
 * artifact metadata and the component receives both its deterministic scope class
 * and its potential atomic classes. The shared stylesheet finalizer decides which
 * atoms actually exist in CSS. This allows a later second use to promote a rule
 * without recreating components that were already rendered.
 */
export function createAtomicArtifact(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
  warnings: readonly CipoWarning[],
  forceImportant = false,
  options: CreateAtomicArtifactOptions = {},
): CipoCssArtifact {
  const mutableWarnings = [...warnings]
  const scopeClassName = options.scopeClassName ?? `${runtime.config.prefix}-s-${hashString(transformedCss)}`
  const previousImportant = runtime.config.important
  runtime.config.important = previousImportant || forceImportant
  const collected = collectRules(ast, scopeClassName, mutableWarnings)
  const atoms = collected.atoms
  const scopedRules = collected.scopedRules
  const thresholded = runtime.config.atomic.minUses > 1
  const className = joinAtomicClassNames(
    atoms,
    thresholded || scopedRules.length > 0 ? scopeClassName : '',
  )

  // Per-artifact CSS is intentionally empty in thresholded mode. Emitting the
  // first-use fallback here would make every styled component own a stylesheet
  // fragment and would make retroactive promotion impossible. The shared registry
  // owns final CSS instead.
  const compiledCss = thresholded
    ? ''
    : compileAtomicStylesheet(atoms, scopedRules)
  runtime.config.important = previousImportant
  const artifactId = `${runtime.config.prefix}-artifact-${hashString(`${scopeClassName}|${rawCss}`)}`

  const artifact: CipoCssArtifact = {
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

  if (thresholded && options.register !== false) registerAtomicArtifact(artifact)
  return artifact
}

/** Builds the local scoped fallback representation used by diagnostics/tests. */
export function compileAtomicArtifactFallback(artifact: CipoCssArtifact): string {
  const fallbackRules = artifact.atoms.map((atom) => createAtomicFallbackRule(atom, artifact.scopeClassName))
  return compileAtomicStylesheet([], [...fallbackRules, ...artifact.scopedRules])
}

function isAtomicCssArtifactLike(artifact: CipoCssResult): artifact is CipoCssArtifact {
  return Boolean(artifact && 'kind' in artifact && artifact.kind === 'cipo.css')
}
