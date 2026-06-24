import { beforeEach, describe, expect, it } from 'vitest'
import { configSheet, configure, configureCss, configureFromCss, getCssText, registerConfigPlugin, registerPreset, reset, sheet, setupFromCss } from '../src'
import { runtime } from '../src/runtime'

describe('Cipó CSS-first configuration', () => {
  beforeEach(() => reset())

  it('applies @cipo, @theme, @breakpoints, @alias and @property blocks', () => {
    const result = configureCss`
      @cipo {
        prefix: rod;
        layers: false;
        color-mode: oklch;
        rem: 16px;
      }

      @theme {
        colors: (brand: #f97316, ink: #f8fafc);
        radius: (lg: 24px);
        spacing: 0.25rem;
      }

      @breakpoints {
        md: 768px;
        wide: (min-width: 1200px);
      }

      @alias glass {
        bg: alpha($colors.ink / 12%)
        rounded: $radius.lg
      }

      @property $$angle {
        syntax: "<angle>";
        inherits: false;
        initial: 0deg;
      }
    `

    expect(result.warnings).toEqual([])
    expect(runtime.config.prefix).toBe('rod')
    expect(runtime.config.layers).toBe(false)
    expect(runtime.config.breakpoints.md).toBe('(min-width: 768px)')
    expect(runtime.config.breakpoints.wide).toBe('(min-width: 1200px)')
    expect(getCssText()).toContain('--rod-colors-brand:#f97316')
    expect(getCssText()).toContain('@property --rod-angle')

    const css = String(sheet.css`.card {
  glass
}`)
    expect(css).toContain('background:color-mix')
    expect(css).toContain('border-radius:var(--rod-radius-lg)')
  })

  it('treats @tokens as @theme and supports configSheet/setupFromCss aliases', () => {
    setupFromCss(`
      @cipo { prefix: app; layers: false; }
      @tokens { colors: (brand: #38bdf8); }
    `)

    configSheet(`@breakpoints { panel: 900px; }`)

    expect(runtime.config.prefix).toBe('app')
    expect(runtime.config.breakpoints.panel).toBe('(min-width: 900px)')
    expect(getCssText()).toContain('--app-colors-brand:#38bdf8')
  })

  it('applies registered @preset stylesheets and config objects', () => {
    registerPreset('forest', `
      @cipo { prefix: leaf; layers: false; }
      @theme { colors: (brand: #22c55e); }
    `)
    registerPreset('debug-off', { debug: false })

    const result = configureCss`
      @preset forest;
      @preset debug-off;
    `

    expect(result.appliedPresets).toEqual(['forest', 'debug-off'])
    expect(runtime.config.prefix).toBe('leaf')
    expect(runtime.config.debug).toBe(false)
    expect(getCssText()).toContain('--leaf-colors-brand:#22c55e')
  })

  it('applies registered @plugin hooks', () => {
    registerConfigPlugin('forms', api => {
      api.alias('fieldBase', `border: 1px solid $colors.ink\npx: 3`)
      api.theme({ colors: { ink: '#e5e7eb' } })
      api.property('focusOpacity', { syntax: '<number>', initial: 0 })
    })

    const result = configureCss`@plugin forms;`
    const css = String(sheet.css`.field {
  fieldBase
}`)

    expect(result.appliedPlugins).toEqual(['forms'])
    expect(css).toContain('border:0.0625rem solid var(--leaf-colors-ink)')
    expect(css).toContain('padding-inline:calc(var(--leaf-spacing, 0.25rem) * 3)')
    expect(getCssText()).toContain('@property --leaf-focus-opacity')
  })

  it('emits warnings for unknown presets and plugins', () => {
    const result = configureCss`
      @preset missing;
      @plugin missingPlugin;
    `

    expect(result.warnings.map(warning => warning.code)).toContain('cipo-config-preset-not-found')
    expect(result.warnings.map(warning => warning.code)).toContain('cipo-config-plugin-not-found')
  })
  it('caches prepared plans and skips equivalent warm applications', () => {
    const previousConfig = runtime.config
    const source = `
      @cipo { prefix: cached; layers: false; minify: true; }
      @theme { colors: (brand: #38bdf8); }
      @breakpoints { panel: 900px; }
    `

    try {
      const first = configureFromCss(source)
      const versions = {
        config: runtime.configVersion,
        theme: runtime.themeVersion,
        registry: runtime.registryVersion,
      }
      const cssText = getCssText()
      const second = configureFromCss(source)

      expect(second).toBe(first)
      expect(runtime.configVersion).toBe(versions.config)
      expect(runtime.themeVersion).toBe(versions.theme)
      expect(runtime.registryVersion).toBe(versions.registry)
      expect(getCssText()).toBe(cssText)

      configure({ prefix: 'external' })
      const reapplied = configureFromCss(source)

      expect(reapplied).not.toBe(first)
      expect(runtime.config.prefix).toBe('cached')
    } finally {
      configure(previousConfig)
    }
  })

  it('reapplies cached plans after reset so generated CSS is restored', () => {
    const previousConfig = runtime.config
    const source = `
      @cipo { prefix: restored; layers: false; }
      @theme { colors: (brand: #22c55e); }
      @property $$angle { syntax: "<angle>"; inherits: false; initial: 0deg; }
    `

    try {
      configureFromCss(source)
      expect(getCssText()).toContain('--restored-colors-brand:#22c55e')
      expect(getCssText()).toContain('@property --restored-angle')

      reset()
      expect(getCssText()).toBe('')

      configureFromCss(source)
      expect(getCssText()).toContain('--restored-colors-brand:#22c55e')
      expect(getCssText()).toContain('@property --restored-angle')
    } finally {
      configure(previousConfig)
    }
  })

})
