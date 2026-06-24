import { atomic as coreAtomic } from './css'
import { safeTemplate } from './safe-template'
import type { CipoCssArtifact, CipoCssInterpolation } from './types'

const tag = coreAtomic.css

function css(
  strings: TemplateStringsArray,
  ...values: readonly CipoCssInterpolation[]
): CipoCssArtifact {
  return tag(safeTemplate(strings), ...values)
}

Object.assign(css, tag, {
  withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) {
    return tag.withImportant(safeTemplate(strings), ...values)
  },
})

export const safeAtomicApi = { ...coreAtomic, css: css as typeof tag }
