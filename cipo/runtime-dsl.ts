import type { CipoWarning } from './types'
import { expandRuntimeColorUtilities } from './runtime-dsl/colors'
import { expandRuntimeDesignFeatures } from './runtime-dsl/features'
import { normalizeRuntimeVariableMath } from './runtime-dsl/math'
import { expandRuntimeMixinCalls, extractRuntimeMixins } from './runtime-dsl/mixins'
import { expandRuntimeMotion } from './runtime-dsl/motion'
import { expandResponsiveValueObjects } from './runtime-dsl/responsive'
import { expandRuntimeTokenObjects } from './runtime-dsl/tokens'

/**
 * Runtime-only Cipó design-language expansion coordinator.
 *
 * @remarks
 * Individual DSL concerns live in focused modules so variants, mixins, tokens,
 * color utilities and variable arithmetic can evolve and be tested independently.
 */
export function expandRuntimeDsl(input: string, warnings: CipoWarning[]): string {
  const responsiveInput = expandResponsiveValueObjects(input)
  const mixinState = extractRuntimeMixins(responsiveInput, warnings)
  let output = mixinState.source
  output = expandRuntimeTokenObjects(output, warnings)
  output = expandRuntimeMixinCalls(output, mixinState.mixins, warnings)
  output = expandRuntimeDesignFeatures(output, warnings)
  output = expandRuntimeMotion(output, warnings)
  output = expandRuntimeColorUtilities(output)
  output = normalizeRuntimeVariableMath(output)
  return output
}

export { createOklchUtilityColor } from './runtime-dsl/colors'
