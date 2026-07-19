import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextExpander, ValueNormalizer } from './contracts'
import type { SmartNormalizationTools } from './smart-normalization'
const mocks = vi.hoisted(() => ({
  createDeclaration: vi.fn(
    (
      property: string,
      value: string,
    ) =>
      `${property}:${value};`,
  ),
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
import { createSmartDeclarationExpander } from './smart-functions'
describe('smart declaration expander', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createDeclaration.mockImplementation(
      (
        property: string,
        value: string,
      ) =>
        `${property}:${value};`,
    )
  })
  describe('unknown helpers', () => {
    it('returns an empty string for an unsupported helper name', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'unknown',
          [
            'value',
          ],
        ),
      ).toBe('')
    })
    it('does not normalize values for unsupported helper names', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expand(
        'unknown',
        [
          'value',
        ],
      )
      expect(
        normalizeValue,
      ).not.toHaveBeenCalled()
      expect(
        mocks.createDeclaration,
      ).not.toHaveBeenCalled()
    })
  })
  describe('width and height helpers', () => {
    it.each([
      [
        'w',
        'width',
      ],
      [
        'h',
        'height',
      ],
    ])(
      'expands %s(value) into %s',
      (
        helper,
        property,
      ) => {
        const normalizeValue =
          createNormalizer()
        const expand =
          createExpander({
            normalizeValue,
          })
        expect(
          expand(
            helper,
            [
              '20',
            ],
          ),
        ).toBe(
          `${property}:normalized(${property}|20|spacing);`,
        )
        expect(
          normalizeValue,
        ).toHaveBeenCalledWith(
          property,
          '20',
          'spacing',
        )
      },
    )
    it('maps fill to 100%', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'w',
          [
            'fill',
          ],
        ),
      ).toBe(
        'width:normalized(width|100%|spacing);',
      )
    })
    it('maps contain to auto without calling the value normalizer', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expect(
        expand(
          'h',
          [
            'contain',
          ],
        ),
      ).toBe(
        'height:auto;',
      )
      expect(
        normalizeValue,
      ).not.toHaveBeenCalled()
    })
    it('supports min and max width arguments', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'w',
          [
            'min: 10',
            'max: 100',
          ],
        ),
      ).toBe([
        'min-width:normalized(min-width|10|spacing);',
        'max-width:normalized(max-width|100|spacing);',
      ].join(''))
    })
    it('supports min and max height arguments', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'h',
          [
            'min: 10',
            'max: 100',
          ],
        ),
      ).toBe([
        'min-height:normalized(min-height|10|spacing);',
        'max-height:normalized(max-height|100|spacing);',
      ].join(''))
    })
    it.each([
      'value',
      'w',
      'width',
    ])(
      'accepts %s as a named width value',
      (key) => {
        const expand =
          createExpander()
        expect(
          expand(
            'w',
            [
              `${key}: 50`,
            ],
          ),
        ).toBe(
          'width:normalized(width|50|spacing);',
        )
      },
    )
    it.each([
      'value',
      'h',
      'height',
    ])(
      'accepts %s as a named height value',
      (key) => {
        const expand =
          createExpander()
        expect(
          expand(
            'h',
            [
              `${key}: 50`,
            ],
          ),
        ).toBe(
          'height:normalized(height|50|spacing);',
        )
      },
    )
    it('emits the positional size before named min and max constraints', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'w',
          [
            '50',
            'min: 10',
            'max: 100',
          ],
        ),
      ).toBe([
        'width:normalized(width|50|spacing);',
        'min-width:normalized(min-width|10|spacing);',
        'max-width:normalized(max-width|100|spacing);',
      ].join(''))
    })
    it('ignores unknown named size arguments', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'w',
          [
            'unknown: 10',
          ],
        ),
      ).toBe('')
    })
  })
  describe('position helper', () => {
    it('defaults to relative positioning', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'pos',
          [],
        ),
      ).toBe(
        'position:relative;',
      )
    })
    it('uses the first positional argument as position', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'pos',
          [
            'absolute',
          ],
        ),
      ).toBe(
        'position:absolute;',
      )
    })
    it('falls back to relative when the first argument is named', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'pos',
          [
            'top: 10',
          ],
        ),
      ).toBe([
        'position:relative;',
        'top:normalized(top|10|spacing);',
      ].join(''))
    })
    it('expands named inset properties with spacing normalization', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'pos',
          [
            'absolute',
            'top: 1',
            'right: 2',
            'bottom: 3',
            'left: 4',
          ],
        ),
      ).toBe([
        'position:absolute;',
        'top:normalized(top|1|spacing);',
        'right:normalized(right|2|spacing);',
        'bottom:normalized(bottom|3|spacing);',
        'left:normalized(left|4|spacing);',
      ].join(''))
    })
    it('maps x and y to logical inset properties', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'pos',
          [
            'fixed',
            'x: 4',
            'y: 8',
          ],
        ),
      ).toBe([
        'position:fixed;',
        'inset-inline:normalized(inset-inline|4|spacing);',
        'inset-block:normalized(inset-block|8|spacing);',
      ].join(''))
    })
    it.each([
      'top',
      'right',
      'bottom',
      'left',
    ])(
      'expands positional edge token %s to zero',
      (edge) => {
        const expand =
          createExpander()
        expect(
          expand(
            'pos',
            [
              'absolute',
              edge,
            ],
          ),
        ).toBe(
          `position:absolute;${edge}:0;`,
        )
      },
    )
  })
  describe('grid helpers', () => {
    it('expands grid template columns', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-template',
          [
            'cols: repeat(3, 1fr)',
          ],
        ),
      ).toBe(
        'grid-template-columns:normalized(grid-template-columns|repeat(3, 1fr));',
      )
    })
    it('accepts columns as an alias for cols', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-template',
          [
            'columns: 1fr 2fr',
          ],
        ),
      ).toBe(
        'grid-template-columns:normalized(grid-template-columns|1fr 2fr);',
      )
    })
    it('expands grid template rows', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-template',
          [
            'rows: auto 1fr auto',
          ],
        ),
      ).toBe(
        'grid-template-rows:normalized(grid-template-rows|auto 1fr auto);',
      )
    })
    it('emits grid template areas without value normalization', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expect(
        expand(
          'grid-template',
          [
            'areas: "header header" "side main"',
          ],
        ),
      ).toBe(
        'grid-template-areas:"header header" "side main";',
      )
      expect(
        normalizeValue,
      ).not.toHaveBeenCalled()
    })
    it('preserves nested commas in grid template values', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-template',
          [
            'cols: repeat(3, minmax(0, 1fr))',
            'rows: auto 1fr',
          ],
        ),
      ).toBe([
        'grid-template-columns:normalized(grid-template-columns|repeat(3, minmax(0, 1fr)));',
        'grid-template-rows:normalized(grid-template-rows|auto 1fr);',
      ].join(''))
    })
    it('defaults grid-flow to row', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-flow',
          [],
        ),
      ).toBe(
        'grid-auto-flow:normalized(grid-auto-flow|row);',
      )
    })
    it('normalizes an explicit grid-flow value', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-flow',
          [
            'dense',
          ],
        ),
      ).toBe(
        'grid-auto-flow:normalized(grid-auto-flow|dense);',
      )
    })
  })
  describe('text helper delegation', () => {
    it('delegates raw joined arguments to the text expander', () => {
      const expandText =
        vi.fn<TextExpander>(
          (raw) =>
            `text(${raw})`,
        )
      const expand =
        createExpander({
          expandText,
        })
      expect(
        expand(
          'text',
          [
            'size: sm',
            'weight: 700',
          ],
        ),
      ).toBe(
        'text(size: sm,weight: 700)',
      )
      expect(
        expandText,
      ).toHaveBeenCalledWith(
        'size: sm,weight: 700',
      )
    })
  })
  describe('break helper', () => {
    it.each([
      [
        '',
        'overflow-wrap:break-word;',
      ],
      [
        'word',
        'overflow-wrap:break-word;',
      ],
      [
        'words',
        'overflow-wrap:break-word;',
      ],
      [
        'anywhere',
        'overflow-wrap:anywhere;',
      ],
      [
        'all',
        'word-break:break-all;',
      ],
      [
        'keep',
        'word-break:keep-all;',
      ],
      [
        'normal',
        'word-break:normal;',
      ],
    ])(
      'expands break(%j)',
      (
        value,
        expected,
      ) => {
        const expand =
          createExpander()
        expect(
          expand(
            'break',
            value
              ? [
                  value,
                ]
              : [],
          ),
        ).toBe(expected)
      },
    )
  })
  describe('stack helper', () => {
    it('uses column direction and gap 4 by default', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'stack',
          [],
        ),
      ).toBe([
        'display:flex;',
        'flex-direction:column;',
        'gap:normalized(gap|4|spacing);',
      ].join(''))
    })
    it('supports named direction and gap', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'stack',
          [
            'direction: row',
            'gap: 8',
          ],
        ),
      ).toBe([
        'display:flex;',
        'flex-direction:row;',
        'gap:normalized(gap|8|spacing);',
      ].join(''))
    })
    it('accepts space as an alias for gap', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'stack',
          [
            'space: 6',
          ],
        ),
      ).toBe([
        'display:flex;',
        'flex-direction:column;',
        'gap:normalized(gap|6|spacing);',
      ].join(''))
    })
    it('prefers gap over space when both are provided', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'stack',
          [
            'space: 4',
            'gap: 8',
          ],
        ),
      ).toContain(
        'gap:normalized(gap|8|spacing);',
      )
    })
  })
  describe('cluster helper', () => {
    it('uses ergonomic flex defaults', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'cluster',
          [],
        ),
      ).toBe([
        'display:flex;',
        'flex-wrap:wrap;',
        'align-items:center;',
        'justify-content:flex-start;',
        'gap:normalized(gap|3|spacing);',
      ].join(''))
    })
    it('supports named cluster options', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'cluster',
          [
            'wrap: nowrap',
            'align: flex-end',
            'justify: space-between',
            'gap: 8',
          ],
        ),
      ).toBe([
        'display:flex;',
        'flex-wrap:nowrap;',
        'align-items:flex-end;',
        'justify-content:space-between;',
        'gap:normalized(gap|8|spacing);',
      ].join(''))
    })
    it('accepts items as an alias for align', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'cluster',
          [
            'items: baseline',
          ],
        ),
      ).toContain(
        'align-items:baseline;',
      )
    })
    it('prefers align over items', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'cluster',
          [
            'items: baseline',
            'align: stretch',
          ],
        ),
      ).toContain(
        'align-items:stretch;',
      )
    })
  })
  describe('center helper', () => {
    it('always emits content-box sizing and auto inline margins', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'center',
          [],
        ),
      ).toBe([
        'box-sizing:content-box;',
        'margin-inline:auto;',
      ].join(''))
    })
    it('supports max width and inline padding', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'center',
          [
            'max: 70rem',
            'px: 4',
          ],
        ),
      ).toBe([
        'box-sizing:content-box;',
        'margin-inline:auto;',
        'max-width:normalized(max-width|70rem|spacing);',
        'padding-inline:normalized(padding-inline|4|spacing);',
      ].join(''))
    })
    it.each([
      'true',
      'center',
    ])(
      'centers text when text is %j',
      (value) => {
        const expand =
          createExpander()
        expect(
          expand(
            'center',
            [
              `text: ${value}`,
            ],
          ),
        ).toContain(
          'text-align:center;',
        )
      },
    )
    it('does not center text for arbitrary text values', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'center',
          [
            'text: false',
          ],
        ),
      ).not.toContain(
        'text-align',
      )
    })
  })
  describe('cover helper', () => {
    it('emits the default three-row cover layout', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'cover',
          [],
        ),
      ).toBe([
        'display:grid;',
        'grid-template-rows:auto 1fr auto;',
        'min-block-size:100dvh;',
      ].join(''))
    })
    it('supports custom header, main, footer and minimum block size values', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'cover',
          [
            'header: min-content',
            'main: 2fr',
            'footer: max-content',
            'min: 80dvh',
          ],
        ),
      ).toBe([
        'display:grid;',
        'grid-template-rows:min-content 2fr max-content;',
        'min-block-size:80dvh;',
      ].join(''))
    })
  })
  describe('sidebar helper', () => {
    it('creates a left sidebar by default', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'sidebar',
          [],
        ),
      ).toBe([
        'display:grid;',
        'grid-template-columns:normalized(width|280px|spacing) minmax(0,1fr);',
        'gap:normalized(gap|4|spacing);',
      ].join(''))
    })
    it('supports a custom sidebar width and gap', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'sidebar',
          [
            'width: 20rem',
            'gap: 8',
          ],
        ),
      ).toBe([
        'display:grid;',
        'grid-template-columns:normalized(width|20rem|spacing) minmax(0,1fr);',
        'gap:normalized(gap|8|spacing);',
      ].join(''))
    })
    it('accepts w as a width alias', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'sidebar',
          [
            'w: 15rem',
          ],
        ),
      ).toContain(
        'grid-template-columns:normalized(width|15rem|spacing) minmax(0,1fr);',
      )
    })
    it('places the sidebar column on the right when requested', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'sidebar',
          [
            'side: right',
            'width: 20rem',
          ],
        ),
      ).toContain(
        'grid-template-columns:minmax(0,1fr) normalized(width|20rem|spacing);',
      )
    })
    it('normalizes sidebar width exactly once', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expand(
        'sidebar',
        [
          'width: 20rem',
          'gap: 8',
        ],
      )
      expect(
        normalizeValue.mock.calls,
      ).toEqual([
        [
          'width',
          '20rem',
          'spacing',
        ],
        [
          'gap',
          '8',
          'spacing',
        ],
      ])
    })
  })
  describe('scroll helpers', () => {
    it('defaults scroll behavior to smooth', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'scroll',
          [],
        ),
      ).toBe(
        'scroll-behavior:smooth;',
      )
    })
    it('emits webkit momentum scrolling for touch', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'scroll',
          [
            'touch',
          ],
        ),
      ).toBe(
        '-webkit-overflow-scrolling:touch;',
      )
    })
    it('uses explicit scroll behavior keywords directly', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'scroll',
          [
            'auto',
          ],
        ),
      ).toBe(
        'scroll-behavior:auto;',
      )
    })
    it('defaults scrollbar width to thin', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'scrollbar',
          [],
        ),
      ).toBe(
        'scrollbar-width:thin;',
      )
    })
    it('uses an explicit scrollbar width', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'scrollbar',
          [
            'none',
          ],
        ),
      ).toBe(
        'scrollbar-width:none;',
      )
    })
  })
  describe('scroll snap helpers', () => {
    it('defaults snap to x mandatory', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'snap',
          [],
        ),
      ).toBe(
        'scroll-snap-type:x mandatory;',
      )
    })
    it('supports explicit axis and strictness', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'snap',
          [
            'y',
            'proximity',
          ],
        ),
      ).toBe(
        'scroll-snap-type:y proximity;',
      )
    })
    it('defaults snap-item alignment to start', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'snap-item',
          [],
        ),
      ).toBe(
        'scroll-snap-align:start;',
      )
    })
    it('supports explicit snap-item alignment', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'snap-item',
          [
            'center',
          ],
        ),
      ).toBe(
        'scroll-snap-align:center;',
      )
    })
  })
  describe('overscroll helper', () => {
    it('defaults overscroll behavior to auto', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'overscroll',
          [],
        ),
      ).toBe(
        'overscroll-behavior:auto;',
      )
    })
    it('strips matching outer quotes from keyword values', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'overscroll',
          [
            '"contain"',
          ],
        ),
      ).toBe(
        'overscroll-behavior:contain;',
      )
    })
  })
  describe('tap helper', () => {
    it('defaults touch-action to manipulation', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'tap',
          [],
        ),
      ).toBe(
        'touch-action:manipulation;',
      )
    })
    it.each([
      'none',
      'pan-x',
      'pan-y',
      'auto',
      'manipulation',
    ])(
      'accepts supported touch-action value %j',
      (value) => {
        const expand =
          createExpander()
        expect(
          expand(
            'tap',
            [
              value,
            ],
          ),
        ).toBe(
          `touch-action:${value};`,
        )
      },
    )
    it('preserves pinch-zoom as a valid touch-action value', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'tap',
          [
            'pinch-zoom',
          ],
        ),
      ).toBe(
        'touch-action:pinch-zoom;',
      )
    })
  })
  describe('select helper', () => {
    it('defaults user-select to auto', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'select',
          [],
        ),
      ).toBe(
        'user-select:auto;',
      )
    })
    it('uses explicit values directly', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'select',
          [
            'none',
          ],
        ),
      ).toBe(
        'user-select:none;',
      )
    })
  })
  describe('drag helper', () => {
    it('defaults to disabling native drag and text selection', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'drag',
          [],
        ),
      ).toBe([
        '-webkit-user-drag:none;',
        'user-select:none;',
      ].join(''))
    })
    it('disables native drag and selection explicitly for none', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'drag',
          [
            'none',
          ],
        ),
      ).toBe([
        '-webkit-user-drag:none;',
        'user-select:none;',
      ].join(''))
    })
    it('emits only webkit-user-drag for non-none values', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'drag',
          [
            'element',
          ],
        ),
      ).toBe(
        '-webkit-user-drag:element;',
      )
    })
  })
  describe('focus-ring helper', () => {
    it('uses the brand token by default', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expect(
        expand(
          'focus-ring',
          [],
        ),
      ).toBe([
        'outline:2px solid normalized(outline-color|$brand|color);',
        'outline-offset:2px;',
      ].join(''))
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'outline-color',
        '$brand',
        'color',
      )
    })
    it('normalizes a custom focus ring color', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'focus-ring',
          [
            '#ff0000',
          ],
        ),
      ).toBe([
        'outline:2px solid normalized(outline-color|#ff0000|color);',
        'outline-offset:2px;',
      ].join(''))
    })
  })
  describe('transition and animation delegation', () => {
    it('delegates transition normalization to SmartNormalizationTools', () => {
      const normalizeTransitionValue =
        vi.fn(
          (
            value: string,
          ) =>
            `transition-normalized(${value})`,
        )
      const expand =
        createExpander({
          normalization: {
            normalizeTransitionValue,
            normalizeAnimationValue:
              vi.fn(
                (value: string) =>
                  value,
              ),
          },
        })
      expect(
        expand(
          'transition',
          [
            'opacity',
            '200ms',
            'ease',
          ],
        ),
      ).toBe(
        'transition:transition-normalized(opacity,200ms,ease);',
      )
      expect(
        normalizeTransitionValue,
      ).toHaveBeenCalledWith(
        'opacity,200ms,ease',
      )
    })
    it('delegates animation normalization to SmartNormalizationTools', () => {
      const normalizeAnimationValue =
        vi.fn(
          (
            value: string,
          ) =>
            `animation-normalized(${value})`,
        )
      const expand =
        createExpander({
          normalization: {
            normalizeTransitionValue:
              vi.fn(
                (value: string) =>
                  value,
              ),
            normalizeAnimationValue,
          },
        })
      expect(
        expand(
          'animate',
          [
            'fade',
            '200ms',
            'ease',
          ],
        ),
      ).toBe(
        'animation:animation-normalized(fade,200ms,ease);',
      )
      expect(
        normalizeAnimationValue,
      ).toHaveBeenCalledWith(
        'fade,200ms,ease',
      )
    })
  })
  describe('raw argument joining', () => {
    it('joins incoming argument items with commas before helper-specific parsing', () => {
      const normalizeTransitionValue =
        vi.fn(
          (
            value: string,
          ) =>
            value,
        )
      const expand =
        createExpander({
          normalization: {
            normalizeTransitionValue,
            normalizeAnimationValue:
              vi.fn(
                (value: string) =>
                  value,
              ),
          },
        })
      expand(
        'transition',
        [
          'opacity',
          'transform',
        ],
      )
      expect(
        normalizeTransitionValue,
      ).toHaveBeenCalledWith(
        'opacity,transform',
      )
    })
    it('preserves nested commas already contained inside individual arguments', () => {
      const expand =
        createExpander()
      expect(
        expand(
          'grid-template',
          [
            'cols: repeat(3, minmax(0, 1fr))',
          ],
        ),
      ).toBe(
        'grid-template-columns:normalized(grid-template-columns|repeat(3, minmax(0, 1fr)));',
      )
    })
  })
  describe('createDeclaration integration', () => {
    it('routes generated declarations through createDeclaration', () => {
      const expand =
        createExpander()
      expand(
        'cluster',
        [],
      )
      expect(
        mocks.createDeclaration.mock.calls,
      ).toEqual([
        [
          'display',
          'flex',
        ],
        [
          'flex-wrap',
          'wrap',
        ],
        [
          'align-items',
          'center',
        ],
        [
          'justify-content',
          'flex-start',
        ],
        [
          'gap',
          'normalized(gap|3|spacing)',
        ],
      ])
    })
  })
  describe('normalizer integration', () => {
    it('uses spacing hints for spatial layout values', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expand(
        'center',
        [
          'max: 60rem',
          'px: 4',
        ],
      )
      expect(
        normalizeValue.mock.calls,
      ).toEqual([
        [
          'max-width',
          '60rem',
          'spacing',
        ],
        [
          'padding-inline',
          '4',
          'spacing',
        ],
      ])
    })
    it('does not normalize direct keyword-only declarations', () => {
      const normalizeValue =
        createNormalizer()
      const expand =
        createExpander({
          normalizeValue,
        })
      expand(
        'drag',
        [
          'none',
        ],
      )
      expand(
        'select',
        [
          'none',
        ],
      )
      expand(
        'scroll',
        [
          'smooth',
        ],
      )
      expect(
        normalizeValue,
      ).not.toHaveBeenCalled()
    })
    it('keeps dependencies bound to each expander instance', () => {
      const firstNormalizer =
        createNormalizer(
          'first',
        )
      const secondNormalizer =
        createNormalizer(
          'second',
        )
      const first =
        createExpander({
          normalizeValue:
            firstNormalizer,
        })
      const second =
        createExpander({
          normalizeValue:
            secondNormalizer,
        })
      expect(
        first(
          'w',
          [
            '10',
          ],
        ),
      ).toBe(
        'width:first(width|10|spacing);',
      )
      expect(
        second(
          'w',
          [
            '10',
          ],
        ),
      ).toBe(
        'width:second(width|10|spacing);',
      )
    })
  })
  describe('determinism', () => {
    it('produces identical output for identical input and dependencies', () => {
      const expand =
        createExpander()
      const args = [
        'wrap: nowrap',
        'align: center',
        'justify: space-between',
        'gap: 4',
      ]
      const first =
        expand(
          'cluster',
          args,
        )
      const second =
        expand(
          'cluster',
          args,
        )
      expect(second).toBe(first)
    })
    it('does not mutate the argument array', () => {
      const expand =
        createExpander()
      const args = [
        'min: 10',
        'max: 100',
      ]
      const snapshot = [
        ...args,
      ]
      expand(
        'w',
        args,
      )
      expect(args).toEqual(
        snapshot,
      )
    })
  })
  describe('regression contracts', () => {
    it('supports positional convenience arguments for layout helpers', () => {
      const expand = createExpander()
      expect(expand('stack', ['2rem'])).toContain('gap:normalized(gap|2rem|spacing);')
      expect(expand('cluster', ['1rem'])).toContain('gap:normalized(gap|1rem|spacing);')
      expect(expand('center', ['60rem'])).toContain('max-width:normalized(max-width|60rem|spacing);')
      expect(expand('cover', ['100dvh'])).toContain('min-block-size:100dvh;')
      expect(expand('sidebar', ['20rem', '2rem'])).toContain('grid-template-columns:normalized(width|20rem|spacing) minmax(0,1fr);')
    })
    it('ignores unsafe or unsupported named position properties', () => {
      const expand = createExpander()
      const result = expand('pos', ['fixed', 'color:red', 'top:0'])
      expect(result).toContain('position:fixed;')
      expect(result).toContain('top:normalized(top|0|spacing);')
      expect(result).not.toContain('color:')
    })
    it('supports pinch-zoom as a valid tap touch-action value', () => {
      expect(createExpander()('tap', ['pinch-zoom'])).toBe('touch-action:pinch-zoom;')
    })
    it('preserves quoted grid-template areas syntax without generic value normalization', () => {
      const normalizeValue = createNormalizer()
      const result = createExpander({ normalizeValue })(
        'grid-template',
        ['areas:"header header" "main aside"'],
      )
      expect(result).toContain('grid-template-areas:"header header" "main aside";')
      expect(normalizeValue).not.toHaveBeenCalledWith(
        'grid-template-areas',
        expect.anything(),
        expect.anything(),
      )
    })
    it('emits positional size declarations before named min/max constraints in canonical order', () => {
      const result = createExpander()('w', ['20rem', 'min:10rem', 'max:30rem'])
      expect(result.indexOf('width:')).toBeLessThan(result.indexOf('min-width:'))
      expect(result.indexOf('min-width:')).toBeLessThan(result.indexOf('max-width:'))
    })
    it.each([
      ['select', 'user-select:auto;'],
      ['scroll', 'scroll-behavior:smooth;'],
      ['overscroll', 'overscroll-behavior:auto;'],
      ['scrollbar', 'scrollbar-width:thin;'],
      ['snap', 'scroll-snap-type:x mandatory;'],
    ])('falls back safely for invalid %s keyword values', (helper, expected) => {
      const result = createExpander()(helper, ['definitely-invalid'])
      expect(result).toBe(expected)
      expect(result).not.toContain('definitely-invalid')
    })
  })
})
interface CreateExpanderOptions {
  readonly normalizeValue?: ValueNormalizer
  readonly expandText?: TextExpander
  readonly normalization?: Pick<
    SmartNormalizationTools,
    | 'normalizeTransitionValue'
    | 'normalizeAnimationValue'
  >
}
function createExpander(
  options: CreateExpanderOptions = {},
): (
  name: string,
  args: readonly string[],
) => string {
  const normalizeValue =
    options.normalizeValue
    ?? createNormalizer()
  const expandText =
    options.expandText
    ?? (
      (
        raw: string,
      ) =>
        `text(${raw})`
    )
  const normalization =
    options.normalization
    ?? {
      normalizeTransitionValue(
        value: string,
      ) {
        return `transition-normalized(${value})`
      },
      normalizeAnimationValue(
        value: string,
      ) {
        return `animation-normalized(${value})`
      },
    }
  return createSmartDeclarationExpander(
    normalizeValue,
    expandText,
    normalization,
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
