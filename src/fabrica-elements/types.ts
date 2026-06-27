import type { HtmlTagName } from './html-tags'

/**
 * Shared types for Fabrica Elements.
 *
 * @remarks
 * This package owns the element/component surface shared by Cipó and Fábrica:
 * props, class merging, children, DOM events, refs, adapters, styled factories
 * and the optional named-component registry bridge. Keeping these contracts in
 * one dependency-neutral module prevents the CSS compiler and renderer from
 * growing subtly incompatible component APIs.
 */

/** General object shape used for props and adapter payloads. */
export type ElementsRecord = Record<string, unknown>

/** Component function accepted by wrapper factories. */
export type ElementsComponent<Props extends ElementsRecord = ElementsRecord> = (props?: Props) => unknown

/** Supported built-in adapter names. */
export type ElementsAdapterName = 'dom' | 'react' | 'preact' | 'solid' | 'payload'

/** Supported class prop names. */
export type ElementsClassProp = 'class' | 'className'

/** Primitive-ish value accepted by class merging. */
export type ElementsClassValue = string | number | boolean | null | undefined | ElementsClassValue[] | Record<string, unknown>

/** Values accepted as children by the DOM adapter. */
export type ElementsChild = string | number | boolean | null | undefined | Node | DocumentFragment | readonly ElementsChild[]

/** Optional named children bag used by component-level slot helpers. */
export type ElementsSlots = Record<string, unknown>

/** Mutable object ref shared by DOM factories and components. */
export type ElementsRef<Value = Element> = { current: Value | null }

/** Callback ref that can optionally return cleanup. */
export type ElementsRefCallback<Value = Element> = (value: Value | null) => void | (() => void)

/** Any supported ref shape. */
export type ElementsRefValue<Value = Element> = ElementsRef<Value> | ElementsRefCallback<Value> | null | undefined

/** Style artifact-like value. Used structurally to avoid importing Cipó. */
export interface ElementsStyleArtifact {
  readonly className: string
}

/** Result returned by a style compiler or artifact resolver callback. */
export interface ElementsResolvedStyle<Artifact = unknown> {
  readonly className: string
  readonly artifact?: Artifact
  readonly style?: unknown
}

/**
 * Polymorphic style definition accepted by styled builders.
 *
 * @remarks
 * Fabrica Elements deliberately treats artifacts structurally. Cipó supplies the
 * resolver that understands atomic, inline and stylesheet artifacts, while other
 * compilers can provide their own resolver without adding a hard dependency.
 */
export type ElementsStyleInput<
  Props extends ElementsRecord = ElementsRecord,
  Artifact = unknown,
> =
  | Artifact
  | ElementsResolvedStyle<Artifact>
  | string
  | false
  | null
  | undefined
  | readonly ElementsStyleInput<Props, Artifact>[]
  | ((props: Props) => ElementsStyleInput<Props, Artifact>)

/** Style compiler used by tagged-template styled factories. */
export type ElementsStyleCompiler<Artifact = unknown> = (
  strings: TemplateStringsArray,
  values: readonly unknown[],
) => ElementsResolvedStyle<Artifact>

/** Resolves a non-template artifact or string into styled output metadata. */
export type ElementsStyleResolver<Artifact = unknown> = (
  input: unknown,
  props: ElementsRecord,
) => ElementsResolvedStyle<Artifact>

/** Adapter implementation used by element/styled factories. */
export interface ElementsAdapter<Output = unknown> {
  readonly name?: string
  readonly classProp: ElementsClassProp
  mergeProps(props: ElementsRecord | null | undefined, className: string): ElementsRecord
  createElement?(tag: string, props: ElementsRecord | null | undefined, className: string): Output
  wrapComponent?(component: unknown, className: string): ElementsComponent
}

/** Options shared by factories. */
export interface ElementsFactoryOptions<Output = unknown> {
  readonly adapter?: ElementsAdapterName | ElementsAdapter<Output> | (() => ElementsAdapterName | ElementsAdapter<Output>)
}

/** Options used by the low-level tag element factory. */
export interface ElementFactoryOptions<Output = unknown> extends ElementsFactoryOptions<Output> {
  readonly createElement?: (tag: string, props: ElementsRecord) => Output
}

/** Builder returned by `elements.div` and `elements('div')`. */
export interface ElementTagFactory<Output = unknown> {
  (props?: ElementsRecord): Output
  attrs(defaultProps: ElementsRecord): ElementTagFactory<Output>
}

/** Callable element factory: `elements.div(...)`, `elements('button')`. */
export interface ElementsFactory<Output = unknown> {
  (tag: string): ElementTagFactory<Output>
  [tag: string]: unknown
}

/** Structural Fabrica-compatible registry contract. */
export interface ElementsComponentRegistry {
  /** Preferred instance-local registry surface. */
  registry?: ElementsComponentRegistry
  register?(name: string, component: ElementsComponent, options?: { collision?: string }): unknown
  unregister?(name: string): boolean
  resolve?(name: string): unknown
  /** @deprecated Compatibility bridge for older Fabrica globals. */
  registerComponent?(name: string, component: ElementsComponent): unknown
  /** @deprecated Compatibility bridge for older Fabrica globals. */
  unregisterComponent?(name: string): boolean
  /** @deprecated Compatibility bridge for older Fabrica globals. */
  resolveComponent?(name: string): unknown
}

/** Collision policy for named styled components. */
export type StyledRegistryCollision = 'warn' | 'replace' | 'error' | 'ignore'

/** Registry configuration shared by a styled factory. */
export interface StyledRegistryOptions {
  readonly autoRegister?: boolean
  readonly collision?: StyledRegistryCollision
  readonly registry?: ElementsComponentRegistry | (() => ElementsComponentRegistry | undefined)
  readonly onWarning?: (message: string) => void
}

