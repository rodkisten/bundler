import { describe, expect, it } from 'vitest'
import * as ts from 'typescript'
import {
  createSingleFileProgram,
  createSourceFile,
  sourceLocationFromOffset,
  unwrapExpression,
  visitSourceTree,
} from './program'
describe('compiler source program utilities', () => {
  describe('createSourceFile', () => {
    it('parses TypeScript source using TSX as the default script kind', () => {
      const sourceFile = createSourceFile(`
        const element = <div>Hello</div>
      `)
      expect(sourceFile.fileName).toBe('source.tsx')
      expect(sourceFile.scriptKind).toBe(ts.ScriptKind.TSX)
      expect(sourceFile.parseDiagnostics).toHaveLength(0)
    })
    it.each([
      ['component.tsx', ts.ScriptKind.TSX],
      ['component.jsx', ts.ScriptKind.JSX],
      ['module.js', ts.ScriptKind.JS],
      ['module.mjs', ts.ScriptKind.JS],
      ['module.cjs', ts.ScriptKind.JS],
      ['module.ts', ts.ScriptKind.TS],
      ['module.mts', ts.ScriptKind.TS],
      ['module.cts', ts.ScriptKind.TS],
      ['unknown.extension', ts.ScriptKind.TS],
    ])(
      'infers the expected script kind for %s',
      (filename, expectedScriptKind) => {
        const sourceFile = createSourceFile(
          'const value = 1',
          filename,
        )
        expect(sourceFile.scriptKind).toBe(
          expectedScriptKind,
        )
      },
    )
    it('ignores Vite-style query parameters when inferring the script kind', () => {
      const sourceFile = createSourceFile(
        `
          export const Component = () => (
            <section>Hello</section>
          )
        `,
        '/src/component.tsx?direct',
      )
      expect(sourceFile.scriptKind).toBe(
        ts.ScriptKind.TSX,
      )
      expect(sourceFile.parseDiagnostics).toHaveLength(
        0,
      )
    })
    it('parses JSX syntax when the filename uses a JSX extension', () => {
      const sourceFile = createSourceFile(
        `
          export const Component = () => (
            <main data-test="component" />
          )
        `,
        '/src/component.jsx',
      )
      expect(sourceFile.scriptKind).toBe(
        ts.ScriptKind.JSX,
      )
      const jsxElements: ts.Node[] = []
      visitSourceTree(sourceFile, (node) => {
        if (
          ts.isJsxSelfClosingElement(node)
          || ts.isJsxElement(node)
        ) {
          jsxElements.push(node)
        }
      })
      expect(jsxElements).toHaveLength(1)
    })
    it('parses JSON using the JSON script kind', () => {
      const sourceFile = createSourceFile(
        JSON.stringify({
          name: 'cipo',
          enabled: true,
        }),
        'config.json',
      )
      expect(sourceFile.scriptKind).toBe(
        ts.ScriptKind.JSON,
      )
      expect(sourceFile.parseDiagnostics).toHaveLength(
        0,
      )
    })
    it('retains parent nodes because compiler transforms rely on lexical ancestry', () => {
      const sourceFile = createSourceFile(
        `
          function example() {
            return value
          }
        `,
        'source.ts',
      )
      const identifier = findIdentifier(
        sourceFile,
        'value',
      )
      expect(identifier).toBeDefined()
      expect(identifier?.parent).toBeDefined()
      expect(
        ts.isReturnStatement(identifier!.parent),
      ).toBe(true)
    })
    it('preserves the original filename on the parsed source file', () => {
      const filename =
        '/workspace/packages/cipo/src/component.tsx'
      const sourceFile = createSourceFile(
        'export const value = 1',
        filename,
      )
      expect(sourceFile.fileName).toBe(filename)
    })
  })
  describe('createSingleFileProgram', () => {
    it('creates a program backed by the requested source file', () => {
      const source = `
        export const value = 42
      `
      const { sourceFile, checker } =
        createSingleFileProgram(
          source,
          '/src/value.ts',
        )
      expect(sourceFile.fileName).toBe(
        '/src/value.ts',
      )
      expect(
        sourceFile.getFullText(),
      ).toBe(source)
      expect(checker).toBeDefined()
      expect(
        typeof checker.getSymbolAtLocation,
      ).toBe('function')
    })
    it('resolves an imported identifier call back to its import specifier', () => {
      const source = `
        import {
          configureFromCss,
        } from '@rodkisten/cipo'
        configureFromCss(css)
      `
      const { sourceFile, checker } =
        createSingleFileProgram(
          source,
          '/src/config.ts',
        )
      const call = findCallExpression(
        sourceFile,
        'configureFromCss',
      )
      expect(call).toBeDefined()
      const expression = unwrapExpression(
        call!.expression,
      )
      expect(
        ts.isIdentifier(expression),
      ).toBe(true)
      const symbol = checker.getSymbolAtLocation(
        expression,
      )
      expect(symbol).toBeDefined()
      expect(
        symbol?.declarations?.some(
          (declaration) =>
            ts.isImportSpecifier(declaration),
        ),
      ).toBe(true)
    })
    it('distinguishes an imported binding from a lexically shadowed function parameter', () => {
      const source = `
        import {
          configure,
        } from '@rodkisten/cipo'
        configure(globalCss)
        function run(
          configure: (value: string) => void,
        ) {
          configure(localCss)
        }
      `
      const { sourceFile, checker } =
        createSingleFileProgram(
          source,
          '/src/config.ts',
        )
      const identifiers =
        findCallIdentifiers(
          sourceFile,
          'configure',
        )
      expect(identifiers).toHaveLength(2)
      const [
        importedCall,
        shadowedCall,
      ] = identifiers
      const importedSymbol =
        checker.getSymbolAtLocation(
          importedCall!,
        )
      const shadowedSymbol =
        checker.getSymbolAtLocation(
          shadowedCall!,
        )
      expect(importedSymbol).toBeDefined()
      expect(shadowedSymbol).toBeDefined()
      expect(importedSymbol).not.toBe(
        shadowedSymbol,
      )
      expect(
        importedSymbol?.declarations?.some(
          (declaration) =>
            ts.isImportSpecifier(declaration),
        ),
      ).toBe(true)
      expect(
        shadowedSymbol?.declarations?.some(
          (declaration) =>
            ts.isParameter(declaration),
        ),
      ).toBe(true)
    })
    it('distinguishes an imported binding from a shadowing block-scoped variable', () => {
      const source = `
        import {
          compile,
        } from '@rodkisten/cipo/compiler'
        compile(globalSource)
        function run() {
          const compile = createLocalCompiler()
          compile(localSource)
        }
      `
      const { sourceFile, checker } =
        createSingleFileProgram(
          source,
          '/src/compiler.ts',
        )
      const identifiers =
        findCallIdentifiers(
          sourceFile,
          'compile',
        )
      expect(identifiers).toHaveLength(2)
      const globalSymbol =
        checker.getSymbolAtLocation(
          identifiers[0]!,
        )
      const localSymbol =
        checker.getSymbolAtLocation(
          identifiers[1]!,
        )
      expect(globalSymbol).not.toBe(
        localSymbol,
      )
      expect(
        globalSymbol?.declarations?.some(
          ts.isImportSpecifier,
        ),
      ).toBe(true)
      expect(
        localSymbol?.declarations?.some(
          ts.isVariableDeclaration,
        ),
      ).toBe(true)
    })
    it('resolves aliased imports by their local binding', () => {
      const source = `
        import {
          configureFromCss as configure,
        } from '@rodkisten/cipo'
        configure(css)
      `
      const { sourceFile, checker } =
        createSingleFileProgram(
          source,
          '/src/config.ts',
        )
      const identifier = findCallIdentifiers(
        sourceFile,
        'configure',
      )[0]
      expect(identifier).toBeDefined()
      const symbol =
        checker.getSymbolAtLocation(
          identifier!,
        )
      const declaration =
        symbol?.declarations?.find(
          ts.isImportSpecifier,
        )
      expect(declaration).toBeDefined()
      if (!declaration) {
        throw new Error(
          'Expected an import specifier declaration.',
        )
      }
      expect(declaration.name.text).toBe(
        'configure',
      )
      expect(
        declaration.propertyName?.text,
      ).toBe('configureFromCss')
    })
    it('uses the provided source directly without requiring module or library resolution', () => {
      const source = `
        import {
          missingAtRuntime,
        } from '@package/that/is/not-installed'
        const result = missingAtRuntime(value)
      `
      expect(() =>
        createSingleFileProgram(
          source,
          '/src/example.ts',
        ),
      ).not.toThrow()
      const { sourceFile } =
        createSingleFileProgram(
          source,
          '/src/example.ts',
        )
      expect(
        findCallExpression(
          sourceFile,
          'missingAtRuntime',
        ),
      ).toBeDefined()
    })
    it('falls back to source.tsx when an empty filename is provided', () => {
      const {
        sourceFile,
      } = createSingleFileProgram(
        'const value = <div />',
        '',
      )
      expect(sourceFile.fileName).toBe(
        'source.tsx',
      )
      expect(sourceFile.scriptKind).toBe(
        ts.ScriptKind.TSX,
      )
    })
  })
  describe('visitSourceTree', () => {
    it('visits every node exactly once in depth-first pre-order', () => {
      const sourceFile = createSourceFile(
        `
          const answer = add(40, 2)
        `,
        'source.ts',
      )
      const visited: ts.Node[] = []
      visitSourceTree(
        sourceFile,
        (node) => {
          visited.push(node)
        },
      )
      expect(visited.length).toBeGreaterThan(1)
      // The root itself must be visited before any descendants.
      expect(visited[0]).toBe(sourceFile)
      const variableStatementIndex =
        visited.findIndex(
          ts.isVariableStatement,
        )
      const declarationIndex =
        visited.findIndex(
          ts.isVariableDeclaration,
        )
      const callIndex =
        visited.findIndex(
          ts.isCallExpression,
        )
      expect(variableStatementIndex).toBeGreaterThan(
        0,
      )
      expect(declarationIndex).toBeGreaterThan(
        variableStatementIndex,
      )
      expect(callIndex).toBeGreaterThan(
        declarationIndex,
      )
      expect(
        new Set(visited).size,
      ).toBe(visited.length)
    })
    it('visits deeply nested descendants without requiring an intermediate node array', () => {
      const sourceFile = createSourceFile(
        `
          function outer() {
            if (condition) {
              for (const item of items) {
                execute(item)
              }
            }
          }
        `,
        'source.ts',
      )
      const identifiers: string[] = []
      visitSourceTree(
        sourceFile,
        (node) => {
          if (ts.isIdentifier(node)) {
            identifiers.push(node.text)
          }
        },
      )
      expect(identifiers).toEqual(
        expect.arrayContaining([
          'outer',
          'condition',
          'item',
          'items',
          'execute',
        ]),
      )
    })
    it('visits the provided leaf node itself', () => {
      const sourceFile = createSourceFile(
        'const value = 1',
        'source.ts',
      )
      const identifier = findIdentifier(
        sourceFile,
        'value',
      )
      if (!identifier) {
        throw new Error(
          'Expected value identifier.',
        )
      }
      const visited: ts.Node[] = []
      visitSourceTree(
        identifier,
        (node) => {
          visited.push(node)
        },
      )
      expect(visited).toEqual([
        identifier,
      ])
    })
  })
  describe('unwrapExpression', () => {
    it('returns an unwrapped expression unchanged', () => {
      const expression =
        getVariableInitializer(
          'const value = execute()',
        )
      const result =
        unwrapExpression(expression)
      expect(result).toBe(expression)
      expect(
        ts.isCallExpression(result),
      ).toBe(true)
    })
    it('unwraps parenthesized expressions', () => {
      const expression =
        getVariableInitializer(
          'const result = (((value)))',
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isIdentifier(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'value',
      )
    })
    it('unwraps as expressions', () => {
      const expression =
        getVariableInitializer(
          'const result = value as unknown',
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isIdentifier(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'value',
      )
    })
    it('unwraps type assertion expressions', () => {
      const expression =
        getVariableInitializer(
          'const result = <unknown>value',
          'source.ts',
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isIdentifier(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'value',
      )
    })
    it('unwraps non-null expressions', () => {
      const expression =
        getVariableInitializer(
          'const result = value!',
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isIdentifier(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'value',
      )
    })
    it('unwraps satisfies expressions', () => {
      const expression =
        getVariableInitializer(
          'const result = value satisfies unknown',
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isIdentifier(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'value',
      )
    })
    it('recursively unwraps multiple transparent TypeScript wrappers', () => {
      const expression =
        getVariableInitializer(
          `
            const result = (
              ((value as unknown)!)
              satisfies unknown
            )
          `,
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isIdentifier(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'value',
      )
    })
    it('stops unwrapping at the first semantically meaningful expression', () => {
      const expression =
        getVariableInitializer(
          `
            const result = (
              (runtime.configure as typeof runtime.configure)!
            )
          `,
        )
      const result =
        unwrapExpression(expression)
      expect(
        ts.isPropertyAccessExpression(result),
      ).toBe(true)
      expect(result.getText()).toBe(
        'runtime.configure',
      )
    })
    it('preserves object identity of the underlying AST node', () => {
      const expression =
        getVariableInitializer(
          'const result = (((value as unknown)!))',
        )
      let underlyingIdentifier:
        ts.Identifier | undefined
      visitSourceTree(
        expression,
        (node) => {
          if (
            ts.isIdentifier(node)
            && node.text === 'value'
          ) {
            underlyingIdentifier = node
          }
        },
      )
      const result =
        unwrapExpression(expression)
      expect(result).toBe(
        underlyingIdentifier,
      )
    })
  })
  describe('sourceLocationFromOffset', () => {
    it('returns a 1-based line and column for an offset on the first line', () => {
      const source = 'const value = 42'
      const offset =
        source.indexOf('value')
      expect(
        sourceLocationFromOffset(
          source,
          '/src/value.ts',
          offset,
        ),
      ).toEqual({
        filename: '/src/value.ts',
        start: offset,
        line: 1,
        column: 7,
      })
    })
    it('returns the correct line and column after multiple newlines', () => {
      const source = [
        'const first = 1',
        '',
        'const second = 2',
        'const target = second',
      ].join('\n')
      const offset =
        source.indexOf('target')
      expect(
        sourceLocationFromOffset(
          source,
          '/src/example.ts',
          offset,
        ),
      ).toEqual({
        filename: '/src/example.ts',
        start: offset,
        line: 4,
        column: 7,
      })
    })
    it('reports column one for the first character immediately after a newline', () => {
      const source = [
        'first',
        'second',
      ].join('\n')
      const offset =
        source.indexOf('second')
      const location =
        sourceLocationFromOffset(
          source,
          undefined,
          offset,
        )
      expect(location).toEqual({
        start: offset,
        line: 2,
        column: 1,
      })
    })
    it('includes the optional end offset unchanged', () => {
      const source =
        'const value = 42'
      const start =
        source.indexOf('value')
      const end =
        start + 'value'.length
      expect(
        sourceLocationFromOffset(
          source,
          '/src/value.ts',
          start,
          end,
        ),
      ).toEqual({
        filename: '/src/value.ts',
        start,
        end,
        line: 1,
        column: 7,
      })
    })
    it('omits filename when none is provided', () => {
      const result =
        sourceLocationFromOffset(
          'const value = 1',
          undefined,
          0,
        )
      expect(result).toEqual({
        start: 0,
        line: 1,
        column: 1,
      })
      expect(
        'filename' in result,
      ).toBe(false)
    })
    it('clamps a negative start offset to the beginning of the source', () => {
      expect(
        sourceLocationFromOffset(
          'const value = 1',
          '/src/value.ts',
          -100,
        ),
      ).toEqual({
        filename: '/src/value.ts',
        start: 0,
        line: 1,
        column: 1,
      })
    })
    it('clamps a start offset beyond the source length to the end of the source', () => {
      const source = [
        'first',
        'second',
      ].join('\n')
      const result =
        sourceLocationFromOffset(
          source,
          '/src/example.ts',
          Number.MAX_SAFE_INTEGER,
        )
      expect(result).toEqual({
        filename: '/src/example.ts',
        start: source.length,
        line: 2,
        column: 7,
      })
    })
    it('handles an empty source', () => {
      expect(
        sourceLocationFromOffset(
          '',
          'empty.ts',
          10,
        ),
      ).toEqual({
        filename: 'empty.ts',
        start: 0,
        line: 1,
        column: 1,
      })
    })
    it('calculates stable diagnostics at exact template boundaries', () => {
      const source = [
        "const Button = styled.button('Button').css`",
        '  color: red;',
        '`',
      ].join('\n')
      const start =
        source.indexOf('color')
      const end =
        start + 'color: red;'.length
      const location =
        sourceLocationFromOffset(
          source,
          '/src/button.ts',
          start,
          end,
        )
      expect(location).toEqual({
        filename: '/src/button.ts',
        start,
        end,
        line: 2,
        column: 3,
      })
      expect(
        source.slice(
          location.start,
          location.end,
        ),
      ).toBe('color: red;')
    })
    it('counts UTF-16 source offsets consistently with TypeScript AST positions', () => {
      const source =
        'const emoji = "🌿"; const target = true'
      const offset =
        source.indexOf('target')
      const location =
        sourceLocationFromOffset(
          source,
          '/src/unicode.ts',
          offset,
        )
      // JavaScript and TypeScript source positions operate on UTF-16 code
      // units, so the diagnostic column intentionally follows the same model.
      expect(location.start).toBe(offset)
      expect(location.line).toBe(1)
      expect(location.column).toBe(
        offset + 1,
      )
    })
  })
  describe('compiler infrastructure integration', () => {
    it('can parse, traverse, unwrap and symbol-resolve a wrapped imported call in one pipeline', () => {
      const source = `
        import {
          configureFromCss,
        } from '@rodkisten/cipo'
        ((configureFromCss as typeof configureFromCss)!)(configCss)
      `
      const {
        sourceFile,
        checker,
      } = createSingleFileProgram(
        source,
        '/src/config.ts',
      )
      let call:
        ts.CallExpression | undefined
      visitSourceTree(
        sourceFile,
        (node) => {
          if (
            ts.isCallExpression(node)
            && node.arguments.length === 1
          ) {
            const expression =
              unwrapExpression(
                node.expression,
              )
            if (
              ts.isIdentifier(expression)
              && expression.text
                === 'configureFromCss'
            ) {
              call = node
            }
          }
        },
      )
      expect(call).toBeDefined()
      const callee =
        unwrapExpression(
          call!.expression,
        )
      expect(
        ts.isIdentifier(callee),
      ).toBe(true)
      if (!ts.isIdentifier(callee)) {
        throw new Error(
          'Expected an imported identifier callee.',
        )
      }
      const symbol =
        checker.getSymbolAtLocation(
          callee,
        )
      expect(
        symbol?.declarations?.some(
          ts.isImportSpecifier,
        ),
      ).toBe(true)
      const location =
        sourceLocationFromOffset(
          source,
          '/src/config.ts',
          call!.getStart(sourceFile),
          call!.getEnd(),
        )
      expect(location.filename).toBe(
        '/src/config.ts',
      )
      expect(location.line).toBe(6)
      expect(location.column).toBe(9)
      expect(
        source.slice(
          location.start,
          location.end,
        ),
      ).toContain(
        'configureFromCss',
      )
    })
  })
})
function findIdentifier(
  sourceFile: ts.SourceFile,
  name: string,
): ts.Identifier | undefined {
  let result:
    ts.Identifier | undefined
  visitSourceTree(
    sourceFile,
    (node) => {
      if (
        !result
        && ts.isIdentifier(node)
        && node.text === name
      ) {
        result = node
      }
    },
  )
  return result
}
function findCallExpression(
  sourceFile: ts.SourceFile,
  calleeName: string,
): ts.CallExpression | undefined {
  let result:
    ts.CallExpression | undefined
  visitSourceTree(
    sourceFile,
    (node) => {
      if (
        result
        || !ts.isCallExpression(node)
      ) {
        return
      }
      const expression =
        unwrapExpression(
          node.expression,
        )
      if (
        ts.isIdentifier(expression)
        && expression.text === calleeName
      ) {
        result = node
      }
    },
  )
  return result
}
function findCallIdentifiers(
  sourceFile: ts.SourceFile,
  calleeName: string,
): ts.Identifier[] {
  const result: ts.Identifier[] = []
  visitSourceTree(
    sourceFile,
    (node) => {
      if (!ts.isCallExpression(node)) {
        return
      }
      const expression =
        unwrapExpression(
          node.expression,
        )
      if (
        ts.isIdentifier(expression)
        && expression.text === calleeName
      ) {
        result.push(expression)
      }
    },
  )
  return result
}
function getVariableInitializer(
  source: string,
  filename = 'source.ts',
): ts.Expression {
  const sourceFile =
    createSourceFile(
      source,
      filename,
    )
  for (
    const statement
    of sourceFile.statements
  ) {
    if (
      !ts.isVariableStatement(
        statement,
      )
    ) {
      continue
    }
    for (
      const declaration
      of statement.declarationList
        .declarations
    ) {
      if (declaration.initializer) {
        return declaration.initializer
      }
    }
  }
  throw new Error(
    'Expected source to contain a variable declaration with an initializer.',
  )
}
