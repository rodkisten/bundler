/**
 * Shared types for Fabrica Elements.
 *
 * @remarks
 * This package owns the boring but important element/component surface shared by
 * Cipó and Fábrica: props, class merging, children, DOM events, refs, adapter
 * props and styled factories. Keeping these types separate prevents the CSS
 * runtime and the HTML runtime from quietly growing duplicate component code.
 *
 * @example DOM styled component shape
 * ```ts
 * const Button = elements.button.css`color:red;`
 * const node = Button({ children: 'Save' })
 * ```
 */

/** General object shape used for props and adapter payloads. */
export type ElementsRecord = Record<string, unknown>

/** Component function accepted by wrapper factories. */
export type ElementsComponent<Props extends ElementsRecord = ElementsRecord> = (props: Props) => unknown

/** Supported built-in adapter names. */
export type ElementsAdapterName = 'dom' | 'react' | 'preact' | 'solid' | 'payload'

/** Supported class prop names. */
export type ElementsClassProp = 'class' | 'className'

/** Primitive-ish value accepted by class merging. */
export type ElementsClassValue = string | number | boolean | null | undefined | ElementsClassValue[] | Record<string, unknown>

/** Values accepted as children by the DOM adapter. */
export type ElementsChild = string | number | boolean | null | undefined | Node | DocumentFragment | readonly ElementsChild[]

/** Style artifact-like value. Used structurally to avoid importing Cipó. */
export interface ElementsStyleArtifact {
  readonly className: string
}

/** Result returned by a style compiler callback. */
export interface ElementsResolvedStyle<Artifact = unknown> {
  readonly className: string
  readonly artifact: Artifact
}

/** Style compiler used by styled factories. */
export type ElementsStyleCompiler<Artifact = unknown> = (
  strings: TemplateStringsArray,
  values: readonly unknown[],
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

/** Options for styled factories. */
export interface StyledFactoryOptions<Artifact = unknown, Output = unknown> extends ElementsFactoryOptions<Output> {
  readonly createStyle: ElementsStyleCompiler<Artifact>
}

/** Builder returned by `elements.div.css`. */
export interface StyledTagFactory<Artifact = unknown, Output = unknown> {
  css(strings: TemplateStringsArray, ...values: readonly unknown[]): ElementsComponent
  attrs(defaultProps: ElementsRecord): StyledTagFactory<Artifact, Output>
}

/** Builder returned by `styled(element).css` or `styled(Component).css`. */
export interface StyledBuilder<Result = unknown> {
  css(strings: TemplateStringsArray, ...values: readonly unknown[]): Result
}

/** Result of styling a real DOM element. */
export interface StyledDomResult<ElementType extends Element = Element, Artifact = unknown> {
  readonly element: ElementType
  readonly artifact: Artifact
  readonly className: string
}

/** Callable styled factory used by Cipó. */
export interface StyledFactory<Artifact = unknown> {
  <ElementType extends Element>(target: ElementType): StyledBuilder<StyledDomResult<ElementType, Artifact>>
  <Props extends ElementsRecord>(target: ElementsComponent<Props>): StyledBuilder<ElementsComponent<Props>>
  (target: string): StyledTagFactory<Artifact>
  [tag: string]: unknown
}
