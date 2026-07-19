import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ValueNormalizer } from './contracts'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      prefix: 'cp',
    },
  },
  createDeclaration: vi.fn(
    (
      property: string,
      value: string,
    ) =>
      `${property}:${value};`,
  ),
  textSizeTokens: new Set([
    'xs',
    'sm',
    'base',
    'lg',
    'xl',
    '2xl',
  ]),
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../utils', async () => {
  const actual =
    await vi.importActual<
      typeof import('../utils')
    >('../utils')
  return {
    ...actual,
    createDeclaration:
      mocks.createDeclaration,
  }
})
vi.mock('./presets', () => ({
  TEXT_SIZE_TOKENS:
    mocks.textSizeTokens,
}))
import { createTextExpander } from './text'
describe('text value expander', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config.prefix = 'cp'
    mocks.createDeclaration.mockImplementation(
      (
        property: string,
        value: string,
      ) =>
        `${property}:${value};`,
    )
  })
  describe('standalone typography tokens', () => {
    it.each([
      [
        'underline',
        'text-decoration-line:underline;',
      ],
      [
        'no-underline',
        'text-decoration-line:none;',
      ],
      [
        'nowrap',
        'white-space:nowrap;',
      ],
      [
        'pre',
        'white-space:pre;',
      ],
      [
        'pre-wrap',
        'white-space:pre-wrap;',
      ],
      [
        'pre-line',
        'white-space:pre-line;',
      ],
      [
        'normal',
        'white-space:normal;',
      ],
      [
        'balance',
        'text-wrap:balance;',
      ],
      [
        'pretty',
        'text-wrap:pretty;',
      ],
      [
        'stable',
        'text-wrap:stable;',
      ],
      [
        'uppercase',
        'text-transform:uppercase;',
      ],
      [
        'lowercase',
        'text-transform:lowercase;',
      ],
      [
        'capitalize',
        'text-transform:capitalize;',
      ],
    ])(
      'expands standalone token %j',
      (
        token,
        expected,
      ) => {
        const expandText =
          createExpander()
        expect(
          expandText(token),
        ).toBe(expected)
      },
    )
    it('expands multiple standalone tokens in source order', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'underline, uppercase, balance',
        ),
      ).toBe([
        'text-decoration-line:underline;',
        'text-transform:uppercase;',
        'text-wrap:balance;',
      ].join(''))
    })
    it('ignores empty argument entries', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          ', underline, , uppercase,',
        ),
      ).toBe([
        'text-decoration-line:underline;',
        'text-transform:uppercase;',
      ].join(''))
    })
    it('ignores unknown standalone tokens', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'unknown-token',
        ),
      ).toBe('')
    })
  })
  describe('standalone color values', () => {
    it.each([
      '$brand',
      '$theme.primary',
      '#ff0000',
      'rgb(255, 0, 0)',
      'rgba(255, 0, 0, 0.5)',
      'hsl(0 100% 50%)',
      'hsla(0, 100%, 50%, 0.5)',
      'oklch(60% 0.2 30)',
      'oklab(0.6 0.1 0.1)',
      'transparent',
      'currentColor',
    ])(
      'treats %j as a color-like standalone value',
      (color) => {
        const normalizeValue =
          createNormalizer()
        const expandText =
          createTextExpander(
            normalizeValue,
          )
        expect(
          expandText(color),
        ).toBe(
          `color:normalized(color|${color}|color);`,
        )
        expect(
          normalizeValue,
        ).toHaveBeenCalledWith(
          'color',
          color,
          'color',
        )
      },
    )
    it('normalizes CSS named colors as standalone color values', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'red',
        ),
      ).toBe('color:normalized(color|red|color);')
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'color',
        'red',
        'color',
      )
    })
    it('normalizes multiple color-like standalone values independently', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          '$brand, #fff',
        ),
      ).toBe([
        'color:normalized(color|$brand|color);',
        'color:normalized(color|#fff|color);',
      ].join(''))
      expect(
        normalizeValue,
      ).toHaveBeenCalledTimes(2)
    })
  })
  describe('gradient shorthand', () => {
    it('expands a standalone gradient into text-clipping declarations', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'gradient(red, blue)',
        ),
      ).toBe([
        'background-image:normalized(background-image|gradient(red, blue));',
        '-webkit-background-clip:text;',
        'background-clip:text;',
        'color:transparent;',
      ].join(''))
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'background-image',
        'gradient(red, blue)',
      )
    })
    it('preserves nested commas inside gradient arguments', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expandText(
        'gradient(rgb(255, 0, 0), rgba(0, 0, 0, .5))',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'background-image',
        'gradient(rgb(255, 0, 0), rgba(0, 0, 0, .5))',
      )
    })
    it('can combine gradient text with other standalone typography tokens', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'gradient(red, blue), uppercase, nowrap',
        ),
      ).toBe([
        'background-image:normalized(background-image|gradient(red, blue));',
        '-webkit-background-clip:text;',
        'background-clip:text;',
        'color:transparent;',
        'text-transform:uppercase;',
        'white-space:nowrap;',
      ].join(''))
    })
  })
  describe('typed arguments', () => {
    it('expands a custom font size through the value normalizer', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'size: 18px',
        ),
      ).toBe(
        'font-size:normalized(font-size|18px);',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'font-size',
        '18px',
      )
    })
    it('resolves known size tokens directly through the configured CSS variable', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'size: sm',
        ),
      ).toBe(
        'font-size:var(--cp-text-sm);',
      )
      expect(
        normalizeValue,
      ).not.toHaveBeenCalled()
    })
    it('uses the active runtime prefix for known text-size tokens', () => {
      mocks.runtime.config.prefix =
        'application'
      const expandText =
        createExpander()
      expect(
        expandText(
          'size: xl',
        ),
      ).toBe(
        'font-size:var(--application-text-xl);',
      )
    })
    it('expands lh into line-height', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'lh: 1.5',
        ),
      ).toBe(
        'line-height:1.5;',
      )
    })
    it('supports leading as an alias for line-height', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'leading: 1.75',
        ),
      ).toBe(
        'line-height:1.75;',
      )
    })
    it('prefers lh over leading when both are provided', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'leading: 2, lh: 1.5',
        ),
      ).toBe(
        'line-height:1.5;',
      )
    })
    it('expands font weight directly', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'weight: 700',
        ),
      ).toBe(
        'font-weight:700;',
      )
    })
    it('normalizes typed colors with the color hint', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'color: $brand',
        ),
      ).toBe(
        'color:normalized(color|$brand|color);',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'color',
        '$brand',
        'color',
      )
    })
    it('expands text alignment directly', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'align: center',
        ),
      ).toBe(
        'text-align:center;',
      )
    })
    it('expands text decoration directly', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'decoration: line-through',
        ),
      ).toBe(
        'text-decoration-line:line-through;',
      )
    })
    it('normalizes text shadows with the shadow hint', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'shadow: 0 1px 2px $shadow',
        ),
      ).toBe(
        'text-shadow:normalized(text-shadow|0 1px 2px $shadow|shadow);',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'text-shadow',
        '0 1px 2px $shadow',
        'shadow',
      )
    })
    it('normalizes letter spacing through the core value normalizer', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'tracking: 0.05em',
        ),
      ).toBe(
        'letter-spacing:normalized(letter-spacing|0.05em);',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'letter-spacing',
        '0.05em',
      )
    })
    it('expands typed text-transform directly', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'transform: uppercase',
        ),
      ).toBe(
        'text-transform:uppercase;',
      )
    })
    it('expands typed text-wrap directly', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'wrap: pretty',
        ),
      ).toBe(
        'text-wrap:pretty;',
      )
    })
  })
  describe('fill shorthand', () => {
    it('expands fill into background-image text clipping', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'fill: linear-gradient(red, blue)',
        ),
      ).toBe([
        'background-image:normalized(background-image|linear-gradient(red, blue));',
        '-webkit-background-clip:text;',
        'background-clip:text;',
        'color:transparent;',
      ].join(''))
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'background-image',
        'linear-gradient(red, blue)',
      )
    })
    it('preserves nested commas in fill values', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expandText(
        'fill: linear-gradient(rgb(255, 0, 0), rgba(0, 0, 0, .5))',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'background-image',
        'linear-gradient(rgb(255, 0, 0), rgba(0, 0, 0, .5))',
      )
    })
  })
  describe('typed argument parsing', () => {
    it('does not mistake colons inside function arguments for typed argument separators', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expect(
        expandText(
          'rgb(255, 0, 0)',
        ),
      ).toBe(
        'color:normalized(color|rgb(255, 0, 0)|color);',
      )
    })
    it('does not split typed values at nested commas', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expandText(
        'shadow: rgba(0, 0, 0, .2) 0 2px 4px',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'text-shadow',
        'rgba(0, 0, 0, .2) 0 2px 4px',
        'shadow',
      )
    })
    it('uses the last value when a typed key is repeated', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'weight: 400, weight: 700',
        ),
      ).toBe(
        'font-weight:700;',
      )
    })
    it('ignores unknown typed keys', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'unknown: value',
        ),
      ).toBe('')
    })
  })
  describe('output ordering and cascade semantics', () => {
    it('emits standalone tokens before typed declarations regardless of argument position', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'weight: 700, underline, size: sm, uppercase',
        ),
      ).toBe([
        'text-decoration-line:underline;',
        'text-transform:uppercase;',
        'font-size:var(--cp-text-sm);',
        'font-weight:700;',
      ].join(''))
    })
    it('lets typed color declarations override earlier standalone colors through declaration order', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          '$primary, color: $secondary',
        ),
      ).toBe([
        'color:normalized(color|$primary|color);',
        'color:normalized(color|$secondary|color);',
      ].join(''))
    })
    it('lets typed transform declarations override standalone transform tokens', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'uppercase, transform: lowercase',
        ),
      ).toBe([
        'text-transform:uppercase;',
        'text-transform:lowercase;',
      ].join(''))
    })
    it('lets typed wrap declarations override standalone wrap tokens', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          'balance, wrap: pretty',
        ),
      ).toBe([
        'text-wrap:balance;',
        'text-wrap:pretty;',
      ].join(''))
    })
    it('lets fill override an earlier standalone color with transparent text color', () => {
      const expandText =
        createExpander()
      expect(
        expandText(
          '$brand, fill: linear-gradient(red, blue)',
        ),
      ).toBe([
        'color:normalized(color|$brand|color);',
        'background-image:normalized(background-image|linear-gradient(red, blue));',
        '-webkit-background-clip:text;',
        'background-clip:text;',
        'color:transparent;',
      ].join(''))
    })
    it('emits typed declarations in canonical order independent of source argument order', () => {
      const expandText =
        createExpander()
      const result =
        expandText(
          [
            'wrap: pretty',
            'tracking: 0.1em',
            'align: center',
            'weight: 700',
            'size: sm',
            'lh: 1.5',
          ].join(', '),
        )
      expect(result).toBe([
        'font-size:var(--cp-text-sm);',
        'line-height:1.5;',
        'font-weight:700;',
        'text-align:center;',
        'letter-spacing:normalized(letter-spacing|0.1em);',
        'text-wrap:pretty;',
      ].join(''))
    })
  })
  describe('createDeclaration integration', () => {
    it('delegates every emitted declaration to createDeclaration', () => {
      const expandText =
        createExpander()
      expandText(
        'underline, uppercase, size: sm, weight: 700',
      )
      expect(
        mocks.createDeclaration.mock.calls,
      ).toEqual([
        [
          'text-decoration-line',
          'underline',
        ],
        [
          'text-transform',
          'uppercase',
        ],
        [
          'font-size',
          'var(--cp-text-sm)',
        ],
        [
          'font-weight',
          '700',
        ],
      ])
    })
    it('does not emit declarations for empty input', () => {
      const expandText =
        createExpander()
      expect(
        expandText(''),
      ).toBe('')
      expect(
        mocks.createDeclaration,
      ).not.toHaveBeenCalled()
    })
  })
  describe('normalizer integration', () => {
    it('normalizes only properties requiring core value processing', () => {
      const normalizeValue =
        createNormalizer()
      const expandText =
        createTextExpander(
          normalizeValue,
        )
      expandText(
        [
          'size: 18px',
          'lh: 1.5',
          'weight: 700',
          'color: $brand',
          'align: center',
          'decoration: underline',
          'shadow: 0 1px 2px black',
          'tracking: 0.05em',
          'transform: uppercase',
          'wrap: pretty',
        ].join(', '),
      )
      expect(
        normalizeValue.mock.calls,
      ).toEqual([
        [
          'font-size',
          '18px',
        ],
        [
          'color',
          '$brand',
          'color',
        ],
        [
          'text-shadow',
          '0 1px 2px black',
          'shadow',
        ],
        [
          'letter-spacing',
          '0.05em',
        ],
      ])
    })
    it('keeps the normalizer bound to the expander instance', () => {
      const firstNormalizer =
        createNormalizer(
          'first',
        )
      const secondNormalizer =
        createNormalizer(
          'second',
        )
      const first =
        createTextExpander(
          firstNormalizer,
        )
      const second =
        createTextExpander(
          secondNormalizer,
        )
      expect(
        first(
          'color: $brand',
        ),
      ).toBe(
        'color:first(color|$brand|color);',
      )
      expect(
        second(
          'color: $brand',
        ),
      ).toBe(
        'color:second(color|$brand|color);',
      )
    })
  })
  describe('determinism', () => {
    it('produces identical output for identical input and configuration', () => {
      const expandText =
        createExpander()
      const input =
        'underline, size: sm, color: $brand, tracking: 0.05em'
      const first =
        expandText(input)
      const second =
        expandText(input)
      expect(second).toBe(first)
    })
    it('reads the current runtime prefix without retaining stale configuration', () => {
      const expandText =
        createExpander()
      const first =
        expandText(
          'size: sm',
        )
      mocks.runtime.config.prefix =
        'app'
      const second =
        expandText(
          'size: sm',
        )
      expect(first).toBe(
        'font-size:var(--cp-text-sm);',
      )
      expect(second).toBe(
        'font-size:var(--app-text-sm);',
      )
    })
  })
  describe('regression contracts', () => {
    it.each(['red', 'blue', 'rebeccapurple'])(
      'accepts named CSS color %s as a standalone text color',
      (color) => {
        expect(createExpander()(color)).toBe(`color:normalized(color|${color}|color);`)
      },
    )
    it('detects standalone gradient calls case-insensitively through function parsing', () => {
      expect(createExpander()('Gradient(red, blue)')).toContain(
        'background-image:normalized(background-image|Gradient(red, blue));',
      )
    })
    it.each([
      ['align:definitely-invalid', 'text-align'],
      ['transform:definitely-invalid', 'text-transform'],
      ['wrap:definitely-invalid', 'text-wrap'],
      ['decoration:definitely-invalid', 'text-decoration-line'],
    ])('rejects invalid typed enum %s', (input, property) => {
      expect(createExpander()(input)).not.toContain(`${property}:`)
    })
    it('preserves duplicate standalone declarations so CSS cascade order remains explicit', () => {
      expect(createExpander()('red, blue')).toBe(
        'color:normalized(color|red|color);color:normalized(color|blue|color);',
      )
    })
    it('emits typed arguments in canonical property order rather than source order', () => {
      const result = createExpander()('weight:700, size:lg, align:center')
      expect(result.indexOf('font-size:')).toBeLessThan(result.indexOf('font-weight:'))
      expect(result.indexOf('font-weight:')).toBeLessThan(result.indexOf('text-align:'))
    })
  })
})
function createExpander(): (
  args: string,
) => string {
  return createTextExpander(
    createNormalizer(),
  )
}
function createNormalizer(
  prefix = 'normalized',
): ReturnType<typeof vi.fn> & ValueNormalizer {
  return vi.fn(
    (
      property: string,
      value: string,
      hint?: string,
    ) =>
      `${prefix}(${[
        property,
        value,
        hint,
      ]
        .filter(
          (part) =>
            part !== undefined,
        )
        .join('|')})`,
  ) as ReturnType<typeof vi.fn>
    & ValueNormalizer
}
