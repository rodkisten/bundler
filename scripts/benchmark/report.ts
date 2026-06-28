import { geometricMeanPercent } from './statistics'
import type {
  BenchmarkConfidence,
  BenchmarkDelta,
  BenchmarkDeltaStatus,
  BenchmarkReportFile,
  BenchmarkSnapshot,
  BenchmarkSuiteDefinition,
  NormalizedBenchmark,
  SuiteComparison,
} from './types'

const DEFAULT_CHANGE_FLOOR_PERCENT = 3
const DEFAULT_UNSTABLE_NOISE_PERCENT = 15
const MANUAL_ADAPTER = 'manual.createElement'

export function compareSnapshots(
  suite: BenchmarkSuiteDefinition,
  previous: BenchmarkSnapshot | null,
  current: BenchmarkSnapshot,
): SuiteComparison {
  if (!previous) {
    return {
      suite,
      previous: null,
      current,
      deltas: [],
      geometricMeanPercent: null,
      absoluteGeometricMeanPercent: null,
      faster: 0,
      slower: 0,
      stable: 0,
      unstable: 0,
      controls: 0,
      added: current.benchmarks.length,
      removed: 0,
    }
  }

  const previousById = new Map(previous.benchmarks.map((row) => [row.id, row]))
  const currentById = new Map(current.benchmarks.map((row) => [row.id, row]))
  const previousByName = new Map(previous.benchmarks.map((row) => [row.name, row]))
  const currentByName = new Map(current.benchmarks.map((row) => [row.name, row]))
  const deltas: BenchmarkDelta[] = []
  const normalizedRatios: number[] = []
  const absoluteRatios: number[] = []
  let faster = 0
  let slower = 0
  let stable = 0
  let unstable = 0
  let controls = 0

  for (let index = 0; index < current.benchmarks.length; index += 1) {
    const row = current.benchmarks[index]!
    const baseline = previousById.get(row.id)
    if (!baseline || baseline.hz <= 0 || row.hz <= 0) continue

    const controlName = getPairedControlName(row.name)
    const isControl = isControlBenchmark(row.name)
    const previousControl = controlName ? previousByName.get(controlName) : null
    const currentControl = controlName ? currentByName.get(controlName) : null
    const absoluteHzDeltaPercent = percentChange(baseline.hz, row.hz)
    const meanDeltaPercent = percentChange(baseline.meanMs, row.meanMs)
    const previousEfficiency = previousControl && previousControl.hz > 0
      ? baseline.hz / previousControl.hz
      : null
    const currentEfficiency = currentControl && currentControl.hz > 0
      ? row.hz / currentControl.hz
      : null
    const normalizedHzDeltaPercent = previousEfficiency && currentEfficiency
      ? percentChange(previousEfficiency, currentEfficiency)
      : null
    const comparisonDeltaPercent = normalizedHzDeltaPercent ?? absoluteHzDeltaPercent
    const noiseFloorPercent = calculateNoiseFloor(
      baseline,
      row,
      previousControl ?? null,
      currentControl ?? null,
    )
    const confidence = calculateConfidence(
      baseline,
      row,
      previousControl ?? null,
      currentControl ?? null,
    )
    const status = isControl
      ? 'control'
      : classifyDelta(comparisonDeltaPercent, noiseFloorPercent, confidence)

    if (status === 'faster') faster += 1
    else if (status === 'slower') slower += 1
    else if (status === 'stable') stable += 1
    else if (status === 'unstable') unstable += 1
    else controls += 1

    if (!isControl && status !== 'unstable' && Number.isFinite(comparisonDeltaPercent)) {
      normalizedRatios.push(1 + comparisonDeltaPercent / 100)
      absoluteRatios.push(row.hz / baseline.hz)
    }

    deltas.push({
      id: row.id,
      group: row.group,
      name: row.name,
      previousHz: baseline.hz,
      currentHz: row.hz,
      absoluteHzDeltaPercent,
      normalizedHzDeltaPercent,
      comparisonDeltaPercent,
      meanDeltaPercent,
      previousEfficiency,
      currentEfficiency,
      pairedControlName: controlName,
      noiseFloorPercent,
      confidence,
      status,
    })
  }

  const added = current.benchmarks.reduce((count, row) => count + (previousById.has(row.id) ? 0 : 1), 0)
  const removed = previous.benchmarks.reduce((count, row) => count + (currentById.has(row.id) ? 0 : 1), 0)

  return {
    suite,
    previous,
    current,
    deltas,
    geometricMeanPercent: geometricMeanPercent(normalizedRatios),
    absoluteGeometricMeanPercent: geometricMeanPercent(absoluteRatios),
    faster,
    slower,
    stable,
    unstable,
    controls,
    added,
    removed,
  }
}

