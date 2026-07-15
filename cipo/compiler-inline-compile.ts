import { runtime, evictIfNeeded } from '@rodkisten/cipo/runtime'
import type { CipoAstNode, CipoCssInterpolation, CipoInlineCssArtifact, CipoStyleObject, CipoWarning } from '@rodkisten/cipo/types'
import { transformCss } from '@rodkisten/cipo/transform'
import { buildSafeSource } from '@rodkisten/cipo/safe-source'
import { parseStylesheet } from '@rodkisten/cipo/parser'
import { addImportant } from '@rodkisten/cipo/compiler-important'
import { createDeclaration } from '@rodkisten/cipo/utils'
import { formatInlineCss } from '@rodkisten/cipo/format'
import { styleObjectToCss } from '@rodkisten/cipo/style-object'

/** Compiles inline CSS with optional forced !important values. */
export function compileInlineCss(first: TemplateStringsArray | CipoStyleObject, values: readonly CipoCssInterpolation[], important: boolean): CipoInlineCssArtifact {
  const rawCss = Array.isArray(first) ? buildSafeSource(first as TemplateStringsArray, values) : styleObjectToCss(first as CipoStyleObject)
  const cacheKey = [runtime.configVersion, runtime.themeVersion, rawCss, important ? 'inline-important' : 'inline'].join('|')
  const cached = runtime.config.jit.enabled && runtime.config.jit.cache ? runtime.inlineCache.get(cacheKey) : undefined
  if (cached) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const cssText = formatInlineCss(collectInlineCss(ast, important))

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
}

/** Collects inline declarations from the top level of an AST. */
export function collectInlineCss(ast: readonly CipoAstNode[], forceImportant = false): string {
  let output = ''
  for (const node of ast) if (node.type === 'declaration') output += createDeclaration(node.property, forceImportant || runtime.config.important ? addImportant(node.value) : node.value)
  return output
}
