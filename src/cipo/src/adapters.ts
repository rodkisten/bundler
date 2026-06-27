import { createStyledFactory, type ElementsAdapter, type ElementsAdapterName, type ElementsComponent, type ElementsRecord, type ElementsResolvedStyle, type StyledBuilder, type StyledComponent, type StyledDomResult, type StyledFactory, type StyledTagFactory } from '../../fabrica-elements'
import type { CipoComponent, CipoCssInterpolation, CipoCssResult, CipoDomStyledResult, CipoRecord, CipoStyledBuilder, CipoStyledTagFactory, CipoTarget } from './types'
import { assertAtomicCssArtifact, css } from './css'
import { runtime } from './runtime'
import { insertCss } from './injection'

/**
 * Callable styled API exposed by Cipó.
 *
 * @remarks
 * The implementation is delegated to `fabrica-elements` so Cipó no longer owns
 * DOM/component creation. Cipó remains responsible only for compiling CSS into
 * a class list and validating that `css`` ` was used in atomic/component mode.
 *
 * @example DOM tag factory
 * ```ts
 * const Button = cipo.button.css`
 *   px: 4;
 *   bg: $brand;
 * `
 *
 * const button = Button({ children: 'Save' })
 * ```
 *
 * @example Existing element
 * ```ts
 * const element = document.createElement('div')
 * const styled = cipo(element).css`color:red;`
 * console.log(styled.element === element)
 * // true
 * ```
 */
export type CipoCallableRuntime = StyledFactory<CipoCssResult>


/**
 * Creates Cipó's styled-component-compatible callable API.
 *
 * @returns Cipó callable API.
 */
export function createCipoCallable(): CipoCallableRuntime {
  const factory = createStyledFactory<CipoCssResult>({
    adapter: resolveElementsAdapter,
    autoRegister: true,
    collision: 'warn',
    createStyle(strings, values) {
      const artifact = assertAtomicCssArtifact(css(strings, ...(values as readonly CipoCssInterpolation[])))
      return { artifact, className: artifact.className }
    },
    resolveStyle(input) {
      return resolveCipoStyleInput(input)
    },
  })

  return factory as unknown as CipoCallableRuntime
}


/**
 * Resolves every result produced by Cipó's polymorphic css API.
 *
 * @remarks
 * Atomic artifacts contribute classes, inline artifacts contribute the style
 * prop, and stylesheet artifacts are injected once through Cipó's deduping
 * runtime sink. CSS-first configuration results are valid no-op style inputs.
 */
function resolveCipoStyleInput(input: unknown): ElementsResolvedStyle<CipoCssResult> {
  if (!input || typeof input !== 'object') {
    throw new TypeError('[Cipó] styled() expected a Cipó CSS artifact, class string, array or style function.')
  }

  const artifact = input as CipoCssResult
  if ('kind' in artifact && artifact.kind === 'cipo.css') {
    return { className: artifact.className, artifact }
  }

  if ('kind' in artifact && artifact.kind === 'cipo.inline-css') {
    return {
      className: '',
      artifact,
      style: needsObjectStyleAdapter() ? inlineCssTextToObject(artifact.cssText) : artifact,
    }
  }

  if ('kind' in artifact && artifact.kind === 'cipo.stylesheet') {
    insertCss(artifact.cssText)
    return { className: '', artifact }
  }

  if ('config' in artifact && 'theme' in artifact) {
    return { className: '', artifact }
  }

  throw new TypeError('[Cipó] styled() received an unknown style artifact.')
}

function needsObjectStyleAdapter(): boolean {
  return runtime.config.adapter === 'react' || runtime.config.adapter === 'preact'
}

/** Converts inline declaration text into a React/Preact-compatible style object. */
function inlineCssTextToObject(cssText: string): ElementsRecord {
  const output: ElementsRecord = {}
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index <= cssText.length; index += 1) {
    const char = cssText[index] ?? ';'

    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }

    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') { depth += 1; continue }
    if (char === ')' || char === ']') { depth = Math.max(0, depth - 1); continue }
    if (char !== ';' || depth !== 0) continue

    const declaration = cssText.slice(start, index).trim()
    start = index + 1
    if (!declaration) continue
    const colon = declaration.indexOf(':')
    if (colon <= 0) continue
    const property = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    if (property && value) output[toStylePropertyName(property)] = value
  }

  return output
}

function toStylePropertyName(property: string): string {
  if (property.startsWith('--')) return property
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/**
 * Resolves the current Cipó adapter into the shared Fabrica Elements adapter
 * format.
 *
 * @remarks
 * Custom Cipó adapters already follow the same contract, so they are passed
 * through structurally. Built-in string names are resolved by Fabrica Elements.
 *
 * @returns Adapter name or adapter object.
 */
function resolveElementsAdapter(): ElementsAdapterName | ElementsAdapter {
  return runtime.config.adapter as ElementsAdapterName | ElementsAdapter
}

/** Compatibility aliases for older internal imports. */
export type {
  ElementsComponent as CipoElementsComponent,
  ElementsRecord as CipoElementsRecord,
  StyledBuilder,
  StyledComponent,
  StyledDomResult,
  StyledTagFactory,
}
