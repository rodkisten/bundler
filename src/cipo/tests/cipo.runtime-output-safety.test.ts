import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup, sheet } from '../../cipo'

describe('Cipó runtime output safety', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'safe', layers: false, minify: true })
  })

  it('keeps tokens and nested selector lists valid', () => {
    const css = String(sheet.css`
      :root { $colors(strong: #fff, panel: #111); $$strong: $colors.strong; $$detailsHeight: 280px; }
      .layout { grid-template-rows: minmax(0, 1fr) auto minmax(0, $$detailsHeight); }
      .resize {
        &:hover::before,
        &:focus-visible::before { background: red; }
      }
    `)

    expect(css).toContain('--safe-colors-strong:#fff')
    expect(css).toContain('--safe-strong:var(--safe-colors-strong)')
    expect(css).toContain('minmax(0, var(--safe-details-height))')
    expect(css).toContain('.resize:hover::before,.resize:focus-visible::before')
    expect(css).not.toContain('$$')
    expect(css).not.toContain('&:hover')
  })
})
