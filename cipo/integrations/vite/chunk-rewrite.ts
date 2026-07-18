import * as ts from 'typescript'
import { applyEdits, createSourceFile, type SourceEdit } from '../../compiler/source/index'

/**
 * Rewrites exact JavaScript string-literal tokens that contain compiler placeholders.
 *
 * @remarks
 * The previous character scanner could enter comments or template-literal text and
 * accidentally rewrite user data. TypeScript AST traversal keeps comments, template
 * payloads and unrelated literals opaque while still surviving bundler formatting.
 */
export function replaceCompiledClassLiterals(
  code: string,
  replacements: ReadonlyMap<string, string>,
  filename = 'chunk.js',
): string {
  if (replacements.size === 0) return code

  const sourceFile = createSourceFile(code, filename)
  const edits: SourceEdit[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node)) {
      const replacement = replacements.get(node.text)
      if (replacement !== undefined && replacement !== node.text) {
        edits.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          value: JSON.stringify(replacement),
        })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return edits.length > 0 ? applyEdits(code, edits) : code
}
