const TOKEN = 'var(--cipo-internal-native-slash-7f3c, /)'

export function restoreNativeSlash(input: string): string {
  return input.split(TOKEN).join('/')
}
