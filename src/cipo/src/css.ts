import { runtime, evictIfNeeded } from './runtime'
import type { CipoCssArtifact, CipoCssInterpolation, CipoWarning } from './types'
import { buildCss, transformCss } from './transform'
import { parseStylesheet } from './parser'
import { collectRules, compileCss, joinClassNames } from './compiler'
import { insertCss } from './injection'
import { hashString } from './utils'

/**
 * Main CSS tagged template that compiles semantic Cipó CSS into atomic classes.
 *
 * @remarks
 * This function keeps the old `css`` ` API intact while supporting the new
 * grammar: property aliases (`px: 4`), standalone aliases (`glass;`), `$token`
 * inference, helper functions (`alpha`, `gradient`, `fluid`) and runtime JIT.
 *
 * @param strings - Template strings.
 * @param values - Template interpolations.
 * @returns CSS artifact whose string value is its class list.
 *
 * @example
 * ```ts
 * const card = css`
 *   glass;
 *   px: 4;
 *   py: 3;
 *   bg: $panel;
 *   rounded: $xl;
 *
 *   x:hover {
 *     bg: alpha($brand / 18%);
 *   }
 * `
 *
 * String(card)
 * // 'cipo-s-abc cipo-a-def cipo-a-ghi ...'
 * ```
 *
 * Output CSS:
 * ```css
 * @layer cipo.atomic {
 *   .cipo-a-def {
 *     padding-inline: calc(var(--cipo-spacing, 0.25rem) * 4);
 *   }
 * }
 * ```
 */
export function css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssArtifact {
  const rawCss = buildCss(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss)
  const cached = runtime.config.jit.enabled && runtime.config.jit.cache ? runtime.artifactCache.get(cacheKey) : undefined
  if (cached) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const scopeClassName = `${runtime.config.prefix}-s-${hashString(transformedCss)}`
  const { atoms, scopedRules } = collectRules(ast, scopeClassName, warnings)
  const className = joinClassNames(atoms, scopedRules.length > 0 ? scopeClassName : '')
  const compiledCss = compileCss(atoms, scopedRules)
  const artifactId = `${runtime.config.prefix}-artifact-${hashString(rawCss)}`

  const artifact: CipoCssArtifact = {
    kind: 'cipo.css',
    className,
    scopeClassName,
    atoms,
    scopedRules,
    rawCss,
    transformedCss,
    compiledCss,
    debug: { id: artifactId, ast, atoms, scopedRules, warnings },
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: 'CipoCssArtifact',
  }

  insertCss(compiledCss)

  if (runtime.config.jit.enabled && runtime.config.jit.cache) {
    runtime.artifactCache.set(cacheKey, artifact)
    evictIfNeeded(runtime.artifactCache as Map<string, unknown>)
  }

  return artifact
}

/**
 * Creates the JIT cache key for a CSS artifact.
 *
 * @param rawCss - Raw source.
 * @returns Stable cache key.
 */
export function createArtifactCacheKey(rawCss: string): string {
  return [runtime.configVersion, runtime.themeVersion, runtime.config.prefix, runtime.config.important ? 'important' : '', runtime.config.minify ? 'min' : 'pretty', rawCss].join('|')
}
