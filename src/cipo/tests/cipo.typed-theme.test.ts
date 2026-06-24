import { beforeEach, describe, expect, it } from 'vitest'
import {
  configure,
  configureCss,
  configureFromCss,
  defineThemeType,
  getCssText,
  getThemeType,
  listThemeTypes,
  reset,
  theme,
  typedProperty,
  typedTheme,
  validateThemeValue,
} from '../src'
import { createTypedThemeMegaSheet } from '../examples/typed-theme-mega-sheet'

function setupTypedThemeRuntime(): void {
  reset()
  configure({
    prefix: 'typed',
    debug: false,
    layers: false,
    themeValidation: 'warn',
    registerTypedThemeProperties: true,
  })
}

describe('Cipó typed theme properties', () => {
  beforeEach(setupTypedThemeRuntime)

  it('validates typed CSS-first groups and auto-registers native property syntaxes', () => {
    const result = configureCss`
      @theme {
        spacing<size>: 0.25rem;

        radius<length>: (
          sm: 6kkk,
          md: 14px,
          lg: 22px,
          modal: 24px,
          pill: 999px
        );

        sh<shadow>: (
          panel: 0 28px 90px rgb(0 0 0 / 0.72),
          modal: 0 32px 120px rgb(0 0 0 / 0.78),
          dock: 0 18px 50px rgb(0 0 0 / 0.58)
        );
      }
    `

    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.code).toBe('cipo-theme-unit-invalid')
    expect(result.warnings[0]?.message).toContain('radius-sm')
    expect(result.warnings[0]?.message).toContain('kkk')

    const output = getCssText()
    expect(output).toContain('@property --typed-spacing')
    expect(output).toContain('syntax:"<length-percentage>"')
    expect(output).toContain('@property --typed-radius-md')
    expect(output).not.toContain('@property --typed-radius-sm')
    expect(output).not.toContain('@property --typed-sh-panel')
    expect(output).toContain('--typed-radius-sm:6kkk')
    expect(output).toContain('--typed-sh-panel:0 1.75rem 5.625rem rgb(0 0 0 / 0.72)')
  })

  it('preserves comma-separated CSS values inside typed maps', () => {
    configureCss`
      @theme {
        motion<transition>: (
          interactive: color 180ms ease, background-color 180ms ease, transform 180ms ease,
          layout: inline-size 280ms ease, block-size 280ms ease
        );
        fonts<any>: (
          sans: ui-sans-serif, system-ui, -apple-system, sans-serif,
          mono: ui-monospace, Menlo, Monaco, monospace
        );
      }
    `

    const output = getCssText()
    expect(output).toContain('--typed-motion-interactive:color 180ms ease, background-color 180ms ease, transform 180ms ease')
    expect(output).toContain('--typed-fonts-sans:ui-sans-serif, system-ui, -apple-system, sans-serif')
    expect(output).toContain('--typed-fonts-mono:ui-monospace, Menlo, Monaco, monospace')
  })

  it('restores warning reporting after a full runtime reset', () => {
    const source = '@theme { bad<length>: 6kkk; }'
    expect(configureFromCss(source).warnings).toHaveLength(1)

    setupTypedThemeRuntime()

    expect(configureFromCss(source).warnings).toHaveLength(1)
  })

  it('supports annotation options for registration, inheritance and initial values', () => {
    configureCss`
      @theme {
        radius<length, no-register>: (sm: 6px, md: 14px);
        progress<number, register, inherits:false, initial:0>: 0.75;
      }
    `

    const output = getCssText()
    expect(output).not.toContain('@property --typed-radius-sm')
    expect(output).toContain('@property --typed-progress')
    expect(output).toContain('inherits:false')
    expect(output).toContain('initial-value:0')
    expect(output).toContain('--typed-progress:0.75')
  })

  it('does not emit @property when a custom initial value is invalid', () => {
    const result = configureCss`
      @theme {
        radius<length, register, initial:6kkk>: 14px;
      }
    `

    expect(result.warnings.map(warning => warning.code)).toContain('cipo-theme-unit-invalid')
    expect(getCssText()).not.toContain('@property --typed-radius')
    expect(getCssText()).toContain('--typed-radius:0.875rem')
  })

  it('warns when forced registration targets a semantic-only type', () => {
    const result = configureCss`
      @theme {
        elevation<shadow, register>: (
          floating: 0 20px 60px rgb(0 0 0 / 0.5)
        );
      }
    `

    expect(result.warnings.map(warning => warning.code)).toContain(
      'cipo-theme-type-not-registrable',
    )
    expect(getCssText()).not.toContain('@property --typed-elevation-floating')
    expect(getCssText()).toContain('--typed-elevation-floating:0 1.25rem 3.75rem')
  })

  it('throws in strict mode instead of silently accepting an invalid typed token', () => {
    configure({ themeValidation: 'strict' })

    expect(() => configureCss`
      @theme {
        strictRadius<length>: 12wat;
      }
    `).toThrow(/strictRadius|strict-radius|12wat/i)
  })

  it('supports JS-first typed groups and deferred browser values', () => {
    theme({
      layout: {
        gutters: typedTheme('size', {
          compact: 'clamp(12px, 2vw, 24px)',
          external: 'var(--host-gutter)',
        }),
      },
    })

    const output = getCssText()
    expect(output).toContain('@property --typed-layout-gutters-compact')
    expect(output).toContain('@property --typed-layout-gutters-external')
    expect(output).toContain('--typed-layout-gutters-external:var(--host-gutter)')
    expect(validateThemeValue('size', 'var(--host-gutter)').status).toBe('deferred')
  })

  it('registers custom semantic types and validates them through the same registry', () => {
    defineThemeType('positive-length', {
      cssSyntax: '<length>',
      registrable: true,
      initialValue: '0px',
      validate(value) {
        const base = validateThemeValue('length', value)
        if (base.status !== 'valid') return { ...base, type: 'positive-length' }
        if (value.trim().startsWith('-')) {
          return {
            status: 'invalid',
            valid: false,
            type: 'positive-length',
            value,
            code: 'cipo-theme-positive-length-negative',
            reason: 'Negative lengths are not allowed.',
          }
        }
        return {
          status: 'valid',
          valid: true,
          type: 'positive-length',
          value,
        }
      },
    })

    const result = validateThemeValue('positive-length', '-4px', { path: 'radius.bad' })
    expect(result.status).toBe('invalid')
    expect(result.reason).toContain('Negative')
    expect(getThemeType('positive-length')?.cssSyntax).toBe('<length>')
    expect(listThemeTypes()).toContain('positive-length')
  })

  it('compiles the large typed-theme application stylesheet without warnings', () => {
    const result = createTypedThemeMegaSheet()

    expect(result.validation.valid).toBe(true)
    expect(result.config.warnings).toHaveLength(0)
    expect(result.stylesheet.cssText.length).toBeGreaterThan(30_000)
    expect(result.stylesheet.cssText).toContain('.app-shell')
    expect(result.stylesheet.cssText).toContain(':has(')
    expect(result.stylesheet.cssText).toContain('@keyframes dialog-enter')
    expect(getCssText()).toContain('@property --mega-radius-md')
    expect(getCssText()).toContain('--mega-shadow-panel:')
  })

  it('creates validated native registrations with typedProperty()', () => {
    expect(typedProperty('dockOffset', 'length', '12px', { inherits: false }))
      .toBe('--typed-dock-offset')
    expect(getCssText()).toContain('@property --typed-dock-offset')
    expect(getCssText()).toContain('syntax:"<length>"')
    expect(() => typedProperty('badOffset', 'length', '4nope')).toThrow(/4nope|invalid/i)
    expect(() => typedProperty('panelShadow', 'shadow', '0 2px 4px #000')).toThrow(
      /semantic-only/i,
    )
  })
})
