import { resolveRemainingRuntimeVars } from './remaining-runtime-vars'
import { joinNestedSelectorLists } from './selector-list-safety'

const TOKEN = 'var(--cipo-internal-native-slash-7f3c, /)'

/**
 * Restores native slash separators protected before runtime arithmetic parsing.
 *
 * @remarks
 * Protection uses a syntactically valid CSS fallback token so intermediate
 * parsers can carry the separator without wrapping the whole shorthand in
 * `calc(...)`. Only Cipó's private marker is replaced; ordinary CSS variables
 * and literal slashes are left unchanged.
 *
 * @param input - CSS containing zero or more private slash markers.
 * @returns CSS with protected markers restored to literal slash separators.
 */
export function restoreNativeSlash(input: string): string {
  return input.split(TOKEN).join('/')
}

/**
 * Applies the post-runtime safety passes required before AST parsing.
 *
 * @remarks
 * Native slash restoration runs first, deferred runtime variables run second,
 * and nested selector-list repair runs last. This order ensures the selector
 * pass sees final value syntax and cannot accidentally modify private markers.
 *
 * @param input - CSS produced by theme and value-helper resolution.
 * @returns Final transformed CSS ready for the Cipó AST parser.
 */
export function finalizeProtectedCss(input: string): string {
  return joinNestedSelectorLists(resolveRemainingRuntimeVars(restoreNativeSlash(input)))
}
