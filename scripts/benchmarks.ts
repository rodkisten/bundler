import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { ROOT_DIR } from './config'
import {
  compareSnapshots,
  createBenchmarkReportFile,
  renderBenchmarkMarkdown,
} from './benchmark/report'
import { BENCHMARK_SUITES } from './benchmark/suites'
import { median, medianAbsoluteDeviationPercent } from './benchmark/statistics'
import type {
  BenchmarkMethodology,
  BenchmarkRoundMeasurement,
  BenchmarkRunnerMetadata,
  BenchmarkSnapshot,
  BenchmarkSuiteDefinition,
  NormalizedBenchmark,
  SuiteComparison,
} from './benchmark/types'

const BENCH_DIR = path.join(ROOT_DIR, 'bench')
const RAW_DIR = path.join(ROOT_DIR, '.bench-tmp')
const DEFAULT_ROUNDS = 1
const DEFAULT_COMPARE_ROUNDS = 3
const MAX_ROUNDS = 7
const PROCESS_TIMEOUT_MS = 12 * 60 * 1000

const NOTES = Object.freeze([
  'Baseline and current revisions run on the same worker and Node process version.',
  'Execution order alternates by round to reduce thermal, cache and host-load bias.',
  'Repeated measurements are aggregated by median; cross-round MAD is stored per benchmark.',
  'Fabrica deltas are normalized against the matching manual control before scoring.',
  'Manual controls and baseline microbenchmarks are excluded from package-wide geometric means.',
])

type Side = 'baseline' | 'current'

type CliOptions = {
  mode: 'single' | 'compare'
  suites: readonly BenchmarkSuiteDefinition[]
  rounds: number
  baselineRoot: string | null
  currentRoot: string
  baselineCommit: string | null
  currentCommit: string
  branch: string
}

type VitestBenchmarkJson = {
  files?: Array<{
    filepath?: string
    groups?: Array<{
      fullName?: string
      benchmarks?: Array<Record<string, unknown>>
    }>
  }>
}

