import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plugin } from 'vite'
import type {
  CipoCompiledBuildManifestEntry,
  CipoCompiledBuildResult,
} from '../../compiler/build/compile'
import type { CipoCompiledInlineSourceResult } from '../../compiler/inline/source-compile'
import type { CipoCompiledCssConfig } from '../../compiled-config'
const mocks = vi.hoisted(() => {
  const states: Array<{
    atomicEntries: unknown[]
    cssChunks: string[]
    manifests: unknown[]
    finalized?: unknown
  }> = []
  return {
    states,
    compileCipoSourceBuild: vi.fn(),
    compileCipoSourceInline: vi.fn(),
    optimizeCompiledCss: vi.fn(),
    compileGlobalAtomicStyles: vi.fn(),
    compileCssConfigPayload: vi.fn(),
    hashString64: vi.fn(),
    createLineSourceMap: vi.fn(),
    createCipoViteBuildState: vi.fn(),
    resetCipoViteBuildState: vi.fn(),
    replaceCompiledClassLiterals: vi.fn(),
    assertGeneratedNameIdentity: vi.fn(),
  }
})
vi.mock(
  '../../compiler/build/compile',
  () => ({
    compileCipoSourceBuild:
      mocks.compileCipoSourceBuild,
  }),
)
vi.mock(
  '../../compiler/inline/source-compile',
  () => ({
    compileCipoSourceInline:
      mocks.compileCipoSourceInline,
  }),
)
vi.mock(
  '../../engine/optimizer',
  () => ({
    optimizeCompiledCss:
      mocks.optimizeCompiledCss,
  }),
)
vi.mock(
  '../../compiler/atomic/global',
  () => ({
    compileGlobalAtomicStyles:
      mocks.compileGlobalAtomicStyles,
  }),
)
vi.mock(
  '../../config-css/parse',
  () => ({
    compileCssConfigPayload:
      mocks.compileCssConfigPayload,
  }),
)
vi.mock(
  '../../utils',
  async () => {
    const actual =
      await vi.importActual<
        typeof import('../../utils')
      >('../../utils')
    return {
      ...actual,
      hashString64:
        mocks.hashString64,
    }
  },
)
vi.mock(
  '../../compiler/source-map',
  () => ({
    createLineSourceMap:
      mocks.createLineSourceMap,
  }),
)
vi.mock(
  './build-state',
  () => ({
    createCipoViteBuildState:
      mocks.createCipoViteBuildState,
    resetCipoViteBuildState:
      mocks.resetCipoViteBuildState,
  }),
)
vi.mock(
  './chunk-rewrite',
  () => ({
    replaceCompiledClassLiterals:
      mocks.replaceCompiledClassLiterals,
  }),
)
vi.mock(
  '../../engine/hash-registry',
  () => ({
    assertGeneratedNameIdentity:
      mocks.assertGeneratedNameIdentity,
  }),
)
import { cipoVite } from './plugin'
describe('cipoVite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.states.length = 0
    mocks.createCipoViteBuildState.mockImplementation(
      () => {
        const state = {
          atomicEntries: [],
          cssChunks: [],
          manifests: [],
          finalized: undefined,
        }
        mocks.states.push(state)
        return state
      },
    )
    mocks.resetCipoViteBuildState.mockImplementation(
      (state: {
        atomicEntries: unknown[]
        cssChunks: string[]
        manifests: unknown[]
        finalized?: unknown
      }) => {
        state.atomicEntries.length = 0
        state.cssChunks.length = 0
        state.manifests.length = 0
        state.finalized = undefined
      },
    )
    mocks.compileCipoSourceBuild.mockImplementation(
      (
        code: string,
      ): CipoCompiledBuildResult =>
        ({
          code,
          css: '',
          changed: false,
          manifest: [],
        }) as CipoCompiledBuildResult,
    )
    mocks.compileCipoSourceInline.mockImplementation(
      (
        code: string,
      ): CipoCompiledInlineSourceResult =>
        ({
          code,
          changed: false,
          manifest: [],
        }) as CipoCompiledInlineSourceResult,
    )
    mocks.compileCssConfigPayload.mockReturnValue(
      null,
    )
    mocks.compileGlobalAtomicStyles.mockReturnValue({
      css: '',
      classNames: new Map(),
      minifyCss: false,
    })
    mocks.optimizeCompiledCss.mockImplementation(
      (css: string) => css,
    )
    mocks.hashString64.mockReturnValue(
      'abcdef1234567890',
    )
    mocks.createLineSourceMap.mockImplementation(
      (
        original: string,
        generated: string,
        filename: string,
      ) => ({
        version: 3,
        file: filename,
        sources: [
          filename,
        ],
        sourcesContent: [
          original,
        ],
        names: [],
        mappings:
          `map:${original.length}:${generated.length}`,
      }),
    )
    mocks.replaceCompiledClassLiterals.mockImplementation(
      (
        code: string,
        replacements: ReadonlyMap<
          string,
          string
        >,
      ) => {
        let output = code
        for (
          const [
            from,
            to,
          ]
          of replacements
        ) {
          output = output
            .split(from)
            .join(to)
        }
        return output
      },
    )
  })
  describe('plugin contract', () => {
    it('creates the build-mode Vite plugin by default', () => {
      const plugin = cipoVite()
      expect(plugin.name).toBe(
        'cipo:compiled-build',
      )
      expect(plugin.enforce).toBe(
        'pre',
      )
      expect(
        mocks.createCipoViteBuildState,
      ).toHaveBeenCalledTimes(1)
    })
    it('creates the inline-mode plugin when requested', () => {
      const plugin = cipoVite({
        mode: 'inline',
      })
      expect(plugin.name).toBe(
        'cipo:compiled-inline',
      )
      expect(plugin.enforce).toBe(
        'pre',
      )
    })
    it('creates isolated lifecycle state for every plugin instance', () => {
      cipoVite()
      cipoVite()
      expect(
        mocks.createCipoViteBuildState,
      ).toHaveBeenCalledTimes(2)
      expect(mocks.states).toHaveLength(2)
      expect(
        mocks.states[0],
      ).not.toBe(
        mocks.states[1],
      )
    })
    it('resets only its own build state on buildStart', () => {
      const plugin = cipoVite()
      const state =
        mocks.states[0]!
      state.cssChunks.push(
        '.old{color:red}',
      )
      state.manifests.push({
        id: 'old',
      })
      state.atomicEntries.push({
        id: 'atomic',
      })
      state.finalized = {
        css: 'old',
      }
      callHook(
        plugin.buildStart,
        {},
      )
      expect(
        mocks.resetCipoViteBuildState,
      ).toHaveBeenCalledWith(
        state,
      )
      expect(state.cssChunks).toEqual([])
      expect(state.manifests).toEqual([])
      expect(state.atomicEntries).toEqual([])
      expect(state.finalized).toBeUndefined()
    })
  })
  describe('virtual modules', () => {
    it('resolves the style-tag virtual module as side-effectful', () => {
      const plugin = cipoVite()
      expect(
        callHook(
          plugin.resolveId,
          {},
          '\0cipo:compiled-style-tag.js',
        ),
      ).toEqual({
        id:
          '\0cipo:compiled-style-tag.js',
        moduleSideEffects: true,
      })
    })
    it('resolves the CSS asset virtual module as side-effectful', () => {
      const plugin = cipoVite()
      expect(
        callHook(
          plugin.resolveId,
          {},
          '\0cipo:compiled.css',
        ),
      ).toEqual({
        id: '\0cipo:compiled.css',
        moduleSideEffects: true,
      })
    })
    it('does not resolve unrelated module ids', () => {
      const plugin = cipoVite()
      expect(
        callHook(
          plugin.resolveId,
          {},
          '/src/app.ts',
        ),
      ).toBeNull()
    })
    it('loads the style-tag runtime module with the global stylesheet sentinel', () => {
      const plugin = cipoVite()
      const result = callHook(
        plugin.load,
        {},
        '\0cipo:compiled-style-tag.js',
      )
      expect(result).toContain('@rodkisten/cipo/compiled-runtime')
      expect(result).toContain('insertCss')
      expect(result).toContain(
        '__CIPO_COMPILED_GLOBAL_STYLESHEET__',
      )
    })
    it('returns null when loading an unrelated module', () => {
      const plugin = cipoVite()
      expect(
        callHook(
          plugin.load,
          {},
          '/src/app.ts',
        ),
      ).toBeNull()
    })
  })
  describe('source filtering', () => {
    it('ignores transforms when the plugin is disabled', async () => {
      const plugin = cipoVite({
        enabled: false,
      })
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          'const value = 1',
          '/src/app.ts',
        )
      expect(result).toBeNull()
      expect(
        mocks.compileCipoSourceBuild,
      ).not.toHaveBeenCalled()
    })
    it.each([
      '/src/app.ts',
      '/src/app.tsx',
      '/src/app.js',
      '/src/app.jsx',
      '/src/app.mts',
      '/src/app.mjs',
      '/src/app.cts',
      '/src/app.cjs',
    ])(
      'includes supported source extension %s by default',
      async (id) => {
        const plugin = cipoVite({
          compileFabrica: false,
        })
        await callAsyncHook(
          plugin.transform,
          {},
          'const value = 1',
          id,
        )
        expect(
          mocks.compileCipoSourceBuild,
        ).toHaveBeenCalledTimes(1)
      },
    )
    it.each([
      '/src/style.css',
      '/src/data.json',
      '/src/image.svg',
      '/src/README.md',
    ])(
      'ignores unsupported source extension %s by default',
      async (id) => {
        const plugin = cipoVite({
          compileFabrica: false,
        })
        expect(
          await callAsyncHook(
            plugin.transform,
            {},
            'content',
            id,
          ),
        ).toBeNull()
        expect(
          mocks.compileCipoSourceBuild,
        ).not.toHaveBeenCalled()
      },
    )
    it('excludes node_modules by default', async () => {
      const plugin = cipoVite({
        compileFabrica: false,
      })
      expect(
        await callAsyncHook(
          plugin.transform,
          {},
          'const value = 1',
          '/project/node_modules/pkg/index.ts',
        ),
      ).toBeNull()
      expect(
        mocks.compileCipoSourceBuild,
      ).not.toHaveBeenCalled()
    })
    it('honors custom include and exclude patterns', async () => {
      const plugin = cipoVite({
        include: [
          /\/components\//,
          /\/pages\//,
        ],
        exclude:
          /\.test\.tsx$/,
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'const A = 1',
        '/src/components/A.tsx',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'const B = 1',
        '/src/pages/B.tsx',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'const Test = 1',
        '/src/components/A.test.tsx',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'const Other = 1',
        '/src/lib/other.tsx',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledTimes(2)
    })
    it('resets lastIndex for global include RegExp instances', async () => {
      const include =
        /\.tsx$/g
      const plugin = cipoVite({
        include,
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'const A = 1',
        '/src/A.tsx',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'const B = 1',
        '/src/B.tsx',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledTimes(2)
    })
    it('cleans Vite query strings before matching and compiling filenames', async () => {
      const plugin = cipoVite({
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'const App = 1',
        '/src/App.tsx?direct&v=123',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        'const App = 1',
        expect.objectContaining({
          filename:
            '/src/App.tsx',
        }),
      )
    })
    it('decodes file:// ids before passing the filename to the compiler', async () => {
      const plugin = cipoVite({
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'const App = 1',
        'file:///project/My%20App.tsx?direct',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        'const App = 1',
        expect.objectContaining({
          filename:
            '/project/My App.tsx',
        }),
      )
    })
  })
  describe('inline mode', () => {
    it('delegates source transformation to the inline compiler', async () => {
      mocks.compileCipoSourceInline.mockReturnValue({
        code:
          'const compiled = true',
        changed: true,
        manifest: [
          {
            id: 'inline-entry',
          },
        ],
      })
      const plugin = cipoVite({
        mode: 'inline',
        evaluateStaticCss: true,
      })
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          'const source = true',
          '/src/app.tsx',
        )
      expect(
        mocks.compileCipoSourceInline,
      ).toHaveBeenCalledWith(
        'const source = true',
        {
          filename:
            '/src/app.tsx',
          importPath:
            '@rodkisten/cipo/compiler',
          evaluateStaticCss: true,
        },
      )
      expect(result).toMatchObject({
        code:
          'const compiled = true',
        meta: {
          cipo:
            expect.objectContaining({
              changed: true,
            }),
        },
      })
      expect(
        mocks.createLineSourceMap,
      ).toHaveBeenCalledWith(
        'const source = true',
        'const compiled = true',
        '/src/app.tsx',
      )
      expect(
        mocks.states[0]?.manifests,
      ).toEqual([
        {
          id: 'inline-entry',
        },
      ])
    })
    it('returns null when the inline compiler makes no changes', async () => {
      const plugin = cipoVite({
        mode: 'inline',
      })
      expect(
        await callAsyncHook(
          plugin.transform,
          {},
          'const value = 1',
          '/src/app.ts',
        ),
      ).toBeNull()
      expect(
        mocks.createLineSourceMap,
      ).not.toHaveBeenCalled()
    })
  })
  describe('build-mode transform', () => {
    it('passes build compiler options through with package-safe runtime entrypoints', async () => {
      const plugin = cipoVite({
        compileFabrica: false,
        classPrefix: 'app',
        classNameMode: 'readable',
        minifyCss: true,
        mergeEquivalentRules: false,
        privateCustomPropertyPattern:
          /^--private-/,
        transformCssTag: false,
        directComponentReferences: true,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'const value = 1',
        '/src/app.tsx',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        'const value = 1',
        expect.objectContaining({
          filename:
            '/src/app.tsx',
          classPrefix: 'app',
          buildNamespace:
            'abcdef',
          classNameMode:
            'readable',
          minifyCss: true,
          mergeEquivalentRules:
            false,
          privateCustomPropertyPattern:
            /^--private-/,
          deferAtomicCss: false,
          coupleStyledCss: true,
          styledCssHelperImportPath:
            '@rodkisten/cipo/compiled-runtime',
          cssImportId:
            '\0cipo:compiled.css',
          injectCssImport: false,
          transformCssTag: false,
        }),
      )
    })
    it('returns null when runtime config, Cipó and Fábrica all remain unchanged', async () => {
      const plugin = cipoVite({
        compileFabrica: false,
      })
      expect(
        await callAsyncHook(
          plugin.transform,
          {},
          'const value = 1',
          '/src/app.ts',
        ),
      ).toBeNull()
    })
    it('returns transformed Cipó source and a source map when the build compiler changes code', async () => {
      const cipoResult = {
        code:
          'const compiled = true',
        css:
          '.compiled{color:red}',
        changed: true,
        manifest: [
          {
            id: 'entry',
          },
        ],
      } as unknown as CipoCompiledBuildResult
      mocks.compileCipoSourceBuild.mockReturnValue(
        cipoResult,
      )
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'asset',
      })
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          'const source = true',
          '/src/app.ts',
        )
      expect(result).toMatchObject({
        code:
          'const compiled = true',
        meta: {
          cipo: cipoResult,
        },
      })
      expect(
        mocks.createLineSourceMap,
      ).toHaveBeenCalledWith(
        'const source = true',
        'const compiled = true',
        '/src/app.ts',
      )
      expect(
        mocks.states[0]?.cssChunks,
      ).toEqual([
        '.compiled{color:red}',
      ])
      expect(
        mocks.states[0]?.manifests,
      ).toEqual([
        {
          id: 'entry',
        },
      ])
    })
    it('prepends style-tag injection for per-module CSS when asset delivery is not requested', async () => {
      mocks.compileCipoSourceBuild.mockReturnValue({
        code:
          'export const Button = compiled',
        css:
          '.button{color:red}',
        changed: true,
        manifest: [],
      })
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'style-tag',
      })
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          'export const Button = source',
          '/src/button.ts',
        )
      expect(result?.code).toContain(
        'import { insertCss as __cipoInsertCompiledCss } from "@rodkisten/cipo/compiled-runtime";',
      )
      expect(result?.code).toContain(
        '__cipoInsertCompiledCss(".button{color:red}");',
      )
      expect(result?.code).toContain(
        'export const Button = compiled',
      )
    })
    it('does not prepend style injection for CSS asset delivery', async () => {
      mocks.compileCipoSourceBuild.mockReturnValue({
        code:
          'export const Button = compiled',
        css:
          '.button{color:red}',
        changed: true,
        manifest: [],
      })
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'asset',
      })
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          'source',
          '/src/button.ts',
        )
      expect(result?.code).toBe(
        'export const Button = compiled',
      )
      expect(result?.code).not.toContain(
        '__cipoInsertCompiledCss',
      )
    })
  })
  describe('runtime configuration lowering', () => {
    const payload: CipoCompiledCssConfig = {
      operations: [
        [
          0,
          {
            prefix: 'app',
          },
        ],
      ],
    } as CipoCompiledCssConfig
    it('lowers literal configureFromCss calls into configureCompiledCssConfig calls', async () => {
      mocks.compileCssConfigPayload.mockReturnValue(
        payload,
      )
      mocks.compileCipoSourceBuild.mockImplementation(
        (
          code: string,
        ) =>
          ({
            code,
            css: '',
            changed: false,
            manifest: [],
          }) as CipoCompiledBuildResult,
      )
      const plugin = cipoVite({
        compileFabrica: false,
      })
      const source = `
        import {
          configureFromCss,
        } from '@rodkisten/cipo'
        configureFromCss(
          '@cipo { prefix: app; }',
        )
      `
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          source,
          '/src/config.ts',
        )
      const compilerInput =
        mocks.compileCipoSourceBuild.mock
          .calls[0]?.[0] as string
      expect(compilerInput).toContain(
        'configureCompiledCssConfig',
      )
      expect(compilerInput).toContain(
        '@rodkisten/cipo/compiled-runtime',
      )
      expect(compilerInput).not.toContain(
        'configureFromCss(',
      )
      expect(result).not.toBeNull()
      expect(result?.code).toContain(
        'configureCompiledCssConfig',
      )
    })
    it('lowers explicitly trusted identifier configuration bindings', async () => {
      mocks.compileCssConfigPayload.mockReturnValue(
        payload,
      )
      mocks.compileCipoSourceBuild.mockImplementation(
        (
          code: string,
        ) =>
          ({
            code,
            css: '',
            changed: false,
            manifest: [],
          }) as CipoCompiledBuildResult,
      )
      const plugin = cipoVite({
        compileFabrica: false,
        configCss:
          '@cipo { prefix: app; }',
        configRuntimeBindings: [
          'applicationCss',
        ],
      })
      const source = `
        import {
          configureFromCss,
        } from '@rodkisten/cipo'
        const applicationCss =
          getApplicationCss()
        configureFromCss(
          applicationCss,
        )
      `
      const result =
        await callAsyncHook(
          plugin.transform,
          {},
          source,
          '/src/config.ts',
        )
      const compilerInput =
        mocks.compileCipoSourceBuild.mock
          .calls[0]?.[0] as string
      expect(compilerInput).toContain(
        'configureCompiledCssConfig',
      )
      expect(compilerInput).not.toContain(
        'configureFromCss(',
      )
      expect(result).not.toBeNull()
    })
    it('does not lower untrusted identifier arguments merely because configCss exists', async () => {
      mocks.compileCssConfigPayload.mockReturnValue(
        payload,
      )
      const plugin = cipoVite({
        compileFabrica: false,
        configCss:
          '@cipo { prefix: app; }',
        configRuntimeBindings: [
          'applicationCss',
        ],
      })
      const source = `
        import {
          configureFromCss,
        } from '@rodkisten/cipo'
        configureFromCss(
          unrelatedCss,
        )
      `
      await callAsyncHook(
        plugin.transform,
        {},
        source,
        '/src/config.ts',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          'configureFromCss',
        ),
        expect.any(Object),
      )
    })
    it('does not lower configureFromCss imported from another package', async () => {
      const plugin = cipoVite({
        compileFabrica: false,
      })
      const source = `
        import {
          configureFromCss,
        } from '@other/package'
        configureFromCss(
          '@cipo { prefix: app; }',
        )
      `
      await callAsyncHook(
        plugin.transform,
        {},
        source,
        '/src/config.ts',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        source,
        expect.any(Object),
      )
    })
    it('does not lower runtime-dependent CSS config payloads', async () => {
      mocks.compileCssConfigPayload.mockReturnValue(
        null,
      )
      const plugin = cipoVite({
        compileFabrica: false,
      })
      const source = `
        import {
          configureFromCss,
        } from '@rodkisten/cipo'
        configureFromCss(
          '@plugin application;',
        )
      `
      await callAsyncHook(
        plugin.transform,
        {},
        source,
        '/src/config.ts',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        source,
        expect.any(Object),
      )
    })
  })
  describe('build namespace', () => {
    it('derives the build namespace from an explicit namespace first', async () => {
      mocks.hashString64.mockImplementation(
        (value: string) =>
          `hash:${value}:rest`,
      )
      const plugin = cipoVite({
        buildNamespace:
          'microfrontend-orders',
        configCss:
          '@cipo { prefix: app; }',
        root:
          '/deprecated-root',
        classPrefix:
          'deprecated-prefix',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'const value = 1',
        '/src/app.ts',
      )
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        'microfrontend-orders',
      )
    })
    it('falls back to configCss when no explicit build namespace exists', () => {
      mocks.hashString64.mockClear()
      cipoVite({
        configCss:
          '@cipo { prefix: app; }',
      })
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        '@cipo { prefix: app; }',
      )
    })
    it('uses a stable cipo fallback when no namespace source is configured', () => {
      mocks.hashString64.mockClear()
      cipoVite()
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        'cipo',
      )
    })
  })
  describe('non-whole-build CSS assets', () => {
    it('deduplicates collected CSS chunks in the virtual CSS asset module', async () => {
      mocks.compileCipoSourceBuild
        .mockReturnValueOnce({
          code: 'first',
          css:
            ' .shared{color:red} ',
          changed: true,
          manifest: [],
        })
        .mockReturnValueOnce({
          code: 'second',
          css:
            '.shared{color:red}',
          changed: true,
          manifest: [],
        })
        .mockReturnValueOnce({
          code: 'third',
          css:
            '.unique{color:blue}',
          changed: true,
          manifest: [],
        })
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'asset',
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'first-source',
        '/src/first.ts',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'second-source',
        '/src/second.ts',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'third-source',
        '/src/third.ts',
      )
      expect(
        callHook(
          plugin.load,
          {},
          '\0cipo:compiled.css',
        ),
      ).toBe([
        '.shared{color:red}',
        '.unique{color:blue}',
      ].join('\n'))
    })
    it('emits a deduplicated CSS asset with the configured file name', async () => {
      mocks.compileCipoSourceBuild
        .mockReturnValueOnce({
          code: 'first',
          css:
            '.shared{color:red}',
          changed: true,
          manifest: [],
        })
        .mockReturnValueOnce({
          code: 'second',
          css:
            '.shared{color:red}',
          changed: true,
          manifest: [],
        })
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'asset',
        cssFileName:
          'assets/cipo.css',
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'first',
        '/src/first.ts',
      )
      await callAsyncHook(
        plugin.transform,
        {},
        'second',
        '/src/second.ts',
      )
      const emitFile = vi.fn()
      callHook(
        plugin.generateBundle,
        {
          emitFile,
        },
        {},
        {},
      )
      expect(emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName:
          'assets/cipo.css',
        source:
          '.shared{color:red}\n',
      })
    })
    it('does not emit an empty CSS asset', () => {
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'asset',
      })
      const emitFile = vi.fn()
      callHook(
        plugin.generateBundle,
        {
          emitFile,
        },
        {},
        {},
      )
      expect(emitFile).not.toHaveBeenCalled()
    })
    it('emits a build manifest when transformed entries exist', async () => {
      mocks.compileCipoSourceBuild.mockReturnValue({
        code: 'compiled',
        css: '',
        changed: true,
        manifest: [
          {
            id: 'entry-one',
            kind: 'styled-css',
          },
        ],
      })
      const plugin = cipoVite({
        compileFabrica: false,
        manifestFileName:
          'manifest/cipo.json',
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      const emitFile = vi.fn()
      callHook(
        plugin.generateBundle,
        {
          emitFile,
        },
        {},
        {},
      )
      expect(emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName:
          'manifest/cipo.json',
        source: `${
          JSON.stringify(
            {
              mode: 'build',
              entries: [
                {
                  id: 'entry-one',
                  kind: 'styled-css',
                },
              ],
            },
            null,
            2,
          )
        }\n`,
      })
    })
  })
  describe('whole-build atomic mode', () => {
    const styledEntry = {
      id: 'rule-one',
      kind: 'styled-css',
      className:
        '__temporary-class__',
      rawCss:
        'color:red;',
      filename:
        '/src/button.ts',
      receiver: 'Button',
    } as unknown as CipoCompiledBuildManifestEntry
    beforeEach(() => {
      mocks.compileCssConfigPayload.mockReturnValue({
        operations: [],
      })
      mocks.compileCipoSourceBuild.mockReturnValue({
        code:
          'export const className = "__temporary-class__"',
        css:
          '.local{display:block}',
        changed: true,
        manifest: [
          styledEntry,
        ],
      })
      mocks.compileGlobalAtomicStyles.mockReturnValue({
        css:
          '.global{color:red}',
        classNames: new Map([
          [
            '__temporary-class__',
            'cp-a-final',
          ],
        ]),
        minifyCss: true,
      })
      mocks.optimizeCompiledCss.mockReturnValue(
        '.optimized{color:red}',
      )
    })
    it('enables deferred atomic compilation when build mode receives configCss', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/button.ts',
      )
      expect(
        mocks.compileCipoSourceBuild,
      ).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          deferAtomicCss: true,
          coupleStyledCss: false,
          cssImportId:
            '\0cipo:compiled-style-tag.js',
          injectCssImport: true,
        }),
      )
    })
    it('returns an empty virtual CSS asset before finalization in whole-build mode', () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        cssDelivery: 'asset',
      })
      expect(
        callHook(
          plugin.load,
          {},
          '\0cipo:compiled.css',
        ),
      ).toBe('')
    })
    it('collects only atomic-capable manifest entries for global finalization', async () => {
      mocks.compileCipoSourceBuild.mockReturnValue({
        code: 'compiled',
        css: '',
        changed: true,
        manifest: [
          styledEntry,
          {
            id: 'other',
            kind:
              'non-atomic-entry',
            className: 'other',
          },
        ],
      })
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      await callAsyncHook(
        plugin.renderChunk,
        {},
        '__temporary-class__',
        {
          fileName:
            'assets/app.js',
        },
      )
      expect(
        mocks.compileGlobalAtomicStyles,
      ).toHaveBeenCalledWith(
        [
          {
            key: 'rule-one',
            className:
              '__temporary-class__',
            rawCss:
              'color:red;',
            filename:
              '/src/button.ts',
            receiver: 'Button',
          },
        ],
        {
          configCss:
            '@cipo { prefix: cp; }',
          buildNamespace:
            'abcdef',
        },
      )
    })
    it('optimizes finalized global atomic CSS together with collected CSS chunks', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
        minifyCss: false,
        mergeEquivalentRules: false,
        privateCustomPropertyPattern:
          /^--private-/,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      await callAsyncHook(
        plugin.renderChunk,
        {},
        'chunk',
        {
          fileName:
            'assets/app.js',
        },
      )
      expect(
        mocks.optimizeCompiledCss,
      ).toHaveBeenCalledWith(
        [
          '.global{color:red}',
          '.local{display:block}',
        ].join('\n'),
        {
          minify: false,
          mergeEquivalentRules:
            false,
          privateCustomPropertyPattern:
            /^--private-/,
        },
      )
    })
    it('rewrites temporary class literals and the stylesheet sentinel during renderChunk', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      const original = [
        'const cls = "__temporary-class__";',
        'const css = "__CIPO_COMPILED_GLOBAL_STYLESHEET__";',
      ].join('\n')
      const result =
        await callAsyncHook(
          plugin.renderChunk,
          {},
          original,
          {
            fileName:
              'assets/app.js',
          },
        )
      expect(result?.code).toContain(
        'cp-a-final',
      )
      expect(result?.code).toContain(
        '.optimized{color:red}',
      )
      expect(result?.code).not.toContain(
        '__temporary-class__',
      )
      expect(result?.code).not.toContain(
        '__CIPO_COMPILED_GLOBAL_STYLESHEET__',
      )
      expect(
        mocks.createLineSourceMap,
      ).toHaveBeenCalledWith(
        original,
        result?.code,
        'assets/app.js',
      )
    })
    it('returns null from renderChunk when no finalized replacement changes the chunk', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      expect(
        await callAsyncHook(
          plugin.renderChunk,
          {},
          'const untouched = true',
          {
            fileName:
              'assets/app.js',
          },
        ),
      ).toBeNull()
    })
    it('memoizes finalization until a later transform invalidates finalized state', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'first',
        '/src/first.ts',
      )
      await callAsyncHook(
        plugin.renderChunk,
        {},
        '__temporary-class__',
        {
          fileName:
            'first.js',
        },
      )
      await callAsyncHook(
        plugin.renderChunk,
        {},
        '__temporary-class__',
        {
          fileName:
            'second.js',
        },
      )
      expect(
        mocks.compileGlobalAtomicStyles,
      ).toHaveBeenCalledTimes(1)
      await callAsyncHook(
        plugin.transform,
        {},
        'second',
        '/src/second.ts',
      )
      await callAsyncHook(
        plugin.renderChunk,
        {},
        '__temporary-class__',
        {
          fileName:
            'third.js',
        },
      )
      expect(
        mocks.compileGlobalAtomicStyles,
      ).toHaveBeenCalledTimes(2)
    })
    it('rewrites emitted bundle chunks during generateBundle', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      const bundle = {
        'app.js': {
          type: 'chunk',
          code: [
            '__temporary-class__',
            '__CIPO_COMPILED_GLOBAL_STYLESHEET__',
          ].join('|'),
        },
        'style.css': {
          type: 'asset',
          source: 'untouched',
        },
      }
      callHook(
        plugin.generateBundle,
        {
          emitFile: vi.fn(),
        },
        {},
        bundle,
      )
      expect(
        bundle['app.js'].code,
      ).toBe(
        'cp-a-final|.optimized{color:red}',
      )
      expect(
        bundle['style.css'].source,
      ).toBe('untouched')
    })
    it('rewrites manifest class names to finalized global atomic class names', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
        manifestFileName:
          'cipo-manifest.json',
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      const emitFile = vi.fn()
      callHook(
        plugin.generateBundle,
        {
          emitFile,
        },
        {},
        {},
      )
      const manifestCall =
        emitFile.mock.calls.find(
          ([asset]) =>
            asset.fileName
            === 'cipo-manifest.json',
        )
      expect(
        manifestCall,
      ).toBeDefined()
      const emitted =
        JSON.parse(
          String(
            manifestCall?.[0].source,
          ),
        )
      expect(
        emitted.entries[0].className,
      ).toBe(
        'cp-a-final',
      )
    })
    it('emits finalized CSS instead of per-module CSS when asset delivery is enabled', async () => {
      const plugin = cipoVite({
        configCss:
          '@cipo { prefix: cp; }',
        compileFabrica: false,
        cssDelivery: 'asset',
        cssFileName:
          'assets/final.css',
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      const emitFile = vi.fn()
      callHook(
        plugin.generateBundle,
        {
          emitFile,
        },
        {},
        {},
      )
      expect(emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName:
          'assets/final.css',
        source:
          '.optimized{color:red}\n',
      })
    })
  })
  describe('build lifecycle isolation', () => {
    it('clears accumulated CSS and manifests between Vite builds', async () => {
      mocks.compileCipoSourceBuild.mockReturnValue({
        code: 'compiled',
        css:
          '.first{color:red}',
        changed: true,
        manifest: [
          {
            id: 'first',
          },
        ],
      })
      const plugin = cipoVite({
        compileFabrica: false,
        cssDelivery: 'asset',
      })
      await callAsyncHook(
        plugin.transform,
        {},
        'source',
        '/src/app.ts',
      )
      expect(
        mocks.states[0]?.cssChunks,
      ).toHaveLength(1)
      expect(
        mocks.states[0]?.manifests,
      ).toHaveLength(1)
      callHook(
        plugin.buildStart,
        {},
      )
      expect(
        mocks.states[0]?.cssChunks,
      ).toEqual([])
      expect(
        mocks.states[0]?.manifests,
      ).toEqual([])
    })
  })
  describe('regression contracts', () => {
    it('keeps Fábrica compilation opt-in for runtime-only Cipó consumers', async () => {
      const plugin = cipoVite()
      await expect(
        callAsyncHook(plugin.transform, {}, 'source', '/src/app.ts'),
      ).resolves.toBeNull()
    })
    it('invalidates whole-build finalization when a later module contributes CSS even if cipo.changed is false', async () => {
      const plugin = cipoVite({
        configCss: '@cipo { prefix: cp; }',
        compileFabrica: false,
      })
      await callAsyncHook(plugin.renderChunk, {}, 'untouched', { fileName: 'first.js' })
      expect(mocks.compileGlobalAtomicStyles).toHaveBeenCalledTimes(1)
      mocks.compileCipoSourceBuild.mockReturnValueOnce({
        code: 'source',
        css: '.late{color:red}',
        changed: false,
        manifest: [],
      })
      await callAsyncHook(plugin.transform, {}, 'source', '/src/late.ts')
      await callAsyncHook(plugin.renderChunk, {}, 'untouched', { fileName: 'second.js' })
      expect(mocks.compileGlobalAtomicStyles).toHaveBeenCalledTimes(2)
    })
    it('guards build namespace hashes through the generated-name collision registry', () => {
      cipoVite({ buildNamespace: 'application-one' })
      expect(mocks.assertGeneratedNameIdentity).toHaveBeenCalledWith(
        'cipo-build-abcdef',
        'build-namespace|application-one',
      )
    })
    it('maps the original module directly to the final transformed source after all plugin stages', async () => {
      mocks.compileCssConfigPayload.mockReturnValue({ operations: [] } as CipoCompiledCssConfig)
      mocks.compileCipoSourceBuild.mockImplementation((code: string) => ({
        code: `${code}
compiled`,
        css: '',
        changed: true,
        manifest: [],
      }) as CipoCompiledBuildResult)
      const plugin = cipoVite({
        compileFabrica: false,
        configCss: '@cipo { prefix: cp; }',
      })
      const source = `import { configureFromCss } from '@rodkisten/cipo'
configureFromCss('@cipo { prefix: cp; }')`
      const result = await callAsyncHook(plugin.transform, {}, source, '/src/app.ts')
      expect(mocks.createLineSourceMap).toHaveBeenLastCalledWith(
        source,
        result?.code,
        '/src/app.ts',
      )
    })
  })
})
/**
 * Vite hook fields may be plain functions or object hooks with a `handler`.
 * The production plugin currently returns plain functions, but this helper
 * keeps tests resilient to a future migration to object hook syntax.
 */
function getHook(
  hook:
    | unknown
    | {
        handler?: unknown
      },
): (...args: any[]) => any {
  if (
    hook
    && typeof hook === 'object'
    && 'handler' in hook
  ) {
    const handler =
      (
        hook as {
          handler?: unknown
        }
      ).handler
    if (
      typeof handler
      === 'function'
    ) {
      return handler as (
        ...args: any[]
      ) => any
    }
  }
  if (
    typeof hook === 'function'
  ) {
    return hook as (
      ...args: any[]
    ) => any
  }
  throw new Error(
    'Expected a callable Vite plugin hook.',
  )
}
function callHook(
  hook: unknown,
  context: object,
  ...args: any[]
): any {
  return getHook(
    hook,
  ).call(
    context,
    ...args,
  )
}
async function callAsyncHook(
  hook: unknown,
  context: object,
  ...args: any[]
): Promise<any> {
  return await Promise.resolve(
    callHook(
      hook,
      context,
      ...args,
    ),
  )
}
