import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup, sheet } from '../../cipo'

describe('Cipó native property safety', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'safe', layers: false, minify: true })
  })

  it('preserves native property semantics', () => {
    const css = String(sheet.css`
      .probe {
        font: 600 11px / 1 var(--font-ui)
        content: ""
        transform: translateX(-50%)
        direction: rtl
        grid: auto-flow / 1fr 2fr
      }
    `)

    expect(css).toContain('font:600 0.6875rem var(--cipo-internal-native-slash-7f3c, /) 1 var(--font-ui)')
    expect(css).toContain('content:""')
    expect(css).toContain('transform:translateX(-50%)')
    expect(css).toContain('direction:rtl')
    expect(css).not.toContain('font-family:calc(')
    expect(css).not.toContain('align-content:""')
    expect(css).not.toContain('text-transform:translateX(')
  })
})
