/** Removes pretty-print spacing that should not affect CSS assertions. */
export function normalizeDeclarationSpacing(value: string): string {
  return value.replace(/:\s+/g, ':')
}
