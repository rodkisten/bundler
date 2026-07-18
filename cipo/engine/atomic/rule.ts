import { createAtomicClassName } from './class-name'
import { addImportant } from '../important'
import { createAtomicRuleId } from '../selector'
import { runtime } from '../../runtime'
import type { CipoAtomicRule, CipoDeclarationNode, CipoRuleContext } from '../../types'

/** Creates or reuses one atomic rule without depending on higher compiler layers. */
export function createAtomicRule(
  declaration: CipoDeclarationNode,
  context: CipoRuleContext,
  forceImportant = false,
): CipoAtomicRule {
  const value = runtime.config.important || forceImportant
    ? addImportant(declaration.value)
    : declaration.value
  const id = createAtomicRuleId(declaration.property, value, context)
  const cached = runtime.atomicCache.get(id)
  if (cached) return cached

  const atom: CipoAtomicRule = {
    id,
    className: createAtomicClassName(declaration.property, value, context, id),
    property: declaration.property,
    value,
    context,
    source: declaration.source,
  }

  runtime.atomicCache.set(id, atom)
  runtime.debugAtoms.set(atom.className, atom)
  return atom
}
