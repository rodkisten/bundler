import { insertCss } from '@rodkisten/cipo/injection'

/**
 * Couples a statically compiled styled component to its CSS side effect.
 * A PURE-annotated call can be removed together with an unused component,
 * while retained components still install their stylesheet exactly once.
 */
export function attachCompiledCss<T>(
  builder: (className: string) => T,
  className: string,
  cssText: string,
): T {
  insertCss(cssText)
  return builder(className)
}
