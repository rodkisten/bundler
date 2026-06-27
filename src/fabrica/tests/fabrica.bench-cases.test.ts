/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import {
  FABRICA_BENCHMARK_ADAPTERS,
  FABRICA_BENCHMARK_CASES,
} from './fabrica.bench-cases'

describe('Fabrica benchmark case integrity', () => {
  it('keeps case identifiers unique and stable', () => {
    const ids = FABRICA_BENCHMARK_CASES.map((benchmarkCase) => benchmarkCase.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('executes every adapter/case pair once without leaking mounted DOM', () => {
    for (const benchmarkCase of FABRICA_BENCHMARK_CASES) {
      for (const adapter of FABRICA_BENCHMARK_ADAPTERS) {
        expect(() => adapter.run(benchmarkCase.id)).not.toThrow()
      }
    }

    expect(document.body.childElementCount).toBe(0)
  })
})
