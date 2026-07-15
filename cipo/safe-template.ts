import { normalizeCompactRuntimeBlocks } from '@rodkisten/cipo/compact-block-safety'
import { protectNativeSlashes } from '@rodkisten/cipo/native-slash-protection'
import { joinNestedSelectorLists } from '@rodkisten/cipo/selector-list-safety'

export function normalizeTemplateChunk(value: string): string {
  return protectNativeSlashes(joinNestedSelectorLists(normalizeCompactRuntimeBlocks(value)))
}
