import { resolveRemainingRuntimeVars } from './remaining-runtime-vars'
import { joinNestedSelectorLists } from './selector-list-safety'

const TOKEN = 'var(--cipo-internal-native-slash-7f3c, /)'

export function restoreNativeSlash(input: string): string {
  return input.split(TOKEN).join('/')
}

export function finalizeProtectedCss(input: string): string {
  return joinNestedSelectorLists(resolveRemainingRuntimeVars(restoreNativeSlash(input)))
}
