import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      prefix: 'cp',
    },
  },
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
import {
  normalizeRuntimeExpression,
  normalizeRuntimeVariableMath,
} from './math'
describe('runtime variable math normalization', () => {
  beforeEach(() => {
    mocks.runtime.config.prefix = 'cp'
  })
  describe('normalizeRuntimeExpression', () => {
    describe('runtime variable replacement', () => {
      it('replaces a runtime variable with its configured custom-property name', () => {
        expect(
          normalizeRuntimeExpression(
            '$$spacing',
          ),
        ).toBe(
          'var(--cp-spacing)',
        )
      })
      it('uses the active runtime prefix', () => {
        mocks.runtime.config.prefix =
          'application'
        expect(
          normalizeRuntimeExpression(
            '$$spacing',
          ),
        ).toBe(
          'var(--application-spacing)',
        )
      })
      it('converts mixed-case variable names to kebab case', () => {
        expect(
          normalizeRuntimeExpression(
            '$$primarySpacing',
          ),
        ).toBe(
          'var(--cp-primary-spacing)',
        )
      })
      it('normalizes dots in runtime variable names to hyphens', () => {
        expect(
          normalizeRuntimeExpression(
            '$$theme.primary',
          ),
        ).toBe(
          'var(--cp-theme-primary)',
        )
      })
      it('normalizes underscores in runtime variable names to hyphens', () => {
        expect(
          normalizeRuntimeExpression(
            '$$theme_primary',
          ),
        ).toBe(
          'var(--cp-theme-primary)',
        )
      })
      it('normalizes mixed dots and underscores before kebab conversion', () => {
        expect(
          normalizeRuntimeExpression(
            '$$theme.primary_value',
          ),
        ).toBe(
          'var(--cp-theme-primary-value)',
        )
      })
      it('replaces multiple runtime variables in one expression', () => {
        expect(
          normalizeRuntimeExpression(
            '$$spacing + $$gap',
          ),
        ).toBe(
          'calc(var(--cp-spacing) + var(--cp-gap))',
        )
      })
      it('replaces adjacent runtime variables independently', () => {
        expect(
          normalizeRuntimeExpression(
            '$$first $$second',
          ),
        ).toBe(
          'var(--cp-first) var(--cp-second)',
        )
      })
      it('does not replace a single-dollar token', () => {
        expect(
          normalizeRuntimeExpression(
            '$spacing',
          ),
        ).toBe(
          '$spacing',
        )
      })
      it('does not replace a double-dollar token without a valid identifier start', () => {
        expect(
          normalizeRuntimeExpression(
            '$$123',
          ),
        ).toBe(
          '$$123',
        )
      })
      it('preserves ordinary CSS variables', () => {
        expect(
          normalizeRuntimeExpression(
            'var(--spacing)',
          ),
        ).toBe(
          'var(--spacing)',
        )
      })
    })
    describe('math wrapping', () => {
      it.each([
        [
          '1rem + 2rem',
          'calc(1rem + 2rem)',
        ],
        [
          '10px * 2',
          'calc(10px * 2)',
        ],
        [
          '100% / 3',
          'calc(100% / 3)',
        ],
        [
          '$$spacing + 1rem',
          'calc(var(--cp-spacing) + 1rem)',
        ],
      ])(
        'wraps top-level mathematical expression %j in calc()',
        (
          input,
          expected,
        ) => {
          expect(
            normalizeRuntimeExpression(
              input,
            ),
          ).toBe(expected)
        },
      )
      it('recognizes subtraction only when surrounded by whitespace', () => {
        expect(
          normalizeRuntimeExpression(
            '100% - 2rem',
          ),
        ).toBe(
          'calc(100% - 2rem)',
        )
      })
      it('does not interpret a negative number as top-level subtraction', () => {
        expect(
          normalizeRuntimeExpression(
            '-10px',
          ),
        ).toBe(
          '-10px',
        )
      })
      it('does not interpret hyphenated identifiers as subtraction', () => {
        expect(
          normalizeRuntimeExpression(
            'fit-content',
          ),
        ).toBe(
          'fit-content',
        )
      })
      it('does not interpret custom-property names as subtraction', () => {
        expect(
          normalizeRuntimeExpression(
            'var(--layout-gap)',
          ),
        ).toBe(
          'var(--layout-gap)',
        )
      })
      it('does not wrap an expression that already starts with calc()', () => {
        expect(
          normalizeRuntimeExpression(
            'calc(100% - $$spacing)',
          ),
        ).toBe(
          'calc(100% - var(--cp-spacing))',
        )
      })
      it('does not double-wrap calc() after runtime variable replacement', () => {
        expect(
          normalizeRuntimeExpression(
            'calc($$size * 2)',
          ),
        ).toBe(
          'calc(var(--cp-size) * 2)',
        )
      })
      it('ignores mathematical operators nested inside functions', () => {
        expect(
          normalizeRuntimeExpression(
            'min(100%, 50% + 10px)',
          ),
        ).toBe(
          'min(100%, 50% + 10px)',
        )
      })
      it('ignores mathematical operators nested inside bracket expressions', () => {
        expect(
          normalizeRuntimeExpression(
            '[value+other]',
          ),
        ).toBe(
          '[value+other]',
        )
      })
      it('detects top-level math even when nested functions also contain operators', () => {
        expect(
          normalizeRuntimeExpression(
            'min(100%, 50% + 10px) + 2rem',
          ),
        ).toBe(
          'calc(min(100%, 50% + 10px) + 2rem)',
        )
      })
      it('does not interpret operators inside double-quoted strings as math', () => {
        expect(
          normalizeRuntimeExpression(
            '"1 + 2"',
          ),
        ).toBe(
          '"1 + 2"',
        )
      })
      it('does not interpret operators inside single-quoted strings as math', () => {
        expect(
          normalizeRuntimeExpression(
            "'1 + 2'",
          ),
        ).toBe(
          "'1 + 2'",
        )
      })
      it('trims surrounding whitespace before normalization', () => {
        expect(
          normalizeRuntimeExpression(
            '   $$spacing + 1rem   ',
          ),
        ).toBe(
          'calc(var(--cp-spacing) + 1rem)',
        )
      })
      it('returns an empty string for empty input', () => {
        expect(
          normalizeRuntimeExpression(
            '',
          ),
        ).toBe('')
      })
    })
  })
  describe('normalizeRuntimeVariableMath', () => {
    it('normalizes a declaration value containing a runtime variable', () => {
      expect(
        normalizeRuntimeVariableMath(
          'padding: $$spacing;',
        ),
      ).toBe(
        'padding: var(--cp-spacing);',
      )
    })
    it('wraps declaration math in calc()', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width: 100% - 2rem;',
        ),
      ).toBe(
        'width: calc(100% - 2rem);',
      )
    })
    it('replaces variables before deciding whether calc() is required', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width: $$fullWidth - $$gap;',
        ),
      ).toBe(
        'width: calc(var(--cp-full-width) - var(--cp-gap));',
      )
    })
    it('normalizes multiple semicolon-separated declarations independently', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width: $$size * 2;height: $$size;',
        ),
      ).toBe(
        'width: calc(var(--cp-size) * 2);height: var(--cp-size);',
      )
    })
    it('normalizes newline-separated declarations independently', () => {
      expect(
        normalizeRuntimeVariableMath(
          [
            'width: $$size * 2',
            'height: $$size',
          ].join('\n'),
        ),
      ).toBe([
        'width: calc(var(--cp-size) * 2)',
        'height: var(--cp-size)',
      ].join('\n'))
    })
    it('preserves declaration text before the colon', () => {
      expect(
        normalizeRuntimeVariableMath(
          '  width   : $$size;',
        ),
      ).toBe(
        '  width   : var(--cp-size);',
      )
    })
    it('adds one canonical space between the colon and normalized value', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width:$$size;',
        ),
      ).toBe(
        'width: var(--cp-size);',
      )
    })
    it('does not modify a chunk without a declaration colon', () => {
      expect(
        normalizeRuntimeVariableMath(
          '$$spacing + 1rem;',
        ),
      ).toBe(
        '$$spacing + 1rem;',
      )
    })
    it('does not modify a declaration with an empty value', () => {
      expect(
        normalizeRuntimeVariableMath(
          'color:;',
        ),
      ).toBe(
        'color:;',
      )
    })
    it('does not normalize chunks containing an opening brace', () => {
      expect(
        normalizeRuntimeVariableMath(
          '.button{padding: $$spacing;',
        ),
      ).toBe(
        '.button{padding: $$spacing;',
      )
    })
    it('does not normalize chunks containing a closing brace', () => {
      expect(
        normalizeRuntimeVariableMath(
          '}padding: $$spacing;',
        ),
      ).toBe(
        '}padding: $$spacing;',
      )
    })
    it('preserves selectors and full blocks instead of rewriting their declarations', () => {
      expect(
        normalizeRuntimeVariableMath(
          '.button{padding: $$spacing;}',
        ),
      ).toBe(
        '.button{padding: $$spacing;}',
      )
    })
    it('normalizes declarations that appear outside block syntax around untouched blocks', () => {
      expect(
        normalizeRuntimeVariableMath(
          [
            'width: $$size;',
            '.button{padding: $$spacing;}',
            'height: $$size;',
          ].join('\n'),
        ),
      ).toBe([
        'width: var(--cp-size);',
        '.button{padding: $$spacing;}',
        'height: var(--cp-size);',
      ].join('\n'))
    })
    it('preserves the final chunk when input has no trailing delimiter', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width: $$size',
        ),
      ).toBe(
        'width: var(--cp-size)',
      )
    })
    it('preserves semicolon delimiters', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width: $$size;height: $$size;',
        ),
      ).toBe(
        'width: var(--cp-size);height: var(--cp-size);',
      )
    })
    it('preserves newline delimiters', () => {
      expect(
        normalizeRuntimeVariableMath(
          'width: $$size\nheight: $$size',
        ),
      ).toBe(
        'width: var(--cp-size)\nheight: var(--cp-size)',
      )
    })
    it('handles empty input', () => {
      expect(
        normalizeRuntimeVariableMath(
          '',
        ),
      ).toBe('')
    })
    it('preserves whitespace-only input', () => {
      expect(
        normalizeRuntimeVariableMath(
          '   ',
        ),
      ).toBe(
        '   ',
      )
    })
  })
  describe('expression integration', () => {
    it('normalizes complex runtime variable arithmetic deterministically', () => {
      const input =
        '$$layout.contentWidth - $$layout.sideBarWidth + 2rem'
      expect(
        normalizeRuntimeExpression(
          input,
        ),
      ).toBe(
        'calc(var(--cp-layout-content-width) - var(--cp-layout-side-bar-width) + 2rem)',
      )
    })
    it('supports runtime variables inside existing CSS math functions', () => {
      expect(
        normalizeRuntimeExpression(
          'clamp($$minSize, 50vw, $$maxSize)',
        ),
      ).toBe(
        'clamp(var(--cp-min-size), 50vw, var(--cp-max-size))',
      )
    })
    it('supports a nested function followed by top-level arithmetic', () => {
      expect(
        normalizeRuntimeExpression(
          'clamp($$min, 50vw, $$max) / 2',
        ),
      ).toBe(
        'calc(clamp(var(--cp-min), 50vw, var(--cp-max)) / 2)',
      )
    })
    it('does not mutate already-normalized ordinary CSS', () => {
      const value =
        'linear-gradient(red, blue)'
      expect(
        normalizeRuntimeExpression(
          value,
        ),
      ).toBe(value)
    })
    it('is deterministic for identical input and runtime configuration', () => {
      const input =
        '$$spacing * 2 + 1rem'
      const first =
        normalizeRuntimeExpression(
          input,
        )
      const second =
        normalizeRuntimeExpression(
          input,
        )
      expect(second).toBe(first)
    })
    it('reflects prefix changes without retaining stale variable names', () => {
      const first =
        normalizeRuntimeExpression(
          '$$spacing',
        )
      mocks.runtime.config.prefix =
        'app'
      const second =
        normalizeRuntimeExpression(
          '$$spacing',
        )
      expect(first).toBe(
        'var(--cp-spacing)',
      )
      expect(second).toBe(
        'var(--app-spacing)',
      )
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'does not split declaration chunks at semicolons inside quoted strings',
    )
    it.todo(
      'does not split declaration chunks at semicolons inside nested function arguments',
    )
    it.todo(
      'normalizes declarations inside stylesheet blocks when this transform is intended to operate on full CSS rather than declaration fragments',
    )
    it.todo(
      'uses escape parity instead of checking only the immediately preceding backslash when scanning quoted expressions',
    )
    it.todo(
      'defines whether subtraction without surrounding whitespace such as 100%-2rem should be recognized as CSS math',
    )
  })
})
