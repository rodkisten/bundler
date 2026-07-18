import { createStyledFactory, type ElementsComponent, type ElementsComponentRegistry, type ElementsRecord, type ElementsResolvedStyle, type StyledBuilder, type StyledComponent, type StyledDomResult, type StyledFactory, type StyledFactoryRegistry, type StyledRegistryCollision, type StyledTagFactory } from '@rodkisten/fabrica-elements'
import type { CipoCssArtifact, CipoCssInterpolation, CipoCssResult } from './types'
import { compileStyledCss } from './css'
import { insertCss } from './injection'
import { inlineCssTextToObject, needsObjectStyleAdapter, resolveElementsAdapter } from './elements-style-adapter'

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
export type CipoStyledRegistry = StyledFactoryRegistry<CipoCssResult> & {
  /** Atomic/component CSS artifacts collected from every styled component created by this factory. */
  readonly cssArtifacts: readonly CipoCssArtifact[]
}

export type CipoCallableRuntime = StyledFactory<CipoCssResult> & {
  readonly registry: CipoStyledRegistry
}

/** Options for a styled factory bound to one Fabrica instance/registry. */
export type CipoStyledFactoryOptions = {
  readonly fabrica?: ElementsComponentRegistry
  readonly registry?: ElementsComponentRegistry
  readonly autoRegister?: boolean
  readonly collision?: StyledRegistryCollision
  readonly onWarning?: (message: string) => void
}

/**
 * Creates Cipó's styled-component-compatible callable API.
 *
 * @remarks
 * Each factory owns an independent registry bridge and tag cache. Passing a
 * Fabrica instance binds named styled components to that instance's registry
 * without mutating the default global styled factory.
 *
 * @returns Cipó callable API.
 */
export function createCipoCallable(options: CipoStyledFactoryOptions = {}): CipoCallableRuntime {
  const factory = createStyledFactory<CipoCssResult>({
    adapter: resolveElementsAdapter,
    autoRegister: options.autoRegister ?? true,
    collision: options.collision ?? 'warn',
    registry: options.registry ?? options.fabrica,
    onWarning: options.onWarning,
    createStyle(strings, values) {
      const artifact = compileStyledCss(strings, values as readonly CipoCssInterpolation[])
      return { artifact, className: artifact.className }
    },
    resolveStyle(input) {
      return resolveCipoStyleInput(input)
    },
  })

  let lastArtifacts: readonly CipoCssResult[] | undefined
  let lastCssArtifacts: readonly CipoCssArtifact[] = Object.freeze([])
  Object.defineProperty(factory.registry, 'cssArtifacts', {
    configurable: false,
    enumerable: true,
    get() {
      const artifacts = factory.registry.artifacts
      if (artifacts !== lastArtifacts) {
        lastArtifacts = artifacts
        lastCssArtifacts = Object.freeze(artifacts.filter(isCipoCssArtifact))
      }
      return lastCssArtifacts
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

function isCipoCssArtifact(artifact: CipoCssResult): artifact is CipoCssArtifact {
  return Boolean(artifact && typeof artifact === 'object' && 'kind' in artifact && artifact.kind === 'cipo.css')
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
