export function normalizeCompactRuntimeBlocks(input: string): string {
  return input
    .replace(/\{[ \t]+(?=[#$a-zA-Z_-])/g, '{\n')
    .replace(/;[ \t]*\}/g, ';\n}')
}
