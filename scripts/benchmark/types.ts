export type BenchmarkSuiteDefinition = {
  readonly id: string
  readonly label: string
  readonly file: string
  readonly description: string
  readonly shards?: readonly {
    readonly id: string
    readonly namePattern: string
  }[]
}

export type BenchmarkRunOrderEntry = {
  readonly round: number
  readonly side: 'baseline' | 'current'
  readonly position: number
}

export type BenchmarkRunnerMetadata = {
  readonly collectedAt: string
  readonly node: string
  readonly v8: string
  readonly pnpm: string
  readonly vitest: string
  readonly platform: string
  readonly release: string
  readonly arch: string
  readonly cpuModel: string
  readonly cpuCount: number
  readonly cpuSpeedMHz: number
  readonly totalMemoryBytes: number
  readonly freeMemoryBytes: number
  readonly loadAverage: readonly number[]
  readonly uptimeSeconds: number
  readonly ci: boolean
  readonly runnerName: string
  readonly runnerOs: string
  readonly runnerArch: string
  readonly runnerEnvironment: string
  readonly repository: string
  readonly workflow: string
  readonly job: string
  readonly runId: string
  readonly runAttempt: string
  readonly eventName: string
}

export type BenchmarkMethodology = {
  readonly mode: 'single' | 'same-runner-ab'
  readonly rounds: number
  readonly aggregation: 'median'
  readonly runOrder: readonly BenchmarkRunOrderEntry[]
  readonly sameRunner: boolean
  readonly minimumChangePercent: number
  readonly unstableNoisePercent: number
  readonly pairedControlNormalization: boolean
  readonly notes: readonly string[]
}

export type BenchmarkRoundMeasurement = {
  readonly round: number
  readonly position: number
  readonly hz: number
  readonly meanMs: number
  readonly minMs: number
  readonly maxMs: number
  readonly p75Ms: number
  readonly p99Ms: number
  readonly rme: number
  readonly samples: number
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
  readonly rounds: number
  readonly runVariationPercent: number
  readonly standardDeviationHz: number
  readonly coefficientOfVariationPercent: number
  readonly sparkline: string
  readonly measurements: readonly BenchmarkRoundMeasurement[]
}

export type BenchmarkSnapshot = {
  readonly schemaVersion: 2
  readonly package: string
  readonly label: string
  readonly description: string
  readonly generatedAt: string
  readonly commit: string
  readonly branch: string
  readonly root: string
  readonly runner: BenchmarkRunnerMetadata
  readonly methodology: BenchmarkMethodology
  readonly benchmarks: readonly NormalizedBenchmark[]
}

export type BenchmarkDeltaStatus = 'faster' | 'slower' | 'stable' | 'unstable' | 'control'
export type BenchmarkConfidence = 'high' | 'medium' | 'low'

export type BenchmarkDelta = {
  readonly id: string
  readonly group: string
  readonly name: string
  readonly previousHz: number
  readonly currentHz: number
  readonly absoluteHzDeltaPercent: number
  readonly normalizedHzDeltaPercent: number | null
  readonly comparisonDeltaPercent: number
  readonly meanDeltaPercent: number
  readonly previousEfficiency: number | null
  readonly currentEfficiency: number | null
  readonly pairedControlName: string | null
  readonly noiseFloorPercent: number
  readonly confidence: BenchmarkConfidence
  readonly status: BenchmarkDeltaStatus
}

export type SuiteComparison = {
  readonly suite: BenchmarkSuiteDefinition
  readonly previous: BenchmarkSnapshot | null
  readonly current: BenchmarkSnapshot
  readonly deltas: readonly BenchmarkDelta[]
  readonly geometricMeanPercent: number | null
  readonly absoluteGeometricMeanPercent: number | null
  readonly faster: number
  readonly slower: number
  readonly stable: number
  readonly unstable: number
  readonly controls: number
  readonly added: number
  readonly removed: number
}

export type BenchmarkReportFile = {
  readonly schemaVersion: 2
  readonly suite: BenchmarkSuiteDefinition
  readonly generatedAt: string
  readonly runner: BenchmarkRunnerMetadata
  readonly methodology: BenchmarkMethodology
  readonly baseline: BenchmarkSnapshot | null
  readonly current: BenchmarkSnapshot
  readonly comparison: {
    readonly geometricMeanPercent: number | null
    readonly absoluteGeometricMeanPercent: number | null
    readonly faster: number
    readonly slower: number
    readonly stable: number
    readonly unstable: number
    readonly controls: number
    readonly added: number
    readonly removed: number
    readonly deltas: readonly BenchmarkDelta[]
  }
}
