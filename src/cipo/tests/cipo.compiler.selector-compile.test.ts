import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../src/index'
import { compileSelector, resolveScopedSelector, wrapContext } from '../src/compiler/selector-compile'

describe('Cipó compiler/selector-compile', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'sel', minify: true })
  })

  it('compiles selectors with pseudo and dark context', () => {
    expect(compileSelector('sel-a-1', { pseudo: ':hover' })).toBe('.sel-a-1:hover')
    expect(compileSelector('sel-a-1', { dark: true })).toBe('[data-theme="dark"] .sel-a-1')
  })

  it('wraps rule contexts in deterministic order', () => {
    const output = wrapContext('.a{color:red;}', {
      mediaQuery: '(min-width: 768px)',
      supports: '(display: grid)',
      container: 'card',
      layer: 'components',
    })

    expect(output).toContain('@media (min-width: 768px)')
    expect(output).toContain('@supports (display: grid)')
    expect(output).toContain('@container card')
    expect(output).toContain('@layer components')
  })

  it('resolves scoped selectors and ampersands', () => {
    expect(resolveScopedSelector('scope', '')).toBe('.scope')
    expect(resolveScopedSelector('scope', '.title')).toBe('.scope .title')
    expect(resolveScopedSelector('scope', '&:hover')).toBe('.scope:hover')
  })
})
