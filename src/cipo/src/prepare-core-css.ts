import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { expandCoreSizeCalls } from './core-size-safety'
import { installNativePropertyGuards } from './native-property-guards'
import { protectNativeSlashes } from './native-slash-protection'
import { normalizePropertyDirectiveNames } from './property-directive-safety'

let installed = false

/**
 * Prepares CSS source for the runtime DSL without changing its final semantics.
 *
 * @remarks
 * The order is intentional. Native property guards are installed once, typed
 * custom-property directives are normalized before runtime variable expansion,
 * compact blocks are made declaration-safe, `size(...)` is lowered, and native
 * shorthand slashes are protected last. Moving these passes can reintroduce
 * collisions between CSS grammar and Cipó arithmetic.
 *
 * @param input - Comment-free CSS source entering the runtime DSL.
 * @returns CSS source protected against known parser ambiguities.
 */
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