export function createBenchmarkReportFile(comparison: SuiteComparison): BenchmarkReportFile {
  return {
    schemaVersion: 2,
    suite: comparison.suite,
    generatedAt: comparison.current.generatedAt,
    runner: comparison.current.runner,
    methodology: comparison.current.methodology,
    baseline: comparison.previous,
    current: comparison.current,
    comparison: {
      geometricMeanPercent: comparison.geometricMeanPercent,
      absoluteGeometricMeanPercent: comparison.absoluteGeometricMeanPercent,
      faster: comparison.faster,
      slower: comparison.slower,
      stable: comparison.stable,
      unstable: comparison.unstable,
      controls: comparison.controls,
      added: comparison.added,
      removed: comparison.removed,
      deltas: comparison.deltas,
    },
  }
}

export function renderBenchmarkMarkdown(comparisons: readonly SuiteComparison[]): string {
  const generatedAt = comparisons[0]?.current.generatedAt ?? new Date().toISOString()
  const commit = comparisons[0]?.current.commit ?? 'unknown'
  const baselineCommit = comparisons[0]?.previous?.commit ?? 'none'
  const runner = comparisons[0]?.current.runner
  const methodology = comparisons[0]?.current.methodology
  let output = '<!-- rod-benchmark-report -->\n'
  output += '# ⚡ Performance Observatory\n\n'
  output += `> Current \`${shortCommit(commit)}\` · baseline \`${shortCommit(baselineCommit)}\` · generated ${generatedAt}.\n\n`
  output += methodology?.sameRunner && comparisons.some((comparison) => comparison.previous)
    ? 'The report compares both revisions on the **same runner**, alternates execution order, aggregates repeated rounds by median, and normalizes Fabrica against its paired manual control. Tiny benchmark confetti stays in the drawer. 🧪\n\n'
    : 'This is a local or first-run baseline snapshot. It records the complete runner fingerprint and per-case measurements; the CI workflow will replace it with an alternating same-runner A/B comparison. 🧪\n\n'
  output += '## 🖥️ Runner fingerprint\n\n'
  output += '| Field | Value |\n'
  output += '| --- | --- |\n'
  output += `| Runner | ${escapeTable(runner?.runnerName || 'local')} · ${escapeTable(runner?.runnerOs || runner?.platform || 'unknown')} · ${escapeTable(runner?.runnerArch || runner?.arch || 'unknown')} |\n`
  output += `| CPU | ${escapeTable(runner?.cpuModel || 'unknown')} · ${formatNumber(runner?.cpuCount ?? 0)} logical cores · ${formatNumber(runner?.cpuSpeedMHz ?? 0)} MHz |\n`
  output += `| Runtime | Node ${escapeTable(runner?.node || 'unknown')} · V8 ${escapeTable(runner?.v8 || 'unknown')} · pnpm ${escapeTable(runner?.pnpm || 'unknown')} · Vitest ${escapeTable(runner?.vitest || 'unknown')} |\n`
  output += `| Memory | ${formatBytes(runner?.totalMemoryBytes ?? 0)} total · ${formatBytes(runner?.freeMemoryBytes ?? 0)} free at capture |\n`
  output += `| Method | ${methodology?.rounds ?? 1} round(s) · ${escapeTable(methodology?.aggregation || 'median')} · ${methodology?.sameRunner ? 'same runner A/B' : 'single revision'} |\n`
  output += `| Run order | ${escapeTable(formatRunOrder(methodology?.runOrder ?? []))} |\n\n`

  output += '## 🌳 Forest overview\n\n'
  output += '| Package | Normalized overall | Absolute overall | Faster | Slower | Stable | Unstable | Controls | Added | Removed |\n'
  output += '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n'

  for (let index = 0; index < comparisons.length; index += 1) {
    const comparison = comparisons[index]!
    output += `| ${packageEmoji(comparison.suite.id)} **${comparison.suite.label}** | ${formatOverall(comparison.geometricMeanPercent)} | ${formatSignedPercent(comparison.absoluteGeometricMeanPercent)} | ${comparison.faster} | ${comparison.slower} | ${comparison.stable} | ${comparison.unstable} | ${comparison.controls} | ${comparison.added} | ${comparison.removed} |\n`
  }

  output += '\n'
  for (let index = 0; index < comparisons.length; index += 1) {
    output += renderSuite(comparisons[index]!)
  }

  output += '## 🧭 Reading the numbers\n\n'
  output += '- **Normalized Δ** removes runner drift by comparing each Fabrica adapter with its paired manual control in both revisions. This is the primary signal.\n'
  output += '- **Absolute Δ** is the raw operations-per-second change and remains useful for Cipó cases without paired controls.\n'
  output += '- **🚀 Faster / 🐢 Slower** require a change larger than the noise floor, which combines Tinybench RME and cross-round variation.\n'
  output += '- **⚠️ Unstable** means noise exceeded the reliability ceiling. Re-run before acting on it.\n'
  output += '- Overall scores exclude `manual.createElement` controls and `baseline:` microbenchmarks.\n'
  output += '- Cross-case Vitest rankings are intentionally omitted because a Map lookup, CSS compile and DOM mount are different units of work despite all reporting ops/sec.\n'
  return output
}

