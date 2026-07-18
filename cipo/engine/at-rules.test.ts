import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoAstNode,
  CipoAtomicRule,
  CipoDeclarationNode,
  CipoRuleContext,
  CipoScopedRule,
  CipoWarning,
} from '../types'
const mocks = vi.hoisted(() => {
  const runtime = {
    config: {
      breakpoints: {} as Record<string, string | null>,
    },
    variantRegistry: new Map<string, string[]>(),
  }
  return {
    runtime,
    warn: vi.fn(),
    parseDeclarations: vi.fn(),
    expandWithCompat: vi.fn(),
    collectDeclaration: vi.fn(),
    resolveBreakpointContext: vi.fn(
      (
        context: CipoRuleContext,
        breakpoint: string,
      ): CipoRuleContext => ({
        ...context,
        breakpoint,
      }),
    ),
    resolveScopedSelector: vi.fn(
      (
        scopeClassName: string,
        selector: string,
        context: CipoRuleContext,
      ) => {
        const normalizedSelector = selector || '&'
        return [
          scopeClassName,
          normalizedSelector,
          JSON.stringify(context),
        ].join('|')
      },
    ),
    isCipoPseudoName: vi.fn(
      (name: string) =>
        new Set([
          'hover',
          'focus',
          'active',
          'disabled',
          'checked',
        ]).has(name),
    ),
  }
})
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../utils', () => ({
  warn: mocks.warn,
}))
vi.mock('../syntax/parser', () => ({
  parseDeclarations: mocks.parseDeclarations,
}))
vi.mock('../transform/index', () => ({
  expandWithCompat: mocks.expandWithCompat,
}))
vi.mock('./declaration', () => ({
  collectDeclaration: mocks.collectDeclaration,
  resolveBreakpointContext:
    mocks.resolveBreakpointContext,
}))
vi.mock('./selector', () => ({
  resolveScopedSelector:
    mocks.resolveScopedSelector,
}))
vi.mock('./pseudos', () => ({
  isCipoPseudoName:
    mocks.isCipoPseudoName,
}))
import {
  collect,
  collectBlock,
  collectRules,
  isDeclarationNode,
} from './at-rules'
describe('atomic/component at-rule collector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config.breakpoints = {}
    mocks.runtime.variantRegistry.clear()
    mocks.resolveBreakpointContext.mockImplementation(
      (
        context: CipoRuleContext,
        breakpoint: string,
      ): CipoRuleContext => ({
        ...context,
        breakpoint,
      }),
    )
    mocks.resolveScopedSelector.mockImplementation(
      (
        scopeClassName: string,
        selector: string,
        context: CipoRuleContext,
      ) => [
        scopeClassName,
        selector || '&',
        JSON.stringify(context),
      ].join('|'),
    )
    mocks.isCipoPseudoName.mockImplementation(
      (name: string) =>
        new Set([
          'hover',
          'focus',
          'active',
          'disabled',
          'checked',
        ]).has(name),
    )
  })
  describe('collectRules', () => {
    it('creates fresh atomic and scoped rule collections and delegates AST traversal', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      mocks.collectDeclaration.mockImplementation(
        (
          node: CipoDeclarationNode,
          context: CipoRuleContext,
          atoms: CipoAtomicRule[],
        ) => {
          atoms.push(
            createAtomicRule(
              node.property,
              node.value,
              context,
            ),
          )
        },
      )
      const warnings: CipoWarning[] = []
      const result = collectRules(
        [declaration],
        'scope-button',
        warnings,
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {},
        expect.any(Array),
        false,
      )
      expect(result.atoms).toHaveLength(1)
      expect(result.scopedRules).toEqual([])
    })
    it('forwards forceImportant to declaration collection', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      collectRules(
        [declaration],
        'scope',
        [],
        true,
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {},
        expect.any(Array),
        true,
      )
    })
    it('returns independent result arrays across calls', () => {
      const first = collectRules(
        [],
        'first',
        [],
      )
      const second = collectRules(
        [],
        'second',
        [],
      )
      expect(first.atoms).not.toBe(
        second.atoms,
      )
      expect(
        first.scopedRules,
      ).not.toBe(
        second.scopedRules,
      )
    })
  })
  describe('collect', () => {
    it('delegates declaration nodes with the active rule context', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      const context: CipoRuleContext = {
        dark: true,
      }
      const atoms: CipoAtomicRule[] = []
      const scopedRules:
        CipoScopedRule[] = []
      collect(
        [declaration],
        context,
        atoms,
        scopedRules,
        [],
        'scope',
        true,
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        context,
        atoms,
        true,
      )
    })
    it('expands @with directives and recursively collects their parsed declarations', () => {
      const expandedDeclaration =
        createDeclaration(
          'display',
          'flex',
        )
      mocks.expandWithCompat.mockReturnValue(
        'display:flex;',
      )
      mocks.parseDeclarations.mockReturnValue([
        expandedDeclaration,
      ])
      const warnings: CipoWarning[] = []
      const context: CipoRuleContext = {
        dark: true,
      }
      collect(
        [
          createDirective(
            'with',
            [
              'center',
              'gap(2)',
            ],
          ),
        ],
        context,
        [],
        [],
        warnings,
        'scope',
        true,
      )
      expect(
        mocks.expandWithCompat,
      ).toHaveBeenCalledWith(
        '@with(center,gap(2));',
        warnings,
      )
      expect(
        mocks.parseDeclarations,
      ).toHaveBeenCalledWith(
        'display:flex;',
        warnings,
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        expandedDeclaration,
        context,
        expect.any(Array),
        true,
      )
    })
    it('ignores directives other than @with', () => {
      collect(
        [
          createDirective(
            'unknown',
            ['value'],
          ),
        ],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.expandWithCompat,
      ).not.toHaveBeenCalled()
      expect(
        mocks.parseDeclarations,
      ).not.toHaveBeenCalled()
      expect(
        mocks.collectDeclaration,
      ).not.toHaveBeenCalled()
    })
    it('preserves node traversal order across declarations and blocks', () => {
      const first =
        createDeclaration(
          'color',
          'red',
        )
      const nested =
        createDeclaration(
          'display',
          'block',
        )
      const last =
        createDeclaration(
          'padding',
          '8px',
        )
      const calls: string[] = []
      mocks.collectDeclaration.mockImplementation(
        (
          node: CipoDeclarationNode,
        ) => {
          calls.push(
            `${node.property}:${node.value}`,
          )
        },
      )
      collect(
        [
          first,
          createBlock(
            'reduce-motion',
            [nested],
          ),
          last,
        ],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(calls).toEqual([
        'color:red',
        'display:block',
        'padding:8px',
      ])
    })
  })
  describe('structural context blocks', () => {
    it('adds prefers-reduced-motion context for reduce-motion', () => {
      const declaration =
        createDeclaration(
          'animation',
          'none',
        )
      collectBlock(
        'reduce-motion',
        [declaration],
        {
          dark: true,
        },
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          dark: true,
          mediaQuery:
            '(prefers-reduced-motion: reduce)',
        },
        expect.any(Array),
        false,
      )
    })
    it('adds supports context while preserving an existing context', () => {
      const declaration =
        createDeclaration(
          'display',
          'grid',
        )
      collectBlock(
        'supports(display: grid)',
        [declaration],
        {
          dark: true,
        },
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          dark: true,
          supports:
            'display: grid',
        },
        expect.any(Array),
        false,
      )
    })
    it('adds layer context', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      collectBlock(
        'layer(components)',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          layer: 'components',
        },
        expect.any(Array),
        false,
      )
    })
    it('adds container context', () => {
      const declaration =
        createDeclaration(
          'display',
          'block',
        )
      collectBlock(
        'container(sidebar (width > 30rem))',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          container:
            'sidebar (width > 30rem)',
        },
        expect.any(Array),
        false,
      )
    })
    it('adds a negated breakpoint context for x:not()', () => {
      const declaration =
        createDeclaration(
          'display',
          'none',
        )
      collectBlock(
        'x:not(md)',
        [declaration],
        {
          dark: true,
        },
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          dark: true,
          notBreakpoint: 'md',
        },
        expect.any(Array),
        false,
      )
    })
  })
  describe('x: context composition', () => {
    it('resolves a configured breakpoint through resolveBreakpointContext', () => {
      mocks.runtime.config.breakpoints = {
        md: '(min-width: 768px)',
      }
      const declaration =
        createDeclaration(
          'display',
          'grid',
        )
      collectBlock(
        'x:md',
        [declaration],
        {
          dark: false,
        },
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.resolveBreakpointContext,
      ).toHaveBeenCalledWith(
        {
          dark: false,
        },
        'md',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          dark: false,
          breakpoint: 'md',
        },
        expect.any(Array),
        false,
      )
    })
    it('composes breakpoint, dark mode and pseudo context from one x: chain', () => {
      mocks.runtime.config.breakpoints = {
        md: '(min-width: 768px)',
      }
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      collectBlock(
        'x:md:dark:hover',
        [declaration],
        {
          layer: 'components',
        },
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          layer: 'components',
          breakpoint: 'md',
          dark: true,
          pseudo: ':hover',
        },
        expect.any(Array),
        false,
      )
    })
    it('supports motion-safe context', () => {
      const declaration =
        createDeclaration(
          'animation',
          'fade 1s',
        )
      collectBlock(
        'x:motion-safe',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          mediaQuery:
            '(prefers-reduced-motion: no-preference)',
        },
        expect.any(Array),
        false,
      )
    })
    it('supports motion-reduce context', () => {
      const declaration =
        createDeclaration(
          'animation',
          'none',
        )
      collectBlock(
        'x:motion-reduce',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          mediaQuery:
            '(prefers-reduced-motion: reduce)',
        },
        expect.any(Array),
        false,
      )
    })
    it('supports container-query context through x:cq()', () => {
      const declaration =
        createDeclaration(
          'display',
          'grid',
        )
      collectBlock(
        'x:cq(sidebar)',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          container: 'sidebar',
        },
        expect.any(Array),
        false,
      )
    })
    it('supports pseudo-only context', () => {
      const declaration =
        createDeclaration(
          'color',
          'blue',
        )
      collectBlock(
        'x:focus',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.isCipoPseudoName,
      ).toHaveBeenCalledWith(
        'focus',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          pseudo: ':focus',
        },
        expect.any(Array),
        false,
      )
    })
    it('ignores unknown x: parts while preserving recognized parts', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      collectBlock(
        'x:unknown:hover:also-unknown',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          pseudo: ':hover',
        },
        expect.any(Array),
        false,
      )
    })
    it('falls back to an ordinary scoped selector when no x: context part is recognized', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      const scopedRules:
        CipoScopedRule[] = []
      collectBlock(
        'x:not-a-real-context',
        [declaration],
        {},
        [],
        scopedRules,
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).not.toHaveBeenCalled()
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenCalledWith(
        'scope',
        'x:not-a-real-context',
        {},
      )
      expect(scopedRules).toEqual([
        {
          selector:
            'scope|x:not-a-real-context|{}',
          declarations: [
            declaration,
          ],
          context: {},
        },
      ])
    })
    it('lets the last pseudo in an x: chain replace an earlier pseudo', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      collectBlock(
        'x:hover:focus',
        [declaration],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          pseudo: ':focus',
        },
        expect.any(Array),
        false,
      )
    })
  })
  describe('registered variants', () => {
    it('expands a registered variant into one scoped rule per selector', () => {
      mocks.runtime.variantRegistry.set(
        'interactive',
        [
          '&:hover',
          '&:focus-visible',
        ],
      )
      const color =
        createDeclaration(
          'color',
          'red',
        )
      const nestedBlock =
        createBlock(
          '& span',
          [
            createDeclaration(
              'display',
              'block',
            ),
          ],
        )
      const scopedRules:
        CipoScopedRule[] = []
      const context: CipoRuleContext = {
        dark: true,
      }
      collectBlock(
        'interactive',
        [
          color,
          nestedBlock,
        ],
        context,
        [],
        scopedRules,
        [],
        'scope-button',
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenNthCalledWith(
        1,
        'scope-button',
        '&:hover',
        context,
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenNthCalledWith(
        2,
        'scope-button',
        '&:focus-visible',
        context,
      )
      expect(scopedRules).toEqual([
        {
          selector:
            'scope-button|&:hover|{"dark":true}',
          declarations: [
            color,
          ],
          context,
        },
        {
          selector:
            'scope-button|&:focus-visible|{"dark":true}',
          declarations: [
            color,
          ],
          context,
        },
      ])
      // Registered variants intentionally collect only direct declarations;
      // nested blocks must not be serialized as declarations accidentally.
      expect(
        scopedRules.every(
          (rule) =>
            rule.declarations.length === 1,
        ),
      ).toBe(true)
    })
    it('emits no variant rules when a registered variant has an empty selector list', () => {
      mocks.runtime.variantRegistry.set(
        'empty',
        [],
      )
      const scopedRules:
        CipoScopedRule[] = []
      collectBlock(
        'empty',
        [
          createDeclaration(
            'color',
            'red',
          ),
        ],
        {},
        [],
        scopedRules,
        [],
        'scope',
      )
      expect(scopedRules).toEqual([])
      expect(
        mocks.resolveScopedSelector,
      ).not.toHaveBeenCalled()
    })
    it('gives registered variants precedence over ordinary scoped selector fallback', () => {
      mocks.runtime.variantRegistry.set(
        '.custom',
        [
          '&[data-custom]',
        ],
      )
      const scopedRules:
        CipoScopedRule[] = []
      collectBlock(
        '.custom',
        [
          createDeclaration(
            'color',
            'red',
          ),
        ],
        {},
        [],
        scopedRules,
        [],
        'scope',
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenCalledWith(
        'scope',
        '&[data-custom]',
        {},
      )
      expect(
        mocks.resolveScopedSelector,
      ).not.toHaveBeenCalledWith(
        'scope',
        '.custom',
        {},
      )
    })
  })
  describe('ordinary scoped rules', () => {
    it('collects direct declaration children into one scoped rule', () => {
      const color =
        createDeclaration(
          'color',
          'red',
        )
      const padding =
        createDeclaration(
          'padding',
          '8px',
        )
      const scopedRules:
        CipoScopedRule[] = []
      const context: CipoRuleContext = {
        dark: true,
      }
      collectBlock(
        '&:hover',
        [
          color,
          padding,
        ],
        context,
        [],
        scopedRules,
        [],
        'scope-button',
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenCalledWith(
        'scope-button',
        '&:hover',
        context,
      )
      expect(scopedRules).toEqual([
        {
          selector:
            'scope-button|&:hover|{"dark":true}',
          declarations: [
            color,
            padding,
          ],
          context,
        },
      ])
    })
    it('includes only direct declaration nodes and excludes nested blocks and directives', () => {
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      const scopedRules:
        CipoScopedRule[] = []
      collectBlock(
        '& .child',
        [
          declaration,
          createBlock(
            '& .nested',
            [
              createDeclaration(
                'display',
                'block',
              ),
            ],
          ),
          createDirective(
            'with',
            ['center'],
          ),
        ],
        {},
        [],
        scopedRules,
        [],
        'scope',
      )
      expect(scopedRules).toHaveLength(1)
      expect(
        scopedRules[0].declarations,
      ).toEqual([
        declaration,
      ])
    })
    it('warns instead of emitting an empty ordinary scoped rule', () => {
      const warnings:
        CipoWarning[] = []
      const scopedRules:
        CipoScopedRule[] = []
      collectBlock(
        '& .empty',
        [
          createBlock(
            '& .nested',
            [],
          ),
        ],
        {},
        [],
        scopedRules,
        warnings,
        'scope',
      )
      expect(scopedRules).toEqual([])
      expect(
        mocks.warn,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.warn,
      ).toHaveBeenCalledWith(
        mocks.runtime,
        warnings,
        'empty-scoped-rule',
        'Scoped rule "& .empty" has no declarations.',
        '& .empty',
      )
    })
    it('trims surrounding whitespace before resolving a scoped selector', () => {
      const scopedRules:
        CipoScopedRule[] = []
      collectBlock(
        '   &:hover   ',
        [
          createDeclaration(
            'color',
            'red',
          ),
        ],
        {},
        [],
        scopedRules,
        [],
        'scope',
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenCalledWith(
        'scope',
        '&:hover',
        {},
      )
    })
  })
  describe('context immutability', () => {
    it('does not mutate the parent context while collecting structural blocks', () => {
      const parentContext:
        CipoRuleContext = {
          dark: false,
          layer: 'base',
        }
      const snapshot = {
        ...parentContext,
      }
      collectBlock(
        'reduce-motion',
        [
          createDeclaration(
            'animation',
            'none',
          ),
        ],
        parentContext,
        [],
        [],
        [],
        'scope',
      )
      expect(parentContext).toEqual(
        snapshot,
      )
    })
    it('does not leak context from one sibling block into another', () => {
      const darkDeclaration =
        createDeclaration(
          'color',
          'white',
        )
      const motionDeclaration =
        createDeclaration(
          'animation',
          'none',
        )
      collect(
        [
          createBlock(
            'x:dark',
            [darkDeclaration],
          ),
          createBlock(
            'reduce-motion',
            [motionDeclaration],
          ),
        ],
        {},
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenNthCalledWith(
        1,
        darkDeclaration,
        {
          dark: true,
        },
        expect.any(Array),
        false,
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenNthCalledWith(
        2,
        motionDeclaration,
        {
          mediaQuery:
            '(prefers-reduced-motion: reduce)',
        },
        expect.any(Array),
        false,
      )
    })
    it('composes nested block contexts without losing the outer context', () => {
      mocks.runtime.config.breakpoints = {
        md: '(min-width: 768px)',
      }
      const declaration =
        createDeclaration(
          'color',
          'red',
        )
      collect(
        [
          createBlock(
            'x:md',
            [
              createBlock(
                'reduce-motion',
                [
                  createBlock(
                    'supports(display: grid)',
                    [declaration],
                  ),
                ],
              ),
            ],
          ),
        ],
        {
          dark: true,
        },
        [],
        [],
        [],
        'scope',
      )
      expect(
        mocks.collectDeclaration,
      ).toHaveBeenCalledWith(
        declaration,
        {
          dark: true,
          breakpoint: 'md',
          mediaQuery:
            '(prefers-reduced-motion: reduce)',
          supports:
            'display: grid',
        },
        expect.any(Array),
        false,
      )
    })
  })
  describe('isDeclarationNode', () => {
    it('returns true only for declaration AST nodes', () => {
      expect(
        isDeclarationNode(
          createDeclaration(
            'color',
            'red',
          ),
        ),
      ).toBe(true)
      expect(
        isDeclarationNode(
          createBlock(
            '&:hover',
            [],
          ),
        ),
      ).toBe(false)
      expect(
        isDeclarationNode(
          createDirective(
            'with',
            ['center'],
          ),
        ),
      ).toBe(false)
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'parses x:cq() context without splitting colons that belong to the container query expression',
    )
    it.todo(
      'validates closing parentheses before treating supports(), layer() and container() as structural context functions',
    )
    it.todo(
      'defines whether multiple pseudo parts such as x:hover:focus should compose or whether the last pseudo intentionally wins',
    )
    it.todo(
      'defines whether registered variants should recursively preserve nested blocks instead of collecting only direct declarations',
    )
  })
})
function createDeclaration(
  property: string,
  value: string,
): CipoDeclarationNode {
  return {
    type: 'declaration',
    property,
    value,
  } as CipoDeclarationNode
}
function createBlock(
  name: string,
  body: readonly CipoAstNode[],
): CipoAstNode {
  return {
    type: 'block',
    name,
    body,
  } as CipoAstNode
}
function createDirective(
  name: string,
  args: readonly string[],
): CipoAstNode {
  return {
    type: 'directive',
    name,
    args,
  } as CipoAstNode
}
function createAtomicRule(
  property: string,
  value: string,
  context: CipoRuleContext,
): CipoAtomicRule {
  return {
    id: `${property}:${value}:${JSON.stringify(context)}`,
    className: `a-${property}`,
    property,
    value,
    context,
  } as CipoAtomicRule
}
