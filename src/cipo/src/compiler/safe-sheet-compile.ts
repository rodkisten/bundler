import { parseStylesheet } from '../parser'
import { transformCss } from '../transform'
import type { CipoStylesheetArtifact, CipoWarning } from '../types'
import {
  createArtifactCacheKey,
  createStylesheetArtifact,
  getCachedArtifact,
  setCachedArtifact,
} from './sheet-compile'

export function compileSafeSheetSource(
  rawCss: string,
  important: boolean,
): CipoStylesheetArtifact {
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'safe-sheet-important' : 'safe-sheet')
  const cached = getCachedArtifact(cacheKey)
  if (cached?.kind === 'cipo.stylesheet') return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createStylesheetArtifact(rawCss, transformedCss, ast, warnings, important)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}
