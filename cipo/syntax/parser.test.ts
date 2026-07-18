import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoAstNode,
  CipoDeclarationNode,
  CipoWarning,
} from '../types'
const mocks = vi.hoisted(() => ({
  runtime: {
    aliasRegistry: new Map<string, unknown>(),
  },
  warn: vi.fn(
    (
      _runtime: unknown,
      warnings: CipoWarning[],
      code: string,
      message: string,
      source: string,
    ) => {
      warnings.push({
        code,
        message,
        source,
      } as CipoWarning)
    },
  ),
  expandSmartDeclarationFunction: vi.fn(
    () => '',
  ),
  isNativeCssFunction: vi.fn(
    () => false,
  ),
  normalizePropertyDeclaration: vi.fn(
    (
      property: string,
      value: string,
    ): CipoDeclarationNode[] => [
      {
        type: 'declaration',
        property,
        value,
        source: `${property}:${value}`,
      } as CipoDeclarationNode,
    ],
  ),
  parseGeneratedDeclarations: vi.fn(
    (
      css: string,
    ): CipoDeclarationNode[] => [
      {
        type: 'declaration',
        property: 'generated',
        value: css,
        source: css,
      } as CipoDeclarationNode,
    ],
  ),
  getStandaloneAliasName: vi.fn(
    (
      source: string,
    ) =>
      /^\$?[a-zA-Z_][\w-]*$/.test(
        source.trim(),
      )
        ? source
          .trim()
          .replace(
            /^\$/,
            '',
          )
        : '',
  ),
  stringifyAlias: vi.fn(
    () => '',
  ),
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
    warn: mocks.warn,
  }
})
vi.mock('../values', () => ({
  expandSmartDeclarationFunction:
    mocks.expandSmartDeclarationFunction,
  isNativeCssFunction:
    mocks.isNativeCssFunction,
  normalizePropertyDeclaration:
    mocks.normalizePropertyDeclaration,
  parseGeneratedDeclarations:
    mocks.parseGeneratedDeclarations,
}))
vi.mock('../transform/index', () => ({
  getStandaloneAliasName:
    mocks.getStandaloneAliasName,
  stringifyAlias:
    mocks.stringifyAlias,
}))
import {
  appendDeclarationsAndDirectives,
  parseBlockBody,
  parseDeclarationFunction,
  parseDeclarations,
  parseDirective,
  parseStylesheet,
  tokenizeDeclarations,
} from './parser'
describe('Cipó AST parser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.aliasRegistry.clear()
    mocks.expandSmartDeclarationFunction.mockReturnValue(
      '',
    )
    mocks.isNativeCssFunction.mockReturnValue(
      false,
    )
    mocks.normalizePropertyDeclaration.mockImplementation(
      (
        property: string,
        value: string,
      ): CipoDeclarationNode[] => [
        {
          type: 'declaration',
          property,
          value,
          source:
            `${property}:${value}`,
        } as CipoDeclarationNode,
      ],
    )
    mocks.parseGeneratedDeclarations.mockImplementation(
      (
        css: string,
      ): CipoDeclarationNode[] => [
        {
          type: 'declaration',
          property: 'generated',
          value: css,
          source: css,
        } as CipoDeclarationNode,
      ],
    )
    mocks.getStandaloneAliasName.mockImplementation(
      (
        source: string,
      ) =>
        /^\$?[a-zA-Z_][\w-]*$/.test(
          source.trim(),
        )
          ? source
            .trim()
            .replace(
              /^\$/,
              '',
            )
          : '',
    )
    mocks.stringifyAlias.mockReturnValue(
      '',
    )
  })
  describe('tokenizeDeclarations', () => {
    it('splits semicolon-separated declarations', () => {
      expect(
        tokenizeDeclarations(
          'color:red;padding:4px;',
        ),
      ).toEqual([
        'color:red',
        'padding:4px',
      ])
    })
    it('splits complete semicolon-free declarations on newlines', () => {
      expect(
        tokenizeDeclarations(
          [
            'px: 4',
            'py: 3',
            'bg: $brand',
          ].join('\n'),
        ),
      ).toEqual([
        'px: 4',
        'py: 3',
        'bg: $brand',
      ])
    })
    it('supports CRLF-separated semicolon-free declarations', () => {
      expect(
        tokenizeDeclarations(
          'px: 4\r\npy: 3',
        ),
      ).toEqual([
        'px: 4',
        'py: 3',
      ])
    })
    it('keeps nested function arguments intact across commas', () => {
      expect(
        tokenizeDeclarations(
          'background:linear-gradient(red, blue);color:white;',
        ),
      ).toEqual([
        'background:linear-gradient(red, blue)',
        'color:white',
      ])
    })
    it('does not split on semicolons inside parentheses', () => {
      expect(
        tokenizeDeclarations(
          'value:fn(a;b;c);color:red;',
        ),
      ).toEqual([
        'value:fn(a;b;c)',
        'color:red',
      ])
    })
    it('does not split on newlines inside parentheses', () => {
      expect(
        tokenizeDeclarations(
          [
            'background:linear-gradient(',
            '  red,',
            '  blue',
            ')',
            'color:white',
          ].join('\n'),
        ),
      ).toEqual([
        [
          'background:linear-gradient(',
          '  red,',
          '  blue',
          ')',
        ].join('\n'),
        'color:white',
      ])
    })
    it('does not split on newlines inside brackets', () => {
      expect(
        tokenizeDeclarations(
          [
            'value:[first,',
            'second]',
            'color:red',
          ].join('\n'),
        ),
      ).toEqual([
        [
          'value:[first,',
          'second]',
        ].join('\n'),
        'color:red',
      ])
    })
    it('preserves semicolons and newlines inside double-quoted strings', () => {
      expect(
        tokenizeDeclarations(
          [
            'content:"a;b',
            'c"',
            'color:red',
          ].join('\n'),
        ),
      ).toEqual([
        'content:"a;b\nc"',
        'color:red',
      ])
    })
    it('preserves semicolons inside single-quoted strings', () => {
      expect(
        tokenizeDeclarations(
          "content:'a;b';color:red;",
        ),
      ).toEqual([
        "content:'a;b'",
        'color:red',
      ])
    })
    it('keeps an incomplete declaration ending in a colon joined to the next line', () => {
      expect(
        tokenizeDeclarations(
          [
            'color:',
            '$brand',
          ].join('\n'),
        ),
      ).toEqual([
        'color: $brand',
      ])
    })
    it('keeps a trailing-comma token joined to the next line', () => {
      expect(
        tokenizeDeclarations(
          [
            'text(size: lg,',
            'weight: 700)',
          ].join('\n'),
        ),
      ).toEqual([
        'text(size: lg,\nweight: 700)',
      ])
    })
    it('flushes standalone identifiers on newlines', () => {
      expect(
        tokenizeDeclarations(
          [
            'glass',
            'center',
          ].join('\n'),
        ),
      ).toEqual([
        'glass',
        'center',
      ])
    })
    it('flushes smart declaration helpers on newlines', () => {
      expect(
        tokenizeDeclarations(
          [
            'stack(gap: 4)',
            'center(max: 60rem)',
          ].join('\n'),
        ),
      ).toEqual([
        'stack(gap: 4)',
        'center(max: 60rem)',
      ])
    })
    it('flushes unknown function calls so parser diagnostics can handle them later', () => {
      mocks.isNativeCssFunction.mockReturnValue(
        false,
      )
      expect(
        tokenizeDeclarations(
          [
            'custom(value)',
            'color:red',
          ].join('\n'),
        ),
      ).toEqual([
        'custom(value)',
        'color:red',
      ])
    })
    it('does not flush native CSS function calls as standalone declarations', () => {
      mocks.isNativeCssFunction.mockImplementation(
        (
          name: string,
        ) =>
          name === 'var',
      )
      expect(
        tokenizeDeclarations(
          [
            'var(--token)',
            'color:red',
          ].join('\n'),
        ),
      ).toEqual([
        'var(--token) color:red',
      ])
    })
    it('drops empty tokens', () => {
      expect(
        tokenizeDeclarations(
          ';;\n\n;color:red;;;',
        ),
      ).toEqual([
        'color:red',
      ])
    })
    it('trims emitted tokens', () => {
      expect(
        tokenizeDeclarations(
          '  color:red  ;  padding:4px  ',
        ),
      ).toEqual([
        'color:red',
        'padding:4px',
      ])
    })
    it('handles empty input', () => {
      expect(
        tokenizeDeclarations(
          '',
        ),
      ).toEqual([])
    })
  })
  describe('parseDirective', () => {
    it('parses a legacy directive call', () => {
      expect(
        parseDirective(
          '@with(bg(red), px(4))',
          [],
        ),
      ).toEqual({
        type: 'directive',
        name: 'with',
        args: [
          'bg(red)',
          'px(4)',
        ],
        source:
          '@with(bg(red), px(4))',
      })
    })
    it('preserves nested commas inside directive arguments', () => {
      expect(
        parseDirective(
          '@custom(linear-gradient(red, blue), rgb(0, 0, 0))',
          [],
        ),
      ).toEqual({
        type: 'directive',
        name: 'custom',
        args: [
          'linear-gradient(red, blue)',
          'rgb(0, 0, 0)',
        ],
        source:
          '@custom(linear-gradient(red, blue), rgb(0, 0, 0))',
      })
    })
    it('supports hyphens in directive names', () => {
      expect(
        parseDirective(
          '@custom-directive(value)',
          [],
        ),
      ).toMatchObject({
        type: 'directive',
        name:
          'custom-directive',
      })
    })
    it('warns and returns null for malformed directive syntax', () => {
      const warnings:
        CipoWarning[] = []
      expect(
        parseDirective(
          '@invalid',
          warnings,
        ),
      ).toBeNull()
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'invalid-directive',
        'Invalid directive "@invalid".',
        '@invalid',
      )
    })
    it('warns for block-style directives passed to the legacy directive parser', () => {
      const warnings:
        CipoWarning[] = []
      expect(
        parseDirective(
          '@media{color:red;}',
          warnings,
        ),
      ).toBeNull()
      expect(
        mocks.warn,
      ).toHaveBeenCalledTimes(1)
    })
  })
  describe('parseDeclarationFunction', () => {
    it('returns no declarations for ordinary non-call source', () => {
      expect(
        parseDeclarationFunction(
          'color:red',
          [],
        ),
      ).toEqual([])
      expect(
        mocks.expandSmartDeclarationFunction,
      ).not.toHaveBeenCalled()
    })
    it('delegates helper calls to smart declaration expansion', () => {
      mocks.expandSmartDeclarationFunction.mockReturnValue(
        'display:flex;gap:4px;',
      )
      mocks.parseGeneratedDeclarations.mockReturnValue([
        {
          type: 'declaration',
          property: 'display',
          value: 'flex',
        },
        {
          type: 'declaration',
          property: 'gap',
          value: '4px',
        },
      ] as CipoDeclarationNode[])
      const result =
        parseDeclarationFunction(
          'stack(gap: 4)',
          [],
        )
      expect(
        mocks.expandSmartDeclarationFunction,
      ).toHaveBeenCalledWith(
        'stack',
        [
          'gap: 4',
        ],
      )
      expect(
        mocks.parseGeneratedDeclarations,
      ).toHaveBeenCalledWith(
        'display:flex;gap:4px;',
      )
      expect(result).toHaveLength(2)
    })
    it('uses the legacy text property normalization fallback when smart expansion returns empty', () => {
      mocks.expandSmartDeclarationFunction.mockReturnValue(
        '',
      )
      const result =
        parseDeclarationFunction(
          'text(size: lg, weight: 700)',
          [],
        )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'text',
        'size: lg,weight: 700',
      )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'declaration',
          property: 'text',
          value:
            'size: lg,weight: 700',
        }),
      ])
    })
    it('ignores native CSS functions without warnings', () => {
      mocks.isNativeCssFunction.mockImplementation(
        (
          name: string,
        ) =>
          name === 'var',
      )
      const warnings:
        CipoWarning[] = []
      expect(
        parseDeclarationFunction(
          'var(--brand)',
          warnings,
        ),
      ).toEqual([])
      expect(
        mocks.warn,
      ).not.toHaveBeenCalled()
    })
    it('warns for unknown declaration helper functions', () => {
      const warnings:
        CipoWarning[] = []
      expect(
        parseDeclarationFunction(
          'mystery(value)',
          warnings,
        ),
      ).toEqual([])
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'unknown-function-declaration',
        'Unknown declaration helper "mystery(...)".',
        'mystery(value)',
      )
    })
    it('passes parsed nested arguments intact to smart expansion', () => {
      mocks.expandSmartDeclarationFunction.mockReturnValue(
        'generated:value;',
      )
      parseDeclarationFunction(
        'grid-template(cols: repeat(3, minmax(0, 1fr)), rows: auto 1fr)',
        [],
      )
      expect(
        mocks.expandSmartDeclarationFunction,
      ).toHaveBeenCalledWith(
        'grid-template',
        [
          'cols: repeat(3, minmax(0, 1fr))',
          'rows: auto 1fr',
        ],
      )
    })
  })
  describe('appendDeclarationsAndDirectives', () => {
    it('normalizes ordinary property declarations', () => {
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        'color:red;padding:4px;',
        [],
      )
      expect(
        mocks.normalizePropertyDeclaration.mock.calls,
      ).toEqual([
        [
          'color',
          'red',
        ],
        [
          'padding',
          '4px',
        ],
      ])
      expect(nodes).toHaveLength(2)
    })
    it('supports semicolon-free declaration lists', () => {
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        [
          'px: 4',
          'py: 3',
          'bg: $brand',
        ].join('\n'),
        [],
      )
      expect(
        mocks.normalizePropertyDeclaration.mock.calls,
      ).toEqual([
        [
          'px',
          '4',
        ],
        [
          'py',
          '3',
        ],
        [
          'bg',
          '$brand',
        ],
      ])
    })
    it('parses directives before declaration handling', () => {
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        '@with(bg(red), px(4));',
        [],
      )
      expect(nodes).toEqual([
        {
          type: 'directive',
          name: 'with',
          args: [
            'bg(red)',
            'px(4)',
          ],
          source:
            '@with(bg(red), px(4))',
        },
      ])
      expect(
        mocks.normalizePropertyDeclaration,
      ).not.toHaveBeenCalled()
    })
    it('expands declaration helpers before colon-based declaration parsing', () => {
      mocks.expandSmartDeclarationFunction.mockReturnValue(
        'display:flex;',
      )
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        'stack(gap: 4)',
        [],
      )
      expect(
        mocks.parseGeneratedDeclarations,
      ).toHaveBeenCalledWith(
        'display:flex;',
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).not.toHaveBeenCalled()
    })
    it('ignores standalone native CSS function calls', () => {
      mocks.isNativeCssFunction.mockImplementation(
        (
          name: string,
        ) =>
          name === 'calc',
      )
      const warnings:
        CipoWarning[] = []
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        'calc(100% - 2rem)',
        warnings,
      )
      expect(nodes).toEqual([])
      expect(
        mocks.warn,
      ).not.toHaveBeenCalled()
    })
    it('expands registered standalone aliases recursively through parseBlockBody', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        true,
      )
      mocks.stringifyAlias.mockReturnValue(
        'color:red;padding:4px;',
      )
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        'glass',
        [],
      )
      expect(
        mocks.stringifyAlias,
      ).toHaveBeenCalledWith(
        'glass',
        expect.any(Array),
      )
      expect(nodes).toEqual([
        expect.objectContaining({
          type: 'declaration',
          property: 'color',
          value: 'red',
        }),
        expect.objectContaining({
          type: 'declaration',
          property: 'padding',
          value: '4px',
        }),
      ])
    })
    it('supports dollar-prefixed standalone aliases', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        true,
      )
      mocks.stringifyAlias.mockReturnValue(
        'color:red;',
      )
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        '$glass',
        [],
      )
      expect(
        mocks.stringifyAlias,
      ).toHaveBeenCalledWith(
        'glass',
        expect.any(Array),
      )
      expect(nodes).toHaveLength(1)
    })
    it('warns for an unknown standalone identifier', () => {
      const warnings:
        CipoWarning[] = []
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        'unknownAlias',
        warnings,
      )
      expect(nodes).toEqual([])
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'invalid-declaration',
        'Invalid declaration "unknownAlias".',
        'unknownAlias',
      )
    })
    it('warns for malformed declaration syntax without a property colon', () => {
      const warnings:
        CipoWarning[] = []
      appendDeclarationsAndDirectives(
        [],
        'not a declaration',
        warnings,
      )
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'invalid-declaration',
        'Invalid declaration "not a declaration".',
        'not a declaration',
      )
    })
    it('uses only the top-level colon as declaration separator', () => {
      appendDeclarationsAndDirectives(
        [],
        'background:var(--fallback, color:red);',
        [],
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'background',
        'var(--fallback, color:red)',
      )
    })
    it('preserves declaration source order', () => {
      const nodes:
        CipoAstNode[] = []
      appendDeclarationsAndDirectives(
        nodes,
        [
          'first:1',
          'second:2',
          'third:3',
        ].join('\n'),
        [],
      )
      expect(
        nodes.map(
          (
            node: any,
          ) =>
            node.property,
        ),
      ).toEqual([
        'first',
        'second',
        'third',
      ])
    })
  })
  describe('parseDeclarations', () => {
    it('parses a declaration list', () => {
      expect(
        parseDeclarations(
          'color:red;padding:4px;',
          [],
        ),
      ).toEqual([
        expect.objectContaining({
          type: 'declaration',
          property: 'color',
          value: 'red',
        }),
        expect.objectContaining({
          type: 'declaration',
          property: 'padding',
          value: '4px',
        }),
      ])
    })
    it('removes block comments before parsing declarations', () => {
      expect(
        parseDeclarations(
          'color:red;/* ignore:me; */padding:4px;',
          [],
        ),
      ).toEqual([
        expect.objectContaining({
          property: 'color',
          value: 'red',
        }),
        expect.objectContaining({
          property: 'padding',
          value: '4px',
        }),
      ])
      expect(
        mocks.normalizePropertyDeclaration,
      ).not.toHaveBeenCalledWith(
        'ignore',
        expect.anything(),
      )
    })
    it('does not remove comment-like content inside strings', () => {
      parseDeclarations(
        'content:"/* keep */";',
        [],
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'content',
        '"/* keep */"',
      )
    })
    it('preserves escaped quotes while removing comments', () => {
      parseDeclarations(
        String.raw`content:"hello \" /* keep */";/* remove */color:red;`,
        [],
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'content',
        String.raw`"hello \" /* keep */"`,
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'color',
        'red',
      )
    })
  })
  describe('parseBlockBody', () => {
    it('parses a simple nested block', () => {
      const result =
        parseBlockBody(
          '.card{color:red;}',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: '.card',
          source:
            '.card{color:red;}',
          body: [
            expect.objectContaining({
              type: 'declaration',
              property: 'color',
              value: 'red',
            }),
          ],
        }),
      ])
    })
    it('parses deeply nested blocks recursively', () => {
      const result =
        parseBlockBody(
          'x:md{&:hover{color:red;}}',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: 'x:md',
          body: [
            expect.objectContaining({
              type: 'block',
              name: '&:hover',
              body: [
                expect.objectContaining({
                  type: 'declaration',
                  property: 'color',
                  value: 'red',
                }),
              ],
            }),
          ],
        }),
      ])
    })
    it('flushes semicolon-free declarations before a following runtime block', () => {
      const result =
        parseBlockBody(
          [
            'px: 4',
            'py: 3',
            'x:md {',
            '  px: 6',
            '}',
          ].join('\n'),
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'declaration',
          property: 'px',
          value: '4',
        }),
        expect.objectContaining({
          type: 'declaration',
          property: 'py',
          value: '3',
        }),
        expect.objectContaining({
          type: 'block',
          name: 'x:md',
          body: [
            expect.objectContaining({
              type: 'declaration',
              property: 'px',
              value: '6',
            }),
          ],
        }),
      ])
    })
    it('flushes semicolon-terminated declarations before a block', () => {
      const result =
        parseBlockBody(
          'color:red;padding:4px;&:hover{color:blue;}',
          [],
        )
      expect(
        result.map(
          (
            node: any,
          ) =>
            node.type === 'block'
              ? node.name
              : node.property,
        ),
      ).toEqual([
        'color',
        'padding',
        '&:hover',
      ])
    })
    it('preserves a multiline selector list as one block name', () => {
      const result =
        parseBlockBody(
          [
            'th,',
            'td {',
            '  color:red;',
            '}',
          ].join('\n'),
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: [
            'th,',
            'td',
          ].join('\n'),
        }),
      ])
      expect(
        mocks.warn,
      ).not.toHaveBeenCalledWith(
        mocks.runtime,
        expect.anything(),
        'invalid-declaration',
        expect.stringContaining(
          'th,',
        ),
        expect.anything(),
      )
    })
    it('preserves a multiline selector list following declarations', () => {
      const result =
        parseBlockBody(
          [
            'color:red',
            'th,',
            'td {',
            '  padding:4px;',
            '}',
          ].join('\n'),
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'declaration',
          property: 'color',
          value: 'red',
        }),
        expect.objectContaining({
          type: 'block',
          name: [
            'th,',
            'td',
          ].join('\n'),
        }),
      ])
    })
    it('supports comma-separated selectors on one line', () => {
      const result =
        parseBlockBody(
          '.button,.link{color:red;}',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name:
            '.button,.link',
        }),
      ])
    })
    it('preserves stylesheet at-rules as block names', () => {
      const result =
        parseBlockBody(
          '@media print{color:black;}',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name:
            '@media print',
        }),
      ])
    })
    it('preserves runtime contexts as block names', () => {
      const result =
        parseBlockBody(
          'x:md{color:red;}',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: 'x:md',
        }),
      ])
    })
    it('preserves nested selectors as block names', () => {
      const result =
        parseBlockBody(
          '&:hover{color:red;}',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: '&:hover',
        }),
      ])
    })
    it('warns when an opening brace has no preceding block name', () => {
      const warnings:
        CipoWarning[] = []
      const result =
        parseBlockBody(
          '{color:red;}',
          warnings,
        )
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'missing-block-name',
        'A CSS block is missing its selector or runtime context.',
        expect.any(String),
      )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: '',
        }),
      ])
    })
    it('warns and preserves remaining source when a block is unclosed', () => {
      const warnings:
        CipoWarning[] = []
      parseBlockBody(
        '.card{color:red;',
        warnings,
      )
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'unclosed-block',
        'Block ".card" is missing a closing brace.',
        '{color:red;',
      )
    })
    it('continues parsing declarations after a closed block', () => {
      const result =
        parseBlockBody(
          '.card{color:red;}padding:4px;',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: '.card',
        }),
        expect.objectContaining({
          type: 'declaration',
          property: 'padding',
          value: '4px',
        }),
      ])
    })
    it('preserves node order across declarations and blocks', () => {
      const result =
        parseBlockBody(
          [
            'before:1',
            '.card{inside:2;}',
            'after:3',
          ].join('\n'),
          [],
        )
      expect(
        result.map(
          (
            node: any,
          ) =>
            node.type === 'block'
              ? node.name
              : node.property,
        ),
      ).toEqual([
        'before',
        '.card',
        'after',
      ])
    })
  })
  describe('parseStylesheet', () => {
    it('strips comments before parsing the complete stylesheet', () => {
      const result =
        parseStylesheet(
          [
            '/* top-level comment */',
            '.card{',
            '  /* nested comment */',
            '  color:red;',
            '}',
          ].join('\n'),
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: '.card',
          body: [
            expect.objectContaining({
              type: 'declaration',
              property: 'color',
              value: 'red',
            }),
          ],
        }),
      ])
    })
    it('preserves comment-like strings while stripping real comments', () => {
      parseStylesheet(
        '.card{content:"/* keep */";/* remove */color:red;}',
        [],
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'content',
        '"/* keep */"',
      )
      expect(
        mocks.normalizePropertyDeclaration,
      ).toHaveBeenCalledWith(
        'color',
        'red',
      )
    })
    it('parses declarations and runtime contexts together', () => {
      const result =
        parseStylesheet(
          [
            'px:4',
            'x:md{',
            '  px:6',
            '}',
          ].join('\n'),
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'declaration',
          property: 'px',
          value: '4',
        }),
        expect.objectContaining({
          type: 'block',
          name: 'x:md',
        }),
      ])
    })
  })
  describe('alias integration', () => {
    it('parses declarations generated by a registered alias', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        true,
      )
      mocks.stringifyAlias.mockReturnValue(
        [
          'background:blur;',
          'border:1px solid white;',
        ].join(''),
      )
      const result =
        parseDeclarations(
          'glass',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          property: 'background',
          value: 'blur',
        }),
        expect.objectContaining({
          property: 'border',
          value:
            '1px solid white',
        }),
      ])
    })
    it('parses nested blocks generated by aliases', () => {
      mocks.runtime.aliasRegistry.set(
        'interactive',
        true,
      )
      mocks.stringifyAlias.mockReturnValue(
        '&:hover{color:red;}',
      )
      const result =
        parseDeclarations(
          'interactive',
          [],
        )
      expect(result).toEqual([
        expect.objectContaining({
          type: 'block',
          name: '&:hover',
        }),
      ])
    })
    it('passes the same warning sink into alias stringification and recursive parsing', () => {
      mocks.runtime.aliasRegistry.set(
        'broken',
        true,
      )
      const warnings:
        CipoWarning[] = []
      mocks.stringifyAlias.mockImplementation(
        (
          _name: string,
          receivedWarnings:
            CipoWarning[],
        ) => {
          expect(
            receivedWarnings,
          ).toBe(warnings)
          return 'invalid source'
        },
      )
      parseDeclarations(
        'broken',
        warnings,
      )
      expect(
        mocks.stringifyAlias,
      ).toHaveBeenCalledWith(
        'broken',
        warnings,
      )
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'invalid-declaration',
        'Invalid declaration "invalid source".',
        'invalid source',
      )
    })
  })
  describe('warning behavior', () => {
    it('appends warnings without replacing existing diagnostics', () => {
      const existing = {
        code: 'existing',
        message:
          'Existing warning',
      } as CipoWarning
      const warnings = [
        existing,
      ]
      parseDeclarations(
        'invalid source',
        warnings,
      )
      expect(
        warnings[0],
      ).toBe(existing)
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'invalid-declaration',
        expect.any(String),
        'invalid source',
      )
    })
    it('does not warn for valid declarations', () => {
      const warnings:
        CipoWarning[] = []
      parseDeclarations(
        'color:red;',
        warnings,
      )
      expect(
        mocks.warn,
      ).not.toHaveBeenCalled()
    })
  })
  describe('determinism', () => {
    it('produces equivalent ASTs for identical source', () => {
      const input = [
        'color:red',
        'x:md{',
        '  color:blue',
        '}',
      ].join('\n')
      const first =
        parseStylesheet(
          input,
          [],
        )
      const second =
        parseStylesheet(
          input,
          [],
        )
      expect(second).toEqual(
        first,
      )
    })
    it('does not mutate the input source', () => {
      const input =
        '.card{color:red;}'
      const snapshot =
        input
      parseStylesheet(
        input,
        [],
      )
      expect(input).toBe(
        snapshot,
      )
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'tokenizeDeclarations uses escape parity instead of checking only the immediately preceding backslash when scanning quoted strings',
    )
    it.todo(
      'findDeclarationBlockBoundary uses quote-aware reverse scanning that correctly handles escaped quotes when scanning backwards',
    )
    it.todo(
      'parseBlockBody does not treat braces inside quoted declaration values as structural block delimiters',
    )
    it.todo(
      'parseBlockBody does not treat braces inside comments as structural delimiters when called directly instead of through parseStylesheet',
    )
    it.todo(
      'tokenizeDeclarations tracks matching delimiter families instead of one shared depth counter for parentheses and brackets',
    )
    it.todo(
      'standalone native CSS function lines followed by declarations do not merge into one invalid token when semicolons are omitted',
    )
    it.todo(
      'unclosed blocks do not produce a secondary invalid-declaration warning for the preserved opening-brace remainder',
    )
    it.todo(
      'parseDirective shares balanced-parentheses parsing with the common lexer instead of relying on a whole-string regular expression',
    )
  })
})
