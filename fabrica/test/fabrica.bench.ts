/** @vitest-environment jsdom */

import { bench, describe } from 'vitest'
import {
  FABRICA_BENCHMARK_ADAPTERS,
  FABRICA_BENCHMARK_CASES,
} from './fabrica.bench-cases'

const BENCH_OPTIONS = {
  time: 300,
  warmupTime: 100,
  iterations: 10,
} as const

/**
 * Registers one flat comparison matrix instead of one suite per adapter.
 *
 * @remarks
 * Vitest benchmark mode can retain JSDOM worker state while moving between
 * multiple top-level benchmark groups. Keeping all adapters in one group makes
 * the runner deterministic and allows future React/Preact/Solid adapters to be
 * added without multiplying worker lifecycles. Stable benchmark names continue
 * to encode both the case and adapter IDs for JSON history and reports.
 */
describe('Fabrica paired benchmark matrix', () => {
  for (let caseIndex = 0; caseIndex < FABRICA_BENCHMARK_CASES.length; caseIndex += 1) {
    const benchmarkCase = FABRICA_BENCHMARK_CASES[caseIndex]!

    for (let adapterIndex = 0; adapterIndex < FABRICA_BENCHMARK_ADAPTERS.length; adapterIndex += 1) {
      const adapter = FABRICA_BENCHMARK_ADAPTERS[adapterIndex]!
      bench(`${benchmarkCase.id} :: ${adapter.id}`, () => {
        adapter.run(benchmarkCase.id)
      }, BENCH_OPTIONS)
    }
  }
})
