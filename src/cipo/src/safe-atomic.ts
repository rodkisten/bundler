import { atomic as coreAtomic } from './css'
import { safeTemplate } from './safe-template'
import type { CipoAtomicCssArtifact, CipoCssInterpolation } from './types'

const coreTag = coreAtomic.css

function safeAtomicCss(
  strings: TemplateStringsArray,
  ...values: readonly CipoCssInterpolation[]
): CipoAtomicCssArtifact {
  return coreTag(safeTemplate(strings), ...values)
}

Object.assign(safeAtomicCss, coreTag, {
  withImportant(
    strings: TemplateStringsArray,
    ...values: readonly CipoCssInterpolation[]
  ): CipoAtomicCssArtifact {
    return coreTag.withImportant(safeTemplate(strings), ...values)
  },
})

export const safeAtomic = {
  ...coreAtomic,
  css: safeAtomicCss as typeof coreAtomic.css,
}
