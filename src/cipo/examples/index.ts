import {
  assertAtomicCssArtifact,
  cipo,
  css,
  explain,
  getCssText,
  inline,
  injectGlobal,
  injectStyle,
  recipe,
  registerAlias,
  registerHelper,
  registerProperty,
  setup,
  theme,
} from '../src/index'

/**
 * Cipó examples catalogue.
 *
 * @remarks
 * This file is intentionally verbose because the build system extracts every
 * `@example` block and publishes it to the generated landing page. The prose
 * before each fenced code block is preserved as the example comment, so the
 * public docs explain not only the input, but also the expected output shape.
 *
 * @example Setup with theme inside configure/setup
 * Use this when you want one single boot call. `$brand`, `$ink`, `$xl` and
 * other short tokens are inferred from the theme tree.
 * ```ts
 * setup({
 *   prefix: 'rod',
 *   layers: true,
 *   minify: false,
 *   rem: { enabled: true, baseFontSize: 16 },
 *   colorMode: 'oklch',
 *   theme: {
 *     colors: { brand: '#f97316', ink: '#f8fafc', panel: '#0f172a' },
 *     spacing: '0.25rem',
 *     radius: { md: '12px', xl: '24px' },
 *     shadow: { panel: '0 24px 80px rgb(0 0 0 / 0.35)' },
 *     text: { sm: '0.875rem', lg: '1.25rem' },
 *   },
 * })
 *
 * // Output tokens include:
 * // --rod-colors-brand:#f97316;
 * // --rod-radius-xl:1.5rem;
 * ```
 *
 * @example Atomic component CSS without semicolons
 * Semicolons are optional. This compiles to a class list and injects atomic CSS.
 * ```ts
 * const card = css`
 *   px: 4
 *   py: 3
 *   bg: $panel
 *   color: $ink
 *   rounded: $xl
 * `
 *
 * String(card)
 * // 'rod-a-... rod-a-...'
 * ```
 *
 * @example Full stylesheet mode
 * A root selector means Cipó returns stylesheet text instead of component classes.
 * ```ts
 * const sheet = css`
 *   .card {
 *     px: 4
 *     bg: $panel
 *
 *     &:hover {
 *       bg: alpha($brand / 18%)
 *     }
 *   }
 * `
 *
 * String(sheet)
 * // '.card { padding-inline: ...; background: ... } .card:hover { ... }'
 * ```
 *
 * @example x variants and responsive contexts
 * `x:` is reserved for runtime contexts: responsive, pseudo, dark mode and
 * negated breakpoints.
 * ```ts
 * const button = css`
 *   px: 4
 *   py: 2
 *   bg: $brand
 *
 *   x:hover {
 *     bg: alpha($brand / 72%)
 *   }
 *
 *   x:md {
 *     px: 6
 *   }
 *
 *   x:not(md) {
 *     width: 100%
 *   }
 * `
 * ```
 *
 * @example inline.css for style attributes
 * `inline.css` uses the same token/helper pipeline but emits declarations.
 * ```ts
 * const style = inline.css`
 *   px: 2
 *   py: 1
 *   color: saturate($brand, 20%)
 *   bg: alpha($brand / 14%)
 * `
 *
 * String(style)
 * // 'padding-inline:...; padding-block:...; color:...; background:...;'
 * ```
 *
 * @example Custom helper plugin
 * Helpers can return value fragments and may call `context.resolveValue()` to
 * reuse the same color/token/function pipeline as built-ins.
 * ```ts
 * registerHelper('outlineGlow', (args, context) => {
 *   return `0 0 0 3px ${context.resolveValue(`alpha(${args || '$brand'} / 25%)`)}`
 * })
 *
 * const focus = css`
 *   x:focus-visible {
 *     box-shadow: outlineGlow($brand)
 *   }
 * `
 * ```
 *
 * @example Custom alias plugin
 * Aliases are standalone identifiers that expand to CSS. This is the Cipó
 * equivalent of reusable utility shortcuts.
 * ```ts
 * registerAlias('glassCard', `
 *   bg: alpha($panel / 72%)
 *   border: 1px solid alpha($ink / 12%)
 *   backdrop-filter: blur(18px)
 * `)
 *
 * const card = css`
 *   glassCard
 *   rounded: $xl
 * `
 * ```
 *
 * @example Custom property alias
 * Register property aliases when your design system has a compact concept that
 * should normalize like built-in aliases.
 * ```ts
 * registerProperty('bleed', { property: 'margin-inline', scale: 'spacing' })
 *
 * const section = css`
 *   bleed: -4
 * `
 * ```
 *
 * @example Recipes
 * Recipes generate class lists from variant selections without introducing a new
 * rendering layer.
 * ```ts
 * const button = recipe({
 *   base: 'buttonBase;focusRing;',
 *   variants: {
 *     tone: {
 *       primary: 'bg:$brand;color:$ink;',
 *       danger: 'bg:$danger;color:white;',
 *     },
 *   },
 *   defaults: { tone: 'primary' },
 * })
 *
 * button({ tone: 'danger' }).className
 * // 'rod-a-... rod-a-...'
 * ```
 *
 * @example Styled DOM factory through Fabrica Elements
 * Cipó delegates component creation to Fabrica Elements, so CSS ownership and
 * element ownership stay separate.
 * ```ts
 * const Button = cipo.button.css`
 *   buttonBase
 *   bg: $brand
 *   color: $ink
 * `
 *
 * const node = Button({ children: 'Save' })
 * // HTMLButtonElement in the DOM adapter.
 * ```
 *
 * @example Debug output
 * Use `explain()` when you need to inspect one generated atomic class.
 * ```ts
 * const card = css`color: $brand`
 * assertAtomicCssArtifact(card)
 * const firstClass = card.className.split(' ')[0] ?? ''
 *
 * explain(firstClass)
 * // { found: true, atom: { property: 'color', value: 'var(--rod-colors-brand)' } }
 * ```
 *
 * @example Local style injection for Shadow DOM
 * `injectStyle()` can write compiled styles into a ShadowRoot instead of the
 * document head.
 * ```ts
 * const host = document.createElement('div')
 * const shadow = host.attachShadow({ mode: 'open' })
 * const card = css`px: 4; bg: $panel;`
 *
 * injectStyle(shadow, card)
 * ```
 *
 * @example Global CSS
 * `injectGlobal` is for reset/base styles and real global selectors.
 * ```ts
 * injectGlobal`
 *   *, *::before, *::after { box-sizing: border-box }
 *   body { margin: 0; bg: $panel; color: $ink }
 * `
 * ```
 */
