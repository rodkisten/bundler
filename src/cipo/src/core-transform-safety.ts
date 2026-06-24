import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { expandCoreSizeCalls } from './core-size-safety'
import { installNativePropertyGuards } from './native-property-guards'
import { protectNativeSlashes } from './native-slash-protection'
import { restoreNativeSlash } from './restore-native-slash'
import { joinNestedSelectorLists } from './selector-list-safety'

let nativeGuardsInstalled = false

export function prepareCoreCssInput(input: string): string {
  if (!nativeGuardsInstalled) {
    installNativePropertyGuards()
    nativeGuardsInstalled = true
  }

  return protectNativeSlashes(
    expandCoreSizeCalls(normalizeCompactRuntimeBlocks(input)),
  )
}

export function finalizeCoreCssOutput(input: string): string {
  return joinNestedSelectorLists(restoreNativeSlash(input))
}
