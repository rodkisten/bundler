import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      minify: false,
    },
  },
  minifyCssText: vi.fn(
    (css: string) =>
      `minified(${css})`,
  ),
}))
vi.mock('../../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../../syntax/css-lexer', () => ({
  minifyCssText:
    mocks.minifyCssText,
}))
import { formatStylesheetText } from './format'
describe('stylesheet formatter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config.minify = false
    mocks.minifyCssText.mockImplementation(
      (css: string) =>
        `minified(${css})`,
    )
  })
  describe('minified output', () => {
    it('delegates directly to the CSS lexer minifier when minification is enabled', () => {
      mocks.runtime.config.minify = true
      const css =
        '.button { color: red; }'
      const result =
        formatStylesheetText(css)
      expect(
        mocks.minifyCssText,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.minifyCssText,
      ).toHaveBeenCalledWith(css)
      expect(result).toBe(
        'minified(.button { color: red; })',
      )
    })
    it('does not run the pretty formatter before delegating to the minifier', () => {
      mocks.runtime.config.minify = true
      const css =
        '.button{color:red;}'
      formatStylesheetText(css)
      expect(
        mocks.minifyCssText,
      ).toHaveBeenCalledWith(
        '.button{color:red;}',
      )
    })
    it('returns the exact minifier result without additional processing', () => {
      mocks.runtime.config.minify = true
      mocks.minifyCssText.mockReturnValue(
        '.a{color:red}',
      )
      expect(
        formatStylesheetText(
          '.a { color: red; }',
        ),
      ).toBe(
        '.a{color:red}',
      )
    })
  })
  describe('pretty output', () => {
    it('formats a simple style rule with two-space indentation', () => {
      expect(
        formatStylesheetText(
          '.button{color:red;padding:8px;}',
        ),
      ).toBe([
        '.button {',
        '  color:red;',
        '  padding:8px;',
        '}',
      ].join('\n'))
      expect(
        mocks.minifyCssText,
      ).not.toHaveBeenCalled()
    })
    it('formats multiple top-level rules without adding blank lines', () => {
      expect(
        formatStylesheetText(
          '.first{color:red;}.second{color:blue;}',
        ),
      ).toBe([
        '.first {',
        '  color:red;',
        '}',
        '.second {',
        '  color:blue;',
        '}',
      ].join('\n'))
    })
    it('formats nested at-rules with increasing indentation depth', () => {
      expect(
        formatStylesheetText(
          '@media (min-width:768px){.button{color:red;padding:8px;}}',
        ),
      ).toBe([
        '@media (min-width:768px) {',
        '  .button {',
        '    color:red;',
        '    padding:8px;',
        '  }',
        '}',
      ].join('\n'))
    })
    it('formats deeply nested stylesheet structures deterministically', () => {
      const css = [
        '@layer components{',
        '@media (min-width:768px){',
        '@supports (display:grid){',
        '.button{display:grid;}',
        '}',
        '}',
        '}',
      ].join('')
      expect(
        formatStylesheetText(css),
      ).toBe([
        '@layer components {',
        '  @media (min-width:768px) {',
        '    @supports (display:grid) {',
        '      .button {',
        '        display:grid;',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n'))
    })
    it('trims insignificant whitespace surrounding structural tokens', () => {
      expect(
        formatStylesheetText(
          '   .button   {   color:red;   }   ',
        ),
      ).toBe([
        '.button {',
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('preserves internal declaration whitespace instead of normalizing declaration syntax', () => {
      expect(
        formatStylesheetText(
          '.button{background:linear-gradient(red, blue);}',
        ),
      ).toBe([
        '.button {',
        '  background:linear-gradient(red, blue);',
        '}',
      ].join('\n'))
    })
    it('formats declarations that appear before a nested block', () => {
      expect(
        formatStylesheetText(
          '.button{color:red;&:hover{color:blue;}}',
        ),
      ).toBe([
        '.button {',
        '  color:red;',
        '  &:hover {',
        '    color:blue;',
        '  }',
        '}',
      ].join('\n'))
    })
    it('formats declarations that appear after a nested block', () => {
      expect(
        formatStylesheetText(
          '.button{&:hover{color:blue;}color:red;}',
        ),
      ).toBe([
        '.button {',
        '  &:hover {',
        '    color:blue;',
        '  }',
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('preserves declaration order around nested structures', () => {
      expect(
        formatStylesheetText(
          '.button{first:1;&:hover{nested:1;}second:2;}',
        ),
      ).toBe([
        '.button {',
        '  first:1;',
        '  &:hover {',
        '    nested:1;',
        '  }',
        '  second:2;',
        '}',
      ].join('\n'))
    })
  })
  describe('quoted CSS content', () => {
    it('does not treat braces inside double-quoted strings as structural braces', () => {
      expect(
        formatStylesheetText(
          '.label{content:"{hello}";color:red;}',
        ),
      ).toBe([
        '.label {',
        '  content:"{hello}";',
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('does not treat braces inside single-quoted strings as structural braces', () => {
      expect(
        formatStylesheetText(
          ".label{content:'{hello}';color:red;}",
        ),
      ).toBe([
        '.label {',
        "  content:'{hello}';",
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('does not treat semicolons inside quoted strings as declaration boundaries', () => {
      expect(
        formatStylesheetText(
          '.label{content:"first;second;third";color:red;}',
        ),
      ).toBe([
        '.label {',
        '  content:"first;second;third";',
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('does not treat closing braces inside quoted strings as block endings', () => {
      expect(
        formatStylesheetText(
          '.label{content:"}";display:block;}',
        ),
      ).toBe([
        '.label {',
        '  content:"}";',
        '  display:block;',
        '}',
      ].join('\n'))
    })
    it('preserves escaped double quotes inside double-quoted strings', () => {
      expect(
        formatStylesheetText(
          String.raw`.label{content:"say \"hello; world\"";color:red;}`,
        ),
      ).toBe([
        '.label {',
        String.raw`  content:"say \"hello; world\"";`,
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('preserves escaped single quotes inside single-quoted strings', () => {
      expect(
        formatStylesheetText(
          String.raw`.label{content:'it\'s {safe};';color:red;}`,
        ),
      ).toBe([
        '.label {',
        String.raw`  content:'it\'s {safe};';`,
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('preserves CSS punctuation inside quoted URLs', () => {
      expect(
        formatStylesheetText(
          '.hero{background:url("https://example.com/a;b{c}.png");color:red;}',
        ),
      ).toBe([
        '.hero {',
        '  background:url("https://example.com/a;b{c}.png");',
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('preserves data URL payloads containing semicolons and braces when quoted', () => {
      const css =
        '.icon{background:url("data:image/svg+xml;charset=utf-8,<svg>{x;y}</svg>");display:block;}'
      expect(
        formatStylesheetText(css),
      ).toBe([
        '.icon {',
        '  background:url("data:image/svg+xml;charset=utf-8,<svg>{x;y}</svg>");',
        '  display:block;',
        '}',
      ].join('\n'))
    })
  })
  describe('non-block stylesheet syntax', () => {
    it('formats top-level declarations separated by semicolons', () => {
      expect(
        formatStylesheetText(
          'color:red;display:block;',
        ),
      ).toBe([
        'color:red;',
        'display:block;',
      ].join('\n'))
    })
    it('preserves trailing text that has no terminating semicolon', () => {
      expect(
        formatStylesheetText(
          'color:red',
        ),
      ).toBe(
        'color:red',
      )
    })
    it('preserves a trailing declaration after a completed block', () => {
      expect(
        formatStylesheetText(
          '.button{color:red;}display:block',
        ),
      ).toBe([
        '.button {',
        '  color:red;',
        '}',
        'display:block',
      ].join('\n'))
    })
    it('formats empty blocks', () => {
      expect(
        formatStylesheetText(
          '.empty{}',
        ),
      ).toBe([
        '.empty {',
        '}',
      ].join('\n'))
    })
    it('formats nested empty blocks', () => {
      expect(
        formatStylesheetText(
          '@media print{.empty{}}',
        ),
      ).toBe([
        '@media print {',
        '  .empty {',
        '  }',
        '}',
      ].join('\n'))
    })
  })
  describe('defensive malformed-input behavior', () => {
    it('never allows indentation depth to become negative for excess closing braces', () => {
      expect(
        formatStylesheetText(
          '}.button{color:red;}',
        ),
      ).toBe([
        '}',
        '.button {',
        '  color:red;',
        '}',
      ].join('\n'))
    })
    it('formats an unclosed block as far as structurally possible', () => {
      expect(
        formatStylesheetText(
          '.button{color:red;',
        ),
      ).toBe([
        '.button {',
        '  color:red;',
      ].join('\n'))
    })
    it('preserves an unterminated quoted token without throwing', () => {
      expect(() =>
        formatStylesheetText(
          '.label{content:"unfinished',
        ),
      ).not.toThrow()
      expect(
        formatStylesheetText(
          '.label{content:"unfinished',
        ),
      ).toBe([
        '.label {',
        '  content:"unfinished',
      ].join('\n'))
    })
    it('handles an empty input', () => {
      expect(
        formatStylesheetText(''),
      ).toBe('')
    })
    it('handles whitespace-only input', () => {
      expect(
        formatStylesheetText(
          '   \n\t  ',
        ),
      ).toBe('')
    })
  })
  describe('configuration behavior', () => {
    it('switches behavior dynamically according to runtime.config.minify', () => {
      const css =
        '.button{color:red;}'
      mocks.runtime.config.minify = false
      const pretty =
        formatStylesheetText(css)
      mocks.runtime.config.minify = true
      mocks.minifyCssText.mockReturnValue(
        '.button{color:red}',
      )
      const minified =
        formatStylesheetText(css)
      expect(pretty).toBe([
        '.button {',
        '  color:red;',
        '}',
      ].join('\n'))
      expect(minified).toBe(
        '.button{color:red}',
      )
    })
  })
  describe('determinism', () => {
    it('produces identical pretty output for repeated calls', () => {
      const css =
        '@media print{.button{color:red;padding:8px;}}'
      const first =
        formatStylesheetText(css)
      const second =
        formatStylesheetText(css)
      expect(second).toBe(first)
    })
    it('is idempotent for formatter-generated pretty CSS', () => {
      const css =
        '@media print{.button{color:red;padding:8px;}}'
      const once =
        formatStylesheetText(css)
      const twice =
        formatStylesheetText(once)
      expect(twice).toBe(once)
    })
  })
  describe('known formatter boundaries', () => {
    it('tracks backslash parity before quotes while formatting strings', () => {
      const css = String.raw`.a{content:"ends-with-backslash\";color:red;}`
      expect(formatStylesheetText(css)).toContain('color:red;')
    })
    it('preserves CSS comments as opaque lexical content in pretty output', () => {
      const result = formatStylesheetText('.a{/* } ; { */color:red;}')
      expect(result).toContain('/* } ; { */')
      expect(result).toContain('color:red;')
    })
    it('formats modern nested syntax without treating opaque lexical payloads as structure', () => {
      const css = '.a{&:is(.b,.c){content:"};{";/* }; */color:red;}}'
      const result = formatStylesheetText(css)
      expect(result).toContain('&:is(.b,.c) {')
      expect(result).toContain('content:"};{";')
      expect(result).toContain('/* }; */')
    })
  })
})
