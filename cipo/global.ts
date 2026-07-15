import type { CipoCssArtifact, CipoCssInterpolation, CipoInjectStyleOptions, CipoInlineCssArtifact } from '@rodkisten/cipo/types'
import { buildCss, transformCss } from '@rodkisten/cipo/transform'
import { insertCss, injectStyle, getCssText } from '@rodkisten/cipo/injection'
import { wrapLayer, formatCss } from '@rodkisten/cipo/format'
import { runtime } from '@rodkisten/cipo/runtime'
import { addImportant } from '@rodkisten/cipo/compiler-index'
import { parseDeclarations } from '@rodkisten/cipo/parser'

/**
 * Injects global CSS while keeping the old overload behavior.
 *
 * @param strings - Template strings.
 * @param values - Template interpolations.
 * @returns Compiled CSS.
 */
export function injectGlobal(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): string
export function injectGlobal(options: { readonly important?: boolean; readonly layer?: false | import('@rodkisten/cipo/types').CipoLayerName }, cssText: string): string
export function injectGlobal(artifact: CipoCssArtifact, ...artifacts: readonly CipoCssArtifact[]): string
export function injectGlobal(first: TemplateStringsArray | { readonly important?: boolean; readonly layer?: false | import('@rodkisten/cipo/types').CipoLayerName } | CipoCssArtifact, ...values: readonly (CipoCssInterpolation | CipoCssArtifact | string)[]): string {
  let rawCss = ''
  let important = runtime.config.important
  let layer: false | import('@rodkisten/cipo/types').CipoLayerName = 'global'

  if (isCssArtifact(first)) {
    rawCss = [first, ...values.filter(isCssArtifact)].map(artifact => artifact.compiledCss).join('\n')
  } else if (!Array.isArray(first) && typeof first === 'object' && ('important' in first || 'layer' in first)) {
    important = first.important ?? important
    layer = first.layer ?? layer
    rawCss = String(values[0] ?? '')
  } else {
    rawCss = buildCss(first as TemplateStringsArray, values as readonly CipoCssInterpolation[])
  }

  const transformed = transformCss(rawCss, [])
  const compiled = layer ? wrapLayer(layer, formatCss(important ? addImportantToCssText(transformed) : transformed)) : formatCss(transformed)
  insertCss(compiled)
  return compiled
}

/**
 * Adds !important to plain declaration rules.
 *
 * @param cssText - CSS source.
 * @returns CSS with important values.
 */
export function addImportantToCssText(cssText: string): string {
  return cssText.replace(/([^{}]+)\{([^{}]+)\}/g, (_match, selector: string, body: string) => {
    const declarations = parseDeclarations(body, [])
    const next = declarations.filter(node => node.type === 'declaration').map(node => `${node.property}:${addImportant(node.value)};`).join('')
    return `${selector}{${next}}`
  })
}

export { injectStyle, getCssText }

function isCssArtifact(value: unknown): value is CipoCssArtifact {
  return typeof value === 'object' && value !== null && (value as CipoCssArtifact | CipoInlineCssArtifact).kind === 'cipo.css'
}
