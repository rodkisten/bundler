import type { CipoRecipeDefinition, CipoStyleObject } from './types'
import { css } from './css'
import { styleObjectToCss } from './style-object'

export { registerAlias, registerHelper, registerNativeFunction, registerProperty, registerVariant } from './plugin-registry'

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
