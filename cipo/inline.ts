import type { CipoCssInterpolation, CipoInlineCssArtifact, CipoStyleObject } from '@rodkisten/cipo/types'
import { compileInlineCss, collectInlineCss } from '@rodkisten/cipo/compiler-inline-compile'

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
   */
  css: Object.assign(
    function inlineCss(first: TemplateStringsArray | CipoStyleObject, ...values: readonly CipoCssInterpolation[]): CipoInlineCssArtifact {
      return compileInlineCss(first, values, false)
    },
    {
      withImportant(first: TemplateStringsArray | CipoStyleObject, ...values: readonly CipoCssInterpolation[]): CipoInlineCssArtifact {
        return compileInlineCss(first, values, true)
      },
    },
  ),
}

export { collectInlineCss, compileInlineCss }
