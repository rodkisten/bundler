import { describe, expect, it, beforeEach } from 'vitest'
import { atomic, css, getCssText, inline, isAtomicCssArtifact, isStylesheetArtifact, registerAlias, registerHelper, registerNativeFunction, registerProperty, reset, setup, sheet, validateCss } from '../src/index'

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


  it('preserves modern native CSS functions and multiline values without warning storms', () => {
    const warnings: string[] = []
    setup({
      prefix: 'modern',
      minify: true,
      debug: false,
      onWarning(warning) {
        warnings.push(warning.code)
      },
      theme: {
        colors: { brand: '#22c55e', ink: '#f8fafc', panel: '#020617' },
        spacing: '0.25rem',
      },
    })

    const styleText = sheet.css`
      .panel {
        right: max(0.5rem, env(safe-area-inset-right))
        bottom:
          max(1.125rem, env(safe-area-inset-bottom))
        left:
          max(0.5rem, env(safe-area-inset-left))
        width: min(100%, calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))
        background: linear-gradient(180deg, color-mix(in oklch, $panel 88%, transparent), light-dark(#fff, #000))
        color: oklch(from $brand l c h)
        filter: blur(2px) saturate(140%) drop-shadow(0 12px 24px rgb(0 0 0 / .3))
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr))
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%)
      }
    `

    expect(String(styleText)).toContain('right:max(0.5rem,env(safe-area-inset-right))')
    expect(String(styleText)).toContain('bottom:max(1.125rem,env(safe-area-inset-bottom))')
    expect(String(styleText)).toContain('left:max(0.5rem,env(safe-area-inset-left))')
    expect(String(styleText)).toContain('width:min(100%,calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))')
    expect(String(styleText)).toContain('linear-gradient')
    expect(String(styleText)).toContain('light-dark')
    expect(String(styleText)).toContain('oklch(from var(--modern-colors-brand) l c h)')
    expect(String(styleText)).toContain('repeat(auto-fit,minmax(min(100%,12rem),1fr))')
    expect(warnings.includes('unknown-function-declaration')).toBe(false)
    expect(warnings.includes('invalid-declaration')).toBe(false)
  })

  it('lets users register future native CSS functions without treating them as helpers', () => {
    const warnings: string[] = []
    setup({ prefix: 'future', minify: true, debug: false, onWarning: warning => warnings.push(warning.code) })
    registerNativeFunction('future-size')

    const styleText = sheet.css`
      .box {
        width:
          future-size(width)
      }
    `

    expect(String(styleText)).toContain('width:future-size(width)')
    expect(warnings.includes('unknown-function-declaration')).toBe(false)
    expect(warnings.includes('invalid-declaration')).toBe(false)
  })


  it('validates generated css for debug diagnostics', () => {
    const ok = validateCss('.card{color:red!important;}')
    expect(ok.valid).toBe(true)

    const broken = validateCss('.card{color:red!important!important;')
    expect(broken.valid).toBe(false)
    expect(broken.issues.map((issue) => issue.code).join(',')).toContain('duplicate-important')
    expect(broken.issues.map((issue) => issue.code).join(',')).toContain('unclosed-block')
  })

})
