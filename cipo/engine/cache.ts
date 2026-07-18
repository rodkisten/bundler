import { evictIfNeeded, runtime } from '../runtime'
import type { CipoCssResult } from '../types'

/** Stable JIT cache key for compiler artifacts. */
export function createArtifactCacheKey(rawCss: string, mode = ''): string {
  return [
    runtime.configVersion,
    runtime.themeVersion,
    runtime.registryVersion,
    runtime.config.prefix,
    runtime.config.important ? 'important' : '',
    runtime.config.minify ? 'min' : 'pretty',
    mode,
    rawCss,
  ].join('|')
}

export function getCachedArtifact(cacheKey: string): CipoCssResult | undefined {
  if (!runtime.config.jit.enabled || !runtime.config.jit.cache) return undefined
  return runtime.artifactCache.get(cacheKey)
}

export function setCachedArtifact(cacheKey: string, artifact: CipoCssResult): void {
  if (!runtime.config.jit.enabled || !runtime.config.jit.cache) return
  runtime.artifactCache.set(cacheKey, artifact)
  evictIfNeeded(runtime.artifactCache as Map<string, unknown>)
}
