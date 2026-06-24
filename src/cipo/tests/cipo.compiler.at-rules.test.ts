import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../src/index'
import { collectRules } from '../src/compiler/at-rules'
import { parseStylesheet } from '../src/parser'

describe('Cipó compiler/at-rules', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'ctx', minify: true, theme: { colors: { brand: '#f97316' }, spacing: '0.25rem' } })
  })

  it('collects atomic rules from runtime context blocks', () => {
    const warnings = []
    const ast = parseStylesheet('x:hover { color: red } x:md { px: 4 }', warnings)
    const result = collectRules(ast, 'scope', warnings)

    expect(result.atoms.some(atom => atom.context.pseudo === ':hover')).toBe(true)
    expect(result.atoms.some(atom => atom.context.breakpoint === 'md')).toBe(true)
  })

  it('collects scoped rules from nested selector blocks', () => {
    const warnings = []
    const ast = parseStylesheet('.title { color: red }', warnings)
    const result = collectRules(ast, 'scope', warnings)

    expect(result.scopedRules[0]?.selector).toBe('.scope .title')
  })
})
