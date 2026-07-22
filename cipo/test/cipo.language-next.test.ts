import { beforeEach, describe, expect, it } from 'vitest'
import {
  atomic,
  configureCompiledCssConfig,
  configureFromCss,
  getCssText,
  getThemeScope,
  reset,
  setup,
  sheet,
  theme,
  themeScope,
} from '@rodkisten/cipo'
import { compileCssConfigPayload } from '../config-css/parse'

function compact(value: string): string {
  return value.replace(/\s+/g, '')
}

describe('Cipó next-generation language features', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'rod',
      debug: false,
      breakpoints: {
        base: null,
        sm: '(min-width: 640px)',
        md: '(min-width: 768px)',
        lg: '(min-width: 1024px)',
        xl: '(min-width: 1280px)',
      },
    })
  })

  it('composes Fábrica-shaped state, group and peer selectors', () => {
    const result = String(sheet.css`
      .card {
        state(:active, variant=primary) {
          color: red
        }

        group(panel, :open) {
          color: blue
        }

        peer(field, ?checked) {
          opacity: 1
        }
      }
    `)
    const css = compact(result)

    expect(css).toContain(
      '.card[data-active][data-variant="primary"]{color:red;}',
    )
    expect(css).toContain(
      '[data-group="panel"][data-open].card{color:blue;}',
    )
    expect(css).toContain(
      '[data-peer="field"][checked]~.card{opacity:1;}',
    )
  })

  it('expands compound variants with arrays and negation', () => {
    const result = String(sheet.css`
      .button {
        compound(size: [lg, xl], variant: primary) {
          font-weight: 700
        }

        compound(!size: [sm], variant: danger) {
          opacity: 0.8
        }
      }
    `)
    const css = compact(result)

    expect(css).toContain(
      '.button[data-size="lg"][data-variant="primary"]',
    )
    expect(css).toContain(
      '.button[data-size="xl"][data-variant="primary"]',
    )
    expect(css).toContain(
      '.button:not([data-size="sm"])[data-variant="danger"]',
    )
  })

  it(
    'expands motion into final state, starting style and motion reduction',
    () => {
    const result = atomic.css`
      motion(
        opacity: 0 -> 1,
        y: 8px -> 0,
        scale: 0.96 -> 1,
        duration: 200ms,
        easing: ease-out
      )
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('opacity:1')
    expect(css).toContain('translate:00')
    expect(css).toContain('scale:1')
    expect(css).toContain('transition-duration:200ms')
    expect(css).toContain('@starting-style')
    expect(css).toContain('translate:00.5rem')
    expect(css).toContain('@media(prefers-reduced-motion:reduce)')
    },
  )

  it('supports reusable motion presets', () => {
    const result = atomic.css`
      motion($enter)
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('opacity:1')
    expect(css).toContain('transition-duration:200ms')
    expect(css).toContain('@starting-style')
  })

  it('supports compact and advanced text shorthands', () => {
    const result = atomic.css`
      text(16px / 1.5 / 600, ellipsis, tabular)
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('font-size:1rem')
    expect(css).toContain('line-height:1.5')
    expect(css).toContain('font-weight:600')
    expect(css).toContain('text-overflow:ellipsis')
    expect(css).toContain('font-variant-numeric:tabular-nums')
  })

  it('supports rich text arguments and line clamping', () => {
    const result = atomic.css`
      text(
        size: 14px,
        lh: 1.4,
        weight: 500,
        family: ui-monospace,
        tracking: 0.01em,
        case: upper,
        wrap: pretty,
        clamp: 3,
        ligatures: none
      )
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('font-family:ui-monospace')
    expect(css).toContain('letter-spacing:0.01em')
    expect(css).toContain('text-transform:uppercase')
    expect(css).toContain('text-wrap:pretty')
    expect(css).toContain('-webkit-line-clamp:3')
    expect(css).toContain('font-variant-ligatures:none')
  })

  it('expands typography theme presets through text($preset)', () => {
    theme({
      text: {
        body: {
          size: '16px',
          lh: 1.5,
          weight: 400,
          family: 'system-ui',
          tracking: '0.01em',
        },
      },
    })

    const result = atomic.css`
      text($body)
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('font-size:var(--rod-text-body-size)')
    expect(css).toContain('line-height:var(--rod-text-body-lh)')
    expect(css).toContain('font-family:var(--rod-text-body-family)')
  })

  it('supports responsive object values in properties and text()', () => {
    const result = String(sheet.css`
      .card {
        gap: {
          base: 8px,
          md: 16px
        }

        text(
          size: {
            base: 14px,
            md: 18px
          },
          lh: 1.4
        )
      }
    `)
    const css = compact(result)

    expect(css).toContain(
      '.card{gap:0.5rem;font-size:0.875rem;line-height:1.4;}',
    )
    expect(css).toContain('@media(min-width:768px)')
    expect(css).toContain('gap:1rem')
    expect(css).toContain('font-size:1.125rem')
  })

  it('supports named fluid ranges backed by configured breakpoints', () => {
    const result = atomic.css`
      font-size: fluid(
        min: 14px,
        max: 22px,
        from: sm,
        to: xl
      )
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('clamp(')
    expect(css).toContain('100vw-40rem')
    expect(css).toContain('80rem-40rem')
  })

  it('supports derived theme tokens and fallback chains', () => {
    theme({
      spacing: {
        sm: '8px',
        md: '$spacing.sm * 2',
      },
      colors: {
        foreground: '#111',
      },
    })

    expect(compact(getCssText())).toContain(
      '--rod-spacing-md:calc(var(--rod-spacing-sm)*2)',
    )

    const result = atomic.css`
      color: $button.foreground ?? $foreground
      border-color: token(button.border, foreground)
    `
    const css = compact(result.compiledCss)

    expect(css).toContain(
      'var(--rod-button-foreground,var(--rod-colors-foreground))',
    )
    expect(css).toContain(
      'var(--rod-button-border,var(--rod-colors-foreground))',
    )
  })

  it('supports named theme scopes and inheritance', () => {
    themeScope('dark', {
      colors: {
        surface: '#111',
      },
    })
    themeScope(
      'amoled',
      {
        colors: {
          background: '#000',
        },
      },
      { extends: 'dark' },
    )

    const css = compact(getCssText())
    expect(css).toContain('[data-theme="dark"]')
    expect(css).toContain('[data-theme="amoled"]')
    expect(css).toContain('--rod-colors-surface:#111')
    expect(css).toContain('--rod-colors-background:#000')
  })

  it('compiles CSS-first theme scopes into parser-free payloads', () => {
    const source = `
      @theme(dark) {
        colors: (surface: #111)
      }

      @theme(amoled extends dark) {
        colors: (background: #000)
      }
    `
    const payload = compileCssConfigPayload(source)

    expect(payload).not.toBeNull()
    reset()
    setup({ prefix: 'rod' })
    configureCompiledCssConfig(payload!)

    const css = compact(getCssText())
    expect(css).toContain('[data-theme="dark"]')
    expect(css).toContain('[data-theme="amoled"]')
    expect(css).toContain('--rod-colors-surface:#111')
  })

  it('applies CSS-first theme scopes through configureFromCss()', () => {
    configureFromCss(`
      @theme(editor) {
        colors: (surface: #101010)
      }
    `)

    expect(compact(getCssText())).toContain(
      '[data-theme="editor"]{--rod-colors-surface:#101010;}',
    )
  })

  it('registers typed custom properties from $$name<type> shorthand', () => {
    const result = atomic.css`
      $$progress<number>: 0
      opacity: $$progress
    `
    const css = compact(result.compiledCss)
    const runtimeCss = compact(getCssText())

    expect(css).toContain('--rod-progress:0')
    expect(css).toContain('opacity:var(--rod-progress)')
    expect(runtimeCss).toContain('@property--rod-progress')
    expect(runtimeCss).toContain('syntax:"<number>"')
  })

  it('supports container definitions and semantic container queries', () => {
    const result = String(sheet.css`
      .shell {
        container(card) {
          inline-size
        }
      }

      .card {
        x:cq(card >= md) {
          display: grid
        }

        x:container(card, min: 400px, max: 900px) {
          gap: 2
        }
      }
    `)
    const css = compact(result)

    expect(css).toContain(
      '.shell{container-name:card;container-type:inline-size;}',
    )
    expect(css).toContain('@containercard(min-width:768px)')
    expect(css).toContain(
      '@containercard(min-width:25rem)and(max-width:56.25rem)',
    )
  })

  it('supports dotted typography presets after token preprocessing', () => {
    theme({
      text: {
        heading: {
          lg: {
            size: '32px',
            lh: 1.1,
            weight: 700,
          },
        },
      },
    })

    const result = atomic.css`
      text($heading.lg)
    `
    const css = compact(result.compiledCss)

    expect(css).toContain(
      'font-size:var(--rod-text-heading-lg-size)',
    )
    expect(css).toContain(
      'line-height:var(--rod-text-heading-lg-lh)',
    )
    expect(css).toContain(
      'font-weight:var(--rod-text-heading-lg-weight)',
    )
  })

  it('supports token-driven positional typography', () => {
    theme({
      fontSizes: { sm: '14px' },
      lineHeights: { tight: 1.25 },
      fontWeights: { medium: 500 },
    })

    const result = atomic.css`
      text(
        $fontSizes.sm
        /
        $lineHeights.tight
        /
        $fontWeights.medium
      )
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('font-size:var(--rod-fontSizes-sm)')
    expect(css).toContain('line-height:var(--rod-lineHeights-tight)')
    expect(css).toContain('font-weight:var(--rod-fontWeights-medium)')
  })

  it('supports fluid values directly inside text()', () => {
    const result = atomic.css`
      text(fluid(14px, 20px) / 1.5)
    `
    const css = compact(result.compiledCss)

    expect(css).toContain('font-size:clamp(')
    expect(css).toContain('line-height:1.5')
  })

  it('keeps named theme inheritance observable to tooling', () => {
    themeScope('base-dark', {
      colors: {
        foreground: '#eee',
        surface: '#111',
      },
    })
    themeScope(
      'amoled',
      {
        colors: {
          surface: '#000',
        },
      },
      { extends: 'base-dark' },
    )

    expect(getThemeScope('amoled')).toEqual({
      colors: {
        foreground: '#eee',
        surface: '#000',
      },
    })
  })

  it('warns when a named theme extends an unknown parent', () => {
    const warnings: Array<{ code: string }> = []

    themeScope(
      'orphan',
      { colors: { surface: '#111' } },
      { extends: 'missing' },
      warnings as never,
    )

    expect(warnings).toContainEqual(
      expect.objectContaining({
        code: 'cipo-theme-scope-parent-missing',
      }),
    )
  })

  it('supports custom selectors for isolated named theme scopes', () => {
    themeScope(
      'editor',
      { colors: { surface: '#101010' } },
      { selector: ':host([data-editor-theme])' },
    )

    expect(compact(getCssText())).toContain(
      ':host([data-editor-theme]){--rod-colors-surface:#101010;}',
    )
  })

})
