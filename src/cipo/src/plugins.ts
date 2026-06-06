import { runtime } from './runtime'
import type { CipoAliasValue, CipoHelper, CipoRecipeDefinition, CipoStyleObject, PropertyAliasDefinition } from './types'
import { css } from './css'
import { styleObjectToCss } from './style-object'

/**
 * Registers a helper function available in CSS values.
 *
 * @remarks
 * Helpers are value-level functions: `alpha(...)`, `gradient(...)`,
 * `outlineGlow(...)`, `fluid(...)`. They are evaluated by the scanner and can be
 * nested inside aliases, inline CSS and normal CSS declarations.
 *
 * @param name - Helper name used in CSS.
 * @param helper - Helper resolver.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * registerHelper('outlineGlow', (args, ctx) => {
 *   return `0 0 0 3px ${ctx.resolveValue(`alpha(${args || '$brand'} / 25%)`)}`
 * })
 *
 * css`
 *   box-shadow: outlineGlow($brand);
 * `
 * ```
 */
export function registerHelper(name: string, helper: CipoHelper): void {
  runtime.helperRegistry.set(name, helper)
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
}

/**
 * Registers a standalone identifier alias.
 *
 * @remarks
 * Aliases are declaration-level macros. They let the new Cipó API keep the old
 * `@with(bg(...), px(...))` speed without requiring parentheses:
 *
 * `glass; buttonBase; interactive;`
 *
 * @param name - Identifier used in CSS.
 * @param value - CSS string, style object or lazy factory.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * registerAlias('glass', `
 *   bg: alpha($panel / 72%);
 *   border: 1px solid alpha($ink / 12%);
 *   backdrop-filter: blur(16px);
 * `)
 *
 * css`
 *   glass;
 *   rounded: $xl;
 * `
 * ```
 */
export function registerAlias(name: string, value: CipoAliasValue): void {
  runtime.aliasRegistry.set(name, value)
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
}

/**
 * Registers or overrides a property alias.
 *
 * @param name - DSL property name.
 * @param definition - Property mapping.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * registerProperty('contentGrid', {
 *   property: 'grid-template-columns',
 *   scale: 'none',
 * })
 * ```
 */
export function registerProperty(name: string, definition: PropertyAliasDefinition): void {
  runtime.propertyAliasRegistry.set(name, definition)
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
}

/**
 * Registers a context variant that expands to one or more selectors.
 *
 * @param name - Variant block name.
 * @param selectors - Selectors where `&` represents the current generated class.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * registerVariant('hocus', ['&:hover', '&:focus-visible'])
 *
 * css`
 *   hocus {
 *     bg: $brand;
 *   }
 * `
 * ```
 */
export function registerVariant(name: string, selectors: readonly string[]): void {
  runtime.variantRegistry.set(name, selectors)
  runtime.artifactCache.clear()
}

/**
 * Creates a recipe with variants.
 *
 * @param definition - Recipe definition.
 * @returns Callable recipe returning a CSS artifact.
 *
 * @example
 * ```ts
 * const button = recipe({
 *   base: `buttonBase;`,
 *   variants: {
 *     tone: {
 *       primary: `bg: $brand;`,
 *       danger: `bg: $danger;`,
 *     },
 *   },
 *   defaults: { tone: 'primary' },
 * })
 *
 * button({ tone: 'danger' })
 * ```
 */
export function recipe(definition: CipoRecipeDefinition) {
  const callable = (options: Record<string, string | boolean | null | undefined> = {}) => {
    const chunks: string[] = []
    const defaults = definition.defaults ?? {}

    if (definition.base) chunks.push(stringifyRecipePart(definition.base))

    for (const [variantName, choices] of Object.entries(definition.variants ?? {})) {
      const selected = options[variantName] ?? defaults[variantName]
      if (selected === false || selected === null || selected === undefined) continue
      const part = choices[String(selected)]
      if (part) chunks.push(stringifyRecipePart(part))
    }

    return css([chunks.join('\n')] as unknown as TemplateStringsArray)
  }

  Object.defineProperty(callable, 'definition', { value: definition, enumerable: true })
  return callable as import('./types').CipoRecipe
}

function stringifyRecipePart(part: string | CipoStyleObject): string {
  return typeof part === 'string' ? part : styleObjectToCss(part)
}
