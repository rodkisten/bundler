import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CipoCssResult } from '../../types'
const mocks = vi.hoisted(() => ({
  createStyledFactory: vi.fn(),
  insertCss: vi.fn(),
  needsObjectStyleAdapter: vi.fn(() => false),
  inlineCssTextToObject: vi.fn((cssText: string) => ({
    __convertedCssText: cssText,
  })),
  resolveElementsAdapter: vi.fn(),
}))
vi.mock('@rodkisten/fabrica-elements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rodkisten/fabrica-elements')>()
  return {
    ...actual,
    createStyledFactory: mocks.createStyledFactory,
  }
})
vi.mock('../../injection', () => ({
  insertCss: mocks.insertCss,
}))
vi.mock('../../elements-style-adapter', () => ({
  inlineCssTextToObject: mocks.inlineCssTextToObject,
  needsObjectStyleAdapter: mocks.needsObjectStyleAdapter,
  resolveElementsAdapter: mocks.resolveElementsAdapter,
}))
import {
  compileCipoSourceInline,
  compiledInlineCss,
  createCompiledStyled,
  resolveCompiledStyleInput,
} from './source-compile'
describe('compiled inline compiler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.needsObjectStyleAdapter.mockReturnValue(false)
  })
  describe('compiledInlineCss', () => {
    it('compiles a static inline template into a cipo.inline-css artifact', () => {
      const artifact = compiledInlineCss`
        color: red;
        padding: 8px;
      `
      expect(artifact.kind).toBe('cipo.inline-css')
      expect(artifact.cssText).toContain('color')
      expect(artifact.cssText).toContain('red')
      expect(artifact.cssText).toContain('padding')
    })
    it('exposes an important variant with the same compiled-inline artifact contract', () => {
      const artifact = compiledInlineCss.withImportant`
        color: red;
      `
      expect(artifact.kind).toBe('cipo.inline-css')
      expect(artifact.cssText).toContain('color')
      expect(artifact.cssText).toContain('!important')
    })
  })
  describe('resolveCompiledStyleInput', () => {
    it('resolves a class string without creating an artifact or inline style', () => {
      expect(resolveCompiledStyleInput('button-primary')).toEqual({
        className: 'button-primary',
      })
    })
    it('returns inline CSS text directly when the active elements adapter accepts string styles', () => {
      mocks.needsObjectStyleAdapter.mockReturnValue(false)
      const artifact = {
        kind: 'cipo.inline-css',
        cssText: 'color:red;padding:8px',
      } as CipoCssResult
      const result = resolveCompiledStyleInput(artifact)
      expect(result).toEqual({
        className: '',
        artifact,
        style: 'color:red;padding:8px',
      })
      expect(mocks.inlineCssTextToObject).not.toHaveBeenCalled()
    })
    it('converts inline CSS to an object when required by the active elements adapter', () => {
      mocks.needsObjectStyleAdapter.mockReturnValue(true)
      const artifact = {
        kind: 'cipo.inline-css',
        cssText: 'color:red;padding:8px',
      } as CipoCssResult
      const result = resolveCompiledStyleInput(artifact)
      expect(mocks.inlineCssTextToObject).toHaveBeenCalledTimes(1)
      expect(mocks.inlineCssTextToObject).toHaveBeenCalledWith(
        'color:red;padding:8px',
      )
      expect(result).toEqual({
        className: '',
        artifact,
        style: {
          __convertedCssText: 'color:red;padding:8px',
        },
      })
    })
    it('resolves a compiled class artifact without injecting CSS', () => {
      const artifact = {
        kind: 'cipo.css',
        className: 'cp-button',
        cssText: '.cp-button{color:red}',
      } as CipoCssResult
      expect(resolveCompiledStyleInput(artifact)).toEqual({
        className: 'cp-button',
        artifact,
      })
      expect(mocks.insertCss).not.toHaveBeenCalled()
    })
    it('injects stylesheet artifacts exactly when they are resolved', () => {
      const artifact = {
        kind: 'cipo.stylesheet',
        cssText: '.global{color:red}',
      } as CipoCssResult
      const result = resolveCompiledStyleInput(artifact)
      expect(mocks.insertCss).toHaveBeenCalledTimes(1)
      expect(mocks.insertCss).toHaveBeenCalledWith(
        '.global{color:red}',
      )
      expect(result).toEqual({
        className: '',
        artifact,
      })
    })
    it('accepts configuration/theme artifacts without producing DOM style output', () => {
      const artifact = {
        config: {
          prefix: 'cp',
        },
        theme: {
          primary: 'red',
        },
      } as unknown as CipoCssResult
      expect(resolveCompiledStyleInput(artifact)).toEqual({
        className: '',
        artifact,
      })
      expect(mocks.insertCss).not.toHaveBeenCalled()
    })
    it.each([
      undefined,
      null,
      42,
      true,
      Symbol('invalid'),
    ])(
      'rejects unsupported primitive style input %p with a useful error',
      (input) => {
        expect(() => resolveCompiledStyleInput(input)).toThrowError(
          '[Cipó compiled] Expected a Cipó artifact, class string, array or style function.',
        )
      },
    )
    it('rejects unknown object artifacts instead of silently accepting malformed compiler output', () => {
      expect(() =>
        resolveCompiledStyleInput({
          kind: 'some.future.or.invalid.artifact',
        }),
      ).toThrowError(
        '[Cipó compiled] Received an unknown style artifact.',
      )
    })
  })
  describe('createCompiledStyled', () => {
    it('creates a styled factory with enterprise-safe defaults', () => {
      const factory = {
        div: vi.fn(),
      }
      mocks.createStyledFactory.mockReturnValue(factory)
      const result = createCompiledStyled()
      expect(result).toBe(factory)
      expect(mocks.createStyledFactory).toHaveBeenCalledTimes(1)
      const options = mocks.createStyledFactory.mock.calls[0][0]
      expect(options).toMatchObject({
        adapter: mocks.resolveElementsAdapter,
        autoRegister: true,
        collision: 'warn',
        registry: undefined,
      })
      expect(typeof options.createStyle).toBe('function')
      expect(typeof options.resolveStyle).toBe('function')
    })
    it('forwards explicit registry and registration options to Fabrica Elements', () => {
      const registry = {
        register: vi.fn(),
      }
      const onWarning = vi.fn()
      mocks.createStyledFactory.mockReturnValue({})
      createCompiledStyled({
        registry,
        autoRegister: false,
        collision: 'throw',
        onWarning,
      })
      const options = mocks.createStyledFactory.mock.calls[0][0]
      expect(options.registry).toBe(registry)
      expect(options.autoRegister).toBe(false)
      expect(options.collision).toBe('throw')
      expect(options.onWarning).toBe(onWarning)
    })
    it('prefers registry over the legacy fabrica registry option', () => {
      const fabrica = {
        id: 'fabrica',
      }
      const registry = {
        id: 'explicit-registry',
      }
      mocks.createStyledFactory.mockReturnValue({})
      createCompiledStyled({
        fabrica,
        registry,
      })
      const options = mocks.createStyledFactory.mock.calls[0][0]
      expect(options.registry).toBe(registry)
    })
    it('uses fabrica as the registry compatibility fallback', () => {
      const fabrica = {
        id: 'fabrica-registry',
      }
      mocks.createStyledFactory.mockReturnValue({})
      createCompiledStyled({
        fabrica,
      })
      const options = mocks.createStyledFactory.mock.calls[0][0]
      expect(options.registry).toBe(fabrica)
    })
    it('compiles styles through the same compiled-inline artifact resolver', () => {
      mocks.createStyledFactory.mockReturnValue({})
      createCompiledStyled()
      const options = mocks.createStyledFactory.mock.calls[0][0]
      const strings = createTemplateStrings([
        'color: red;',
      ])
      const result = options.createStyle(strings, [])
      expect(result.className).toBe('')
      expect(result.artifact.kind).toBe('cipo.inline-css')
      expect(result.style).toContain('color')
    })
    it('delegates arbitrary resolved style inputs to the shared compiled resolver', () => {
      mocks.createStyledFactory.mockReturnValue({})
      createCompiledStyled()
      const options = mocks.createStyledFactory.mock.calls[0][0]
      expect(
        options.resolveStyle('existing-class', {
          active: true,
        }),
      ).toEqual({
        className: 'existing-class',
      })
    })
  })
  describe('compileCipoSourceInline', () => {
    it('rewrites a static styled css template to an explicit compiledInlineCss call', () => {
      const source = `
        import { styled } from '@rodkisten/cipo'
        export const Button = styled.button('Button').css\`
          color: red;
          padding: 8px;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(1)
      const entry = result.manifest[0]
      expect(entry).toMatchObject({
        id: 'cipo-inline-1',
        filename: '/src/button.ts',
        receiver: "styled.button('Button')",
        static: true,
      })
      expect(entry.start).toBeLessThan(entry.end)
      expect(entry.rawCss).toContain('color: red')
      expect(entry.rawCss).toContain('padding: 8px')
      // Static templates are evaluated during compilation so tooling and
      // manifests can inspect the effective compiled inline CSS.
      expect(entry.cssText).toContain('color')
      expect(entry.cssText).toContain('padding')
      expect(result.code).not.toContain('.css`')
      expect(result.code).toContain(
        "styled.button('Button')(__cipoCompiledInlineCss`",
      )
      expect(result.code).toContain(
        '@rodkisten/cipo/compiler',
      )
      expect(result.code).toContain(
        'compiledInlineCss as __cipoCompiledInlineCss',
      )
    })
    it('rewrites interpolated templates but deliberately skips static evaluation', () => {
      const source = [
        "import { styled } from '@rodkisten/cipo'",
        '',
        "const color = 'red'",
        '',
        "const Button = styled.button('Button').css`",
        '  color: ${color};',
        '`',
      ].join('\n')
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(1)
      expect(result.manifest[0]).toMatchObject({
        static: false,
        cssText: '',
      })
      // Runtime interpolation must survive source transformation verbatim.
      expect(result.code).toContain('${color}')
      expect(result.code).toContain(
        "styled.button('Button')(__cipoCompiledInlineCss`",
      )
    })
    it('can disable static template evaluation while still rewriting the source', () => {
      const source = `
        const Card = styled.div('Card').css\`
          display: flex;
          gap: 8px;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/card.ts',
        evaluateStaticCss: false,
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(1)
      expect(result.manifest[0]).toMatchObject({
        static: true,
        cssText: '',
      })
      expect(result.code).not.toContain('.css`')
      expect(result.code).toContain('__cipoCompiledInlineCss`')
    })
    it('returns the original source unchanged when no supported styled templates exist', () => {
      const source = `
        export function add(a: number, b: number) {
          return a + b
        }
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/math.ts',
      })
      expect(result).toEqual({
        code: source,
        changed: false,
        manifest: [],
      })
    })
    it('transforms multiple templates and preserves source-order manifest entries', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
        const Card = styled.div('Card').css\`
          padding: 16px;
        \`
        const Label = styled.span('Label').css\`
          font-weight: bold;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/components.ts',
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(3)
      expect(result.manifest.map((entry) => entry.id)).toEqual([
        'cipo-inline-1',
        'cipo-inline-2',
        'cipo-inline-3',
      ])
      expect(
        result.manifest.map((entry) => entry.receiver),
      ).toEqual([
        "styled.button('Button')",
        "styled.div('Card')",
        "styled.span('Label')",
      ])
      const [button, card, label] = result.manifest
      expect(button.end).toBeLessThan(card.start)
      expect(card.end).toBeLessThan(label.start)
      expect(countOccurrences(
        result.code,
        '__cipoCompiledInlineCss`',
      )).toBe(3)
      // One helper import must serve every transformed template.
      expect(countOccurrences(
        result.code,
        'compiledInlineCss as __cipoCompiledInlineCss',
      )).toBe(1)
    })
    it('uses the configured compiler helper import path', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
        importPath: '@application/cipo-compiler-runtime',
      })
      expect(result.code).toContain(
        '@application/cipo-compiler-runtime',
      )
      expect(result.code).not.toContain(
        '@rodkisten/cipo/compiler',
      )
    })
    it('does not collide with an application-owned helper binding', () => {
      const source = `
        const __cipoCompiledInlineCss = 'application value'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
      })
      expect(result.changed).toBe(true)
      // The source compiler must never redeclare or shadow the application's
      // existing lexical binding.
      expect(result.code).toContain(
        "const __cipoCompiledInlineCss = 'application value'",
      )
      const importedBinding = extractNamedImportBinding(
        result.code,
        '@rodkisten/cipo/compiler',
        'compiledInlineCss',
      )
      expect(importedBinding).toBeDefined()
      expect(importedBinding).not.toBe(
        '__cipoCompiledInlineCss',
      )
      expect(result.code).toContain(
        `${importedBinding}\``,
      )
    })
    it('reuses a compatible existing named import instead of adding a duplicate import', () => {
      const source = `
        import {
          compiledInlineCss as existingCompiledInline,
        } from '@rodkisten/cipo/compiler'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
      })
      expect(result.changed).toBe(true)
      expect(countModuleImports(
        result.code,
        '@rodkisten/cipo/compiler',
      )).toBe(1)
      expect(result.code).toContain(
        'existingCompiledInline`',
      )
    })
    it('does not mistake an identically named import from another module for the required compiler helper', () => {
      const source = `
        import {
          compiledInlineCss,
        } from '@unrelated/package'
        const Button = styled.button('Button').css\`
          color: red;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
      })
      expect(result.changed).toBe(true)
      expect(result.code).toContain(
        "from '@unrelated/package'",
      )
      expect(result.code).toContain(
        "from '@rodkisten/cipo/compiler'",
      )
      // The generated call must use the binding imported from the Cipó compiler,
      // not the unrelated application import.
      const cipoBinding = extractNamedImportBinding(
        result.code,
        '@rodkisten/cipo/compiler',
        'compiledInlineCss',
      )
      expect(cipoBinding).toBeDefined()
      expect(result.code).toContain(
        `${cipoBinding}\``,
      )
    })
    it('preserves nested template interpolation syntax during source rewriting', () => {
      const source = [
        "const Button = styled.button('Button').css`",
        '  color: ${condition ? `rgb(${r}, ${g}, ${b})` : fallback};',
        '`',
      ].join('\n')
      const result = compileCipoSourceInline(source, {
        filename: '/src/button.ts',
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(1)
      expect(result.manifest[0].static).toBe(false)
      expect(result.code).toContain(
        '${condition ? `rgb(${r}, ${g}, ${b})` : fallback}',
      )
    })
    it('preserves escaped backticks when rewriting a template', () => {
      const source = [
        "const Code = styled.code('Code').css`",
        '  content: "\\\\`";',
        '`',
      ].join('\n')
      const result = compileCipoSourceInline(source, {
        filename: '/src/code.ts',
        evaluateStaticCss: false,
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(1)
      expect(result.manifest[0].rawCss).toContain('\\\\`')
      expect(result.code).toContain('\\\\`')
    })
    it('does not transform styled-like syntax that appears only inside comments or strings', () => {
      const source = [
        'const example = "styled.div(\'Fake\').css`color:red;`"',
        '',
        '// styled.div("Comment").css`color:blue;`',
        '',
        '/*',
        '  styled.div("BlockComment").css`color:green;`',
        '*/',
      ].join('\n')
      const result = compileCipoSourceInline(source, {
        filename: '/src/examples.ts',
      })
      expect(result.changed).toBe(false)
      expect(result.code).toBe(source)
      expect(result.manifest).toEqual([])
    })
    it('does not confuse a shadowed local styled-like binding with an unrelated outer expression', () => {
      const source = `
        const real = styled.div('Real').css\`
          color: red;
        \`
        function example(styled: unknown) {
          return styled
        }
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/example.ts',
      })
      expect(result.changed).toBe(true)
      expect(result.manifest).toHaveLength(1)
      expect(result.manifest[0].receiver).toBe(
        "styled.div('Real')",
      )
    })
    it('keeps manifest source ranges anchored to the original unmodified source', () => {
      const source = `
        const Button = styled.button('Button').css\`
          color: red;
        \`
        const Card = styled.div('Card').css\`
          padding: 8px;
        \`
      `
      const result = compileCipoSourceInline(source, {
        filename: '/src/components.ts',
      })
      for (const entry of result.manifest) {
        const originalSlice = source.slice(
          entry.start,
          entry.end,
        )
        expect(originalSlice).toContain('.css`')
        expect(originalSlice).toContain(entry.rawCss)
      }
    })
    it('does not leak compiler session state between repeated compilations', () => {
      const firstSource = `
        const First = styled.div('First').css\`
          color: red;
        \`
      `
      const secondSource = `
        const Second = styled.div('Second').css\`
          color: blue;
        \`
      `
      const first = compileCipoSourceInline(firstSource, {
        filename: '/src/first.ts',
      })
      const second = compileCipoSourceInline(secondSource, {
        filename: '/src/second.ts',
      })
      expect(first.manifest).toHaveLength(1)
      expect(second.manifest).toHaveLength(1)
      // Manifest counters and compiler-local state restart per source
      // compilation instead of leaking from a previous compiler session.
      expect(first.manifest[0].id).toBe('cipo-inline-1')
      expect(second.manifest[0].id).toBe('cipo-inline-1')
      expect(first.manifest[0].rawCss).toContain('red')
      expect(second.manifest[0].rawCss).toContain('blue')
    })
  })
})
function createTemplateStrings(
  values: readonly string[],
): TemplateStringsArray {
  const strings = [...values] as unknown as TemplateStringsArray
  Object.defineProperty(strings, 'raw', {
    value: [...values],
  })
  return strings
}
function countOccurrences(
  value: string,
  search: string,
): number {
  if (!search) {
    return 0
  }
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
function countModuleImports(
  source: string,
  moduleId: string,
): number {
  const escapedModuleId = escapeRegExp(moduleId)
  return (
    source.match(
      new RegExp(
        `from\\s*['"]${escapedModuleId}['"]`,
        'g',
      ),
    )?.length ?? 0
  )
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
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}
