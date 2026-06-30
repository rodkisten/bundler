import { beforeEach, describe, expect, it } from 'vitest'
import { atomic, css, getCssText, getDebugOverlayStats, isAtomicCssArtifact, reset, setup, sheet } from '../src/index'

describe('Cipó enterprise CSS features', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'ent',
      minify: true,
      layers: false,
      debug: { enabled: true, readableClassNames: true },
      atomic: { minUses: 1 },
      scope: { strategy: 'none', selector: '' },
      theme: { colors: { brand: '#7dd3fc', ink: '#e5e7eb' }, spacing: '0.25rem' },
    })
  })

  it('supports leading bang important declarations without duplicate priorities', () => {
    const card = css`
      !bg: $brand
      !px: 4
      color: $ink
    `

    expect(isAtomicCssArtifact(card)).toBe(true)
    if (!isAtomicCssArtifact(card)) throw new Error('Expected atomic artifact')

    expect(card.compiledCss).toContain('background:var(--ent-colors-brand) !important')
    expect(card.compiledCss).toContain('padding-inline:calc(var(--ent-spacing,0.25rem) * 4) !important')
    expect(card.compiledCss).not.toContain('!important !important')
  })

  it('promotes atoms only after the configured reuse threshold', () => {
    setup({ atomic: { minUses: 2 } })

    const first = atomic.css`bg: $brand`
    expect(first.atoms).toHaveLength(0)
    expect(first.scopedRules).toHaveLength(1)
    expect(String(first)).toContain('ent-s-')

    const second = atomic.css`bg: $brand`
    expect(second.atoms).toHaveLength(1)
    expect(second.scopedRules).toHaveLength(0)
    expect(String(second)).toContain('ent-background-var-ent-colors-brand')
  })

  it('scopes generated selectors with low-specificity :where wrappers', () => {
    setup({ scope: { strategy: 'where', selector: '.app-shell' } })

    const card = atomic.css`
      bg: $brand
      x:hover { color: $ink }
    `

    expect(card.compiledCss).toContain(':where(.app-shell) .')
    expect(card.compiledCss).toContain(':hover')

    const style = sheet.css`
      .card { px: 4 }
    `

    expect(String(style)).toContain(':where(.app-shell) .card')
  })

  it('keeps container-query authoring in the declaration-first Cipó style', () => {
    const style = sheet.css`
      .card {
        container: card / inline-size

        x:cq(md) {
          grid-template(cols: 1fr 1fr)
        }
      }
    `

    expect(String(style)).toContain('container:card / inline-size')
    expect(String(style)).toContain('@container md')
    expect(String(style)).toContain('grid-template-columns:1fr 1fr')
  })

  it('covers Tailwind-like helpers inside CSS declarations instead of class names', () => {
    const style = sheet.css`
      .utility {
        sr-only
        not-sr-only
        bg: color-sky-240
        text(nowrap)
        break(anywhere)
        ring: glow
        space-y: 2
      }
    `

    const output = String(style)
    expect(output).toContain('position:absolute')
    expect(output).toContain('position:static')
    expect(output).toContain('background:oklch')
    expect(output).toContain('white-space:nowrap')
    expect(output).toContain('overflow-wrap:anywhere')
    expect(output).toContain('row-gap:calc(var(--ent-spacing,0.25rem) * 2)')
  })

  it('exposes debug statistics for a mobile-friendly observability panel', () => {
    atomic.css`bg: $brand`
    atomic.css`color: $ink`

    const stats = getDebugOverlayStats()
    expect(stats.totalAtoms).toBeGreaterThanOrEqual(2)
    expect(stats.cssBytes).toBe(getCssText().length)
    expect(stats.insertedRules).toBeGreaterThan(0)
  })
})
