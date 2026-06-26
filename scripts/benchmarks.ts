import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { ROOT_DIR } from './config'
import { compareSnapshots, renderBenchmarkMarkdown } from './benchmark/report'
import type {
  BenchmarkSnapshot,
  BenchmarkSuiteDefinition,
  NormalizedBenchmark,
  SuiteComparison,
} from './benchmark/types'

const BENCH_DIR = path.join(ROOT_DIR, 'bench')
const RAW_DIR = path.join(ROOT_DIR, '.bench-tmp')
const VITEST_BIN = path.join(ROOT_DIR, 'node_modules', 'vitest', 'vitest.mjs')

const SUITES: readonly BenchmarkSuiteDefinition[] = Object.freeze([
  {
    id: 'cipo',
    label: 'Cipó CSS runtime',
    file: 'src/cipo/tests/cipo.bench.ts',
    description: 'Cold and warm compilation paths for atomic, inline, stylesheet and CSS-first configuration modes.',
  },
  {
    id: 'fabrica',
    label: 'Fabrica DOM runtime',
    file: 'src/fabrica/tests/fabrica.bench.ts',
    description: 'Kitchen-sink DOM rendering matrix compared with manual document.createElement baselines.',
  },
])

type VitestBenchmarkJson = {
  files?: Array<{
    filepath?: string
    groups?: Array<{
      fullName?: string
      benchmarks?: Array<Record<string, unknown>>
    }>
  }>
}

async function main(): Promise<void> {
  const selectedSuites = selectSuites(process.argv.slice(2))
  await fs.mkdir(BENCH_DIR, { recursive: true })
  await fs.rm(RAW_DIR, { recursive: true, force: true })
  await fs.mkdir(RAW_DIR, { recursive: true })

  const comparisons: SuiteComparison[] = []
  for (let index = 0; index < selectedSuites.length; index += 1) {
    const suite = selectedSuites[index]!
    const baselinePath = path.join(BENCH_DIR, `${suite.id}.json`)
    const previous = await readSnapshot(baselinePath)
    const rawPath = path.join(RAW_DIR, `${suite.id}.vitest.json`)

    runVitestSuite(suite, rawPath, previous ? baselinePath : null)

    const raw = JSON.parse(await fs.readFile(rawPath, 'utf8')) as VitestBenchmarkJson
    const current = normalizeSnapshot(suite, raw)
    comparisons.push(compareSnapshots(suite, previous, current))
    await fs.writeFile(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
  }

  const markdown = renderBenchmarkMarkdown(comparisons)
  await fs.writeFile(path.join(BENCH_DIR, 'README.md'), markdown)
  await fs.writeFile(path.join(BENCH_DIR, 'COMPARISON.md'), markdown)
  await fs.rm(RAW_DIR, { recursive: true, force: true })
  process.stdout.write(`\n${markdown}\n`)
}

function selectSuites(args: readonly string[]): readonly BenchmarkSuiteDefinition[] {
  const suiteArg = args.find((arg) => arg.startsWith('--suite='))
  if (!suiteArg) return SUITES
  const requested = new Set(suiteArg.slice('--suite='.length).split(',').map((value) => value.trim()).filter(Boolean))
  const selected = SUITES.filter((suite) => requested.has(suite.id))
  if (selected.length === 0) throw new Error(`Unknown benchmark suite: ${Array.from(requested).join(', ')}`)
  return selected
}

function runVitestSuite(suite: BenchmarkSuiteDefinition, rawPath: string, _baselinePath: string | null): void {
  const args = [
    VITEST_BIN,
    'bench',
    suite.file,
    '--run',
    `--outputJson=${rawPath}`,
  ]

  const result = spawnSync(process.execPath, args, {
    cwd: ROOT_DIR,
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Benchmark suite ${suite.id} failed with exit code ${result.status ?? 'unknown'}.`)
}

function normalizeSnapshot(suite: BenchmarkSuiteDefinition, raw: VitestBenchmarkJson): BenchmarkSnapshot {
  const benchmarks: NormalizedBenchmark[] = []
  const files = raw.files ?? []
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex]!
    const groups = file.groups ?? []
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex]!
      const groupName = normalizeGroupName(group.fullName ?? suite.label, suite.file)
      const rows = group.benchmarks ?? []
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]!
        const name = String(row.name ?? `benchmark-${rowIndex}`)
        benchmarks.push({
          id: `${groupName} > ${name}`,
          group: groupName,
          name,
          hz: numberValue(row.hz),
          meanMs: numberValue(row.mean ?? row.period),
          minMs: numberValue(row.min),
          maxMs: numberValue(row.max),
          p75Ms: numberValue(row.p75),
          p99Ms: numberValue(row.p99),
          rme: numberValue(row.rme),
          samples: numberValue(row.sampleCount ?? row.samples),
        })
      }
    }
  }

  return {
    schemaVersion: 1,
    package: suite.id,
    label: suite.label,
    description: suite.description,
    generatedAt: new Date().toISOString(),
    commit: readCommit(),
    branch: process.env.GITHUB_REF_NAME || process.env.BRANCH_NAME || 'local',
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      ci: Boolean(process.env.CI),
    },
    benchmarks,
  }
}

async function readSnapshot(filePath: string): Promise<BenchmarkSnapshot | null> {
  try {
    const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as BenchmarkSnapshot
    return value?.schemaVersion === 1 && Array.isArray(value.benchmarks) ? value : null
  } catch {
    return null
  }
}

function normalizeGroupName(value: string, benchmarkFile: string): string {
  const normalized = value.replaceAll('\\', '/')
  const fileName = benchmarkFile.replaceAll('\\', '/')
  const marker = `${fileName} > `
  const markerIndex = normalized.indexOf(marker)
  return markerIndex >= 0 ? normalized.slice(markerIndex + marker.length) : normalized
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.length
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function readCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT_DIR, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : 'unknown'
}

await main()
