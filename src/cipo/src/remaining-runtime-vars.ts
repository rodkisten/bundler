import { runtime } from './runtime'

export function resolveRemainingRuntimeVars(input: string): string {
  return input.replace(
    /(?<![\w-])\$\$([a-zA-Z_][\w.-]*)(?![\w.-])(?!\s*:)/g,
    (_match, name: string) => {
      const normalized = name
        .replace(/[._]+/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
      return `var(--${runtime.config.prefix}-${normalized})`
    },
  )
}
