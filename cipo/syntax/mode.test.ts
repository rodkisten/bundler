import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  clearPolymorphicDetectionCache,
  findFirstMeaningful,
  findNextTopLevelAt,
  splitPolymorphicCssSource,
} from './mode'
describe('polymorphic CSS source detection', () => {
  beforeEach(() => {
    clearPolymorphicDetectionCache()
  })
  describe('findFirstMeaningful', () => {
    it('returns the first non-whitespace character', () => {
      expect(
        findFirstMeaningful(
          '   \n\t.card{}',
        ),
      ).toBe(5)
    })
    it('skips a leading block comment', () => {
      const input =
        '/* comment */   @cipo{}'
      expect(
        findFirstMeaningful(
          input,
        ),
      ).toBe(
        input.indexOf('@'),
      )
    })
    it('skips multiple leading block comments', () => {
      const input =
        '/* first */ /* second */ .card{}'
      expect(
        findFirstMeaningful(
          input,
        ),
      ).toBe(
        input.indexOf('.'),
      )
    })
    it('skips a leading line comment', () => {
      const input = [
        '// comment',
        '@inline { color:red; }',
      ].join('\n')
      expect(
        findFirstMeaningful(
          input,
        ),
      ).toBe(
        input.indexOf('@'),
      )
    })
    it('skips multiple leading line comments', () => {
      const input = [
        '// first',
        '// second',
        '.card{}',
      ].join('\n')
      expect(
        findFirstMeaningful(
          input,
        ),
      ).toBe(
        input.indexOf('.'),
      )
    })
    it('returns -1 for empty input', () => {
      expect(
        findFirstMeaningful(''),
      ).toBe(-1)
    })
    it('returns -1 for whitespace-only input', () => {
      expect(
        findFirstMeaningful(
          ' \n\t\r ',
        ),
      ).toBe(-1)
    })
    it('returns -1 for comment-only input', () => {
      expect(
        findFirstMeaningful(
          '/* comment */',
        ),
      ).toBe(-1)
    })
    it('returns -1 for an unclosed leading block comment', () => {
      expect(
        findFirstMeaningful(
          '/* unfinished',
        ),
      ).toBe(-1)
    })
    it('returns -1 for a leading line comment that reaches end of input', () => {
      expect(
        findFirstMeaningful(
          '// comment',
        ),
      ).toBe(-1)
    })
  })
  describe('findNextTopLevelAt', () => {
    it('finds a top-level directive', () => {
      expect(
        findNextTopLevelAt(
          '.card{} @theme{}',
          0,
        ),
      ).toBe(
        '.card{} '.length,
      )
    })
    it('finds the first top-level directive from the requested offset', () => {
      const input =
        '@theme{} .card{} @media{}'
      expect(
        findNextTopLevelAt(
          input,
          input.indexOf('.card'),
        ),
      ).toBe(
        input.indexOf(
          '@media',
        ),
      )
    })
    it('ignores at-signs nested inside braces', () => {
      const input =
        '.card{@media print{color:red;}} @theme{}'
      expect(
        findNextTopLevelAt(
          input,
          0,
        ),
      ).toBe(
        input.lastIndexOf(
          '@theme',
        ),
      )
    })
    it('ignores at-signs nested inside parentheses', () => {
      const input =
        'fn(@inside) @theme{}'
      expect(
        findNextTopLevelAt(
          input,
          0,
        ),
      ).toBe(
        input.indexOf(
          '@theme',
        ),
      )
    })
    it('ignores at-signs nested inside brackets', () => {
      const input =
        '[data-value="@inside"] @theme{}'
      expect(
        findNextTopLevelAt(
          input,
          0,
        ),
      ).toBe(
        input.indexOf(
          '@theme',
        ),
      )
    })
    it('ignores at-signs inside double-quoted strings', () => {
      const input =
        'content:"@theme{}"; @cipo{}'
      expect(
        findNextTopLevelAt(
          input,
          0,
        ),
      ).toBe(
        input.indexOf(
          '@cipo',
        ),
      )
    })
    it('ignores at-signs inside single-quoted strings', () => {
      const input =
        "content:'@theme{}'; @cipo{}"
      expect(
        findNextTopLevelAt(
          input,
          0,
        ),
      ).toBe(
        input.indexOf(
          '@cipo',
        ),
      )
    })
    it('ignores at-signs inside block comments', () => {
      const input =
        '/* @theme{} */ @cipo{}'
      expect(
        findNextTopLevelAt(
          input,
          0,
        ),
      ).toBe(
        input.indexOf(
          '@cipo',
        ),
      )
    })
    it('requires a valid directive-name start after the at-sign', () => {
      expect(
        findNextTopLevelAt(
          '@123 invalid',
          0,
        ),
      ).toBe(-1)
    })
    it('returns -1 when no top-level directive exists', () => {
      expect(
        findNextTopLevelAt(
          '.card{color:red;}',
          0,
        ),
      ).toBe(-1)
    })
    it('returns -1 when an encountered block comment is unclosed', () => {
      expect(
        findNextTopLevelAt(
          '/* unfinished @theme{}',
          0,
        ),
      ).toBe(-1)
    })
  })
  describe('@inline detection', () => {
    it('extracts an inline block when @inline is the first meaningful directive', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline { color:red; padding:4px; }',
        ),
      ).toEqual({
        css:
          ' color:red; padding:4px; ',
        configCss: '',
        inline: true,
      })
    })
    it('allows whitespace before @inline', () => {
      expect(
        splitPolymorphicCssSource(
          '  \n\t @inline { color:red; }',
        ),
      ).toEqual({
        css: ' color:red; ',
        configCss: '',
        inline: true,
      })
    })
    it('allows leading block comments before @inline', () => {
      expect(
        splitPolymorphicCssSource(
          '/* setup */ @inline { color:red; }',
        ),
      ).toEqual({
        css: ' color:red; ',
        configCss: '',
        inline: true,
      })
    })
    it('allows leading line comments before @inline', () => {
      expect(
        splitPolymorphicCssSource(
          '// setup\n@inline { color:red; }',
        ),
      ).toEqual({
        css: ' color:red; ',
        configCss: '',
        inline: true,
      })
    })
    it('supports compact @inline block syntax', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline{color:red;}',
        ),
      ).toEqual({
        css: 'color:red;',
        configCss: '',
        inline: true,
      })
    })
    it('supports nested braces inside the inline block', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline{&:hover{color:red;}color:blue;}',
        ),
      ).toEqual({
        css:
          '&:hover{color:red;}color:blue;',
        configCss: '',
        inline: true,
      })
    })
    it('ignores closing braces inside quoted strings while finding the inline block end', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline{content:"}";color:red;}',
        ),
      ).toEqual({
        css:
          'content:"}";color:red;',
        configCss: '',
        inline: true,
      })
    })
    it('ignores braces inside block comments while finding the inline block end', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline{/* } */color:red;}',
        ),
      ).toEqual({
        css:
          '/* } */color:red;',
        configCss: '',
        inline: true,
      })
    })
    it('supports semicolon-form inline syntax', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline; color:red; padding:4px;',
        ),
      ).toEqual({
        css:
          ' color:red; padding:4px;',
        configCss: '',
        inline: true,
      })
    })
    it('requires a directive boundary after @inline', () => {
      expect(
        splitPolymorphicCssSource(
          '@inlineTheme { color:red; }',
        ),
      ).toEqual({
        css:
          '@inlineTheme { color:red; }',
        configCss: '',
        inline: false,
      })
    })
    it('does not enter inline mode when @inline is not the first meaningful construct', () => {
      expect(
        splitPolymorphicCssSource(
          '.card{} @inline { color:red; }',
        ),
      ).toEqual({
        css:
          '.card{} @inline { color:red; }',
        configCss: '',
        inline: false,
      })
    })
    it('falls back to ordinary stylesheet scanning for an unclosed @inline block', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline { color:red;',
        ),
      ).toEqual({
        css:
          '@inline { color:red;',
        configCss: '',
        inline: false,
      })
    })
    it('returns only the matched inline block body under the current inline-mode contract', () => {
      expect(
        splitPolymorphicCssSource(
          '@inline{color:red;} trailing',
        ),
      ).toEqual({
        css: 'color:red;',
        configCss: '',
        inline: true,
      })
    })
  })
  describe('CSS-first configuration extraction', () => {
    it.each([
      'cipo',
      'config',
      'theme',
      'tokens',
      'breakpoints',
      'alias',
      'helper',
      'preset',
      'plugin',
    ])(
      'extracts @%s block directives as configuration',
      (directive) => {
        expect(
          splitPolymorphicCssSource(
            `@${directive}{value:test;}`,
          ),
        ).toEqual({
          css: '',
          configCss:
            `@${directive}{value:test;}\n`,
          inline: false,
        })
      },
    )
    it('extracts multiple configuration directives in source order', () => {
      expect(
        splitPolymorphicCssSource(
          [
            '@cipo{prefix:app;}',
            '@theme{brand:red;}',
            '@tokens{spacing:4;}',
          ].join('\n'),
        ),
      ).toEqual({
        css: '\n\n',
        configCss: [
          '@cipo{prefix:app;}',
          '@theme{brand:red;}',
          '@tokens{spacing:4;}',
          '',
        ].join('\n'),
        inline: false,
      })
    })
    it('separates configuration directives from ordinary stylesheet rules', () => {
      const result =
        splitPolymorphicCssSource(
          [
            '@cipo{prefix:app;}',
            '.card{color:red;}',
            '@theme{brand:blue;}',
            '.button{color:$brand;}',
          ].join('\n'),
        )
      expect(result.inline).toBe(false)
      expect(result.configCss).toBe([
        '@cipo{prefix:app;}',
        '@theme{brand:blue;}',
        '',
      ].join('\n'))
      expect(result.css).toContain(
        '.card{color:red;}',
      )
      expect(result.css).toContain(
        '.button{color:$brand;}',
      )
      expect(result.css).not.toContain(
        '@cipo',
      )
      expect(result.css).not.toContain(
        '@theme',
      )
    })
    it('preserves non-config at-rules in stylesheet output', () => {
      const input =
        '@media print{.card{color:black;}}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('preserves @supports blocks in stylesheet output', () => {
      const input =
        '@supports(display:grid){.card{display:grid;}}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('preserves top-level at-rules nested inside ordinary stylesheet blocks', () => {
      const input =
        '.card{@media print{color:black;}}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('supports named configuration blocks', () => {
      expect(
        splitPolymorphicCssSource(
          '@theme dark { brand:white; }',
        ),
      ).toEqual({
        css: '',
        configCss:
          '@theme dark { brand:white; }\n',
        inline: false,
      })
    })
    it('supports quoted text inside named configuration block headers', () => {
      expect(
        splitPolymorphicCssSource(
          '@theme "dark mode" { brand:white; }',
        ),
      ).toEqual({
        css: '',
        configCss:
          '@theme "dark mode" { brand:white; }\n',
        inline: false,
      })
    })
    it('supports nested blocks inside configuration directives', () => {
      const input =
        '@theme{dark{brand:white;}light{brand:black;}}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: '',
        configCss:
          `${input}\n`,
        inline: false,
      })
    })
    it('ignores braces inside quoted configuration values', () => {
      const input =
        '@theme{content:"}";brand:red;}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: '',
        configCss:
          `${input}\n`,
        inline: false,
      })
    })
    it('ignores braces inside configuration block comments', () => {
      const input =
        '@theme{/* } */brand:red;}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: '',
        configCss:
          `${input}\n`,
        inline: false,
      })
    })
    it('preserves an unclosed config block as stylesheet text rather than extracting partial configuration', () => {
      const input =
        '@theme{brand:red;'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('extracts statement-style configuration directives terminated by semicolon', () => {
      expect(
        splitPolymorphicCssSource(
          '@preset reset;',
        ),
      ).toEqual({
        css: '',
        configCss:
          '@preset reset;\n',
        inline: false,
      })
    })
    it('preserves ordinary CSS around statement-style configuration directives', () => {
      const result =
        splitPolymorphicCssSource(
          'before;@preset reset;after;',
        )
      expect(result.configCss).toBe(
        '@preset reset;\n',
      )
      expect(result.css).toBe(
        'before;after;',
      )
    })
  })
  describe('@property configuration semantics', () => {
    it('preserves @property as stylesheet CSS when no CSS-first config has been seen', () => {
      const input =
        '@property --brand{syntax:"<color>";initial-value:red;inherits:false;}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('treats @property as configuration after a CSS-first config directive', () => {
      const property =
        '@property --brand{syntax:"<color>";initial-value:red;inherits:false;}'
      expect(
        splitPolymorphicCssSource(
          `@cipo{prefix:app;}${property}`,
        ),
      ).toEqual({
        css: '',
        configCss: [
          '@cipo{prefix:app;}',
          property,
          '',
        ].join('\n'),
        inline: false,
      })
    })
    it('keeps an earlier @property in CSS while extracting a later one after configuration begins', () => {
      const first =
        '@property --native{syntax:"<color>";}'
      const second =
        '@property --configured{syntax:"<length>";}'
      const result =
        splitPolymorphicCssSource(
          [
            first,
            '@cipo{prefix:app;}',
            second,
          ].join('\n'),
        )
      expect(result.css).toContain(
        first,
      )
      expect(result.configCss).toContain(
        '@cipo{prefix:app;}',
      )
      expect(result.configCss).toContain(
        second,
      )
    })
  })
  describe('ordinary stylesheet mode', () => {
    it('returns plain CSS unchanged when no configuration directives exist', () => {
      const input = [
        '.card{color:red;}',
        '.button{display:flex;}',
      ].join('\n')
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('preserves quoted at-signs in ordinary CSS', () => {
      const input =
        '.label{content:"@theme{secret:red;}";}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('preserves block-comment at-signs in ordinary CSS', () => {
      const input =
        '/* @theme{secret:red;} */.card{color:red;}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('preserves unknown top-level directives', () => {
      const input =
        '@unknown{value:test;}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
    it('uses case-sensitive directive matching', () => {
      const input =
        '@Theme{brand:red;}'
      expect(
        splitPolymorphicCssSource(
          input,
        ),
      ).toEqual({
        css: input,
        configCss: '',
        inline: false,
      })
    })
  })
  describe('detection cache', () => {
    it('returns the exact cached result object for repeated identical input', () => {
      const input =
        '@theme{brand:red;}'
      const first =
        splitPolymorphicCssSource(
          input,
        )
      const second =
        splitPolymorphicCssSource(
          input,
        )
      expect(second).toBe(first)
    })
    it('clears cached detection results explicitly', () => {
      const input =
        '@theme{brand:red;}'
      const first =
        splitPolymorphicCssSource(
          input,
        )
      clearPolymorphicDetectionCache()
      const second =
        splitPolymorphicCssSource(
          input,
        )
      expect(second).toEqual(first)
      expect(second).not.toBe(first)
    })
    it('keeps independently keyed source results isolated', () => {
      const first =
        splitPolymorphicCssSource(
          '@theme{brand:red;}',
        )
      const second =
        splitPolymorphicCssSource(
          '@inline{color:red;}',
        )
      expect(first).toEqual({
        css: '',
        configCss:
          '@theme{brand:red;}\n',
        inline: false,
      })
      expect(second).toEqual({
        css: 'color:red;',
        configCss: '',
        inline: true,
      })
    })
    it('evicts the oldest cached entry once the 512-entry bound is exceeded', () => {
      const oldestInput =
        '.entry-0{}'
      const oldest =
        splitPolymorphicCssSource(
          oldestInput,
        )
      for (
        let index = 1;
        index <= 512;
        index += 1
      ) {
        splitPolymorphicCssSource(
          `.entry-${index}{}`,
        )
      }
      const afterEviction =
        splitPolymorphicCssSource(
          oldestInput,
        )
      expect(
        afterEviction,
      ).toEqual(oldest)
      expect(
        afterEviction,
      ).not.toBe(oldest)
    })
    it('retains a recently inserted entry while evicting only the oldest insertion', () => {
      const recentInput =
        '.entry-512{}'
      for (
        let index = 0;
        index <= 512;
        index += 1
      ) {
        splitPolymorphicCssSource(
          `.entry-${index}{}`,
        )
      }
      const recent =
        splitPolymorphicCssSource(
          recentInput,
        )
      const cachedAgain =
        splitPolymorphicCssSource(
          recentInput,
        )
      expect(
        cachedAgain,
      ).toBe(recent)
    })
  })
  describe('determinism and source isolation', () => {
    it('produces deterministic config and CSS separation', () => {
      const input = [
        '@cipo{prefix:app;}',
        '@theme{brand:red;}',
        '.card{color:$brand;}',
      ].join('\n')
      const first =
        splitPolymorphicCssSource(
          input,
        )
      clearPolymorphicDetectionCache()
      const second =
        splitPolymorphicCssSource(
          input,
        )
      expect(second).toEqual(first)
    })
    it('does not mutate the source string', () => {
      const input =
        '@theme{brand:red;}.card{color:$brand;}'
      const snapshot =
        input
      splitPolymorphicCssSource(
        input,
      )
      expect(input).toBe(
        snapshot,
      )
    })
    it('does not leak configuration state between separate scans', () => {
      splitPolymorphicCssSource(
        '@cipo{prefix:app;}',
      )
      expect(
        splitPolymorphicCssSource(
          '@property --native{syntax:"<color>";}',
        ),
      ).toEqual({
        css:
          '@property --native{syntax:"<color>";}',
        configCss: '',
        inline: false,
      })
    })
  })
  describe('regression contracts', () => {
    it(
      'findNextTopLevelAt ignores @directive-like text inside // line comments',
      () => {
        const input = '// @cipo { prefix: bad }\n@theme { color: red }'
        expect(findNextTopLevelAt(input, 0)).toBe(input.indexOf('@theme'))
      },
    )
    it(
      'all quoted-string scanners use escape parity instead of checking only the immediately preceding backslash',
      () => {
        const input = String.raw`.a{content:"x\\";} @theme { color: red }`
        expect(findNextTopLevelAt(input, 0)).toBe(input.indexOf('@theme'))
      },
    )
    it(
      'top-level scanning tracks matching delimiter families instead of using one shared depth counter for (), [] and {}',
      () => {
        expect(findNextTopLevelAt('fn([)] @inside) @outside', 0)).toBe(-1)
      },
    )
    it(
      '@inline block mode defines whether trailing source after the closing brace should be preserved or rejected instead of silently discarded',
      () => {
        const result = splitPolymorphicCssSource('@inline { color:red; } background:blue;')
        expect(result.mode).toBe('inline')
        expect(result.stylesheet).toContain('background:blue;')
      },
    )
    it(
      'statement-style configuration directives ending at a newline preserve surrounding newline ownership without leaking whitespace into stylesheet output',
      () => {
        const result = splitPolymorphicCssSource('@cipo prefix: app\n.card{color:red;}')
        expect(result.stylesheet.startsWith('.card')).toBe(true)
      },
    )
    it(
      'configuration directive detection defines whether names should be ASCII-case-insensitive',
      () => {
        const result = splitPolymorphicCssSource('@CIPO { prefix: app; } .card{color:red;}')
        expect(result.configCss.toLowerCase()).toContain('@cipo')
      },
    )
    it(
      'the bounded cache defines whether cache hits should refresh recency or intentionally remain FIFO insertion-order eviction',
      () => {
        const source = '.card{color:red;}'
        const first = splitPolymorphicCssSource(source)
        const second = splitPolymorphicCssSource(source)
        expect(second).toBe(first)
      },
    )
  })
})