export function runCipoExamples(): void {
  setup({
    prefix: 'rod',
    layers: true,
    minify: false,
    rem: { enabled: true, baseFontSize: 16 },
    colorMode: 'oklch',
    theme: {
      colors: { brand: '#f97316', panel: '#0f172a', ink: '#f8fafc', danger: '#ef4444' },
      spacing: '0.25rem',
      radius: { md: '12px', xl: '24px' },
      shadow: { panel: '0 24px 80px rgb(0 0 0 / 0.35)' },
      text: { sm: '0.875rem', lg: '1.25rem' },
    },
  })

  theme({ colors: { success: '#84cc16' } })
  registerProperty('bleed', { property: 'margin-inline', scale: 'spacing' })
  registerHelper('outlineGlow', (args, context) => `0 0 0 3px ${context.resolveValue(`alpha(${args || '$brand'} / 25%)`)}`)
  registerAlias('glassCard', 'bg: alpha($panel / 72%);border: 1px solid alpha($ink / 12%);backdrop-filter: blur(18px);')

  const card = css`glassCard;px:4;py:3;rounded:$xl;color:$ink;`
  const style = inline.css`px:2;py:1;bg:alpha($brand / 14%);`
  const button = recipe({ base: 'buttonBase;focusRing;', variants: { tone: { danger: 'bg:$danger;color:white;' } } })
  const Button = (cipo as any).button.css`buttonBase;bg:$brand;color:$ink;`

  console.log(String(card), String(style), button({ tone: 'danger' }).className, Button({ children: 'Save' }), getCssText())
  if ('className' in card) console.log(explain(card.className.split(' ')[0] ?? ''))
}
