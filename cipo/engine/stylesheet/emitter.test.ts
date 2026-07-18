import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoAstNode,
  CipoBlockNode,
  CipoDeclarationNode,
} from '../../types'
const mocks = vi.hoisted(() => {
  const runtime = {
    config: {
      important: false,
      darkSelector: '.dark',
      breakpoints: {} as Record<string, string | null>,
    },
  }
  return {
    runtime,
    compilePropertyBlock: vi.fn(
      (
        name: string,
        declarations: readonly CipoDeclarationNode[],
      ) =>
        `property(${name}){${declarations
          .map(
            (declaration) =>
              `${declaration.property}:${declaration.value}`,
          )
          .join(';')}}`,
    ),
    addImportant: vi.fn(
      (value: string) =>
        value.includes('!important')
          ? value
          : `${value} !important`,
    ),
    applyConfiguredScopeToSelectors: vi.fn(
      (selectors: readonly string[]) =>
        selectors.map(
          (selector) =>
            `.configured ${selector}`,
        ),
    ),
    formatStylesheetText: vi.fn(
      (css: string) => css,
    ),
    isCipoPseudoName: vi.fn(
      (name: string) =>
        new Set([
          'hover',
          'focus',
          'focus-visible',
          'active',
          'disabled',
          'checked',
        ]).has(name),
    ),
    classifyAtRule: vi.fn(
      (name: string) => {
        const normalized =
          name.trim().toLowerCase()
        if (
          /^@(?:-webkit-)?keyframes\b/.test(
            normalized,
          )
        ) {
          return 'keyframes'
        }
        if (
          /^@(font-face|property)\b/.test(
            normalized,
          )
        ) {
          return 'declaration-block'
        }
        if (
          /^@page\b/.test(
            normalized,
          )
        ) {
          return 'page'
        }
        if (
          /^@(media|supports|container|layer|scope|starting-style)\b/.test(
            normalized,
          )
        ) {
          return 'conditional'
        }
        return 'unknown'
      },
    ),
    isStylesheetAtRuleName: vi.fn(
      (name: string) => {
        const normalized =
          name.trim().toLowerCase()
        return (
          /^@(?:-webkit-)?keyframes\b/.test(
            normalized,
          )
          || /^@(font-face|property|page)\b/.test(
            normalized,
          )
          || /^@(media|supports|container|layer|scope|starting-style)\b/.test(
            normalized,
          )
        )
      },
    ),
    copyStrings: vi.fn(
      (values: readonly string[]) => [
        ...values,
      ],
    ),
    joinSelectors: vi.fn(
      (selectors: readonly string[]) =>
        selectors.join(','),
    ),
    prefixSelectors: vi.fn(
      (
        prefix: string,
        selectors: readonly string[],
      ) =>
        selectors.map(
          (selector) =>
            `${prefix} ${selector}`,
        ),
    ),
    appendPseudoToSelectors: vi.fn(
      (
        selectors: readonly string[],
        pseudo: string,
      ) =>
        selectors.map(
          (selector) =>
            `${selector}:${pseudo}`,
        ),
    ),
    splitSelectorList: vi.fn(
      (value: string) =>
        value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
    ),
    resolveNestedSelectors: vi.fn(
      (
        parents: readonly string[],
        children: readonly string[],
      ) => {
        if (parents.length === 0) {
          return [...children]
        }
        const output: string[] = []
        for (const parent of parents) {
          for (const child of children) {
            output.push(
              child.includes('&')
                ? child.replace(
                    /&/g,
                    parent,
                  )
                : `${parent} ${child}`,
            )
          }
        }
        return output
      },
    ),
    splitRuntimeContextParts: vi.fn(
      (value: string) => {
        const output: string[] = []
        let buffer = ''
        let depth = 0
        for (
          let index = 0;
          index < value.length;
          index += 1
        ) {
          const char = value[index]!
          if (char === '(') {
            depth += 1
          } else if (char === ')') {
            depth = Math.max(
              0,
              depth - 1,
            )
          }
          if (
            char === ':'
            && depth === 0
          ) {
            if (buffer.trim()) {
              output.push(
                buffer.trim(),
              )
            }
            buffer = ''
            continue
          }
          buffer += char
        }
        if (buffer.trim()) {
          output.push(
            buffer.trim(),
          )
        }
        return output
      },
    ),
  }
})
vi.mock('../../properties', () => ({
  compilePropertyBlock:
    mocks.compilePropertyBlock,
}))
vi.mock('../../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../at-rule-kinds', () => ({
  classifyAtRule:
    mocks.classifyAtRule,
  isStylesheetAtRuleName:
    mocks.isStylesheetAtRuleName,
}))
vi.mock('../important', () => ({
  addImportant:
    mocks.addImportant,
}))
vi.mock('../pseudos', () => ({
  isCipoPseudoName:
    mocks.isCipoPseudoName,
}))
vi.mock('../selector', () => ({
  applyConfiguredScopeToSelectors:
    mocks.applyConfiguredScopeToSelectors,
}))
vi.mock('./format', () => ({
  formatStylesheetText:
    mocks.formatStylesheetText,
}))
vi.mock('./selectors', () => ({
  appendPseudoToSelectors:
    mocks.appendPseudoToSelectors,
  copyStrings:
    mocks.copyStrings,
  joinSelectors:
    mocks.joinSelectors,
  prefixSelectors:
    mocks.prefixSelectors,
  resolveNestedSelectors:
    mocks.resolveNestedSelectors,
  splitRuntimeContextParts:
    mocks.splitRuntimeContextParts,
  splitSelectorList:
    mocks.splitSelectorList,
}))
import { compileStylesheetText } from './compiler'
describe('full stylesheet compiler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config = {
      important: false,
      darkSelector: '.dark',
      breakpoints: {
        base: null,
        sm: '(min-width: 640px)',
        md: '(min-width: 768px)',
        lg: '(min-width: 1024px)',
      },
    }
    mocks.formatStylesheetText.mockImplementation(
      (css: string) => css,
    )
  })
  describe('top-level compilation', () => {
    it('compiles top-level declarations directly', () => {
      const ast = [
        declaration(
          'color',
          'red',
        ),
        declaration(
          'display',
          'block',
        ),
      ]
      expect(
        compileStylesheetText(ast),
      ).toBe(
        [
          'color:red;',
          'display:block;',
        ].join('\n'),
      )
    })
    it('ignores compiler directives in full stylesheet output', () => {
      const ast: CipoAstNode[] = [
        directive(
          'with',
          ['center'],
        ),
        declaration(
          'color',
          'red',
        ),
      ]
      expect(
        compileStylesheetText(ast),
      ).toBe(
        'color:red;',
      )
    })
    it('formats the fully assembled stylesheet exactly once', () => {
      mocks.formatStylesheetText.mockImplementation(
        (css: string) =>
          `formatted(${css})`,
      )
      const result =
        compileStylesheetText([
          declaration(
            'color',
            'red',
          ),
        ])
      expect(
        mocks.formatStylesheetText,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.formatStylesheetText,
      ).toHaveBeenCalledWith(
        'color:red;',
      )
      expect(result).toBe(
        'formatted(color:red;)',
      )
    })
    it('returns the formatter result for an empty stylesheet', () => {
      expect(
        compileStylesheetText([]),
      ).toBe('')
      expect(
        mocks.formatStylesheetText,
      ).toHaveBeenCalledWith(
        '',
      )
    })
  })
  describe('ordinary selector blocks', () => {
    it('compiles declarations under a configured scoped selector', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              declaration(
                'color',
                'red',
              ),
              declaration(
                'padding',
                '8px',
              ),
            ],
          ),
        ])
      expect(
        mocks.applyConfiguredScopeToSelectors,
      ).toHaveBeenCalledWith([
        '.button',
      ])
      expect(result).toBe(
        '.configured .button{color:red;padding:8px;}',
      )
    })
    it('supports selector lists', () => {
      const result =
        compileStylesheetText([
          block(
            '.button, .link',
            [
              declaration(
                'color',
                'red',
              ),
            ],
          ),
        ])
      expect(
        mocks.splitSelectorList,
      ).toHaveBeenCalledWith(
        '.button, .link',
      )
      expect(result).toBe(
        '.configured .button,.configured .link{color:red;}',
      )
    })
    it('resolves nested selectors against their parent selector', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                '&:hover',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(
        mocks.resolveNestedSelectors,
      ).toHaveBeenCalledWith(
        [
          '.button',
        ],
        [
          '&:hover',
        ],
      )
      expect(result).toBe(
        '.configured .button:hover{color:red;}',
      )
    })
    it('resolves descendant nested selectors without an ampersand', () => {
      const result =
        compileStylesheetText([
          block(
            '.card',
            [
              block(
                '.title',
                [
                  declaration(
                    'font-weight',
                    'bold',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '.configured .card .title{font-weight:bold;}',
      )
    })
    it('flushes declarations before compiling a nested block', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              declaration(
                'color',
                'red',
              ),
              block(
                '&:hover',
                [
                  declaration(
                    'color',
                    'blue',
                  ),
                ],
              ),
              declaration(
                'background',
                'black',
              ),
            ],
          ),
        ])
      expect(result).toBe(
        [
          '.configured .button{color:red;}',
          '.configured .button:hover{color:blue;}',
          '.configured .button{background:black;}',
        ].join('\n'),
      )
    })
    it('preserves declaration and nested-rule source order', () => {
      const result =
        compileStylesheetText([
          block(
            '.component',
            [
              declaration(
                'first',
                '1',
              ),
              block(
                '& .nested-one',
                [
                  declaration(
                    'nested',
                    '1',
                  ),
                ],
              ),
              declaration(
                'second',
                '2',
              ),
              block(
                '& .nested-two',
                [
                  declaration(
                    'nested',
                    '2',
                  ),
                ],
              ),
              declaration(
                'third',
                '3',
              ),
            ],
          ),
        ])
      expect(result).toBe(
        [
          '.configured .component{first:1;}',
          '.configured .component .nested-one{nested:1;}',
          '.configured .component{second:2;}',
          '.configured .component .nested-two{nested:2;}',
          '.configured .component{third:3;}',
        ].join('\n'),
      )
    })
    it('ignores directives nested inside ordinary selector blocks', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              declaration(
                'color',
                'red',
              ),
              directive(
                'with',
                ['center'],
              ),
              declaration(
                'display',
                'block',
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '.configured .button{color:red;display:block;}',
      )
    })
  })
  describe('important handling', () => {
    it('does not add important by default', () => {
      compileStylesheetText([
        declaration(
          'color',
          'red',
        ),
      ])
      expect(
        mocks.addImportant,
      ).not.toHaveBeenCalled()
    })
    it('applies runtime global important configuration', () => {
      mocks.runtime.config.important =
        true
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              declaration(
                'color',
                'red',
              ),
              declaration(
                'padding',
                '8px',
              ),
            ],
          ),
        ])
      expect(
        mocks.addImportant,
      ).toHaveBeenNthCalledWith(
        1,
        'red',
      )
      expect(
        mocks.addImportant,
      ).toHaveBeenNthCalledWith(
        2,
        '8px',
      )
      expect(result).toBe(
        '.configured .button{color:red !important;padding:8px !important;}',
      )
    })
    it('applies forceImportant independently of global runtime configuration', () => {
      mocks.runtime.config.important =
        false
      const result =
        compileStylesheetText(
          [
            declaration(
              'color',
              'red',
            ),
          ],
          true,
        )
      expect(
        mocks.addImportant,
      ).toHaveBeenCalledWith(
        'red',
      )
      expect(result).toBe(
        'color:red !important;',
      )
    })
    it('propagates forceImportant through deeply nested blocks', () => {
      const result =
        compileStylesheetText(
          [
            block(
              '.button',
              [
                block(
                  '&:hover',
                  [
                    block(
                      '& .icon',
                      [
                        declaration(
                          'color',
                          'red',
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ],
          true,
        )
      expect(result).toBe(
        '.configured .button:hover .icon{color:red !important;}',
      )
    })
  })
  describe('runtime wrappers', () => {
    it('compiles reduce-motion into a reduced-motion media wrapper', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'reduce-motion',
                [
                  declaration(
                    'animation',
                    'none',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (prefers-reduced-motion: reduce){.configured .button{animation:none;}}',
      )
    })
    it('compiles supports() runtime wrappers', () => {
      const result =
        compileStylesheetText([
          block(
            '.layout',
            [
              block(
                'supports(display: grid)',
                [
                  declaration(
                    'display',
                    'grid',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@supports display: grid{.configured .layout{display:grid;}}',
      )
    })
    it('compiles layer() runtime wrappers', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'layer(components)',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@layer components{.configured .button{color:red;}}',
      )
    })
    it('compiles container() runtime wrappers', () => {
      const result =
        compileStylesheetText([
          block(
            '.card',
            [
              block(
                'container(sidebar (width > 30rem))',
                [
                  declaration(
                    'display',
                    'grid',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@container sidebar (width > 30rem){.configured .card{display:grid;}}',
      )
    })
    it('omits an empty runtime wrapper', () => {
      expect(
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'reduce-motion',
                [
                  directive(
                    'ignored',
                    [],
                  ),
                ],
              ),
            ],
          ),
        ]),
      ).toBe('')
    })
  })
  describe('x: runtime contexts', () => {
    it('ignores x: runtime blocks at stylesheet root because they require a parent selector', () => {
      expect(
        compileStylesheetText([
          block(
            'x:dark',
            [
              declaration(
                'color',
                'white',
              ),
            ],
          ),
        ]),
      ).toBe('')
      expect(
        mocks.prefixSelectors,
      ).not.toHaveBeenCalled()
    })
    it('applies configured breakpoint wrappers inside selector blocks', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:md',
                [
                  declaration(
                    'padding',
                    '2rem',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (min-width: 768px){.configured .button{padding:2rem;}}',
      )
    })
    it('ignores breakpoint wrappers whose configured query is null', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:base',
                [
                  declaration(
                    'padding',
                    '1rem',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '.configured .button{padding:1rem;}',
      )
    })
    it('compiles x:not() into a negated media wrapper', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:not(md)',
                [
                  declaration(
                    'display',
                    'none',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media not all and (min-width: 768px){.configured .button{display:none;}}',
      )
    })
    it('emits no wrapper for x:not() when the breakpoint has no query', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:not(base)',
                [
                  declaration(
                    'display',
                    'block',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '.configured .button{display:block;}',
      )
    })
    it('prefixes selectors for dark mode', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:dark',
                [
                  declaration(
                    'color',
                    'white',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(
        mocks.prefixSelectors,
      ).toHaveBeenCalledWith(
        '.dark',
        [
          '.button',
        ],
      )
      expect(result).toBe(
        '.configured .dark .button{color:white;}',
      )
    })
    it('uses the configured dark selector', () => {
      mocks.runtime.config.darkSelector =
        '[data-theme="dark"]'
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:dark',
                [
                  declaration(
                    'color',
                    'white',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(
        mocks.prefixSelectors,
      ).toHaveBeenCalledWith(
        '[data-theme="dark"]',
        [
          '.button',
        ],
      )
      expect(result).toBe(
        '.configured [data-theme="dark"] .button{color:white;}',
      )
    })
    it('appends pseudo contexts to selectors', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:hover',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(
        mocks.appendPseudoToSelectors,
      ).toHaveBeenCalledWith(
        [
          '.button',
        ],
        'hover',
      )
      expect(result).toBe(
        '.configured .button:hover{color:red;}',
      )
    })
    it('composes multiple pseudo contexts in source order', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:hover:focus',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '.configured .button:hover:focus{color:red;}',
      )
    })
    it('compiles motion-safe context', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:motion-safe',
                [
                  declaration(
                    'animation',
                    'fade 1s',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (prefers-reduced-motion: no-preference){.configured .button{animation:fade 1s;}}',
      )
    })
    it('compiles motion-reduce context', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:motion-reduce',
                [
                  declaration(
                    'animation',
                    'none',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (prefers-reduced-motion: reduce){.configured .button{animation:none;}}',
      )
    })
    it('compiles container query context', () => {
      const result =
        compileStylesheetText([
          block(
            '.card',
            [
              block(
                'x:cq(sidebar)',
                [
                  declaration(
                    'display',
                    'grid',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@container sidebar{.configured .card{display:grid;}}',
      )
    })
    it('composes selector and wrapper contexts from one x: expression', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:md:dark:hover',
                [
                  declaration(
                    'color',
                    'white',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (min-width: 768px){.configured .dark .button:hover{color:white;}}',
      )
    })
    it('nests multiple wrappers in runtime-context source order', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:md:motion-reduce',
                [
                  declaration(
                    'animation',
                    'none',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (min-width: 768px){@media (prefers-reduced-motion: reduce){.configured .button{animation:none;}}}',
      )
    })
    it('preserves compound container context parts containing colons', () => {
      mocks.splitRuntimeContextParts.mockReturnValueOnce([
        'cq(style(--theme: dark))',
      ])
      const result =
        compileStylesheetText([
          block(
            '.card',
            [
              block(
                'x:cq(style(--theme: dark))',
                [
                  declaration(
                    'color',
                    'white',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@container style(--theme: dark){.configured .card{color:white;}}',
      )
    })
    it('ignores unknown x: parts while preserving recognized contexts', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:unknown:dark:hover',
                [
                  declaration(
                    'color',
                    'white',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '.configured .dark .button:hover{color:white;}',
      )
    })
  })
  describe('stylesheet at-rules', () => {
    it('compiles conditional @media blocks recursively', () => {
      const result =
        compileStylesheetText([
          block(
            '@media (min-width: 768px)',
            [
              block(
                '.button',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (min-width: 768px){.configured .button{color:red;}}',
      )
    })
    it('preserves parent selectors when a conditional at-rule appears inside a selector block', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                '@media (min-width: 768px)',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (min-width: 768px){.configured .button{color:red;}}',
      )
    })
    it('compiles @supports blocks recursively', () => {
      const result =
        compileStylesheetText([
          block(
            '@supports (display: grid)',
            [
              block(
                '.layout',
                [
                  declaration(
                    'display',
                    'grid',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@supports (display: grid){.configured .layout{display:grid;}}',
      )
    })
    it('compiles @layer blocks recursively', () => {
      const result =
        compileStylesheetText([
          block(
            '@layer components',
            [
              block(
                '.button',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@layer components{.configured .button{color:red;}}',
      )
    })
    it('omits structurally valid at-rules whose compiled body is empty', () => {
      expect(
        compileStylesheetText([
          block(
            '@media print',
            [
              directive(
                'ignored',
                [],
              ),
            ],
          ),
        ]),
      ).toBe('')
    })
  })
  describe('@property', () => {
    it('delegates @property compilation to compilePropertyBlock', () => {
      const declarations = [
        declaration(
          'syntax',
          '"<color>"',
        ),
        declaration(
          'inherits',
          'false',
        ),
        declaration(
          'initial-value',
          'red',
        ),
      ]
      const result =
        compileStylesheetText([
          block(
            '@property --brand-color',
            declarations,
          ),
        ])
      expect(
        mocks.compilePropertyBlock,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.compilePropertyBlock,
      ).toHaveBeenCalledWith(
        '--brand-color',
        declarations,
      )
      expect(result).toBe(
        'property(--brand-color){syntax:"<color>";inherits:false;initial-value:red}',
      )
    })
    it('passes only direct declarations from @property to the property compiler', () => {
      const direct =
        declaration(
          'syntax',
          '"<color>"',
        )
      compileStylesheetText([
        block(
          '@property --brand',
          [
            direct,
            block(
              '.invalid-nested-rule',
              [
                declaration(
                  'color',
                  'red',
                ),
              ],
            ),
          ],
        ),
      ])
      expect(
        mocks.compilePropertyBlock,
      ).toHaveBeenCalledWith(
        '--brand',
        [
          direct,
        ],
      )
    })
  })
  describe('declaration-block at-rules', () => {
    it('compiles @font-face using only direct declarations', () => {
      const result =
        compileStylesheetText([
          block(
            '@font-face',
            [
              declaration(
                'font-family',
                '"Inter"',
              ),
              declaration(
                'src',
                'url(inter.woff2)',
              ),
              block(
                '.ignored',
                [
                  declaration(
                    'color',
                    'red',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@font-face{font-family:"Inter";src:url(inter.woff2);}',
      )
    })
    it('applies forceImportant inside declaration-block at-rules', () => {
      const result =
        compileStylesheetText(
          [
            block(
              '@font-face',
              [
                declaration(
                  'font-display',
                  'swap',
                ),
              ],
            ),
          ],
          true,
        )
      expect(result).toBe(
        '@font-face{font-display:swap !important;}',
      )
    })
    it('omits an empty declaration-block at-rule', () => {
      expect(
        compileStylesheetText([
          block(
            '@font-face',
            [
              block(
                '.ignored',
                [],
              ),
            ],
          ),
        ]),
      ).toBe('')
    })
  })
  describe('keyframes', () => {
    it('compiles keyframe steps and their declarations', () => {
      const result =
        compileStylesheetText([
          block(
            '@keyframes fade',
            [
              block(
                'from',
                [
                  declaration(
                    'opacity',
                    '0',
                  ),
                ],
              ),
              block(
                '50%',
                [
                  declaration(
                    'opacity',
                    '0.5',
                  ),
                ],
              ),
              block(
                'to',
                [
                  declaration(
                    'opacity',
                    '1',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@keyframes fade{from{opacity:0;}50%{opacity:0.5;}to{opacity:1;}}',
      )
    })
    it('supports WebKit-prefixed keyframes', () => {
      const result =
        compileStylesheetText([
          block(
            '@-webkit-keyframes fade',
            [
              block(
                'from',
                [
                  declaration(
                    'opacity',
                    '0',
                  ),
                ],
              ),
              block(
                'to',
                [
                  declaration(
                    'opacity',
                    '1',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@-webkit-keyframes fade{from{opacity:0;}to{opacity:1;}}',
      )
    })
    it('ignores declarations placed directly inside a keyframes block', () => {
      const result =
        compileStylesheetText([
          block(
            '@keyframes fade',
            [
              declaration(
                'opacity',
                '0.5',
              ),
              block(
                'to',
                [
                  declaration(
                    'opacity',
                    '1',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@keyframes fade{to{opacity:1;}}',
      )
    })
    it('ignores empty keyframe steps', () => {
      const result =
        compileStylesheetText([
          block(
            '@keyframes fade',
            [
              block(
                'from',
                [],
              ),
              block(
                'to',
                [
                  declaration(
                    'opacity',
                    '1',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@keyframes fade{to{opacity:1;}}',
      )
    })
    it('omits a keyframes at-rule when no valid steps remain', () => {
      expect(
        compileStylesheetText([
          block(
            '@keyframes empty',
            [
              declaration(
                'opacity',
                '0',
              ),
              block(
                'from',
                [],
              ),
            ],
          ),
        ]),
      ).toBe('')
    })
    it('propagates forceImportant to keyframe declarations', () => {
      const result =
        compileStylesheetText(
          [
            block(
              '@keyframes fade',
              [
                block(
                  'to',
                  [
                    declaration(
                      'opacity',
                      '1',
                    ),
                  ],
                ),
              ],
            ),
          ],
          true,
        )
      expect(result).toBe(
        '@keyframes fade{to{opacity:1 !important;}}',
      )
    })
  })
  describe('configured scope integration', () => {
    it('applies configured scope at every emitted ordinary style-rule boundary', () => {
      compileStylesheetText([
        block(
          '.parent',
          [
            declaration(
              'color',
              'red',
            ),
            block(
              '& .child',
              [
                declaration(
                  'color',
                  'blue',
                ),
              ],
            ),
          ],
        ),
      ])
      expect(
        mocks.applyConfiguredScopeToSelectors,
      ).toHaveBeenNthCalledWith(
        1,
        [
          '.parent',
        ],
      )
      expect(
        mocks.applyConfiguredScopeToSelectors,
      ).toHaveBeenNthCalledWith(
        2,
        [
          '.parent .child',
        ],
      )
    })
    it('does not apply configured selector scope to top-level declarations', () => {
      compileStylesheetText([
        declaration(
          '--token',
          'red',
        ),
      ])
      expect(
        mocks.applyConfiguredScopeToSelectors,
      ).not.toHaveBeenCalled()
    })
    it('does not apply configured selector scope directly to keyframe step selectors', () => {
      compileStylesheetText([
        block(
          '@keyframes fade',
          [
            block(
              'from',
              [
                declaration(
                  'opacity',
                  '0',
                ),
              ],
            ),
          ],
        ),
      ])
      expect(
        mocks.applyConfiguredScopeToSelectors,
      ).not.toHaveBeenCalled()
    })
  })
  describe('complex nesting integration', () => {
    it('composes nested selectors, dark mode, breakpoint and conditional at-rules without losing selector context', () => {
      const result =
        compileStylesheetText([
          block(
            '.card',
            [
              block(
                '& .title',
                [
                  block(
                    'x:md:dark:hover',
                    [
                      block(
                        '@supports (display: grid)',
                        [
                          declaration(
                            'display',
                            'grid',
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        '@media (min-width: 768px){@supports (display: grid){.configured .dark .card .title:hover{display:grid;}}}',
      )
    })
    it('preserves sibling context isolation between runtime blocks', () => {
      const result =
        compileStylesheetText([
          block(
            '.button',
            [
              block(
                'x:dark',
                [
                  declaration(
                    'color',
                    'white',
                  ),
                ],
              ),
              block(
                'x:md',
                [
                  declaration(
                    'padding',
                    '2rem',
                  ),
                ],
              ),
            ],
          ),
        ])
      expect(result).toBe(
        [
          '.configured .dark .button{color:white;}',
          '@media (min-width: 768px){.configured .button{padding:2rem;}}',
        ].join('\n'),
      )
    })
    it('does not mutate parent selector arrays while compiling runtime contexts', () => {
      const parentSelectors = [
        '.button',
      ]
      mocks.resolveNestedSelectors.mockReturnValueOnce(
        parentSelectors,
      )
      compileStylesheetText([
        block(
          '.button',
          [
            block(
              'x:dark:hover',
              [
                declaration(
                  'color',
                  'red',
                ),
              ],
            ),
          ],
        ),
      ])
      expect(parentSelectors).toEqual([
        '.button',
      ])
      expect(
        mocks.copyStrings,
      ).toHaveBeenCalledWith(
        parentSelectors,
      )
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'defines whether malformed supports(), layer() and container() runtime wrapper names should be rejected instead of slicing the final character blindly',
    )
    it.todo(
      'defines whether unknown x: runtime blocks should compile transparently or emit diagnostics instead of silently behaving like their parent context',
    )
    it.todo(
      'defines whether !important is semantically valid inside @font-face and @keyframes before forceImportant is propagated into those grammar families',
    )
    it.todo(
      'defines whether top-level declarations are intentionally supported by the full stylesheet compiler or should require a selector/root declaration context',
    )
  })
})
function declaration(
  property: string,
  value: string,
): CipoDeclarationNode {
  return {
    type: 'declaration',
    property,
    value,
    source: `${property}:${value}`,
  } as CipoDeclarationNode
}
function block(
  name: string,
  body: readonly CipoAstNode[],
): CipoBlockNode {
  return {
    type: 'block',
    name,
    body,
  } as CipoBlockNode
}
function directive(
  name: string,
  args: readonly string[],
): CipoAstNode {
  return {
    type: 'directive',
    name,
    args,
  } as CipoAstNode
}
