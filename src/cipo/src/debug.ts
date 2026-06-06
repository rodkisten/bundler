import { compileAtomicRule } from './compiler'
import { runtime } from './runtime'
import type { CipoExplainResult } from './types'

/**
 * Explains a generated atomic class.
 *
 * @param className - Generated class name.
 * @returns Explanation object.
 *
 * @example
 * ```ts
 * const card = css`color: red;`
 * explain(String(card).split(' ')[0])
 * // { found: true, atom: { property: 'color', value: 'red' }, css: '...' }
 * ```
 */
export function explain(className: string): CipoExplainResult {
  const atom = runtime.debugAtoms.get(className)
  if (!atom) return { found: false, className }
  return { found: true, className, atom, css: compileAtomicRule(atom) }
}

/**
 * Inspects an element's Cipó classes.
 *
 * @param element - DOM element.
 * @returns Classes and matching atoms.
 *
 * @example
 * ```ts
 * inspect(document.querySelector('button')!)
 * ```
 */
export function inspect(element: Element): { readonly classes: readonly string[]; readonly atoms: readonly NonNullable<CipoExplainResult['atom']>[] } {
  const classes = Array.from(element.classList)
  const atoms = classes.map(className => runtime.debugAtoms.get(className)).filter((atom): atom is NonNullable<CipoExplainResult['atom']> => Boolean(atom))
  return { classes, atoms }
}
