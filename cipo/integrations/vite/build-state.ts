import type { CipoCompiledBuildManifestEntry } from '../../compiler/build/compile'

export interface FinalizedBuildStyles {
  readonly css: string
  readonly classNames: ReadonlyMap<string, string>
}

/** Mutable state scoped to one Vite build/watch cycle. */
export interface CipoViteBuildState {
  readonly cssChunks: string[]
  readonly manifests: unknown[]
  readonly atomicEntries: CipoCompiledBuildManifestEntry[]
  finalized: FinalizedBuildStyles | undefined
}

export function createCipoViteBuildState(): CipoViteBuildState {
  return {
    cssChunks: [],
    manifests: [],
    atomicEntries: [],
    finalized: undefined,
  }
}

export function resetCipoViteBuildState(state: CipoViteBuildState): void {
  state.cssChunks.length = 0
  state.manifests.length = 0
  state.atomicEntries.length = 0
  state.finalized = undefined
}
