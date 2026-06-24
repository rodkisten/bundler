import { parseStylesheet } from '../parser'
import { SafeInlineArtifact } from '../safe-inline-artifact'
import { transformCss } from '../transform'
import type { CipoWarning } from '../types'
import { compileSafeInlineText } from './safe-inline-text'

export function compileSafeInlineSource(rawCss: string, important: boolean): SafeInlineArtifact {
  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  parseStylesheet(transformedCss, warnings)
  return new SafeInlineArtifact(rawCss, transformedCss, compileSafeInlineText(rawCss, important))
}
