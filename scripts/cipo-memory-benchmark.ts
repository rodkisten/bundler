import { Session } from 'node:inspector'
import { performance } from 'node:perf_hooks'
import { atomic, css, sheet } from '../src/cipo/src/index'
import { invalidateCssConfigApplications } from '../src/cipo/src/config-css'
import { clearPolymorphicTemplateCache } from '../src/cipo/src/css'
import { clearPolymorphicDetectionCache } from '../src/cipo/src/compiler/detect-mode'
import { clearJitCaches } from '../src/cipo/src/runtime'
import {
  ATOMIC_CASE,
  CONFIG_CASE,
  SHEET_CASE,
  setupBenchCipo,
} from '../src/cipo/tests/cipo.bench-cases'

type SamplingNode = {
  readonly selfSize: number
  readonly children?: readonly SamplingNode[]
}

type SamplingProfile = {
  readonly head: SamplingNode
}

type MemoryRow = {
  readonly name: string
  readonly iterations: number
  readonly nsPerOperation: number
  readonly sampledBytesPerOperation: number
  readonly heapGrowthPerOperation: number
  readonly retainedBytesPerOperation: number
}

const WARM_ITERATIONS = readPositiveInteger('CIPO_MEMORY_WARM_ITERATIONS', 25_000)
const COLD_ITERATIONS = readPositiveInteger('CIPO_MEMORY_COLD_ITERATIONS', 1_000)
const SAMPLING_INTERVAL = readPositiveInteger('CIPO_MEMORY_SAMPLING_INTERVAL', 1_024)

const ATOMIC_TEMPLATE = createTemplate(ATOMIC_CASE)
const SHEET_TEMPLATE = createTemplate(SHEET_CASE)
const CONFIG_TEMPLATE = createTemplate(CONFIG_CASE)
let sink = 0

async function main(): Promise<void> {
  const rows: MemoryRow[] = []

  rows.push(
    await measureMemory('warm atomic cache hit', WARM_ITERATIONS, () => {
      consume(atomic.css(ATOMIC_TEMPLATE))
    }, () => {
      setupBenchCipo()
      atomic.css(ATOMIC_TEMPLATE)
    }),
  )

  rows.push(
    await measureMemory('warm polymorphic sheet identity hit', WARM_ITERATIONS, () => {
      consume(css(SHEET_TEMPLATE))
    }, () => {
      setupBenchCipo()
      css(SHEET_TEMPLATE)
    }),
  )

  rows.push(
    await measureMemory('warm prepared configure plan hit', WARM_ITERATIONS, () => {
      consume(css(CONFIG_TEMPLATE))
    }, () => {
      setupBenchCipo()
      css(CONFIG_TEMPLATE)
    }),
  )

  rows.push(
    await measureMemory('cold atomic transform + compile', COLD_ITERATIONS, () => {
      clearJitCaches()
      consume(atomic.css(ATOMIC_TEMPLATE))
    }, setupBenchCipo),
  )

  rows.push(
    await measureMemory('cold sheet transform + compile', COLD_ITERATIONS, () => {
      clearJitCaches()
      consume(sheet.css(SHEET_TEMPLATE))
    }, setupBenchCipo),
  )

  rows.push(
    await measureMemory('cold configure parse + apply', COLD_ITERATIONS, () => {
      clearJitCaches()
      clearPolymorphicTemplateCache()
      clearPolymorphicDetectionCache()
      invalidateCssConfigApplications({ clearPlans: true })
      consume(css(CONFIG_TEMPLATE))
    }, setupBenchCipo),
  )

  printRows(rows)
  if (sink === Number.MIN_SAFE_INTEGER) console.log('unreachable', sink)
}

async function measureMemory(
  name: string,
  iterations: number,
  operation: () => void,
  prepare: () => void,
): Promise<MemoryRow> {
  prepare()
  for (let index = 0; index < Math.min(100, iterations); index += 1) operation()
  forceGc()

  const before = process.memoryUsage().heapUsed
  const session = new Session()
  session.connect()

  try {
    await post(session, 'HeapProfiler.enable')
    await post(session, 'HeapProfiler.startSampling', { samplingInterval: SAMPLING_INTERVAL })

    const startedAt = performance.now()
    for (let index = 0; index < iterations; index += 1) operation()
    const elapsedMs = performance.now() - startedAt
    const afterOperations = process.memoryUsage().heapUsed

    const response = await post<{ profile: SamplingProfile }>(session, 'HeapProfiler.stopSampling')
    forceGc()
    const afterGc = process.memoryUsage().heapUsed
    const sampledBytes = sumSampledBytes(response.profile.head)

    return {
      name,
      iterations,
      nsPerOperation: (elapsedMs * 1_000_000) / iterations,
      sampledBytesPerOperation: sampledBytes / iterations,
      heapGrowthPerOperation: Math.max(0, afterOperations - before) / iterations,
      retainedBytesPerOperation: Math.max(0, afterGc - before) / iterations,
    }
  } finally {
    session.disconnect()
  }
}

function post<T = Record<string, never>>(
  session: Session,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    session.post(method, params ?? {}, (error, result) => {
      if (error) reject(error)
      else resolve(result as T)
    })
  })
}

function sumSampledBytes(node: SamplingNode): number {
  let total = node.selfSize || 0
  const children = node.children ?? []
  for (let index = 0; index < children.length; index += 1) {
    total += sumSampledBytes(children[index]!)
  }
  return total
}

function forceGc(): void {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc
  gc?.()
  gc?.()
}

function consume(value: unknown): void {
  sink = (sink + String(value).length) | 0
}

function createTemplate(source: string): TemplateStringsArray {
  const cooked = [source] as unknown as TemplateStringsArray & { raw: readonly string[] }
  Object.defineProperty(cooked, 'raw', { value: Object.freeze([source]) })
  return Object.freeze(cooked)
}

function readPositiveInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function printRows(rows: readonly MemoryRow[]): void {
  console.log('')
  console.log('Cipó allocation and heap profile')
  console.log('')
  console.log('| Scenario | Iterations | ns/op | sampled B/op | observed heap B/op | retained B/op |')
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |')

  for (const row of rows) {
    console.log(
      `| ${row.name} | ${row.iterations.toLocaleString('en-US')} | ${formatNumber(row.nsPerOperation)} | ${formatNumber(row.sampledBytesPerOperation)} | ${formatNumber(row.heapGrowthPerOperation)} | ${formatNumber(row.retainedBytesPerOperation)} |`,
    )
  }

  console.log('')
  console.log(`Sampling interval: ${SAMPLING_INTERVAL.toLocaleString('en-US')} bytes. Heap values are process-level observations, not exact per-object sizes.`)
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

void main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