function renderSuite(comparison: SuiteComparison): string {
  let output = `## ${packageEmoji(comparison.suite.id)} ${comparison.suite.label}\n\n`
  output += `${comparison.suite.description}\n\n`

  if (!comparison.previous) {
    output += `> 🌱 **Baseline created.** ${comparison.current.benchmarks.length} benchmark cases are ready for the next same-runner comparison.\n\n`
  } else {
    const topFaster = comparison.deltas
      .filter((delta) => delta.status === 'faster')
      .sort((left, right) => right.comparisonDeltaPercent - left.comparisonDeltaPercent)
      .slice(0, 5)
    const topSlower = comparison.deltas
      .filter((delta) => delta.status === 'slower')
      .sort((left, right) => left.comparisonDeltaPercent - right.comparisonDeltaPercent)
      .slice(0, 5)
    const unstableRows = comparison.deltas
      .filter((delta) => delta.status === 'unstable')
      .sort((left, right) => right.noiseFloorPercent - left.noiseFloorPercent)
      .slice(0, 5)

    output += `**Normalized geometric mean:** ${formatSignedPercent(comparison.geometricMeanPercent)}  \n`
    output += `**Raw geometric mean:** ${formatSignedPercent(comparison.absoluteGeometricMeanPercent)}\n\n`
    output += renderHighlights('🚀 Fastest reliable improvements', topFaster)
    output += renderHighlights('🐢 Largest reliable regressions', topSlower)
    output += renderUnstableHighlights(unstableRows)
  }

  const frameworkRace = renderFrameworkRace(comparison.current)
  if (frameworkRace) output += frameworkRace

  output += '<details>\n<summary><strong>📊 All benchmark deltas</strong></summary>\n\n'
  output += '| Status | Benchmark | Baseline ops/s | Current ops/s | Absolute Δ | Normalized Δ | Noise floor | Confidence | Mean ms | CV | Round variation | Sparkline |\n'
  output += '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |\n'

  const deltaById = new Map(comparison.deltas.map((delta) => [delta.id, delta]))
  for (let index = 0; index < comparison.current.benchmarks.length; index += 1) {
    const row = comparison.current.benchmarks[index]!
    const delta = deltaById.get(row.id)
    output += `| ${delta ? statusEmoji(delta.status) : '🆕'} | ${escapeTable(row.name)} | ${delta ? formatNumber(delta.previousHz) : '—'} | ${formatNumber(row.hz)} | ${delta ? formatSignedPercent(delta.absoluteHzDeltaPercent) : 'baseline'} | ${delta?.normalizedHzDeltaPercent == null ? '—' : formatSignedPercent(delta.normalizedHzDeltaPercent)} | ${delta ? `${formatNumber(delta.noiseFloorPercent, 2)}%` : '—'} | ${delta?.confidence ?? '—'} | ${formatNumber(row.meanMs, 5)} | ${formatNumber(row.coefficientOfVariationPercent, 2)}% | ${formatNumber(row.runVariationPercent, 2)}% | ${escapeTable(row.sparkline || '▁')} |\n`
  }

  output += '\n</details>\n\n'
  return output
}

