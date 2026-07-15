import { buildCss } from '@rodkisten/cipo/transform'
import { normalizeTemplateChunk } from '@rodkisten/cipo/safe-template'
import type { CipoCssInterpolation } from '@rodkisten/cipo/types'

export function buildSafeSource(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
): string {
  return normalizeTemplateChunk(buildCss(strings, values))
}
