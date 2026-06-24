import { runtime } from './runtime'

/**
 * Resolves runtime variable references that survived the primary DSL expansion.
 *
 * @remarks
 * Compact blocks and nested function arguments can leave value-side `$$name`
 * references for a final pass. Declaration names are intentionally excluded by
 * the negative lookahead, and references already embedded in identifiers are
 * ignored by the negative lookbehind. This prevents custom-property declarations
 * and `@property` names from being rewritten as `var(...)` expressions.
 *
 * @param input - Transformed CSS that may still contain value-side references.
 * @returns CSS with remaining references mapped to the configured prefix.
 */
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
