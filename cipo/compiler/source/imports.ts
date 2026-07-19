import * as ts from 'typescript'
import { applyEdits, type SourceEdit } from './edits'
import {
  createSingleFileProgram,
  createSourceFile,
  unwrapExpression,
  visitSourceTree,
} from './program'

export interface EnsureImportBindingResult {
  readonly code: string
  readonly localName: string
  readonly changed: boolean
}

type RuntimeImportDeclaration = ts.ImportDeclaration & {
  readonly importClause: ts.ImportClause
}

/** Ensures a named import from the exact requested module. */
export function ensureNamedImport(
  source: string,
  symbol: string,
  importPath: string,
): string {
  return ensureNamedImportBinding(source, symbol, importPath, symbol).code
}

/** Returns a collision-free top-level binding name without modifying source. */
export function getAvailableBindingName(
  source: string,
  preferredLocalName: string,
  filename = 'source.tsx',
): string {
  return chooseAvailableBinding(
    preferredLocalName,
    collectTopLevelBindingNames(createSourceFile(source, filename)),
  )
}

/**
 * Ensures a collision-free named import from the exact module and returns
 * the local binding emitted.
 *
 * Aliases, type-only imports and same-named imports from unrelated modules
 * are handled independently.
 */
export function ensureNamedImportBinding(
  source: string,
  importedName: string,
  importPath: string,
  preferredLocalName = importedName,
  filename = 'source.tsx',
): EnsureImportBindingResult {
  const sourceFile = createSourceFile(source, filename)
  const occupied = collectTopLevelBindingNames(sourceFile)

  const matchingImports = sourceFile.statements.filter(
    (statement): statement is RuntimeImportDeclaration =>
      isMatchingRuntimeImportDeclaration(statement, importPath),
  )

  for (const declaration of matchingImports) {
    const bindings = getNamedImports(declaration.importClause)
    if (!bindings) continue

    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue

      const exportedName = element.propertyName?.text ?? element.name.text

      if (
        exportedName === importedName
        && element.name.text === preferredLocalName
      ) {
        return {
          code: source,
          localName: preferredLocalName,
          changed: false,
        }
      }
    }
  }

  const localName = chooseAvailableBinding(
    preferredLocalName,
    occupied,
  )

  const specifier = localName === importedName
    ? importedName
    : `${importedName} as ${localName}`

  for (const declaration of matchingImports) {
    const bindings = getNamedImports(declaration.importClause)
    if (!bindings) continue

    const insertAt = bindings.getEnd() - 1
    const prefix = bindings.elements.length > 0 ? ', ' : ''

    return {
      code: applyEdits(source, [
        {
          start: insertAt,
          end: insertAt,
          value: `${prefix}${specifier}`,
        },
      ]),
      localName,
      changed: true,
    }
  }

  const insertionIndex = getImportInsertionIndex(source, sourceFile)
  const importCode = `import { ${specifier} } from ${JSON.stringify(importPath)};\n`

  return {
    code: `${source.slice(0, insertionIndex)}${importCode}${source.slice(insertionIndex)}`,
    localName,
    changed: true,
  }
}

/**
 * Removes named import bindings that are no longer referenced by
 * executable code.
 */
export function removeUnusedNamedImports(
  source: string,
  candidateLocalNames: ReadonlySet<string>,
  filename = 'source.tsx',
): string {
  if (candidateLocalNames.size === 0) return source

  const { sourceFile, checker } = createSingleFileProgram(source, filename)
  const referenceCounts = countExecutableIdentifierReferences(
    sourceFile,
    checker,
    candidateLocalNames,
  )
  const edits: SourceEdit[] = []

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue

    const clause = statement.importClause
    const bindings = getNamedImports(clause)

    if (!bindings) continue

    const removable = bindings.elements.filter((element) => {
      const localName = element.name.text

      return (
        candidateLocalNames.has(localName)
        && (referenceCounts.get(localName) ?? 0) === 0
      )
    })

    if (removable.length === 0) continue

    if (
      removable.length === bindings.elements.length
      && !clause?.name
    ) {
      edits.push({
        start: statement.getFullStart(),
        end: statement.getEnd(),
        value: '',
      })
      continue
    }

    for (const element of removable) {
      edits.push(
        removeListElementEdit(
          bindings.elements,
          element,
        ),
      )
    }
  }

  return edits.length > 0
    ? applyEdits(
        source,
        normalizeRemovalEdits(edits),
      )
    : source
}

