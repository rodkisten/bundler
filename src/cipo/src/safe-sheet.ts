import { sheet as coreSheet } from './css'
import { safeTemplate } from './safe-template'
import type { CipoCssInterpolation, CipoStylesheetArtifact } from './types'

const coreTag = coreSheet.css

function safeSheetCss(
  strings: TemplateStringsArray,
  ...values: readonly CipoCssInterpolation[]
): CipoStylesheetArtifact {
  return coreTag(safeTemplate(strings), ...values)
}

Object.assign(safeSheetCss, coreTag, {
  withImportant(
    strings: TemplateStringsArray,
    ...values: readonly CipoCssInterpolation[]
  ): CipoStylesheetArtifact {
    return coreTag.withImportant(safeTemplate(strings), ...values)
  },
})

export const safeSheet = {
  ...coreSheet,
  css: safeSheetCss as typeof coreSheet.css,
}
