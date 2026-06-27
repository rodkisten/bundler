import { describe, expect, it } from 'vitest'
import { compareSnapshots, renderBenchmarkMarkdown } from './report'
import type { BenchmarkSnapshot, BenchmarkSuiteDefinition } from './types'

const suite: BenchmarkSuiteDefinition = {
  id: 'fabrica',
  label: 'Fabrica DOM runtime',
  file: 'src/fabrica/tests/fabrica.bench.ts',
  description: 'DOM benchmark suite.',
}

function snapshot(commit: string, rows: Array<{ name: string; hz: number; rme?: number }>): BenchmarkSnapshot {
  return {
    schemaVersion: 1,
    package: 'fabrica',
    label: 'Fabrica DOM runtime',
    description: 'DOM benchmark suite.',
    generatedAt: '2026-06-26T00:00:00.000Z',
    commit,
    branch: 'feature',
    environment: {
      node: 'v24.0.0',
      platform: 'linux',
      arch: 'x64',
      cpu: 'test',
      ci: true,
    },
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
      samples: 100,
    })),
  }
}

describe('benchmark report', () => {
  it('creates a baseline report when no previous snapshot exists', () => {
    const comparison = compareSnapshots(suite, null, snapshot('current', [
      { name: 'static-tree :: manual.createElement', hz: 1000 },
      { name: 'static-tree :: fabrica.html', hz: 500 },
    ]))
    const markdown = renderBenchmarkMarkdown([comparison])

    expect(comparison.added).toBe(2)
    expect(markdown).toContain('🌱 **Baseline created.**')
    expect(markdown).toContain('🥊 Current framework race')
    expect(markdown).toContain('2.00× slower')
  })

  it('classifies improvements, regressions and noise-aware stable changes', () => {
    const previous = snapshot('previous', [
      { name: 'fast', hz: 1000, rme: 1 },
      { name: 'slow', hz: 1000, rme: 1 },
      { name: 'noise', hz: 1000, rme: 3 },
    ])
    const current = snapshot('current', [
      { name: 'fast', hz: 1200, rme: 1 },
      { name: 'slow', hz: 800, rme: 1 },
      { name: 'noise', hz: 1040, rme: 3 },
    ])
    const comparison = compareSnapshots(suite, previous, current)
    const markdown = renderBenchmarkMarkdown([comparison])

    expect(comparison.faster).toBe(1)
    expect(comparison.slower).toBe(1)
    expect(comparison.stable).toBe(1)
    expect(markdown).toContain('🚀 Fastest improvements')
    expect(markdown).toContain('🐢 Largest regressions')
    expect(markdown).toContain('Comparing current commit `current` with previous baseline `previous`')
    expect(markdown).toContain('**Commit comparison:** `current` versus `previous`')
    expect(markdown).toContain('fast')
    expect(markdown).toContain('slow')
  })
})