/**
 * Collects local names imported for a specific exported symbol from
 * matching modules.
 */
export function findImportedBindings(
  source: string,
  importedName: string,
  moduleNames: ReadonlySet<string>,
  filename = 'source.tsx',
): ReadonlySet<string> {
  const sourceFile = createSourceFile(source, filename)
  const bindings = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (!moduleNames.has(statement.moduleSpecifier.text)) continue

    const clause = statement.importClause
    if (clause?.isTypeOnly) continue

    const namedImports = getNamedImports(clause)
    if (!namedImports) continue

    for (const element of namedImports.elements) {
      if (element.isTypeOnly) continue

      const exportedName =
        element.propertyName?.text
        ?? element.name.text

      if (exportedName === importedName) {
        bindings.add(element.name.text)
      }
    }
  }

  return bindings
}

/**
 * Finds imported identifier calls while rejecting lexically shadowed
 * local parameters and variables.
 */
export function findIdentifierCalls(
  source: string,
  localNames: ReadonlySet<string>,
  filename = 'source.tsx',
): readonly ts.CallExpression[] {
  const {
    sourceFile,
    checker,
  } = createSingleFileProgram(source, filename)

  const calls: ts.CallExpression[] = []

  visitSourceTree(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return

    const expression = unwrapExpression(node.expression)

    if (!ts.isIdentifier(expression)) return
    if (!localNames.has(expression.text)) return

    const symbol = checker.getSymbolAtLocation(expression)

    const imported = symbol?.declarations?.some(
      (declaration): boolean =>
        ts.isImportSpecifier(declaration)
        && declaration.name.text === expression.text,
    )

    if (imported === true) {
      calls.push(node)
    }
  })

  return calls
}

function isMatchingRuntimeImportDeclaration(
  statement: ts.Statement,
  importPath: string,
): statement is RuntimeImportDeclaration {
  if (!ts.isImportDeclaration(statement)) return false
  if (!ts.isStringLiteral(statement.moduleSpecifier)) return false

  const clause = statement.importClause

  return (
    clause !== undefined
    && !clause.isTypeOnly
    && statement.moduleSpecifier.text === importPath
  )
}

function getNamedImports(
  clause: ts.ImportClause | undefined,
): ts.NamedImports | undefined {
  const bindings = clause?.namedBindings

  return bindings && ts.isNamedImports(bindings)
    ? bindings
    : undefined
}

function isNamedValueDeclaration(
  statement: ts.Statement,
): statement is
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.EnumDeclaration {
  return (
    ts.isFunctionDeclaration(statement)
    || ts.isClassDeclaration(statement)
    || ts.isEnumDeclaration(statement)
  )
}

function collectTopLevelBindingNames(
  sourceFile: ts.SourceFile,
): Set<string> {
  const names = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause

      if (clause?.name) {
        names.add(clause.name.text)
      }

      const bindings = clause?.namedBindings

      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          names.add(element.name.text)
        }
      } else if (
        bindings
        && ts.isNamespaceImport(bindings)
      ) {
        names.add(bindings.name.text)
      }

      continue
    }

    if (ts.isVariableStatement(statement)) {
      for (
        const declaration
        of statement.declarationList.declarations
      ) {
        collectBindingName(
          declaration.name,
          names,
        )
      }

      continue
    }

    if (isNamedValueDeclaration(statement)) {
      const name = statement.name

      if (name) {
        names.add(name.text)
      }
    }
  }

  return names
}

