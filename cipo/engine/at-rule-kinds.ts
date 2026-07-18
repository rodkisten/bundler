/** Structural at-rule families relevant to the Cipó stylesheet compiler. */
export type CipoAtRuleKind =
  | 'conditional'
  | 'keyframes'
  | 'declaration-block'
  | 'page'
  | 'unknown'

/** Classifies an at-rule by the grammar of its block contents. */
export function classifyAtRule(name: string): CipoAtRuleKind {
  const normalized = name.trim().toLowerCase()
  if (/^@(?:-webkit-)?keyframes\b/.test(normalized)) return 'keyframes'
  if (/^@(font-face|property)\b/.test(normalized)) return 'declaration-block'
  if (/^@page\b/.test(normalized)) return 'page'
  if (/^@(media|supports|container|layer|scope|starting-style)\b/.test(normalized)) return 'conditional'
  return 'unknown'
}

/** Returns whether an at-rule is accepted at stylesheet root. */
export function isStylesheetAtRuleName(name: string): boolean {
  return classifyAtRule(name) !== 'unknown'
}
