import { runtime, evictIfNeeded } from './runtime'
import type { CipoCssInterpolation, CipoInlineCssArtifact, CipoStyleObject, CipoWarning } from './types'
import { buildCss, transformCss } from './transform'
import { parseStylesheet } from './parser'
import { createDeclaration } from './utils'
import { formatInlineCss } from './format'
import { styleObjectToCss } from './style-object'

/**
 * Inline CSS namespace.
 *
 * @remarks
 * The preferred API is `inline.css``...`` ` instead of `css.inline``...`` ` so
 * editors keep CSS template literal highlighting without overloading `css`.
 */
export const inline = {
  /**
   * Compiles template or object styles into inline declaration text.
   *
   * @param first - Template strings or style object.
   * @param values - Template values.
   * @returns Inline CSS artifact.
   *
   * @example
   * ```ts
   * const style = inline.css`
   *   px: 2;
   *   color: saturate($primary, 20%);
   *   bg: alpha($brand / 14%);
   * `
   *
   * String(style)
   * // 'padding-inline: calc(...); color: ...; background: ...;'
   * ```
   *
   * @example
   * ```ts
   * inline.css({ px: 2, bg: '$brand' })
   * ```
   */
  css(first: TemplateStringsArray | CipoStyleObject, ...values: readonly CipoCssInterpolation[]): CipoInlineCssArtifact {
    const rawCss = Array.isArray(first) ? buildCss(first as TemplateStringsArray, values) : styleObjectToCss(first as CipoStyleObject)
    const cacheKey = [runtime.configVersion, runtime.themeVersion, rawCss, 'inline'].join('|')
    const cached = runtime.config.jit.enabled && runtime.config.jit.cache ? runtime.inlineCache.get(cacheKey) : undefined
    if (cached) return cached

    const warnings: CipoWarning[] = []
    const transformedCss = transformCss(rawCss, warnings)
    const ast = parseStylesheet(transformedCss, warnings)
    const cssText = formatInlineCss(collectInlineCss(ast))

    const artifact: CipoInlineCssArtifact = {
      kind: 'cipo.inline-css',
      rawCss,
      transformedCss,
      cssText,
      toString: () => cssText,
      [Symbol.toPrimitive]: () => cssText,
      [Symbol.toStringTag]: 'CipoInlineCssArtifact',
    }

    if (runtime.config.jit.enabled && runtime.config.jit.cache) {
      runtime.inlineCache.set(cacheKey, artifact)
      evictIfNeeded(runtime.inlineCache as Map<string, unknown>)
    }

    return artifact
  },
}

/**
 * Collects inline declarations from the top level of an AST.
 *
 * @param ast - Parsed AST.
 * @returns CSS declaration list.
 */
export function collectInlineCss(ast: readonly import('./types').CipoAstNode[]): string {
  let output = ''

  for (const node of ast) {
    if (node.type === 'declaration') output += createDeclaration(node.property, node.value)
  }

  return output
}
