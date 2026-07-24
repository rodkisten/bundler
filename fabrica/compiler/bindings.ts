import * as ts from "typescript";

export function isFabricaTemplateTag(
  tag: ts.LeftHandSideExpression,
  checker: ts.TypeChecker,
  configuredTags: ReadonlySet<string>,
  fabricaImportModules: ReadonlySet<string> = new Set(),
): boolean {
  const text = readTagPath(tag);
  if (text && configuredTags.has(text)) {
    return (
      !hasDefinitelyUnrelatedBinding(
        tag,
        checker,
        fabricaImportModules,
      ) &&
      !hasSyntacticShadowing(tag)
    );
  }

  return isImportedFabricaTag(
    tag,
    checker,
    fabricaImportModules,
  );
}

function isImportedFabricaTag(
  tag: ts.LeftHandSideExpression,
  checker: ts.TypeChecker,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  if (
    hasDefinitelyUnrelatedBinding(
      tag,
      checker,
      fabricaImportModules,
    )
  ) {
    return false;
  }
  if (hasSyntacticShadowing(tag)) return false;

  const sourceFile = tag.getSourceFile();

  if (ts.isIdentifier(tag)) {
    if (
      hasNamedFabricaHtmlImport(
        sourceFile,
        tag.text,
        fabricaImportModules,
      )
    ) {
      return true;
    }

    const symbol = getSymbolAtLocationSafe(checker, tag);
    return Boolean(
      symbol &&
      symbol.declarations?.some((declaration) =>
        isFabricaHtmlImport(declaration, fabricaImportModules),
      ),
    );
  }

  if (!ts.isPropertyAccessExpression(tag) || tag.name.text !== "html") {
    return false;
  }

  if (!ts.isIdentifier(tag.expression)) return false;
  if (
    hasFabricaNamespaceImport(
      sourceFile,
      tag.expression.text,
      fabricaImportModules,
    )
  ) {
    return true;
  }

  const symbol = getSymbolAtLocationSafe(checker, tag.expression);
  return Boolean(
    symbol &&
    symbol.declarations?.some((declaration) =>
      isFabricaNamespaceImport(declaration, fabricaImportModules),
    ),
  );
}

function hasSyntacticShadowing(
  tag: ts.LeftHandSideExpression,
): boolean {
  const root = readRootIdentifier(tag);
  if (!root) return false;
  const name = root.text;

  let current: ts.Node | undefined = tag.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) {
      for (const parameter of current.parameters) {
        if (bindingNameContains(parameter.name, name)) return true;
      }
    }

    if (ts.isCatchClause(current) && current.variableDeclaration) {
      if (bindingNameContains(current.variableDeclaration.name, name)) {
        return true;
      }
    }

    if (ts.isBlock(current)) {
      if (blockDeclaresUnrelatedName(current, name)) return true;
    }

    current = current.parent;
  }

  return false;
}

function blockDeclaresUnrelatedName(
  block: ts.Block,
  name: string,
): boolean {
  for (const statement of block.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!bindingNameContains(declaration.name, name)) continue;
        return !looksLikeFabricaBinding(declaration);
      }
    }

    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      statement.name?.text === name
    ) {
      return true;
    }
  }

  return false;
}

function bindingNameContains(
  binding: ts.BindingName,
  name: string,
): boolean {
  if (ts.isIdentifier(binding)) return binding.text === name;
  for (const element of binding.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (bindingNameContains(element.name, name)) return true;
  }
  return false;
}

function hasNamedFabricaHtmlImport(
  sourceFile: ts.SourceFile,
  localName: string,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (
      !isFabricaModule(
        statement.moduleSpecifier.text,
        fabricaImportModules,
      )
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === "html" && element.name.text === localName) return true;
    }
  }

  return false;
}

function hasFabricaNamespaceImport(
  sourceFile: ts.SourceFile,
  localName: string,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (
      !isFabricaModule(
        statement.moduleSpecifier.text,
        fabricaImportModules,
      )
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (
      bindings &&
      ts.isNamespaceImport(bindings) &&
      bindings.name.text === localName
    ) {
      return true;
    }
  }

  return false;
}

