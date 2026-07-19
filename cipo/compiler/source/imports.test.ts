import { describe, expect, it } from 'vitest'
import {
  ensureNamedImport,
  ensureNamedImportBinding,
  findIdentifierCalls,
  findImportedBindings,
  getAvailableBindingName,
  removeUnusedNamedImports,
} from './imports'
describe('compiler source imports', () => {
  describe('ensureNamedImport', () => {
    it('adds a named import when the requested symbol is not imported', () => {
      const source = `
        const value = 42
      `
      const result = ensureNamedImport(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result).toContain(
        'import { compiledInlineCss } from "@rodkisten/cipo/compiler";',
      )
      expect(result).toContain('const value = 42')
    })
    it('does not duplicate an existing exact named import', () => {
      const source = `
        import { compiledInlineCss } from '@rodkisten/cipo/compiler'
        const value = compiledInlineCss
      `
      const result = ensureNamedImport(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result).toBe(source)
      expect(
        countOccurrences(
          result,
          'compiledInlineCss',
        ),
      ).toBe(2)
    })
    it('does not mistake a same-named import from another module for the requested import', () => {
      const source = `
        import { compiledInlineCss } from '@unrelated/compiler'
        const value = compiledInlineCss
      `
      const result = ensureNamedImport(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result).toContain(
        "from '@unrelated/compiler'",
      )
      expect(result).toContain(
        'from "@rodkisten/cipo/compiler"',
      )
      // Because the original local name is already occupied, the compiler must
      // introduce a collision-free alias for the requested runtime binding.
      expect(result).toContain(
        'compiledInlineCss as __cipoCompiledInlineCss',
      )
    })
  })
  describe('getAvailableBindingName', () => {
    it('returns the preferred name when no top-level binding collides with it', () => {
      const source = `
        const unrelated = true
      `
      expect(
        getAvailableBindingName(
          source,
          '__cipoCompiledInlineCss',
        ),
      ).toBe('__cipoCompiledInlineCss')
    })
    it('returns a deterministic collision-free name for an occupied top-level variable', () => {
      const source = `
        const helper = 1
      `
      expect(
        getAvailableBindingName(
          source,
          'helper',
        ),
      ).toBe('__cipoHelper')
    })
    it('keeps searching when the first generated fallback is also occupied', () => {
      const source = `
        const helper = 1
        const __cipoHelper = 2
        const __cipohelper_1 = 3
      `
      const result = getAvailableBindingName(
        source,
        'helper',
      )
      expect(result).toBe('__cipohelper_2')
    })
    it('detects bindings introduced by imports, functions, classes and enums', () => {
      const cases = [
        `
          import { helper } from './helper'
        `,
        `
          function helper() {}
        `,
        `
          class helper {}
        `,
        `
          enum helper {
            Value,
          }
        `,
      ]
      for (const source of cases) {
        expect(
          getAvailableBindingName(source, 'helper'),
        ).not.toBe('helper')
      }
    })
    it('detects bindings declared through object destructuring', () => {
      const source = `
        const {
          helper,
          nested: alias,
        } = source
      `
      expect(
        getAvailableBindingName(source, 'helper'),
      ).not.toBe('helper')
      expect(
        getAvailableBindingName(source, 'alias'),
      ).not.toBe('alias')
    })
    it('detects bindings declared through array destructuring', () => {
      const source = `
        const [
          first,
          ,
          third,
        ] = values
      `
      expect(
        getAvailableBindingName(source, 'first'),
      ).not.toBe('first')
      expect(
        getAvailableBindingName(source, 'third'),
      ).not.toBe('third')
    })
    it('does not consider nested local bindings to be top-level collisions', () => {
      const source = `
        function example() {
          const helper = true
          return helper
        }
      `
      expect(
        getAvailableBindingName(source, 'helper'),
      ).toBe('helper')
    })
  })
  describe('ensureNamedImportBinding', () => {
    it('returns an unchanged result when the exact imported and local binding already exists', () => {
      const source = `
        import {
          compiledInlineCss,
        } from '@rodkisten/cipo/compiler'
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result).toEqual({
        code: source,
        localName: 'compiledInlineCss',
        changed: false,
      })
    })
    it('recognizes an existing exact aliased binding when it matches the preferred local name', () => {
      const source = `
        import {
          compiledInlineCss as compileStyle,
        } from '@rodkisten/cipo/compiler'
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
        'compileStyle',
      )
      expect(result).toEqual({
        code: source,
        localName: 'compileStyle',
        changed: false,
      })
    })
    it('adds a new specifier to an existing named import from the exact module', () => {
      const source = `
        import {
          existingHelper,
        } from '@rodkisten/cipo/compiler'
        existingHelper()
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
        '__cipoCompiledInlineCss',
      )
      expect(result.changed).toBe(true)
      expect(result.localName).toBe(
        '__cipoCompiledInlineCss',
      )
      expect(
        countModuleImports(
          result.code,
          '@rodkisten/cipo/compiler',
        ),
      ).toBe(1)
      expect(result.code).toContain(
        'compiledInlineCss as __cipoCompiledInlineCss',
      )
      expect(result.code).toContain(
        'existingHelper',
      )
    })
    it('uses the imported name directly when the preferred local name is available', () => {
      const source = `
        const value = true
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      expect(result.localName).toBe(
        'compiledInlineCss',
      )
      expect(result.code).toContain(
        'import { compiledInlineCss } from "@rodkisten/cipo/compiler";',
      )
    })
    it('generates a collision-free alias when the preferred local binding is occupied', () => {
      const source = `
        const compiledInlineCss = 'application-owned'
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      expect(result.localName).not.toBe(
        'compiledInlineCss',
      )
      expect(result.code).toContain(
        `compiledInlineCss as ${result.localName}`,
      )
      expect(result.code).toContain(
        "const compiledInlineCss = 'application-owned'",
      )
    })
    it('treats a type-only import as independent from the required runtime import', () => {
      const source = `
        import type {
          compiledInlineCss,
        } from '@rodkisten/cipo/compiler'
        type Compiler = typeof compiledInlineCss
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      // The type binding occupies the lexical name, so the runtime import must
      // be emitted under a distinct local binding.
      expect(result.localName).not.toBe(
        'compiledInlineCss',
      )
      expect(result.code).toContain(
        'import type',
      )
      expect(result.code).toContain(
        `compiledInlineCss as ${result.localName}`,
      )
    })
    it('does not treat a type-only import specifier as an existing runtime binding', () => {
      const source = `
        import {
          type compiledInlineCss,
          runtimeHelper,
        } from '@rodkisten/cipo/compiler'
        runtimeHelper()
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      expect(result.localName).not.toBe(
        'compiledInlineCss',
      )
      expect(result.code).toContain(
        'type compiledInlineCss',
      )
      expect(result.code).toContain(
        `compiledInlineCss as ${result.localName}`,
      )
    })
    it('does not modify an unrelated import that exports the same symbol name', () => {
      const source = `
        import {
          helper,
        } from '@application/runtime'
      `
      const result = ensureNamedImportBinding(
        source,
        'helper',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      expect(result.code).toContain(
        "from '@application/runtime'",
      )
      expect(result.code).toContain(
        'from "@rodkisten/cipo/compiler"',
      )
      expect(result.localName).not.toBe('helper')
    })
    it('creates a separate named import when the matching module currently uses a namespace import', () => {
      const source = `
        import * as compiler from '@rodkisten/cipo/compiler'
        compiler.doSomething()
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      expect(result.code).toContain(
        "import * as compiler from '@rodkisten/cipo/compiler'",
      )
      expect(result.code).toContain(
        'import { compiledInlineCss } from "@rodkisten/cipo/compiler";',
      )
    })
    it('creates a named import alongside a side-effect-only import from the same module', () => {
      const source = `
        import '@rodkisten/cipo/compiler'
        const value = true
      `
      const result = ensureNamedImportBinding(
        source,
        'compiledInlineCss',
        '@rodkisten/cipo/compiler',
      )
      expect(result.changed).toBe(true)
      expect(result.code).toContain(
        "import '@rodkisten/cipo/compiler'",
      )
      expect(result.code).toContain(
        'import { compiledInlineCss } from "@rodkisten/cipo/compiler";',
      )
    })
  })
  describe('removeUnusedNamedImports', () => {
    it('returns the original source when there are no candidate bindings', () => {
      const source = `
        import { helper } from './helper'
        helper()
      `
      expect(
        removeUnusedNamedImports(
          source,
          new Set(),
        ),
      ).toBe(source)
    })
    it('removes an unused candidate while preserving used and non-candidate specifiers', () => {
      const source = `
        import {
          unused,
          used,
          untouched,
        } from './helpers'
        used()
      `
      const result = removeUnusedNamedImports(
        source,
        new Set([
          'unused',
          'used',
        ]),
      )
      expect(result).not.toContain('unused')
      expect(result).toContain('used')
      expect(result).toContain('untouched')
      expect(result).toContain('used()')
    })
    it('removes the whole import declaration when every named binding is an unused candidate', () => {
      const source = `
        import {
          first,
          second,
        } from './compiler-runtime'
        const value = 42
      `
      const result = removeUnusedNamedImports(
        source,
        new Set([
          'first',
          'second',
        ]),
      )
      expect(result).not.toContain(
        "'./compiler-runtime'",
      )
      expect(result).toContain(
        'const value = 42',
      )
    })
    it('preserves a default import when removing the only unused named binding', () => {
      const source = `
        import Runtime, {
          unused,
        } from './runtime'
        Runtime.start()
      `
      const result = removeUnusedNamedImports(
        source,
        new Set([
          'unused',
        ]),
      )
      expect(result).toContain('Runtime')
      expect(result).toContain(
        "from './runtime'",
      )
      expect(result).not.toMatch(
        /\bunused\b/,
      )
    })
    it('removes an unused aliased import by its local binding name', () => {
      const source = `
        import {
          compiledInlineCss as localCompiler,
          keepMe,
        } from './compiler'
        keepMe()
      `
      const result = removeUnusedNamedImports(
        source,
        new Set([
          'localCompiler',
        ]),
      )
      expect(result).not.toContain(
        'localCompiler',
      )
      expect(result).toContain(
        'keepMe',
      )
    })
    it('preserves a candidate binding that is referenced by executable code', () => {
      const source = `
        import {
          compile,
        } from './compiler'
        const result = compile(source)
      `
      const transformed = removeUnusedNamedImports(
        source,
        new Set([
          'compile',
        ]),
      )
      expect(transformed).toBe(source)
    })
    it('does not remove imports whose local bindings are not candidates', () => {
      const source = `
        import {
          first,
          second,
        } from './helpers'
      `
      const result = removeUnusedNamedImports(
        source,
        new Set([
          'somethingElse',
        ]),
      )
      expect(result).toBe(source)
    })
    it('can remove multiple adjacent unused specifiers without corrupting the remaining import list', () => {
      const source = `
        import {
          first,
          second,
          third,
          keep,
        } from './helpers'
        keep()
      `
      const result = removeUnusedNamedImports(
        source,
        new Set([
          'first',
          'second',
          'third',
        ]),
      )
      expect(result).not.toMatch(/\bfirst\b/)
      expect(result).not.toMatch(/\bsecond\b/)
      expect(result).not.toMatch(/\bthird\b/)
      expect(result).toContain('keep')
      expect(result).toContain('keep()')
    })
  })
  describe('findImportedBindings', () => {
    it('collects direct and aliased local bindings for an imported symbol', () => {
      const source = `
        import {
          compile,
          somethingElse,
        } from '@first/compiler'
        import {
          compile as compileAlias,
        } from '@second/compiler'
      `
      const result = findImportedBindings(
        source,
        'compile',
        new Set([
          '@first/compiler',
          '@second/compiler',
        ]),
      )
      expect(result).toEqual(
        new Set([
          'compile',
          'compileAlias',
        ]),
      )
    })
    it('ignores matching symbols imported from modules outside the requested module set', () => {
      const source = `
        import {
          compile,
        } from '@unrelated/compiler'
        import {
          compile as cipoCompile,
        } from '@rodkisten/cipo/compiler'
      `
      const result = findImportedBindings(
        source,
        'compile',
        new Set([
          '@rodkisten/cipo/compiler',
        ]),
      )
      expect(result).toEqual(
        new Set([
          'cipoCompile',
        ]),
      )
    })
    it('ignores whole-clause type-only imports', () => {
      const source = `
        import type {
          compile,
        } from '@rodkisten/cipo/compiler'
      `
      const result = findImportedBindings(
        source,
        'compile',
        new Set([
          '@rodkisten/cipo/compiler',
        ]),
      )
      expect(result.size).toBe(0)
    })
    it('ignores individual type-only import specifiers', () => {
      const source = `
        import {
          type compile,
          runtimeHelper,
        } from '@rodkisten/cipo/compiler'
      `
      const result = findImportedBindings(
        source,
        'compile',
        new Set([
          '@rodkisten/cipo/compiler',
        ]),
      )
      expect(result.size).toBe(0)
    })
    it('returns an empty set when the symbol is not imported by any matching module', () => {
      const source = `
        import {
          anotherSymbol,
        } from '@rodkisten/cipo/compiler'
      `
      const result = findImportedBindings(
        source,
        'compile',
        new Set([
          '@rodkisten/cipo/compiler',
        ]),
      )
      expect(result).toEqual(
        new Set(),
      )
    })
  })
  describe('findIdentifierCalls', () => {
    it('finds calls whose callee resolves to the requested imported binding', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        configure('first')
        configure('second')
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toHaveLength(2)
      expect(
        calls.map((call) => call.getText()),
      ).toEqual([
        "configure('first')",
        "configure('second')",
      ])
    })
    it('finds calls through an aliased import binding', () => {
      const source = `
        import {
          configureFromCss as configure,
        } from '@rodkisten/cipo'
        configure(css)
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].getText()).toBe(
        'configure(css)',
      )
    })
    it('rejects a lexically shadowed function parameter with the same name as an imported binding', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        configure(globalCss)
        function run(configure: (value: string) => void) {
          configure(localCss)
        }
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].getText()).toBe(
        'configure(globalCss)',
      )
    })
    it('rejects a lexically shadowed local variable with the same name as an imported binding', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        configure(globalCss)
        function run() {
          const configure = createLocalConfigure()
          configure(localCss)
        }
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].getText()).toBe(
        'configure(globalCss)',
      )
    })
    it('does not match a same-named local function when no imported binding backs the symbol', () => {
      const source = `
        function configure(value: string) {
          return value
        }
        configure(css)
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toEqual([])
    })
    it('does not match a property call merely because the property has the requested name', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        runtime.configure(css)
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toEqual([])
    })
    it('recognizes imported calls wrapped in parentheses', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        (configure)(css)
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toHaveLength(1)
      expect(calls[0].getText()).toBe(
        '(configure)(css)',
      )
    })
    it('recognizes imported calls wrapped in a TypeScript assertion expression', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        (configure as typeof configure)(css)
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'configure',
        ]),
      )
      expect(calls).toHaveLength(1)
    })
    it('handles multiple candidate local names while still resolving each symbol lexically', () => {
      const source = `
        import {
          first,
          second as localSecond,
        } from '@rodkisten/cipo'
        first()
        localSecond()
        function nested(first: () => void) {
          first()
        }
      `
      const calls = findIdentifierCalls(
        source,
        new Set([
          'first',
          'localSecond',
        ]),
      )
      expect(
        calls.map((call) => call.getText()),
      ).toEqual([
        'first()',
        'localSecond()',
      ])
    })
  })
  describe('source transformation regression contracts', () => {
    it(
      'preserves directive prologues such as "use client" before injecting a new import',
      () => {
        const result = ensureNamedImport('"use client";\nconst value = 1', 'helper', 'pkg')
        expect(result.indexOf('"use client"')).toBeLessThan(result.indexOf('import { helper }'))
      },
    )
    it(
      'preserves a shebang as the first line when injecting a new import',
      () => {
        const result = ensureNamedImport('#!/usr/bin/env node\nconst value = 1', 'helper', 'pkg')
        expect(result.startsWith('#!/usr/bin/env node\n')).toBe(true)
        expect(result).toContain('import { helper } from "pkg";')
      },
    )
    it(
      'removeUnusedNamedImports resolves references by symbol so a shadowed local identifier does not keep an unused import alive',
      () => {
        const source = `import { compile } from 'pkg'
        function run(compile: string) { return compile }`
        expect(removeUnusedNamedImports(source, new Set(['compile']))).not.toContain('import { compile }')
      },
    )
    it(
      'removeUnusedNamedImports does not count a property-access name such as runtime.compile as a reference to an imported compile binding',
      () => {
        const source = `import { compile } from 'pkg'
        const value = runtime.compile`
        expect(removeUnusedNamedImports(source, new Set(['compile']))).not.toContain('import { compile }')
      },
    )
    it(
      'removes shadowed imports without resolving unrelated relative modules from an absolute filename',
      () => {
        const source = `import { configure } from 'pkg'
import { appConfigCss } from './config'
function demo(configure: (value: unknown) => void) {
  configure(appConfigCss)
}`
        const result = removeUnusedNamedImports(
          source,
          new Set(['configure', 'appConfigCss']),
          '/src/config.ts',
        )

        expect(result).not.toContain("import { configure } from 'pkg'")
        expect(result).toContain("import { appConfigCss } from './config'")
        expect(result).toContain('configure(appConfigCss)')
      },
    )
  })
})
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
    const index = value.indexOf(
      search,
      offset,
    )
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
  const fromImports =
    source.match(
      new RegExp(
        `from\\s*['"]${escapedModuleId}['"]`,
        'g',
      ),
    )?.length ?? 0
  const sideEffectImports =
    source.match(
      new RegExp(
        `import\\s*['"]${escapedModuleId}['"]`,
        'g',
      ),
    )?.length ?? 0
  return fromImports + sideEffectImports
}
function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}
