import { describe, expect, it } from 'vitest'
import {
  createOklchUtilityColor,
  expandRuntimeColorUtilities,
} from './colors'
describe('runtime color utilities', () => {
  describe('expandRuntimeColorUtilities', () => {
    it('expands a background color utility into a CSS background declaration', () => {
      expect(
        expandRuntimeColorUtilities(
          'bg-blue-500',
        ),
      ).toBe(
        `background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }`,
      )
    })
    it('expands a foreground color utility into a CSS color declaration', () => {
      expect(
        expandRuntimeColorUtilities(
          'color-red-500',
        ),
      ).toBe(
        `color: ${
          createOklchUtilityColor(
            'red',
            500,
          )
        }`,
      )
    })
    it('preserves leading indentation when expanding a utility', () => {
      expect(
        expandRuntimeColorUtilities(
          '    bg-blue-500',
        ),
      ).toBe(
        `    background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }`,
      )
    })
    it('accepts a trailing semicolon on utility lines', () => {
      expect(
        expandRuntimeColorUtilities(
          'color-green-500;',
        ),
      ).toBe(
        `color: ${
          createOklchUtilityColor(
            'green',
            500,
          )
        }`,
      )
    })
    it('expands multiple utility lines independently', () => {
      const input = [
        'bg-blue-500',
        'color-red-700',
      ].join('\n')
      expect(
        expandRuntimeColorUtilities(
          input,
        ),
      ).toBe([
        `background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }`,
        `color: ${
          createOklchUtilityColor(
            'red',
            700,
          )
        }`,
      ].join('\n'))
    })
    it('preserves ordinary CSS declarations unchanged', () => {
      expect(
        expandRuntimeColorUtilities(
          'color: red;',
        ),
      ).toBe(
        'color: red;',
      )
    })
    it('does not expand lines containing a colon', () => {
      expect(
        expandRuntimeColorUtilities(
          'bg-blue-500: hover',
        ),
      ).toBe(
        'bg-blue-500: hover',
      )
    })
    it('does not expand selector or block syntax', () => {
      const input = [
        '.button {',
        '  bg-blue-500',
        '}',
      ].join('\n')
      expect(
        expandRuntimeColorUtilities(
          input,
        ),
      ).toBe([
        '.button {',
        `  background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }`,
        '}',
      ].join('\n'))
    })
    it('does not expand a utility when braces appear on the same line', () => {
      expect(
        expandRuntimeColorUtilities(
          '.button { bg-blue-500 }',
        ),
      ).toBe(
        '.button { bg-blue-500 }',
      )
    })
    it('preserves unknown utility names unchanged', () => {
      expect(
        expandRuntimeColorUtilities(
          'border-blue-500',
        ),
      ).toBe(
        'border-blue-500',
      )
    })
    it('preserves malformed color utilities unchanged', () => {
      const cases = [
        'bg-blue',
        'bg-blue-',
        'bg-blue-1000',
        'bg-blue--500',
        'bg-500',
        'color-red-auto',
      ]
      for (const input of cases) {
        expect(
          expandRuntimeColorUtilities(
            input,
          ),
        ).toBe(
          input,
        )
      }
    })
    it('accepts one to three decimal digits as the shade syntax', () => {
      const input = [
        'bg-blue-0',
        'bg-blue-5',
        'bg-blue-50',
        'bg-blue-500',
        'bg-blue-999',
      ].join('\n')
      expect(
        expandRuntimeColorUtilities(
          input,
        ),
      ).toBe([
        `background: ${
          createOklchUtilityColor(
            'blue',
            0,
          )
        }`,
        `background: ${
          createOklchUtilityColor(
            'blue',
            5,
          )
        }`,
        `background: ${
          createOklchUtilityColor(
            'blue',
            50,
          )
        }`,
        `background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }`,
        `background: ${
          createOklchUtilityColor(
            'blue',
            999,
          )
        }`,
      ].join('\n'))
    })
    it('accepts uppercase color names case-insensitively', () => {
      expect(
        expandRuntimeColorUtilities(
          'bg-BLUE-500',
        ),
      ).toBe(
        `background: ${createOklchUtilityColor('BLUE', 500)}`,
      )
    })
    it('supports custom lowercase color names through hashed hue generation', () => {
      expect(
        expandRuntimeColorUtilities(
          'bg-brand-500',
        ),
      ).toBe(
        `background: ${
          createOklchUtilityColor(
            'brand',
            500,
          )
        }`,
      )
    })
    it('preserves blank lines between utilities', () => {
      const input = [
        'bg-blue-500',
        '',
        'color-red-500',
      ].join('\n')
      expect(
        expandRuntimeColorUtilities(
          input,
        ),
      ).toBe([
        `background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }`,
        '',
        `color: ${
          createOklchUtilityColor(
            'red',
            500,
          )
        }`,
      ].join('\n'))
    })
    it('preserves CRLF line separators while processing each physical line', () => {
      const input =
        'bg-blue-500\r\ncolor-red-500'
      expect(
        expandRuntimeColorUtilities(
          input,
        ),
      ).toBe(
        `background: ${
          createOklchUtilityColor(
            'blue',
            500,
          )
        }\r\ncolor: ${
          createOklchUtilityColor(
            'red',
            500,
          )
        }`,
      )
    })
    it('does not modify text merely containing a utility token', () => {
      const cases = [
        'prefix bg-blue-500',
        'bg-blue-500 suffix',
        '"bg-blue-500"',
        'var(bg-blue-500)',
      ]
      for (const input of cases) {
        expect(
          expandRuntimeColorUtilities(
            input,
          ),
        ).toBe(
          input,
        )
      }
    })
  })
  describe('createOklchUtilityColor', () => {
    it('creates a deterministic midpoint color for a known hue', () => {
      expect(
        createOklchUtilityColor(
          'blue',
          500,
        ),
      ).toBe(
        'oklch(0.5396 0.28 260)',
      )
    })
    it('uses the configured hue for known color names', () => {
      expect(
        createOklchUtilityColor(
          'red',
          500,
        ),
      ).toBe(
        'oklch(0.5396 0.28 29)',
      )
      expect(
        createOklchUtilityColor(
          'green',
          500,
        ),
      ).toBe(
        'oklch(0.5396 0.28 150)',
      )
      expect(
        createOklchUtilityColor(
          'accent',
          500,
        ),
      ).toBe(
        'oklch(0.5396 0.28 205)',
      )
    })
    it.each([
      ['slate', 260],
      ['gray', 260],
      ['zinc', 260],
      ['neutral', 260],
      ['stone', 60],
      ['red', 29],
      ['orange', 45],
      ['amber', 72],
      ['yellow', 92],
      ['lime', 125],
      ['green', 150],
      ['emerald', 162],
      ['teal', 185],
      ['cyan', 215],
      ['sky', 240],
      ['blue', 260],
      ['indigo', 278],
      ['violet', 300],
      ['purple', 315],
      ['fuchsia', 334],
      ['pink', 350],
      ['rose', 18],
      ['accent', 205],
    ] as const)(
      'uses hue %d for known color %s',
      (
        name,
        expectedHue,
      ) => {
        expect(
          createOklchUtilityColor(
            name,
            0,
          ),
        ).toBe(
          `oklch(0.92 0.04 ${expectedHue})`,
        )
      },
    )
    it('produces the light endpoint at shade zero', () => {
      expect(
        createOklchUtilityColor(
          'blue',
          0,
        ),
      ).toBe(
        'oklch(0.92 0.04 260)',
      )
    })
    it('produces the dark endpoint at shade 999', () => {
      expect(
        createOklchUtilityColor(
          'blue',
          999,
        ),
      ).toBe(
        'oklch(0.16 0.04 260)',
      )
    })
    it('increases chroma toward the middle of the shade range', () => {
      const light =
        parseOklch(
          createOklchUtilityColor(
            'blue',
            0,
          ),
        )
      const middle =
        parseOklch(
          createOklchUtilityColor(
            'blue',
            500,
          ),
        )
      const dark =
        parseOklch(
          createOklchUtilityColor(
            'blue',
            999,
          ),
        )
      expect(
        middle.chroma,
      ).toBeGreaterThan(
        light.chroma,
      )
      expect(
        middle.chroma,
      ).toBeGreaterThan(
        dark.chroma,
      )
    })
    it('decreases lightness monotonically from light to dark shades', () => {
      const shades = [
        0,
        100,
        300,
        500,
        700,
        900,
        999,
      ]
      const lightnesses =
        shades.map(
          (shade) =>
            parseOklch(
              createOklchUtilityColor(
                'blue',
                shade,
              ),
            ).lightness,
        )
      for (
        let index = 1;
        index < lightnesses.length;
        index += 1
      ) {
        expect(
          lightnesses[index],
        ).toBeLessThan(
          lightnesses[
            index - 1
          ]!,
        )
      }
    })
    it('clamps negative shades to zero', () => {
      expect(
        createOklchUtilityColor(
          'blue',
          -100,
        ),
      ).toBe(
        createOklchUtilityColor(
          'blue',
          0,
        ),
      )
    })
    it('clamps shades above 999 to 999', () => {
      expect(
        createOklchUtilityColor(
          'blue',
          5000,
        ),
      ).toBe(
        createOklchUtilityColor(
          'blue',
          999,
        ),
      )
    })
    it.each([
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ])(
      'falls back to shade 500 for non-finite shade %s',
      (shade) => {
        expect(
          createOklchUtilityColor(
            'blue',
            shade,
          ),
        ).toBe(
          createOklchUtilityColor(
            'blue',
            500,
          ),
        )
      },
    )
    it('accepts fractional shades without truncating them', () => {
      const first =
        createOklchUtilityColor(
          'blue',
          500,
        )
      const fractional =
        createOklchUtilityColor(
          'blue',
          500.5,
        )
      expect(
        fractional,
      ).not.toBe(first)
    })
    it('uses a deterministic hashed hue for unknown color names', () => {
      expect(
        createOklchUtilityColor(
          'brand',
          500,
        ),
      ).toBe(
        'oklch(0.5396 0.28 159)',
      )
    })
    it('produces different hashed hues for different unknown names', () => {
      const brand =
        parseOklch(
          createOklchUtilityColor(
            'brand',
            500,
          ),
        )
      const custom =
        parseOklch(
          createOklchUtilityColor(
            'custom',
            500,
          ),
        )
      expect(brand.hue).toBe(159)
      expect(custom.hue).toBe(337)
      expect(brand.hue).not.toBe(
        custom.hue,
      )
    })
    it('keeps unknown hashed hues inside the CSS hue range', () => {
      const names = [
        '',
        'brand',
        'custom',
        'company',
        'application',
        'some-very-long-color-name',
      ]
      for (const name of names) {
        const {
          hue,
        } = parseOklch(
          createOklchUtilityColor(
            name,
            500,
          ),
        )
        expect(hue).toBeGreaterThanOrEqual(
          0,
        )
        expect(hue).toBeLessThan(
          360,
        )
      }
    })
    it('is deterministic for unknown color names', () => {
      const first =
        createOklchUtilityColor(
          'company-brand',
          437,
        )
      const second =
        createOklchUtilityColor(
          'company-brand',
          437,
        )
      expect(second).toBe(first)
    })
    it('rounds generated numeric channels to at most four decimal places', () => {
      const result =
        createOklchUtilityColor(
          'blue',
          123,
        )
      const match =
        /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(
          result,
        )
      expect(match).not.toBeNull()
      for (
        const value
        of match!.slice(
          1,
        )
      ) {
        const decimals =
          value.split('.')[1]
        expect(
          decimals?.length ?? 0,
        ).toBeLessThanOrEqual(
          4,
        )
      }
    })
    it('keeps generated lightness and chroma within their documented bounds', () => {
      const shades = [
        -1000,
        0,
        100,
        250,
        500,
        750,
        999,
        2000,
      ]
      for (const shade of shades) {
        const color =
          parseOklch(
            createOklchUtilityColor(
              'blue',
              shade,
            ),
          )
        expect(
          color.lightness,
        ).toBeGreaterThanOrEqual(
          0.12,
        )
        expect(
          color.lightness,
        ).toBeLessThanOrEqual(
          0.96,
        )
        expect(
          color.chroma,
        ).toBeGreaterThanOrEqual(
          0.035,
        )
        expect(
          color.chroma,
        ).toBeLessThanOrEqual(
          0.28,
        )
      }
    })
  })
  describe('utility expansion integration', () => {
    it('maps bg-* and color-* utilities to the same deterministic palette function', () => {
      const color =
        createOklchUtilityColor(
          'violet',
          600,
        )
      expect(
        expandRuntimeColorUtilities(
          [
            'bg-violet-600',
            'color-violet-600',
          ].join('\n'),
        ),
      ).toBe([
        `background: ${color}`,
        `color: ${color}`,
      ].join('\n'))
    })
    it('can expand known and hash-derived colors in the same input', () => {
      expect(
        expandRuntimeColorUtilities(
          [
            'bg-blue-500',
            'color-brand-500',
          ].join('\n'),
        ),
      ).toBe([
        'background: oklch(0.5396 0.28 260)',
        'color: oklch(0.5396 0.28 159)',
      ].join('\n'))
    })
  })
  describe('regression contracts', () => {
    it(
      'preserves the exact presence or absence of a trailing newline instead of always appending one',
      () => {
        expect(expandRuntimeColorUtilities('bg-blue-500')).not.toMatch(/\n$/)
        expect(expandRuntimeColorUtilities('bg-blue-500\n')).toMatch(/\n$/)
      },
    )
    it(
      'does not append an extra blank line when the input already ends with a newline',
      () => {
        const output = expandRuntimeColorUtilities('bg-blue-500\n')
        expect(output.endsWith('\n')).toBe(true)
        expect(output.endsWith('\n\n')).toBe(false)
      },
    )
    it(
      'treats CRLF as one logical line terminator instead of independently flushing on carriage return and line feed',
      () => {
        const output = expandRuntimeColorUtilities('bg-blue-500\r\ncolor-red-500')
        expect(output.split('\r\n')).toHaveLength(2)
        expect(output).not.toContain('\r\n\r\n')
      },
    )
    it(
      'defines whether utility color names should support digits or hyphenated custom palette names',
      () => {
        const output = expandRuntimeColorUtilities('bg-brand-2-500\ncolor-accent-2026-400')
        expect(output).toContain('background: oklch(')
        expect(output).toContain('color: oklch(')
      },
    )
  })
})
interface ParsedOklch {
  readonly lightness: number
  readonly chroma: number
  readonly hue: number
}
function parseOklch(
  value: string,
): ParsedOklch {
  const match =
    /^oklch\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)$/.exec(
      value,
    )
  if (!match) {
    throw new Error(
      `Invalid OKLCH color: ${value}`,
    )
  }
  return {
    lightness: Number(
      match[1],
    ),
    chroma: Number(
      match[2],
    ),
    hue: Number(
      match[3],
    ),
  }
}
