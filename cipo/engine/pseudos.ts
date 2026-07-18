/** Pseudo-class/element shorthands supported by both atomic and stylesheet compilation. */
export const CIPO_PSEUDO_NAMES = new Set([
  'hover',
  'focus',
  'active',
  'disabled',
  'checked',
  'focus-visible',
  'focus-within',
  'visited',
  'first-child',
  'last-child',
  'before',
  'after',
  'target',
  'open',
])

export function isCipoPseudoName(name: string): boolean {
  return CIPO_PSEUDO_NAMES.has(name)
}
