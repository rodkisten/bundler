import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CipoBlockNode } from '../../types'
const mocks = vi.hoisted(() => ({
  isStylesheetAtRuleName: vi.fn(
    (name: string) =>
      [
        '@media',
        '@supports',
        '@container',
        '@layer',
        '@scope',
        '@starting-style',
        '@font-face',
        '@property',
        '@page',
        '@keyframes',
        '@-webkit-keyframes',
      ].some(
        (atRule) =>
          name === atRule
          || name.startsWith(`${atRule} `)
          || name.startsWith(`${atRule}(`),
      ),
  ),
}))
vi.mock('../at-rule-kinds', () => ({
  isStylesheetAtRuleName:
    mocks.isStylesheetAtRuleName,
}))
import {
  appendPseudoToSelectors,
  copyStrings,
  hasTopLevelLooseStatements,
  isStylesheetRootBlock,
  joinSelectors,
  prefixSelectors,
  resolveNestedSelectors,
  splitRuntimeContextParts,
  splitSelectorList,
} from './selectors'
describe('stylesheet selector utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  describe('hasTopLevelLooseStatements', () => {
    it('returns false for an empty stylesheet', () => {
      expect(
        hasTopLevelLooseStatements(''),
      ).toBe(false)
    })
    it('returns false for whitespace-only input', () => {
      expect(
        hasTopLevelLooseStatements(
          '   \n\t ',
        ),
      ).toBe(false)
    })
    it('returns true for a top-level declaration', () => {
      expect(
        hasTopLevelLooseStatements(
          'color: red;',
        ),
      ).toBe(true)
    })
    it('returns true for multiple top-level declarations', () => {
      expect(
        hasTopLevelLooseStatements(
          'color:red;display:block;',
        ),
      ).toBe(true)
    })
    it('returns true for unterminated top-level text', () => {
      expect(
        hasTopLevelLooseStatements(
          'color: red',
        ),
      ).toBe(true)
    })
    it('returns false when the input contains only selector blocks', () => {
      expect(
        hasTopLevelLooseStatements(
          '.button{color:red;}',
        ),
      ).toBe(false)
    })
    it('returns false when the input contains multiple top-level blocks', () => {
      expect(
        hasTopLevelLooseStatements(
          [
            '.button{color:red;}',
            '.card{display:block;}',
          ].join('\n'),
        ),
      ).toBe(false)
    })
    it('returns false for nested stylesheet blocks', () => {
      expect(
        hasTopLevelLooseStatements(
          '@media print{.button{color:red;}}',
        ),
      ).toBe(false)
    })
    it('detects loose declarations before a top-level block', () => {
      expect(
        hasTopLevelLooseStatements(
          'color:red;.button{display:block;}',
        ),
      ).toBe(true)
    })
    it('detects loose declarations after a top-level block', () => {
      expect(
        hasTopLevelLooseStatements(
          '.button{display:block;}color:red;',
        ),
      ).toBe(true)
    })
    it('ignores semicolons inside double-quoted strings within blocks', () => {
      expect(
        hasTopLevelLooseStatements(
          '.label{content:"first;second";}',
        ),
      ).toBe(false)
    })
    it('ignores semicolons inside single-quoted strings within blocks', () => {
      expect(
        hasTopLevelLooseStatements(
          ".label{content:'first;second';}",
        ),
      ).toBe(false)
    })
    it('does not treat braces inside quoted block values as structural braces', () => {
      expect(
        hasTopLevelLooseStatements(
          '.label{content:"{hello}";}',
        ),
      ).toBe(false)
    })
    it('preserves escaped quotes while scanning block contents', () => {
      expect(
        hasTopLevelLooseStatements(
          String.raw`.label{content:"say \"hello; world\"";}`,
        ),
      ).toBe(false)
    })
    it('detects trailing loose text after a completed block even without a semicolon', () => {
      expect(
        hasTopLevelLooseStatements(
          '.button{color:red;}display:block',
        ),
      ).toBe(true)
    })
    it('does not let declarations nested several levels deep count as top-level statements', () => {
      expect(
        hasTopLevelLooseStatements(
          [
            '@layer components{',
            '  @media print{',
            '    .button{color:red;}',
            '  }',
            '}',
          ].join(''),
        ),
      ).toBe(false)
    })
  })
  describe('isStylesheetRootBlock', () => {
    it('rejects an empty block name', () => {
      expect(
        isStylesheetRootBlock(
          block(
            '',
          ),
        ),
      ).toBe(false)
    })
    it('trims surrounding whitespace before classification', () => {
      expect(
        isStylesheetRootBlock(
          block(
            '   .button   ',
          ),
        ),
      ).toBe(true)
    })
    it.each([
      'x:md',
      'x:dark',
      'x:hover',
      'x:not(md)',
    ])(
      'rejects runtime context block %j at stylesheet root',
      (name) => {
        expect(
          isStylesheetRootBlock(
            block(name),
          ),
        ).toBe(false)
      },
    )
    it.each([
      '&:hover',
      '& .child',
      '&[data-open]',
    ])(
      'rejects nested selector %j at stylesheet root',
      (name) => {
        expect(
          isStylesheetRootBlock(
            block(name),
          ),
        ).toBe(false)
      },
    )
    it.each([
      '@media print',
      '@supports (display: grid)',
      '@container sidebar',
      '@layer components',
      '@scope (.app)',
      '@font-face',
      '@property --brand',
      '@page',
      '@keyframes fade',
    ])(
      'accepts stylesheet at-rule %j at root',
      (name) => {
        expect(
          isStylesheetRootBlock(
            block(name),
          ),
        ).toBe(true)
        expect(
          mocks.isStylesheetAtRuleName,
        ).toHaveBeenCalledWith(name)
      },
    )
    it.each([
      '.button',
      '#application',
      ':root',
      ':where(.app)',
      '[data-theme="dark"]',
      '*',
      'button',
      'my-element',
    ])(
      'accepts root selector %j',
      (name) => {
        expect(
          isStylesheetRootBlock(
            block(name),
          ),
        ).toBe(true)
      },
    )
    it.each([
      '.button, .link',
      '.parent > .child',
      '.first + .second',
      '.first ~ .second',
      '.parent .child',
    ])(
      'accepts compound or selector-list root %j',
      (name) => {
        expect(
          isStylesheetRootBlock(
            block(name),
          ),
        ).toBe(true)
      },
    )
    it.each([
      '123invalid',
      '-invalid',
      '_invalid',
      '@unknown',
    ])(
      'rejects unsupported root block %j',
      (name) => {
        expect(
          isStylesheetRootBlock(
            block(name),
          ),
        ).toBe(false)
      },
    )
  })
  describe('resolveNestedSelectors', () => {
    it('returns the child selector collection unchanged when there are no parents', () => {
      const children = [
        '.button',
        '.link',
      ] as const
      const result =
        resolveNestedSelectors(
          [],
          children,
        )
      expect(result).toBe(children)
    })
    it('resolves an ampersand selector against its parent', () => {
      expect(
        resolveNestedSelectors(
          [
            '.button',
          ],
          [
            '&:hover',
          ],
        ),
      ).toEqual([
        '.button:hover',
      ])
    })
    it('resolves descendant selectors without an ampersand', () => {
      expect(
        resolveNestedSelectors(
          [
            '.card',
          ],
          [
            '.title',
          ],
        ),
      ).toEqual([
        '.card .title',
      ])
    })
    it('replaces every ampersand occurrence with the parent selector', () => {
      expect(
        resolveNestedSelectors(
          [
            '.parent',
          ],
          [
            '& + &',
          ],
        ),
      ).toEqual([
        '.parent + .parent',
      ])
    })
    it('produces the cartesian product of parent and child selectors', () => {
      expect(
        resolveNestedSelectors(
          [
            '.button',
            '.link',
          ],
          [
            '&:hover',
            '&:focus',
          ],
        ),
      ).toEqual([
        '.button:hover',
        '.button:focus',
        '.link:hover',
        '.link:focus',
      ])
    })
    it('preserves parent-first then child-first deterministic ordering', () => {
      expect(
        resolveNestedSelectors(
          [
            '.p1',
            '.p2',
          ],
          [
            '.c1',
            '.c2',
            '.c3',
          ],
        ),
      ).toEqual([
        '.p1 .c1',
        '.p1 .c2',
        '.p1 .c3',
        '.p2 .c1',
        '.p2 .c2',
        '.p2 .c3',
      ])
    })
    it('does not mutate parent or child arrays', () => {
      const parents = [
        '.parent',
      ]
      const children = [
        '&:hover',
      ]
      const parentSnapshot = [
        ...parents,
      ]
      const childSnapshot = [
        ...children,
      ]
      resolveNestedSelectors(
        parents,
        children,
      )
      expect(parents).toEqual(
        parentSnapshot,
      )
      expect(children).toEqual(
        childSnapshot,
      )
    })
  })
  describe('splitSelectorList', () => {
    it('splits a simple selector list', () => {
      expect(
        splitSelectorList(
          '.button, .link, #app',
        ),
      ).toEqual([
        '.button',
        '.link',
        '#app',
      ])
    })
    it('trims each selector', () => {
      expect(
        splitSelectorList(
          '  .button  ,   .link ',
        ),
      ).toEqual([
        '.button',
        '.link',
      ])
    })
    it('ignores empty selector entries', () => {
      expect(
        splitSelectorList(
          ', .button, , .link, ',
        ),
      ).toEqual([
        '.button',
        '.link',
      ])
    })
    it('does not split commas inside :is()', () => {
      expect(
        splitSelectorList(
          '.item:is(.primary, .secondary), .other',
        ),
      ).toEqual([
        '.item:is(.primary, .secondary)',
        '.other',
      ])
    })
    it('does not split commas inside :where()', () => {
      expect(
        splitSelectorList(
          ':where(.a, .b, .c), .outside',
        ),
      ).toEqual([
        ':where(.a, .b, .c)',
        '.outside',
      ])
    })
    it('does not split commas inside :not()', () => {
      expect(
        splitSelectorList(
          '.item:not(.a, .b), .other',
        ),
      ).toEqual([
        '.item:not(.a, .b)',
        '.other',
      ])
    })
    it('does not split commas inside attribute selectors', () => {
      expect(
        splitSelectorList(
          '[data-value="a,b"], .other',
        ),
      ).toEqual([
        '[data-value="a,b"]',
        '.other',
      ])
    })
    it('does not split commas inside quoted attribute values', () => {
      expect(
        splitSelectorList(
          "[data-value='a,b,c'], .other",
        ),
      ).toEqual([
        "[data-value='a,b,c']",
        '.other',
      ])
    })
    it('handles nested selector functions and attribute selectors', () => {
      expect(
        splitSelectorList(
          '.item:is([data-value="a,b"], :not(.x, .y)), .other',
        ),
      ).toEqual([
        '.item:is([data-value="a,b"], :not(.x, .y))',
        '.other',
      ])
    })
    it('preserves escaped quotes inside quoted selector values', () => {
      expect(
        splitSelectorList(
          String.raw`[data-value="a\",b"], .other`,
        ),
      ).toEqual([
        String.raw`[data-value="a\",b"]`,
        '.other',
      ])
    })
    it('returns an empty array for empty input', () => {
      expect(
        splitSelectorList(''),
      ).toEqual([])
    })
    it('returns a single selector when no top-level comma exists', () => {
      expect(
        splitSelectorList(
          '.button:hover',
        ),
      ).toEqual([
        '.button:hover',
      ])
    })
  })
  describe('copyStrings', () => {
    it('copies all strings in source order', () => {
      expect(
        copyStrings([
          '.first',
          '.second',
          '.third',
        ]),
      ).toEqual([
        '.first',
        '.second',
        '.third',
      ])
    })
    it('returns a new mutable array', () => {
      const input = [
        '.first',
        '.second',
      ] as const
      const result =
        copyStrings(input)
      expect(result).not.toBe(input)
      result.push(
        '.third',
      )
      expect(result).toEqual([
        '.first',
        '.second',
        '.third',
      ])
      expect(input).toEqual([
        '.first',
        '.second',
      ])
    })
    it('returns an independent empty array for empty input', () => {
      const input: readonly string[] = []
      const result =
        copyStrings(input)
      expect(result).toEqual([])
      expect(result).not.toBe(input)
    })
  })
  describe('splitRuntimeContextParts', () => {
    it('splits colon-separated runtime context parts', () => {
      expect(
        splitRuntimeContextParts(
          'md:dark:hover',
        ),
      ).toEqual([
        'md',
        'dark',
        'hover',
      ])
    })
    it('trims context parts', () => {
      expect(
        splitRuntimeContextParts(
          ' md : dark : hover ',
        ),
      ).toEqual([
        'md',
        'dark',
        'hover',
      ])
    })
    it('ignores empty context parts', () => {
      expect(
        splitRuntimeContextParts(
          ':md::dark:',
        ),
      ).toEqual([
        'md',
        'dark',
      ])
    })
    it('returns one part when no separator exists', () => {
      expect(
        splitRuntimeContextParts(
          'dark',
        ),
      ).toEqual([
        'dark',
      ])
    })
    it('returns an empty array for empty input', () => {
      expect(
        splitRuntimeContextParts(''),
      ).toEqual([])
    })
    it('currently splits every colon regardless of parentheses', () => {
      expect(
        splitRuntimeContextParts(
          'cq(style(--theme: dark)):hover',
        ),
      ).toEqual([
        'cq(style(--theme',
        'dark))',
        'hover',
      ])
    })
  })
  describe('prefixSelectors', () => {
    it('prefixes every selector while preserving order', () => {
      expect(
        prefixSelectors(
          '.dark',
          [
            '.button',
            '.link',
          ],
        ),
      ).toEqual([
        '.dark .button',
        '.dark .link',
      ])
    })
    it('uses the prefix verbatim', () => {
      expect(
        prefixSelectors(
          '[data-theme="dark"]',
          [
            '.button',
          ],
        ),
      ).toEqual([
        '[data-theme="dark"] .button',
      ])
    })
    it('returns a new array without mutating selectors', () => {
      const selectors = [
        '.button',
      ]
      const result =
        prefixSelectors(
          '.dark',
          selectors,
        )
      expect(result).not.toBe(
        selectors,
      )
      expect(selectors).toEqual([
        '.button',
      ])
    })
    it('returns an empty array for no selectors', () => {
      expect(
        prefixSelectors(
          '.dark',
          [],
        ),
      ).toEqual([])
    })
  })
  describe('appendPseudoToSelectors', () => {
    it('appends a pseudo name to every selector', () => {
      expect(
        appendPseudoToSelectors(
          [
            '.button',
            '.link',
          ],
          'hover',
        ),
      ).toEqual([
        '.button:hover',
        '.link:hover',
      ])
    })
    it('preserves selector order', () => {
      expect(
        appendPseudoToSelectors(
          [
            '.first',
            '.second',
            '.third',
          ],
          'focus-visible',
        ),
      ).toEqual([
        '.first:focus-visible',
        '.second:focus-visible',
        '.third:focus-visible',
      ])
    })
    it('does not mutate the input selector array', () => {
      const selectors = [
        '.button',
      ]
      const result =
        appendPseudoToSelectors(
          selectors,
          'hover',
        )
      expect(result).not.toBe(
        selectors,
      )
      expect(selectors).toEqual([
        '.button',
      ])
    })
    it('returns an empty array for no selectors', () => {
      expect(
        appendPseudoToSelectors(
          [],
          'hover',
        ),
      ).toEqual([])
    })
  })
  describe('joinSelectors', () => {
    it('joins selectors using canonical comma-only separation', () => {
      expect(
        joinSelectors([
          '.button',
          '.link',
          '#app',
        ]),
      ).toBe(
        '.button,.link,#app',
      )
    })
    it('returns the only selector unchanged', () => {
      expect(
        joinSelectors([
          '.button',
        ]),
      ).toBe(
        '.button',
      )
    })
    it('returns an empty string for an empty selector list', () => {
      expect(
        joinSelectors([]),
      ).toBe('')
    })
    it('preserves exact selector text', () => {
      expect(
        joinSelectors([
          ':where(.a, .b)',
          '[data-value="a,b"]',
        ]),
      ).toBe(
        ':where(.a, .b),[data-value="a,b"]',
      )
    })
  })
  describe('selector pipeline integration', () => {
    it('splits root selector lists, resolves nested selectors and joins the cartesian result deterministically', () => {
      const parents =
        splitSelectorList(
          '.button, .link',
        )
      const children =
        splitSelectorList(
          '&:hover, &.active',
        )
      const resolved =
        resolveNestedSelectors(
          parents,
          children,
        )
      expect(
        joinSelectors(resolved),
      ).toBe(
        [
          '.button:hover',
          '.button.active',
          '.link:hover',
          '.link.active',
        ].join(','),
      )
    })
    it('can compose dark prefixing and pseudo appending without mutating the original selector list', () => {
      const selectors = [
        '.button',
        '.link',
      ]
      const prefixed =
        prefixSelectors(
          '.dark',
          selectors,
        )
      const contextual =
        appendPseudoToSelectors(
          prefixed,
          'hover',
        )
      expect(contextual).toEqual([
        '.dark .button:hover',
        '.dark .link:hover',
      ])
      expect(selectors).toEqual([
        '.button',
        '.link',
      ])
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'splitRuntimeContextParts preserves colons inside cq() and other parenthesized runtime context expressions',
    )
    it.todo(
      'hasTopLevelLooseStatements uses escape parity instead of checking only the immediately preceding backslash',
    )
    it.todo(
      'splitSelectorList uses escape parity instead of checking only the immediately preceding backslash',
    )
    it.todo(
      'hasTopLevelLooseStatements treats CSS comments as lexical content instead of interpreting braces and semicolons inside comments',
    )
    it.todo(
      'isStylesheetRootBlock validates complex root selectors structurally instead of accepting any name containing whitespace or combinator characters',
    )
  })
})
function block(
  name: string,
): CipoBlockNode {
  return {
    type: 'block',
    name,
    body: [],
  } as CipoBlockNode
}
