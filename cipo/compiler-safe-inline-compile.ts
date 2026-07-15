import { parseStylesheet } from '@rodkisten/cipo/parser'
import { SafeInlineArtifact } from '@rodkisten/cipo/safe-inline-artifact'
import { transformCss } from '@rodkisten/cipo/transform'
import type { CipoWarning } from '@rodkisten/cipo/types'
import { compileSafeInlineText } from '@rodkisten/cipo/compiler-safe-inline-text'

export function compileSafeInlineSource(rawCss: string, important: boolean): SafeInlineArtifact {
  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  parseStylesheet(transformedCss, warnings)
  return new SafeInlineArtifact(rawCss, transformedCss, compileSafeInlineText(rawCss, important))
}
