import type {
  BenchmarkDelta,
  BenchmarkSnapshot,
  BenchmarkSuiteDefinition,
  SuiteComparison,
} from './types'

const DEFAULT_CHANGE_FLOOR_PERCENT = 3

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
      faster: 0,
      slower: 0,
      stable: 0,
      added: current.benchmarks.length,
      removed: 0,
    }
  }

  const previousById = new Map(previous.benchmarks.map((row) => [row.id, row]))
  const currentById = new Map(current.benchmarks.map((row) => [row.id, row]))
  const deltas: BenchmarkDelta[] = []
  const ratios: number[] = []
  let faster = 0
  let slower = 0
  let stable = 0

  for (let index = 0; index < current.benchmarks.length; index += 1) {
    const row = current.benchmarks[index]!
    const baseline = previousById.get(row.id)
    if (!baseline || baseline.hz <= 0 || row.hz <= 0) continue

    const hzDeltaPercent = ((row.hz / baseline.hz) - 1) * 100
    const meanDeltaPercent = ((row.meanMs / baseline.meanMs) - 1) * 100
    const noiseFloorPercent = Math.max(
      DEFAULT_CHANGE_FLOOR_PERCENT,
      Math.min(12, row.rme + baseline.rme),
    )
    const status = hzDeltaPercent > noiseFloorPercent
      ? 'faster'
      : hzDeltaPercent < -noiseFloorPercent
        ? 'slower'
        : 'stable'

    if (status === 'faster') faster += 1
    else if (status === 'slower') slower += 1
    else stable += 1

    ratios.push(row.hz / baseline.hz)
    deltas.push({
      id: row.id,
      group: row.group,
      name: row.name,
      previousHz: baseline.hz,
      currentHz: row.hz,
      hzDeltaPercent,
      meanDeltaPercent,
      noiseFloorPercent,
      status,
    })
  }

  const added = current.benchmarks.reduce((count, row) => count + (previousById.has(row.id) ? 0 : 1), 0)
  const removed = previous.benchmarks.reduce((count, row) => count + (currentById.has(row.id) ? 0 : 1), 0)
  const geometricMeanPercent = ratios.length === 0
    ? null
    : (Math.exp(ratios.reduce((sum, ratio) => sum + Math.log(ratio), 0) / ratios.length) - 1) * 100

  return {
    suite,
    previous,
    current,
    deltas,
    geometricMeanPercent,
    faster,
    slower,
    stable,
    added,
    removed,
  }
}

export function renderBenchmarkMarkdown(comparisons: readonly SuiteComparison[]): string {
  const generatedAt = comparisons[0]?.current.generatedAt ?? new Date().toISOString()
  const commit = comparisons[0]?.current.commit ?? 'unknown'
  let output = '<!-- rod-benchmark-report -->\n'
  output += '# ⚡ Performance Observatory\n\n'
  output += `> Commit \`${shortCommit(commit)}\` · generated ${generatedAt} · higher ops/sec is better.\n\n`
  output += 'Benchmarks run through **Vitest benchmark mode / Tinybench**. Changes inside the combined statistical noise floor are marked stable rather than celebrated as tiny, glittery lies. 🧪\n\n'
  output += '## 🌳 Forest overview\n\n'
  output += '| Package | Overall | Faster | Slower | Stable | Added | Removed |\n'
  output += '| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n'

  for (let index = 0; index < comparisons.length; index += 1) {
    const comparison = comparisons[index]!
    output += `| ${packageEmoji(comparison.suite.id)} **${comparison.suite.label}** | ${formatOverall(comparison)} | ${comparison.faster} | ${comparison.slower} | ${comparison.stable} | ${comparison.added} | ${comparison.removed} |\n`
  }

  output += '\n'
  for (let index = 0; index < comparisons.length; index += 1) {
    output += renderSuite(comparisons[index]!)
  }

  output += '## 🧭 Reading the numbers\n\n'
  output += '- **🚀 Faster** means the ops/sec gain exceeded the larger of 3% or the combined benchmark RME.\n'
  output += '- **🐢 Slower** means the regression exceeded that same noise-aware threshold.\n'
  output += '- **🌿 Stable** means the change is too small to separate confidently from runner noise.\n'
  output += '- Compare only runs produced by similar GitHub runners. Local machines are useful for exploration, not courtroom testimony.\n'
  return output
}

