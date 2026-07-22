import { describe, expect, it } from 'vitest'
import type { CipoWarning } from '../types'
import { expandRuntimeMotion } from './motion'

function expand(source: string): {
  readonly css: string
  readonly warnings: CipoWarning[]
} {
  const warnings: CipoWarning[] = []
  return {
    css: expandRuntimeMotion(source, warnings),
    warnings,
  }
}

describe('runtime motion shorthand', () => {
  it('emits final state, starting style and transitions', () => {
    const { css, warnings } = expand(`
      motion(
        opacity: 0 -> 1,
        x: -8px -> 0,
        y: 12px -> 0,
        scale: 0.96 -> 1,
        duration: 240ms,
        easing: ease-out,
        delay: 40ms
      )
    `)

    expect(css).toContain('opacity: 1')
    expect(css).toContain('translate: 0 0')
    expect(css).toContain('scale: 1')
    expect(css).toContain(
      'transition-property: opacity, translate, scale',
    )
    expect(css).toContain('transition-duration: 240ms')
    expect(css).toContain('transition-delay: 40ms')
    expect(css).toContain('starting-style {')
    expect(css).toContain('translate: -8px 12px')
    expect(css).toContain('reduce-motion {')
    expect(warnings).toEqual([])
  })

  it('can explicitly opt out of reduced-motion overrides', () => {
    const { css } = expand(`
      motion(
        opacity: 0 -> 1,
        duration: 120ms,
        reduce: false
      )
    `)

    expect(css).not.toContain('reduce-motion')
  })

  it('expands reusable built-in motion presets', () => {
    const { css, warnings } = expand('motion($pop)')

    expect(css).toContain('opacity: 1')
    expect(css).toContain('scale: 1')
    expect(css).toContain('starting-style {')
    expect(warnings).toEqual([])
  })

  it('warns without producing invalid CSS for empty motion calls', () => {
    const { css, warnings } = expand('motion(duration: 200ms)')

    expect(css).toBe('')
    expect(warnings).toContainEqual({
      code: 'cipo-motion-empty',
      message: 'motion() needs at least one `property: from -> to` pair.',
    })
  })

  it('keeps malformed unclosed motion source visible for debugging', () => {
    const { css, warnings } = expand('motion(opacity: 0 -> 1')

    expect(css).toBe('motion(opacity: 0 -> 1')
    expect(warnings[0]?.code).toBe('cipo-motion-unclosed')
  })
})
