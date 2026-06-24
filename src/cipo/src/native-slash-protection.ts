const SLASH = 'var(--cipo-internal-native-slash-7f3c, /)'

export function protectNativeSlashes(input: string): string {
  return input
    .replace(/(font\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
    .replace(/(grid(?:-[\w-]+)?\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
    .replace(/(aspect-ratio\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
    .replace(/(border-(?:radius|image)\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
    .replace(/((?:background|mask|offset)\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
}
