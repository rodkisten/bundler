import { describe, expect, it } from 'vitest'
import {
  findMatching,
  findTopLevelChar,
  isIdentifierPart,
  isIdentifierStart,
  isParamBoundary,
  readIdentifierEnd,
  skipSpaces,
} from './shared'
describe('runtime parser shared utilities', () => {
  describe('findTopLevelChar', () => {
    it('finds a target character at the top level', () => {
      expect(
        findTopLevelChar(
          'name:value',
          ':',
        ),
      ).toBe(4)
    })
    it('returns the first matching top-level character', () => {
      expect(
        findTopLevelChar(
          'first:second:third',
          ':',
        ),
      ).toBe(5)
    })
    it('returns -1 when the target does not exist', () => {
      expect(
        findTopLevelChar(
          'name-value',
          ':',
        ),
      ).toBe(-1)
    })
    it('ignores targets nested inside parentheses', () => {
      expect(
        findTopLevelChar(
          'function(value: nested): outside',
          ':',
        ),
      ).toBe(
        'function(value: nested)'.length,
      )
    })
    it('ignores targets nested inside brackets', () => {
      expect(
        findTopLevelChar(
          '[data-value="a:b"]:outside',
          ':',
        ),
      ).toBe(
        '[data-value="a:b"]'.length,
      )
    })
    it('ignores targets nested inside braces', () => {
      expect(
        findTopLevelChar(
          '{name:value}:outside',
          ':',
        ),
      ).toBe(
        '{name:value}'.length,
      )
    })
    it('handles multiple levels of mixed nesting', () => {
      const input =
        'outer([a:{b:c}], fn(d:e)): result'
      expect(
        findTopLevelChar(
          input,
          ':',
        ),
      ).toBe(
        input.indexOf(
          ': result',
        ),
      )
    })
    it('ignores targets inside double-quoted strings', () => {
      expect(
        findTopLevelChar(
          '"name:value":outside',
          ':',
        ),
      ).toBe(
        '"name:value"'.length,
      )
    })
    it('ignores targets inside single-quoted strings', () => {
      expect(
        findTopLevelChar(
          "'name:value':outside",
          ':',
        ),
      ).toBe(
        "'name:value'".length,
      )
    })
    it('ignores brackets and targets inside quoted strings', () => {
      const input =
        '"{[(name:value)]}":outside'
      expect(
        findTopLevelChar(
          input,
          ':',
        ),
      ).toBe(
        '"{[(name:value)]}"'.length,
      )
    })
    it('preserves escaped quotes while scanning quoted text', () => {
      const input =
        String.raw`"name:\"value:inside\"":outside`
      expect(
        findTopLevelChar(
          input,
          ':',
        ),
      ).toBe(
        input.lastIndexOf(':'),
      )
    })
    it('finds a comma only when it is outside nested CSS functions', () => {
      const input =
        'linear-gradient(red, blue), fallback'
      expect(
        findTopLevelChar(
          input,
          ',',
        ),
      ).toBe(
        input.indexOf(
          ', fallback',
        ),
      )
    })
    it('finds a colon after complex nested function arguments', () => {
      const input =
        'query: style(--theme: var(--value, dark))'
      expect(
        findTopLevelChar(
          input,
          ':',
        ),
      ).toBe(5)
    })
    it('returns -1 when every occurrence is nested', () => {
      expect(
        findTopLevelChar(
          'fn(a:b, nested(c:d))',
          ':',
        ),
      ).toBe(-1)
    })
    it('returns -1 for an empty input', () => {
      expect(
        findTopLevelChar(
          '',
          ':',
        ),
      ).toBe(-1)
    })
    it('does not allow unmatched closing delimiters to make depth negative', () => {
      expect(
        findTopLevelChar(
          ')]:outside',
          ':',
        ),
      ).toBe(2)
    })
  })
  describe('findMatching', () => {
    it('finds a matching parenthesis', () => {
      expect(
        findMatching(
          'fn(value)',
          2,
          '(',
          ')',
        ),
      ).toBe(8)
    })
    it('finds a matching brace', () => {
      expect(
        findMatching(
          'block{color:red;}',
          5,
          '{',
          '}',
        ),
      ).toBe(
        'block{color:red;}'.length - 1,
      )
    })
    it('finds a matching bracket', () => {
      expect(
        findMatching(
          '[data-value]',
          0,
          '[',
          ']',
        ),
      ).toBe(
        '[data-value]'.length - 1,
      )
    })
    it('returns -1 when openIndex does not point to the expected opening delimiter', () => {
      expect(
        findMatching(
          'fn(value)',
          0,
          '(',
          ')',
        ),
      ).toBe(-1)
    })
    it('returns -1 for an unclosed delimiter', () => {
      expect(
        findMatching(
          'fn(value',
          2,
          '(',
          ')',
        ),
      ).toBe(-1)
    })
    it('handles nested delimiters of the same type', () => {
      const input =
        'fn(outer(inner(value)))'
      expect(
        findMatching(
          input,
          2,
          '(',
          ')',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('handles deeply nested blocks', () => {
      const input =
        '{first{second{third}}}'
      expect(
        findMatching(
          input,
          0,
          '{',
          '}',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('ignores matching delimiters inside double-quoted strings', () => {
      const input =
        'fn(")")'
      expect(
        findMatching(
          input,
          2,
          '(',
          ')',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('ignores matching delimiters inside single-quoted strings', () => {
      const input =
        "fn(')')"
      expect(
        findMatching(
          input,
          2,
          '(',
          ')',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('ignores opening delimiters inside quoted strings', () => {
      const input =
        'fn("(")'
      expect(
        findMatching(
          input,
          2,
          '(',
          ')',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('ignores braces inside quoted block content', () => {
      const input =
        '{content:"}";color:red;}'
      expect(
        findMatching(
          input,
          0,
          '{',
          '}',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('preserves escaped quotes while finding the closing delimiter', () => {
      const input =
        String.raw`fn("escaped \") still quoted")`
      expect(
        findMatching(
          input,
          2,
          '(',
          ')',
        ),
      ).toBe(
        input.length - 1,
      )
    })
    it('supports a non-zero opening index', () => {
      const input =
        'prefix fn(value) suffix'
      const open =
        input.indexOf('(')
      expect(
        findMatching(
          input,
          open,
          '(',
          ')',
        ),
      ).toBe(
        input.indexOf(')'),
      )
    })
    it('returns the innermost matching delimiter when started from an inner opening delimiter', () => {
      const input =
        'outer(inner(value))'
      const innerOpen =
        input.indexOf(
          '(',
          input.indexOf('(') + 1,
        )
      expect(
        input.slice(
          innerOpen,
          findMatching(
            input,
            innerOpen,
            '(',
            ')',
          ) + 1,
        ),
      ).toBe(
        '(value)',
      )
    })
  })
  describe('readIdentifierEnd', () => {
    it('returns the end of a simple identifier', () => {
      expect(
        readIdentifierEnd(
          'identifier rest',
          0,
        ),
      ).toBe(
        'identifier'.length,
      )
    })
    it('supports digits after the identifier start', () => {
      expect(
        readIdentifierEnd(
          'token123 rest',
          0,
        ),
      ).toBe(
        'token123'.length,
      )
    })
    it('supports underscores', () => {
      expect(
        readIdentifierEnd(
          'theme_primary rest',
          0,
        ),
      ).toBe(
        'theme_primary'.length,
      )
    })
    it('supports dots', () => {
      expect(
        readIdentifierEnd(
          'theme.primary rest',
          0,
        ),
      ).toBe(
        'theme.primary'.length,
      )
    })
    it('supports hyphens', () => {
      expect(
        readIdentifierEnd(
          'primary-color rest',
          0,
        ),
      ).toBe(
        'primary-color'.length,
      )
    })
    it('supports mixed identifier-part characters', () => {
      const identifier =
        'theme.primary_color-500'
      expect(
        readIdentifierEnd(
          `${identifier}: value`,
          0,
        ),
      ).toBe(
        identifier.length,
      )
    })
    it('starts scanning at the requested offset', () => {
      const input =
        'prefix identifier suffix'
      const start =
        input.indexOf(
          'identifier',
        )
      expect(
        readIdentifierEnd(
          input,
          start,
        ),
      ).toBe(
        start
        + 'identifier'.length,
      )
    })
    it('returns start unchanged when the first character is not an identifier part', () => {
      expect(
        readIdentifierEnd(
          ':value',
          0,
        ),
      ).toBe(0)
    })
    it('returns input length when the identifier reaches end of input', () => {
      const input =
        'identifier'
      expect(
        readIdentifierEnd(
          input,
          0,
        ),
      ).toBe(
        input.length,
      )
    })
  })
  describe('skipSpaces', () => {
    it('skips ordinary spaces', () => {
      expect(
        skipSpaces(
          '   value',
          0,
        ),
      ).toBe(3)
    })
    it('skips tabs', () => {
      expect(
        skipSpaces(
          '\t\tvalue',
          0,
        ),
      ).toBe(2)
    })
    it('skips newlines', () => {
      expect(
        skipSpaces(
          '\n\nvalue',
          0,
        ),
      ).toBe(2)
    })
    it('skips mixed whitespace', () => {
      const input =
        ' \t\r\n  value'
      expect(
        skipSpaces(
          input,
          0,
        ),
      ).toBe(
        input.indexOf(
          'value',
        ),
      )
    })
    it('starts scanning from the provided offset', () => {
      const input =
        'prefix   value'
      const start =
        'prefix'.length
      expect(
        skipSpaces(
          input,
          start,
        ),
      ).toBe(
        input.indexOf(
          'value',
        ),
      )
    })
    it('returns start unchanged when no whitespace exists', () => {
      expect(
        skipSpaces(
          'value',
          0,
        ),
      ).toBe(0)
    })
    it('returns input length when only whitespace remains', () => {
      const input =
        'value   '
      expect(
        skipSpaces(
          input,
          'value'.length,
        ),
      ).toBe(
        input.length,
      )
    })
    it('handles a start index at the end of input', () => {
      expect(
        skipSpaces(
          'value',
          5,
        ),
      ).toBe(5)
    })
  })
  describe('isIdentifierStart', () => {
    it.each([
      'a',
      'z',
      'A',
      'Z',
      '_',
    ])(
      'accepts %j as an identifier-start character',
      (value) => {
        expect(
          isIdentifierStart(
            value,
          ),
        ).toBe(true)
      },
    )
    it.each([
      '',
      '0',
      '9',
      '.',
      '-',
      '$',
      '#',
      ':',
      ' ',
    ])(
      'rejects %j as an identifier-start character',
      (value) => {
        expect(
          isIdentifierStart(
            value,
          ),
        ).toBe(false)
      },
    )
  })
  describe('isIdentifierPart', () => {
    it.each([
      'a',
      'Z',
      '0',
      '9',
      '_',
      '.',
      '-',
    ])(
      'accepts %j as an identifier-part character',
      (value) => {
        expect(
          isIdentifierPart(
            value,
          ),
        ).toBe(true)
      },
    )
    it.each([
      '',
      '$',
      '#',
      ':',
      '/',
      ' ',
      '(',
      ')',
    ])(
      'rejects %j as an identifier-part character',
      (value) => {
        expect(
          isIdentifierPart(
            value,
          ),
        ).toBe(false)
      },
    )
  })
  describe('isParamBoundary', () => {
    it.each([
      '',
      ' ',
      ':',
      ',',
      '(',
      ')',
      '[',
      ']',
      '{',
      '}',
      '-',
      '$',
      '#',
      '/',
    ])(
      'accepts %j as a parameter boundary',
      (value) => {
        expect(
          isParamBoundary(
            value,
          ),
        ).toBe(true)
      },
    )
    it.each([
      'a',
      'Z',
      '0',
      '9',
      '_',
      '.',
    ])(
      'rejects %j as a parameter boundary',
      (value) => {
        expect(
          isParamBoundary(
            value,
          ),
        ).toBe(false)
      },
    )
    it('intentionally treats hyphen as a parameter boundary even though it is a valid identifier part', () => {
      expect(
        isIdentifierPart(
          '-',
        ),
      ).toBe(true)
      expect(
        isParamBoundary(
          '-',
        ),
      ).toBe(true)
    })
  })
  describe('scanner integration', () => {
    it('can locate a function call argument range using identifier and delimiter helpers', () => {
      const input =
        'palette(primary, blue)'
      const nameEnd =
        readIdentifierEnd(
          input,
          0,
        )
      const open =
        skipSpaces(
          input,
          nameEnd,
        )
      const close =
        findMatching(
          input,
          open,
          '(',
          ')',
        )
      expect(
        input.slice(
          0,
          nameEnd,
        ),
      ).toBe(
        'palette',
      )
      expect(
        input.slice(
          open + 1,
          close,
        ),
      ).toBe(
        'primary, blue',
      )
    })
    it('can find a top-level key/value separator inside a parsed function argument', () => {
      const input =
        'provide(theme: var(--fallback, "dark:value"))'
      const open =
        input.indexOf('(')
      const close =
        findMatching(
          input,
          open,
          '(',
          ')',
        )
      const args =
        input.slice(
          open + 1,
          close,
        )
      const colon =
        findTopLevelChar(
          args,
          ':',
        )
      expect(
        args.slice(
          0,
          colon,
        ),
      ).toBe(
        'theme',
      )
      expect(
        args.slice(
          colon + 1,
        ).trim(),
      ).toBe(
        'var(--fallback, "dark:value")',
      )
    })
    it('can parse nested DSL delimiters without mistaking quoted punctuation for structure', () => {
      const input =
        'compound(theme: "a:b", query: fn([x:y]))'
      const open =
        input.indexOf('(')
      const close =
        findMatching(
          input,
          open,
          '(',
          ')',
        )
      expect(close).toBe(
        input.length - 1,
      )
      const args =
        input.slice(
          open + 1,
          close,
        )
      expect(
        findTopLevelChar(
          args,
          ':',
        ),
      ).toBe(
        'theme'.length,
      )
    })
  })
  describe('regression contracts', () => {
    it(
      'findTopLevelChar uses delimiter-specific stacks so mismatched mixed brackets cannot incorrectly return to top-level depth',
      () => {
        expect(findTopLevelChar('fn([)]):outside', ':')).toBe(-1)
      },
    )
    it(
      'findMatching ignores matching delimiter characters nested inside different bracket families',
      () => {
        const input = '(value[)]tail)'
        expect(findMatching(input, 0, '(', ')')).toBe(input.length - 1)
      },
    )
    it(
      'findTopLevelChar and findMatching use escape parity instead of checking only the immediately preceding backslash',
      () => {
        const input = String.raw`"value\\":outside`
        expect(findTopLevelChar(input, ':')).toBe(input.indexOf(':'))
        const wrapped = String.raw`("value\\")`
        expect(findMatching(wrapped, 0, '(', ')')).toBe(wrapped.length - 1)
      },
    )
    it(
      'findTopLevelChar and findMatching treat CSS comments as opaque lexical content',
      () => {
        const input = '/* nested: value ) */ actual:value'
        expect(findTopLevelChar(input, ':')).toBe(input.indexOf(':', input.indexOf('actual')))
        const wrapped = '(before /* ) */ after)'
        expect(findMatching(wrapped, 0, '(', ')')).toBe(wrapped.length - 1)
      },
    )
    it(
      'identifier character predicates enforce their single-character contract instead of matching any valid character inside a longer string',
      () => {
        expect(isIdentifierStart('ab')).toBe(false)
        expect(isIdentifierPart('a-')).toBe(false)
      },
    )
    it(
      'clarifies why hyphen is an identifier part but is intentionally considered a parameter boundary',
      () => {
        expect(isIdentifierPart('-')).toBe(true)
        expect(isParamBoundary('-')).toBe(true)
      },
    )
  })
})
