import { parseStylesheet } from './parser'
import { buildSafeSource } from './safe-source'
import { transformCss } from './transform'
import type { CipoCssInterpolation, CipoCssResult, CipoStyleObject, CipoWarning } from './types'
import { compileSafeAtomicSource } from './compiler/safe-atomic-compile'
import { compileSafeInlineSource } from './compiler/safe-inline-compile'
import { compileSafeSheetSource } from './compiler/safe-sheet-compile'
import { shouldCompileAsStylesheet } from './compiler/sheet-compile'
import { inline as coreInline } from './inline'

function compile(rawCss: string, important: boolean): CipoCssResult {
  const inline = /^\s*@inline\s*\{([\s\S]*)\}\s*$/.exec(rawCss)
  if (inline) return compileSafeInlineSource(inline[1] || '', important)

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  return shouldCompileAsStylesheet(rawCss, transformedCss, ast)
    ? compileSafeSheetSource(rawCss, important)
    : compileSafeAtomicSource(rawCss, important)
}

export function safeCss(
  first: TemplateStringsArray | CipoStyleObject,
  ...values: readonly CipoCssInterpolation[]
): CipoCssResult {
  if (!Array.isArray(first)) return coreInline.css(first, ...values)
  return compile(buildSafeSource(first as TemplateStringsArray, values), false)
}

Object.assign(safeCss, {
  withImportant(first: TemplateStringsArray | CipoStyleObject, ...values: readonly CipoCssInterpolation[]) {
    if (!Array.isArray(first)) return coreInline.css.withImportant(first, ...values)
    return compile(buildSafeSource(first as TemplateStringsArray, values), true)
  },
})
