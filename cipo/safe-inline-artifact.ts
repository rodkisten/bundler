import type { CipoInlineCssArtifact } from '@rodkisten/cipo/types'

export class SafeInlineArtifact implements CipoInlineCssArtifact {
  readonly kind = 'cipo.inline-css' as const

  constructor(
    readonly rawCss: string,
    readonly transformedCss: string,
    readonly cssText: string,
  ) {}

  toString(): string {
    return this.cssText
  }

  [Symbol.toPrimitive](): string {
    return this.cssText
  }

  get [Symbol.toStringTag](): string {
    return 'CipoInlineCssArtifact'
  }
}
