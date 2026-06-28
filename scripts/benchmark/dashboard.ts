import type { BenchmarkReportFile, BenchmarkSnapshot, NormalizedBenchmark } from './types'

export function createBenchmarkDashboardHtml(reports: readonly BenchmarkReportFile[]): string {
  const generatedAt = reports[0]?.generatedAt ?? new Date().toISOString()
  const cards = reports.map(renderSuiteCard).join('\n')
  const frameworkRows = reports.flatMap(createFrameworkRows)
  const benchmarkRows = reports.flatMap(createBenchmarkRows)
  const runner = reports[0]?.runner

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Benchmark Observatory · Rod Docs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../assets/docs.css" />
</head>
<body data-page-kind="benchmark-dashboard" data-package="benchmark">
  <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Open navigation" aria-expanded="false">☰</button>
  <div class="sidebar-scrim" data-sidebar-close aria-hidden="true"></div>
  <main class="doc-layout benchmark-dashboard-layout">
    <aside class="doc-sidebar surface" data-doc-sidebar>
      <a class="brand" href="../index.html">Rod Benchmarks</a>
      <label class="search-box"><span>Search</span><input data-doc-search type="search" placeholder="Filter benchmark rows…" /></label>
      <nav class="side-list" aria-label="Benchmark sections">
        <a href="#overview"><strong>Overview</strong><span>scorecards</span></a>
        <a href="#framework-race"><strong>Framework Race</strong><span>Fabrica · Lit · manual</span></a>
        <a href="#all-cases"><strong>All Cases</strong><span>sortable table</span></a>
      </nav>
      <nav class="side-list benchmark-side-list" aria-label="Benchmark reports">
        <p>Reports</p>
        ${reports.map((report) => `<a data-package="${escapeHtml(packageId(report.suite.id))}" href="./benchmark-${escapeHtml(report.suite.id)}.html"><strong>${escapeHtml(report.suite.label)}</strong><span>${escapeHtml(report.suite.description)}</span></a>`).join('')}
      </nav>
    </aside>
    <article class="doc-page searchable-content surface benchmark-dashboard" data-benchmark-dashboard>
      <a class="back-link" href="../index.html">← Home</a>
      <p class="eyebrow">Performance Observatory · ${escapeHtml(generatedAt)}</p>
      <h1>Benchmark Dashboard</h1>
      <p class="page-description">Sortable benchmarks, framework comparisons, noise diagnostics, round sparklines and same-runner metadata in one cockpit.</p>

      <section class="benchmark-kpis" id="overview">
        ${cards}
      </section>

      <section class="benchmark-panel" id="framework-race">
        <div class="benchmark-panel-header">
          <p class="eyebrow">Framework Race</p>
          <h2>Current adapter throughput</h2>
        </div>
        ${renderTable({
          className: 'benchmark-race-table',
          columns: ['Suite', 'Case', 'Adapter', 'Ops/s', 'Efficiency', 'Mean ms', 'Variation', 'Sparkline'],
          rows: frameworkRows,
        })}
      </section>

      <section class="benchmark-panel" id="all-cases">
        <div class="benchmark-panel-header">
          <p class="eyebrow">All Cases</p>
          <h2>Regression and stability matrix</h2>
        </div>
        ${renderTable({
          className: 'benchmark-all-table',
          columns: ['Status', 'Suite', 'Benchmark', 'Baseline ops/s', 'Current ops/s', 'Absolute Δ', 'Normalized Δ', 'Noise', 'Confidence', 'Mean ms', 'CV', 'Sparkline'],
          rows: benchmarkRows,
        })}
      </section>

      <section class="benchmark-runner surface">
        <p class="eyebrow">Runner</p>
        <dl>
          <div><dt>Runtime</dt><dd>${escapeHtml(runner ? `${runner.node} · V8 ${runner.v8}` : 'unknown')}</dd></div>
          <div><dt>Machine</dt><dd>${escapeHtml(runner ? `${runner.runnerOs} · ${runner.runnerArch} · ${runner.cpuCount} cores` : 'unknown')}</dd></div>
          <div><dt>CPU</dt><dd>${escapeHtml(runner?.cpuModel || 'unknown')}</dd></div>
        </dl>
      </section>
    </article>
  </main>
  <script src="../assets/docs-client.js"></script>
</body>
</html>`
}

function renderSuiteCard(report: BenchmarkReportFile): string {
  const comparison = report.comparison
  const status = comparison.geometricMeanPercent == null
    ? 'baseline'
    : comparison.geometricMeanPercent > 3
      ? 'faster'
      : comparison.geometricMeanPercent < -3
        ? 'slower'
        : 'stable'

  return `<a class="benchmark-kpi-card" data-package="${escapeHtml(packageId(report.suite.id))}" data-status="${status}" href="./benchmark-${escapeHtml(report.suite.id)}.html">
    <span>${escapeHtml(report.suite.label)}</span>
    <strong>${formatSignedPercent(comparison.geometricMeanPercent)}</strong>
    <em>${comparison.faster} faster · ${comparison.slower} slower · ${comparison.stable} stable</em>
  </a>`
}

function createFrameworkRows(report: BenchmarkReportFile): string[][] {
  const byCase = new Map<string, Map<string, NormalizedBenchmark>>()
  for (const row of report.current.benchmarks) {
    const parsed = parseAdapterBenchmark(row.name)
    if (!parsed) continue
    let adapters = byCase.get(parsed.caseId)
    if (!adapters) {
      adapters = new Map()
      byCase.set(parsed.caseId, adapters)
    }
    adapters.set(parsed.adapter, row)
  }

  const rows: string[][] = []
  for (const [caseId, adapters] of byCase) {
    const manual = adapters.get('manual.createElement')
    const manualHz = manual?.hz || 0
    for (const [adapter, row] of Array.from(adapters.entries()).sort((left, right) => right[1].hz - left[1].hz)) {
      rows.push([
        report.suite.label,
        caseId,
        adapter,
        formatNumber(row.hz),
        adapter === 'manual.createElement' || manualHz <= 0 ? 'control' : `${formatNumber((row.hz / manualHz) * 100, 2)}%`,
        formatNumber(row.meanMs, 5),
        `${formatNumber(row.runVariationPercent, 2)}%`,
        row.sparkline || '▁',
      ])
    }
  }
  return rows
}

function createBenchmarkRows(report: BenchmarkReportFile): string[][] {
  const deltas = new Map(report.comparison.deltas.map((delta) => [delta.id, delta]))
  return report.current.benchmarks.map((row) => {
    const delta = deltas.get(row.id)
    return [
      delta ? statusLabel(delta.status) : '🆕 added',
      report.suite.label,
      row.name,
      delta ? formatNumber(delta.previousHz) : '—',
      formatNumber(row.hz),
      delta ? formatSignedPercent(delta.absoluteHzDeltaPercent) : 'baseline',
      delta?.normalizedHzDeltaPercent == null ? '—' : formatSignedPercent(delta.normalizedHzDeltaPercent),
      delta ? `${formatNumber(delta.noiseFloorPercent, 2)}%` : '—',
      delta?.confidence ?? '—',
      formatNumber(row.meanMs, 5),
      `${formatNumber(row.coefficientOfVariationPercent, 2)}%`,
      row.sparkline || '▁',
    ]
  })
}

function renderTable(input: { className: string; columns: readonly string[]; rows: readonly string[][] }): string {
  const head = input.columns
    .map((column) => `<th scope="col" aria-sort="none"><button class="table-sort-button" type="button"><span class="table-sort-label">${escapeHtml(column)}</span><span class="table-sort-icon" aria-hidden="true"></span></button></th>`)
    .join('')
  const body = input.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('')
  return `<div class="table-wrap benchmark-table-wrap"><table class="gfm-table ${input.className}" data-sortable-table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
}

function parseAdapterBenchmark(name: string): { caseId: string; adapter: string } | null {
  const separator = name.lastIndexOf(' :: ')
  if (separator < 0) return null
  return { caseId: name.slice(0, separator), adapter: name.slice(separator + 4) }
}

function statusLabel(status: string): string {
  if (status === 'faster') return '🚀 faster'
  if (status === 'slower') return '🐢 slower'
  if (status === 'unstable') return '⚠️ noisy'
  if (status === 'control') return '🧭 control'
  return '🌿 stable'
}

function packageId(id: string): string {
  if (id.includes('fabrica')) return 'fabrica'
  if (id.includes('cipo')) return 'cipo'
  if (id.includes('broto')) return 'broto'
  return 'benchmark'
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'baseline'
  return `${value > 0 ? '+' : ''}${formatNumber(value, 2)}%`
}

function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
