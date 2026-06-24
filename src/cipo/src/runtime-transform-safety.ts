import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { joinNestedSelectorLists } from './selector-list-safety'
import { protectNativeSlashGrammar, restoreNativeSlashGrammar } from './slash-grammar-safety'

export function prepareRuntimeDslSource(input: string): string {
  return protectNativeSlashGrammar(normalizeCompactRuntimeBlocks(input))
}

export function finalizeRuntimeDslOutput(input: string): string {
  return joinNestedSelectorLists(restoreNativeSlashGrammar(input))
}
