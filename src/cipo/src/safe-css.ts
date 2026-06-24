import { css as coreCss } from './css'
import { safeTemplate } from './safe-template'
import type { CipoCssInterpolation, CipoCssResult, CipoStyleObject } from './types'

export function safeCss(
  first: TemplateStringsArray | CipoStyleObject,
  ...values: readonly CipoCssInterpolation[]
): CipoCssResult {
  return coreCss(
    Array.isArray(first) ? safeTemplate(first as TemplateStringsArray) : first,
    ...values,
  )
}

Object.assign(safeCss, coreCss, {
  withImportant(
    first: TemplateStringsArray | CipoStyleObject,
    ...values: readonly CipoCssInterpolation[]
  ): CipoCssResult {
    const input = Array.isArray(first) ? safeTemplate(first as TemplateStringsArray) : first
    return coreCss.withImportant(input, ...values)
  },
})
