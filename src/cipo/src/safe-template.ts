import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { protectNativeSlashes } from './native-slash-protection'
import { joinNestedSelectorLists } from './selector-list-safety'

export function normalizeTemplateChunk(value: string): string {
  return protectNativeSlashes(joinNestedSelectorLists(normalizeCompactRuntimeBlocks(value)))
}
