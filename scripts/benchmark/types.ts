export type BenchmarkSuiteDefinition = {
  readonly id: string
  readonly label: string
  readonly file: string
  readonly description: string
}

export type NormalizedBenchmark = {
  readonly id: string
  readonly group: string
  readonly name: string
  readonly hz: number
  readonly meanMs: number
  readonly minMs: number
  readonly maxMs: number
  readonly p75Ms: number
  readonly p99Ms: number
  readonly rme: number
  readonly samples: number
}

export type BenchmarkSnapshot = {
  readonly schemaVersion: 1
  readonly package: string
  readonly label: string
  readonly description: string
  readonly generatedAt: string
  readonly commit: string
  readonly branch: string
  readonly environment: {
    readonly node: string
    readonly platform: string
    readonly arch: string
    readonly cpu: string
    readonly ci: boolean
  }
  readonly benchmarks: readonly NormalizedBenchmark[]
}

export type BenchmarkDelta = {
  readonly id: string
  readonly group: string
  readonly name: string
  readonly previousHz: number
  readonly currentHz: number
  readonly hzDeltaPercent: number
  readonly meanDeltaPercent: number
  readonly noiseFloorPercent: number
  readonly status: 'faster' | 'slower' | 'stable'
}

export type SuiteComparison = {
  readonly suite: BenchmarkSuiteDefinition
  readonly previous: BenchmarkSnapshot | null
  readonly current: BenchmarkSnapshot
  readonly deltas: readonly BenchmarkDelta[]
  readonly geometricMeanPercent: number | null
  readonly faster: number
  readonly slower: number
  readonly stable: number
  readonly added: number
  readonly removed: number
}
