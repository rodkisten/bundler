import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CipoWarning } from '../types'
const mocks = vi.hoisted(() => ({
  createOklchUtilityColor: vi.fn(
    (
      name: string,
      shade: number,
    ) =>
      `oklch-${name}-${shade}`,
  ),
}))
vi.mock('./colors', () => ({
  createOklchUtilityColor:
    mocks.createOklchUtilityColor,
}))
import { expandRuntimeDesignFeatures } from './features'
describe('runtime design features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createOklchUtilityColor.mockImplementation(
      (
        name: string,
        shade: number,
      ) =>
        `oklch-${name}-${shade}`,
    )
  })
  describe('dark blocks', () => {
    it('rewrites a plain dark block into the runtime x:dark syntax', () => {
      expect(
        expand(
          'dark{color:red;}',
        ),
      ).toBe(
        'x:dark{color:red;}',
      )
    })
    it('accepts whitespace between the feature name and block', () => {
      expect(
        expand(
          'dark   {color:red;}',
        ),
      ).toBe(
        'x:dark{color:red;}',
      )
    })
    it('does not rewrite dark when arguments are provided', () => {
      expect(
        expand(
          'dark(theme){color:red;}',
        ),
      ).toBe(
        'dark(theme){color:red;}',
      )
    })
    it('rewrites nested dark blocks recursively', () => {
      expect(
        expand(
          '.button{dark{color:white;}}',
        ),
      ).toBe(
        '.button{x:dark{color:white;}}',
      )
    })
    it('rewrites multiple dark blocks independently', () => {
      expect(
        expand(
          [
            '.button{',
            'dark{color:white;}',
            '}',
            '.card{',
            'dark{background:black;}',
            '}',
          ].join(''),
        ),
      ).toBe(
        [
          '.button{',
          'x:dark{color:white;}',
          '}',
          '.card{',
          'x:dark{background:black;}',
          '}',
        ].join(''),
      )
    })
    it('does not rewrite dark text inside double-quoted strings', () => {
      expect(
        expand(
          '.label{content:"dark{color:red;}";}',
        ),
      ).toBe(
        '.label{content:"dark{color:red;}";}',
      )
    })
    it('does not rewrite dark text inside single-quoted strings', () => {
      expect(
        expand(
          ".label{content:'dark{color:red;}';}",
        ),
      ).toBe(
        ".label{content:'dark{color:red;}';}",
      )
    })
    it('does not treat an identifier suffix containing dark as a feature block', () => {
      expect(
        expand(
          'superdark{color:red;}',
        ),
      ).toBe(
        'superdark{color:red;}',
      )
    })
    it('preserves unknown blocks while still recursively rewriting supported descendants', () => {
      expect(
        expand(
          'component{dark{color:white;}}',
        ),
      ).toBe(
        'component{x:dark{color:white;}}',
      )
    })
  })
  describe('slot blocks', () => {
    it('rewrites slot() into a data-slot selector', () => {
      expect(
        expand(
          'slot(icon){color:red;}',
        ),
      ).toBe(
        '[data-slot="icon"]{color:red;}',
      )
    })
    it('accepts quoted slot names', () => {
      expect(
        expand(
          'slot("icon"){color:red;}',
        ),
      ).toBe(
        '[data-slot="icon"]{color:red;}',
      )
      expect(
        expand(
          "slot('icon'){color:red;}",
        ),
      ).toBe(
        '[data-slot="icon"]{color:red;}',
      )
    })
    it('sanitizes unsafe slot-name characters', () => {
      expect(
        expand(
          'slot(icon / primary){color:red;}',
        ),
      ).toBe(
        '[data-slot="icon-primary"]{color:red;}',
      )
    })
    it('removes selector-like prefixes from slot identifiers', () => {
      expect(
        expand(
          'slot(.icon){color:red;}',
        ),
      ).toBe(
        '[data-slot="icon"]{color:red;}',
      )
    })
    it('preserves dots and underscores supported by the runtime identifier grammar', () => {
      expect(
        expand(
          'slot(icon.primary_test){color:red;}',
        ),
      ).toBe(
        '[data-slot="icon.primary_test"]{color:red;}',
      )
    })
    it('warns and unwraps the body when slot() has no usable name', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeDesignFeatures(
          'slot(){color:red;}',
          warnings,
        )
      expect(result).toBe(
        'color:red;',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-slot-empty',
          message:
            'Runtime slot() needs a slot name.',
        },
      ])
    })
    it('recursively expands runtime features inside a slot body', () => {
      expect(
        expand(
          'slot(icon){dark{color:white;}}',
        ),
      ).toBe(
        '[data-slot="icon"]{x:dark{color:white;}}',
      )
    })
  })
  describe('variant blocks', () => {
    it('expands variant choices into data-attribute and class selectors', () => {
      expect(
        expand(
          'variant(size){small{font-size:12px;}large{font-size:20px;}}',
        ),
      ).toBe([
        '&[data-size="small"], &.size-small{font-size:12px;}',
        '&[data-size="large"], &.size-large{font-size:20px;}',
        '',
      ].join('\n'))
    })
    it('accepts quoted variant names', () => {
      expect(
        expand(
          'variant("size"){small{font-size:12px;}}',
        ),
      ).toBe(
        '&[data-size="small"], &.size-small{font-size:12px;}\n',
      )
    })
    it('converts mixed-case variant names to kebab-case selectors', () => {
      expect(
        expand(
          'variant(buttonSize){small{font-size:12px;}}',
        ),
      ).toBe(
        '&[data-button-size="small"], &.button-size-small{font-size:12px;}\n',
      )
    })
    it('converts mixed-case choice names to kebab-case selectors', () => {
      expect(
        expand(
          'variant(size){extraLarge{font-size:24px;}}',
        ),
      ).toBe(
        '&[data-size="extra-large"], &.size-extra-large{font-size:24px;}\n',
      )
    })
    it('preserves choice declaration bodies exactly', () => {
      expect(
        expand(
          'variant(tone){danger{color:red;background:black;}}',
        ),
      ).toBe(
        '&[data-tone="danger"], &.tone-danger{color:red;background:black;}\n',
      )
    })
    it('recursively expands runtime features inside variant choice bodies', () => {
      expect(
        expand(
          'variant(tone){danger{dark{color:red;}}}',
        ),
      ).toBe(
        '&[data-tone="danger"], &.tone-danger{x:dark{color:red;}}\n',
      )
    })
    it('warns and unwraps the body when the variant name is empty', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeDesignFeatures(
          'variant(){primary{color:red;}}',
          warnings,
        )
      expect(result).toBe(
        'primary{color:red;}',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-variant-empty',
          message:
            'Runtime variant() needs a variant name.',
        },
      ])
    })
    it('warns and removes a variant whose body has no choices', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeDesignFeatures(
          'variant(size){}',
          warnings,
        )
      expect(result).toBe('')
      expect(warnings).toEqual([
        {
          code:
            'cipo-variant-empty-body',
          message:
            'Runtime variant(size) has no choices.',
        },
      ])
    })
    it('warns when a variant body contains no named blocks', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeDesignFeatures(
          'variant(size){color:red;}',
          warnings,
        )
      expect(result).toBe('')
      expect(warnings).toEqual([
        {
          code:
            'cipo-variant-choice-malformed',
          message:
            'Runtime variant() contains a choice without a block body.',
        },
        {
          code:
            'cipo-variant-empty-body',
          message:
            'Runtime variant(size) has no choices.',
        },
      ])
    })
    it('preserves choice order', () => {
      const result =
        expand(
          'variant(size){small{a:1;}medium{a:2;}large{a:3;}}',
        )
      expect(
        result.indexOf(
          'size-small',
        ),
      ).toBeLessThan(
        result.indexOf(
          'size-medium',
        ),
      )
      expect(
        result.indexOf(
          'size-medium',
        ),
      ).toBeLessThan(
        result.indexOf(
          'size-large',
        ),
      )
    })
  })
  describe('compound blocks', () => {
    it('expands one compound condition into attribute and class selectors', () => {
      expect(
        expand(
          'compound(size: small){color:red;}',
        ),
      ).toBe(
        '&[data-size="small"], &.size-small{color:red;}',
      )
    })
    it('combines multiple compound conditions into one selector pair', () => {
      expect(
        expand(
          'compound(size: small, tone: danger){color:red;}',
        ),
      ).toBe(
        '&[data-size="small"][data-tone="danger"], &.size-small.tone-danger{color:red;}',
      )
    })
    it('accepts quoted compound values', () => {
      expect(
        expand(
          'compound(size: "small", tone: \'danger\'){color:red;}',
        ),
      ).toBe(
        '&[data-size="small"][data-tone="danger"], &.size-small.tone-danger{color:red;}',
      )
    })
    it('converts mixed-case compound keys and values to kebab case', () => {
      expect(
        expand(
          'compound(buttonSize: extraLarge){color:red;}',
        ),
      ).toBe(
        '&[data-button-size="extra-large"], &.button-size-extra-large{color:red;}',
      )
    })
    it('ignores malformed compound entries while keeping valid pairs', () => {
      expect(
        expand(
          'compound(invalid, size: small, also-invalid){color:red;}',
        ),
      ).toBe(
        '&[data-size="small"], &.size-small{color:red;}',
      )
    })
    it('warns and unwraps the body when no valid key/value pair exists', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeDesignFeatures(
          'compound(invalid){color:red;}',
          warnings,
        )
      expect(result).toBe(
        'color:red;',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-compound-empty',
          message:
            'Runtime compound() needs at least one key/value pair.',
        },
      ])
    })
    it('warns for an empty compound call', () => {
      const warnings: CipoWarning[] = []
      expandRuntimeDesignFeatures(
        'compound(){color:red;}',
        warnings,
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-compound-empty',
          message:
            'Runtime compound() needs at least one key/value pair.',
        },
      ])
    })
    it('recursively expands runtime blocks inside the compound body', () => {
      expect(
        expand(
          'compound(size: small){dark{color:white;}}',
        ),
      ).toBe(
        '&[data-size="small"], &.size-small{x:dark{color:white;}}',
      )
    })
  })
  describe('palette calls', () => {
    it('expands palette() into the complete runtime shade scale', () => {
      const result =
        expand(
          'palette(brand)',
        )
      expect(result).toBe([
        '$$brand-50: oklch-brand-50',
        '$$brand-100: oklch-brand-100',
        '$$brand-200: oklch-brand-200',
        '$$brand-300: oklch-brand-300',
        '$$brand-400: oklch-brand-400',
        '$$brand-500: oklch-brand-500',
        '$$brand-600: oklch-brand-600',
        '$$brand-700: oklch-brand-700',
        '$$brand-800: oklch-brand-800',
        '$$brand-900: oklch-brand-900',
        '$$brand-950: oklch-brand-950',
        '',
      ].join('\n'))
    })
    it('uses the palette name as the color source by default', () => {
      expand(
        'palette(brand)',
      )
      expect(
        mocks.createOklchUtilityColor,
      ).toHaveBeenCalledTimes(11)
      expect(
        mocks.createOklchUtilityColor,
      ).toHaveBeenNthCalledWith(
        1,
        'brand',
        50,
      )
      expect(
        mocks.createOklchUtilityColor,
      ).toHaveBeenNthCalledWith(
        6,
        'brand',
        500,
      )
      expect(
        mocks.createOklchUtilityColor,
      ).toHaveBeenNthCalledWith(
        11,
        'brand',
        950,
      )
    })
    it('supports a separate palette output name and source color', () => {
      const result =
        expand(
          'palette(primary, blue)',
        )
      expect(result).toContain(
        '$$primary-500: oklch-blue-500',
      )
      expect(
        mocks.createOklchUtilityColor,
      ).toHaveBeenCalledWith(
        'blue',
        500,
      )
    })
    it('converts mixed-case palette names to kebab case', () => {
      const result =
        expand(
          'palette(primaryBrand, blue)',
        )
      expect(result).toContain(
        '$$primary-brand-500: oklch-blue-500',
      )
    })
    it('uses the fallback palette name when no argument is provided', () => {
      const result =
        expand(
          'palette()',
        )
      expect(result).toContain(
        '$$palette-500: oklch-palette-500',
      )
    })
    it('supports whitespace between the function name and opening parenthesis', () => {
      expect(
        expand(
          'palette   (brand, blue)',
        ),
      ).toContain(
        '$$brand-500: oklch-blue-500',
      )
    })
    it('does not expand palette calls inside quoted strings', () => {
      expect(
        expand(
          'content:"palette(brand)";',
        ),
      ).toBe(
        'content:"palette(brand)";',
      )
      expect(
        mocks.createOklchUtilityColor,
      ).not.toHaveBeenCalled()
    })
    it('does not match palette as part of a larger identifier', () => {
      expect(
        expand(
          'myPalette(brand)',
        ),
      ).toBe(
        'myPalette(brand)',
      )
      expect(
        mocks.createOklchUtilityColor,
      ).not.toHaveBeenCalled()
    })
    it('warns and preserves the remaining source for an unclosed palette call', () => {
      const warnings: CipoWarning[] = []
      const result =
        expandRuntimeDesignFeatures(
          'color:red;palette(brand',
          warnings,
        )
      expect(result).toBe(
        'color:red;palette(brand',
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-palette-unclosed',
          message:
            'Unclosed runtime palette(...) call.',
        },
      ])
    })
    it('expands multiple palette calls independently', () => {
      const result =
        expand(
          'palette(primary, blue)\npalette(danger, red)',
        )
      expect(result).toContain(
        '$$primary-500: oklch-blue-500',
      )
      expect(result).toContain(
        '$$danger-500: oklch-red-500',
      )
      expect(
        mocks.createOklchUtilityColor,
      ).toHaveBeenCalledTimes(22)
    })
  })
  describe('context provider calls', () => {
    it('expands provide() into a context custom-property declaration', () => {
      expect(
        expand(
          'provide(theme: dark)',
        ),
      ).toBe(
        '$$context-theme: dark',
      )
    })
    it('converts mixed-case provider names to kebab case', () => {
      expect(
        expand(
          'provide(colorScheme: dark)',
        ),
      ).toBe(
        '$$context-color-scheme: dark',
      )
    })
    it('preserves complex provider values', () => {
      expect(
        expand(
          'provide(theme: var(--application-theme))',
        ),
      ).toBe(
        '$$context-theme: var(--application-theme)',
      )
    })
    it('uses only a top-level colon as the name/value boundary', () => {
      expect(
        expand(
          'provide(query: url("https://example.com:a"))',
        ),
      ).toBe(
        '$$context-query: url("https://example.com:a")',
      )
    })
    it('returns an empty replacement when the provider has no separator', () => {
      expect(
        expand(
          'before;provide(invalid);after;',
        ),
      ).toBe(
        'before;;after;',
      )
    })
    it('returns an empty replacement when the provider name is empty', () => {
      expect(
        expand(
          'before;provide(: value);after;',
        ),
      ).toBe(
        'before;;after;',
      )
    })
    it('returns an empty replacement when the provider value is empty', () => {
      expect(
        expand(
          'before;provide(theme: );after;',
        ),
      ).toBe(
        'before;;after;',
      )
    })
    it('does not expand provide calls inside quoted strings', () => {
      expect(
        expand(
          'content:"provide(theme: dark)";',
        ),
      ).toBe(
        'content:"provide(theme: dark)";',
      )
    })
    it('does not match provide as part of a larger identifier', () => {
      expect(
        expand(
          'provider(theme: dark)',
        ),
      ).toBe(
        'provider(theme: dark)',
      )
    })
    it('preserves an unclosed provide call instead of partially rewriting it', () => {
      expect(
        expand(
          'before;provide(theme: dark',
        ),
      ).toBe(
        'before;provide(theme: dark',
      )
    })
  })
  describe('pipeline composition', () => {
    it('runs feature-block rewriting before palette expansion', () => {
      const result =
        expand(
          'slot(theme){palette(brand, blue)}',
        )
      expect(result).toContain('[data-slot="theme"]{')
      expect(result).toContain('$$brand-50: oklch-blue-50')
      expect(result).toContain('$$brand-500: oklch-blue-500')
      expect(result).toContain('$$brand-950: oklch-blue-950')
      expect(result.endsWith('}')).toBe(true)
    })
    it('expands provide calls after runtime block rewriting', () => {
      expect(
        expand(
          'slot(theme){provide(colorScheme: dark)}',
        ),
      ).toBe(
        '[data-slot="theme"]{$$context-color-scheme: dark}',
      )
    })
    it('expands palette and provide calls inside variant choices', () => {
      const result =
        expand(
          'variant(theme){dark{palette(primary, blue)provide(mode: dark)}}',
        )
      expect(result).toContain(
        '&[data-theme="dark"], &.theme-dark{',
      )
      expect(result).toContain(
        '$$primary-500: oklch-blue-500',
      )
      expect(result).toContain(
        '$$context-mode: dark',
      )
    })
    it('supports deeply composed runtime design features', () => {
      const result =
        expand(
          [
            'slot(button){',
            'variant(size){',
            'small{',
            'compound(tone: danger){',
            'dark{color:white;}',
            '}',
            '}',
            '}',
            '}',
          ].join(''),
        )
      expect(result).toBe(
        [
          '[data-slot="button"]{',
          '&[data-size="small"], &.size-small{',
          '&[data-tone="danger"], &.tone-danger{',
          'x:dark{color:white;}',
          '}',
          '}',
          '\n',
          '}',
        ].join(''),
      )
    })
    it('collects warnings from multiple independent malformed runtime features', () => {
      const warnings: CipoWarning[] = []
      expandRuntimeDesignFeatures(
        [
          'slot(){a:1;}',
          'variant(size){}',
          'compound(invalid){b:2;}',
          'palette(unclosed',
        ].join(''),
        warnings,
      )
      expect(warnings).toEqual([
        {
          code:
            'cipo-slot-empty',
          message:
            'Runtime slot() needs a slot name.',
        },
        {
          code:
            'cipo-variant-empty-body',
          message:
            'Runtime variant(size) has no choices.',
        },
        {
          code:
            'cipo-compound-empty',
          message:
            'Runtime compound() needs at least one key/value pair.',
        },
        {
          code:
            'cipo-palette-unclosed',
          message:
            'Unclosed runtime palette(...) call.',
        },
      ])
    })
    it('does not mutate pre-existing warnings', () => {
      const existing: CipoWarning = {
        code: 'existing-warning',
        message: 'Existing warning',
      }
      const warnings = [
        existing,
      ]
      expandRuntimeDesignFeatures(
        'slot(){color:red;}',
        warnings,
      )
      expect(warnings).toEqual([
        existing,
        {
          code:
            'cipo-slot-empty',
          message:
            'Runtime slot() needs a slot name.',
        },
      ])
      expect(warnings[0]).toBe(
        existing,
      )
    })
    it('is deterministic for identical input', () => {
      const input =
        'slot(button){variant(size){small{dark{color:red;}}}}'
      const firstWarnings:
        CipoWarning[] = []
      const secondWarnings:
        CipoWarning[] = []
      const first =
        expandRuntimeDesignFeatures(
          input,
          firstWarnings,
        )
      const second =
        expandRuntimeDesignFeatures(
          input,
          secondWarnings,
        )
      expect(second).toBe(first)
      expect(secondWarnings).toEqual(
        firstWarnings,
      )
    })
  })
  describe('malformed input safety', () => {
    it('preserves an unclosed generic feature block instead of throwing', () => {
      const warnings: CipoWarning[] = []
      expect(() =>
        expandRuntimeDesignFeatures(
          'slot(button){color:red;',
          warnings,
        ),
      ).not.toThrow()
      expect(
        expandRuntimeDesignFeatures(
          'slot(button){color:red;',
          [],
        ),
      ).toBe(
        'slot(button){color:red;',
      )
    })
    it('preserves an identifier with an unclosed argument list during block rewriting', () => {
      expect(
        expand(
          'slot(button{color:red;}',
        ),
      ).toBe(
        'slot(button{color:red;}',
      )
    })
    it('does not throw for empty input', () => {
      expect(
        expand(''),
      ).toBe('')
    })
    it('does not throw for arbitrary ordinary CSS', () => {
      const css = [
        '.button{',
        'color:red;',
        'background:linear-gradient(red, blue);',
        '}',
      ].join('')
      expect(
        expand(css),
      ).toBe(css)
    })
  })
  describe('regression contracts', () => {
    it(
      'ignores palette() and provide() text inside CSS comments',
      () => {
        const input = '/* palette(Brand, 500) provide(theme: dark) */'
        expect(expand(input)).toBe(input)
        expect(mocks.createOklchUtilityColor).not.toHaveBeenCalled()
      },
    )
    it(
      'uses escape parity instead of checking only the immediately preceding backslash when scanning quoted strings',
      () => {
        const input = String.raw`content:"x\\";palette(brand, brand)`
        expect(expand(input)).toContain('oklch-brand-500')
      },
    )
    it(
      'defines whether malformed provide() calls should emit diagnostics instead of disappearing silently',
      () => {
        const warnings: CipoWarning[] = []
        const input = 'provide(theme)'
        expect(expandRuntimeDesignFeatures(input, warnings)).toBe('')
        expect(warnings.some((warning) => warning.code === 'cipo-provide-invalid')).toBe(true)
      },
    )
    it.todo(
      'defines whether an unclosed outer variant block should emit a variant-specific diagnostic',
    )
    it(
      'defines whether palette source names should preserve case normalization semantics or always canonicalize before hashing unknown colors',
      () => {
        expand('palette(primary, BrandAccent)')
        expect(mocks.createOklchUtilityColor).toHaveBeenCalledWith('brand-accent', 500)
      },
    )
  })
})
function expand(
  input: string,
): string {
  return expandRuntimeDesignFeatures(
    input,
    [],
  )
}
