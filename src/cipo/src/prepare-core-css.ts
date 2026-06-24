import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { expandCoreSizeCalls } from './core-size-safety'
import { installNativePropertyGuards } from './native-property-guards'
import { protectNativeSlashes } from './native-slash-protection'
import { normalizePropertyDirectiveNames } from './property-directive-safety'

let installed = false

export function prepareCoreCssInput(input: string): string {
  if (!installed) {
    installNativePropertyGuards()
    installed = true
  }
  const properties = normalizePropertyDirectiveNames(input)
  const compact = normalizeCompactRuntimeBlocks(properties)
  const sized = expandCoreSizeCalls(compact)
  return protectNativeSlashes(sized)
}
