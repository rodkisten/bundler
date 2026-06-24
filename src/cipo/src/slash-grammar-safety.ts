const TOKEN = '__CIPO_NATIVE_SLASH__'

export function protectNativeSlashGrammar(input: string): string {
  return input
    .replace(/(font\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${TOKEN} `)
    .replace(/(grid(?:-[\w-]+)?\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${TOKEN} `)
    .replace(/(aspect-ratio\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${TOKEN} `)
    .replace(/(border-(?:radius|image)\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${TOKEN} `)
    .replace(/((?:background|mask|offset)\s*:[^;{}\n]*)\s\/\s/gi, `$1 ${TOKEN} `)
}

export function restoreNativeSlashGrammar(input: string): string {
  return input.replaceAll(TOKEN, '/')
}
