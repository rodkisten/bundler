import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CipoAstNode,
  CipoAtomicRule,
  CipoCssArtifact,
  CipoRuleContext,
  CipoScopedRule,
  CipoWarning,
} from '../../types'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      prefix: 'cp',
      important: false,
      atomic: {
        minUses: 1,
      },
    },
    atomicUsageCounts: new Map<string, number>(),
    atomicSingleUseFallbacks: new Map<string, CipoAtomicRule>(),
  },
  collectRules: vi.fn(),
  createArtifactCacheKey: vi.fn(),
  getCachedArtifact: vi.fn(),
  setCachedArtifact: vi.fn(),
  compileCss: vi.fn(),
  joinAtomicClassNames: vi.fn(),
  insertCss: vi.fn(),
  parseStylesheet: vi.fn(),
  buildSafeSource: vi.fn(),
  transformCss: vi.fn(),
  hashString: vi.fn(),
  hashString64: vi.fn(),
  assertGeneratedNameIdentity: vi.fn(),
  resolveScopedSelector: vi.fn(),
}))
vi.mock('../at-rules', () => ({
  collectRules: mocks.collectRules,
}))
vi.mock('../cache', () => ({
  createArtifactCacheKey:
    mocks.createArtifactCacheKey,
  getCachedArtifact:
    mocks.getCachedArtifact,
  setCachedArtifact:
    mocks.setCachedArtifact,
}))
vi.mock('../emitter', () => ({
  compileCss: mocks.compileCss,
  compileAtomicRule: vi.fn(),
}))
vi.mock('./utils', () => ({
  joinAtomicClassNames:
    mocks.joinAtomicClassNames,
}))
vi.mock('../../injection', () => ({
  insertCss: mocks.insertCss,
}))
vi.mock('../../syntax/parser', () => ({
  parseStylesheet:
    mocks.parseStylesheet,
}))
vi.mock('../../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../../transform/source', () => ({
  buildSafeSource:
    mocks.buildSafeSource,
}))
vi.mock('../../transform/index', () => ({
  transformCss:
    mocks.transformCss,
}))
vi.mock('../../utils', () => ({
  hashString: mocks.hashString,
  hashString64: mocks.hashString64,
}))
vi.mock('../hash-registry', () => ({
  assertGeneratedNameIdentity:
    mocks.assertGeneratedNameIdentity,
}))
vi.mock('../selector', () => ({
  resolveScopedSelector:
    mocks.resolveScopedSelector,
}))
vi.mock('./rule', () => ({
  createAtomicRule: vi.fn(),
}))
import {
  compileAtomicCss,
  createAtomicArtifact,
  joinClassNames,
  partitionPromotedAtoms,
} from './compile'
describe('explicit atomic.css compiler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config = {
      prefix: 'cp',
      important: false,
      atomic: {
        minUses: 1,
      },
    }
    mocks.runtime.atomicUsageCounts.clear()
    mocks.runtime.atomicSingleUseFallbacks.clear()
    mocks.createArtifactCacheKey.mockImplementation(
      (
        css: string,
        mode: string,
      ) => `${mode}:${css}`,
    )
    mocks.buildSafeSource.mockReturnValue(
      'color:red;',
    )
    mocks.transformCss.mockImplementation(
      (css: string) => css,
    )
    mocks.parseStylesheet.mockReturnValue(
      [],
    )
    mocks.collectRules.mockReturnValue({
      atoms: [],
      scopedRules: [],
    })
    mocks.compileCss.mockReturnValue(
      'compiled-css',
    )
    mocks.joinAtomicClassNames.mockImplementation(
      (
        scopeClassName: string,
        atoms: readonly CipoAtomicRule[],
      ) =>
        [
          scopeClassName,
          ...atoms.map(
            (atom) => atom.className,
          ),
        ]
          .filter(Boolean)
          .join(' '),
    )
    mocks.hashString64.mockReturnValue(
      'scope-hash',
    )
    mocks.hashString.mockReturnValue(
      'artifact-hash',
    )
    mocks.resolveScopedSelector.mockImplementation(
      (
        scopeClassName: string,
        selector: string,
        context: CipoRuleContext,
      ) =>
        `${scopeClassName}${selector}${serializeContext(context)}`,
    )
  })
  describe('partitionPromotedAtoms', () => {
    it('returns all atoms unchanged when atomic promotion threshold is disabled', () => {
      mocks.runtime.config.atomic.minUses = 1
      const atoms = [
        createAtom(
          'color:red',
          'a-color',
        ),
        createAtom(
          'display:flex',
          'a-display',
        ),
      ]
      const result =
        partitionPromotedAtoms(
          atoms,
          'cp-s-scope',
        )
      expect(result).toEqual({
        atoms,
        scopedRules: [],
      })
      expect(
        result.atoms,
      ).toBe(atoms)
      expect(
        mocks.runtime.atomicUsageCounts.size,
      ).toBe(0)
      expect(
        mocks.runtime.atomicSingleUseFallbacks.size,
      ).toBe(0)
      expect(
        mocks.resolveScopedSelector,
      ).not.toHaveBeenCalled()
    })
    it('keeps a first-use atom scoped while below the promotion threshold', () => {
      mocks.runtime.config.atomic.minUses = 2
      const atom = createAtom(
        'color:red',
        'a-color',
        {
          dark: true,
        },
      )
      const result =
        partitionPromotedAtoms(
          [atom],
          'cp-s-scope',
        )
      expect(result.atoms).toEqual([])
      expect(result.scopedRules).toEqual([
        {
          selector:
            'cp-s-scope{"dark":true}',
          declarations: [
            {
              type: 'declaration',
              property: 'color',
              value: 'red',
              source: 'color:red',
            },
          ],
          context: {
            dark: true,
          },
        },
      ])
      expect(
        mocks.runtime.atomicUsageCounts.get(
          'color:red',
        ),
      ).toBe(1)
      expect(
        mocks.runtime.atomicSingleUseFallbacks.get(
          'color:red',
        ),
      ).toBe(atom)
    })
    it('promotes an atom once its usage count reaches the configured threshold', () => {
      mocks.runtime.config.atomic.minUses = 2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.runtime.atomicUsageCounts.set(
        atom.id,
        1,
      )
      mocks.runtime.atomicSingleUseFallbacks.set(
        atom.id,
        atom,
      )
      const result =
        partitionPromotedAtoms(
          [atom],
          'cp-s-scope',
        )
      expect(result).toEqual({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      expect(
        mocks.runtime.atomicUsageCounts.get(
          atom.id,
        ),
      ).toBe(2)
      expect(
        mocks.runtime.atomicSingleUseFallbacks.has(
          atom.id,
        ),
      ).toBe(false)
    })
    it('keeps promoting an atom after it has passed the threshold', () => {
      mocks.runtime.config.atomic.minUses = 2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.runtime.atomicUsageCounts.set(
        atom.id,
        7,
      )
      const result =
        partitionPromotedAtoms(
          [atom],
          'cp-s-scope',
        )
      expect(result.atoms).toEqual([
        atom,
      ])
      expect(result.scopedRules).toEqual([])
      expect(
        mocks.runtime.atomicUsageCounts.get(
          atom.id,
        ),
      ).toBe(8)
    })
    it('counts duplicate atom ids only once per partition operation', () => {
      mocks.runtime.config.atomic.minUses = 3
      const first = createAtom(
        'color:red',
        'a-color',
      )
      const duplicate = createAtom(
        'color:red',
        'a-color-duplicate',
      )
      const result =
        partitionPromotedAtoms(
          [
            first,
            duplicate,
          ],
          'cp-s-scope',
        )
      expect(
        mocks.runtime.atomicUsageCounts.get(
          'color:red',
        ),
      ).toBe(1)
      expect(result.atoms).toEqual([])
      expect(result.scopedRules).toHaveLength(
        1,
      )
      expect(
        mocks.runtime.atomicSingleUseFallbacks.get(
          'color:red',
        ),
      ).toBe(first)
    })
    it('partitions different atom ids independently', () => {
      mocks.runtime.config.atomic.minUses = 2
      const promoted = createAtom(
        'color:red',
        'a-color',
      )
      const fallback = createAtom(
        'display:flex',
        'a-display',
      )
      mocks.runtime.atomicUsageCounts.set(
        promoted.id,
        1,
      )
      const result =
        partitionPromotedAtoms(
          [
            promoted,
            fallback,
          ],
          'cp-s-scope',
        )
      expect(result.atoms).toEqual([
        promoted,
      ])
      expect(result.scopedRules).toEqual([
        expect.objectContaining({
          declarations: [
            expect.objectContaining({
              property: 'display',
              value: 'flex',
            }),
          ],
        }),
      ])
      expect(
        mocks.runtime.atomicUsageCounts.get(
          promoted.id,
        ),
      ).toBe(2)
      expect(
        mocks.runtime.atomicUsageCounts.get(
          fallback.id,
        ),
      ).toBe(1)
    })
    it('preserves atom context in threshold fallback scoped rules', () => {
      mocks.runtime.config.atomic.minUses = 2
      const context: CipoRuleContext = {
        dark: true,
        breakpoint: 'md',
        mediaQuery:
          '(min-width: 768px)',
        pseudo: ':hover',
      }
      const atom = createAtom(
        'color:red',
        'a-color',
        context,
      )
      const result =
        partitionPromotedAtoms(
          [atom],
          'cp-s-scope',
        )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenCalledWith(
        'cp-s-scope',
        '',
        context,
      )
      expect(
        result.scopedRules[0]?.context,
      ).toBe(context)
      expect(
        result.scopedRules[0]?.declarations[0],
      ).toMatchObject({
        property: 'color',
        value: 'red',
        source: 'color:red',
      })
    })
    it('preserves first-seen atom order independently of promotion status', () => {
      mocks.runtime.config.atomic.minUses = 2
      const first = createAtom(
        'first:1',
        'a-first',
      )
      const second = createAtom(
        'second:2',
        'a-second',
      )
      const third = createAtom(
        'third:3',
        'a-third',
      )
      mocks.runtime.atomicUsageCounts.set(
        first.id,
        1,
      )
      mocks.runtime.atomicUsageCounts.set(
        third.id,
        1,
      )
      const result =
        partitionPromotedAtoms(
          [
            first,
            second,
            third,
          ],
          'scope',
        )
      expect(
        result.atoms.map(
          (atom) => atom.id,
        ),
      ).toEqual([
        'first:1',
        'third:3',
      ])
      expect(
        result.scopedRules.map(
          (rule) =>
            rule.declarations[0]?.source,
        ),
      ).toEqual([
        'second:2',
      ])
    })
  })
  describe('joinClassNames', () => {
    it('delegates backwards-compatible class-list construction to joinAtomicClassNames', () => {
      const atoms = [
        createAtom(
          'color:red',
          'a-color',
        ),
      ]
      const result =
        joinClassNames(
          atoms,
          'cp-s-scope',
        )
      expect(
        mocks.joinAtomicClassNames,
      ).toHaveBeenCalledWith(
        'cp-s-scope',
        atoms,
      )
      expect(result).toBe(
        'cp-s-scope a-color',
      )
    })
  })
  describe('createAtomicArtifact', () => {
    it('creates a complete atomic artifact from collected atoms', () => {
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      mocks.compileCss.mockReturnValue(
        '.a-color{color:red}',
      )
      const ast: CipoAstNode[] = []
      const warnings: CipoWarning[] = []
      const artifact =
        createAtomicArtifact(
          'color: red;',
          'color:red;',
          ast,
          warnings,
        )
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        'color:red;',
      )
      expect(
        mocks.assertGeneratedNameIdentity,
      ).toHaveBeenCalledWith(
        'cp-s-scope-hash',
        'scope|color:red;',
      )
      expect(
        mocks.collectRules,
      ).toHaveBeenCalledWith(
        ast,
        'cp-s-scope-hash',
        expect.any(Array),
        false,
      )
      expect(
        mocks.joinAtomicClassNames,
      ).toHaveBeenCalledWith(
        '',
        [
          atom,
        ],
      )
      expect(
        mocks.compileCss,
      ).toHaveBeenCalledWith(
        [
          atom,
        ],
        [],
      )
      expect(artifact).toMatchObject({
        kind: 'cipo.css',
        className: 'a-color',
        scopeClassName:
          'cp-s-scope-hash',
        atoms: [
          atom,
        ],
        scopedRules: [],
        rawCss: 'color: red;',
        transformedCss:
          'color:red;',
        compiledCss:
          '.a-color{color:red}',
      })
      expect(
        artifact.debug,
      ).toMatchObject({
        id:
          'cp-artifact-artifact-hash',
        ast,
        atoms: [
          atom,
        ],
        scopedRules: [],
        warnings: [],
      })
    })
    it('includes the scope class when collected scoped rules are present', () => {
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      const scopedRule =
        createScopedRule(
          '.scope:hover',
        )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [
          scopedRule,
        ],
      })
      const artifact =
        createAtomicArtifact(
          'raw',
          'transformed',
          [],
          [],
        )
      expect(
        mocks.joinAtomicClassNames,
      ).toHaveBeenCalledWith(
        'cp-s-scope-hash',
        [
          atom,
        ],
      )
      expect(artifact.className).toBe(
        'cp-s-scope-hash a-color',
      )
      expect(
        mocks.compileCss,
      ).toHaveBeenCalledWith(
        [
          atom,
        ],
        [
          scopedRule,
        ],
      )
    })
    it('forwards forceImportant explicitly without mutating runtime.config.important', () => {
      mocks.runtime.config.important =
        false
      createAtomicArtifact(
        'raw',
        'transformed',
        [],
        [],
        true,
      )
      expect(
        mocks.collectRules,
      ).toHaveBeenCalledWith(
        [],
        'cp-s-scope-hash',
        expect.any(Array),
        true,
      )
      expect(
        mocks.runtime.config.important,
      ).toBe(false)
    })
    it('copies the input warning array before allowing collection to append diagnostics', () => {
      const existingWarning: CipoWarning = {
        code: 'existing',
        message: 'Existing warning',
      }
      const warnings = [
        existingWarning,
      ]
      mocks.collectRules.mockImplementation(
        (
          _ast: readonly CipoAstNode[],
          _scopeClassName: string,
          mutableWarnings: CipoWarning[],
        ) => {
          mutableWarnings.push({
            code: 'collected',
            message:
              'Collected warning',
          })
          return {
            atoms: [],
            scopedRules: [],
          }
        },
      )
      const artifact =
        createAtomicArtifact(
          'raw',
          'transformed',
          [],
          warnings,
        )
      expect(warnings).toEqual([
        existingWarning,
      ])
      expect(
        artifact.debug.warnings,
      ).toEqual([
        existingWarning,
        {
          code: 'collected',
          message:
            'Collected warning',
        },
      ])
      expect(
        artifact.debug.warnings,
      ).not.toBe(warnings)
    })
    it('creates threshold fallback scoped rules instead of emitting atomic CSS when thresholded mode is enabled', () => {
      const first = createAtom(
        'color:red',
        'a-color',
        {
          dark: true,
        },
      )
      const second = createAtom(
        'display:flex',
        'a-display',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          first,
          second,
        ],
        scopedRules: [],
      })
      createAtomicArtifact(
        'raw',
        'transformed',
        [],
        [],
        false,
        true,
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenNthCalledWith(
        1,
        'cp-s-scope-hash',
        '',
        first.context,
      )
      expect(
        mocks.resolveScopedSelector,
      ).toHaveBeenNthCalledWith(
        2,
        'cp-s-scope-hash',
        '',
        second.context,
      )
      expect(
        mocks.compileCss,
      ).toHaveBeenCalledWith(
        [],
        [
          {
            selector:
              'cp-s-scope-hash{"dark":true}',
            declarations: [
              {
                type: 'declaration',
                property: 'color',
                value: 'red',
                source: 'color:red',
              },
            ],
            context: first.context,
          },
          {
            selector:
              'cp-s-scope-hash{}',
            declarations: [
              {
                type: 'declaration',
                property: 'display',
                value: 'flex',
                source: 'display:flex',
              },
            ],
            context: second.context,
          },
        ],
      )
    })
    it('includes the scope class in thresholded artifact class names even when no intrinsic scoped rule exists', () => {
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      const artifact =
        createAtomicArtifact(
          'raw',
          'transformed',
          [],
          [],
          false,
          true,
        )
      expect(
        mocks.joinAtomicClassNames,
      ).toHaveBeenCalledWith(
        'cp-s-scope-hash',
        [
          atom,
        ],
      )
      expect(artifact.className).toBe(
        'cp-s-scope-hash a-color',
      )
    })
    it('appends intrinsic scoped rules after threshold fallback rules', () => {
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      const intrinsic =
        createScopedRule(
          '.intrinsic:hover',
        )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [
          intrinsic,
        ],
      })
      createAtomicArtifact(
        'raw',
        'transformed',
        [],
        [],
        false,
        true,
      )
      const compiledScopedRules =
        mocks.compileCss.mock.calls[0]?.[1] as readonly CipoScopedRule[]
      expect(compiledScopedRules).toHaveLength(
        2,
      )
      expect(
        compiledScopedRules[0]
          ?.declarations[0]?.source,
      ).toBe(
        'color:red',
      )
      expect(
        compiledScopedRules[1],
      ).toBe(intrinsic)
    })
    it('builds artifact identity from raw CSS while scope identity uses transformed CSS', () => {
      createAtomicArtifact(
        'raw source',
        'transformed source',
        [],
        [],
      )
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        'transformed source',
      )
      expect(
        mocks.hashString,
      ).toHaveBeenCalledWith(
        'raw source',
      )
    })
    it('supports string coercion through toString and Symbol.toPrimitive', () => {
      mocks.collectRules.mockReturnValue({
        atoms: [
          createAtom(
            'color:red',
            'a-color',
          ),
        ],
        scopedRules: [],
      })
      const artifact =
        createAtomicArtifact(
          'raw',
          'transformed',
          [],
          [],
        )
      expect(artifact.toString()).toBe(
        artifact.className,
      )
      expect(String(artifact)).toBe(
        artifact.className,
      )
      expect(
        artifact[
          Symbol.toPrimitive
        ]?.('string'),
      ).toBe(
        artifact.className,
      )
      expect(
        artifact[
          Symbol.toStringTag
        ],
      ).toBe(
        'CipoCssArtifact',
      )
    })
  })
  describe('compileAtomicCss', () => {
    function createStrings(
      ...parts: string[]
    ): TemplateStringsArray {
      const strings =
        [...parts] as unknown as TemplateStringsArray
      Object.defineProperty(
        strings,
        'raw',
        {
          value: [...parts],
        },
      )
      return strings
    }
    it('runs safe-source construction, transformation, parsing, collection, compilation and injection', () => {
      const strings =
        createStrings(
          'color:',
          ';',
        )
      const values = [
        'red',
      ]
      const ast: CipoAstNode[] = []
      mocks.buildSafeSource.mockReturnValue(
        'color:red;',
      )
      mocks.transformCss.mockReturnValue(
        'color:red',
      )
      mocks.parseStylesheet.mockReturnValue(
        ast,
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          createAtom(
            'color:red',
            'a-color',
          ),
        ],
        scopedRules: [],
      })
      mocks.compileCss.mockReturnValue(
        '.a-color{color:red}',
      )
      const artifact =
        compileAtomicCss(
          strings,
          values,
          false,
        )
      expect(
        mocks.buildSafeSource,
      ).toHaveBeenCalledWith(
        strings,
        values,
      )
      expect(
        mocks.createArtifactCacheKey,
      ).toHaveBeenCalledWith(
        'color:red;',
        'atomic',
      )
      expect(
        mocks.transformCss,
      ).toHaveBeenCalledWith(
        'color:red;',
        expect.any(Array),
      )
      expect(
        mocks.parseStylesheet,
      ).toHaveBeenCalledWith(
        'color:red',
        expect.any(Array),
      )
      expect(
        mocks.insertCss,
      ).toHaveBeenCalledWith(
        artifact.compiledCss,
      )
      expect(
        mocks.setCachedArtifact,
      ).toHaveBeenCalledWith(
        'atomic:color:red;',
        artifact,
      )
    })
    it('uses a distinct cache mode for force-important atomic CSS', () => {
      compileAtomicCss(
        createStrings(
          'color:red;',
        ),
        [],
        true,
      )
      expect(
        mocks.createArtifactCacheKey,
      ).toHaveBeenCalledWith(
        'color:red;',
        'atomic-important',
      )
      expect(
        mocks.collectRules,
      ).toHaveBeenCalledWith(
        expect.any(Array),
        'cp-s-scope-hash',
        expect.any(Array),
        true,
      )
    })
    it('returns and reinjects a valid cached atomic artifact without recompiling', () => {
      const cached =
        createArtifact({
          compiledCss:
            '.cached{color:red}',
        })
      mocks.getCachedArtifact.mockReturnValue(
        cached,
      )
      const result =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(result).toBe(cached)
      expect(
        mocks.insertCss,
      ).toHaveBeenCalledWith(
        '.cached{color:red}',
      )
      expect(
        mocks.transformCss,
      ).not.toHaveBeenCalled()
      expect(
        mocks.parseStylesheet,
      ).not.toHaveBeenCalled()
      expect(
        mocks.collectRules,
      ).not.toHaveBeenCalled()
      expect(
        mocks.compileCss,
      ).not.toHaveBeenCalled()
      expect(
        mocks.setCachedArtifact,
      ).not.toHaveBeenCalled()
    })
    it('ignores cached results that are not cipo.css artifacts', () => {
      mocks.getCachedArtifact.mockReturnValue(
        {
          kind: 'other',
        } as never,
      )
      compileAtomicCss(
        createStrings(
          'color:red;',
        ),
        [],
        false,
      )
      expect(
        mocks.transformCss,
      ).toHaveBeenCalled()
      expect(
        mocks.parseStylesheet,
      ).toHaveBeenCalled()
      expect(
        mocks.collectRules,
      ).toHaveBeenCalled()
    })
    it('disables artifact caching when streaming promotion threshold is active', () => {
      mocks.runtime.config.atomic.minUses =
        2
      compileAtomicCss(
        createStrings(
          'color:red;',
        ),
        [],
        false,
      )
      expect(
        mocks.getCachedArtifact,
      ).not.toHaveBeenCalled()
      expect(
        mocks.setCachedArtifact,
      ).not.toHaveBeenCalled()
    })
    it('applies streaming promotion after candidate artifact collection', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      mocks.compileCss.mockClear()
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(
        mocks.runtime.atomicUsageCounts.get(
          atom.id,
        ),
      ).toBe(1)
      expect(artifact.atoms).toEqual([])
      expect(
        artifact.scopedRules,
      ).toHaveLength(1)
      expect(
        artifact.className,
      ).toContain(
        artifact.scopeClassName,
      )
      const finalCall =
        mocks.compileCss.mock.calls.at(
          -1,
        )
      expect(finalCall?.[0]).toEqual([])
      expect(
        finalCall?.[1],
      ).toHaveLength(1)
    })
    it('promotes a thresholded atom on a later compilation', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      const first =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      const second =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(first.atoms).toEqual([])
      expect(
        first.scopedRules,
      ).toHaveLength(1)
      expect(second.atoms).toEqual([
        atom,
      ])
      expect(
        second.scopedRules,
      ).toEqual([])
      expect(
        mocks.runtime.atomicUsageCounts.get(
          atom.id,
        ),
      ).toBe(2)
      expect(
        mocks.runtime.atomicSingleUseFallbacks.has(
          atom.id,
        ),
      ).toBe(false)
    })
    it('preserves intrinsic scoped rules while adding threshold fallback rules', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      const intrinsic =
        createScopedRule(
          '.scope:hover',
        )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [
          intrinsic,
        ],
      })
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(
        artifact.scopedRules,
      ).toHaveLength(2)
      expect(
        artifact.scopedRules[1],
      ).toBe(intrinsic)
    })
    it('always injects the rebuilt final CSS rather than the candidate CSS', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      mocks.compileCss
        .mockReturnValueOnce(
          'candidate-css',
        )
        .mockReturnValueOnce(
          'rebuilt-css',
        )
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(
        artifact.compiledCss,
      ).toBe(
        'rebuilt-css',
      )
      expect(
        mocks.insertCss,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.insertCss,
      ).toHaveBeenCalledWith(
        'rebuilt-css',
      )
    })
    it('preserves warnings produced during transformation and parsing in artifact debug metadata', () => {
      mocks.transformCss.mockImplementation(
        (
          css: string,
          warnings: CipoWarning[],
        ) => {
          warnings.push({
            code: 'transform-warning',
            message:
              'Transform warning',
          })
          return css
        },
      )
      mocks.parseStylesheet.mockImplementation(
        (
          _css: string,
          warnings: CipoWarning[],
        ) => {
          warnings.push({
            code: 'parser-warning',
            message:
              'Parser warning',
          })
          return []
        },
      )
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(
        artifact.debug.warnings,
      ).toEqual([
        {
          code: 'transform-warning',
          message:
            'Transform warning',
        },
        {
          code: 'parser-warning',
          message:
            'Parser warning',
        },
      ])
    })
  })
  describe('artifact rebuilding contracts', () => {
    it('removes the scope class after threshold promotion when no scoped rules remain', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.runtime.atomicUsageCounts.set(
        atom.id,
        1,
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(artifact.atoms).toEqual([
        atom,
      ])
      expect(
        artifact.scopedRules,
      ).toEqual([])
      expect(artifact.className).toBe(
        'a-color',
      )
    })
    it('keeps the scope class after partial promotion while any scoped fallback remains', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const promoted = createAtom(
        'color:red',
        'a-color',
      )
      const fallback = createAtom(
        'display:flex',
        'a-display',
      )
      mocks.runtime.atomicUsageCounts.set(
        promoted.id,
        1,
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          promoted,
          fallback,
        ],
        scopedRules: [],
      })
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;display:flex;',
          ),
          [],
          false,
        )
      expect(artifact.atoms).toEqual([
        promoted,
      ])
      expect(
        artifact.scopedRules,
      ).toHaveLength(1)
      expect(artifact.className).toBe(
        'cp-s-scope-hash a-color',
      )
    })
    it('keeps artifact debug atom and scoped-rule collections synchronized with rebuilt output', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(
        artifact.debug.atoms,
      ).toBe(
        artifact.atoms,
      )
      expect(
        artifact.debug.scopedRules,
      ).toBe(
        artifact.scopedRules,
      )
    })
    it('preserves artifact identity and source metadata across rebuilding', () => {
      mocks.runtime.config.atomic.minUses =
        2
      mocks.collectRules.mockReturnValue({
        atoms: [
          createAtom(
            'color:red',
            'a-color',
          ),
        ],
        scopedRules: [],
      })
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(artifact.kind).toBe(
        'cipo.css',
      )
      expect(artifact.rawCss).toBe(
        'color:red;',
      )
      expect(
        artifact.transformedCss,
      ).toBe(
        'color:red;',
      )
      expect(artifact.debug.id).toBe(
        'cp-artifact-artifact-hash',
      )
      expect(
        artifact[
          Symbol.toStringTag
        ],
      ).toBe(
        'CipoCssArtifact',
      )
    })
    it('rebuilds string coercion around the final className instead of retaining the candidate className closure', () => {
      mocks.runtime.config.atomic.minUses =
        2
      const atom = createAtom(
        'color:red',
        'a-color',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          atom,
        ],
        scopedRules: [],
      })
      const artifact =
        compileAtomicCss(
          createStrings(
            'color:red;',
          ),
          [],
          false,
        )
      expect(String(artifact)).toBe(
        artifact.className,
      )
      expect(
        artifact[
          Symbol.toPrimitive
        ]?.('string'),
      ).toBe(
        artifact.className,
      )
    })
  })
  describe('streaming promotion regression contracts', () => {
    it('increments one usage per unique declaration id in a single artifact even when collection emits duplicates', () => {
      mocks.runtime.config.atomic.minUses =
        3
      const first = createAtom(
        'color:red',
        'a-color-1',
      )
      const duplicate = createAtom(
        'color:red',
        'a-color-2',
      )
      mocks.collectRules.mockReturnValue({
        atoms: [
          first,
          duplicate,
        ],
        scopedRules: [],
      })
      compileAtomicCss(
        createStrings(
          'color:red;color:red;',
        ),
        [],
        false,
      )
      expect(
        mocks.runtime.atomicUsageCounts.get(
          'color:red',
        ),
      ).toBe(1)
    })
    it('does not cache threshold-dependent artifacts whose output changes with global usage history', () => {
      mocks.runtime.config.atomic.minUses =
        2
      mocks.collectRules.mockReturnValue({
        atoms: [
          createAtom(
            'color:red',
            'a-color',
          ),
        ],
        scopedRules: [],
      })
      compileAtomicCss(
        createStrings(
          'color:red;',
        ),
        [],
        false,
      )
      compileAtomicCss(
        createStrings(
          'color:red;',
        ),
        [],
        false,
      )
      expect(
        mocks.getCachedArtifact,
      ).not.toHaveBeenCalled()
      expect(
        mocks.setCachedArtifact,
      ).not.toHaveBeenCalled()
    })
    it('removes the single-use fallback bookkeeping once an atom becomes globally promoted', () => {
      mocks.runtime.config.atomic.minUses = 2
      const atom = createAtom('color:red', 'a-color')
      partitionPromotedAtoms([atom], 'cp-s-first')
      expect(mocks.runtime.atomicSingleUseFallbacks.get(atom.id)).toBe(atom)
      const promoted = partitionPromotedAtoms([atom], 'cp-s-second')
      expect(promoted.atoms).toEqual([atom])
      expect(mocks.runtime.atomicSingleUseFallbacks.has(atom.id)).toBe(false)
    })
    it('retains the latest fallback representation for duplicate atom ids across component uses', () => {
      mocks.runtime.config.atomic.minUses = 3
      const first = createAtom('color:red', 'a-first')
      const latest = {
        ...createAtom('color:red', 'a-latest'),
        source: 'color: red /* latest */',
      }
      partitionPromotedAtoms([first], 'cp-s-first')
      partitionPromotedAtoms([latest], 'cp-s-second')
      expect(mocks.runtime.atomicSingleUseFallbacks.get('color:red')).toBe(latest)
    })
    it('treats usage counts and single-use fallbacks as resettable build-lifecycle state', () => {
      mocks.runtime.config.atomic.minUses = 2
      const atom = createAtom('color:red', 'a-color')
      partitionPromotedAtoms([atom], 'cp-s-first')
      expect(mocks.runtime.atomicUsageCounts.size).toBe(1)
      expect(mocks.runtime.atomicSingleUseFallbacks.size).toBe(1)
      mocks.runtime.atomicUsageCounts.clear()
      mocks.runtime.atomicSingleUseFallbacks.clear()
      expect(mocks.runtime.atomicUsageCounts.size).toBe(0)
      expect(mocks.runtime.atomicSingleUseFallbacks.size).toBe(0)
    })
  })
})
function createStrings(
  ...parts: string[]
): TemplateStringsArray {
  const strings =
    [...parts] as unknown as TemplateStringsArray
  Object.defineProperty(
    strings,
    'raw',
    {
      value: [...parts],
    },
  )
  return strings
}
function createAtom(
  id: string,
  className: string,
  context: CipoRuleContext = {},
): CipoAtomicRule {
  const colon =
    id.indexOf(':')
  const property =
    colon >= 0
      ? id.slice(0, colon)
      : id
  const value =
    colon >= 0
      ? id.slice(colon + 1)
      : ''
  return {
    id,
    className,
    property,
    value,
    source: id,
    context,
  } as CipoAtomicRule
}
function createScopedRule(
  selector: string,
): CipoScopedRule {
  return {
    selector,
    declarations: [
      {
        type: 'declaration',
        property: 'opacity',
        value: '0.5',
        source: 'opacity:0.5',
      },
    ],
    context: {},
  }
}
function createArtifact(
  overrides: Partial<CipoCssArtifact> = {},
): CipoCssArtifact {
  const className =
    overrides.className
    ?? 'cached-class'
  return {
    kind: 'cipo.css',
    className,
    scopeClassName:
      'cp-s-cached',
    atoms: [],
    scopedRules: [],
    rawCss: 'color:red;',
    transformedCss:
      'color:red;',
    compiledCss:
      '.cached-class{color:red}',
    debug: {
      id: 'cached-artifact',
      ast: [],
      atoms: [],
      scopedRules: [],
      warnings: [],
    },
    toString: () => className,
    [Symbol.toPrimitive]:
      () => className,
    [Symbol.toStringTag]:
      'CipoCssArtifact',
    ...overrides,
  } as CipoCssArtifact
}
function serializeContext(
  context: CipoRuleContext,
): string {
  return JSON.stringify(context)
}
