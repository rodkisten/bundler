import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoStyleObject,
  CipoWarning,
} from '../types'
const mocks = vi.hoisted(() => {
  const aliasRegistry =
    new Map<
      string,
      | string
      | CipoStyleObject
      | (() => string | CipoStyleObject)
    >()
  return {
    runtime: {
      aliasRegistry,
    },
    prepareCoreCssInput: vi.fn(
      (value: string) =>
        `prepared(${value})`,
    ),
    finalizeCoreCssOutput: vi.fn(
      (value: string) =>
        `finalized(${value})`,
    ),
    expandRuntimeDsl: vi.fn(
      (value: string) =>
        `runtime(${value})`,
    ),
    resolveThemeReferences: vi.fn(
      (value: string) =>
        `theme(${value})`,
    ),
    resolveHelpers: vi.fn(
      (value: string) =>
        `helpers(${value})`,
    ),
    styleObjectToCss: vi.fn(
      (
        value: CipoStyleObject,
      ) =>
        `style(${JSON.stringify(value)})`,
    ),
    isTypedValue: vi.fn(
      () => false,
    ),
    getTypedInitialValue: vi.fn(
      () => 'typed-initial',
    ),
    stripCipoComments: vi.fn(
      (value: string) =>
        `stripped(${value})`,
    ),
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
  }
})
vi.mock('./safety', () => ({
  prepareCoreCssInput:
    mocks.prepareCoreCssInput,
  finalizeCoreCssOutput:
    mocks.finalizeCoreCssOutput,
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../runtime-dsl', () => ({
  expandRuntimeDsl:
    mocks.expandRuntimeDsl,
}))
vi.mock('../theme', () => ({
  resolveThemeReferences:
    mocks.resolveThemeReferences,
}))
vi.mock('../values', () => ({
  resolveHelpers:
    mocks.resolveHelpers,
}))
vi.mock('../style-object', () => ({
  styleObjectToCss:
    mocks.styleObjectToCss,
}))
vi.mock('../properties', () => ({
  isTypedValue:
    mocks.isTypedValue,
  getTypedInitialValue:
    mocks.getTypedInitialValue,
}))
vi.mock('../syntax/css-lexer', () => ({
  stripCipoComments:
    mocks.stripCipoComments,
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
import {
  buildCss,
  expandStandaloneAliases,
  expandWithCompat,
  getStandaloneAliasName,
  stringifyAlias,
  stripComments,
  transformCss,
} from './index'
describe('core CSS source transforms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.aliasRegistry.clear()
    mocks.prepareCoreCssInput.mockImplementation(
      (value: string) =>
        `prepared(${value})`,
    )
    mocks.finalizeCoreCssOutput.mockImplementation(
      (value: string) =>
        `finalized(${value})`,
    )
    mocks.expandRuntimeDsl.mockImplementation(
      (value: string) =>
        `runtime(${value})`,
    )
    mocks.resolveThemeReferences.mockImplementation(
      (value: string) =>
        `theme(${value})`,
    )
    mocks.resolveHelpers.mockImplementation(
      (value: string) =>
        `helpers(${value})`,
    )
    mocks.styleObjectToCss.mockImplementation(
      (
        value: CipoStyleObject,
      ) =>
        `style(${JSON.stringify(value)})`,
    )
    mocks.isTypedValue.mockReturnValue(
      false,
    )
    mocks.getTypedInitialValue.mockReturnValue(
      'typed-initial',
    )
    mocks.stripCipoComments.mockImplementation(
      (value: string) =>
        `stripped(${value})`,
    )
  })
  describe('buildCss', () => {
    it('interleaves template strings and primitive values', () => {
      expect(
        buildCss(
          template(
            'color:',
            ';padding:',
            ';',
          ),
          [
            'red',
            8,
          ],
        ),
      ).toBe(
        'color:red;padding:8;',
      )
    })
    it('converts null and undefined interpolations to empty strings', () => {
      expect(
        buildCss(
          template(
            'a:',
            ';b:',
            ';',
          ),
          [
            null,
            undefined,
          ],
        ),
      ).toBe(
        'a:;b:;',
      )
    })
    it('uses rawCss when interpolating a CSS-like artifact', () => {
      const artifact = {
        kind: 'cipo.css',
        rawCss:
          'color:red;',
        className:
          'cp-a-color',
      }
      expect(
        buildCss(
          template(
            '.button{',
            '}',
          ),
          [
            artifact,
          ],
        ),
      ).toBe(
        '.button{color:red;}',
      )
      expect(
        mocks.styleObjectToCss,
      ).not.toHaveBeenCalled()
    })
    it('uses typed initial values for typed-property interpolations', () => {
      const typedValue = {
        __typed: true,
      }
      mocks.isTypedValue.mockImplementation(
        (value: unknown) =>
          value === typedValue,
      )
      mocks.getTypedInitialValue.mockReturnValue(
        '12px',
      )
      expect(
        buildCss(
          template(
            'width:',
            ';',
          ),
          [
            typedValue,
          ],
        ),
      ).toBe(
        'width:12px;',
      )
      expect(
        mocks.getTypedInitialValue,
      ).toHaveBeenCalledWith(
        typedValue,
      )
    })
    it('serializes plain style-object interpolations', () => {
      const style = {
        color: 'red',
        padding: '8px',
      }
      mocks.styleObjectToCss.mockReturnValue(
        'color:red;padding:8px;',
      )
      expect(
        buildCss(
          template(
            '.button{',
            '}',
          ),
          [
            style,
          ],
        ),
      ).toBe(
        '.button{color:red;padding:8px;}',
      )
      expect(
        mocks.styleObjectToCss,
      ).toHaveBeenCalledWith(
        style,
      )
    })
    it('prefers CSS-like artifact handling over generic plain-object serialization', () => {
      const artifact = {
        rawCss:
          'display:grid;',
      }
      expect(
        buildCss(
          template(
            '',
            '',
          ),
          [
            artifact,
          ],
        ),
      ).toBe(
        'display:grid;',
      )
      expect(
        mocks.styleObjectToCss,
      ).not.toHaveBeenCalled()
    })
    it('prefers typed-value handling over plain-object serialization', () => {
      const typedValue = {
        token: 'spacing',
      }
      mocks.isTypedValue.mockImplementation(
        (value: unknown) =>
          value === typedValue,
      )
      mocks.getTypedInitialValue.mockReturnValue(
        '1rem',
      )
      expect(
        buildCss(
          template(
            'gap:',
            ';',
          ),
          [
            typedValue,
          ],
        ),
      ).toBe(
        'gap:1rem;',
      )
      expect(
        mocks.styleObjectToCss,
      ).not.toHaveBeenCalled()
    })
    it('stringifies non-special interpolation values', () => {
      const custom = {
        toString() {
          return 'custom-value'
        },
      }
      expect(
        buildCss(
          template(
            'value:',
            ';',
          ),
          [
            custom,
          ],
        ),
      ).toBe(
        'value:custom-value;',
      )
    })
    it('ignores excess interpolation values beyond the template string count', () => {
      expect(
        buildCss(
          template(
            'value:',
            '',
          ),
          [
            'red',
            'ignored',
            'also-ignored',
          ],
        ),
      ).toBe(
        'value:red',
      )
    })
    it('handles missing interpolation values without inventing output', () => {
      expect(
        buildCss(
          template(
            'a:',
            ';b:',
            ';',
          ),
          [
            'one',
          ],
        ),
      ).toBe(
        'a:one;b:;',
      )
    })
    it('handles an empty template', () => {
      expect(
        buildCss(
          template(''),
          [],
        ),
      ).toBe('')
    })
  })
  describe('transformCss', () => {
    it('runs the complete transform pipeline in semantic order', () => {
      const warnings:
        CipoWarning[] = []
      const result =
        transformCss(
          'source',
          warnings,
        )
      expect(
        mocks.stripCipoComments,
      ).toHaveBeenCalledWith(
        'source',
      )
      expect(
        mocks.prepareCoreCssInput,
      ).toHaveBeenCalledWith(
        'stripped(source)',
      )
      expect(
        mocks.expandRuntimeDsl,
      ).toHaveBeenCalledWith(
        'prepared(stripped(source))',
        warnings,
      )
      expect(
        mocks.resolveThemeReferences,
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          'runtime(prepared(stripped(source)))',
        ),
      )
      expect(
        mocks.resolveHelpers,
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          'theme(',
        ),
      )
      expect(
        mocks.finalizeCoreCssOutput,
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          'helpers(',
        ),
      )
      expect(result).toContain(
        'finalized(',
      )
    })
    it('passes one shared warning sink through runtime and alias compatibility transforms', () => {
      const warnings:
        CipoWarning[] = []
      mocks.runtime.aliasRegistry.set(
        'cycle',
        'cycle',
      )
      mocks.expandRuntimeDsl.mockReturnValue(
        'cycle',
      )
      transformCss(
        'source',
        warnings,
      )
      expect(
        mocks.expandRuntimeDsl,
      ).toHaveBeenCalledWith(
        expect.any(String),
        warnings,
      )
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'cyclic-alias',
        expect.any(String),
        'cycle',
      )
    })
    it('runs alias expansion before legacy @with compatibility', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'color:red;',
      )
      mocks.expandRuntimeDsl.mockReturnValue(
        [
          'glass',
          '@with(glass)',
        ].join('\n'),
      )
      mocks.resolveThemeReferences.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.resolveHelpers.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.finalizeCoreCssOutput.mockImplementation(
        (value: string) =>
          value,
      )
      const result =
        transformCss(
          'source',
          [],
        )
      expect(result).toContain(
        'color:red;',
      )
      expect(result).not.toContain(
        '@with(',
      )
    })
    it('does not mutate the warning array when no transform emits diagnostics', () => {
      const existing = {
        code: 'existing',
        message:
          'Existing warning',
      } as CipoWarning
      const warnings = [
        existing,
      ]
      transformCss(
        'source',
        warnings,
      )
      expect(warnings[0]).toBe(
        existing,
      )
    })
  })
  describe('stripComments', () => {
    it('delegates comment stripping to the CSS lexer', () => {
      mocks.stripCipoComments.mockReturnValue(
        'color:red;',
      )
      expect(
        stripComments(
          '/* comment */ color:red;',
        ),
      ).toBe(
        'color:red;',
      )
      expect(
        mocks.stripCipoComments,
      ).toHaveBeenCalledWith(
        '/* comment */ color:red;',
      )
    })
  })
  describe('getStandaloneAliasName', () => {
    it.each([
      [
        'glass',
        'glass',
      ],
      [
        'buttonBase',
        'buttonBase',
      ],
      [
        '_private',
        '_private',
      ],
      [
        'alias-name',
        'alias-name',
      ],
      [
        '$glass',
        'glass',
      ],
      [
        '$buttonBase;',
        'buttonBase',
      ],
      [
        '  glass  ',
        'glass',
      ],
      [
        ' glass; ',
        'glass',
      ],
    ])(
      'extracts standalone alias from %j',
      (
        source,
        expected,
      ) => {
        expect(
          getStandaloneAliasName(
            source,
          ),
        ).toBe(expected)
      },
    )
    it.each([
      '',
      '$',
      '123alias',
      '-alias',
      'color:red',
      'bg(red)',
      'glass extra',
      '.selector',
      '#id',
      'glass{}',
    ])(
      'rejects non-standalone alias syntax %j',
      (source) => {
        expect(
          getStandaloneAliasName(
            source,
          ),
        ).toBe('')
      },
    )
  })
  describe('expandStandaloneAliases', () => {
    it('expands a registered standalone alias', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        expandStandaloneAliases(
          'glass',
          [],
        ),
      ).toBe(
        'background:blur;\n',
      )
    })
    it('expands dollar-prefixed standalone aliases', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        expandStandaloneAliases(
          '$glass',
          [],
        ),
      ).toBe(
        'background:blur;\n',
      )
    })
    it('preserves unregistered standalone identifiers', () => {
      expect(
        expandStandaloneAliases(
          'unknown',
          [],
        ),
      ).toBe(
        'unknown',
      )
    })
    it('does not interpret declarations as alias names', () => {
      mocks.runtime.aliasRegistry.set(
        'color',
        'display:none;',
      )
      expect(
        expandStandaloneAliases(
          'color:red;',
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('does not interpret function calls as standalone aliases', () => {
      mocks.runtime.aliasRegistry.set(
        'bg',
        'display:none;',
      )
      expect(
        expandStandaloneAliases(
          'bg(red);',
          [],
        ),
      ).toBe(
        'bg(red);',
      )
    })
    it('preserves indentation when expanding an alias', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        expandStandaloneAliases(
          '    glass\n',
          [],
        ),
      ).toBe(
        '    background:blur;\n',
      )
    })
    it('expands multiple aliases in source order', () => {
      mocks.runtime.aliasRegistry.set(
        'first',
        'a:1;',
      )
      mocks.runtime.aliasRegistry.set(
        'second',
        'b:2;',
      )
      expect(
        expandStandaloneAliases(
          'first\nsecond',
          [],
        ),
      ).toBe(
        [
          'a:1;',
          'b:2;',
          '',
        ].join('\n'),
      )
    })
    it('expands semicolon-terminated standalone aliases', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'color:red;',
      )
      expect(
        expandStandaloneAliases(
          'glass;',
          [],
        ),
      ).toBe(
        'color:red;\n',
      )
    })
    it('does not split a standalone statement at semicolons inside parentheses', () => {
      mocks.runtime.aliasRegistry.set(
        'fn',
        'color:red;',
      )
      const input =
        'background:url("data:image/svg+xml;a;b");'
      expect(
        expandStandaloneAliases(
          input,
          [],
        ),
      ).toBe(input)
    })
    it('does not split a statement at semicolons inside quoted strings', () => {
      const input =
        'content:"a;b;c";'
      expect(
        expandStandaloneAliases(
          input,
          [],
        ),
      ).toBe(input)
    })
    it('does not recursively rescan the entire source when one alias expands to another', () => {
      mocks.runtime.aliasRegistry.set(
        'first',
        'second',
      )
      mocks.runtime.aliasRegistry.set(
        'second',
        'color:red;',
      )
      expect(
        expandStandaloneAliases(
          'first',
          [],
        ),
      ).toBe(
        'color:red;\n',
      )
    })
    it('leaves surrounding ordinary declarations untouched', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        expandStandaloneAliases(
          [
            'color:red;',
            'glass',
            'display:block;',
          ].join('\n'),
          [],
        ),
      ).toBe([
        'color:red;',
        'background:blur;',
        'display:block;',
      ].join('\n'))
    })
  })
  describe('stringifyAlias', () => {
    it('returns an empty string for an unknown alias', () => {
      expect(
        stringifyAlias(
          'unknown',
          [],
        ),
      ).toBe('')
    })
    it('returns a registered string alias', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        stringifyAlias(
          'glass',
          [],
        ),
      ).toBe(
        'background:blur;',
      )
    })
    it('serializes style-object aliases', () => {
      const style = {
        color: 'red',
      } as CipoStyleObject
      mocks.runtime.aliasRegistry.set(
        'button',
        style,
      )
      mocks.styleObjectToCss.mockReturnValue(
        'color:red;',
      )
      expect(
        stringifyAlias(
          'button',
          [],
        ),
      ).toBe(
        'color:red;',
      )
      expect(
        mocks.styleObjectToCss,
      ).toHaveBeenCalledWith(
        style,
      )
    })
    it('evaluates function-backed aliases lazily', () => {
      const factory = vi.fn(
        () =>
          'color:red;',
      )
      mocks.runtime.aliasRegistry.set(
        'dynamic',
        factory,
      )
      expect(
        stringifyAlias(
          'dynamic',
          [],
        ),
      ).toBe(
        'color:red;',
      )
      expect(factory).toHaveBeenCalledTimes(
        1,
      )
    })
    it('supports function-backed style-object aliases', () => {
      const style = {
        display: 'grid',
      } as CipoStyleObject
      mocks.runtime.aliasRegistry.set(
        'layout',
        () => style,
      )
      mocks.styleObjectToCss.mockReturnValue(
        'display:grid;',
      )
      expect(
        stringifyAlias(
          'layout',
          [],
        ),
      ).toBe(
        'display:grid;',
      )
    })
    it('recursively expands aliases contained in another alias', () => {
      mocks.runtime.aliasRegistry.set(
        'base',
        'display:block;',
      )
      mocks.runtime.aliasRegistry.set(
        'button',
        [
          'base',
          'color:red;',
        ].join('\n'),
      )
      expect(
        stringifyAlias(
          'button',
          [],
        ),
      ).toBe([
        'display:block;',
        'color:red;',
      ].join('\n'))
    })
    it('expands deeply nested alias chains', () => {
      mocks.runtime.aliasRegistry.set(
        'a',
        'b',
      )
      mocks.runtime.aliasRegistry.set(
        'b',
        'c',
      )
      mocks.runtime.aliasRegistry.set(
        'c',
        'color:red;',
      )
      expect(
        stringifyAlias(
          'a',
          [],
        ),
      ).toBe(
        'color:red;\n',
      )
    })
    it('detects direct alias cycles', () => {
      mocks.runtime.aliasRegistry.set(
        'cycle',
        'cycle',
      )
      const warnings:
        CipoWarning[] = []
      expect(
        stringifyAlias(
          'cycle',
          warnings,
        ),
      ).toBe('\n')
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'cyclic-alias',
        'Alias "cycle" expands into itself.',
        'cycle',
      )
    })
    it('detects indirect alias cycles', () => {
      mocks.runtime.aliasRegistry.set(
        'first',
        'second',
      )
      mocks.runtime.aliasRegistry.set(
        'second',
        'third',
      )
      mocks.runtime.aliasRegistry.set(
        'third',
        'first',
      )
      const warnings:
        CipoWarning[] = []
      stringifyAlias(
        'first',
        warnings,
      )
      expect(
        mocks.warn,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'cyclic-alias',
        expect.stringContaining(
          'expands into itself',
        ),
        'first',
      )
    })
    it('does not treat repeated sibling aliases as a cycle after stack unwinding', () => {
      mocks.runtime.aliasRegistry.set(
        'shared',
        'color:red;',
      )
      mocks.runtime.aliasRegistry.set(
        'combined',
        [
          'shared',
          'shared',
        ].join('\n'),
      )
      const warnings:
        CipoWarning[] = []
      const result =
        stringifyAlias(
          'combined',
          warnings,
        )
      expect(result).toContain(
        'color:red;',
      )
      expect(
        mocks.warn,
      ).not.toHaveBeenCalled()
    })
    it('adds a semicolon to non-alias declaration text without one inside an alias body', () => {
      mocks.runtime.aliasRegistry.set(
        'button',
        'color:red',
      )
      expect(
        stringifyAlias(
          'button',
          [],
        ),
      ).toBe(
        'color:red;',
      )
    })
    it('does not append a semicolon after block syntax', () => {
      mocks.runtime.aliasRegistry.set(
        'responsive',
        '@media print{color:black;}',
      )
      expect(
        stringifyAlias(
          'responsive',
          [],
        ),
      ).toBe(
        '@media print{color:black;}',
      )
    })
  })
  describe('expandWithCompat', () => {
    it('converts a legacy function argument to declaration syntax', () => {
      expect(
        expandWithCompat(
          '@with(bg(red))',
          [],
        ),
      ).toBe(
        'bg:red;',
      )
    })
    it('converts multiple function arguments in order', () => {
      expect(
        expandWithCompat(
          '@with(bg(red), px(4), display(grid))',
          [],
        ),
      ).toBe(
        'bg:red;px:4;display:grid;',
      )
    })
    it('preserves nested commas inside function arguments', () => {
      expect(
        expandWithCompat(
          '@with(background(linear-gradient(red, blue)), shadow(0 0 4px rgba(0, 0, 0, .2)))',
          [],
        ),
      ).toBe(
        'background:linear-gradient(red,blue);shadow:0 0 4px rgba(0,0,0,.2);',
      )
    })
    it('expands registered standalone aliases used inside @with', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        expandWithCompat(
          '@with(glass)',
          [],
        ),
      ).toBe(
        'background:blur;',
      )
    })
    it('expands dollar-prefixed registered aliases inside @with', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      expect(
        expandWithCompat(
          '@with($glass)',
          [],
        ),
      ).toBe(
        'background:blur;',
      )
    })
    it('preserves unknown non-call arguments as declarations with a semicolon', () => {
      expect(
        expandWithCompat(
          '@with(custom-value)',
          [],
        ),
      ).toBe(
        'custom-value;',
      )
    })
    it('removes an optional semicolon following @with()', () => {
      expect(
        expandWithCompat(
          'before;@with(bg(red));after;',
          [],
        ),
      ).toBe(
        'before;bg:red;after;',
      )
    })
    it('preserves source surrounding multiple @with calls', () => {
      expect(
        expandWithCompat(
          'a;@with(bg(red));b;@with(px(4));c;',
          [],
        ),
      ).toBe(
        'a;bg:red;b;px:4;c;',
      )
    })
    it('handles an empty @with argument list', () => {
      expect(
        expandWithCompat(
          'before;@with();after;',
          [],
        ),
      ).toBe(
        'before;after;',
      )
    })
    it('preserves an incomplete @with token without an opening parenthesis', () => {
      expect(
        expandWithCompat(
          'before;@with',
          [],
        ),
      ).toBe(
        'before;@with',
      )
    })
    it('warns and preserves source for an unclosed @with call', () => {
      const warnings:
        CipoWarning[] = []
      const input =
        'before;@with(bg(red)'
      const result =
        expandWithCompat(
          input,
          warnings,
        )
      expect(result).toBe(input)
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'invalid-with',
        '@with(...) is missing a closing parenthesis.',
        '@with(bg(red)',
      )
    })
    it('does not mutate the global important or alias configuration while expanding compatibility syntax', () => {
      mocks.runtime.aliasRegistry.set(
        'glass',
        'color:red;',
      )
      const entriesBefore = [
        ...mocks.runtime.aliasRegistry.entries(),
      ]
      expandWithCompat(
        '@with(glass)',
        [],
      )
      expect(
        [
          ...mocks.runtime.aliasRegistry.entries(),
        ],
      ).toEqual(
        entriesBefore,
      )
    })
  })
  describe('pipeline integration', () => {
    it('can build CSS and then transform the resulting source', () => {
      mocks.stripCipoComments.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.prepareCoreCssInput.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.expandRuntimeDsl.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.resolveThemeReferences.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.resolveHelpers.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.finalizeCoreCssOutput.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.runtime.aliasRegistry.set(
        'glass',
        'background:blur;',
      )
      const raw =
        buildCss(
          template(
            '',
            '\nglass',
          ),
          [
            'color:red;',
          ],
        )
      expect(
        transformCss(
          raw,
          [],
        ),
      ).toBe([
        'color:red;',
        'background:blur;',
        '',
      ].join('\n'))
    })
    it('resolves aliases introduced by runtime DSL expansion before theme/helper resolution', () => {
      mocks.stripCipoComments.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.prepareCoreCssInput.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.expandRuntimeDsl.mockReturnValue(
        'glass',
      )
      mocks.runtime.aliasRegistry.set(
        'glass',
        'color:$brand;',
      )
      mocks.resolveThemeReferences.mockImplementation(
        (value: string) =>
          value.replace(
            '$brand',
            '#ff0000',
          ),
      )
      mocks.resolveHelpers.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.finalizeCoreCssOutput.mockImplementation(
        (value: string) =>
          value,
      )
      expect(
        transformCss(
          'runtime-feature',
          [],
        ),
      ).toBe(
        'color:#ff0000;\n',
      )
    })
    it('resolves helpers only after theme references have been processed', () => {
      mocks.stripCipoComments.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.prepareCoreCssInput.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.expandRuntimeDsl.mockImplementation(
        (value: string) =>
          value,
      )
      mocks.resolveThemeReferences.mockImplementation(
        (value: string) =>
          value.replace(
            '$brand',
            '#ff0000',
          ),
      )
      mocks.resolveHelpers.mockImplementation(
        (value: string) => {
          expect(value).toContain(
            '#ff0000',
          )
          return value.replace(
            'alpha(#ff0000 / 20%)',
            'rgba(255 0 0 / .2)',
          )
        },
      )
      mocks.finalizeCoreCssOutput.mockImplementation(
        (value: string) =>
          value,
      )
      expect(
        transformCss(
          'color:alpha($brand / 20%);',
          [],
        ),
      ).toBe(
        'color:rgba(255 0 0 / .2);',
      )
    })
  })
  describe('regression contracts', () => {
    it(
      'expandWithCompat ignores @with text inside quoted CSS strings and comments',
      () => {
        const input = 'content:"@with(bg(red))";/* @with(bg(blue)) */'
        expect(expandWithCompat(input, [])).toBe(input)
      },
    )
    it(
      'expandWithCompat validates that @with is a standalone directive boundary instead of matching identifiers such as custom@with(...)',
      () => {
        const input = 'custom@with(bg(red));'
        expect(expandWithCompat(input, [])).toBe(input)
      },
    )
    it(
      'readTopLevelStatement treats CSS comments as opaque lexical content when semicolons or newlines occur inside comments',
      () => {
        mocks.runtime.aliasRegistry.set('glass', 'color:red')
        const input = `/* glass;\n glass */\nbutton{color:blue;}`
        expect(expandStandaloneAliases(input, [])).toBe(input)
      },
    )
    it(
      'readTopLevelStatement and findMatchingParen use escape parity instead of checking only the immediately preceding backslash',
      () => {
        const input = String.raw`content:"x\\";@with(bg(red))`
        expect(expandWithCompat(input, [])).toContain('background:red;')
      },
    )
    it(
      'alias expansion understands braces so standalone-looking lines inside arbitrary native CSS blocks cannot be misclassified when the transform is given full stylesheet text',
      () => {
        mocks.runtime.aliasRegistry.set('glass', 'color:red')
        const input = `.native{\n  glass;\n}`
        expect(expandStandaloneAliases(input, [])).toBe(input)
      },
    )
    it(
      'cyclic alias expansion does not leave an incidental newline as the serialized cycle result',
      () => {
        mocks.runtime.aliasRegistry.set('first', 'second')
        mocks.runtime.aliasRegistry.set('second', 'first')
        expect(stringifyAlias('first')).toBe('')
      },
    )
  })
})
function template(
  ...parts: string[]
): TemplateStringsArray {
  const strings =
    [...parts] as unknown as TemplateStringsArray
  Object.defineProperty(
    strings,
    'raw',
    {
      value: [
        ...parts,
      ],
    },
  )
  return strings
}
