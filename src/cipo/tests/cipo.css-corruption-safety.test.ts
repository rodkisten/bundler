import { beforeEach, describe, expect, it } from 'vitest'
import { getCssText, reset, setup, sheet } from '../../cipo'

describe('Cipó CSS corruption safety', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'safe',
      layers: false,
      minify: true,
      theme: { colors: { strong: '#fff', panel: '#111', cyan: '#0ff' } },
    })
  })

  it('preserves native CSS properties and slash shorthands', () => {
    const css = String(sheet.css`
      .probe {
        font: 600 11px / 1 var(--font-ui)
        content: ""
        transform: translateX(-50%)
        direction: rtl
        grid: auto-flow / 1fr 2fr
      }
    `)

    expect(css).toContain('font:600 0.6875rem var(--cipo-internal-native-slash-7f3c,/) 1 var(--font-ui)')
    expect(css).toContain('content:""')
    expect(css).toContain('transform:translateX(-50%)')
    expect(css).toContain('direction:rtl')
    expect(css).toContain('grid:auto-flow var(--cipo-internal-native-slash-7f3c,/) 1fr 2fr')
    expect(css).not.toContain('font-family:calc(')
    expect(css).not.toContain('align-content:""')
    expect(css).not.toContain('text-transform:translateX(')
  })

  it('resolves compact tokens and keeps nested selector lists intact', () => {
    const css = String(sheet.css`
      :root { $colors(strong: #fff, panel: #111, cyan: #0ff); $$strong: $colors.strong; $$detailsHeight: 280px; }
      .layout { grid-template-rows: minmax(0, 1fr) auto minmax(0, $$detailsHeight); }
      .resize {
        &:hover::before,
        &:focus-visible::before { background: red; }
      }
    `)

    expect(css).toContain('--safe-colors-strong:#fff')
    expect(css).toContain('--safe-colors-panel:#111')
    expect(css).toContain('--safe-colors-cyan:#0ff')
    expect(css).toContain('--safe-strong:var(--safe-colors-strong)')
    expect(css).toContain('minmax(0,var(--safe-details-height))')
    expect(css).toContain('.resize:hover::before,.resize:focus-visible::before')
    expect(css).not.toContain('$$')
    expect(css).not.toContain('&:hover')
  })

  it('hydrates theme CSS generated before document.head exists', async () => {
    document.head?.remove()
    reset()
    setup({ prefix: 'early', layers: false, theme: { colors: { strong: '#abcdef' } } })

    expect(getCssText()).toContain('--early-colors-strong')
    expect(document.getElementById('cipo-runtime-style')).toBeNull()

    const head = document.createElement('head')
    document.documentElement.insertBefore(head, document.body)
    document.dispatchEvent(new Event('readystatechange'))
    await Promise.resolve()

    expect(document.getElementById('cipo-runtime-style')?.textContent)
      .toContain('--early-colors-strong:#abcdef')
  })
})