function renderHighlights(title: string, rows: readonly BenchmarkDelta[]): string {
  if (rows.length === 0) return `### ${title}\n\n_None outside the reliability threshold._\n\n`
  let output = `### ${title}\n\n`
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    output += `${index + 1}. **${row.name}** · ${formatSignedPercent(row.comparisonDeltaPercent)} ${row.normalizedHzDeltaPercent == null ? 'raw' : 'normalized'} · ${row.confidence} confidence\n`
  }
  return `${output}\n`
}

function renderUnstableHighlights(rows: readonly BenchmarkDelta[]): string {
  if (rows.length === 0) return ''
  let output = '### ⚠️ Noisy cases to rerun\n\n'
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    output += `${index + 1}. **${row.name}** · ${formatNumber(row.noiseFloorPercent, 2)}% noise floor\n`
  }
  return `${output}\n`
}

function renderFrameworkRace(snapshot: BenchmarkSnapshot): string {
  const byCase = new Map<string, Map<string, number>>()
  for (let index = 0; index < snapshot.benchmarks.length; index += 1) {
    const row = snapshot.benchmarks[index]!
    const parsed = parseAdapterBenchmark(row.name)
    if (!parsed) continue
    let adapters = byCase.get(parsed.caseId)
    if (!adapters) {
      adapters = new Map()
      byCase.set(parsed.caseId, adapters)
    }
    adapters.set(parsed.adapter, row.hz)
  }

  const comparable = Array.from(byCase.entries()).filter(([, adapters]) => adapters.has(MANUAL_ADAPTER) && adapters.size > 1)
  if (comparable.length === 0) return ''

  let output = '### 🥊 Current paired controls\n\n'
  output += '| Case | Adapter | Ops/s | Efficiency versus manual |\n'
  output += '| --- | --- | ---: | ---: |\n'
  for (let index = 0; index < comparable.length; index += 1) {
    const [caseId, adapters] = comparable[index]!
    const manualHz = adapters.get(MANUAL_ADAPTER)!
    const entries = Array.from(adapters.entries()).filter(([adapter]) => adapter !== MANUAL_ADAPTER)
    output += `| ${escapeTable(caseId)} | ${MANUAL_ADAPTER} | ${formatNumber(manualHz)} | control |\n`
    for (let adapterIndex = 0; adapterIndex < entries.length; adapterIndex += 1) {
      const [adapter, hz] = entries[adapterIndex]!
      output += `| ${escapeTable(caseId)} | ${escapeTable(adapter)} | ${formatNumber(hz)} | ${formatRatio(hz / manualHz)} |\n`
    }
  }
  return `${output}\n`
}

function calculateNoiseFloor(
  baseline: NormalizedBenchmark,
  current: NormalizedBenchmark,
  baselineControl: NormalizedBenchmark | null,
  currentControl: NormalizedBenchmark | null,
): number {
  const rmeValues = [baseline.rme, current.rme]
  const variationValues = [baseline.runVariationPercent, current.runVariationPercent]
  if (baselineControl && currentControl) {
    rmeValues.push(baselineControl.rme, currentControl.rme)
    variationValues.push(baselineControl.runVariationPercent, currentControl.runVariationPercent)
  }

  const combinedRme = Math.sqrt(rmeValues.reduce((sum, value) => sum + value * value, 0))
  const roundVariation = Math.max(...variationValues)
  return Math.max(
    DEFAULT_CHANGE_FLOOR_PERCENT,
    Math.min(25, Math.max(combinedRme, roundVariation)),
  )
}

