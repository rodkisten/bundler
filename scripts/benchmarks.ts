import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { DIST_DIR, ROOT_DIR } from './config'
import { benchmark, reset, setup, sheet, atomic } from '../src/cipo/src/index'

const OUT_DIR = path.join(ROOT_DIR, 'artifacts', 'benchmarks')
const DIST_BENCHMARK_DIR = path.join(DIST_DIR, 'pipeline')

type BenchmarkRow = {
  name: string
  iterations: number
  totalMs: number
  averageMs: number
}

async function main(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true })

  reset()
  setup({
    prefix: 'bench',
    minify: true,
    layers: false,
    rem: { enabled: true, baseFontSize: 16 },
    theme: {
      colors: { brand: '#f97316', panel: '#020617', ink: '#f8fafc' },
      spacing: '0.25rem',
      radius: { md: '12px', xl: '24px' },
    },
  })

  const rows: BenchmarkRow[] = []
  rows.push(toRow('cipo.atomic.basic', benchmark('px: 4\npy: 2\nbg: $brand\ncolor: color-amber-245', 250, 'atomic')))
  rows.push(toRow('cipo.sheet.nested', benchmark('.card { bg: alpha($panel / 72%)\n border: 1px solid alpha($ink / 12%)\n x:hover { bg: alpha($brand / 20%) } x:md { px: 6 } }', 150, 'stylesheet')))

  const runtimeSource = `
    :root {
      $dock(radius: 14px, size: (sm: 4px, md: 1rem))
      $$iconWrapSize: 16px
      $$iconSize: $$iconWrapSize - 1px
      $$glass(c: color, b: length) {
        py: *b
        color-amber-245
        bg-*c-235
      }
    }
    .card { glass(amber, 4) }
  `

  const startedAt = performance.now()
  for (let index = 0; index < 120; index += 1) String(sheet.css([runtimeSource] as unknown as TemplateStringsArray))
  const totalMs = performance.now() - startedAt
  rows.push({ name: 'cipo.sheet.runtime-dsl', iterations: 120, totalMs, averageMs: totalMs / 120 })

  const markdown = renderMarkdown(rows)
  const json = JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)

  await fs.writeFile(path.join(OUT_DIR, 'benchmarks.json'), json)
  await fs.writeFile(path.join(OUT_DIR, 'benchmarks.md'), markdown)

  try {
    await fs.mkdir(DIST_BENCHMARK_DIR, { recursive: true })
    await fs.writeFile(path.join(DIST_BENCHMARK_DIR, 'benchmarks.json'), json)
    await fs.writeFile(path.join(DIST_BENCHMARK_DIR, 'benchmarks.md'), markdown)
  } catch {
    // dist is created by the build script. Local benchmark runs should still succeed before build.
  }

  console.log(markdown)
}

function toRow(name: string, timing: { iterations: number; totalMs: number; averageMs: number }): BenchmarkRow {
  return {
    name,
    iterations: timing.iterations,
    totalMs: round(timing.totalMs),
    averageMs: round(timing.averageMs),
  }
}

function renderMarkdown(rows: readonly BenchmarkRow[]): string {
  let output = '## ⚡ Runtime Benchmarks\n\n'
  output += '| Benchmark | Iterations | Total ms | Avg ms |\n'
  output += '| --- | ---: | ---: | ---: |\n'
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    output += `| ${row.name} | ${row.iterations} | ${row.totalMs} | ${row.averageMs} |\n`
  }
  return output
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

void main()
