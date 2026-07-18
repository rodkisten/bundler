import type { AliasScale, CipoDeclarationNode } from '../types'
import type { TextExpander, ValueNormalizer } from './contracts'
import { createSmartDeclarationExpander } from './smart-functions'
import { createSmartNormalizationTools } from './smart-normalization'

export interface SmartValueTools {
  normalizePropertyDeclaration(property: string, rawValue: string): CipoDeclarationNode[] | null
  resolveScale(property: string, rawValue: string, fallback: AliasScale): AliasScale
  normalizePropertyValue(property: string, value: string, scale: AliasScale): string
  expandDeclarationFunction(name: string, args: readonly string[]): string
}

/** Composes property normalization and multi-declaration smart helpers around stable value primitives. */
export function createSmartValueTools(
  normalizeValue: ValueNormalizer,
  expandText: TextExpander,
): SmartValueTools {
  const normalization = createSmartNormalizationTools(normalizeValue)
  return {
    normalizePropertyDeclaration: normalization.normalizePropertyDeclaration,
    resolveScale: normalization.resolveScale,
    normalizePropertyValue: normalization.normalizePropertyValue,
    expandDeclarationFunction: createSmartDeclarationExpander(normalizeValue, expandText, normalization),
  }
}
