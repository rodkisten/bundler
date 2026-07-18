import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoAtomicRule,
  CipoDeclarationNode,
  CipoRuleContext,
  CipoScopedRule,
} from '../types'
import type { CipoCompiledRule } from './ir'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      important: false,
    },
  },
  addImportant: vi.fn(
    (value: string) =>
      value.includes('!important')
        ? value
        : `${value} !important`,
  ),
  compileSelector: vi.fn(
    (
      className: string,
      context: CipoRuleContext,
    ) =>
      `.compiled-${className}-${serializeContext(context)}`,
  ),
  wrapContext: vi.fn(
    (
      css: string,
      context: CipoRuleContext,
    ) =>
      Object.keys(context).length > 0
        ? `context(${serializeContext(context)}){${css}}`
        : css,
  ),
  formatCss: vi.fn(
    (css: string) =>
      css
        ? `formatted(${css})`
        : '',
  ),
  wrapLayer: vi.fn(
    (
      name: string,
      css: string,
    ) =>
      css
        ? `layer(${name}){${css}}`
        : '',
  ),
  createDeclaration: vi.fn(
    (
      property: string,
      value: string,
    ) =>
      `${property}:${value};`,
  ),
}))
vi.mock('./important', () => ({
  addImportant: mocks.addImportant,
}))
vi.mock('./selector', () => ({
  compileSelector: mocks.compileSelector,
  wrapContext: mocks.wrapContext,
}))
vi.mock('../format', () => ({
  formatCss: mocks.formatCss,
  wrapLayer: mocks.wrapLayer,
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../utils', () => ({
  createDeclaration: mocks.createDeclaration,
}))
import {
  atomicRuleToIr,
  compileAtomicRule,
  compileCss,
  compileScopedRule,
  scopedRuleToIr,
  serializeCompiledRule,
} from './emitter'
describe('compiler IR emitter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config.important = false
    mocks.addImportant.mockImplementation(
      (value: string) =>
        value.includes('!important')
          ? value
          : `${value} !important`,
    )
    mocks.compileSelector.mockImplementation(
      (
        className: string,
        context: CipoRuleContext,
      ) =>
        `.compiled-${className}-${serializeContext(context)}`,
    )
    mocks.wrapContext.mockImplementation(
      (
        css: string,
        context: CipoRuleContext,
      ) =>
        Object.keys(context).length > 0
          ? `context(${serializeContext(context)}){${css}}`
          : css,
    )
    mocks.wrapLayer.mockImplementation(
      (
        name: string,
        css: string,
      ) =>
        css
          ? `layer(${name}){${css}}`
          : '',
    )
    mocks.formatCss.mockImplementation(
      (css: string) =>
        css
          ? `formatted(${css})`
          : '',
    )
    mocks.createDeclaration.mockImplementation(
      (
        property: string,
        value: string,
      ) =>
        `${property}:${value};`,
    )
  })
  describe('atomicRuleToIr', () => {
    it('converts an atomic rule into compiler IR using its compiled selector and declaration', () => {
      const context: CipoRuleContext = {
        dark: true,
        pseudo: ':hover',
      }
      const atom = createAtomicRule({
        className: 'a-color',
        property: 'color',
        value: 'red',
        context,
      })
      const result =
        atomicRuleToIr(atom)
      expect(
        mocks.compileSelector,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.compileSelector,
      ).toHaveBeenCalledWith(
        'a-color',
        context,
      )
      expect(result).toMatchObject({
        selectors: [
          '.compiled-a-color-dark=true,pseudo=:hover',
        ],
        declarations: [
          {
            property: 'color',
            value: 'red',
          },
        ],
        context,
      })
    })
    it('preserves the original rule context by reference', () => {
      const context: CipoRuleContext = {
        layer: 'components',
      }
      const result =
        atomicRuleToIr(
          createAtomicRule({
            context,
          }),
        )
      expect(result.context).toBe(context)
    })
    it('does not apply global important configuration to atomic values at IR conversion time', () => {
      mocks.runtime.config.important = true
      const result =
        atomicRuleToIr(
          createAtomicRule({
            property: 'color',
            value: 'red',
          }),
        )
      expect(result.declarations).toEqual([
        {
          property: 'color',
          value: 'red',
        },
      ])
      expect(
        mocks.addImportant,
      ).not.toHaveBeenCalled()
    })
  })
  describe('scopedRuleToIr', () => {
    it('converts a scoped rule into compiler IR while preserving selector and declaration order', () => {
      const first =
        createDeclarationNode(
          'color',
          'red',
        )
      const second =
        createDeclarationNode(
          'padding',
          '8px',
        )
      const context: CipoRuleContext = {
        dark: true,
      }
      const result =
        scopedRuleToIr({
          selector: '.scope:hover',
          declarations: [
            first,
            second,
          ],
          context,
        })
      expect(result).toMatchObject({
        selectors: [
          '.scope:hover',
        ],
        declarations: [
          {
            property: 'color',
            value: 'red',
          },
          {
            property: 'padding',
            value: '8px',
          },
        ],
        context,
      })
      expect(
        mocks.addImportant,
      ).not.toHaveBeenCalled()
    })
    it('applies global important configuration to every scoped declaration', () => {
      mocks.runtime.config.important = true
      const rule =
        createScopedRule({
          declarations: [
            createDeclarationNode(
              'color',
              'red',
            ),
            createDeclarationNode(
              'padding',
              '8px',
            ),
          ],
        })
      const result =
        scopedRuleToIr(rule)
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
      expect(result.declarations).toEqual([
        {
          property: 'color',
          value: 'red !important',
        },
        {
          property: 'padding',
          value: '8px !important',
        },
      ])
    })
    it('does not mutate the original scoped declarations when important mode is enabled', () => {
      mocks.runtime.config.important = true
      const declaration =
        createDeclarationNode(
          'color',
          'red',
        )
      const rule =
        createScopedRule({
          declarations: [
            declaration,
          ],
        })
      scopedRuleToIr(rule)
      expect(declaration.value).toBe(
        'red',
      )
      expect(
        rule.declarations[0],
      ).toBe(declaration)
    })
    it('keeps an empty declaration list valid at the IR boundary', () => {
      const result =
        scopedRuleToIr(
          createScopedRule({
            declarations: [],
          }),
        )
      expect(result.declarations).toEqual(
        [],
      )
      expect(result.selectors).toEqual([
        '.scope',
      ])
    })
  })
  describe('serializeCompiledRule', () => {
    it('serializes declarations in source order and wraps the resulting rule context', () => {
      const context: CipoRuleContext = {
        mediaQuery:
          '(min-width: 768px)',
      }
      const rule: CipoCompiledRule = {
        selectors: [
          '.first',
          '.second',
        ],
        declarations: [
          {
            property: 'color',
            value: 'red',
          },
          {
            property: 'padding',
            value: '8px',
          },
        ],
        context,
      } as CipoCompiledRule
      const result =
        serializeCompiledRule(rule)
      expect(
        mocks.createDeclaration,
      ).toHaveBeenNthCalledWith(
        1,
        'color',
        'red',
      )
      expect(
        mocks.createDeclaration,
      ).toHaveBeenNthCalledWith(
        2,
        'padding',
        '8px',
      )
      expect(
        mocks.wrapContext,
      ).toHaveBeenCalledWith(
        '.first,.second{color:red;padding:8px;}',
        context,
      )
      expect(result).toBe(
        'context(mediaQuery=(min-width: 768px)){.first,.second{color:red;padding:8px;}}',
      )
    })
    it('joins multiple selectors with commas and no additional whitespace', () => {
      const result =
        serializeCompiledRule({
          selectors: [
            '.a',
            '.b:hover',
            '[data-state="open"]',
          ],
          declarations: [
            {
              property: 'display',
              value: 'block',
            },
          ],
          context: {},
        } as CipoCompiledRule)
      expect(
        mocks.wrapContext,
      ).toHaveBeenCalledWith(
        '.a,.b:hover,[data-state="open"]{display:block;}',
        {},
      )
      expect(result).toBe(
        '.a,.b:hover,[data-state="open"]{display:block;}',
      )
    })
    it('serializes an empty declaration collection without inventing declarations', () => {
      const result =
        serializeCompiledRule({
          selectors: [
            '.empty',
          ],
          declarations: [],
          context: {},
        } as CipoCompiledRule)
      expect(
        mocks.createDeclaration,
      ).not.toHaveBeenCalled()
      expect(
        mocks.wrapContext,
      ).toHaveBeenCalledWith(
        '.empty{}',
        {},
      )
      expect(result).toBe(
        '.empty{}',
      )
    })
    it('delegates context serialization exactly once at the final rule boundary', () => {
      const context: CipoRuleContext = {
        dark: true,
        layer: 'components',
      }
      serializeCompiledRule({
        selectors: [
          '.button',
        ],
        declarations: [
          {
            property: 'color',
            value: 'red',
          },
        ],
        context,
      } as CipoCompiledRule)
      expect(
        mocks.wrapContext,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.wrapContext,
      ).toHaveBeenCalledWith(
        '.button{color:red;}',
        context,
      )
    })
  })
  describe('compileAtomicRule', () => {
    it('runs an atomic rule through IR conversion and final serialization', () => {
      const atom =
        createAtomicRule({
          className: 'a-display',
          property: 'display',
          value: 'flex',
          context: {
            dark: true,
          },
        })
      const result =
        compileAtomicRule(atom)
      expect(
        mocks.compileSelector,
      ).toHaveBeenCalledWith(
        'a-display',
        {
          dark: true,
        },
      )
      expect(
        mocks.createDeclaration,
      ).toHaveBeenCalledWith(
        'display',
        'flex',
      )
      expect(result).toBe(
        'context(dark=true){.compiled-a-display-dark=true{display:flex;}}',
      )
    })
  })
  describe('compileScopedRule', () => {
    it('runs a scoped rule through IR conversion and final serialization', () => {
      const rule =
        createScopedRule({
          selector:
            '.button:hover',
          declarations: [
            createDeclarationNode(
              'color',
              'red',
            ),
          ],
          context: {
            mediaQuery:
              '(min-width: 768px)',
          },
        })
      const result =
        compileScopedRule(rule)
      expect(
        mocks.compileSelector,
      ).not.toHaveBeenCalled()
      expect(result).toBe(
        'context(mediaQuery=(min-width: 768px)){.button:hover{color:red;}}',
      )
    })
    it('applies important mode before serializing a scoped rule', () => {
      mocks.runtime.config.important = true
      const result =
        compileScopedRule(
          createScopedRule({
            declarations: [
              createDeclarationNode(
                'color',
                'red',
              ),
            ],
          }),
        )
      expect(result).toBe(
        '.scope{color:red !important;}',
      )
    })
  })
  describe('compileCss', () => {
    it('compiles atomic and scoped rules into their canonical layers', () => {
      const atoms = [
        createAtomicRule({
          className: 'a-color',
          property: 'color',
          value: 'red',
        }),
      ]
      const scopedRules = [
        createScopedRule({
          selector:
            '.scope:hover',
          declarations: [
            createDeclarationNode(
              'opacity',
              '0.5',
            ),
          ],
        }),
      ]
      const result =
        compileCss(
          atoms,
          scopedRules,
        )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        1,
        'atomic',
        '.compiled-a-color-{color:red;}',
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        2,
        'scoped',
        '.scope:hover{opacity:0.5;}',
      )
      expect(
        mocks.formatCss,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.formatCss,
      ).toHaveBeenCalledWith(
        [
          'layer(atomic){.compiled-a-color-{color:red;}}',
          'layer(scoped){.scope:hover{opacity:0.5;}}',
        ].join('\n'),
      )
      expect(result).toBe(
        [
          'formatted(layer(atomic){.compiled-a-color-{color:red;}',
          '}',
          'layer(scoped){.scope:hover{opacity:0.5;}})',
        ].join('\n'),
      )
    })
    it('preserves atomic rule source order inside the atomic layer', () => {
      const atoms = [
        createAtomicRule({
          className: 'first',
          property: 'color',
          value: 'red',
        }),
        createAtomicRule({
          className: 'second',
          property: 'display',
          value: 'block',
        }),
        createAtomicRule({
          className: 'third',
          property: 'padding',
          value: '8px',
        }),
      ]
      compileCss(
        atoms,
        [],
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        1,
        'atomic',
        [
          '.compiled-first-{color:red;}',
          '.compiled-second-{display:block;}',
          '.compiled-third-{padding:8px;}',
        ].join('\n'),
      )
    })
    it('preserves scoped rule source order inside the scoped layer', () => {
      const scopedRules = [
        createScopedRule({
          selector: '.first',
          declarations: [
            createDeclarationNode(
              'color',
              'red',
            ),
          ],
        }),
        createScopedRule({
          selector: '.second',
          declarations: [
            createDeclarationNode(
              'display',
              'block',
            ),
          ],
        }),
      ]
      compileCss(
        [],
        scopedRules,
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        2,
        'scoped',
        [
          '.first{color:red;}',
          '.second{display:block;}',
        ].join('\n'),
      )
    })
    it('omits an empty atomic layer while preserving scoped output', () => {
      const scopedRules = [
        createScopedRule({
          declarations: [
            createDeclarationNode(
              'color',
              'red',
            ),
          ],
        }),
      ]
      compileCss(
        [],
        scopedRules,
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        1,
        'atomic',
        '',
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        2,
        'scoped',
        '.scope{color:red;}',
      )
      expect(
        mocks.formatCss,
      ).toHaveBeenCalledWith(
        'layer(scoped){.scope{color:red;}}',
      )
    })
    it('omits an empty scoped layer while preserving atomic output', () => {
      const atoms = [
        createAtomicRule({
          property: 'color',
          value: 'red',
        }),
      ]
      compileCss(
        atoms,
        [],
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        1,
        'atomic',
        '.compiled-atomic-{color:red;}',
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        2,
        'scoped',
        '',
      )
      expect(
        mocks.formatCss,
      ).toHaveBeenCalledWith(
        'layer(atomic){.compiled-atomic-{color:red;}}',
      )
    })
    it('passes an empty string through the final formatter when there are no rules', () => {
      const result =
        compileCss(
          [],
          [],
        )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        1,
        'atomic',
        '',
      )
      expect(
        mocks.wrapLayer,
      ).toHaveBeenNthCalledWith(
        2,
        'scoped',
        '',
      )
      expect(
        mocks.formatCss,
      ).toHaveBeenCalledWith(
        '',
      )
      expect(result).toBe('')
    })
    it('formats exactly once after both layers have been assembled', () => {
      compileCss(
        [
          createAtomicRule(),
        ],
        [
          createScopedRule(),
        ],
      )
      expect(
        mocks.formatCss,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.wrapLayer,
      ).toHaveBeenCalledTimes(2)
      expect(
        mocks.formatCss.mock.invocationCallOrder[0],
      ).toBeGreaterThan(
        mocks.wrapLayer.mock.invocationCallOrder[1]!,
      )
    })
    it('does not mutate atomic or scoped rule input arrays', () => {
      const atom =
        createAtomicRule()
      const scoped =
        createScopedRule()
      const atoms = [
        atom,
      ] as const
      const scopedRules = [
        scoped,
      ] as const
      compileCss(
        atoms,
        scopedRules,
      )
      expect(atoms).toEqual([
        atom,
      ])
      expect(scopedRules).toEqual([
        scoped,
      ])
      expect(atoms[0]).toBe(atom)
      expect(scopedRules[0]).toBe(scoped)
    })
  })
  describe('compiler IR invariants', () => {
    it('keeps context application at serialization time instead of baking it into declarations', () => {
      const context: CipoRuleContext = {
        dark: true,
        mediaQuery:
          '(min-width: 768px)',
      }
      const ir =
        atomicRuleToIr(
          createAtomicRule({
            context,
          }),
        )
      expect(ir.declarations).toEqual([
        {
          property: 'color',
          value: 'red',
        },
      ])
      expect(ir.context).toBe(context)
      serializeCompiledRule(ir)
      expect(
        mocks.wrapContext,
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          '{color:red;}',
        ),
        context,
      )
    })
    it('keeps atomic and scoped compilation paths independent until layer assembly', () => {
      compileCss(
        [
          createAtomicRule({
            className: 'atomic-one',
          }),
        ],
        [
          createScopedRule({
            selector:
              '.scoped-one',
          }),
        ],
      )
      const atomicLayerCss =
        mocks.wrapLayer.mock.calls[0][1]
      const scopedLayerCss =
        mocks.wrapLayer.mock.calls[1][1]
      expect(
        atomicLayerCss,
      ).toContain(
        'atomic-one',
      )
      expect(
        atomicLayerCss,
      ).not.toContain(
        'scoped-one',
      )
      expect(
        scopedLayerCss,
      ).toContain(
        'scoped-one',
      )
      expect(
        scopedLayerCss,
      ).not.toContain(
        'atomic-one',
      )
    })
  })
  describe('regression contracts', () => {
    it.todo(
      'defines whether an atomic rule whose value already contains !important can ever be modified by global important mode upstream',
    )
    it.todo(
      'defines whether empty IR rules should be dropped before serialization instead of emitting selector{}',
    )
    it.todo(
      'defines whether duplicate selectors inside one CipoCompiledRule should be deduplicated at the IR or optimizer layer',
    )
  })
})
function createAtomicRule(
  overrides: Partial<CipoAtomicRule> = {},
): CipoAtomicRule {
  return {
    id: 'color:red',
    className: 'atomic',
    property: 'color',
    value: 'red',
    context: {},
    ...overrides,
  } as CipoAtomicRule
}
function createScopedRule(
  overrides: Partial<CipoScopedRule> = {},
): CipoScopedRule {
  return {
    selector: '.scope',
    declarations: [
      createDeclarationNode(
        'color',
        'red',
      ),
    ],
    context: {},
    ...overrides,
  }
}
function createDeclarationNode(
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
function serializeContext(
  context: CipoRuleContext,
): string {
  return Object.entries(context)
    .map(
      ([key, value]) =>
        `${key}=${String(value)}`,
    )
    .join(',')
}
