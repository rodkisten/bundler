import { runtime } from '../runtime'
import type { RuntimeState } from '../types'
import { CipoCompileError, createCompileDiagnostic } from './diagnostics'

let generatedNamesByRuntime = new WeakMap<RuntimeState, Map<string, string>>()

/**
 * Registers a generated identifier in the active runtime/compiler session.
 *
 * @remarks
 * Registry state is scoped by `RuntimeState`, so compiler sessions do not leak
 * collision bookkeeping across builds and discarded sessions can be garbage-collected.
 */
export function assertGeneratedNameIdentity(name: string, canonicalInput: string): void {
  let generatedNames = generatedNamesByRuntime.get(runtime)
  if (!generatedNames) {
    generatedNames = new Map()
    generatedNamesByRuntime.set(runtime, generatedNames)
  }

  const existing = generatedNames.get(name)
  if (existing === undefined) {
    generatedNames.set(name, canonicalInput)
    return
  }
  if (existing === canonicalInput) return

  throw new CipoCompileError(createCompileDiagnostic(
    'CIPO_HASH_COLLISION',
    `Generated identifier ${JSON.stringify(name)} collided for two different compiler inputs.`,
    {},
    undefined,
    'Increase the hash width or provide a build namespace. Cipó refuses to emit ambiguous CSS.',
  ))
}

/** Clears collision registries. Intended for deterministic tests and explicit process-level resets. */
export function resetGeneratedNameRegistry(): void {
  generatedNamesByRuntime = new WeakMap()
}
