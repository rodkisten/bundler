import * as ts from "typescript";

export interface CompilerHelperBinding {
  readonly localName: string;
  readonly alreadyImported: boolean;
}

export function resolveCompilerHelper(
  sourceFile: ts.SourceFile,
  importPath: string,
): CompilerHelperBinding {
  const used = collectTopLevelBindingNames(sourceFile);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== importPath) continue;

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === "createCompiledTemplate") {
        return { localName: element.name.text, alreadyImported: true };
      }
    }
  }

  let localName = "createCompiledTemplate";
  if (used.has(localName)) {
    localName = "__fabricaCreateCompiledTemplate";
    let suffix = 2;
    while (used.has(localName)) {
      localName = `__fabricaCreateCompiledTemplate${suffix}`;
      suffix += 1;
    }
  }
  return { localName, alreadyImported: false };
}

export function injectCompilerImport(
  source: string,
  originalSourceFile: ts.SourceFile,
  importPath: string,
  localName: string,
): string {
  const imported = localName === "createCompiledTemplate"
    ? "createCompiledTemplate"
    : `createCompiledTemplate as ${localName}`;
  const statement =
    `import { ${imported} } from ${JSON.stringify(importPath)};\n`;
  const insertion = findImportInsertionOffset(source, originalSourceFile);
  return source.slice(0, insertion) + statement + source.slice(insertion);
}

function findImportInsertionOffset(
  source: string,
  sourceFile: ts.SourceFile,
): number {
  let offset = source.startsWith("#!")
    ? Math.max(source.indexOf("\n") + 1, 0)
    : 0;

  for (const statement of sourceFile.statements) {
    if (!isDirectiveStatement(statement)) break;
    offset = statement.getEnd();
    while (source[offset] === "\r" || source[offset] === "\n") offset += 1;
  }

  return offset;
}

function isDirectiveStatement(statement: ts.Statement): boolean {
  return (
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression)
  );
}

function collectTopLevelBindingNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name) names.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        names.add(bindings.name.text);
      } else if (bindings) {
        for (const element of bindings.elements) names.add(element.name.text);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingName(declaration.name, names);
      }
      continue;
    }

    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name
    ) {
      names.add(statement.name.text);
    }
  }

  return names;
}

function collectBindingName(
  name: ts.BindingName,
  output: Set<string>,
): void {
  if (ts.isIdentifier(name)) {
    output.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingName(element.name, output);
  }
}
