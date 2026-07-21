import * as ts from "typescript";

export function createSourceFile(
  source: string,
  filename: string,
): ts.SourceFile {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    readScriptKind(filename),
  );
}

export function createSingleFileChecker(
  sourceFile: ts.SourceFile,
  filename: string,
): ts.TypeChecker {
  const options: ts.CompilerOptions = {
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noLib: true,
    noResolve: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  };
  const host: ts.CompilerHost = {
    fileExists: (name) => name === filename,
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => "",
    getDefaultLibFileName: () => "lib.d.ts",
    getNewLine: () => "\n",
    getSourceFile: (name) => (name === filename ? sourceFile : undefined),
    readFile: (name) => (name === filename ? sourceFile.text : undefined),
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  };
  return ts.createProgram([filename], options, host).getTypeChecker();
}

function readScriptKind(filename: string): ts.ScriptKind {
  if (/\.tsx$/i.test(filename)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(filename)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/i.test(filename)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
