import { buildCss } from '../transform/index'
import type { CipoCssInterpolation } from '../types'
import { normalizeTemplateChunk } from './safety'

/** Builds a template source and applies lexical DSL protection exactly once. */
export function buildSafeSource(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
): string {
  return normalizeTemplateChunk(buildCss(strings, values))
}
