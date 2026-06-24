import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { expandCoreSizeCalls } from './core-size-safety'
import { protectNativeSlashes } from './native-slash-protection'
import { restoreNativeSlash } from './restore-native-slash'
import { joinNestedSelectorLists } from './selector-list-safety'

export function prepareCoreCssInput(input: string): string {
  return protectNativeSlashes(
    expandCoreSizeCalls(normalizeCompactRuntimeBlocks(input)),
  )
}

export function finalizeCoreCssOutput(input: string): string {
  return joinNestedSelectorLists(restoreNativeSlash(input))
}
