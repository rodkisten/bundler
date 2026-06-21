import { describe, expect, it, beforeEach } from 'vitest'
import { reset, setup, sheet } from '../src/index'

beforeEach(() => {
  reset()
  setup({
    prefix: 'rod',
    minify: true,
    layers: false,
    rem: { enabled: true, baseFontSize: 16 },
    theme: { colors: { brand: '#f97316' }, spacing: '0.25rem' },
  })
})

describe('Cipó runtime DSL', () => {
  it('flattens runtime token objects and compiles derived custom-property math', () => {
    const cssText = String(sheet.css`
      :root {
        $dock(
          radius: 14px,
          size: (sm: 4px, md: 1rem, full: 100%),
          object: (nested: auto, width: 22px, color: hsla(22,87%,8%,88%))
        )
        $$panelRadius: $$dock-radius / 2
        $$iconWrapSize: 16px
        $$iconSize: $$iconWrapSize - 1px
      }
    `)

    expect(cssText).toContain('--rod-dock-radius:0.875rem')
    expect(cssText).toContain('--rod-dock-size-sm:0.25rem')
    expect(cssText).toContain('--rod-dock-size-md:1rem')
    expect(cssText).toContain('--rod-dock-object-width:1.375rem')
    expect(cssText).toContain('--rod-panel-radius:calc(var(--rod-dock-radius) / 2)')
    expect(cssText).toContain('--rod-icon-size:calc(var(--rod-icon-wrap-size) - 0.0625rem)')
  })

  it('expands runtime mixins, macro conditions, media blocks and Tailwind-like OKLCH colors', () => {
    const cssText = String(sheet.css`
      :root {
        $$reset(type: string) {
          p: auto
          if type = "all" {
            clear: both
            margin: auto
          }
        }

        $$glass(c: color, b: length) {
          font-size: 14px + 5vw
          py: *b
          color-amber-245
          bg-*c-235
          x:md {
            color-accent-420
            reset(all)
          }
        }
      }

      .card {
        glass(amber, 4)
      }
    `)

    expect(cssText).toContain('.card{font-size:calc(0.875rem+5vw)')
    expect(cssText).toContain('padding-block:calc(var(--rod-spacing,0.25rem) * 4)')
    expect(cssText).toContain('color:oklch(')
    expect(cssText).toContain('background:oklch(')
    expect(cssText).toContain('@media (min-width:768px)')
    expect(cssText).toContain('clear:both')
    expect(cssText).toContain('margin:auto')
  })
})
