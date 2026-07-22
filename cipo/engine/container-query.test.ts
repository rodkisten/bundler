import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../index'
import {
  normalizeContainerContext,
  normalizeContainerQuery,
} from './container-query'

describe('container query shorthand', () => {
  beforeEach(() => {
    reset()
    setup({
      breakpoints: {
        base: null,
        md: '(min-width: 768px)',
      },
    })
  })

  it('maps semantic breakpoint comparisons to native queries', () => {
    expect(normalizeContainerQuery('card >= md')).toBe(
      'card (min-width: 768px)',
    )
    expect(normalizeContainerQuery('card <= md')).toBe(
      'card (max-width: 768px)',
    )
  })

  it('supports anonymous comparisons and literal dimensions', () => {
    expect(normalizeContainerQuery('>= 42rem')).toBe(
      '(min-width: 42rem)',
    )
  })

  it('builds named min/max/width container contexts', () => {
    expect(
      normalizeContainerContext(
        'card, min: md, max: 80rem',
      ),
    ).toBe(
      'card (min-width: 768px) and (max-width: 80rem)',
    )
    expect(normalizeContainerContext('card, width: 40rem')).toBe(
      'card (width: 40rem)',
    )
  })

  it('preserves native container query text when no shorthand matches', () => {
    const source = 'card style(--responsive: true)'
    expect(normalizeContainerQuery(source)).toBe(source)
  })
})
