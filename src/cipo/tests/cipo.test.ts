import { describe, expect, it, beforeEach } from 'vitest'
import { css, getCssText, inline, isAtomicCssArtifact, registerAlias, reset, setup } from '../src/index'

describe('Cipó next', () => {
  beforeEach(() => {
    reset()
    setup({
      prefix: 'test',
      minify: true,
      layers: true,
      theme: {
        colors: { brand: '#f97316', ink: '#fff', panel: '#111' },
        spacing: '0.25rem',
        radius: { xl: '24px' },
      },
    })
  })

  it('keeps css tagged template API', () => {
    const card = css`color:red;`
    expect(String(card)).toContain('test-a-')
    expect(getCssText()).toContain('color:red')
  })

  it('supports token inference and property aliases', () => {
    const card = css`px:4;bg:$brand;rounded:$xl;`
    expect(isAtomicCssArtifact(card)).toBe(true)
    if (!isAtomicCssArtifact(card)) throw new Error('Expected atomic artifact')
    expect(card.compiledCss).toContain('padding-inline')
    expect(card.compiledCss).toContain('var(--test-colors-brand)')
  })

  it('supports standalone aliases', () => {
    registerAlias('demoGlass', 'bg:alpha($panel / 50%);')
    const card = css`demoGlass;`
    expect(isAtomicCssArtifact(card)).toBe(true)
    if (!isAtomicCssArtifact(card)) throw new Error('Expected atomic artifact')
    expect(card.compiledCss).toContain('color-mix')
  })

  it('supports inline.css', () => {
    const style = inline.css`px:2;color:$brand;`
    expect(String(style)).toContain('padding-inline')
    expect(String(style)).toContain('var(--test-colors-brand)')
  })

  it('supports variants', () => {
    const button = css`x:hover{bg:$brand;}x:md{px:6;}`
    expect(isAtomicCssArtifact(button)).toBe(true)
    if (!isAtomicCssArtifact(button)) throw new Error('Expected atomic artifact')
    expect(button.compiledCss).toContain(':hover')
    expect(button.compiledCss).toContain('@media')
  })

  it('handles comments, dollar aliases, raw property escape and helpers without semicolons', () => {
    const button = css`
      px: 4
      py: 2
      bg: $brand
      color: saturate($brand, 20%)
      /* bg: alpha($brand / 14%) */
      #box-shadow: outlineGlow($brand)
      $glassCard
      bleed: -4

      /*
      x:focus-visible {
        box-shadow: outlineGlow($brand)
      }

      x:hover {
        bg: alpha($brand / 72%)
      }
      */
    `

    expect(isAtomicCssArtifact(button)).toBe(true)
    if (!isAtomicCssArtifact(button)) throw new Error('Expected atomic artifact')
    expect(button.compiledCss).toContain('padding-inline')
    expect(button.compiledCss).toContain('padding-block')
    expect(button.compiledCss).toContain('background')
    expect(button.compiledCss).toContain('color-mix')
    expect(button.compiledCss).toContain('box-shadow')
    expect(button.compiledCss).toContain('margin')
  })

  it('supports active x blocks and alpha helpers without browser-freezing recursion', () => {
    const button = css`
      px: 4
      x:focus-visible {
        box-shadow: outlineGlow($brand)
      }
      x:hover {
        bg: alpha($brand / 72%)
      }
      x:md {
        px: 6
      }
      x:not(md) {
        width: 100%
      }
    `

    expect(isAtomicCssArtifact(button)).toBe(true)
    if (!isAtomicCssArtifact(button)) throw new Error('Expected atomic artifact')
    expect(button.compiledCss).toContain(':focus-visible')
    expect(button.compiledCss).toContain(':hover')
    expect(button.compiledCss).toContain('@media')
    expect(button.compiledCss).toContain('not all and')
  })

})
