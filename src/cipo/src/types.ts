/**
 * Shared public and internal types used by every Cipó module.
 *
 * @remarks
 * This file is intentionally dependency-free so the runtime can be bundled as a
 * tiny browser-first package or copied into a userscript without dragging a graph
 * of side effects behind it.
 *
 * @example
 * ```ts
 * import type { CipoConfig, CipoCssArtifact } from './types'
 *
 * const config: CipoConfig = { prefix: 'rod' }
 * const className = String({ className: 'rod-a-x' } as CipoCssArtifact)
 * ```
 */
export type CipoPrimitive = string | number | boolean | null | undefined

export type CipoAdapterName = 'dom' | 'solid' | 'react' | 'preact'
export type CipoColorMode = 'oklch' | 'oklab' | 'hsl' | 'rgba' | 'preserve'
export type CipoLayerName = 'reset' | 'tokens' | 'base' | 'atomic' | 'scoped' | 'global' | 'inline' | 'components' | 'utilities' | 'overrides'
export type AliasScale = 'spacing' | 'radius' | 'shadow' | 'text' | 'color' | 'none'
export type CipoThemeValue = string | number | CipoTheme
export interface CipoTheme { readonly [key: string]: CipoThemeValue }
export type CipoRecord = Record<string, unknown>

export interface CipoRemConfig {
  readonly enabled?: boolean
  readonly baseFontSize?: number
}

export interface CipoJitConfig {
  readonly enabled?: boolean
  readonly cache?: boolean
  readonly maxEntries?: number
  readonly debug?: boolean
}

export interface CipoOutputConfig {
  readonly minify?: boolean
  readonly layers?: boolean
  readonly pretty?: boolean
}

export interface CipoConfig {
  readonly prefix?: string
  readonly debug?: boolean
  readonly important?: boolean
  readonly adapter?: CipoAdapterName | CipoAdapter
  readonly darkSelector?: string
  readonly themeRootSelector?: string
  readonly breakpoints?: Readonly<Record<string, string | null>>
  readonly minify?: boolean
  readonly layers?: boolean
  readonly output?: CipoOutputConfig
  readonly rem?: boolean | CipoRemConfig
  readonly baseFontSize?: number
  readonly colorMode?: CipoColorMode
  readonly theme?: CipoTheme
  readonly jit?: boolean | CipoJitConfig
  readonly onWarning?: ((warning: CipoWarning) => void) | undefined
}

export interface CipoWarning {
  readonly code: string
  readonly message: string
  readonly context?: unknown
}

export interface CipoStyleObject {
  readonly [property: string]: string | number | CipoStyleObject | null | undefined
}

export type CipoCssInterpolation = CipoPrimitive | CipoCssArtifact | CipoInlineCssArtifact | CipoStyleObject

export interface CipoDeclarationNode {
  readonly type: 'declaration'
  readonly property: string
  readonly value: string
  readonly source: string
}

export interface CipoBlockNode {
  readonly type: 'block'
  readonly name: string
  readonly body: readonly CipoAstNode[]
  readonly source: string
}

export interface CipoDirectiveNode {
  readonly type: 'directive'
  readonly name: string
  readonly args: readonly string[]
  readonly source: string
}

export type CipoAstNode = CipoDeclarationNode | CipoBlockNode | CipoDirectiveNode

export interface CipoRuleContext {
  readonly breakpoint?: string
  readonly mediaQuery?: string
  readonly notBreakpoint?: string
  readonly pseudo?: string
  readonly selector?: string
  readonly dark?: boolean
  readonly supports?: string
  readonly container?: string
  readonly layer?: CipoLayerName
}

export interface CipoAtomicRule {
  readonly id: string
  readonly className: string
  readonly property: string
  readonly value: string
  readonly context: CipoRuleContext
  readonly source: string
}

export interface CipoScopedRule {
  readonly selector: string
  readonly declarations: readonly CipoDeclarationNode[]
  readonly context: CipoRuleContext
}

export interface CipoDebugArtifact {
  readonly id: string
  readonly ast: readonly CipoAstNode[]
  readonly atoms: readonly CipoAtomicRule[]
  readonly scopedRules: readonly CipoScopedRule[]
  readonly warnings: readonly CipoWarning[]
}