function renderSuite(comparison: SuiteComparison): string {
  let output = `## ${packageEmoji(comparison.suite.id)} ${comparison.suite.label}\n\n`
  output += `${comparison.suite.description}\n\n`

  if (!comparison.previous) {
    output += `> 🌱 **Baseline created.** ${comparison.current.benchmarks.length} benchmark cases are now ready for the next commit comparison.\n\n`
  } else {
    const topFaster = comparison.deltas
      .filter((delta) => delta.status === 'faster')
      .sort((left, right) => right.hzDeltaPercent - left.hzDeltaPercent)
      .slice(0, 5)
    const topSlower = comparison.deltas
      .filter((delta) => delta.status === 'slower')
      .sort((left, right) => left.hzDeltaPercent - right.hzDeltaPercent)
      .slice(0, 5)

    output += `**Overall geometric mean:** ${formatSignedPercent(comparison.geometricMeanPercent)}\n\n`
    output += renderHighlights('🚀 Fastest improvements', topFaster)
    output += renderHighlights('🐢 Largest regressions', topSlower)
  }

  const frameworkRace = renderFrameworkRace(comparison.current)
  if (frameworkRace) output += frameworkRace

  output += '<details>\n<summary><strong>📊 All benchmark deltas</strong></summary>\n\n'
  output += '| Status | Benchmark | Previous ops/s | Current ops/s | Δ ops/s | Mean ms | RME |\n'
  output += '| --- | --- | ---: | ---: | ---: | ---: | ---: |\n'

  const deltaById = new Map(comparison.deltas.map((delta) => [delta.id, delta]))
  for (let index = 0; index < comparison.current.benchmarks.length; index += 1) {
    const row = comparison.current.benchmarks[index]!
    const delta = deltaById.get(row.id)
    output += `| ${delta ? statusEmoji(delta.status) : '🆕'} | ${escapeTable(row.name)} | ${delta ? formatNumber(delta.previousHz) : '—'} | ${formatNumber(row.hz)} | ${delta ? formatSignedPercent(delta.hzDeltaPercent) : 'baseline'} | ${formatNumber(row.meanMs, 5)} | ±${formatNumber(row.rme, 2)}% |\n`
  }

  output += '\n</details>\n\n'
  return output
}

function renderHighlights(title: string, rows: readonly BenchmarkDelta[]): string {
  if (rows.length === 0) return `### ${title}\n\n_None outside the noise floor._\n\n`
  let output = `### ${title}\n\n`
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    output += `${index + 1}. **${row.name}** · ${formatSignedPercent(row.hzDeltaPercent)} ops/sec\n`
  }
  return `${output}\n`
}

function renderFrameworkRace(snapshot: BenchmarkSnapshot): string {
  const byCase = new Map<string, Map<string, number>>()
  for (let index = 0; index < snapshot.benchmarks.length; index += 1) {
    const row = snapshot.benchmarks[index]!
    const separator = row.name.lastIndexOf(' :: ')
    if (separator < 0) continue
    const caseId = row.name.slice(0, separator)
    const adapter = row.name.slice(separator + 4)
    let adapters = byCase.get(caseId)
    if (!adapters) {
      adapters = new Map()
      byCase.set(caseId, adapters)
    }
    adapters.set(adapter, row.hz)
  }

  const comparable = Array.from(byCase.entries()).filter(([, adapters]) => adapters.has('manual.createElement') && adapters.size > 1)
  if (comparable.length === 0) return ''

  let output = '### 🥊 Current framework race\n\n'
  output += '| Case | Adapter | Ops/s | Versus manual |\n'
  output += '| --- | --- | ---: | ---: |\n'
  for (let index = 0; index < comparable.length; index += 1) {
    const [caseId, adapters] = comparable[index]!
    const manualHz = adapters.get('manual.createElement')!
    const entries = Array.from(adapters.entries()).filter(([adapter]) => adapter !== 'manual.createElement')
    output += `| ${escapeTable(caseId)} | manual.createElement | ${formatNumber(manualHz)} | baseline |\n`
    for (let adapterIndex = 0; adapterIndex < entries.length; adapterIndex += 1) {
      const [adapter, hz] = entries[adapterIndex]!
      const ratio = hz / manualHz
      output += `| ${escapeTable(caseId)} | ${escapeTable(adapter)} | ${formatNumber(hz)} | ${formatRatio(ratio)} |\n`
    }
  }
  return `${output}\n`
}

function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '—'
  if (ratio >= 1) return `🚀 ${formatNumber(ratio, 2)}× manual`
  return `🐢 ${formatNumber(1 / ratio, 2)}× slower`
}

function formatOverall(comparison: SuiteComparison): string {
  if (!comparison.previous) return '🌱 baseline'
  const value = comparison.geometricMeanPercent ?? 0
  if (value > DEFAULT_CHANGE_FLOOR_PERCENT) return `🚀 ${formatSignedPercent(value)}`
  if (value < -DEFAULT_CHANGE_FLOOR_PERCENT) return `🐢 ${formatSignedPercent(value)}`
  return `🌿 ${formatSignedPercent(value)}`
}

function statusEmoji(status: BenchmarkDelta['status']): string {
  if (status === 'faster') return '🚀'
  if (status === 'slower') return '🐢'
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
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function shortCommit(value: string): string {
  return value && value !== 'unknown' ? value.slice(0, 8) : 'unknown'
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, '\\|')
}
