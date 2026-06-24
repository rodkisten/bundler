import { compileSafeAtomicSource } from './compiler/safe-atomic-compile'
import { buildSafeSource } from './safe-source'
import type { CipoCssArtifact, CipoCssInterpolation } from './types'

const css = Object.assign(
  (strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssArtifact =>
    compileSafeAtomicSource(buildSafeSource(strings, values), false),
  {
    withImportant(
      strings: TemplateStringsArray,
      ...values: readonly CipoCssInterpolation[]
    ): CipoCssArtifact {
      return compileSafeAtomicSource(buildSafeSource(strings, values), true)
    },
  },
)

export const safeAtomic = { css }