function calculateConfidence(
  baseline: NormalizedBenchmark,
  current: NormalizedBenchmark,
  baselineControl: NormalizedBenchmark | null,
  currentControl: NormalizedBenchmark | null,
): BenchmarkConfidence {
  const rows = [baseline, current, baselineControl, currentControl].filter(Boolean) as NormalizedBenchmark[]
  const worstRme = Math.max(...rows.map((row) => row.rme))
  const worstVariation = Math.max(...rows.map((row) => row.runVariationPercent))
  const rounds = Math.min(...rows.map((row) => row.rounds))

  if (rounds >= 3 && worstRme <= 5 && worstVariation <= 5) return 'high'
  if (rounds >= 2 && worstRme <= 12 && worstVariation <= 12) return 'medium'
  return 'low'
}

function classifyDelta(
  deltaPercent: number,
  noiseFloorPercent: number,
  confidence: BenchmarkConfidence,
): BenchmarkDeltaStatus {
  if (confidence === 'low' && noiseFloorPercent >= DEFAULT_UNSTABLE_NOISE_PERCENT) return 'unstable'
  if (deltaPercent > noiseFloorPercent) return 'faster'
  if (deltaPercent < -noiseFloorPercent) return 'slower'
  return 'stable'
}

function getPairedControlName(name: string): string | null {
  const parsed = parseAdapterBenchmark(name)
  if (!parsed || parsed.adapter === MANUAL_ADAPTER) return null
  return `${parsed.caseId} :: ${MANUAL_ADAPTER}`
}

function isControlBenchmark(name: string): boolean {
  const parsed = parseAdapterBenchmark(name)
  return parsed?.adapter === MANUAL_ADAPTER || name.startsWith('baseline:')
}

function parseAdapterBenchmark(name: string): { caseId: string; adapter: string } | null {
  const separator = name.lastIndexOf(' :: ')
  if (separator < 0) return null
  return {
    caseId: name.slice(0, separator),
    adapter: name.slice(separator + 4),
  }
}

function percentChange(previous: number, current: number): number {
  if (!Number.isFinite(previous) || previous === 0 || !Number.isFinite(current)) return 0
  return ((current / previous) - 1) * 100
}

function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '—'
  return `${formatNumber(ratio * 100, 2)}% of manual throughput`
}

function formatOverall(value: number | null): string {
  if (value == null) return '🌱 baseline'
  if (value > DEFAULT_CHANGE_FLOOR_PERCENT) return `🚀 ${formatSignedPercent(value)}`
  if (value < -DEFAULT_CHANGE_FLOOR_PERCENT) return `🐢 ${formatSignedPercent(value)}`
  return `🌿 ${formatSignedPercent(value)}`
}

function statusEmoji(status: BenchmarkDeltaStatus): string {
  if (status === 'faster') return '🚀'
  if (status === 'slower') return '🐢'
  if (status === 'unstable') return '⚠️'
  if (status === 'control') return '🧭'
  return '🌿'
}

function packageEmoji(id: string): string {
  if (id === 'cipo') return '🌿'
  if (id === 'fabrica') return '🏭'
  if (id === 'broto') return '🌱'
  return '🧰'
}

function formatSignedPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatNumber(value, 2)}%`
}

function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'unknown'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${formatNumber(size, unitIndex > 1 ? 2 : 0)} ${units[unitIndex]}`
}

function formatRunOrder(entries: readonly { round: number; side: string; position: number }[]): string {
  if (entries.length === 0) return 'single run'
  return entries
    .slice()
    .sort((left, right) => left.round - right.round || left.position - right.position)
    .map((entry) => `R${entry.round}:${entry.side}`)
    .join(' → ')
}

function shortCommit(value: string): string {
  return value && value !== 'unknown' && value !== 'none' ? value.slice(0, 8) : value || 'unknown'
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}
