import type { RuntimeState } from '../types'

import type { CipoCompilerDiagnostic } from '../engine/diagnostics'
export type { CipoCompilerDiagnostic, CipoDiagnosticSeverity, CipoSourceLocation } from '../engine/diagnostics'

/**
 * Isolated state owned by one synchronous compiler session.
 *
 * @remarks
 * The runtime historically doubles as compiler state. A compiler context gives
 * build-time work its own cloned state so configuration, caches and registries do
 * not leak back into the live runtime or into the next module being compiled.
 */
export interface CipoCompilerContext {
  readonly id: string
  readonly state: RuntimeState
  readonly diagnostics: CipoCompilerDiagnostic[]
}

/** Options used when cloning a compiler context from a runtime baseline. */
export interface CreateCipoCompilerContextOptions {
  readonly id?: string
  readonly source?: RuntimeState
}
