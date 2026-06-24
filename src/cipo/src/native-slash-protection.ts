const SLASH = 'var(--cipo-internal-native-slash-7f3c, /)'

/**
 * Protects structural slash separators in selected native CSS shorthands.
 *
 * @remarks
 * Runtime expression parsing can otherwise mistake these separators for
 * arithmetic. The pass is deliberately restricted to properties with known
 * slash grammar so helper arguments and unrelated declarations are preserved.
 *
 * @param input - CSS source entering runtime design-language expansion.
 * @returns CSS with supported separators replaced by a private marker.
 */
export function protectNativeSlashes(input: string): string {
  return input
    .replace(/(font\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
    .replace(/(grid(?:-[\w-]+)?\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
    .replace(/(aspect-ratio\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
}
