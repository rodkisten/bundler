import { insertCss } from '@rodkisten/cipo/injection'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { transformCss } from '@rodkisten/cipo/transform'
import type { CipoCssArtifact, CipoWarning } from '@rodkisten/cipo/types'
import { createAtomicArtifact } from '@rodkisten/cipo/compiler-atomic-compile'
import {
  createArtifactCacheKey,
  getCachedArtifact,
  setCachedArtifact,
} from '@rodkisten/cipo/compiler-sheet-compile'

export function compileSafeAtomicSource(rawCss: string, important: boolean): CipoCssArtifact {
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'safe-atomic-important' : 'safe-atomic')
  const cached = getCachedArtifact(cacheKey)
  if (cached?.kind === 'cipo.css') return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createAtomicArtifact(rawCss, transformedCss, ast, warnings, important)
  insertCss(artifact.compiledCss)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}
