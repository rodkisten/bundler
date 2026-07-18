import { registerAlias, registerProperty } from './plugin-registry'
import { BUILT_IN_PROPERTY_ALIASES } from './aliases/property-aliases'
import { BUILT_IN_LAYOUT_ALIASES, BUILT_IN_UTILITY_ALIASES } from './aliases/utility-aliases'

/**
 * Installs Cipó's built-in property aliases and utility identifiers.
 *
 * @remarks
 * This keeps Cipó close to CSS authoring while borrowing the broad utility
 * coverage idea from Tailwind, Panda CSS utilities, and UnoCSS shortcuts.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * installBuiltInAliases()
 *
 * css`
 *   px: 4;
 *   bg: $brand;
 *   rounded: $xl;
 *   center;
 *   glass;
 * `
 * ```
 *
 * @example Output shape
 * ```css
 * .cipo-a-padding-inline {
 *   padding-inline: calc(var(--cipo-spacing) * 4);
 * }
 *
 * .cipo-a-background {
 *   background: var(--cipo-colors-brand);
 * }
 * ```
 */
export function installBuiltInAliases(): void {
  installPropertyAliases()
  installUtilityAliases()
}

/**
 * Registers property aliases inspired by Tailwind/Panda/UnoCSS coverage.
 *
 * @remarks
 * These aliases do not create Tailwind-like class names. They map Cipó DSL
 * properties to real CSS properties:
 *
 * ```css
 * px: 4;
 * bg: $brand;
 * rounded: $xl;
 * ```
 *
 * This is closer to Panda's configurable utility model and keeps the language
 * readable inside CSS template strings.
 *
 * @returns Nothing.
 *
 * @example Spacing
 * ```ts
 * css`
 *   p: 4;
 *   px: 6;
 *   mt: 2;
 *   gap: 3;
 * `
 * ```
 *
 * @example Layout and flex
 * ```ts
 * css`
 *   d: flex;
 *   direction: column;
 *   items: center;
 *   justify: between;
 *   grow: 1;
 * `
 * ```
 *
 * @example Effects
 * ```ts
 * css`
 *   blur: 12px;
 *   backdrop-blur: 20px;
 *   shadow: $glow;
 * `
 * ```
 */
export function installPropertyAliases(): void {
  for (const [name, [property, scale]] of Object.entries(BUILT_IN_PROPERTY_ALIASES)) {
    registerProperty(name, { property, scale })
  }
}

/**
 * Registers standalone identifiers such as `flex;`, `center;`, `glass;`.
 *
 * @remarks
 * This mirrors UnoCSS's shortcut idea: one identifier can expand into many
 * declarations. Unlike UnoCSS class shortcuts, Cipó shortcuts live inside the
 * CSS template itself.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * css`
 *   glass;
 *   cardSurface;
 *   interactive;
 * `
 * ```
 *
 * @example Output shape
 * ```css
 * background: color-mix(...);
 * border: 1px solid color-mix(...);
 * backdrop-filter: blur(18px) saturate(140%);
 * ```
 */
export function installUtilityAliases(): void {
  for (const [name, value] of Object.entries(BUILT_IN_UTILITY_ALIASES)) registerAlias(name, value)
  for (const [name, value] of Object.entries(BUILT_IN_LAYOUT_ALIASES)) registerAlias(name, value)
}
