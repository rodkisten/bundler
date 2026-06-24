import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '../src/index'
import { compileAtomicCss, compileAtomicRule, createAtomicRule, joinClassNames } from '../src/compiler/atomic-compile'

describe('Cipó compiler/atomic-compile', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'atom', minify: true, theme: { colors: { brand: '#f97316' }, spacing: '0.25rem' } })
  })

  it('creates cached atomic rules and compiles them', () => {
    const declaration = { type: 'declaration' as const, property: 'color', value: 'red', source: 'color:red' }
    const first = createAtomicRule(declaration, { pseudo: ':hover' })
    const second = createAtomicRule(declaration, { pseudo: ':hover' })

    expect(first).toBe(second)
    expect(compileAtomicRule(first)).toContain(`.${first.className}:hover{color:red;}`)
  })

  it('joins generated classes without duplicates', () => {
    const rule = createAtomicRule({ type: 'declaration', property: 'color', value: 'red', source: 'color:red' }, {})
    expect(joinClassNames([rule, rule], 'scope')).toBe(`scope ${rule.className}`)
  })

  it('compiles explicit atomic artifacts', () => {
    const artifact = compileAtomicCss([`px: 4; bg: $brand;`] as unknown as TemplateStringsArray, [], false)
    expect(artifact.kind).toBe('cipo.css')
    expect(artifact.compiledCss).toContain('padding-inline')
    expect(artifact.compiledCss).toContain('var(--atom-colors-brand)')
  })
})
