import { buildCss } from './transform'
import { normalizeTemplateChunk } from './safe-template'
import type { CipoCssInterpolation } from './types'

export function buildSafeSource(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
): string {
  return normalizeTemplateChunk(buildCss(strings, values))
}