/** Runtime status returned by registry operations. */
export type StyledRegistrationStatus = 'registered' | 'queued' | 'replaced' | 'existing' | 'ignored' | 'disabled'

/** Static or prop-derived defaults applied before caller props. */
export type StyledAttrs<Props extends ElementsRecord = ElementsRecord> = Props | ((props: Props) => ElementsRecord)

/** Named component creation options. */
export interface StyledComponentOptions<Props extends ElementsRecord = ElementsRecord> {
  readonly attrs?: StyledAttrs<Props>
  readonly collision?: StyledRegistryCollision
}

/** Options for styled factories. */
export interface StyledFactoryOptions<Artifact = unknown, Output = unknown> extends ElementsFactoryOptions<Output>, StyledRegistryOptions {
  readonly createStyle: ElementsStyleCompiler<Artifact>
  readonly resolveStyle?: ElementsStyleResolver<Artifact>
}

/** Metadata exposed on generated styled components. */
export interface StyledComponentMetadata<Artifact = unknown> {
  readonly displayName?: string
  /** Static class list known when the component is created. */
  readonly className: string
  /** First static artifact, or all static artifacts when composed. */
  readonly artifact: Artifact | readonly Artifact[] | undefined
  /** Every static artifact resolved before render. */
  readonly artifacts: readonly Artifact[]
  /** Whether one or more prop-driven style functions run during render. */
  readonly dynamicStyles: boolean
  readonly target: unknown
  readonly tag?: string
  readonly registeredName?: string
}

/** Styled component with class/artifact/registry metadata. */
export type StyledComponent<Props extends ElementsRecord = ElementsRecord, Artifact = unknown> = ElementsComponent<Props> & StyledComponentMetadata<Artifact> & {
  register(name?: string, collision?: StyledRegistryCollision): StyledRegistrationStatus
  unregister(): boolean
  withComponent<TargetProps extends ElementsRecord = Props>(target: string | ElementsComponent<TargetProps>): StyledComponent<TargetProps, Artifact>
  toString(): string
}

/** Named builder supports templates, artifacts, arrays and prop-driven styles. */
export interface NamedStyledBuilder<
  Props extends ElementsRecord = ElementsRecord,
  Artifact = unknown,
  Result = unknown,
> {
  (strings: TemplateStringsArray, ...values: readonly unknown[]): Result
  (input: ElementsStyleInput<Props, Artifact>): Result
  css(strings: TemplateStringsArray, ...values: readonly unknown[]): Result
}

/** Builder returned by `styled(element)` or `styled(Component)`. */
export interface StyledBuilder<
  Props extends ElementsRecord = ElementsRecord,
  Artifact = unknown,
  Result = unknown,
> {
  (strings: TemplateStringsArray, ...values: readonly unknown[]): Result
  (input: ElementsStyleInput<Props, Artifact>): Result
  css(strings: TemplateStringsArray, ...values: readonly unknown[]): Result
  named(name: string, options?: StyledComponentOptions<Props>): NamedStyledBuilder<Props, Artifact, Result>
}

/** Callable styled tag factory with backwards-compatible `.css` and `.attrs`. */
export interface StyledTagFactory<Artifact = unknown, Output = unknown> {
  (strings: TemplateStringsArray, ...values: readonly unknown[]): StyledComponent<ElementsRecord, Artifact>
  (input: Exclude<ElementsStyleInput<ElementsRecord, Artifact>, string>): StyledComponent<ElementsRecord, Artifact>
  (name: string, options?: StyledComponentOptions): NamedStyledBuilder<ElementsRecord, Artifact, StyledComponent<ElementsRecord, Artifact>>
  css(strings: TemplateStringsArray, ...values: readonly unknown[]): StyledComponent<ElementsRecord, Artifact>
  named(name: string, options?: StyledComponentOptions): NamedStyledBuilder<ElementsRecord, Artifact, StyledComponent<ElementsRecord, Artifact>>
  attrs(defaultProps: StyledAttrs): StyledTagFactory<Artifact, Output>
}

/** Result of styling a real DOM element. */
export interface StyledDomResult<ElementType extends Element = Element, Artifact = unknown> {
  readonly element: ElementType
  readonly artifact: Artifact | readonly Artifact[] | undefined
  readonly artifacts: readonly Artifact[]
  readonly className: string
}

/** Convenience options for `styled.component(name, options)`. */
export interface StyledNamedComponentOptions extends StyledComponentOptions {
  readonly as?: string | ElementsComponent
}

/** Base callable styled factory contract. */
export interface StyledFactoryBase<Artifact = unknown> {
  <ElementType extends Element>(target: ElementType): StyledBuilder<ElementsRecord, Artifact, StyledDomResult<ElementType, Artifact>>
  <Props extends ElementsRecord>(target: ElementsComponent<Props>, name?: string): StyledBuilder<Props, Artifact, StyledComponent<Props, Artifact>>
  (target: string): StyledTagFactory<Artifact>
  component(name: string, options?: StyledNamedComponentOptions): NamedStyledBuilder<ElementsRecord, Artifact, StyledComponent<ElementsRecord, Artifact>>
  connectRegistry(registry: ElementsComponentRegistry): number
  disconnectRegistry(registry?: ElementsComponentRegistry): void
  configureRegistry(options: StyledRegistryOptions): void
  flushRegistry(): number
  pendingComponents(): readonly string[]
}

/** Callable styled factory with strongly typed native HTML tag properties. */
export type StyledFactory<Artifact = unknown> = StyledFactoryBase<Artifact> & {
  readonly [Tag in HtmlTagName]: StyledTagFactory<Artifact>
}
