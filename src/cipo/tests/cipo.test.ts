import { describe, expect, it, beforeEach } from 'vitest'
import { atomic, css, getCssText, inline, isAtomicCssArtifact, isStylesheetArtifact, registerAlias, registerHelper, registerProperty, reset, setup, sheet } from '../src/index'

describe('Cipó next', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'test',
      minify: true,
      layers: true,
      theme: {
        colors: { brand: '#f97316', ink: '#fff', panel: '#111' },
        spacing: '0.25rem',
        radius: { xl: '24px' },
      },
    })
  })

  it('keeps css tagged template API', () => {
    const card = css`color:red;`
    expect(String(card)).toContain('test-a-')
    expect(getCssText()).toContain('color:red')
  })

  it('supports token inference and property aliases', () => {
    const card = css`px:4;bg:$brand;rounded:$xl;`
    expect(isAtomicCssArtifact(card)).toBe(true)
    if (!isAtomicCssArtifact(card)) throw new Error('Expected atomic artifact')
    expect(card.compiledCss).toContain('padding-inline')
    expect(card.compiledCss).toContain('var(--test-colors-brand)')
  })

  it('supports standalone aliases', () => {
    registerAlias('demoGlass', 'bg:alpha($panel / 50%);')
    const card = css`demoGlass;`
    expect(isAtomicCssArtifact(card)).toBe(true)
    if (!isAtomicCssArtifact(card)) throw new Error('Expected atomic artifact')
    expect(card.compiledCss).toContain('color-mix')
  })

  it('supports inline.css', () => {
    const style = inline.css`px:2;color:$brand;`
    expect(String(style)).toContain('padding-inline')
    expect(String(style)).toContain('var(--test-colors-brand)')
  })

  it('supports variants', () => {
    const button = css`x:hover{bg:$brand;}x:md{px:6;}`
    expect(isAtomicCssArtifact(button)).toBe(true)
    if (!isAtomicCssArtifact(button)) throw new Error('Expected atomic artifact')
    expect(button.compiledCss).toContain(':hover')
    expect(button.compiledCss).toContain('@media')
  })

  it('handles comments, dollar aliases, raw property escape and helpers without semicolons', () => {
    const button = css`
      px: 4
      py: 2
      bg: $brand
      color: saturate($brand, 20%)
      /* bg: alpha($brand / 14%) */
      #box-shadow: outlineGlow($brand)
      $glassCard
      bleed: -4

      /*
      x:focus-visible {
        box-shadow: outlineGlow($brand)
      }

      x:hover {
        bg: alpha($brand / 72%)
      }
      */
    `

    expect(isAtomicCssArtifact(button)).toBe(true)
    if (!isAtomicCssArtifact(button)) throw new Error('Expected atomic artifact')
    expect(button.compiledCss).toContain('padding-inline')
    expect(button.compiledCss).toContain('padding-block')
    expect(button.compiledCss).toContain('background')
    expect(button.compiledCss).toContain('color-mix')
    expect(button.compiledCss).toContain('box-shadow')
    expect(button.compiledCss).toContain('margin')
  })

  it('supports active x blocks and alpha helpers without browser-freezing recursion', () => {
    const button = css`
      px: 4
      x:focus-visible {
        box-shadow: outlineGlow($brand)
      }
      x:hover {
        bg: alpha($brand / 72%)
      }
      x:md {
        px: 6
      }
      x:not(md) {
        width: 100%
      }
    `

    expect(isAtomicCssArtifact(button)).toBe(true)
    if (!isAtomicCssArtifact(button)) throw new Error('Expected atomic artifact')
    expect(button.compiledCss).toContain(':focus-visible')
    expect(button.compiledCss).toContain(':hover')
    expect(button.compiledCss).toContain('@media')
    expect(button.compiledCss).toContain('not all and')
  })


  it('supports explicit atomic, sheet and inline namespaces with important mode', () => {
    const atomicButton = atomic.css.withImportant`
      px: 4
      color: red !important
    `
    expect(atomicButton.kind).toBe('cipo.css')
    expect(atomicButton.compiledCss).toContain('padding-inline')
    expect((atomicButton.compiledCss.match(/!important/g)?.length || 0) >= 2).toBe(true)
    expect(atomicButton.compiledCss.includes('!important !important')).toBe(false)

    const inlineStyle = inline.css.withImportant`
      Px: 4
      color: red !important
    `
    expect(String(inlineStyle)).toContain('padding-inline')
    expect(String(inlineStyle).includes('!important !important')).toBe(false)

    const stylesheet = sheet.css.withImportant`
      .card {
        color: red !important
        px: 4
      }
    `
    expect(stylesheet.kind).toBe('cipo.stylesheet')
    expect(String(stylesheet)).toContain('.card')
    expect(String(stylesheet)).toContain('padding-inline')
    expect(String(stylesheet).includes('!important !important')).toBe(false)
  })

  it('compiles full stylesheets with theme tokens, $$ vars, selector lists, nesting and x blocks', () => {
    registerAlias('glassCard', `
      bg: alpha($panel / 72%)
      border: 1px solid alpha($ink / 12%)
      backdrop-filter: blur(18px)
    `)

    const ROOT_ID = 'root'
    const styleText = sheet.css`
      :root {
        $$panel: rgb(12 13 15 / .93)
        --ra-panel: rgb(12 13 15 / .93)
        --ra-muted: $colors.brand
      }

      #${ROOT_ID},
      .ra-log-surface-host {
        font-family: var(--ra-font-ui)
        color: var(--ra-text)
      }

      .ra-dock {
        $glassCard
        px: 4

        .ra-dock-inner {
          py: 2
        }

        &:hover {
          bg: alpha($brand / 72%)
        }

        x:md {
          px: 6
        }

        x:not(md) {
          width: 100%
        }
      }
    `

    expect(isStylesheetArtifact(styleText)).toBe(true)
    expect(String(styleText)).toContain('--test-panel')
    expect(String(styleText)).toContain('--ra-panel')
    expect(String(styleText)).toContain('#root,.ra-log-surface-host')
    expect(String(styleText)).toContain('.ra-dock .ra-dock-inner')
    expect(String(styleText)).toContain('.ra-dock:hover')
    expect(String(styleText)).toContain('@media (min-width:768px)')
    expect(String(styleText)).toContain('@media not all and (min-width:768px)')
    expect(String(styleText)).toContain('background:color-mix')
    expect(String(styleText).includes('bg:')).toBe(false)
  })

  it('keeps the reported kitchen sink valid with helpers, aliases, comments and custom properties', () => {
    setup({ prefix: 'rod' })
    registerHelper('outlineGlow', (args, context) => `0 0 0 3px ${context.resolveValue(`alpha(${args || '$brand'} / 25%)`)}`)
    registerAlias('glassCard', `
      bg: alpha($panel / 72%)
      border: 1px solid alpha($ink / 12%)
      backdrop-filter: blur(18px)
    `)
    registerProperty('bleed', { property: 'margin-inline', scale: 'spacing' })

    const button = atomic.css`
      px: 4px
      py: 2
      bg: $brand
      color: saturate($brand, 20%)
      /* bg: alpha($brand / 14%) */
      box-shadow: outlineGlow($brand)
      $glassCard
      bleed: -4
      # inline comment
      x:hover {
        bg: alpha($brand / 72%)
      }
      x:md {
        px: 6
      }
      x:not(md) {
        width: 100%
      }
    `

    expect(button.compiledCss).toContain('padding-inline:0.25rem')
    expect(button.compiledCss).toContain('padding-block:calc(var(--rod-spacing,0.25rem) * 2)')
    expect(button.compiledCss).toContain('background:var(--rod-colors-brand)')
    expect(button.compiledCss).toContain('box-shadow:0 0 0 0.1875rem color-mix')
    expect(button.compiledCss).toContain('margin-inline:calc(var(--rod-spacing,0.25rem) * -4)')
    expect(button.compiledCss).toContain(':hover')
    expect(button.compiledCss).toContain('@media')
    expect(button.compiledCss.includes('/*')).toBe(false)
    expect(button.compiledCss.includes('# inline')).toBe(false)
  })

})
