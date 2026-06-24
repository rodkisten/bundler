const SLASH = 'var(--cipo-internal-native-slash-7f3c, /)'

export function protectNativeSlash(input: string): string {
  return input.replace(/(font\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${SLASH} `)
}
