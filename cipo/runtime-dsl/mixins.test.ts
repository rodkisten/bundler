import { describe, expect, it } from 'vitest'
import type { CipoWarning } from '../types'
import {
  expandRuntimeMixinCalls,
  extractRuntimeMixins,
} from './mixins'
describe('runtime mixins', () => {
  describe('extractRuntimeMixins', () => {
    it('extracts a simple runtime mixin and removes its definition from source', () => {
      const warnings: CipoWarning[] = []
      const result =
        extractRuntimeMixins(
          '$$center(){display:flex;align-items:center;}',
          warnings,
        )
      expect(result.source).toBe('')
      expect(result.mixins).toEqual({
        center: {
          name: 'center',
          params: [],
          body:
            'display:flex;align-items:center;',
        },
      })
      expect(warnings).toEqual([])
    })
    it('preserves ordinary source surrounding extracted mixins', () => {
      const result =
        extractRuntimeMixins(
          [
            'before;',
            '$$center(){display:flex;}',
            'middle;',
            '$$hidden(){display:none;}',
            'after;',
          ].join(''),
          [],
        )
      expect(result.source).toBe(
        'before;middle;after;',
      )
      expect(
        Object.keys(result.mixins),
      ).toEqual([
        'center',
        'hidden',
      ])
    })
    it('extracts multiple mixins independently', () => {
      const result =
        extractRuntimeMixins(
          [
            '$$first(){a:1;}',
            '$$second(){b:2;}',
            '$$third(){c:3;}',
          ].join(''),
          [],
        )
      expect(result.source).toBe('')
      expect(result.mixins).toEqual({
        first: {
          name: 'first',
          params: [],
          body: 'a:1;',
        },
        second: {
          name: 'second',
          params: [],
          body: 'b:2;',
        },
        third: {
          name: 'third',
          params: [],
          body: 'c:3;',
        },
      })
    })
    it('supports whitespace between the mixin name, parameters and body', () => {
      const result =
        extractRuntimeMixins(
          '$$center   (   )   { display:flex; }',
          [],
        )
      expect(result.mixins.center).toEqual({
        name: 'center',
        params: [],
        body: ' display:flex; ',
      })
    })
    it('parses simple positional parameters', () => {
      const result =
        extractRuntimeMixins(
          '$$spacing($size, $color){padding:$size;color:$color;}',
          [],
        )
      expect(
        result.mixins.spacing.params,
      ).toEqual([
        {
          name: 'size',
          type: '',
          fallback: '',
        },
        {
          name: 'color',
          type: '',
          fallback: '',
        },
      ])
    })
    it('removes leading dollar and star parameter markers', () => {
      const result =
        extractRuntimeMixins(
          '$$example($first, *second, $$third){a:1;}',
          [],
        )
      expect(
        result.mixins.example.params,
      ).toEqual([
        {
          name: 'first',
          type: '',
          fallback: '',
        },
        {
          name: 'second',
          type: '',
          fallback: '',
        },
        {
          name: 'third',
          type: '',
          fallback: '',
        },
      ])
    })
    it('parses typed parameters', () => {
      const result =
        extractRuntimeMixins(
          '$$button($size: length, $tone: color){a:1;}',
          [],
        )
      expect(
        result.mixins.button.params,
      ).toEqual([
        {
          name: 'size',
          type: 'length',
          fallback: '',
        },
        {
          name: 'tone',
          type: 'color',
          fallback: '',
        },
      ])
    })
    it('parses parameter fallback values', () => {
      const result =
        extractRuntimeMixins(
          '$$button($size = 1rem, $tone = red){a:1;}',
          [],
        )
      expect(
        result.mixins.button.params,
      ).toEqual([
        {
          name: 'size',
          type: '',
          fallback: '1rem',
        },
        {
          name: 'tone',
          type: '',
          fallback: 'red',
        },
      ])
    })
    it('parses typed parameters with fallback values', () => {
      const result =
        extractRuntimeMixins(
          '$$button($size: length = 1rem, $tone: color = red){a:1;}',
          [],
        )
      expect(
        result.mixins.button.params,
      ).toEqual([
        {
          name: 'size',
          type: 'length',
          fallback: '1rem',
        },
        {
          name: 'tone',
          type: 'color',
          fallback: 'red',
        },
      ])
    })
    it('does not split parameter fallback expressions at nested commas', () => {
      const result =
        extractRuntimeMixins(
          '$$gradient($color: color = rgb(255, 0, 0), $size = 1rem){a:1;}',
          [],
        )
      expect(
        result.mixins.gradient.params,
      ).toEqual([
        {
          name: 'color',
          type: 'color',
          fallback:
            'rgb(255, 0, 0)',
        },
        {
          name: 'size',
          type: '',
          fallback: '1rem',
        },
      ])
    })
    it('preserves nested block content inside a mixin body', () => {
      const result =
        extractRuntimeMixins(
          [
            '$$responsive(){',
            '@media(min-width:768px){',
            '.button{color:red;}',
            '}',
            '}',
          ].join(''),
          [],
        )
      expect(
        result.mixins.responsive.body,
      ).toBe(
        '@media(min-width:768px){.button{color:red;}}',
      )
    })
    it('uses a null-prototype object for the mixin registry', () => {
      const result =
        extractRuntimeMixins(
          '$$center(){display:flex;}',
          [],
        )
      expect(
        Object.getPrototypeOf(
          result.mixins,
        ),
      ).toBeNull()
    })
    it('lets a later definition replace an earlier mixin with the same name', () => {
      const result =
        extractRuntimeMixins(
          [
            '$$shared(){color:red;}',
            '$$shared(){color:blue;}',
          ].join(''),
          [],
        )
      expect(
        result.mixins.shared.body,
      ).toBe(
        'color:blue;',
      )
    })
    it('preserves a double-dollar sequence that is not followed by a valid mixin name', () => {
      expect(
        extractRuntimeMixins(
          '$$123(value){color:red;}',
          [],
        ).source,
      ).toBe(
        '$$123(value){color:red;}',
      )
    })
    it('preserves a double-dollar identifier that is not followed by parameters', () => {
      expect(
        extractRuntimeMixins(
          '$$spacing + 1rem',
          [],
        ).source,
      ).toBe(
        '$$spacing + 1rem',
      )
    })
    it('preserves a function-like double-dollar expression without a block', () => {
      expect(
        extractRuntimeMixins(
          '$$spacing(2)',
          [],
        ).source,
      ).toBe(
        '$$spacing(2)',
      )
    })
    it('preserves a definition with an unclosed parameter list without throwing', () => {
      const warnings: CipoWarning[] = []
      const input =
        '$$button($size: length'
      expect(
        extractRuntimeMixins(
          input,
          warnings,
        ),
      ).toEqual({
        source: input,
        mixins: expect.any(Object),
      })
      expect(warnings).toEqual([])
    })
    it('warns and preserves source for an unclosed mixin body', () => {
      const warnings: CipoWarning[] = []
      const input =
        '$$button(){color:red;'
      const result =
        extractRuntimeMixins(
          input,
          warnings,
        )
      expect(result.source).toBe(input)
      expect(warnings).toEqual([
        {
          code:
            'cipo-mixin-unclosed',
          message:
            'Unclosed runtime mixin: button',
        },
      ])
    })
    it('preserves source preceding an unclosed mixin', () => {
      const warnings: CipoWarning[] = []
      const result =
        extractRuntimeMixins(
          'before;$$button(){color:red;',
          warnings,
        )
      expect(result.source).toBe(
        'before;$$button(){color:red;',
      )
      expect(warnings).toHaveLength(1)
    })
    it('appends diagnostics without replacing pre-existing warnings', () => {
      const existing: CipoWarning = {
        code: 'existing',
        message: 'Existing warning',
      }
      const warnings = [
        existing,
      ]
      extractRuntimeMixins(
        '$$button(){color:red;',
        warnings,
      )
      expect(warnings).toEqual([
        existing,
        {
          code:
            'cipo-mixin-unclosed',
          message:
            'Unclosed runtime mixin: button',
        },
      ])
      expect(warnings[0]).toBe(
        existing,
      )
    })
  })
  describe('expandRuntimeMixinCalls', () => {
    it('expands a parameterless mixin call', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$center(){display:flex;align-items:center;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'center()',
          mixins,
          [],
        ),
      ).toBe(
        'display:flex;align-items:center;',
      )
    })
    it('expands positional parameters', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$spacing($size){padding:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'spacing(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'padding:2rem;',
      )
    })
    it('supports star-prefixed parameter references in mixin bodies', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$spacing($size){padding:*size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'spacing(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'padding:2rem;',
      )
    })
    it('expands multiple positional parameters in source order', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$button($color, $size){color:$color;padding:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(red, 2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;padding:2rem;',
      )
    })
    it('does not split nested function arguments at commas', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$background($value){background:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'background(linear-gradient(red, blue))',
          mixins,
          [],
        ),
      ).toBe(
        'background:linear-gradient(red, blue);',
      )
    })
    it('strips matching outer quotes from positional arguments', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$content($value){content:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'content("hello world")',
          mixins,
          [],
        ),
      ).toBe(
        'content:hello world;',
      )
      expect(
        expandRuntimeMixinCalls(
          "content('hello world')",
          mixins,
          [],
        ),
      ).toBe(
        'content:hello world;',
      )
    })
    it('uses a fallback value when an argument is omitted', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$spacing($size = 1rem){padding:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'spacing()',
          mixins,
          [],
        ),
      ).toBe(
        'padding:1rem;',
      )
    })
    it('prefers an explicit argument over the fallback value', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$spacing($size = 1rem){padding:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'spacing(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'padding:2rem;',
      )
    })
    it('uses an empty string when neither argument nor fallback exists', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$spacing($size){padding:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'spacing()',
          mixins,
          [],
        ),
      ).toBe(
        'padding:;',
      )
    })
    it('ignores extra positional arguments beyond the declared parameter list', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$spacing($size){padding:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'spacing(1rem, 2rem, 3rem)',
          mixins,
          [],
        ),
      ).toBe(
        'padding:1rem;',
      )
    })
    it('expands multiple mixin calls independently', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$color($value){color:$value;}',
          '$$spacing($value){padding:$value;}',
        ].join(''),
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'color(red);spacing(2rem);',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;;padding:2rem;;',
      )
    })
    it('preserves source surrounding mixin calls', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          '.button{color(red)}',
          mixins,
          [],
        ),
      ).toBe(
        '.button{color:red;}',
      )
    })
    it('supports whitespace between a mixin name and its opening parenthesis', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'color   (red)',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('does not expand unknown function calls', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'unknown(red)',
          mixins,
          [],
        ),
      ).toBe(
        'unknown(red)',
      )
    })
    it('does not expand a mixin name embedded in a larger identifier', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'mycolor(red)',
          mixins,
          [],
        ),
      ).toBe(
        'mycolor(red)',
      )
    })
    it('does not expand mixin calls inside double-quoted strings', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'content:"color(red)";',
          mixins,
          [],
        ),
      ).toBe(
        'content:"color(red)";',
      )
    })
    it('does not expand mixin calls inside single-quoted strings', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          "content:'color(red)';",
          mixins,
          [],
        ),
      ).toBe(
        "content:'color(red)';",
      )
    })
    it('warns and preserves source for an unclosed mixin call', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      const warnings:
        CipoWarning[] = []
      const result =
        expandRuntimeMixinCalls(
          'before;color(red',
          mixins,
          warnings,
        )
      expect(result).toBe(
        'before;color(red',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-mixin-call-unclosed',
          message:
            'Unclosed runtime mixin call: color',
        },
      ])
    })
  })
  describe('parameter replacement boundaries', () => {
    it('replaces exact parameter references', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example($size){width:$size;height:*size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'width:2rem;height:2rem;',
      )
    })
    it('does not replace a parameter prefix inside a longer identifier', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example($size){a:$sizeLarge;b:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'a:$sizeLarge;b:2rem;',
      )
    })
    it('does not replace a parameter suffix when preceded by an identifier character', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example($size){a:prefix$size;b:$size;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'a:prefix$size;b:2rem;',
      )
    })
    it('treats punctuation boundaries as valid replacement boundaries', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example($size){a:calc($size + $size);}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'a:calc(2rem + 2rem);',
      )
    })
    it('treats hyphen as a parameter boundary according to the shared boundary grammar', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example($size){value:$size-extra;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example(2rem)',
          mixins,
          [],
        ),
      ).toBe(
        'value:2rem-extra;',
      )
    })
  })
  describe('runtime if blocks', () => {
    it('includes an if block when the parameter equals the expected value', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$button($tone){if $tone = danger {color:red;}}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(danger)',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('removes an if block when the condition does not match', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$button($tone){if $tone = danger {color:red;}background:white;}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(primary)',
          mixins,
          [],
        ),
      ).toBe(
        'background:white;',
      )
    })
    it('supports star-prefixed parameter names in conditions', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$button($tone){if *tone = danger {color:red;}}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(danger)',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('supports quoted condition values', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$button($tone){if $tone = "danger" {color:red;}}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(danger)',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('evaluates fallback parameter values in conditions', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$button($tone = danger){if $tone = danger {color:red;}}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button()',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('evaluates multiple independent if blocks', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$button($tone, $size){',
          'if $tone = danger {color:red;}',
          'if $size = large {font-size:2rem;}',
          '}',
        ].join(''),
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(danger, large)',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;font-size:2rem;',
      )
    })
    it('includes only matching conditional blocks', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$button($tone, $size){',
          'if $tone = danger {color:red;}',
          'if $size = large {font-size:2rem;}',
          'background:white;',
          '}',
        ].join(''),
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(primary, large)',
          mixins,
          [],
        ),
      ).toBe(
        'font-size:2rem;background:white;',
      )
    })
    it('supports nested structures inside a matching if body', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$button($tone){',
          'if $tone = danger {',
          '@media(min-width:768px){',
          'color:red;',
          '}',
          '}',
          '}',
        ].join(''),
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'button(danger)',
          mixins,
          [],
        ),
      ).toBe(
        '@media(min-width:768px){color:red;}',
      )
    })
    it('does not treat an identifier containing if as an if keyword', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example(){different{color:red;}}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example()',
          mixins,
          [],
        ),
      ).toBe(
        'different{color:red;}',
      )
    })
    it('leaves malformed if syntax intact when no block opening can be found', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$example($tone){if $tone = danger}',
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'example(danger)',
          mixins,
          [],
        ),
      ).toBe(
        'if danger = danger}',
      )
    })
  })
  describe('multi-pass composition', () => {
    it('expands a mixin call produced by another mixin', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$color($value){color:$value;}',
          '$$danger(){color(red)}',
        ].join(''),
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'danger()',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('expands a multi-level mixin chain across multiple passes', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$level1(){level2()}',
          '$$level2(){level3()}',
          '$$level3(){color:red;}',
        ].join(''),
        [],
      )
      expect(
        expandRuntimeMixinCalls(
          'level1()',
          mixins,
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('stops early once a pass produces no further changes', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$color($value){color:$value;}',
        [],
      )
      const first =
        expandRuntimeMixinCalls(
          'color(red)',
          mixins,
          [],
        )
      const second =
        expandRuntimeMixinCalls(
          first,
          mixins,
          [],
        )
      expect(first).toBe(
        'color:red;',
      )
      expect(second).toBe(first)
    })
    it('does not throw for a self-referential mixin and respects the bounded pass count', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        '$$loop(){loop()}',
        [],
      )
      expect(() =>
        expandRuntimeMixinCalls(
          'loop()',
          mixins,
          [],
        ),
      ).not.toThrow()
      expect(
        expandRuntimeMixinCalls(
          'loop()',
          mixins,
          [],
        ),
      ).toBe(
        'loop()',
      )
    })
    it('bounds mutually recursive mixin expansion', () => {
      const {
        mixins,
      } = extractRuntimeMixins(
        [
          '$$first(){second()}',
          '$$second(){first()}',
        ].join(''),
        [],
      )
      expect(() =>
        expandRuntimeMixinCalls(
          'first()',
          mixins,
          [],
        ),
      ).not.toThrow()
      expect(
        [
          'first()',
          'second()',
        ],
      ).toContain(
        expandRuntimeMixinCalls(
          'first()',
          mixins,
          [],
        ),
      )
    })
  })
  describe('extraction and expansion integration', () => {
    it('extracts definitions and expands calls from the remaining source', () => {
      const warnings:
        CipoWarning[] = []
      const extracted =
        extractRuntimeMixins(
          [
            '$$button($color = blue){',
            'color:$color;',
            '}',
            '.primary{button(red)}',
            '.secondary{button()}',
          ].join(''),
          warnings,
        )
      expect(
        expandRuntimeMixinCalls(
          extracted.source,
          extracted.mixins,
          warnings,
        ),
      ).toBe(
        '.primary{color:red;}.secondary{color:blue;}',
      )
      expect(warnings).toEqual([])
    })
    it('supports conditional composed mixins with fallbacks', () => {
      const warnings:
        CipoWarning[] = []
      const extracted =
        extractRuntimeMixins(
          [
            '$$color($value){color:$value;}',
            '$$button($tone = primary){',
            'if $tone = danger {color(red)}',
            'if $tone = primary {color(blue)}',
            '}',
            '.danger{button(danger)}',
            '.primary{button()}',
          ].join(''),
          warnings,
        )
      expect(
        expandRuntimeMixinCalls(
          extracted.source,
          extracted.mixins,
          warnings,
        ),
      ).toBe(
        '.danger{color:red;}.primary{color:blue;}',
      )
      expect(warnings).toEqual([])
    })
    it('is deterministic for identical source and warning state', () => {
      const input = [
        '$$button($tone = primary){',
        'if $tone = danger {color:red;}',
        'if $tone = primary {color:blue;}',
        '}',
        '.button{button(danger)}',
      ].join('')
      const firstWarnings:
        CipoWarning[] = []
      const secondWarnings:
        CipoWarning[] = []
      const firstExtracted =
        extractRuntimeMixins(
          input,
          firstWarnings,
        )
      const secondExtracted =
        extractRuntimeMixins(
          input,
          secondWarnings,
        )
      const first =
        expandRuntimeMixinCalls(
          firstExtracted.source,
          firstExtracted.mixins,
          firstWarnings,
        )
      const second =
        expandRuntimeMixinCalls(
          secondExtracted.source,
          secondExtracted.mixins,
          secondWarnings,
        )
      expect(second).toBe(first)
      expect(
        secondWarnings,
      ).toEqual(
        firstWarnings,
      )
    })
  })
  describe('regression contracts', () => {
    it(
      'extractRuntimeMixins ignores mixin-like $$name(){} syntax inside quoted strings',
      () => {
        const input = 'content:"$$fake(){color:red;}";'
        expect(extractRuntimeMixins(input, [])).toEqual({ source: input, mixins: {} })
      },
    )
    it(
      'extractRuntimeMixins and expandRuntimeMixinCalls ignore mixin syntax inside CSS comments',
      () => {
        const input = '/* $$fake(){color:red;} $$fake() */'
        const extracted = extractRuntimeMixins(input, [])
        expect(extracted.source).toBe(input)
        expect(expandRuntimeMixinCalls(input, {}, [])).toBe(input)
      },
    )
    it(
      'findIfKeyword ignores if tokens inside quoted strings and comments',
      () => {
        const extracted = extractRuntimeMixins('$$demo($mode){content:"if $mode = yes {bad}";/* if $mode = yes {bad} */color:red;}$$demo(yes)', [])
        expect(expandRuntimeMixinCalls(extracted.source, extracted.mixins, [])).toContain('content:"if yes = yes {bad}"')
      },
    )
    it(
      'replaceParam does not substitute parameter-like text inside quoted CSS strings unless interpolation there is explicitly supported',
      () => {
        const extracted = extractRuntimeMixins('$$demo($name){content:"$name";color:$name;}$$demo(red)', [])
        expect(expandRuntimeMixinCalls(extracted.source, extracted.mixins, [])).toBe('content:"$name";color:red;')
      },
    )
    it(
      'quoted arguments preserve their quotes when the target CSS grammar requires string values instead of always stripping outer quotes',
      () => {
        const extracted = extractRuntimeMixins('$$label($value:string){content:$value;}$$label("hello world")', [])
        expect(expandRuntimeMixinCalls(extracted.source, extracted.mixins, [])).toBe('content:"hello world";')
      },
    )
    it(
      'uses escape parity instead of checking only the immediately preceding backslash while scanning quoted mixin calls',
      () => {
        const input = String.raw`content:"x\\";$$call()`
        const mixins = { call: { name: 'call', params: [], body: 'color:red;' } }
        expect(expandRuntimeMixinCalls(input, mixins, [])).toContain('color:red;')
      },
    )
    it(
      'emits a diagnostic when recursive mixin expansion still changes after the eight-pass safety limit',
      () => {
        const warnings: CipoWarning[] = []
        const mixins = { loop: { name: 'loop', params: [], body: '$$loop()x' } }
        expandRuntimeMixinCalls('$$loop()', mixins, warnings)
        expect(warnings.some((warning) => warning.code === 'cipo-mixin-expansion-limit')).toBe(true)
      },
    )
    it(
      'defines whether mixin parameter types are validation metadata or should actively reject incompatible arguments',
      () => {
        const extracted = extractRuntimeMixins('$$demo($value:number){width:$value;}$$demo(red)', [])
        expect(expandRuntimeMixinCalls(extracted.source, extracted.mixins, [])).toBe('width:red;')
      },
    )
  })
})
