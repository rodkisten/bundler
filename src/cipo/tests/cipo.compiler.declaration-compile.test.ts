import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../src/index'
import { expandResponsiveDeclaration, resolveBreakpointContext } from '../src/compiler/declaration-compile'

describe('Cipó compiler/declaration-compile', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'decl', minify: true })
  })

  it('expands responsive declaration values only for known breakpoints', () => {
    const result = expandResponsiveDeclaration({ type: 'declaration', property: 'padding-inline', value: '1rem, x:md(2rem)', source: 'px' })

    expect(result).toEqual([
      { breakpoint: 'base', value: '1rem' },
      { breakpoint: 'md', value: '2rem' },
    ])
  })

  it('returns null for non-responsive declarations', () => {
    expect(expandResponsiveDeclaration({ type: 'declaration', property: 'color', value: 'red', source: 'color:red' })).toBeNull()
  })

  it('applies configured breakpoint context', () => {
    expect(resolveBreakpointContext({}, 'md')).toEqual({ breakpoint: 'md', mediaQuery: '(min-width: 768px)' })
  })
})
