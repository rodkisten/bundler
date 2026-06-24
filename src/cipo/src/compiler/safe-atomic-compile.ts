import { insertCss } from '../injection'
import { parseStylesheet } from '../parser'
import { transformCss } from '../transform'
import type { CipoCssArtifact, CipoWarning } from '../types'
import { createAtomicArtifact } from './atomic-compile'
import {
  createArtifactCacheKey,
  getCachedArtifact,
  setCachedArtifact,
} from './sheet-compile'

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
