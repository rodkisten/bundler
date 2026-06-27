import type { BenchmarkSuiteDefinition } from './types'

export const BENCHMARK_SUITES: readonly BenchmarkSuiteDefinition[] = Object.freeze([
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
    description: 'Kitchen-sink DOM rendering and runtime API matrix with paired manual controls.',
  },
])
