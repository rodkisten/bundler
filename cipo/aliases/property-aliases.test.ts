import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  BUILT_IN_PROPERTY_ALIASES,
  clearBuiltInPropertyAliasCache,
  inferBuiltInScale,
  resolveBuiltInPropertyAlias,
  toCssPropertyName,
} from './property-aliases'
describe('built-in property aliases', () => {
  beforeEach(() => {
    clearBuiltInPropertyAliasCache()
  })
  describe('registry', () => {
    it('exposes an immutable alias registry', () => {
      expect(
        Object.isFrozen(
          BUILT_IN_PROPERTY_ALIASES,
        ),
      ).toBe(true)
    })
    it('contains only valid property-scale tuples', () => {
      const validScales =
        new Set([
          'spacing',
          'color',
          'radius',
          'shadow',
          'text',
          'none',
        ])
      for (
        const [
          name,
          entry,
        ] of Object.entries(
          BUILT_IN_PROPERTY_ALIASES,
        )
      ) {
        expect(
          name.length,
        ).toBeGreaterThan(0)
        expect(
          Array.isArray(entry),
        ).toBe(true)
        expect(
          entry,
        ).toHaveLength(2)
        expect(
          entry[0].length,
        ).toBeGreaterThan(0)
        expect(
          validScales.has(
            entry[1],
          ),
        ).toBe(true)
      }
    })
    it('automatically registers kebab-case equivalents for camel-case aliases', () => {
      const cases = [
        'insetX',
        'bleedX',
        'gridCols',
        'textSize',
        'bgColor',
        'borderX',
        'roundedTl',
        'textShadow',
        'mixBlend',
      ] as const
      for (const name of cases) {
        const kebab =
          name.replace(
            /([a-z0-9])([A-Z])/g,
            '$1-$2',
          )
            .toLowerCase()
        expect(
          BUILT_IN_PROPERTY_ALIASES[
            kebab
          ],
        ).toEqual(
          BUILT_IN_PROPERTY_ALIASES[
            name
          ],
        )
      }
    })
    it.each([
      [
        'w',
        'width',
        'spacing',
      ],
      [
        'h',
        'height',
        'spacing',
      ],
      [
        'p',
        'padding',
        'spacing',
      ],
      [
        'px',
        'padding-inline',
        'spacing',
      ],
      [
        'mx',
        'margin-inline',
        'spacing',
      ],
      [
        'gapX',
        'column-gap',
        'spacing',
      ],
      [
        'bg',
        'background',
        'color',
      ],
      [
        'bgColor',
        'background-color',
        'color',
      ],
      [
        'text',
        'font-size',
        'text',
      ],
      [
        'fs',
        'font-size',
        'text',
      ],
      [
        'rounded',
        'border-radius',
        'radius',
      ],
      [
        'shadow',
        'box-shadow',
        'shadow',
      ],
      [
        'ring',
        'box-shadow',
        'shadow',
      ],
      [
        'pos',
        'position',
        'none',
      ],
    ])(
      'registers %s as %s using the %s scale',
      (
        name,
        property,
        scale,
      ) => {
        expect(
          BUILT_IN_PROPERTY_ALIASES[
            name
          ],
        ).toEqual([
          property,
          scale,
        ])
      },
    )
  })
  describe('toCssPropertyName', () => {
    it.each([
      [
        'backgroundColor',
        'background-color',
      ],
      [
        'gridTemplateColumns',
        'grid-template-columns',
      ],
      [
        'scrollMarginInlineStart',
        'scroll-margin-inline-start',
      ],
      [
        'viewTransitionName',
        'view-transition-name',
      ],
      [
        'animationTimeline',
        'animation-timeline',
      ],
      [
        'positionAnchor',
        'position-anchor',
      ],
      [
        'font-size',
        'font-size',
      ],
      [
        'snake_case_property',
        'snake-case-property',
      ],
    ])(
      'canonicalizes %s to %s',
      (
        input,
        expected,
      ) => {
        expect(
          toCssPropertyName(
            input,
          ),
        ).toBe(expected)
      },
    )
    it.each([
      [
        'WebkitLineClamp',
        '-webkit-line-clamp',
      ],
      [
        'MozAppearance',
        '-moz-appearance',
      ],
      [
        'msOverflowStyle',
        '-ms-overflow-style',
      ],
      [
        'OTransition',
        '-o-transition',
      ],
    ])(
      'normalizes vendor-prefixed property %s',
      (
        input,
        expected,
      ) => {
        expect(
          toCssPropertyName(
            input,
          ),
        ).toBe(expected)
      },
    )
    it('preserves custom property case exactly', () => {
      expect(
        toCssPropertyName(
          '--MyDesignToken',
        ),
      ).toBe(
        '--MyDesignToken',
      )
    })
    it('trims surrounding whitespace', () => {
      expect(
        toCssPropertyName(
          '  backgroundColor  ',
        ),
      ).toBe(
        'background-color',
      )
    })
    it('returns an empty string for empty input', () => {
      expect(
        toCssPropertyName(
          '   ',
        ),
      ).toBe('')
    })
  })
  describe('resolveBuiltInPropertyAlias', () => {
    it('resolves explicit Cipó aliases before native-property fallback', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'bg',
        ),
      ).toEqual([
        'background',
        'color',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'size',
        ),
      ).toEqual([
        'inline-size',
        'spacing',
      ])
    })
    it('resolves generated kebab-case aliases', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'bg-color',
        ),
      ).toEqual([
        'background-color',
        'color',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'grid-cols',
        ),
      ).toEqual([
        'grid-template-columns',
        'none',
      ])
    })
    it('allows native camel-case CSS properties without registry entries', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'backgroundColor',
        ),
      ).toEqual([
        'background-color',
        'color',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'gridTemplateColumns',
        ),
      ).toEqual([
        'grid-template-columns',
        'none',
      ])
    })
    it('allows future CSS properties without adding them to the registry', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'viewTransitionName',
        ),
      ).toEqual([
        'view-transition-name',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'animationTimeline',
        ),
      ).toEqual([
        'animation-timeline',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'positionAnchor',
        ),
      ).toEqual([
        'position-anchor',
        'none',
      ])
    })
    it('preserves custom properties', () => {
      expect(
        resolveBuiltInPropertyAlias(
          '--MyDesignToken',
        ),
      ).toEqual([
        '--MyDesignToken',
        'none',
      ])
    })
    it('keeps native CSS shorthands native instead of shadowing them with convenience aliases', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'font',
        ),
      ).toEqual([
        'font',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'grid',
        ),
      ).toEqual([
        'grid',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'content',
        ),
      ).toEqual([
        'content',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'transform',
        ),
      ).toEqual([
        'transform',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'direction',
        ),
      ).toEqual([
        'direction',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'textDecoration',
        ),
      ).toEqual([
        'text-decoration',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'listStyle',
        ),
      ).toEqual([
        'list-style',
        'none',
      ])
    })
    it('provides explicit convenience aliases without changing native equivalents', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'ff',
        ),
      ).toEqual([
        'font-family',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'fontFamily',
        ),
      ).toEqual([
        'font-family',
        'none',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'gridCols',
        ),
      ).toEqual([
        'grid-template-columns',
        'none',
      ])
    })
    it('resolves physical and logical radius aliases independently', () => {
      expect(
        resolveBuiltInPropertyAlias(
          'roundedTl',
        ),
      ).toEqual([
        'border-top-left-radius',
        'radius',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'roundedBr',
        ),
      ).toEqual([
        'border-bottom-right-radius',
        'radius',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'roundedSs',
        ),
      ).toEqual([
        'border-start-start-radius',
        'radius',
      ])
      expect(
        resolveBuiltInPropertyAlias(
          'roundedEe',
        ),
      ).toEqual([
        'border-end-end-radius',
        'radius',
      ])
    })
    it('returns undefined for empty or lexically invalid property names', () => {
      expect(
        resolveBuiltInPropertyAlias(
          '',
        ),
      ).toBeUndefined()
      expect(
        resolveBuiltInPropertyAlias(
          '123invalid',
        ),
      ).toBeUndefined()
      expect(
        resolveBuiltInPropertyAlias(
          '@property',
        ),
      ).toBeUndefined()
    })
  })
  describe('scale inference', () => {
    it.each([
      [
        'font-size',
        'text',
      ],
      [
        'box-shadow',
        'shadow',
      ],
      [
        'text-shadow',
        'shadow',
      ],
      [
        'border-radius',
        'radius',
      ],
      [
        'border-top-left-radius',
        'radius',
      ],
      [
        'color',
        'color',
      ],
      [
        'background',
        'color',
      ],
      [
        'background-color',
        'color',
      ],
      [
        'border',
        'color',
      ],
      [
        'border-top',
        'color',
      ],
      [
        'outline-color',
        'color',
      ],
      [
        'fill',
        'color',
      ],
      [
        'stroke',
        'color',
      ],
      [
        'scrollbar-color',
        'color',
      ],
    ])(
      'infers %s as %s',
      (
        property,
        scale,
      ) => {
        expect(
          inferBuiltInScale(
            property,
          ),
        ).toBe(scale)
      },
    )
    it.each([
      'padding',
      'padding-inline',
      'padding-block-start',
      'margin',
      'margin-inline-end',
      'scroll-padding',
      'scroll-margin-top',
      'inset',
      'inset-inline',
      'width',
      'min-width',
      'max-height',
      'inline-size',
      'min-block-size',
      'border-width',
      'border-top-width',
      'gap',
      'row-gap',
      'column-gap',
      'flex-basis',
      'outline-width',
      'outline-offset',
      'text-indent',
      'text-underline-offset',
      'translate',
      'perspective',
      'offset-distance',
      'column-width',
    ])(
      'infers %s as spacing',
      (property) => {
        expect(
          inferBuiltInScale(
            property,
          ),
        ).toBe(
          'spacing',
        )
      },
    )
    it.each([
      'display',
      'position',
      'transform',
      'grid-template-columns',
      'background-image',
      'animation',
      'transition',
      'view-transition-name',
      'animation-timeline',
      '--CustomToken',
    ])(
      'conservatively leaves %s on the none scale',
      (property) => {
        expect(
          inferBuiltInScale(
            property,
          ),
        ).toBe(
          'none',
        )
      },
    )
  })
  describe('resolution cache', () => {
    it('returns the same tuple instance for repeated dynamically resolved properties', () => {
      const first =
        resolveBuiltInPropertyAlias(
          'viewTransitionClass',
        )
      const second =
        resolveBuiltInPropertyAlias(
          'viewTransitionClass',
        )
      expect(second).toBe(first)
    })
    it('clears dynamically cached resolutions', () => {
      const first =
        resolveBuiltInPropertyAlias(
          'futureExperimentalProperty',
        )
      clearBuiltInPropertyAliasCache()
      const second =
        resolveBuiltInPropertyAlias(
          'futureExperimentalProperty',
        )
      expect(second).toEqual(first)
      expect(second).not.toBe(first)
    })
    it('evicts the oldest dynamic resolution after exceeding the 512-entry bound', () => {
      const oldest =
        resolveBuiltInPropertyAlias(
          'future-property-0',
        )
      for (
        let index = 1;
        index <= 512;
        index += 1
      ) {
        resolveBuiltInPropertyAlias(
          `future-property-${index}`,
        )
      }
      const resolvedAgain =
        resolveBuiltInPropertyAlias(
          'future-property-0',
        )
      expect(
        resolvedAgain,
      ).toEqual(oldest)
      expect(
        resolvedAgain,
      ).not.toBe(oldest)
    })
    it('does not cache explicit aliases through the dynamic resolution cache', () => {
      const first =
        resolveBuiltInPropertyAlias(
          'bg',
        )
      clearBuiltInPropertyAliasCache()
      const second =
        resolveBuiltInPropertyAlias(
          'bg',
        )
      expect(second).toBe(first)
    })
  })
  describe('regression contracts', () => {
    it('rejects lexically valid unknown properties in strict mode while accepting manifest-backed native properties', () => {
      const isNativeProperty = (property: string) => property === 'display'
      expect(
        resolveBuiltInPropertyAlias('display', {
          strict: true,
          isNativeProperty,
        }),
      ).toEqual(['display', 'none'])
      expect(
        resolveBuiltInPropertyAlias('definitely-not-a-css-property', {
          strict: true,
          isNativeProperty,
        }),
      ).toBeUndefined()
    })
    it('infers vendor-prefixed property scales from their unprefixed equivalent', () => {
      expect(inferBuiltInScale('-webkit-border-radius')).toBe('radius')
      expect(inferBuiltInScale('-moz-border-radius')).toBe('radius')
      expect(inferBuiltInScale('-webkit-text-size-adjust')).toBe('none')
    })
    it('keeps background on the color scale as the documented Cipó authoring convenience', () => {
      expect(inferBuiltInScale('background')).toBe('color')
      expect(resolveBuiltInPropertyAlias('background')).toEqual(['background', 'color'])
    })
    it('keeps border shorthand on the color scale as the documented Cipó authoring convenience', () => {
      expect(inferBuiltInScale('border')).toBe('color')
      expect(resolveBuiltInPropertyAlias('border')).toEqual(['border', 'color'])
    })
    it('accepts an externally supplied native-property manifest for strict CI validation', () => {
      const webRefProperties = new Set(['display', 'color', 'view-transition-name'])
      const isNativeProperty = (property: string) => webRefProperties.has(property)
      expect(
        resolveBuiltInPropertyAlias('viewTransitionName', {
          strict: true,
          isNativeProperty,
        }),
      ).toEqual(['view-transition-name', 'none'])
      expect(
        resolveBuiltInPropertyAlias('webref-missing-property', {
          strict: true,
          isNativeProperty,
        }),
      ).toBeUndefined()
    })
  })
})
