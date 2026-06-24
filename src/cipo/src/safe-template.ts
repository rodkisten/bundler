import { normalizeCompactRuntimeBlocks } from './compact-block-safety'
import { protectNativeSlashes } from './native-slash-protection'
import { joinNestedSelectorLists } from './selector-list-safety'

const cache = new WeakMap<TemplateStringsArray, TemplateStringsArray>()

export function safeTemplate(strings: TemplateStringsArray): TemplateStringsArray {
  const cached = cache.get(strings)
  if (cached) return cached

  const normalize = (value: string) =>
    protectNativeSlashes(joinNestedSelectorLists(normalizeCompactRuntimeBlocks(value)))
  const cooked = Array.from(strings, normalize) as unknown as TemplateStringsArray
  const raw = Array.from(strings.raw, normalize)
  Object.defineProperty(cooked, 'raw', { value: raw })
  cache.set(strings, cooked)
  return cooked
}
