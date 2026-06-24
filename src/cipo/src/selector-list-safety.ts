import { normalizeCoreSelectorLists } from './core-selector-list'

/**
 * Repairs selector-list syntax after runtime and value-level transformations.
 *
 * @param input - Transformed CSS that may contain multiline nested selectors.
 * @returns CSS with safe nested selector continuations normalized.
 */
export function joinNestedSelectorLists(input: string): string {
  return normalizeCoreSelectorLists(input)
}
