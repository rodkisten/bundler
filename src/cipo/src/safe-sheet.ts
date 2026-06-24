import { injectSheetInto, wrapSheetLayer } from './compiler'
import { compileSafeSheetSource } from './compiler/safe-sheet-compile'
import { buildSafeSource } from './safe-source'
import type { CipoCssInterpolation, CipoStylesheetArtifact } from './types'

function compile(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
  important: boolean,
): CipoStylesheetArtifact {
  return compileSafeSheetSource(buildSafeSource(strings, values), important)
}

const css = Object.assign(
  (strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) =>
    compile(strings, values, false),
  {
    withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) {
      return compile(strings, values, true)
    },
    insertInto(target: HTMLElement | ShadowRoot | Document) {
      return (strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) => {
        const artifact = compile(strings, values, false)
        injectSheetInto(target, artifact.cssText)
        return artifact
      }
    },
    scoped(selector: string) {
      return (strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) =>
        compileSafeSheetSource(`${selector}{${buildSafeSource(strings, values)}}`, false)
    },
    layer(name: string) {
      return (strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) =>
        wrapSheetLayer(name, compile(strings, values, false))
    },
    debug(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]) {
      const artifact = compile(strings, values, false)
      if (typeof console !== 'undefined') console.debug('[Cipo sheet]', artifact.debug)
      return artifact
    },
  },
)

export const safeSheet = { css }
