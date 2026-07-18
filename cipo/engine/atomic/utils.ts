import type { CipoAtomicRule, CipoDeclarationNode } from '../../types'

/** Normalizes an atomic promotion threshold to its supported semantic range. */
export function normalizeAtomicMinUses(value: number): number {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY
  return Math.max(1, Math.trunc(value))
}

/** Joins a component scope and atomic classes without duplicates. */
export function joinAtomicClassNames(
  scopeClassName: string,
  atoms: readonly CipoAtomicRule[],
): string {
  const output: string[] = []
  const seen = new Set<string>()

  if (scopeClassName) {
    output.push(scopeClassName)
    seen.add(scopeClassName)
  }

  for (const atom of atoms) {
    if (seen.has(atom.className)) continue
    seen.add(atom.className)
    output.push(atom.className)
  }

  return output.join(' ')
}

/** Converts an atomic rule back to a declaration for scoped fallback emission. */
export function atomicRuleToDeclaration(atom: CipoAtomicRule): CipoDeclarationNode {
  return {
    type: 'declaration',
    property: atom.property,
    value: atom.value,
    source: atom.source,
  }
}