type RoundResult = {
  side: Side
  round: number
  position: number
  root: string
  raw: VitestBenchmarkJson
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2))
  await fs.mkdir(BENCH_DIR, { recursive: true })
  await fs.rm(RAW_DIR, { recursive: true, force: true })
  await fs.mkdir(RAW_DIR, { recursive: true })

  const runner = collectRunnerMetadata(options.currentRoot)
  const generatedAt = new Date().toISOString()
  const runOrder = createRunOrder(options.mode, options.rounds)
  const methodology: BenchmarkMethodology = {
    mode: options.mode === 'compare' ? 'same-runner-ab' : 'single',
    rounds: options.rounds,
    aggregation: 'median',
    runOrder,
    sameRunner: options.mode === 'compare',
    minimumChangePercent: 3,
    unstableNoisePercent: 15,
    pairedControlNormalization: true,
    notes: NOTES,
  }

  const roundResults: RoundResult[] = []
  for (let index = 0; index < runOrder.length; index += 1) {
    const entry = runOrder[index]!
    const root = entry.side === 'baseline'
      ? options.baselineRoot
      : options.currentRoot
    if (!root) continue

    process.stdout.write(`\n⚡ Round ${entry.round}/${options.rounds} · ${entry.side} · ${root}\n`)
    const raw = await runVitestSuites(
      root,
      options.suites,
      entry.side,
      entry.round,
      entry.position,
    )
    roundResults.push({ ...entry, root, raw })
  }

  const comparisons: SuiteComparison[] = []
  for (let suiteIndex = 0; suiteIndex < options.suites.length; suiteIndex += 1) {
    const suite = options.suites[suiteIndex]!
    const current = aggregateSuiteSnapshot({
      suite,
      side: 'current',
      roundResults,
      generatedAt,
      commit: options.currentCommit,
      branch: options.branch,
      root: options.currentRoot,
      runner,
      methodology,
    })

    let previous: BenchmarkSnapshot | null = null
    if (options.mode === 'compare' && options.baselineRoot && options.baselineCommit) {
      previous = aggregateSuiteSnapshot({
        suite,
        side: 'baseline',
        roundResults,
        generatedAt,
        commit: options.baselineCommit,
        branch: options.branch,
        root: options.baselineRoot,
        runner,
        methodology,
      })
    } else {
      previous = await readStoredCurrentSnapshot(path.join(BENCH_DIR, `${suite.id}.json`))
    }

    const comparison = compareSnapshots(suite, previous, current)
    comparisons.push(comparison)
    const reportFile = createBenchmarkReportFile(comparison)
    await fs.writeFile(
      path.join(BENCH_DIR, `${suite.id}.json`),
      `${JSON.stringify(reportFile, null, 2)}\n`,
    )
  }

  const selectedIds = new Set(comparisons.map((comparison) => comparison.suite.id))
  const preservedComparisons: SuiteComparison[] = []
  for (let index = 0; index < BENCHMARK_SUITES.length; index += 1) {
    const suite = BENCHMARK_SUITES[index]!
    if (selectedIds.has(suite.id)) continue
    const preserved = await readStoredComparison(path.join(BENCH_DIR, `${suite.id}.json`))
    if (preserved) preservedComparisons.push(preserved)
  }
  const allComparisons = BENCHMARK_SUITES
    .map((suite) => comparisons.find((item) => item.suite.id === suite.id)
      ?? preservedComparisons.find((item) => item.suite.id === suite.id))
    .filter((comparison): comparison is SuiteComparison => Boolean(comparison))

  const markdown = renderBenchmarkMarkdown(allComparisons)
  await fs.writeFile(path.join(BENCH_DIR, 'README.md'), markdown)
  await fs.writeFile(path.join(BENCH_DIR, 'COMPARISON.md'), markdown)
  await fs.writeFile(path.join(BENCH_DIR, 'runner.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt,
    baselineCommit: options.baselineCommit,
    currentCommit: options.currentCommit,
    branch: options.branch,
    runner,
    methodology,
    suites: allComparisons.map((comparison) => ({
      id: comparison.suite.id,
      normalizedGeometricMeanPercent: comparison.geometricMeanPercent,
      absoluteGeometricMeanPercent: comparison.absoluteGeometricMeanPercent,
      faster: comparison.faster,
      slower: comparison.slower,
      stable: comparison.stable,
      unstable: comparison.unstable,
      controls: comparison.controls,
      added: comparison.added,
      removed: comparison.removed,
    })),
  }, null, 2)}\n`)

  await fs.rm(RAW_DIR, { recursive: true, force: true })
  process.stdout.write(`\n${markdown}\n`)
}

function parseOptions(args: readonly string[]): CliOptions {
  const mode = readArgument(args, 'mode') === 'compare' ? 'compare' : 'single'
  const suiteValue = readArgument(args, 'suite')
  const requested = suiteValue
    ? new Set(suiteValue.split(',').map((value) => value.trim()).filter(Boolean))
    : null
  const suites = requested
    ? BENCHMARK_SUITES.filter((suite) => requested.has(suite.id))
    : BENCHMARK_SUITES
  if (suites.length === 0) {
    throw new Error(`Unknown benchmark suite: ${Array.from(requested ?? []).join(', ')}`)
  }

  const currentRoot = path.resolve(readArgument(args, 'current-root') || ROOT_DIR)
  const baselineRootValue = readArgument(args, 'baseline-root')
  const baselineRoot = baselineRootValue ? path.resolve(baselineRootValue) : null
  const requestedRounds = Number(readArgument(args, 'rounds') || (mode === 'compare' ? DEFAULT_COMPARE_ROUNDS : DEFAULT_ROUNDS))
  const rounds = Math.max(1, Math.min(MAX_ROUNDS, Math.trunc(requestedRounds) || 1))
  const currentCommit = readArgument(args, 'current-commit') || readCommit(currentRoot)
  const baselineCommit = mode === 'compare'
    ? readArgument(args, 'baseline-commit') || (baselineRoot ? readCommit(baselineRoot) : null)
    : null

  if (mode === 'compare' && !baselineRoot) {
    throw new Error('Compare mode requires --baseline-root=<path>.')
  }
  if (mode === 'compare' && !baselineCommit) {
    throw new Error('Compare mode requires a resolvable baseline commit.')
  }

  return {
    mode,
    suites,
    rounds,
    baselineRoot,
    currentRoot,
    baselineCommit,
    currentCommit,
    branch: readArgument(args, 'branch') || process.env.GITHUB_REF_NAME || process.env.BRANCH_NAME || 'local',
  }
}

function readArgument(args: readonly string[], name: string): string | null {
  const prefix = `--${name}=`
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null
}

function createRunOrder(mode: CliOptions['mode'], rounds: number): BenchmarkMethodology['runOrder'] {
  const output: Array<{ round: number; side: Side; position: number }> = []
  for (let round = 1; round <= rounds; round += 1) {
    if (mode === 'single') {
      output.push({ round, side: 'current', position: 1 })
      continue
    }

    const sides: readonly Side[] = round % 2 === 1
      ? ['baseline', 'current']
      : ['current', 'baseline']
    for (let position = 0; position < sides.length; position += 1) {
      output.push({ round, side: sides[position]!, position: position + 1 })
    }
  }
  return output
}

async function readValidJsonWithRetry<T>(
  filePath: string,
  attempts = 40,
  delayMs = 100,
): Promise<T | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const text = await fs.readFile(filePath, "utf8");

      if (text.trim().length > 0) {
        return JSON.parse(text) as T;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}

async function runVitestSuites(
  root: string,
  suites: readonly BenchmarkSuiteDefinition[],
  side: Side,
  round: number,
  position: number,
): Promise<VitestBenchmarkJson> {
  const vitestBin = path.join(root, 'node_modules', 'vitest', 'vitest.mjs')
  await assertFile(vitestBin, `Vitest is not installed in ${root}.`)

  const merged: VitestBenchmarkJson = { files: [] }
  for (let suiteIndex = 0; suiteIndex < suites.length; suiteIndex += 1) {
    const suite = suites[suiteIndex]!
    await assertFile(path.join(root, suite.file), `Missing benchmark file ${suite.file} in ${root}.`)

    const rawPath = path.join(
      RAW_DIR,
      `${side}-round-${round}-position-${position}-${suite.id}.vitest.json`,
    )
    const logPath = `${rawPath}.log`
    const args = [
      vitestBin,
      'bench',
      suite.file,
      '--run',
      '--pool=threads',
      '--maxWorkers=1',
      '--no-file-parallelism',
      `--outputJson=${rawPath}`,
    ]

    process.stdout.write(`\n⚙️  ${side}:round-${round}:${suite.id}\n`)
    const output = await runVitestProcess({
      label: `${side}:round-${round}:${suite.id}`,
      root,
      args,
      rawPath,
      environment: {
        ROD_BENCHMARK_SIDE: side,
        ROD_BENCHMARK_ROUND: String(round),
        ROD_BENCHMARK_POSITION: String(position),
        ROD_BENCHMARK_SUITE: suite.id,
      },
    })
    await fs.writeFile(logPath, output)

    const completed = output
      .split(/\r?\n/)
      .filter((line) => line.includes('Benchmark report written') || /^\s*[✓✔]/u.test(line))
      .slice(-3)
    if (completed.length) process.stdout.write(`${completed.join('\n')}\n`)

    const raw = JSON.parse(await fs.readFile(rawPath, 'utf8')) as VitestBenchmarkJson
    merged.files!.push(...(raw.files ?? []))
  }

  return merged
}

async function runVitestProcess(input: {
  label: string
  root: string
  args: readonly string[]
  rawPath: string
  environment: Record<string, string>
}): Promise<string> {
  await fs.rm(input.rawPath, { force: true })

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, input.args, {
      cwd: input.root,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        ...input.environment,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        LANG: process.env.LANG || 'C.UTF-8',
        LC_ALL: process.env.LC_ALL || 'C.UTF-8',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    let settled = false
    let reportReady = false
    let naturalExitTimer: NodeJS.Timeout | null = null
    const appendOutput = (chunk: Buffer | string): void => {
      output += String(chunk)
      if (output.length > 64 * 1024 * 1024) {
        output = output.slice(-32 * 1024 * 1024)
      }
    }
    child.stdout?.on('data', appendOutput)
    child.stderr?.on('data', appendOutput)

    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearInterval(reportPoll)
      clearTimeout(timeout)
      if (naturalExitTimer) clearTimeout(naturalExitTimer)
      if (error) reject(error)
      else resolve(output)
    }

    const stopProcessGroup = (signal: NodeJS.Signals): void => {
      if (!child.pid || child.exitCode !== null) return
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, signal)
        else child.kill(signal)
      } catch {}
    }

    const reportPoll = setInterval(async () => {
      if (settled || reportReady) return
      try {
        const text = await fs.readFile(input.rawPath, 'utf8')
        const parsed = JSON.parse(text) as VitestBenchmarkJson
        if (!Array.isArray(parsed.files) || parsed.files.length === 0) return
        reportReady = true

        if (child.exitCode !== null) {
          finish()
          return
        }

        naturalExitTimer = setTimeout(() => {
          stopProcessGroup('SIGTERM')
          setTimeout(() => stopProcessGroup('SIGKILL'), 2_000).unref()
          finish()
        }, 1_000)
      } catch {}
    }, 100)

    const timeout = setTimeout(() => {
      stopProcessGroup('SIGTERM')
      setTimeout(() => stopProcessGroup('SIGKILL'), 2_000).unref()
      finish(new Error(`Benchmark ${input.label} timed out after ${PROCESS_TIMEOUT_MS}ms.\n${output}`))
    }, PROCESS_TIMEOUT_MS)



    
    child.once('error', (error) => {
      finish(new Error(`Benchmark ${input.label} failed to execute.`, { cause: error }))
    })

    /*child.once('exit', (code, signal) => {
      if (reportReady) {
        finish()
        return
      }
      finish(new Error(
        `Benchmark ${input.label} exited before producing valid JSON with code ${code ?? 'unknown'}${signal ? ` or signal ${signal}` : ''}.\n${output}`,
      ))
    })*/

    child.once("close", async (code) => {
      const report = await readValidJsonWithRetry(reportPath, 40, 100);

      if (!report) {
        finish(new Error(
          `Benchmark ${label} exited before producing valid JSON with code ${code}.`
        ));
        return;
      }

      finish(null, report);
    });
  })
}

function aggregateSuiteSnapshot(input: {
  suite: BenchmarkSuiteDefinition
  side: Side
  roundResults: readonly RoundResult[]
  generatedAt: string
  commit: string
  branch: string
  root: string
  runner: BenchmarkRunnerMetadata
  methodology: BenchmarkMethodology
}): BenchmarkSnapshot {
  const measurementsById = new Map<string, { group: string; name: string; values: BenchmarkRoundMeasurement[] }>()
  const matchingRuns = input.roundResults.filter((result) => result.side === input.side)

  for (let runIndex = 0; runIndex < matchingRuns.length; runIndex += 1) {
    const run = matchingRuns[runIndex]!
    const suiteRaw = filterVitestBenchmarkJson(run.raw, input.suite.file)
    const rows = normalizeRound(input.suite, suiteRaw, run.round, run.position)
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]!
      let bucket = measurementsById.get(row.id)
      if (!bucket) {
        bucket = { group: row.group, name: row.name, values: [] }
        measurementsById.set(row.id, bucket)
      }
      bucket.values.push(row.measurement)
    }
  }

  if (measurementsById.size === 0) {
    throw new Error(`No ${input.suite.id} benchmark rows were produced for ${input.side}.`)
  }

  const benchmarks = Array.from(measurementsById.entries()).map(([id, bucket]) => aggregateBenchmark(id, bucket))
  benchmarks.sort((left, right) => left.group.localeCompare(right.group) || left.name.localeCompare(right.name))

  return {
    schemaVersion: 2,
    package: input.suite.id,
    label: input.suite.label,
    description: input.suite.description,
    generatedAt: input.generatedAt,
    commit: input.commit,
    branch: input.branch,
    root: path.basename(input.root),
    runner: input.runner,
    methodology: input.methodology,
    benchmarks,
  }
}

function normalizeRound(
  suite: BenchmarkSuiteDefinition,
  raw: VitestBenchmarkJson,
  round: number,
  position: number,
): Array<{
  id: string
  group: string
  name: string
  measurement: BenchmarkRoundMeasurement
}> {
  const output: Array<{
    id: string
    group: string
    name: string
    measurement: BenchmarkRoundMeasurement
  }> = []
  const files = raw.files ?? []

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const groups = files[fileIndex]!.groups ?? []
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      const group = groups[groupIndex]!
      const groupName = normalizeGroupName(group.fullName ?? suite.label, suite.file)
      const rows = group.benchmarks ?? []
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex]!
        const name = String(row.name ?? `benchmark-${rowIndex}`)
        output.push({
          id: `${groupName} > ${name}`,
          group: groupName,
          name,
          measurement: {
            round,
            position,
            hz: numberValue(row.hz),
            meanMs: numberValue(row.mean ?? row.period),
            minMs: numberValue(row.min),
            maxMs: numberValue(row.max),
            p75Ms: numberValue(row.p75),
            p99Ms: numberValue(row.p99),
            rme: numberValue(row.rme),
            samples: numberValue(row.sampleCount ?? row.samples),
          },
        })
      }
    }
  }
  return output
}

function aggregateBenchmark(
  id: string,
  bucket: { group: string; name: string; values: BenchmarkRoundMeasurement[] },
): NormalizedBenchmark {
  const values = bucket.values.slice().sort((left, right) => left.round - right.round)
  const hzValues = values.map((value) => value.hz)
  return {
    id,
    group: bucket.group,
    name: bucket.name,
    hz: median(hzValues),
    meanMs: median(values.map((value) => value.meanMs)),
    minMs: median(values.map((value) => value.minMs)),
    maxMs: median(values.map((value) => value.maxMs)),
    p75Ms: median(values.map((value) => value.p75Ms)),
    p99Ms: median(values.map((value) => value.p99Ms)),
    rme: median(values.map((value) => value.rme)),
    samples: values.reduce((sum, value) => sum + value.samples, 0),
    rounds: values.length,
    runVariationPercent: medianAbsoluteDeviationPercent(hzValues),
    measurements: values,
  }
}

function filterVitestBenchmarkJson(raw: VitestBenchmarkJson, benchmarkFile: string): VitestBenchmarkJson {
  const expected = benchmarkFile.replaceAll('\\', '/')
  return {
    files: (raw.files ?? []).filter((file) => {
      const filepath = (file.filepath ?? '').replaceAll('\\', '/')
      return filepath === expected || filepath.endsWith(`/${expected}`)
    }),
  }
}

function normalizeGroupName(value: string, benchmarkFile: string): string {
  const normalized = value.replaceAll('\\', '/')
  const fileName = benchmarkFile.replaceAll('\\', '/')
  const marker = `${fileName} > `
  const markerIndex = normalized.indexOf(marker)
  return markerIndex >= 0 ? normalized.slice(markerIndex + marker.length) : normalized
}

async function readStoredCurrentSnapshot(filePath: string): Promise<BenchmarkSnapshot | null> {
  try {
    const value = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
      schemaVersion?: number
      current?: BenchmarkSnapshot
      benchmarks?: NormalizedBenchmark[]
    }
    if (value.schemaVersion === 2 && value.current?.schemaVersion === 2) return value.current
    return null
  } catch {
    return null
  }
}

async function readStoredComparison(filePath: string): Promise<SuiteComparison | null> {
  try {
    const report = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
      schemaVersion?: number
      suite?: BenchmarkSuiteDefinition
      baseline?: BenchmarkSnapshot | null
      current?: BenchmarkSnapshot
      comparison?: Omit<SuiteComparison, 'suite' | 'previous' | 'current'>
    }
    if (report.schemaVersion !== 2 || !report.suite || !report.current || !report.comparison) return null
    return {
      suite: report.suite,
      previous: report.baseline ?? null,
      current: report.current,
      ...report.comparison,
    }
  } catch {
    return null
  }
}

function collectRunnerMetadata(root: string): BenchmarkRunnerMetadata {
  const cpus = os.cpus()
  return {
    collectedAt: new Date().toISOString(),
    node: process.version,
    v8: process.versions.v8,
    pnpm: commandVersion('pnpm', ['--version'], root),
    vitest: packageVersion(path.join(root, 'node_modules', 'vitest', 'package.json')),
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    cpuModel: cpus[0]?.model ?? 'unknown',
    cpuCount: cpus.length,
    cpuSpeedMHz: median(cpus.map((cpu) => cpu.speed)),
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    loadAverage: os.loadavg(),
    uptimeSeconds: os.uptime(),
    ci: Boolean(process.env.CI),
    runnerName: process.env.RUNNER_NAME || 'local',
    runnerOs: process.env.RUNNER_OS || process.platform,
    runnerArch: process.env.RUNNER_ARCH || process.arch,
    runnerEnvironment: process.env.RUNNER_ENVIRONMENT || (process.env.CI ? 'ci' : 'local'),
    repository: process.env.GITHUB_REPOSITORY || '',
    workflow: process.env.GITHUB_WORKFLOW || '',
    job: process.env.GITHUB_JOB || '',
    runId: process.env.GITHUB_RUN_ID || '',
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || '',
    eventName: process.env.GITHUB_EVENT_NAME || '',
  }
}

function commandVersion(command: string, args: readonly string[], root: string): string {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : 'unknown'
}

function packageVersion(filePath: string): string {
  try {
    const result = spawnSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(filePath)}).version)`], {
      encoding: 'utf8',
    })
    return result.status === 0 ? result.stdout.trim() : 'unknown'
  } catch {
    return 'unknown'
  }
}

function readCommit(root: string): string {
  if (root === ROOT_DIR && process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : 'unknown'
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.length
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function assertFile(filePath: string, message: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath)
    if (stat.isFile()) return
  } catch {}
  throw new Error(message)
}

await main()
