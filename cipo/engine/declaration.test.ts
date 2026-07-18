import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoAtomicRule,
  CipoDeclarationNode,
  CipoRuleContext,
} from '../types'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      breakpoints: {} as Record<string, string | null>,
    },
  },
  createAtomicRule: vi.fn(),
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('./atomic/rule', () => ({
  createAtomicRule: mocks.createAtomicRule,
}))
import {
  collectDeclaration,
  expandResponsiveDeclaration,
  resolveBreakpointContext,
} from './declaration'
describe('declaration collector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config.breakpoints = {
      base: null,
      sm: '(min-width: 640px)',
      md: '(min-width: 768px)',
      lg: '(min-width: 1024px)',
    }
    mocks.createAtomicRule.mockImplementation(
      (
        declaration: CipoDeclarationNode,
        context: CipoRuleContext,
        forceImportant: boolean,
      ) =>
        ({
          id: `${declaration.property}:${declaration.value}`,
          className: 'atomic',
          property: declaration.property,
          value: declaration.value,
          context,
          important: forceImportant,
        }) as CipoAtomicRule,
    )
  })
  describe('collectDeclaration', () => {
    it('collects a normal declaration as one atomic rule', () => {
      const declaration = createDeclaration(
        'color',
        'red',
      )
      const context: CipoRuleContext = {
        dark: true,
      }
      const atoms: CipoAtomicRule[] = []
      collectDeclaration(
        declaration,
        context,
        atoms,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenCalledWith(
        declaration,
        context,
        false,
      )
      expect(atoms).toHaveLength(1)
      expect(atoms[0]).toMatchObject({
        property: 'color',
        value: 'red',
        context,
        important: false,
      })
    })
    it('forwards forceImportant for a normal declaration', () => {
      const declaration = createDeclaration(
        'color',
        'red',
      )
      collectDeclaration(
        declaration,
        {},
        [],
        true,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenCalledWith(
        declaration,
        {},
        true,
      )
    })
    it('expands responsive declarations into one atomic rule per responsive item', () => {
      const declaration = createDeclaration(
        'padding',
        '1rem, x:md(2rem), x:lg(3rem)',
      )
      const atoms: CipoAtomicRule[] = []
      collectDeclaration(
        declaration,
        {},
        atoms,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenCalledTimes(3)
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          property: 'padding',
          value: '1rem',
          source: 'padding:1rem',
        }),
        {},
        false,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          property: 'padding',
          value: '2rem',
          source: 'padding:2rem',
        }),
        {
          breakpoint: 'md',
          mediaQuery: '(min-width: 768px)',
        },
        false,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          property: 'padding',
          value: '3rem',
          source: 'padding:3rem',
        }),
        {
          breakpoint: 'lg',
          mediaQuery: '(min-width: 1024px)',
        },
        false,
      )
      expect(
        atoms.map((atom) => atom.value),
      ).toEqual([
        '1rem',
        '2rem',
        '3rem',
      ])
    })
    it('preserves the parent context while applying responsive breakpoint context', () => {
      const declaration = createDeclaration(
        'gap',
        'x:md(2rem)',
      )
      const context: CipoRuleContext = {
        dark: true,
        pseudo: ':hover',
        layer: 'components',
      }
      const atoms: CipoAtomicRule[] = []
      collectDeclaration(
        declaration,
        context,
        atoms,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '2rem',
        }),
        {
          dark: true,
          pseudo: ':hover',
          layer: 'components',
          breakpoint: 'md',
          mediaQuery: '(min-width: 768px)',
        },
        false,
      )
    })
    it('forwards forceImportant to every atom produced by responsive expansion', () => {
      const declaration = createDeclaration(
        'padding',
        '1rem, x:md(2rem)',
      )
      collectDeclaration(
        declaration,
        {},
        [],
        true,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenCalledTimes(2)
      for (
        const call
        of mocks.createAtomicRule.mock.calls
      ) {
        expect(call[2]).toBe(true)
      }
    })
    it('does not mutate the original declaration during responsive expansion', () => {
      const declaration = createDeclaration(
        'padding',
        '1rem, x:md(2rem)',
        'original-source',
      )
      const snapshot = {
        ...declaration,
      }
      collectDeclaration(
        declaration,
        {},
        [],
      )
      expect(declaration).toEqual(snapshot)
      expect(declaration.value).toBe(
        '1rem, x:md(2rem)',
      )
      expect(declaration.source).toBe(
        'original-source',
      )
    })
    it('generates normalized declaration source for every expanded item', () => {
      const declaration = createDeclaration(
        'margin',
        '  1rem  , x:md( 2rem ) ',
        'margin:original',
      )
      collectDeclaration(
        declaration,
        {},
        [],
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          value: '1rem',
          source: 'margin:1rem',
        }),
        {},
        false,
      )
      expect(
        mocks.createAtomicRule,
      ).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          value: '2rem',
          source: 'margin:2rem',
        }),
        {
          breakpoint: 'md',
          mediaQuery: '(min-width: 768px)',
        },
        false,
      )
    })
    it('preserves the source order of base and responsive values', () => {
      const declaration = createDeclaration(
        'font-size',
        'x:lg(3rem), 1rem, x:md(2rem)',
      )
      collectDeclaration(
        declaration,
        {},
        [],
      )
      expect(
        mocks.createAtomicRule.mock.calls.map(
          ([declaration]) =>
            (declaration as CipoDeclarationNode).value,
        ),
      ).toEqual([
        '3rem',
        '1rem',
        '2rem',
      ])
    })
  })
  describe('expandResponsiveDeclaration', () => {
    it('returns null when the declaration contains no responsive values', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            '1rem',
          ),
        ),
      ).toBeNull()
    })
    it('returns null for an ordinary comma-separated CSS value', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'font-family',
            'Inter, Arial, sans-serif',
          ),
        ),
      ).toBeNull()
    })
    it('does not split commas nested inside CSS functions', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'width',
            'clamp(10rem, 50vw, 80rem)',
          ),
        ),
      ).toBeNull()
    })
    it('preserves nested comma-separated CSS functions inside responsive values', () => {
      const result =
        expandResponsiveDeclaration(
          createDeclaration(
            'width',
            '100%, x:md(clamp(20rem, 50vw, 60rem))',
          ),
        )
      expect(result).toEqual([
        {
          breakpoint: 'base',
          value: '100%',
        },
        {
          breakpoint: 'md',
          value:
            'clamp(20rem, 50vw, 60rem)',
        },
      ])
    })
    it('expands a single configured responsive value', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            'x:md(2rem)',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'md',
          value: '2rem',
        },
      ])
    })
    it('trims breakpoint values during expansion', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            'x:md(   2rem   )',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'md',
          value: '2rem',
        },
      ])
    })
    it('preserves ordinary values as base entries once any responsive value is present', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            '1rem, x:md(2rem), 3rem',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'base',
          value: '1rem',
        },
        {
          breakpoint: 'md',
          value: '2rem',
        },
        {
          breakpoint: 'base',
          value: '3rem',
        },
      ])
    })
    it('treats an unknown breakpoint expression as an ordinary base value', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            '1rem, x:unknown(2rem), x:md(3rem)',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'base',
          value: '1rem',
        },
        {
          breakpoint: 'base',
          value: 'x:unknown(2rem)',
        },
        {
          breakpoint: 'md',
          value: '3rem',
        },
      ])
    })
    it('returns null when all x: expressions reference unknown breakpoints', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            'x:tablet(2rem), x:desktop(4rem)',
          ),
        ),
      ).toBeNull()
    })
    it('accepts breakpoint names containing digits and hyphens after the initial letter', () => {
      mocks.runtime.config.breakpoints = {
        'md-2xl': '(min-width: 1536px)',
        mobile2: '(min-width: 480px)',
      }
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            'x:md-2xl(4rem), x:mobile2(2rem)',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'md-2xl',
          value: '4rem',
        },
        {
          breakpoint: 'mobile2',
          value: '2rem',
        },
      ])
    })
    it('rejects responsive syntax whose breakpoint name does not start with a letter', () => {
      mocks.runtime.config.breakpoints = {
        _private: '(min-width: 1px)',
        '2xl': '(min-width: 1536px)',
      }
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            'x:_private(2rem), x:2xl(4rem)',
          ),
        ),
      ).toBeNull()
    })
    it('recognizes a configured base breakpoint even when its media query is null', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'padding',
            'x:base(1rem)',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'base',
          value: '1rem',
        },
      ])
    })
    it('uses breakpoint key presence rather than media-query truthiness when detecting responsive syntax', () => {
      mocks.runtime.config.breakpoints = {
        print: '',
      }
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'display',
            'x:print(none)',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'print',
          value: 'none',
        },
      ])
    })
    it('does not mistake x: syntax embedded inside a larger CSS value for a responsive item', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'content',
            '"x:md(hello)"',
          ),
        ),
      ).toBeNull()
    })
    it('does not match trailing tokens after the responsive closing parenthesis', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'transform',
            'x:md(scale(1)) rotate(2deg)',
          ),
        ),
      ).toBeNull()
    })
    it('handles nested parentheses inside responsive values', () => {
      expect(
        expandResponsiveDeclaration(
          createDeclaration(
            'transform',
            'x:md(calc(100% - var(--gap)))',
          ),
        ),
      ).toEqual([
        {
          breakpoint: 'md',
          value:
            'calc(100% - var(--gap))',
        },
      ])
    })
    it('is deterministic across repeated expansion calls', () => {
      const declaration = createDeclaration(
        'padding',
        '1rem, x:md(2rem), x:lg(4rem)',
      )
      const first =
        expandResponsiveDeclaration(
          declaration,
        )
      const second =
        expandResponsiveDeclaration(
          declaration,
        )
      expect(second).toEqual(first)
      expect(second).not.toBe(first)
    })
  })
  describe('resolveBreakpointContext', () => {
    it('adds breakpoint and media-query information for a configured breakpoint', () => {
      const context: CipoRuleContext = {
        dark: true,
        pseudo: ':hover',
      }
      expect(
        resolveBreakpointContext(
          context,
          'md',
        ),
      ).toEqual({
        dark: true,
        pseudo: ':hover',
        breakpoint: 'md',
        mediaQuery:
          '(min-width: 768px)',
      })
    })
    it('does not mutate the original context', () => {
      const context: CipoRuleContext = {
        dark: true,
      }
      const result =
        resolveBreakpointContext(
          context,
          'md',
        )
      expect(context).toEqual({
        dark: true,
      })
      expect(result).not.toBe(context)
    })
    it('returns the original context object when the breakpoint has no media query', () => {
      const context: CipoRuleContext = {
        dark: true,
      }
      const result =
        resolveBreakpointContext(
          context,
          'base',
        )
      expect(result).toBe(context)
    })
    it('returns the original context object for an unknown breakpoint', () => {
      const context: CipoRuleContext = {
        layer: 'components',
      }
      const result =
        resolveBreakpointContext(
          context,
          'unknown',
        )
      expect(result).toBe(context)
    })
    it('returns the original context when the configured media-query value is an empty string', () => {
      mocks.runtime.config.breakpoints = {
        print: '',
      }
      const context: CipoRuleContext = {
        dark: true,
      }
      expect(
        resolveBreakpointContext(
          context,
          'print',
        ),
      ).toBe(context)
    })
    it('overrides an existing breakpoint context when applying a new configured breakpoint', () => {
      const context: CipoRuleContext = {
        breakpoint: 'sm',
        mediaQuery:
          '(min-width: 640px)',
        dark: true,
      }
      expect(
        resolveBreakpointContext(
          context,
          'lg',
        ),
      ).toEqual({
        breakpoint: 'lg',
        mediaQuery:
          '(min-width: 1024px)',
        dark: true,
      })
    })
  })
  describe('responsive declaration integration', () => {
    it('keeps base values unscoped while assigning breakpoint context only to responsive values', () => {
      const declaration = createDeclaration(
        'margin',
        '1rem, x:md(2rem), 3rem, x:lg(4rem)',
      )
      const atoms: CipoAtomicRule[] = []
      collectDeclaration(
        declaration,
        {
          dark: true,
        },
        atoms,
      )
      expect(
        atoms.map(
          (atom) => ({
            value: atom.value,
            context: atom.context,
          }),
        ),
      ).toEqual([
        {
          value: '1rem',
          context: {
            dark: true,
          },
        },
        {
          value: '2rem',
          context: {
            dark: true,
            breakpoint: 'md',
            mediaQuery:
              '(min-width: 768px)',
          },
        },
        {
          value: '3rem',
          context: {
            dark: true,
          },
        },
        {
          value: '4rem',
          context: {
            dark: true,
            breakpoint: 'lg',
            mediaQuery:
              '(min-width: 1024px)',
          },
        },
      ])
    })
    it('expands configured responsive values while retaining unknown x: expressions literally as base CSS', () => {
      const declaration = createDeclaration(
        'padding',
        'x:future(10rem), x:md(2rem)',
      )
      const atoms: CipoAtomicRule[] = []
      collectDeclaration(
        declaration,
        {},
        atoms,
      )
      expect(
        atoms.map(
          (atom) => ({
            value: atom.value,
            context: atom.context,
          }),
        ),
      ).toEqual([
        {
          value: 'x:future(10rem)',
          context: {},
        },
        {
          value: '2rem',
          context: {
            breakpoint: 'md',
            mediaQuery:
              '(min-width: 768px)',
          },
        },
      ])
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'defines whether a configured null breakpoint such as x:base() should explicitly annotate context.breakpoint instead of returning the unchanged context',
    )
    it.todo(
      'defines whether empty configured media queries should be considered valid breakpoint contexts rather than collapsing to the parent context',
    )
    it.todo(
      'emits a warning or diagnostic for unknown x:breakpoint() syntax instead of preserving it as ordinary CSS when another responsive item activates expansion',
    )
  })
})
function createDeclaration(
  property: string,
  value: string,
  source = `${property}:${value}`,
): CipoDeclarationNode {
  return {
    type: 'declaration',
    property,
    value,
    source,
  } as CipoDeclarationNode
}
