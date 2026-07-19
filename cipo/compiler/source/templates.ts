import * as ts from 'typescript'
import { overlapsAny, type SourceEdit } from './edits'
import { createSingleFileProgram, createSourceFile, unwrapExpression, visitSourceTree } from './program'

export interface StyledCssTemplateHit {
  readonly start: number
  readonly receiver: string
  readonly templateStart: number
  readonly templateEnd: number
  readonly requiresRegistrationSideEffect: boolean
}

export interface CssTemplateHit {
  readonly start: number
  readonly templateStart: number
  readonly templateEnd: number
}

const CSS_IMPORTED_NAMES = new Set(['css'])
const CSS_UNBOUND_NAMES = new Set(['css'])
const STYLED_IMPORTED_NAMES = new Set(['styled', 'cipo', 'sheet'])
const STYLED_UNBOUND_NAMES = new Set(['styled', 'cipo', 'sheet'])
const CREATE_STYLED_IMPORTED_NAMES = new Set(['createStyled'])
const EMPTY_NAMES = new Set<string>()
const DEFAULT_CIPO_IMPORT_MODULES = new Set(['@rodkisten/cipo'])

/** Finds `.css` tagged templates using AST structure and trusted styled binding identity. */
export function findStyledCssTemplates(
  source: string,
  filename = 'source.tsx',
  importModules: ReadonlySet<string> = DEFAULT_CIPO_IMPORT_MODULES,
): StyledCssTemplateHit[] {
  const { sourceFile, checker } = createSingleFileProgram(source, filename)
  const hits: StyledCssTemplateHit[] = []

  visitSourceTree(sourceFile, (node) => {
    if (!ts.isTaggedTemplateExpression(node)) return
    const tag = unwrapExpression(node.tag)
    if (!ts.isPropertyAccessExpression(tag) || tag.name.text !== 'css') return

    // `namespace.css`` ` belongs to the bare CSS surface. A namespace import is
    // still a valid root for deeper styled chains such as `namespace.styled.div`.
    const receiver = unwrapExpression(tag.expression)
    if (ts.isIdentifier(receiver) && isCipoNamespaceImport(receiver, checker, importModules)) return

    const root = findRootIdentifier(tag.expression)
    if (!root || !isCompilableStyledRoot(root, checker, importModules)) return

    hits.push({
      start: tag.expression.getStart(sourceFile),
      receiver: tag.expression.getText(sourceFile),
      templateStart: node.template.getStart(sourceFile),
      templateEnd: node.template.getEnd() - 1,
      requiresRegistrationSideEffect: hasExplicitStyledRegistrationName(tag.expression),
    })
  })
  return hits.sort(compareSourcePosition)
}

/** Finds bare Cipó `css`` templates while rejecting locally shadowed lookalikes. */
export function findBareCssTemplates(
  source: string,
  existingEdits: readonly SourceEdit[] = [],
  filename = 'source.tsx',
): CssTemplateHit[] {
  const { sourceFile, checker } = createSingleFileProgram(source, filename)
  const hits: CssTemplateHit[] = []

  visitSourceTree(sourceFile, (node) => {
    if (!ts.isTaggedTemplateExpression(node)) return
    const tag = unwrapExpression(node.tag)
    const isBareBinding = ts.isIdentifier(tag)
      && isCipoImportedOrUnboundBinding(tag, checker, CSS_IMPORTED_NAMES, CSS_UNBOUND_NAMES)
    const isNamespaceBinding = ts.isPropertyAccessExpression(tag)
      && tag.name.text === 'css'
      && ts.isIdentifier(unwrapExpression(tag.expression))
      && isCipoNamespaceImport(unwrapExpression(tag.expression) as ts.Identifier, checker)
    if (!isBareBinding && !isNamespaceBinding) return
    const start = node.getStart(sourceFile)
    const end = node.getEnd()
    if (overlapsAny(start, end, existingEdits)) return
    hits.push({
      start,
      templateStart: node.template.getStart(sourceFile),
      templateEnd: node.template.getEnd() - 1,
    })
  })
  return hits.sort(compareSourcePosition)
}

