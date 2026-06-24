import { prepareCoreCssInput as prepareInput } from './prepare-core-css'
import { finalizeProtectedCss } from './restore-native-slash'

/**
 * Applies the source-protection passes that must run before runtime DSL parsing.
 *
 * @param input - Comment-free CSS source.
 * @returns CSS prepared for safe runtime expansion.
 */
export function prepareCoreCssInput(input: string): string {
  return prepareInput(input)
}

/**
 * Applies the restoration passes that must run after helper and theme resolution.
 *
 * @param input - CSS produced by the main transform pipeline.
 * @returns CSS ready for AST parsing and stylesheet compilation.
 */
export function finalizeCoreCssOutput(input: string): string {
  return finalizeProtectedCss(input)
}
