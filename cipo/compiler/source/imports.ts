import * as ts from 'typescript'
import { applyEdits, type SourceEdit } from './edits'
import { createSingleFileProgram, createSourceFile, unwrapExpression, visitSourceTree } from './program'

export interface EnsureImportBindingResult {
  readonly code: string
  readonly localName: string
  readonly changed: boolean
}

/** Ensures a named import from the exact requested module. */
export function ensureNamedImport(source: string, symbol: string, importPath: string): string {
  return ensureNamedImportBinding(source, symbol, importPath, symbol).code
}

/** Returns a collision-free top-level binding name without modifying source. */
export function getAvailableBindingName(
  source: string,
  preferredLocalName: string,
  filename = 'source.tsx',
): string {
  return chooseAvailableBinding(preferredLocalName, collectTopLevelBindingNames(createSourceFile(source, filename)))
}

/**
 * Ensures a collision-free named import from the exact module and returns the local binding emitted.
 * Aliases, type-only imports and same-named imports from unrelated modules are handled independently.
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
    (statement): statement is ts.ImportDeclaration => (
      ts.isImportDeclaration(statement)
      && ts.isStringLiteral(statement.moduleSpecifier)
      && !statement.importClause?.isTypeOnly
      && statement.moduleSpecifier.text === importPath
    ),
  )

  for (const declaration of matchingImports) {
    const bindings = declaration.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue
      const exported = element.propertyName?.text ?? element.name.text
      if (exported === importedName && element.name.text === preferredLocalName) {
        return { code: source, localName: preferredLocalName, changed: false }
      }
    }
  }

  const localName = chooseAvailableBinding(preferredLocalName, occupied)
  const specifier = localName === importedName ? importedName : `${importedName} as ${localName}`

  for (const declaration of matchingImports) {
    const bindings = declaration.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    const insertAt = bindings.getEnd() - 1
    const prefix = bindings.elements.length > 0 ? ', ' : ''
    return {
      code: applyEdits(source, [{ start: insertAt, end: insertAt, value: `${prefix}${specifier}` }]),
      localName,
      changed: true,
    }
  }

  return {
    code: `import { ${specifier} } from ${JSON.stringify(importPath)};\n${source}`,
    localName,
    changed: true,
  }
}

/** Removes named import bindings that are no longer referenced by executable code. */
export function removeUnusedNamedImports(
  source: string,
  candidateLocalNames: ReadonlySet<string>,
  filename = 'source.tsx',
): string {
  if (candidateLocalNames.size === 0) return source

  const sourceFile = createSourceFile(source, filename)
  const referenceCounts = countExecutableIdentifierReferences(sourceFile, candidateLocalNames)
  const edits: SourceEdit[] = []

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const clause = statement.importClause
    const bindings = clause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue

    const removable = bindings.elements.filter(
      (element) => candidateLocalNames.has(element.name.text) && (referenceCounts.get(element.name.text) ?? 0) === 0,
    )
    if (removable.length === 0) continue

    if (removable.length === bindings.elements.length && !clause?.name) {
      edits.push({ start: statement.getFullStart(), end: statement.getEnd(), value: '' })
      continue
    }
    for (const element of removable) edits.push(removeListElementEdit(bindings.elements, element))
  }

  return edits.length > 0 ? applyEdits(source, normalizeRemovalEdits(edits)) : source
}

/** Collects local names imported for a specific exported symbol from matching modules. */
export function findImportedBindings(
  source: string,
  importedName: string,
  moduleNames: ReadonlySet<string>,
  filename = 'source.tsx',
): ReadonlySet<string> {
  const sourceFile = createSourceFile(source, filename)
  const bindings = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (!moduleNames.has(statement.moduleSpecifier.text)) continue
    const clause = statement.importClause
    if (clause?.isTypeOnly) continue
    const named = clause?.namedBindings
    if (!named || !ts.isNamedImports(named)) continue

    for (const element of named.elements) {
      if (element.isTypeOnly) continue
      if ((element.propertyName?.text ?? element.name.text) === importedName) bindings.add(element.name.text)
    }
  }
  return bindings
}

/** Finds imported identifier calls while rejecting lexically shadowed local parameters/variables. */
export function findIdentifierCalls(
  source: string,
  localNames: ReadonlySet<string>,
  filename = 'source.tsx',
): readonly ts.CallExpression[] {
  const { sourceFile, checker } = createSingleFileProgram(source, filename)
  const calls: ts.CallExpression[] = []

  visitSourceTree(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return
    const expression = unwrapExpression(node.expression)
    if (!ts.isIdentifier(expression) || !localNames.has(expression.text)) return
    const symbol = checker.getSymbolAtLocation(expression)
    const imported = symbol?.declarations?.some(
      (declaration) => ts.isImportSpecifier(declaration) && declaration.name.text === expression.text,
    )
    if (imported) calls.push(node)
  })
  return calls
}

function collectTopLevelBindingNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause
      if (clause?.name) names.add(clause.name.text)
      const bindings = clause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) names.add(element.name.text)
      } else if (bindings && ts.isNamespaceImport(bindings)) {
        names.add(bindings.name.text)
      }
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) collectBindingName(declaration.name, names)
      continue
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement))
      && statement.name
    ) names.add(statement.name.text)
  }
  return names
}

function collectBindingName(name: ts.BindingName, names: Set<string>): void {
  if (ts.isIdentifier(name)) {
    names.add(name.text)
    return
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) collectBindingName(element.name, names)
  }
}

function chooseAvailableBinding(preferred: string, occupied: ReadonlySet<string>): string {
  if (!occupied.has(preferred)) return preferred
  let index = 1
  let candidate = `__cipo${preferred[0]?.toUpperCase() ?? ''}${preferred.slice(1)}`
  while (occupied.has(candidate)) {
    candidate = `__cipo${preferred}_${index}`
    index += 1
  }
  return candidate
}

function countExecutableIdentifierReferences(
  sourceFile: ts.SourceFile,
  candidates: ReadonlySet<string>,
): Map<string, number> {
  const counts = new Map<string, number>()
  visitSourceTree(sourceFile, (node) => {
    if (!ts.isIdentifier(node) || !candidates.has(node.text) || isImportIdentifier(node)) return
    counts.set(node.text, (counts.get(node.text) ?? 0) + 1)
  })
  return counts
}

function isImportIdentifier(node: ts.Identifier): boolean {
  let current: ts.Node | undefined = node
  while (current) {
    if (ts.isImportDeclaration(current)) return true
    if (ts.isStatement(current) || ts.isSourceFile(current)) return false
    current = current.parent
  }
  return false
}

function removeListElementEdit<T extends ts.Node>(elements: ts.NodeArray<T>, element: T): SourceEdit {
  const index = elements.indexOf(element)
  const previous = elements[index - 1]
  const next = elements[index + 1]
  if (next) return { start: element.getFullStart(), end: next.getFullStart(), value: '' }
  if (previous) return { start: previous.getEnd(), end: element.getEnd(), value: '' }
  return { start: element.getStart(), end: element.getEnd(), value: '' }
}

function normalizeRemovalEdits(edits: readonly SourceEdit[]): SourceEdit[] {
  return [...edits]
    .sort((left, right) => left.start - right.start)
    .filter((edit, index, all) => index === 0 || edit.start >= all[index - 1]!.end)
}
