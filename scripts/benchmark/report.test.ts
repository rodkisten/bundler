import { describe, expect, it } from 'vitest'
import { compareSnapshots, createBenchmarkReportFile, renderBenchmarkMarkdown } from './report'
import type {
  BenchmarkMethodology,
  BenchmarkRunnerMetadata,
  BenchmarkSnapshot,
  BenchmarkSuiteDefinition,
} from './types'

const suite: BenchmarkSuiteDefinition = {
  id: 'fabrica',
  label: 'Fabrica DOM runtime',
  file: 'src/fabrica/tests/fabrica.bench.ts',
  description: 'DOM benchmark suite.',
}

const runner: BenchmarkRunnerMetadata = {
  collectedAt: '2026-06-27T00:00:00.000Z',
  node: 'v24.0.0',
  v8: '13.6',
  pnpm: '11.5.1',
  vitest: '4.1.8',
  platform: 'linux',
  release: '6.11',
  arch: 'x64',
  cpuModel: 'test cpu',
  cpuCount: 4,
  cpuSpeedMHz: 3000,
  totalMemoryBytes: 16 * 1024 ** 3,
  freeMemoryBytes: 8 * 1024 ** 3,
  loadAverage: [0.1, 0.2, 0.3],
  uptimeSeconds: 100,
  ci: true,
  runnerName: 'runner',
  runnerOs: 'Linux',
  runnerArch: 'X64',
  runnerEnvironment: 'github-hosted',
  repository: 'rod/repo',
  workflow: 'bench',
  job: 'benchmark',
  runId: '1',
  runAttempt: '1',
  eventName: 'push',
}

const methodology: BenchmarkMethodology = {
  mode: 'same-runner-ab',
  rounds: 3,
  aggregation: 'median',
  runOrder: [
    { round: 1, side: 'baseline', position: 1 },
    { round: 1, side: 'current', position: 2 },
    { round: 2, side: 'current', position: 1 },
    { round: 2, side: 'baseline', position: 2 },
    { round: 3, side: 'baseline', position: 1 },
    { round: 3, side: 'current', position: 2 },
  ],
  sameRunner: true,
  minimumChangePercent: 3,
  unstableNoisePercent: 15,
  pairedControlNormalization: true,
  notes: [],
}

function snapshot(
  commit: string,
  rows: Array<{
    name: string
    hz: number
    rme?: number
    variation?: number
    rounds?: number
  }>,
): BenchmarkSnapshot {
  return {
    schemaVersion: 2,
    package: 'fabrica',
    label: 'Fabrica DOM runtime',
    description: 'DOM benchmark suite.',
    generatedAt: '2026-06-27T00:00:00.000Z',
    commit,
    branch: 'feature',
    root: commit,
    runner,
    methodology,
    benchmarks: rows.map((row) => ({
      id: `group > ${row.name}`,
      group: 'group',
      name: row.name,
      hz: row.hz,
      meanMs: 1000 / row.hz,
      minMs: 0,
      maxMs: 0,
      p75Ms: 0,
      p99Ms: 0,
      rme: row.rme ?? 1,
      samples: 300,
      rounds: row.rounds ?? 3,
      runVariationPercent: row.variation ?? 1,
      measurements: [],
    })),
  }
}

describe('benchmark report', () => {
  it('creates a baseline report with runner and methodology details', () => {
    const comparison = compareSnapshots(suite, null, snapshot('current', [
      { name: 'static-tree :: manual.createElement', hz: 1000 },
      { name: 'static-tree :: fabrica.html', hz: 500 },
    ]))
    const markdown = renderBenchmarkMarkdown([comparison])

    expect(comparison.added).toBe(2)
    expect(markdown).toContain('🌱 **Baseline created.**')
    expect(markdown).toContain('Runner fingerprint')
    expect(markdown).toContain('Current paired controls')
    expect(markdown).toContain('50.00% of manual throughput')
  })

  it('normalizes Fabrica against its paired manual control', () => {
    const previous = snapshot('previous', [
      { name: 'static-tree :: manual.createElement', hz: 1000 },
      { name: 'static-tree :: fabrica.html', hz: 500 },
    ])
    const current = snapshot('current', [
      { name: 'static-tree :: manual.createElement', hz: 2000 },
      { name: 'static-tree :: fabrica.html', hz: 1100 },
    ])
    const comparison = compareSnapshots(suite, previous, current)
    const manual = comparison.deltas.find((delta) => delta.name.endsWith('manual.createElement'))!
    const fabrica = comparison.deltas.find((delta) => delta.name.endsWith('fabrica.html'))!

    expect(manual.status).toBe('control')
    expect(fabrica.absoluteHzDeltaPercent).toBeCloseTo(120)
    expect(fabrica.normalizedHzDeltaPercent).toBeCloseTo(10)
    expect(comparison.geometricMeanPercent).toBeCloseTo(10)
    expect(comparison.absoluteGeometricMeanPercent).toBeCloseTo(120)
  })

  it('marks extremely noisy measurements unstable instead of claiming a regression', () => {
    const previous = snapshot('previous', [
      { name: 'noisy', hz: 1000, rme: 20, variation: 18 },
    ])
    const current = snapshot('current', [
      { name: 'noisy', hz: 700, rme: 22, variation: 20 },
    ])
    const comparison = compareSnapshots(suite, previous, current)

    expect(comparison.unstable).toBe(1)
    expect(comparison.slower).toBe(0)
    expect(comparison.deltas[0]?.status).toBe('unstable')
  })

  it('serializes the complete comparison into the package JSON file', () => {
    const previous = snapshot('previous', [{ name: 'fast', hz: 1000 }])
    const current = snapshot('current', [{ name: 'fast', hz: 1200 }])
    const file = createBenchmarkReportFile(compareSnapshots(suite, previous, current))

    expect(file.schemaVersion).toBe(2)
    expect(file.runner.cpuModel).toBe('test cpu')
    expect(file.baseline?.commit).toBe('previous')
    expect(file.current.commit).toBe('current')
    expect(file.comparison.deltas).toHaveLength(1)
  })
})
