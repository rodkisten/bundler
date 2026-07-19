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
  if (matchesAtRuleKeyword(normalized, '@keyframes') || matchesAtRuleKeyword(normalized, '@-webkit-keyframes')) {
    return 'keyframes'
  }
  if (matchesAtRuleKeyword(normalized, '@font-face') || matchesAtRuleKeyword(normalized, '@property')) {
    return 'declaration-block'
  }
  if (matchesAtRuleKeyword(normalized, '@page')) return 'page'
  if (
    matchesAtRuleKeyword(normalized, '@media')
    || matchesAtRuleKeyword(normalized, '@supports')
    || matchesAtRuleKeyword(normalized, '@container')
    || matchesAtRuleKeyword(normalized, '@layer')
    || matchesAtRuleKeyword(normalized, '@scope')
    || matchesAtRuleKeyword(normalized, '@starting-style')
  ) {
    return 'conditional'
  }
  return 'unknown'
}

/** Matches a complete at-rule keyword instead of accepting hyphenated prefix lookalikes. */
function matchesAtRuleKeyword(input: string, keyword: string): boolean {
  if (!input.startsWith(keyword)) return false
  const boundary = input[keyword.length] ?? ''
  return boundary === '' || /[\s({]/.test(boundary)
}

/** Returns whether an at-rule is accepted at stylesheet root. */
export function isStylesheetAtRuleName(name: string): boolean {
  return classifyAtRule(name) !== 'unknown'
}
