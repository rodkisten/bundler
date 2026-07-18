import * as ts from 'typescript'

/** Parses JS/TS with the script kind inferred from the source filename. */
export function createSourceFile(source: string, filename = 'source.tsx'): ts.SourceFile {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    inferScriptKind(filename),
  )
}

/** Creates a no-resolution TypeScript Program so lexical symbols can be resolved safely. */
export function createSingleFileProgram(
  source: string,
  filename: string,
): { readonly sourceFile: ts.SourceFile; readonly checker: ts.TypeChecker } {
  const normalizedFilename = filename || 'source.tsx'
  const sourceFile = createSourceFile(source, normalizedFilename)
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.Preserve,
  }
  const host: ts.CompilerHost = {
    getSourceFile(fileName) { return fileName === normalizedFilename ? sourceFile : undefined },
    getDefaultLibFileName() { return '' },
    writeFile() {},
    getCurrentDirectory() { return '' },
    getDirectories() { return [] },
    fileExists(fileName) { return fileName === normalizedFilename },
    readFile(fileName) { return fileName === normalizedFilename ? source : undefined },
    getCanonicalFileName(fileName) { return fileName },
    useCaseSensitiveFileNames() { return true },
    getNewLine() { return '\n' },
  }
  const program = ts.createProgram([normalizedFilename], options, host)
  return { sourceFile: program.getSourceFile(normalizedFilename) ?? sourceFile, checker: program.getTypeChecker() }
}

/** Visits an AST depth-first without allocating an intermediate node list. */
export function visitSourceTree(node: ts.Node, visitor: (node: ts.Node) => void): void {
  visitor(node)
  ts.forEachChild(node, (child) => visitSourceTree(child, visitor))
}

/** Removes transparent TypeScript expression wrappers before identity checks. */
export function unwrapExpression<T extends ts.Expression>(expression: T): ts.Expression {
  let current: ts.Expression = expression
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isSatisfiesExpression(current)
  ) {
    current = current.expression
  }
  return current
}

/** Converts an absolute source offset into a stable 1-based diagnostic location. */
export function sourceLocationFromOffset(
  source: string,
  filename: string | undefined,
  start: number,
  end?: number,
): { readonly filename?: string; readonly start: number; readonly end?: number; readonly line: number; readonly column: number } {
  const safeStart = Math.max(0, Math.min(source.length, start))
  let line = 1
  let column = 1
  for (let index = 0; index < safeStart; index += 1) {
    if (source[index] === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }
  return {
    ...(filename ? { filename } : {}),
    start: safeStart,
    ...(end === undefined ? {} : { end }),
    line,
    column,
  }
}

function inferScriptKind(filename: string): ts.ScriptKind {
  const clean = filename.split('?')[0]!.toLowerCase()
  if (clean.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (clean.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (clean.endsWith('.js') || clean.endsWith('.mjs') || clean.endsWith('.cjs')) return ts.ScriptKind.JS
  if (clean.endsWith('.json')) return ts.ScriptKind.JSON
  return ts.ScriptKind.TS
}
