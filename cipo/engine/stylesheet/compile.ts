import { configureFromCss } from '../../config-css'
import { splitPolymorphicCssSource } from '../../css-mode'
import { runtime } from '../../runtime'
import { parseStylesheet } from '../../syntax/parser'
import { transformCss } from '../../transform/index'
import { buildSafeSource } from '../../transform/source'
import type { CipoAstNode, CipoCssInterpolation, CipoCssResult, CipoStylesheetArtifact, CipoWarning } from '../../types'
import { hashString64 } from '../../utils'
import { createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from '../cache'
import { compileStylesheetText } from './emitter'
import { formatStylesheetText } from './format'
import { hasTopLevelLooseStatements, isStylesheetRootBlock } from './selectors'

export { compileCss, compileScopedRule } from '../emitter'
export { createArtifactCacheKey, getCachedArtifact, setCachedArtifact } from '../cache'
export { compileStylesheetText } from './emitter'
export { formatStylesheetText } from './format'

/** Compiles explicit full stylesheet CSS. */
export function compileSheetCss(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
  important: boolean,
): CipoStylesheetArtifact {
  const sourceCss = buildSafeSource(strings, values)
  const prepared = prepareSheetSource(sourceCss)
  const cacheKey = createArtifactCacheKey(prepared.css, important ? 'sheet-important' : 'sheet')
  const cached = getCachedArtifact(cacheKey)
  if (cached && isStylesheetArtifactLike(cached)) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(prepared.css, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createStylesheetArtifact(prepared.css, transformedCss, ast, warnings, important)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}

/** Compiles a stylesheet wrapped in a scope selector. */
export function compileScopedSheetCss(
  selector: string,
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
  important: boolean,
): CipoStylesheetArtifact {
  const sourceCss = buildSafeSource(strings, values)
  const prepared = prepareSheetSource(sourceCss)
  const scopedSource = `${selector}{${prepared.css}}`
  const cacheKey = createArtifactCacheKey(scopedSource, important ? 'sheet-scoped-important' : 'sheet-scoped')
  const cached = getCachedArtifact(cacheKey)
  if (cached && isStylesheetArtifactLike(cached)) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(scopedSource, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createStylesheetArtifact(prepared.css, transformedCss, ast, warnings, important)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}

/** Wraps a stylesheet artifact in a named cascade layer. */
export function wrapSheetLayer(name: string, artifact: CipoStylesheetArtifact): CipoStylesheetArtifact {
  const safeName = String(name || 'components').replace(/[^a-zA-Z0-9_.-]/g, '')
  const cssText = formatStylesheetText(`@layer ${safeName}{${artifact.cssText}}`)
  return {
    ...artifact,
    cssText,
    debug: { ...artifact.debug, mode: 'stylesheet' as const },
    toString: () => cssText,
    [Symbol.toPrimitive]: () => cssText,
  }
}

/** Creates a full stylesheet artifact from an already parsed AST. */
export function createStylesheetArtifact(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
  warnings: readonly CipoWarning[],
  forceImportant = false,
): CipoStylesheetArtifact {
  const cssText = compileStylesheetText(ast, forceImportant)
  const artifactId = `${runtime.config.prefix}-stylesheet-${hashString64(rawCss)}`
  return {
    kind: 'cipo.stylesheet',
    rawCss,
    transformedCss,
    cssText,
    debug: { id: artifactId, ast, warnings, mode: 'stylesheet' },
    toString: () => cssText,
    [Symbol.toPrimitive]: () => cssText,
    [Symbol.toStringTag]: 'CipoStylesheetArtifact',
  }
}

/** Decides whether a polymorphic source should compile as a full stylesheet. */
export function shouldCompileAsStylesheet(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
): boolean {
  if (!transformedCss.trim() || hasTopLevelLooseStatements(rawCss) || ast.length === 0) return false
  return ast.every((node) => node.type === 'block' && isStylesheetRootBlock(node))
}

/** Injects compiled stylesheet text into a specific DOM/style root. */
export function injectSheetInto(
  target: HTMLElement | ShadowRoot | Document,
  cssText: string,
): HTMLStyleElement {
  const parent = target instanceof Document ? target.head : target
  const element = document.createElement('style')
  element.dataset.cipoSheet = 'true'
  element.textContent = cssText
  parent.append(element)
  return element
}

function prepareSheetSource(sourceCss: string): { readonly css: string } {
  const source = splitPolymorphicCssSource(sourceCss)
  if (source.configCss) configureFromCss(source.configCss)
  return { css: source.css }
}

function isStylesheetArtifactLike(artifact: CipoCssResult): artifact is CipoStylesheetArtifact {
  return Boolean(artifact && 'kind' in artifact && artifact.kind === 'cipo.stylesheet')
}