export interface CipoCssArtifact {
  readonly kind: 'cipo.css'
  readonly className: string
  readonly scopeClassName: string
  readonly atoms: readonly CipoAtomicRule[]
  readonly scopedRules: readonly CipoScopedRule[]
  readonly rawCss: string
  readonly transformedCss: string
  readonly compiledCss: string
  readonly debug: CipoDebugArtifact
  toString(): string
  [Symbol.toPrimitive](): string
  readonly [Symbol.toStringTag]: string
}

export interface CipoInlineCssArtifact {
  readonly kind: 'cipo.inline-css'
  readonly rawCss: string
  readonly transformedCss: string
  readonly cssText: string
  toString(): string
  [Symbol.toPrimitive](): string
  readonly [Symbol.toStringTag]: string
}

export interface CipoExplainResult {
  readonly found: boolean
  readonly className: string
  readonly atom?: CipoAtomicRule
  readonly css?: string
}

export interface CipoAdapter {
  readonly name?: string
  readonly classProp: 'class' | 'className'
  mergeProps(props: CipoRecord | null | undefined, className: string): CipoRecord
  createElement?(tag: string, props: CipoRecord | null | undefined, className: string): unknown
  wrapComponent?(component: unknown, className: string): CipoComponent
}

export type CipoComponent<Props extends CipoRecord = CipoRecord> = (props: Props) => unknown

export type CipoTarget = Element | string | CipoComponent | ((...args: never[]) => unknown)

export interface CipoStyledBuilder<Result = unknown> {
  css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): Result
}

export interface CipoStyledTagFactory {
  css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoComponent
  attrs(defaultProps: CipoRecord): CipoStyledTagFactory
}

export interface CipoDomStyledResult<ElementType extends Element = Element> {
  readonly element: ElementType
  readonly artifact: CipoCssArtifact
  readonly className: string
}

export type CipoHelper = (args: string, context: CipoHelperContext) => string
export type CipoAliasValue = string | CipoStyleObject | (() => string | CipoStyleObject)

export interface CipoHelperContext {
  readonly name: string
  readonly raw: string
  readonly config: RuntimeConfig
  resolveValue(value: string, property?: string): string
}

export interface PropertyAliasDefinition {
  readonly property: string
  readonly scale?: AliasScale
}

export interface CipoRecipeDefinition {
  readonly base?: string | CipoStyleObject
  readonly variants?: Record<string, Record<string, string | CipoStyleObject>>
  readonly defaults?: Record<string, string>
}

export interface CipoRecipe {
  (options?: Record<string, string | boolean | null | undefined>): CipoCssArtifact
  readonly definition: CipoRecipeDefinition
}

export interface CipoInjectStyleOptions {
  readonly nonce?: string
  readonly dedupe?: boolean
  readonly position?: 'append' | 'prepend'
}

export interface RuntimeConfig {
  prefix: string
  debug: boolean
  important: boolean
  adapter: CipoAdapterName | CipoAdapter
  darkSelector: string
  themeRootSelector: string
  breakpoints: Readonly<Record<string, string | null>>
  minify: boolean
  layers: boolean
  rem: Required<CipoRemConfig>
  colorMode: CipoColorMode
  jit: Required<CipoJitConfig>
  onWarning?: ((warning: CipoWarning) => void) | undefined
}

export interface RuntimeState {
  config: RuntimeConfig
  sheet: CSSStyleSheet | null
  insertedCss: Set<string>
  atomicCache: Map<string, CipoAtomicRule>
  artifactCache: Map<string, CipoCssArtifact>
  inlineCache: Map<string, CipoInlineCssArtifact>
  debugAtoms: Map<string, CipoAtomicRule>
  themeKeys: Set<string>
  shortThemeTokens: Map<string, string>
  ambiguousThemeTokens: Map<string, readonly string[]>
  helperRegistry: Map<string, CipoHelper>
  aliasRegistry: Map<string, CipoAliasValue>
  propertyAliasRegistry: Map<string, PropertyAliasDefinition>
  variantRegistry: Map<string, readonly string[]>
  warningSink: CipoWarning[]
  layerHeaderInserted: boolean
  themeVersion: number
  configVersion: number
}