function collectBindingName(
  name: ts.BindingName,
  names: Set<string>,
): void {
  if (ts.isIdentifier(name)) {
    names.add(name.text)
    return
  }

  /*
   * Array binding patterns may contain OmittedExpression nodes, while
   * object binding patterns contain only BindingElement nodes.
   * Handle them separately so the AST narrowing remains fully typed.
   */
  if (ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        collectBindingName(
          element.name,
          names,
        )
      }
    }

    return
  }

  for (const element of name.elements) {
    collectBindingName(
      element.name,
      names,
    )
  }
}

function chooseAvailableBinding(
  preferred: string,
  occupied: ReadonlySet<string>,
): string {
  if (!occupied.has(preferred)) {
    return preferred
  }

  let index = 1

  const capitalizedPreferred =
    `${preferred[0]?.toUpperCase() ?? ''}${preferred.slice(1)}`

  let candidate =
    `__cipo${capitalizedPreferred}`

  while (occupied.has(candidate)) {
    candidate =
      `__cipo${preferred}_${index}`

    index += 1
  }

  return candidate
}

function countExecutableIdentifierReferences(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  candidates: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>()
  const importedSymbols = new Map<string, ts.Symbol>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const bindings = getNamedImports(statement.importClause)
    if (!bindings) continue

    for (const element of bindings.elements) {
      if (!candidates.has(element.name.text)) continue
      const symbol = checker.getSymbolAtLocation(element.name)
      if (symbol) importedSymbols.set(element.name.text, symbol)
    }
  }

  visitSourceTree(sourceFile, (node) => {
    if (!ts.isIdentifier(node)) return
    if (!candidates.has(node.text)) return
    if (isImportIdentifier(node)) return
    if (isPropertyAccessPropertyName(node)) return

    const importedSymbol = importedSymbols.get(node.text)
    if (!importedSymbol) return

    const symbol = checker.getSymbolAtLocation(node)
    if (symbol !== importedSymbol) return

    counts.set(node.text, (counts.get(node.text) ?? 0) + 1)
  })

  return counts
}

function isPropertyAccessPropertyName(node: ts.Identifier): boolean {
  return ts.isPropertyAccessExpression(node.parent) && node.parent.name === node
}

function isImportIdentifier(
  node: ts.Identifier,
): boolean {
  let current: ts.Node | undefined = node

  while (current) {
    if (ts.isImportDeclaration(current)) {
      return true
    }

    if (
      ts.isStatement(current)
      || ts.isSourceFile(current)
    ) {
      return false
    }

    current = current.parent
  }

  return false
}

function getImportInsertionIndex(source: string, sourceFile: ts.SourceFile): number {
  let insertionIndex = source.startsWith('#!')
    ? Math.max(0, source.indexOf('\n') + 1)
    : 0

  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break
    insertionIndex = statement.getEnd()

    while (insertionIndex < source.length && /[ \t]/.test(source[insertionIndex] ?? '')) {
      insertionIndex += 1
    }

    if (source[insertionIndex] === '\r' && source[insertionIndex + 1] === '\n') {
      insertionIndex += 2
    } else if (source[insertionIndex] === '\n' || source[insertionIndex] === '\r') {
      insertionIndex += 1
    }
  }

  return insertionIndex
}

function removeListElementEdit<T extends ts.Node>(
  elements: readonly T[],
  element: T,
): SourceEdit {
  const index = elements.indexOf(element)
  const previous = elements[index - 1]
  const next = elements[index + 1]

  if (next) {
    return {
      start: element.getFullStart(),
      end: next.getFullStart(),
      value: '',
    }
  }

  if (previous) {
    return {
      start: previous.getEnd(),
      end: element.getEnd(),
      value: '',
    }
  }

  return {
    start: element.getStart(),
    end: element.getEnd(),
    value: '',
  }
}

function normalizeRemovalEdits(
  edits: readonly SourceEdit[],
): SourceEdit[] {
  return [...edits]
    .sort(
      (left, right) =>
        left.start - right.start,
    )
    .filter(
      (edit, index, all) => {
        const previous = all[index - 1]

        return (
          previous === undefined
          || edit.start >= previous.end
        )
      },
    )
}
