import { describe, expect, it } from 'vitest'
import { compileCipoSourceBuild } from './compile'
import { runtime } from '../../runtime'
describe('compileCipoSourceBuild', () => {
  it('compiles a static styled template into deterministic code, CSS, and manifest metadata', () => {
    const source = `
      import { styled } from '@rodkisten/cipo'
      export const Button = styled.button('Button').css\`
        color: red;
        padding: 8px;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      classPrefix: 'test',
      injectCssImport: false,
      minifyCss: true,
    })
    expect(result.changed).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(result.manifest).toHaveLength(1)
    const entry = result.manifest[0]
    expect(entry).toMatchObject({
      filename: '/src/button.ts',
      kind: 'styled-css',
      receiver: "styled.button('Button')",
    })
    expect(entry.id).toMatch(/^cipo-build-/)
    expect(entry.className).toMatch(/^test-Button-/)
    expect(entry.rawCss).toContain('color: red')
    expect(entry.rawCss).toContain('padding: 8px')
    expect(result.css).toContain(`.${entry.className}`)
    expect(result.css).toContain('color:red')
    expect(result.css).toContain('padding:0.5rem')
    // Static `.css` authoring syntax must be removed from generated source.
    expect(result.code).not.toContain('.css`')
    expect(result.code).toContain(JSON.stringify(entry.className))
  })
  it('is deterministic for identical source, filename, and compiler options', () => {
    const source = `
      import { styled } from '@rodkisten/cipo'
      const Card = styled.div('Card').css\`
        display: flex;
        gap: 8px;
      \`
    `
    const options = {
      filename: '/src/card.ts',
      classPrefix: 'cp',
      buildNamespace: 'app',
      injectCssImport: false,
      minifyCss: true,
    } as const
    const first = compileCipoSourceBuild(source, options)
    const second = compileCipoSourceBuild(source, options)
    expect(second).toEqual(first)
  })
  it('uses the build namespace as part of generated class identity', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const first = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      buildNamespace: 'bundle-a',
      injectCssImport: false,
    })
    const second = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      buildNamespace: 'bundle-b',
      injectCssImport: false,
    })
    expect(first.manifest).toHaveLength(1)
    expect(second.manifest).toHaveLength(1)
    expect(first.manifest[0].className).not.toBe(
      second.manifest[0].className,
    )
  })
  it('leaves interpolated styled templates untouched because they require runtime evaluation', () => {
    const source = [
      "import { styled } from '@rodkisten/cipo'",
      '',
      'const color = getColor()',
      '',
      "const Button = styled.button('Button').css`",
      '  color: ${color};',
      '`',
    ].join('\n')
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      injectCssImport: false,
    })
    expect(result).toEqual({
      code: source,
      css: '',
      changed: false,
      manifest: [],
      diagnostics: [],
    })
  })
  it('compiles static bare css tags only when transformCssTag is explicitly enabled', () => {
    const source = `
      import { css } from '@rodkisten/cipo'
      const className = css\`
        color: red;
        display: block;
      \`
    `
    const disabled = compileCipoSourceBuild(source, {
      filename: '/src/styles.ts',
      transformCssTag: false,
      injectCssImport: false,
    })
    expect(disabled.changed).toBe(false)
    expect(disabled.code).toBe(source)
    expect(disabled.css).toBe('')
    expect(disabled.manifest).toEqual([])
    const enabled = compileCipoSourceBuild(source, {
      filename: '/src/styles.ts',
      transformCssTag: true,
      injectCssImport: false,
      minifyCss: true,
    })
    expect(enabled.changed).toBe(true)
    expect(enabled.manifest).toHaveLength(1)
    expect(enabled.manifest[0].kind).toBe('css-tag')
    const className = enabled.manifest[0].className
    expect(enabled.code).not.toContain('css`')
    expect(enabled.code).toContain(JSON.stringify(className))
    expect(enabled.css).toContain(`.${className}`)
    expect(enabled.css).toContain('color:red')
    expect(enabled.css).toContain('display:block')
  })
  it('does not transform an interpolated bare css tag even when css-tag transformation is enabled', () => {
    const source = [
      "import { css } from '@rodkisten/cipo'",
      '',
      "const color = 'red'",
      '',
      'const className = css`',
      '  color: ${color};',
      '`',
    ].join('\n')
    const result = compileCipoSourceBuild(source, {
      filename: '/src/styles.ts',
      transformCssTag: true,
      injectCssImport: false,
    })
    expect(result.changed).toBe(false)
    expect(result.code).toBe(source)
    expect(result.css).toBe('')
    expect(result.manifest).toEqual([])
  })
  it('injects the compiled CSS side-effect import exactly once', () => {
    const cssImportId = 'virtual:cipo-compiled.css'
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      cssImportId,
    })
    expect(countOccurrences(
      result.code,
      `import ${JSON.stringify(cssImportId)};`,
    )).toBe(1)
    const alreadyImportedSource = `
      import ${JSON.stringify(cssImportId)};
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const alreadyImported = compileCipoSourceBuild(alreadyImportedSource, {
      filename: '/src/button.ts',
      cssImportId,
    })
    expect(countOccurrences(
      alreadyImported.code,
      `import ${JSON.stringify(cssImportId)};`,
    )).toBe(1)
  })
  it('does not inject the compiled CSS import when injectCssImport is disabled', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      injectCssImport: false,
    })
    expect(result.changed).toBe(true)
    expect(result.code).not.toContain('cipo:compiled.css')
  })
  it('couples styled CSS to the component and removes that CSS from the standalone output', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
        padding: 8px;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      coupleStyledCss: true,
      injectCssImport: false,
      minifyCss: true,
    })
    expect(result.changed).toBe(true)
    expect(result.manifest).toHaveLength(1)
    expect(result.manifest[0].kind).toBe('styled-css')
    // Coupled component CSS is intentionally absent from the shared stylesheet,
    // allowing normal JavaScript tree shaking to eliminate both together.
    expect(result.css).toBe('')
    expect(result.code).toContain('attachCompiledCss')
    expect(result.code).toContain('@rodkisten/cipo/compiled-runtime')
    expect(result.code).toContain(JSON.stringify(result.manifest[0].className))
    expect(result.code).toContain('color:red')
  })
  it('uses a collision-free local helper binding when coupling styled CSS', () => {
    const source = `
      const __cipoAttachCompiledCss = 'application-owned-binding';
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      coupleStyledCss: true,
      injectCssImport: false,
      minifyCss: true,
    })
    expect(result.changed).toBe(true)
    // The compiler must preserve an existing application binding instead of
    // shadowing or redeclaring it.
    expect(result.code).toContain(
      "const __cipoAttachCompiledCss = 'application-owned-binding'",
    )
    const helperImport = extractNamedImportBinding(
      result.code,
      '@rodkisten/cipo/compiled-runtime',
      'attachCompiledCss',
    )
    expect(helperImport).toBeDefined()
    expect(helperImport).not.toBe('__cipoAttachCompiledCss')
    // The exact collision suffix is deliberately not asserted. The important
    // contract is that the generated call uses the same safe imported binding.
    expect(result.code).toContain(`/*#__PURE__*/${helperImport}(`)
  })
  it('defers styled CSS emission for whole-build atomic promotion', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
        padding: 8px;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      deferAtomicCss: true,
      injectCssImport: false,
    })
    expect(result.changed).toBe(true)
    expect(result.css).toBe('')
    expect(result.manifest).toHaveLength(1)
    const entry = result.manifest[0]
    // The manifest intentionally keeps both source CSS and its compiled form so
    // the whole-build atomic pass has the information required for promotion.
    expect(entry.kind).toBe('styled-css')
    expect(entry.rawCss).toContain('color: red')
    expect(entry.cssText).toContain('color')
    expect(result.code).toContain('attachCompiledClass')
    expect(result.code).toContain('@rodkisten/cipo/compiled-runtime')
    expect(result.code).toContain(JSON.stringify(entry.className))
    expect(result.code).not.toContain('attachCompiledCss')
  })
  it('gives deferred atomic mode precedence over coupled CSS mode', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      deferAtomicCss: true,
      coupleStyledCss: true,
      injectCssImport: false,
    })
    expect(result.css).toBe('')
    expect(result.code).toContain('attachCompiledClass')
    expect(result.code).not.toContain('attachCompiledCss')
  })
  it('uses compact hash-only class names without leaking readable component labels', () => {
    const source = `
      const VerySecretInternalButton = styled.button('VerySecretInternalButton').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      classPrefix: 'x',
      buildNamespace: 'production',
      classNameMode: 'compact',
      injectCssImport: false,
    })
    expect(result.manifest).toHaveLength(1)
    const className = result.manifest[0].className
    expect(className).toMatch(/^x[0-9a-z]+$/i)
    expect(className).not.toContain('VerySecretInternalButton')
    // Compact mode defaults to minified CSS.
    expect(result.css).not.toContain('\n')
  })
  it('preserves readable component labels in readable class-name mode', () => {
    const source = `
      const Button = styled.button('Primary Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      classPrefix: 'project',
      classNameMode: 'readable',
      injectCssImport: false,
    })
    expect(result.manifest[0].className).toMatch(
      /^project-Primary-Button-/,
    )
  })
  it('sanitizes unsafe readable class-name prefixes and receiver labels', () => {
    const source = `
      const Button = styled.button('Primary / Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      classPrefix: '--my project!',
      classNameMode: 'readable',
      injectCssImport: false,
    })
    const className = result.manifest[0].className
    expect(className).not.toMatch(/\s/)
    expect(className).not.toContain('/')
    expect(className).not.toContain('!')
    expect(className).toContain('my-project-')
    expect(className).toContain('Primary---Button')
  })
  it('produces different identities for otherwise identical templates from different files', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const first = compileCipoSourceBuild(source, {
      filename: '/src/feature-a/button.ts',
      injectCssImport: false,
    })
    const second = compileCipoSourceBuild(source, {
      filename: '/src/feature-b/button.ts',
      injectCssImport: false,
    })
    expect(first.manifest[0].className).not.toBe(
      second.manifest[0].className,
    )
    expect(first.manifest[0].id).not.toBe(
      second.manifest[0].id,
    )
  })
  it('preserves source-order manifest positions for multiple static templates', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
      const Card = styled.div('Card').css\`
        padding: 16px;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/components.ts',
      injectCssImport: false,
    })
    expect(result.manifest).toHaveLength(2)
    const [button, card] = result.manifest
    expect(button.start).toBeLessThan(button.end)
    expect(card.start).toBeLessThan(card.end)
    expect(button.end).toBeLessThan(card.start)
    expect(button.receiver).toBe("styled.button('Button')")
    expect(card.receiver).toBe("styled.div('Card')")
  })
  it('does not leak compiler configuration into the live runtime', () => {
    const prefixBefore = runtime.config.prefix
    const minifyBefore = runtime.config.minify
    const debugBefore = runtime.config.debug
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      injectCssImport: false,
      configCss: `
        @cipo {
          prefix: isolated-build;
          minify: true;
        }
      `,
    })
    expect(runtime.config.prefix).toBe(prefixBefore)
    expect(runtime.config.minify).toBe(minifyBefore)
    expect(runtime.config.debug).toBe(debugBefore)
  })
  it('does not allow one compiler session configuration to contaminate the next compilation', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const configured = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      injectCssImport: false,
      configCss: `
        @cipo {
          prefix: isolated;
        }
      `,
    })
    const normal = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      classPrefix: 'normal',
      injectCssImport: false,
    })
    expect(configured.manifest[0].className).not.toBe(
      normal.manifest[0].className,
    )
    expect(normal.manifest[0].className).toMatch(/^normal-/)
  })
  it('merges only semantically safe adjacent equivalent rules in compact builds', () => {
    const source = `
      const First = styled.div('First').css\`
        color: red;
      \`
      const Second = styled.div('Second').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/components.ts',
      classNameMode: 'compact',
      injectCssImport: false,
      mergeEquivalentRules: true,
      minifyCss: true,
    })
    expect(result.manifest).toHaveLength(2)
    // Equivalent adjacent declaration bodies may share one serialized rule.
    expect(countOccurrences(result.css, 'color:red')).toBe(1)
    const firstClass = result.manifest[0].className
    const secondClass = result.manifest[1].className
    expect(result.css).toContain(`.${firstClass}`)
    expect(result.css).toContain(`.${secondClass}`)
  })
  it('preserves quoted CSS values while minifying compiled output', () => {
    const source = `
      const Label = styled.span('Label').css\`
        content: "a : b ; c";
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/label.ts',
      classNameMode: 'compact',
      minifyCss: true,
      injectCssImport: false,
    })
    expect(result.css).toContain('"a : b; c"')
    expect(result.css).not.toContain('"a:b;c"')
  })
  it('preserves protocol-relative URLs while compiling and minifying CSS', () => {
    const source = `
      const Hero = styled.div('Hero').css\`
        background-image: url(//cdn.example.com/hero.png);
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/hero.ts',
      classNameMode: 'compact',
      minifyCss: true,
      injectCssImport: false,
    })
    expect(result.css).toContain(
      'url(//cdn.example.com/hero.png)',
    )
  })
  it('mangles only custom properties matched by the explicitly configured private pattern', () => {
    const source = `
      const Button = styled.button('Button').css\`
        --_cipo-private-color: red;
        --public-color: blue;
        color: var(--_cipo-private-color);
        background: var(--public-color);
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      classNameMode: 'compact',
      injectCssImport: false,
      minifyCss: true,
      privateCustomPropertyPattern: /^--_cipo-/,
    })
    expect(result.css).not.toContain('--_cipo-private-color')
    expect(result.css).toContain('--public-color')
    expect(result.css).toContain('var(--public-color)')
  })
  it('keeps manifest CSS even when standalone emission is removed by component coupling', () => {
    const source = `
      const Button = styled.button('Button').css\`
        color: red;
      \`
    `
    const result = compileCipoSourceBuild(source, {
      filename: '/src/button.ts',
      coupleStyledCss: true,
      injectCssImport: false,
      minifyCss: true,
    })
    expect(result.css).toBe('')
    expect(result.manifest[0].cssText).toContain('color')
    expect(result.manifest[0].rawCss).toContain('color: red')
  })
})
function countOccurrences(value: string, search: string): number {
  if (!search) return 0
  let count = 0
  let offset = 0
  while (true) {
    const index = value.indexOf(search, offset)
    if (index === -1) {
      return count
    }
    count++
    offset = index + search.length
  }
}
function extractNamedImportBinding(
  source: string,
  moduleId: string,
  importedName: string,
): string | undefined {
  const escapedModuleId = escapeRegExp(moduleId)
  const escapedImportedName = escapeRegExp(importedName)
  const importPattern = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapedModuleId}['"]`,
  )
  const match = source.match(importPattern)
  if (!match) {
    return undefined
  }
  for (const specifier of match[1].split(',')) {
    const normalized = specifier.trim()
    const bindingMatch = normalized.match(
      new RegExp(
        `^${escapedImportedName}(?:\\s+as\\s+([A-Za-z_$][\\w$]*))?$`,
      ),
    )
    if (bindingMatch) {
      return bindingMatch[1] ?? importedName
    }
  }
  return undefined
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
