import { describe, expect, it } from 'vitest'
import { benchmark, explainDetailed, reset, setup, sheet } from '../src/index'

describe('Cipó sheet feature APIs', () => {
  it('compiles scoped stylesheets', () => {
    reset()
    setup({ prefix: 'rod', theme: { colors: { brand: '#f97316' }, spacing: '0.25rem' } })
    const cssText = String(sheet.css.scoped('.scope')`
      .card {
        px: 4
        color: $colors.brand
      }
    `)
    expect(cssText).toContain('.scope .card')
    expect(cssText).toContain('padding-inline')
    expect(cssText).toContain('var(--rod-colors-brand)')
  })

  it('wraps stylesheet output in layers', () => {
    reset()
    const cssText = String(sheet.css.layer('components')`
      .card { color: red }
    `)
    expect(cssText).toContain('@layer components')
    expect(cssText).toContain('.card')
  })

  it('explains detailed phases and benchmarks compile loops', () => {
    const details = explainDetailed('.card { color: red }', 'stylesheet')
    expect(details.phases.map((phase) => phase.name)).toEqual(['raw', 'transformed', 'compiled'])
    const timing = benchmark('color: red', 2, 'atomic')
    expect(timing.iterations).toBe(2)
    expect(timing.averageMs).toBeGreaterThanOrEqual(0)
  })
})
