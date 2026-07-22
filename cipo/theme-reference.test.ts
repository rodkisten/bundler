import { beforeEach, describe, expect, it } from 'vitest'
import { reset, setup, theme } from './index'
import {
  resolveThemeReferencesForValue,
  toCssVar,
} from './theme-reference'
import { resolveThemeReferences } from './theme'

describe('theme reference language', () => {
  beforeEach(() => {
    reset()
    setup({ prefix: 'rod' })
    theme({
      colors: {
        foreground: '#111',
        muted: '#777',
      },
    })
  })

  it('resolves token fallback chains inside arbitrary CSS source', () => {
    expect(
      resolveThemeReferences(
        'color: $button.text ?? $muted ?? $foreground',
      ),
    ).toBe(
      [
        'color: var(--rod-button-text, ',
        'var(--rod-colors-muted, ',
        'var(--rod-colors-foreground)))',
      ].join(''),
    )
  })

  it('resolves exact fallback values with property-aware namespaces', () => {
    expect(
      resolveThemeReferencesForValue(
        '$unknown ?? $foreground',
        'color',
        'color',
      ),
    ).toBe(
      'var(--rod-colors-unknown, var(--rod-colors-foreground))',
    )
  })

  it('preserves runtime $$ variables for their dedicated pass', () => {
    expect(
      resolveThemeReferences(
        '$$progress<number>: 0; opacity: $$progress',
      ),
    ).toBe('$$progress<number>: 0; opacity: $$progress')
  })

  it('keeps ordinary text and explicit CSS variables unchanged', () => {
    expect(
      resolveThemeReferences('color: var(--external); content: "$token"'),
    ).toContain('var(--external)')
    expect(toCssVar('colors-foreground')).toBe(
      'var(--rod-colors-foreground)',
    )
  })
})
