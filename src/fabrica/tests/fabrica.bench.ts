/** @vitest-environment jsdom */

import { bench, describe } from 'vitest'
import {
  FABRICA_BENCHMARK_ADAPTERS,
  FABRICA_BENCHMARK_CASES,
  type FabricaBenchmarkAdapter,
} from './fabrica.bench-cases'

const BENCH_OPTIONS = {
  time: 300,
  warmupTime: 100,
  iterations: 10,
} as const

/**
 * Registers the full Fabrica rendering matrix for one adapter.
 *
 * To compare another framework later, implement FabricaBenchmarkAdapter and
 * append it to the array below. Stable case IDs keep historical JSON compatible.
 */
function registerAdapterBenchmarks(adapter: FabricaBenchmarkAdapter): void {
  describe(adapter.label, () => {
    for (let index = 0; index < FABRICA_BENCHMARK_CASES.length; index += 1) {
      const benchmarkCase = FABRICA_BENCHMARK_CASES[index]!
      bench(`${benchmarkCase.id} :: ${adapter.id}`, () => {
        adapter.run(benchmarkCase.id)
      }, BENCH_OPTIONS)
    }
  })
}

for (let index = 0; index < FABRICA_BENCHMARK_ADAPTERS.length; index += 1) {
  registerAdapterBenchmarks(FABRICA_BENCHMARK_ADAPTERS[index]!)
}
