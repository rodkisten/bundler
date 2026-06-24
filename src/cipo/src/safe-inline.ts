import { compileSafeInlineSource } from './compiler/safe-inline-compile'
import { inline as coreInline } from './inline'
import { buildSafeSource } from './safe-source'
import type { CipoCssInterpolation, CipoInlineCssArtifact, CipoStyleObject } from './types'

function compile(
  first: TemplateStringsArray | CipoStyleObject,
  values: readonly CipoCssInterpolation[],
  important: boolean,
): CipoInlineCssArtifact {
  if (!Array.isArray(first)) {
    return important
      ? coreInline.css.withImportant(first, ...values)
      : coreInline.css(first, ...values)
  }
  return compileSafeInlineSource(buildSafeSource(first as TemplateStringsArray, values), important)
}

const css = Object.assign(
  (first: TemplateStringsArray | CipoStyleObject, ...values: readonly CipoCssInterpolation[]) =>
    compile(first, values, false),
  {
    withImportant(
      first: TemplateStringsArray | CipoStyleObject,
      ...values: readonly CipoCssInterpolation[]
    ) {
      return compile(first, values, true)
    },
  },
)

export const safeInline = { css }
