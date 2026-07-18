import type { AliasScale } from '../types'

export type ValueNormalizer = (property: string, rawValue: string, scale?: AliasScale) => string
export type TextExpander = (args: string) => string