function getSymbolAtLocationSafe(
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined {
  try {
    return checker.getSymbolAtLocation(node);
  } catch {
    // Virtual and partially resolved source files can leave TypeScript's
    // internal symbol tables incomplete. Syntactic import/shadow analysis
    // remains authoritative when semantic lookup is unavailable.
    return undefined;
  }
}

function hasDefinitelyUnrelatedBinding(
  tag: ts.LeftHandSideExpression,
  checker: ts.TypeChecker,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  const root = readRootIdentifier(tag);
  if (!root) return false;

  const symbol = getSymbolAtLocationSafe(checker, root);
  if (!symbol?.declarations?.length) return false;

  return symbol.declarations.every((declaration) => {
    if (ts.isParameter(declaration)) return true;
    if (ts.isFunctionDeclaration(declaration)) return true;
    if (ts.isClassDeclaration(declaration)) return true;

    if (ts.isImportSpecifier(declaration)) {
      const moduleName = readImportModule(declaration);
      if (!moduleName) return false;
      if (
        isFabricaModule(moduleName, fabricaImportModules) ||
        moduleName.startsWith(".")
      ) {
        return false;
      }
      return true;
    }

    if (ts.isNamespaceImport(declaration)) {
      const moduleName = readImportModule(declaration);
      return Boolean(
        moduleName &&
        !isFabricaModule(moduleName, fabricaImportModules) &&
        !moduleName.startsWith("."),
      );
    }

    if (ts.isVariableDeclaration(declaration)) {
      return !looksLikeFabricaBinding(declaration);
    }

    if (ts.isBindingElement(declaration)) {
      const variable = declaration.parent.parent;
      return ts.isVariableDeclaration(variable)
        ? !looksLikeFabricaBinding(variable)
        : true;
    }

    return false;
  });
}

function looksLikeFabricaBinding(
  declaration: ts.VariableDeclaration,
): boolean {
  const initializer = declaration.initializer;
  if (!initializer) return false;

  if (ts.isPropertyAccessExpression(initializer)) {
    return initializer.name.text === "html" || initializer.name.text === "jsx";
  }

  if (ts.isCallExpression(initializer)) {
    const callee = initializer.expression;
    if (ts.isIdentifier(callee)) {
      return /^(?:create|getOrCreate)(?:Fabrica)?$/.test(callee.text);
    }
    if (ts.isPropertyAccessExpression(callee)) {
      return /^(?:create|getOrCreate)$/.test(callee.name.text);
    }
  }

  return false;
}

function isFabricaHtmlImport(
  declaration: ts.Declaration,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  if (!ts.isImportSpecifier(declaration)) return false;
  const imported = declaration.propertyName?.text ?? declaration.name.text;
  if (imported !== "html") return false;
  const moduleName = readImportModule(declaration);
  return Boolean(
    moduleName &&
    (
      isFabricaModule(moduleName, fabricaImportModules) ||
      moduleName.startsWith(".")
    ),
  );
}

function isFabricaNamespaceImport(
  declaration: ts.Declaration,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  if (!ts.isNamespaceImport(declaration)) return false;
  const moduleName = readImportModule(declaration);
  return Boolean(
    moduleName &&
    isFabricaModule(moduleName, fabricaImportModules),
  );
}

function isFabricaModule(
  moduleName: string,
  fabricaImportModules: ReadonlySet<string>,
): boolean {
  return (
    fabricaImportModules.has(moduleName) ||
    moduleName === "../index.js" ||
    moduleName === "@rodkisten/fabrica" ||
    moduleName.startsWith("@rodkisten/fabrica/")
  );
}

function readImportModule(declaration: ts.Node): string | null {
  let current: ts.Node | undefined = declaration;
  while (current && !ts.isImportDeclaration(current)) {
    current = current.parent;
  }
  if (!current || !ts.isStringLiteral(current.moduleSpecifier)) return null;
  return current.moduleSpecifier.text;
}

function readTagPath(tag: ts.Expression): string | null {
  if (ts.isIdentifier(tag)) return tag.text;
  if (!ts.isPropertyAccessExpression(tag)) return null;
  const parent = readTagPath(tag.expression);
  return parent ? `${parent}.${tag.name.text}` : null;
}

function readRootIdentifier(
  expression: ts.Expression,
): ts.Identifier | null {
  if (ts.isIdentifier(expression)) return expression;
  if (ts.isPropertyAccessExpression(expression)) {
    return readRootIdentifier(expression.expression);
  }
  return null;
}

export function readVisibleValueBindings(
  location: ts.Node,
): ReadonlySet<string> {
  const names = new Set<string>();
  const sourceFile = location.getSourceFile();
  const locationStart = location.getStart(sourceFile);
  let current: ts.Node | undefined = location.parent;

  while (current) {
    if (ts.isSourceFile(current) || ts.isBlock(current)) {
      collectVisibleStatementBindings(
        current.statements,
        sourceFile,
        locationStart,
        names,
      );
    }

    if (ts.isFunctionLike(current)) {
      for (const parameter of current.parameters) {
        collectBindingNames(parameter.name, names);
      }

      if (
        (ts.isFunctionExpression(current) ||
          ts.isClassExpression(current)) &&
        current.name
      ) {
        names.add(current.name.text);
      }
    }

    if (
      ts.isCatchClause(current) &&
      current.variableDeclaration
    ) {
      collectBindingNames(
        current.variableDeclaration.name,
        names,
      );
    }

    if (
      ts.isForStatement(current) &&
      current.initializer &&
      ts.isVariableDeclarationList(current.initializer)
    ) {
      collectDeclarationListBindings(
        current.initializer,
        names,
      );
    }

    if (
      (ts.isForInStatement(current) ||
        ts.isForOfStatement(current)) &&
      ts.isVariableDeclarationList(current.initializer)
    ) {
      collectDeclarationListBindings(
        current.initializer,
        names,
      );
    }

    current = current.parent;
  }

  return names;
}

/**
 * Collects value bindings visible from one lexical statement list.
 *
 * Imports and function declarations are available for the whole module/block.
 * Lexical variables, classes, and enums are included only when their
 * declaration precedes the template. This prevents direct-component lowering
 * from turning a registry lookup into a temporal-dead-zone reference.
 */
function collectVisibleStatementBindings(
  statements: ts.NodeArray<ts.Statement>,
  sourceFile: ts.SourceFile,
  locationStart: number,
  names: Set<string>,
): void {
  for (const statement of statements) {
    if (ts.isImportDeclaration(statement)) {
      collectImportBindings(statement, names);
      continue;
    }

    if (ts.isImportEqualsDeclaration(statement)) {
      if (!statement.isTypeOnly) names.add(statement.name.text);
      continue;
    }

    if (ts.isFunctionDeclaration(statement)) {
      if (statement.name) names.add(statement.name.text);
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.getStart(sourceFile) >= locationStart) continue;
        collectBindingNames(declaration.name, names);
      }
      continue;
    }

    if (
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.getStart(sourceFile) < locationStart &&
      statement.name
    ) {
      names.add(statement.name.text);
    }
  }
}

function collectImportBindings(
  declaration: ts.ImportDeclaration,
  names: Set<string>,
): void {
  const clause = declaration.importClause;
  if (!clause || clause.isTypeOnly) return;

  if (clause.name) names.add(clause.name.text);
  const bindings = clause.namedBindings;
  if (!bindings) return;

  if (ts.isNamespaceImport(bindings)) {
    names.add(bindings.name.text);
    return;
  }

  for (const element of bindings.elements) {
    if (!element.isTypeOnly) names.add(element.name.text);
  }
}

function collectDeclarationListBindings(
  declarations: ts.VariableDeclarationList,
  names: Set<string>,
): void {
  for (const declaration of declarations.declarations) {
    collectBindingNames(declaration.name, names);
  }
}

function collectBindingNames(
  binding: ts.BindingName,
  names: Set<string>,
): void {
  if (ts.isIdentifier(binding)) {
    names.add(binding.text);
    return;
  }

  for (const element of binding.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingNames(element.name, names);
  }
}
