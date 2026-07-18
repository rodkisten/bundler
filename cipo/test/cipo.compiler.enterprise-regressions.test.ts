/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import { configureFromCss, registerHelper, reset, setup } from '@rodkisten/cipo'
import {
  CipoCompileError,
  compileCipoSourceBuild,
  ensureNamedImportBinding,
  assertGeneratedNameIdentity,
  findBareCssTemplates,
  findStyledCssTemplates,
  resetGeneratedNameRegistry,
  optimizeCompiledCss,
  compileSheetCss,
  compileCssConfigPayload,
} from '@rodkisten/cipo/compiler'
import { cipoVite } from '@rodkisten/cipo/vite'
import { replaceCompiledClassLiterals } from '../integrations/vite/chunk-rewrite'
import { runtime } from '../runtime'
import {
  canonicalizeCssForIdentity,
  minifyCssText,
  stripCipoComments,
} from '../syntax/css-lexer'

function template(value: string): TemplateStringsArray {
  return [value] as unknown as TemplateStringsArray
}

describe('Cipó enterprise compiler regressions', () => {
  beforeEach(() => {
    resetGeneratedNameRegistry()
    reset()
    setup({ prefix: 'runtime', minify: false, scope: { strategy: 'none', selector: '' } })
  })

  it('never merges non-adjacent equivalent rules across a cascade boundary', () => {
    const source = '.a{color:red}.b{color:blue}.c{color:red}'
    expect(optimizeCompiledCss(source)).toBe(source)

    expect(optimizeCompiledCss('.a{color:red}.c{color:red}.b{color:blue}')).toBe(
      '.a,.c{color:red}.b{color:blue}',
    )
  })

  it('preserves strings and protocol-relative URLs during canonicalization and minification', () => {
    const source = `.a {
      content: "a : b ; c, d";
      --label: "x + y";
      background-image: url(//cdn.example.com/a.png);
    }`
    const minified = minifyCssText(source)

    expect(minified).toContain('content:"a : b ; c, d"')
    expect(minified).toContain('--label:"x + y"')
    expect(minified).toContain('url(//cdn.example.com/a.png)')
    expect(canonicalizeCssForIdentity('content: "a : b"')).not.toBe(
      canonicalizeCssForIdentity('content: "a:b"'),
    )
    expect(stripCipoComments('background:url(//cdn.example.com/x.png); // comment\ncolor:red')).toContain(
      'url(//cdn.example.com/x.png)',
    )
  })

  it('does not execute CSS-first directives that appear only inside comments', () => {
    const payload = compileCssConfigPayload(`
      /* @cipo { prefix: fake; minify: false; } */
      // @theme { colors: (fake: red); }
      @cipo { prefix: real; minify: true; }
    `)

    expect(JSON.stringify(payload)).toContain('real')
    expect(JSON.stringify(payload)).not.toContain('fake')
  })

  it('parses block structure without treating braces inside strings or comments as syntax', () => {
    const artifact = compileSheetCss(template(`
      .card {
        content: "}";
        /* } commented structural noise */
        color: red;
      }
    `), [], false)

    expect(artifact.cssText).toContain('content: "}"')
    expect(artifact.cssText).toContain('color: red')
  })

  it('never mangles a private custom property onto an existing public custom property', () => {
    const optimized = optimizeCompiledCss(
      '.x{--a:blue;--_cipo-private:red;color:var(--_cipo-private)}',
      { minify: true, privateCustomPropertyPattern: /^--_cipo-/ },
    )

    expect(optimized).toContain('--a:blue')
    expect(optimized).not.toContain('--_cipo-private')
    expect(optimized).not.toContain('--a:red')
    expect(optimized).toContain('color:var(--b)')
  })

  it('keeps optimizer output idempotent across a punctuation-heavy CSS corpus', () => {
    const corpus = [
      `.a { content: "a : b ; c, d"; color: red; }`,
      `.a { background: url(//cdn.example.com/a.png); --x: "1 + 2"; }`,
      `@media (min-width: 10px) { .a { color:red } .b { color:blue } }`,
      `@supports (display:grid) { .a { display:grid } }`,
      `@keyframes pulse { from { opacity:0 } 50% { opacity:.5 } to { opacity:1 } }`,
    ]

    for (const source of corpus) {
      const once = optimizeCompiledCss(source, { minify: true, mergeEquivalentRules: true })
      const twice = optimizeCompiledCss(once, { minify: true, mergeEquivalentRules: true })
      expect(twice).toBe(once)
    }
  })

  it('keeps keyframe selectors outside configured component scoping', () => {
    setup({ scope: { strategy: 'where', selector: '#app' }, minify: true })
    const artifact = compileSheetCss(template(`
      @keyframes fade {
        from { opacity: 0 }
        50% { opacity: .5 }
        to { opacity: 1 }
      }
      .card { animation: fade 1s linear }
    `), [], false)

    expect(artifact.cssText).toContain('@keyframes fade{from{opacity:0}50%{opacity:.5}to{opacity:1}}')
    expect(artifact.cssText).toContain(':where(#app) .card')
    expect(artifact.cssText).not.toContain(':where(#app) from')
    expect(artifact.cssText).not.toContain(':where(#app) 50%')
  })

  it('isolates compile-time config and caches from the application runtime', () => {
    const beforeConfig = structuredClone(runtime.config)
    const beforeRegistryVersion = runtime.registryVersion
    const beforeArtifactCount = runtime.artifactCache.size

    const result = compileCipoSourceBuild(
      `const Card = styled.div('Card').css\`color: red;\``,
      {
        filename: '/src/card.ts',
        configCss: '@cipo { prefix: build; minify: true; }',
        injectCssImport: false,
      },
    )

    expect(result.changed).toBe(true)
    expect(result.css).toContain('.build-Card-')
    expect(runtime.config).toEqual(beforeConfig)
    expect(runtime.registryVersion).toBe(beforeRegistryVersion)
    expect(runtime.artifactCache.size).toBe(beforeArtifactCount)
  })

  it('reapplies cached CSS-first configuration inside an isolated compiler runtime', () => {
    const configCss = '@cipo { prefix: cached; minify: true; }'
    configureFromCss(configCss)
    runtime.generatedCssText = 'APP-RUNTIME-SENTINEL'
    runtime.atomicCache.set('sentinel', {
      id: 'sentinel',
      className: 'sentinel',
      property: 'color',
      value: 'hotpink',
      context: {},
      source: 'color:hotpink',
    })

    const result = compileCipoSourceBuild(
      `const Card = styled.div('Card').css\`color: red;\``,
      { filename: '/src/cached.ts', configCss, injectCssImport: false },
    )

    expect(result.css).toContain('.cached')
    expect(runtime.generatedCssText).toBe('APP-RUNTIME-SENTINEL')
    expect(runtime.atomicCache.has('sentinel')).toBe(true)
  })

  it('is deterministic regardless of compilation order', () => {
    const compile = (name: string, prefix: string) => compileCipoSourceBuild(
      `const ${name} = styled.div('${name}').css\`color: red;\``,
      {
        filename: `/src/${name}.ts`,
        configCss: `@cipo { prefix: ${prefix}; minify: true; }`,
        injectCssImport: false,
      },
    )

    const a1 = compile('Alpha', 'aa')
    const b1 = compile('Beta', 'bb')
    resetGeneratedNameRegistry()
    const b2 = compile('Beta', 'bb')
    const a2 = compile('Alpha', 'aa')

    expect(a2).toEqual(a1)
    expect(b2).toEqual(b1)
  })

  it('fails loudly when two different canonical rules claim the same generated identifier', () => {
    assertGeneratedNameIdentity('collision-probe', 'rule:a')
    expect(() => assertGeneratedNameIdentity('collision-probe', 'rule:b')).toThrow(CipoCompileError)
  })

  it('uses the TypeScript AST to find nested static styled templates without matching text in strings', () => {
    const source = [
      `const fake = "styled.div('Fake').css\\\`color:red\\\`";`,
      'const view = html`<main>${condition ? ',
      "styled.div('Inner').css`color:red;`",
      ' : null}</main>`;',
      "const Outer = styled.section('Outer').css`display:grid;`;",
    ].join('\n')

    const hits = findStyledCssTemplates(source, '/src/view.tsx')
    expect(hits.map((hit) => hit.receiver)).toEqual([
      "styled.div('Inner')",
      "styled.section('Outer')",
    ])
  })

  it('tracks Cipó AST bindings through aliases and createStyled while rejecting shadowed lookalikes', () => {
    const source = [
      `import { css as cipoCss, createStyled as makeStyled } from '@rodkisten/cipo'`,
      `const styled = makeStyled()`,
      `const one = cipoCss\`color:red;\``,
      `const Two = styled.div('Two').css\`color:blue;\``,
      `function fake(css: (value: TemplateStringsArray) => unknown, styled: any) {`,
      `  css\`color:pink;\``,
      `  return styled.div('Fake').css\`color:purple;\``,
      `}`,
    ].join('\n')

    expect(findBareCssTemplates(source, [], '/src/aliases.ts').length).toBe(1)
    expect(findStyledCssTemplates(source, '/src/aliases.ts').map((hit) => hit.receiver)).toEqual([
      "styled.div('Two')",
    ])
  })

  it('injects exact runtime imports without confusing aliases, type-only imports or unrelated modules', () => {
    const source = `
      import type { attachCompiledClass } from '@rodkisten/cipo/compiled-runtime'
      import { attachCompiledClass as unrelated } from 'other-package'
      const __cipoAttachCompiledClass = 1
    `
    const result = ensureNamedImportBinding(
      source,
      'attachCompiledClass',
      '@rodkisten/cipo/compiled-runtime',
      '__cipoAttachCompiledClass',
      '/src/example.ts',
    )

    expect(result.localName).not.toBe('__cipoAttachCompiledClass')
    expect(result.code).toContain(`from "@rodkisten/cipo/compiled-runtime"`)
    expect(result.code).toContain('attachCompiledClass as')
  })

  it('does not rewrite a lexically shadowed configureFromCss call', () => {
    const plugin = cipoVite({
      mode: 'build',
      compileFabrica: false,
      configCss: '@cipo { prefix: ast; minify: true; }',
    })
    const source = `
      import { configureFromCss as configure } from '@rodkisten/cipo'
      import { appConfigCss } from './config'
      configure(appConfigCss)
      function demo(configure: (value: unknown) => void) {
        configure(appConfigCss)
      }
    `

    const transformed = plugin.transform?.call({ emitFile: () => 'asset' } as never, source, '/src/config.ts')
    const code = transformed && typeof transformed === 'object' && 'code' in transformed
      ? String(transformed.code)
      : ''

    expect(code).toContain('configureCompiledCssConfig')
    expect(code).toContain('function demo(configure')
    expect(code).toContain('configure(appConfigCss)')
    expect(code).toContain(`from './config'`)
  })

  it('does not lower unrelated runtime config identifiers without an explicit binding contract', () => {
    const plugin = cipoVite({
      mode: 'build',
      compileFabrica: false,
      configCss: '@cipo { prefix: build; }',
    })
    const source = `
      import { configureFromCss } from '@rodkisten/cipo'
      import { tenantConfigCss } from './tenant-config'
      configureFromCss(tenantConfigCss)
    `

    const transformed = plugin.transform?.call({ emitFile: () => 'asset' } as never, source, '/src/config.ts')
    const code = transformed && typeof transformed === 'object' && 'code' in transformed
      ? String(transformed.code)
      : source

    expect(code).toContain('configureFromCss(tenantConfigCss)')
    expect(code).not.toContain('configureCompiledCssConfig')
  })

  it('lowers literal runtime config from the exact literal instead of the plugin fallback payload', () => {
    const plugin = cipoVite({
      mode: 'build',
      compileFabrica: false,
      configCss: '@cipo { prefix: fallback; }',
    })
    const source = `
      import { configureFromCss } from '@rodkisten/cipo'
      configureFromCss('@cipo { prefix: literal; minify: true; }')
    `

    const transformed = plugin.transform?.call({ emitFile: () => 'asset' } as never, source, '/src/config.ts')
    const code = transformed && typeof transformed === 'object' && 'code' in transformed
      ? String(transformed.code)
      : ''

    expect(code).toContain('configureCompiledCssConfig')
    expect(code).toContain('literal')
    expect(code).not.toContain('fallback')
  })

  it('rewrites only JavaScript string literals, never comments or template payloads', () => {
    const source = [
      `const generated = "__cipo_tmp";`,
      `const template = ` + '`keep "__cipo_tmp" here`' + `;`,
      `// "__cipo_tmp"`,
      `/* "__cipo_tmp" */`,
    ].join('\n')
    const output = replaceCompiledClassLiterals(
      source,
      new Map([['__cipo_tmp', 'final-class']]),
      'chunk.js',
    )

    expect(output).toContain('const generated = "final-class"')
    expect(output).toContain('`keep "__cipo_tmp" here`')
    expect(output).toContain('// "__cipo_tmp"')
    expect(output).toContain('/* "__cipo_tmp" */')
  })

  it('resets Vite build state between buildStart cycles', () => {
    const emitted: Array<{ fileName?: string; source: unknown }> = []
    const context = {
      emitFile(asset: { fileName?: string; source: unknown }) {
        emitted.push(asset)
        return asset.fileName ?? 'asset'
      },
    } as never
    const plugin = cipoVite({
      mode: 'build',
      compileFabrica: false,
      cssDelivery: 'asset',
      configCss: '@cipo { prefix: cycle; minify: true; }',
    })

    plugin.buildStart?.call(context)
    plugin.transform?.call(context, `const First = styled.div('First').css\`color: red;\``, '/src/first.ts')
    plugin.buildStart?.call(context)
    plugin.transform?.call(context, `const Second = styled.div('Second').css\`color: blue;\``, '/src/second.ts')
    const generate = plugin.generateBundle
    if (typeof generate === 'function') generate.call(context, {} as never, {} as never)

    const cssAsset = emitted.find((asset) => asset.fileName === 'cipo.compiled.css')
    expect(String(cssAsset?.source ?? '')).toContain('blue')
    expect(String(cssAsset?.source ?? '')).not.toContain('red')
  })

  it('returns a source map for transformed Vite modules', () => {
    const plugin = cipoVite({ mode: 'build', compileFabrica: false })
    const source = `const Card = styled.div('Card').css\`color: red;\``
    const transformed = plugin.transform?.call({ emitFile: () => 'asset' } as never, source, '/src/card.ts')

    expect(transformed && typeof transformed === 'object' && 'map' in transformed).toBe(true)
    const map = transformed && typeof transformed === 'object' && 'map' in transformed
      ? transformed.map as { sourcesContent?: readonly string[]; mappings?: string }
      : null
    expect(map?.sourcesContent).toEqual([source])
    expect(map?.mappings).toBeTruthy()
  })

  it('fails compilation loudly instead of emitting empty CSS when a helper throws', () => {
    registerHelper('__enterprise_throw', () => {
      throw new Error('boom')
    })

    expect(() => compileCipoSourceBuild(
      `const Card = styled.div('Card').css\`color: __enterprise_throw(red);\``,
      { filename: '/src/failure.ts', injectCssImport: false },
    )).toThrow(CipoCompileError)
  })
})
