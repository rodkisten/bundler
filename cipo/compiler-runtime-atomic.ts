import { compileCss } from '@rodkisten/cipo/compiler-sheet-compile'
import { resolveScopedSelector } from '@rodkisten/cipo/compiler-selector-compile'
import { optimizeCompiledCss } from '@rodkisten/cipo/compiler-compiled-css-optimizer'
import { runtime } from '@rodkisten/cipo/runtime'
import type { CipoAtomicRule, CipoCssArtifact, CipoDeclarationNode, CipoScopedRule } from '@rodkisten/cipo/types'

export interface CipoRuntimeAtomicProgram {
  /** One stylesheet containing promoted shared atoms and scoped one-use fallbacks. */
  readonly css: string
  /** Number of declarations promoted to globally shared atomic rules. */
  readonly promotedCount: number
  /** Effective CSS-first promotion threshold. */
  readonly minUses: number
}

/**
 * Finalizes every runtime styled artifact into one threshold-aware stylesheet.
 *
 * @remarks
 * Runtime component creation cannot know future declaration reuse up front. Each
 * artifact therefore keeps its stable scope class plus its candidate atomic class
 * names. The shared collector can then rebuild the stylesheet when a later
 * component introduces the second matching declaration: the scoped fallback is
 * removed and one shared atomic rule takes its place without rewriting existing
 * DOM class attributes.
 */
export function compileRuntimeAtomicStyles(
  artifacts: readonly CipoCssArtifact[],
  minUses = runtime.config.atomic.minUses,
): CipoRuntimeAtomicProgram {
  const threshold = normalizeMinUses(minUses)
  const usageCounts = new Map<string, number>()
  const promotedById = new Map<string, CipoAtomicRule>()

  for (const artifact of artifacts) {
    const seen = new Set<string>()
    for (const atom of artifact.atoms) {
      if (seen.has(atom.id)) continue
      seen.add(atom.id)
      usageCounts.set(atom.id, (usageCounts.get(atom.id) ?? 0) + 1)
    }
  }

  const scopedRules: CipoScopedRule[] = []
  for (const artifact of artifacts) {
    const seen = new Set<string>()
    for (const atom of artifact.atoms) {
      if (seen.has(atom.id)) continue
      seen.add(atom.id)

      if ((usageCounts.get(atom.id) ?? 0) >= threshold) {
        promotedById.set(atom.id, atom)
        continue
      }

      scopedRules.push({
        selector: resolveScopedSelector(artifact.scopeClassName, ''),
        declarations: [atomToDeclaration(atom)],
        context: atom.context,
      })
    }

    scopedRules.push(...artifact.scopedRules)
  }

  const css = optimizeCompiledCss(
    compileCss(Array.from(promotedById.values()), scopedRules),
    {
      minify: runtime.config.minify,
      mergeEquivalentRules: true,
    },
  )

  return {
    css,
    promotedCount: promotedById.size,
    minUses: threshold,
  }
}

function normalizeMinUses(value: number): number {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY
  return Math.max(1, Math.trunc(value))
}

function atomToDeclaration(atom: CipoAtomicRule): CipoDeclarationNode {
  return {
    type: 'declaration',
    property: atom.property,
    value: atom.value,
    source: atom.source,
  }
}
