import { beforeEach, describe, expect, it } from 'vitest'
import { getCssText, property, properties, reset, sheet, theme, typed, validateCss } from '../src'

describe('Cipó custom @property support', () => {
  beforeEach(() => reset())

  it('compiles declarative @property blocks in sheet.css', () => {
    const cssText = String(sheet.css`
      @property $$angle {
        syntax: "<angle>"
        inherits: false
        initial: 0deg
      }

      .knob {
        $$angle: 24deg
        rotate: var(--cipo-angle)
      }
    `)

    expect(cssText).toContain('@property --cipo-angle')
    expect(cssText).toContain('syntax:"<angle>";')
    expect(cssText).toContain('inherits:false;')
    expect(cssText).toContain('initial-value:0deg;')
    expect(cssText).toContain('--cipo-angle:24deg;')
  })

  it('does not add important to @property internals', () => {
    const cssText = String(sheet.css.withImportant`
      @property $$progress {
        syntax: "<number>"
        inherits: true
        initial: 0
      }

      .bar {
        $$progress: 1
      }
    `)

    expect(cssText).toContain('@property --cipo-progress')
    expect(cssText).toContain('initial-value:0;')
    expect(cssText).not.toContain('syntax: "<number>" !important')
    expect(cssText).toContain('--cipo-progress:1 !important;')
  })

  it('registers properties from JS with dedupe', () => {
    property('angle', { syntax: '<angle>', inherits: false, initial: '0deg' })
    property('$$angle', { syntax: '<angle>', inherits: false, initialValue: '0deg' })
    property('--cipo-angle', { syntax: '<angle>', inherits: false, initialValue: '0deg' })

    const output = getCssText()
    expect(output.match(/@property --cipo-angle/g)?.length).toBe(1)
    expect(output).toContain('syntax:"<angle>"')
    expect(output).toContain('inherits:false')
    expect(output).toContain('initial-value:0deg')
  })

  it('registers property batches', () => {
    const registered = properties({
      progress: { syntax: '<number>', initial: 0 },
      panelOpacity: { syntax: '<number>', inherits: true, initialValue: 0.94 },
    })

    expect(registered.progress).toBe('--cipo-progress')
    expect(registered.panelOpacity).toBe('--cipo-panel-opacity')
    expect(getCssText()).toContain('@property --cipo-progress')
    expect(getCssText()).toContain('@property --cipo-panel-opacity')
  })

  it('supports typed theme tokens', () => {
    theme({
      knob: {
        angle: typed.angle('0deg', false),
        progress: typed.number(0),
        glow: typed.color('transparent'),
      },
    })

    const output = getCssText()
    expect(output).toContain('@property --cipo-knob-angle')
    expect(output).toContain('@property --cipo-knob-progress')
    expect(output).toContain('@property --cipo-knob-glow')
    expect(output).toContain('--cipo-knob-angle:0deg')
    expect(output).toContain('--cipo-knob-progress:0')
    expect(output).toContain('--cipo-knob-glow:transparent')
  })

  it('supports typed() runtime custom property declarations', () => {
    const cssText = String(sheet.css`
      :root {
        $$panelOpacity: typed("<number>", 0.94)
        $$dockAngle: angle(0deg, false)
      }
    `)

    expect(getCssText()).toContain('@property --cipo-panel-opacity')
    expect(getCssText()).toContain('@property --cipo-dock-angle')
    expect(cssText).toContain('--cipo-panel-opacity:0.94;')
    expect(cssText).toContain('--cipo-dock-angle:0deg;')
  })

  it('validates malformed @property blocks', () => {
    const result = validateCss('@property nope { syntax: "<number>"; inherits: maybe; }')

    expect(result.valid).toBe(false)
    expect(result.issues.map(issue => issue.code)).toContain('property-invalid-name')
    expect(result.issues.map(issue => issue.code)).toContain('property-invalid-inherits')
    expect(result.issues.map(issue => issue.code)).toContain('property-missing-initial-value')
  })
})
