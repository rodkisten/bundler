import { runtime, evictIfNeeded } from '../runtime'
import type { CipoAstNode, CipoCssInterpolation, CipoInlineCssArtifact, CipoStyleObject, CipoWarning } from '../types'
import { buildCss, transformCss } from '../transform'
import { parseStylesheet } from '../parser'
import { addImportant } from './important'
import { createDeclaration } from '../utils'
import { formatInlineCss } from '../format'
import { styleObjectToCss } from '../style-object'

/** Compiles inline CSS with optional forced !important values. */
export function compileInlineCss(first: TemplateStringsArray | CipoStyleObject, values: readonly CipoCssInterpolation[], important: boolean): CipoInlineCssArtifact {
  const rawCss = Array.isArray(first) ? buildCss(first as TemplateStringsArray, values) : styleObjectToCss(first as CipoStyleObject)
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
