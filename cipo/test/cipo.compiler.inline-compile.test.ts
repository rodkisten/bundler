import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup } from '@rodkisten/cipo'
import { collectInlineCss, compileInlineCss } from '@rodkisten/cipo/compiler'
import { parseStylesheet } from '../syntax/parser'
import { normalizeDeclarationSpacing } from './css-test-utils'

describe('Cipó compiler/inline-compile', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'inlinec', minify: true, theme: { colors: { brand: '#f97316' }, spacing: '0.25rem' } })
  })

  it('collects top-level inline declarations only', () => {
    const ast = parseStylesheet('color: red; .nested { color: blue }', [])
    expect(normalizeDeclarationSpacing(collectInlineCss(ast)))
      .toBe('color:red;')
  })

  it('compiles inline template and style object inputs', () => {
    expect(String(compileInlineCss([`px: 2; color: $brand;`] as unknown as TemplateStringsArray, [], false))).toContain('padding-inline')
    expect(String(compileInlineCss({ px: 2, color: '$brand' }, [], false))).toContain('var(--inlinec-colors-brand)')
  })
})
