import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CipoWarning } from '../types'
const mocks = vi.hoisted(() => ({
  normalizeRuntimeExpression: vi.fn(
    (value: string) =>
      `normalized(${value})`,
  ),
}))
vi.mock('./math', () => ({
  normalizeRuntimeExpression:
    mocks.normalizeRuntimeExpression,
}))
import { expandRuntimeTokenObjects } from './tokens'
describe('runtime token objects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.normalizeRuntimeExpression.mockImplementation(
      (value: string) =>
        `normalized(${value})`,
    )
  })
  describe('basic expansion', () => {
    it('expands a flat token object into runtime token declarations', () => {
      const result =
        expand(
          '$theme(primary: red, secondary: blue)',
        )
      expect(result).toBe([
        '$$theme-primary: normalized(red)',
        '$$theme-secondary: normalized(blue)',
      ].join('\n'))
    })
    it('preserves declaration order from the source object', () => {
      const result =
        expand(
          '$spacing(sm: 4px, md: 8px, lg: 16px)',
        )
      expect(result).toBe([
        '$$spacing-sm: normalized(4px)',
        '$$spacing-md: normalized(8px)',
        '$$spacing-lg: normalized(16px)',
      ].join('\n'))
    })
    it('delegates every leaf value to normalizeRuntimeExpression', () => {
      expand(
        '$layout(width: 100% - $$gap, height: $$size)',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).toHaveBeenNthCalledWith(
        1,
        '100% - $$gap',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).toHaveBeenNthCalledWith(
        2,
        '$$size',
      )
    })
    it('preserves surrounding source text around token objects', () => {
      expect(
        expand(
          'before;$theme(primary: red);after;',
        ),
      ).toBe(
        'before;$$theme-primary: normalized(red);after;',
      )
    })
    it('expands multiple token objects independently', () => {
      expect(
        expand(
          [
            '$theme(primary: red)',
            '$spacing(sm: 4px)',
          ].join('\n'),
        ),
      ).toBe([
        '$$theme-primary: normalized(red)',
        '$$spacing-sm: normalized(4px)',
      ].join('\n'))
    })
    it('allows whitespace between the object name and opening parenthesis', () => {
      expect(
        expand(
          '$theme   (primary: red)',
        ),
      ).toBe(
        '$$theme-primary: normalized(red)',
      )
    })
  })
  describe('nested token objects', () => {
    it('flattens one nested token object level', () => {
      expect(
        expand(
          '$theme(colors: (primary: red, secondary: blue))',
        ),
      ).toBe([
        '$$theme-colors-primary: normalized(red)',
        '$$theme-colors-secondary: normalized(blue)',
      ].join('\n'))
    })
    it('flattens deeply nested token objects recursively', () => {
      expect(
        expand(
          '$theme(colors: (brand: (primary: red, secondary: blue)))',
        ),
      ).toBe([
        '$$theme-colors-brand-primary: normalized(red)',
        '$$theme-colors-brand-secondary: normalized(blue)',
      ].join('\n'))
    })
    it('preserves deterministic depth-first source order', () => {
      expect(
        expand(
          [
            '$tokens(',
            'colors: (',
            'primary: red,',
            'secondary: blue',
            '),',
            'spacing: (',
            'sm: 4px,',
            'md: 8px',
            ')',
            ')',
          ].join(''),
        ),
      ).toBe([
        '$$tokens-colors-primary: normalized(red)',
        '$$tokens-colors-secondary: normalized(blue)',
        '$$tokens-spacing-sm: normalized(4px)',
        '$$tokens-spacing-md: normalized(8px)',
      ].join('\n'))
    })
    it('supports sibling leaf and nested entries', () => {
      expect(
        expand(
          '$theme(default: black, colors: (primary: red), spacing: 8px)',
        ),
      ).toBe([
        '$$theme-default: normalized(black)',
        '$$theme-colors-primary: normalized(red)',
        '$$theme-spacing: normalized(8px)',
      ].join('\n'))
    })
  })
  describe('name normalization', () => {
    it('converts mixed-case entry keys to kebab case', () => {
      expect(
        expand(
          '$theme(primaryColor: red, surfaceColor: white)',
        ),
      ).toBe([
        '$$theme-primary-color: normalized(red)',
        '$$theme-surface-color: normalized(white)',
      ].join('\n'))
    })
    it('converts mixed-case nested keys to kebab case', () => {
      expect(
        expand(
          '$theme(colorPalette: (primaryColor: red))',
        ),
      ).toBe(
        '$$theme-color-palette-primary-color: normalized(red)',
      )
    })
    it('removes leading dollar signs from object entry keys', () => {
      expect(
        expand(
          '$theme($primary: red, $$secondary: blue)',
        ),
      ).toBe([
        '$$theme-primary: normalized(red)',
        '$$theme-secondary: normalized(blue)',
      ].join('\n'))
    })
    it('keeps the token-object root name as parsed from its identifier', () => {
      expect(
        expand(
          '$theme.primary(color: red)',
        ),
      ).toBe(
        '$$theme.primary-color: normalized(red)',
      )
    })
  })
  describe('top-level parsing', () => {
    it('does not split commas nested inside CSS functions', () => {
      expect(
        expand(
          '$theme(color: rgb(255, 0, 0), shadow: rgba(0, 0, 0, 0.5))',
        ),
      ).toBe([
        '$$theme-color: normalized(rgb(255, 0, 0))',
        '$$theme-shadow: normalized(rgba(0, 0, 0, 0.5))',
      ].join('\n'))
    })
    it('does not split commas inside quoted strings', () => {
      expect(
        expand(
          '$content(label: "hello, world", other: test)',
        ),
      ).toBe([
        '$$content-label: normalized("hello, world")',
        '$$content-other: normalized(test)',
      ].join('\n'))
    })
    it('uses only a top-level colon as the key/value separator', () => {
      expect(
        expand(
          '$theme(background: linear-gradient(red, var(--color: blue)))',
        ),
      ).toBe(
        '$$theme-background: normalized(linear-gradient(red, var(--color: blue)))',
      )
    })
    it('supports a trailing semicolon on individual object entries', () => {
      expect(
        expand(
          '$theme(primary: red;, secondary: blue;)',
        ),
      ).toBe([
        '$$theme-primary: normalized(red)',
        '$$theme-secondary: normalized(blue)',
      ].join('\n'))
    })
    it('ignores empty entries', () => {
      expect(
        expand(
          '$theme(, primary: red, , secondary: blue,)',
        ),
      ).toBe([
        '$$theme-primary: normalized(red)',
        '$$theme-secondary: normalized(blue)',
      ].join('\n'))
    })
    it('ignores malformed entries without a top-level colon', () => {
      expect(
        expand(
          '$theme(invalid, primary: red, also-invalid)',
        ),
      ).toBe(
        '$$theme-primary: normalized(red)',
      )
    })
    it('ignores entries whose colon appears at the first character', () => {
      expect(
        expand(
          '$theme(: invalid, primary: red)',
        ),
      ).toBe(
        '$$theme-primary: normalized(red)',
      )
    })
    it('returns an empty replacement for an empty token object', () => {
      expect(
        expand(
          'before;$theme();after;',
        ),
      ).toBe(
        'before;;after;',
      )
    })
  })
  describe('token-object detection', () => {
    it('does not interpret runtime variable references as token objects', () => {
      expect(
        expand(
          '$$theme(primary: red)',
        ),
      ).toBe(
        '$$theme(primary: red)',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).not.toHaveBeenCalled()
    })
    it('does not interpret a lone dollar sign as a token object', () => {
      expect(
        expand(
          '$(primary: red)',
        ),
      ).toBe(
        '$(primary: red)',
      )
    })
    it('requires a valid identifier start after the dollar sign', () => {
      expect(
        expand(
          '$123(primary: red)',
        ),
      ).toBe(
        '$123(primary: red)',
      )
    })
    it('does not interpret a dollar-prefixed identifier without parentheses as a token object', () => {
      expect(
        expand(
          '$theme + something',
        ),
      ).toBe(
        '$theme + something',
      )
    })
    it('does not expand token-object-like syntax inside double-quoted strings', () => {
      expect(
        expand(
          'content:"$theme(primary: red)";',
        ),
      ).toBe(
        'content:"$theme(primary: red)";',
      )
    })
    it('does not expand token-object-like syntax inside single-quoted strings', () => {
      expect(
        expand(
          "content:'$theme(primary: red)';",
        ),
      ).toBe(
        "content:'$theme(primary: red)';",
      )
    })
    it('continues scanning after quoted content', () => {
      expect(
        expand(
          '"$ignored(value: red)" $theme(primary: blue)',
        ),
      ).toBe(
        '"$ignored(value: red)" $$theme-primary: normalized(blue)',
      )
    })
  })
  describe('malformed input and warnings', () => {
    it('warns when a token object has an unclosed parenthesis', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeTokenObjects(
          '$theme(primary: red',
          warnings,
        )
      expect(result).toBe(
        '$theme(primary: red',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-token-object-unclosed',
          message:
            'Unclosed token object: theme',
        },
      ])
    })
    it('preserves preceding source before an unclosed token object', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeTokenObjects(
          'before;$theme(primary: red',
          warnings,
        )
      expect(result).toBe(
        'before;$theme(primary: red',
      )
      expect(warnings).toHaveLength(1)
    })
    it('stops after the first unclosed token object instead of partially scanning its body', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeTokenObjects(
          '$theme(primary: red $other(value: blue)',
          warnings,
        )
      expect(result).toBe(
        '$theme(primary: red $other(value: blue)',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-token-object-unclosed',
          message:
            'Unclosed token object: theme',
        },
      ])
    })
    it('does not throw for empty input', () => {
      expect(
        expand(''),
      ).toBe('')
    })
    it('preserves ordinary CSS without token objects', () => {
      const css =
        '.button{color:red;background:blue;}'
      expect(
        expand(css),
      ).toBe(css)
    })
    it('appends warnings without replacing pre-existing diagnostics', () => {
      const existing: CipoWarning = {
        code: 'existing',
        message: 'Existing warning',
      }
      const warnings = [
        existing,
      ]
      expandRuntimeTokenObjects(
        '$theme(primary: red',
        warnings,
      )
      expect(warnings).toEqual([
        existing,
        {
          code:
            'cipo-token-object-unclosed',
          message:
            'Unclosed token object: theme',
        },
      ])
      expect(warnings[0]).toBe(
        existing,
      )
    })
  })
  describe('runtime expression integration', () => {
    it('normalizes arithmetic leaf values independently', () => {
      expand(
        '$spacing(double: $$base * 2, half: $$base / 2)',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).toHaveBeenNthCalledWith(
        1,
        '$$base * 2',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).toHaveBeenNthCalledWith(
        2,
        '$$base / 2',
      )
    })
    it('does not normalize intermediate nested object bodies as expressions', () => {
      expand(
        '$theme(colors: (primary: red, secondary: blue))',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).toHaveBeenCalledTimes(2)
      expect(
        mocks.normalizeRuntimeExpression,
      ).not.toHaveBeenCalledWith(
        '(primary: red, secondary: blue)',
      )
    })
    it('normalizes each leaf exactly once', () => {
      expand(
        '$theme(a: 1, nested: (b: 2, c: 3))',
      )
      expect(
        mocks.normalizeRuntimeExpression,
      ).toHaveBeenCalledTimes(3)
      expect(
        mocks.normalizeRuntimeExpression.mock.calls,
      ).toEqual([
        ['1'],
        ['2'],
        ['3'],
      ])
    })
  })
  describe('determinism', () => {
    it('produces identical output for identical input', () => {
      const input =
        '$theme(colors: (primary: red), spacing: (sm: 4px))'
      const first =
        expand(input)
      const second =
        expand(input)
      expect(second).toBe(first)
    })
    it('does not mutate the warnings array when no warning is produced', () => {
      const warning: CipoWarning = {
        code: 'existing',
        message: 'Existing warning',
      }
      const warnings = [
        warning,
      ]
      expandRuntimeTokenObjects(
        '$theme(primary: red)',
        warnings,
      )
      expect(warnings).toEqual([
        warning,
      ])
      expect(warnings[0]).toBe(
        warning,
      )
    })
  })
  describe('regression contracts', () => {
    it(
      'ignores token-object syntax inside CSS comments',
      () => {
        const input = '/* $theme(primary: red) */ color: blue;'
        expect(expand(input)).toBe(input)
        expect(mocks.normalizeRuntimeExpression).not.toHaveBeenCalled()
      },
    )
    it(
      'uses escape parity instead of checking only the immediately preceding backslash while scanning quoted strings',
      () => {
        const input = String.raw`content: "value\\"; $theme(primary: red)`
        expect(expand(input)).toContain('$$theme-primary: normalized(red)')
      },
    )
    it(
      'defines whether quoted object keys such as "primary-color": red should be supported and unquoted before flattening',
      () => {
        expect(expand('$theme("primary-color": red)')).toBe('$$theme-primary-color: normalized(red)')
      },
    )
    it(
      'defines whether malformed nested object syntax with unmatched parentheses should emit a dedicated warning instead of being treated as a leaf expression',
      () => {
        const warnings: CipoWarning[] = []
        expandRuntimeTokenObjects('$theme(colors: (primary: red)', warnings)
        expect(warnings.some((warning) => warning.code === 'cipo-token-object-malformed-nesting')).toBe(true)
      },
    )
    it(
      'defines whether the root token-object name should also be canonicalized with toKebabMixed instead of preserving dots, underscores and casing',
      () => {
        expect(expand('$Theme_Palette(primary: red)')).toBe('$$theme-palette-primary: normalized(red)')
      },
    )
  })
})
function expand(
  input: string,
): string {
  return expandRuntimeTokenObjects(
    input,
    [],
  )
}