/** Returns true when the source range represents a template with substitutions. */
export function hasTemplateInterpolation(source: string, templateStart: number, templateEnd: number): boolean {
  const text = source.slice(templateStart, templateEnd + 1)
  const sourceFile = createSourceFile(`const __cipo = ${text}`, 'template.ts')
  const statement = sourceFile.statements[0]
  if (!statement || !ts.isVariableStatement(statement)) return text.includes('${')
  const initializer = statement.declarationList.declarations[0]?.initializer
  return Boolean(initializer && ts.isTemplateExpression(initializer))
}

function hasExplicitStyledRegistrationName(expression: ts.Expression): boolean {
  const current = unwrapExpression(expression)
  if (ts.isCallExpression(current)) {
    if (current.arguments.some((argument) => ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
      return true
    }
    return hasExplicitStyledRegistrationName(current.expression)
  }
  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    return hasExplicitStyledRegistrationName(current.expression)
  }
  return false
}

function findRootIdentifier(expression: ts.Expression): ts.Identifier | null {
  const current = unwrapExpression(expression)
  if (ts.isIdentifier(current)) return current
  if (ts.isCallExpression(current)) return findRootIdentifier(current.expression)
  if (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    return findRootIdentifier(current.expression)
  }
  return null
}

function isCompilableStyledRoot(
  identifier: ts.Identifier,
  checker: ts.TypeChecker,
  importModules: ReadonlySet<string>,
): boolean {
  if (
    isCipoImportedOrUnboundBinding(
      identifier,
      checker,
      STYLED_IMPORTED_NAMES,
      STYLED_UNBOUND_NAMES,
      importModules,
    )
  ) return true

  const symbol = checker.getSymbolAtLocation(identifier)
  return (symbol?.declarations ?? []).some((declaration) => {
    if (!ts.isVariableDeclaration(declaration) || !declaration.initializer) return false
    const initializer = unwrapExpression(declaration.initializer)
    if (!ts.isCallExpression(initializer)) return false
    const callee = unwrapExpression(initializer.expression)
    return ts.isIdentifier(callee)
      && isCipoImportedOrUnboundBinding(
        callee,
        checker,
        CREATE_STYLED_IMPORTED_NAMES,
        EMPTY_NAMES,
        importModules,
      )
  })
}

function isCipoImportedOrUnboundBinding(
  identifier: ts.Identifier,
  checker: ts.TypeChecker,
  importedNames: ReadonlySet<string>,
  allowedUnboundNames: ReadonlySet<string>,
  importModules: ReadonlySet<string> = DEFAULT_CIPO_IMPORT_MODULES,
): boolean {
  const symbol = checker.getSymbolAtLocation(identifier)
  if (!symbol) return allowedUnboundNames.has(identifier.text)

  return (symbol.declarations ?? []).some((declaration) => {
    if (ts.isNamespaceImport(declaration)) return isCipoNamespaceImport(identifier, checker, importModules)
    if (!ts.isImportSpecifier(declaration) || declaration.isTypeOnly) return false
    const importDeclaration = declaration.parent.parent.parent
    if (!ts.isImportDeclaration(importDeclaration) || !ts.isStringLiteral(importDeclaration.moduleSpecifier)) return false
    if (importDeclaration.importClause?.isTypeOnly) return false
    if (!importModules.has(importDeclaration.moduleSpecifier.text)) return false
    return importedNames.has(declaration.propertyName?.text ?? declaration.name.text)
  })
}

function isCipoNamespaceImport(
  identifier: ts.Identifier,
  checker: ts.TypeChecker,
  importModules: ReadonlySet<string> = DEFAULT_CIPO_IMPORT_MODULES,
): boolean {
  const symbol = checker.getSymbolAtLocation(identifier)
  return (symbol?.declarations ?? []).some((declaration) => {
    if (!ts.isNamespaceImport(declaration)) return false
    const importDeclaration = declaration.parent.parent
    return ts.isImportDeclaration(importDeclaration)
      && !importDeclaration.importClause?.isTypeOnly
      && ts.isStringLiteral(importDeclaration.moduleSpecifier)
      && importModules.has(importDeclaration.moduleSpecifier.text)
  })
}

function compareSourcePosition(left: { readonly start: number }, right: { readonly start: number }): number {
  return left.start - right.start
}
