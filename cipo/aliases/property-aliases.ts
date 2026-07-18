/**
 * Normalization scales understood by Cipó.
 *
 * @remarks
 * A scale is only a value-normalization hint. It is intentionally not a full
 * representation of the CSS property grammar. Unknown and future CSS properties
 * safely fall back to `none`, preserving native CSS syntax.
 */
export type BuiltInScale =
  | 'spacing'
  | 'color'
  | 'radius'
  | 'shadow'
  | 'text'
  | 'none'
/**
 * Resolved CSS property metadata.
 *
 * Tuple form is intentionally retained because it is compact after minification
 * and cheap to destructure in hot paths.
 */
export type BuiltInPropertyAlias = readonly [
  property: string,
  scale: BuiltInScale,
]
const spacing = 'spacing' as const
const color = 'color' as const
const radius = 'radius' as const
const shadow = 'shadow' as const
const text = 'text' as const
const none = 'none' as const
const PROPERTY_RESOLUTION_CACHE_LIMIT = 512
/**
 * Only actual Cipó aliases live here.
 *
 * Native CSS properties do not need to be registered. They are resolved
 * automatically by `resolveBuiltInPropertyAlias`.
 */
const aliases: Record<string, BuiltInPropertyAlias> = Object.create(null)
/** Bounded cache for dynamically resolved native CSS property names. */
const resolutionCache = new Map<string, BuiltInPropertyAlias>()
/**
 * Registers one or more aliases for a canonical CSS property.
 *
 * Camel-case aliases automatically receive their kebab-case equivalent:
 *
 * `borderX` registers both `borderX` and `border-x`.
 */
function defineAlias(
  property: string,
  scale: BuiltInScale,
  ...names: readonly string[]
): void {
  const entry = Object.freeze([
    property,
    scale,
  ]) as BuiltInPropertyAlias
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]
    if (!name) continue
    aliases[name] = entry
    const kebab = toCssPropertyName(name)
    if (kebab && kebab !== name) aliases[kebab] = entry
  }
}
/** Registers aliases using the scale inferred from the target CSS property. */
function alias(
  property: string,
  ...names: readonly string[]
): void {
  defineAlias(
    property,
    inferBuiltInScale(property),
    ...names,
  )
}
/** Registers aliases with an explicit scale override. */
function scaledAlias(
  property: string,
  scale: BuiltInScale,
  ...names: readonly string[]
): void {
  defineAlias(
    property,
    scale,
    ...names,
  )
}
/**************************************************************************************************
 * Layout / Display
 *************************************************************************************************/
alias('display', 'd')
alias('position', 'pos')
alias('box-sizing', 'box')
alias('isolation', 'isolate')
alias('object-fit', 'object')
alias('object-position', 'objectPos')
/**************************************************************************************************
 * Positioning
 *************************************************************************************************/
alias('inset-inline', 'insetX')
alias('inset-block', 'insetY')
alias('inset-inline-start', 'start', 'insetStart')
alias('inset-inline-end', 'end', 'insetEnd')
alias('inset-block-start', 'insetBlockStart')
alias('inset-block-end', 'insetBlockEnd')
alias('z-index', 'z')
/**************************************************************************************************
 * Padding
 *************************************************************************************************/
alias('padding', 'p')
alias('padding-inline', 'px')
alias('padding-block', 'py')
alias(
  'padding-inline-start',
  'ps',
  'pis',
)
alias(
  'padding-inline-end',
  'pe',
  'pie',
)
alias(
  'padding-block-start',
  'pbs',
)
alias(
  'padding-block-end',
  'pbe',
)
alias('padding-top', 'pt')
alias('padding-right', 'pr')
alias('padding-bottom', 'pb')
alias('padding-left', 'pl')
/**************************************************************************************************
 * Margin
 *************************************************************************************************/
alias('margin', 'm')
alias('margin-inline', 'mx')
alias('margin-block', 'my')
alias(
  'margin-inline-start',
  'ms',
  'mis',
)
alias(
  'margin-inline-end',
  'me',
  'mie',
)
alias(
  'margin-block-start',
  'mbs',
)
alias(
  'margin-block-end',
  'mbe',
)
alias('margin-top', 'mt')
alias('margin-right', 'mr')
alias('margin-bottom', 'mb')
alias('margin-left', 'ml')
/**
 * Bleed is intentionally an authoring alias rather than a CSS property.
 * Positive/negative semantics remain the responsibility of value normalization.
 */
alias('margin', 'bleed')
alias('margin-inline', 'bleedX')
alias('margin-block', 'bleedY')
/**************************************************************************************************
 * Gap
 *************************************************************************************************/
alias('column-gap', 'gapX', 'gapx', 'spaceX')
alias('row-gap', 'gapY', 'gapy', 'spaceY')
/**************************************************************************************************
 * Sizing
 *************************************************************************************************/
alias('width', 'w')
alias('height', 'h')
/**
 * `size` is intentionally Cipó shorthand for logical inline size.
 * The native CSS property fallback remains available through `inlineSize`.
 */
alias('inline-size', 'size')
alias('min-width', 'minW', 'minw')
alias('min-height', 'minH', 'minh')
alias('max-width', 'maxW', 'maxw')
alias('max-height', 'maxH', 'maxh')
alias('min-inline-size', 'minInline')
alias('max-inline-size', 'maxInline')
alias('min-block-size', 'minBlock')
alias('max-block-size', 'maxBlock')
alias('aspect-ratio', 'aspect')
/**************************************************************************************************
 * Flexbox
 *************************************************************************************************/
alias('flex-basis', 'basis')
alias('flex-grow', 'grow')
alias('flex-shrink', 'shrink')
/**
 * Do not alias `direction`.
 *
 * `direction` is a real CSS property. `flexDirection` already canonicalizes to
 * `flex-direction` automatically.
 */
alias('flex-wrap', 'wrap')
alias('place-content', 'place')
alias('align-items', 'items', 'align')
alias('align-self', 'self')
alias('justify-content', 'justify')
/**************************************************************************************************
 * Grid
 *************************************************************************************************/
/**
 * Do not alias `grid`.
 *
 * `grid` is the native CSS shorthand. Use `gridCols` for the convenience alias.
 */
alias(
  'grid-template-columns',
  'gridCols',
)
alias(
  'grid-template-rows',
  'gridRows',
)
alias(
  'grid-auto-columns',
  'autoCols',
)
alias(
  'grid-auto-rows',
  'autoRows',
)
alias(
  'grid-auto-flow',
  'autoFlow',
)
alias('grid-column', 'col', 'column')
alias('grid-row', 'row')
alias(
  'grid-column-start',
  'colStart',
)
alias(
  'grid-column-end',
  'colEnd',
)
alias(
  'grid-row-start',
  'rowStart',
)
alias(
  'grid-row-end',
  'rowEnd',
)
/**************************************************************************************************
 * Multi-column Layout
 *************************************************************************************************/
/**
 * `columns` itself remains the native CSS shorthand.
 *
 * `cols` is the compact Cipó alias.
 */
scaledAlias(
  'columns',
  none,
  'cols',
)
/**************************************************************************************************
 * Typography
 *************************************************************************************************/
/**
 * Do not alias `font`.
 *
 * `font` is the native CSS shorthand. `fontFamily` automatically resolves to
 * `font-family`, while `ff` remains the compact convenience alias.
 */
alias(
  'font-family',
  'ff',
)
scaledAlias(
  'font-size',
  text,
  'text',
  'textSize',
  'fs',
)
alias(
  'font-weight',
  'weight',
)
alias(
  'line-height',
  'lh',
  'leading',
)
alias(
  'letter-spacing',
  'tracking',
)
alias(
  'text-align',
  'alignText',
)
alias(
  'text-decoration-line',
  'decoration',
  'decorationLine',
)
alias(
  'text-decoration-color',
  'decorationColor',
)
alias(
  'text-decoration-style',
  'decorationStyle',
)
alias(
  'text-decoration-thickness',
  'decorationThickness',
)
alias(
  'text-underline-offset',
  'underlineOffset',
)
/**
 * Do not alias `transform`.
 *
 * `transform` is the native transform property. Text transformation is already
 * available through `textTransform`.
 */
alias(
  'text-wrap',
  'wrapText',
)
alias(
  'white-space',
  'whitespace',
)
alias(
  'word-break',
  'break',
)
/**************************************************************************************************
 * Backgrounds / Colors
 *************************************************************************************************/
scaledAlias(
  'background',
  color,
  'bg',
)
scaledAlias(
  'background-color',
  color,
  'bgColor',
)
alias(
  'background-image',
  'bgImage',
)
alias(
  'background-size',
  'bgSize',
)
alias(
  'background-position',
  'bgPosition',
)
alias(
  'background-repeat',
  'bgRepeat',
)
alias(
  'background-clip',
  'bgClip',
)
scaledAlias(
  'color',
  color,
  'textColor',
)
scaledAlias(
  'caret-color',
  color,
  'caret',
)
scaledAlias(
  'accent-color',
  color,
  'accent',
)
/**************************************************************************************************
 * Borders
 *************************************************************************************************/
scaledAlias(
  'border-inline',
  color,
  'borderX',
)
scaledAlias(
  'border-block',
  color,
  'borderY',
)
scaledAlias(
  'border-top',
  color,
  'borderT',
)
scaledAlias(
  'border-right',
  color,
  'borderR',
)
scaledAlias(
  'border-bottom',
  color,
  'borderB',
)
scaledAlias(
  'border-left',
  color,
  'borderL',
)
scaledAlias(
  'border-radius',
  radius,
  'rounded',
  'radius',
)
/**
 * Corner aliases map one-to-one to real CSS properties.
 *
 * The old `roundedT`, `roundedR`, `roundedB` and `roundedL` aliases were
 * intentionally removed because a single property alias cannot correctly
 * represent both corners of one side.
 */
scaledAlias(
  'border-top-left-radius',
  radius,
  'roundedTl',
)
scaledAlias(
  'border-top-right-radius',
  radius,
  'roundedTr',
)
scaledAlias(
  'border-bottom-right-radius',
  radius,
  'roundedBr',
)
scaledAlias(
  'border-bottom-left-radius',
  radius,
  'roundedBl',
)
scaledAlias(
  'border-start-start-radius',
  radius,
  'roundedSs',
)
scaledAlias(
  'border-start-end-radius',
  radius,
  'roundedSe',
)
scaledAlias(
  'border-end-start-radius',
  radius,
  'roundedEs',
)
scaledAlias(
  'border-end-end-radius',
  radius,
  'roundedEe',
)
/**************************************************************************************************
 * Outline / Shadows
 *************************************************************************************************/
scaledAlias(
  'box-shadow',
  shadow,
  'shadow',
  'ring',
)
scaledAlias(
  'text-shadow',
  shadow,
  'textShadow',
)
/**************************************************************************************************
 * Blending
 *************************************************************************************************/
alias(
  'mix-blend-mode',
  'mixBlend',
)
alias(
  'background-blend-mode',
  'bgBlend',
)
/**************************************************************************************************
 * Filters
 *************************************************************************************************/
/**
 * Filter functions such as `blur`, `brightness`, `dropShadow` and
 * `backdropBlur` are deliberately not property aliases.
 *
 * Mapping `blur: 4px` to `filter: 4px` is invalid CSS. Those conveniences belong
 * in the smart declaration layer, where values can become `blur(4px)`.
 */
alias(
  'backdrop-filter',
  'backdrop',
)
/**************************************************************************************************
 * Transforms
 *************************************************************************************************/
/**
 * Native individual transform properties `scale`, `rotate` and `translate`
 * resolve automatically.
 *
 * Axis-specific conveniences such as `scaleX` or `translateY` are not aliases
 * because they require value rewriting and belong in smart declarations.
 */
alias(
  'transform-origin',
  'origin',
)
/**************************************************************************************************
 * Transitions / Animations
 *************************************************************************************************/
/**
 * `transition` and `animation` are already native CSS properties.
 */
alias(
  'transition-duration',
  'duration',
)
alias(
  'transition-delay',
  'delay',
)
alias(
  'transition-timing-function',
  'ease',
  'timing',
)
alias(
  'animation',
  'animate',
)
/**************************************************************************************************
 * Tables
 *************************************************************************************************/
alias(
  'table-layout',
  'table',
)
alias(
  'caption-side',
  'caption',
)
/**************************************************************************************************
 * Lists
 *************************************************************************************************/
/**
 * `listStyle` automatically resolves to the native `list-style` shorthand.
 */
alias(
  'list-style-type',
  'list',
  'listType',
)
alias(
  'list-style-image',
  'listImage',
)
alias(
  'list-style-position',
  'listPosition',
)
/**************************************************************************************************
 * Interaction
 *************************************************************************************************/
alias(
  'user-select',
  'select',
)
alias(
  'pointer-events',
  'pointer',
)
alias(
  'touch-action',
  'touch',
)
alias(
  'scroll-behavior',
  'scroll',
)
alias(
  'scroll-snap-type',
  'snap',
  'scrollSnap',
)
alias(
  'scroll-snap-align',
  'snapAlign',
)
alias(
  'scroll-snap-stop',
  'snapStop',
)
alias(
  'scrollbar-width',
  'scrollbar',
)
/**
 * Compact built-in aliases.
 *
 * Native CSS properties are intentionally absent unless they also have an
 * explicit Cipó shorthand. Consumers should use `resolveBuiltInPropertyAlias`
 * instead of indexing this object as the sole property source.
 */
export const BUILT_IN_PROPERTY_ALIASES:
Readonly<Record<string, BuiltInPropertyAlias>> =
  Object.freeze(aliases)
/**
 * Resolves a Cipó property name into a canonical CSS property and scale.
 *
 * Resolution order:
 *
 * 1. explicit Cipó alias;
 * 2. kebab-case form of an explicit alias;
 * 3. arbitrary native/custom CSS property.
 *
 * This makes the property layer forward-compatible with new CSS specifications
 * without requiring every native property to be manually added to this file.
 */
export function resolveBuiltInPropertyAlias(
  input: string,
): BuiltInPropertyAlias | undefined {
  const name = input.trim()
  if (!name) return undefined
  const direct = BUILT_IN_PROPERTY_ALIASES[name]
  if (direct) return direct
  const property = toCssPropertyName(name)
  if (!property || !isCssPropertyName(property)) return undefined
  const normalizedAlias =
    BUILT_IN_PROPERTY_ALIASES[property]
  if (normalizedAlias) return normalizedAlias
  const cached =
    resolutionCache.get(property)
  if (cached) return cached
  const resolved = Object.freeze([
    property,
    inferBuiltInScale(property),
  ]) as BuiltInPropertyAlias
  resolutionCache.set(
    property,
    resolved,
  )
  if (
    resolutionCache.size
    > PROPERTY_RESOLUTION_CACHE_LIMIT
  ) {
    const oldest =
      resolutionCache
        .keys()
        .next()
        .value as string | undefined
    if (oldest !== undefined) {
      resolutionCache.delete(
        oldest,
      )
    }
  }
  return resolved
}
/** Clears dynamic property resolution state for tests and benchmarks. */
export function clearBuiltInPropertyAliasCache(): void {
  resolutionCache.clear()
}
/**
 * Converts JavaScript-style property names to canonical CSS kebab-case.
 *
 * Custom properties are preserved exactly because custom-property names are
 * case-sensitive.
 *
 * @example
 * ```ts
 * toCssPropertyName('backgroundColor')
 * // 'background-color'
 *
 * toCssPropertyName('WebkitLineClamp')
 * // '-webkit-line-clamp'
 *
 * toCssPropertyName('--MyToken')
 * // '--MyToken'
 * ```
 */
export function toCssPropertyName(
  input: string,
): string {
  const value = input.trim()
  if (!value) return ''
  if (value.startsWith('--')) {
    return value
  }
  let normalized = value
  if (/^Webkit(?=[A-Z])/.test(normalized)) {
    normalized =
      `-webkit-${normalized.slice(6)}`
  } else if (
    /^Moz(?=[A-Z])/.test(normalized)
  ) {
    normalized =
      `-moz-${normalized.slice(3)}`
  } else if (
    /^ms(?=[A-Z])/.test(normalized)
  ) {
    normalized =
      `-ms-${normalized.slice(2)}`
  } else if (
    /^O(?=[A-Z])/.test(normalized)
  ) {
    normalized =
      `-o-${normalized.slice(1)}`
  }
  return normalized
    .replace(
      /([a-z0-9])([A-Z])/g,
      '$1-$2',
    )
    .replace(
      /_/g,
      '-',
    )
    .toLowerCase()
}
/**
 * Infers the Cipó normalization scale for a native CSS property.
 *
 * The inference is deliberately conservative. A wrong scale can alter valid
 * CSS grammar, while `none` simply leaves the native value untouched.
 */
export function inferBuiltInScale(
  property: string,
): BuiltInScale {
  if (
    !property
    || property.startsWith('--')
  ) {
    return none
  }
  if (property === 'font-size') {
    return text
  }
  if (
    property === 'box-shadow'
    || property === 'text-shadow'
  ) {
    return shadow
  }
  if (
    property === 'border-radius'
    || property.endsWith('-radius')
  ) {
    return radius
  }
  if (isColorProperty(property)) {
    return color
  }
  if (isSpacingProperty(property)) {
    return spacing
  }
  return none
}
/** Detects properties where a bare Cipó color token is meaningful. */
function isColorProperty(
  property: string,
): boolean {
  if (
    property === 'color'
    || property === 'fill'
    || property === 'stroke'
    || property === 'background'
    || property === 'outline'
    || property === 'column-rule'
    || property === 'scrollbar-color'
    || property.endsWith('-color')
  ) {
    return true
  }
  return /^border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?$/.test(
    property,
  )
}
/**
 * Detects length-like properties that can safely consume Cipó spacing tokens.
 *
 * Mixed-grammar properties intentionally stay on the `none` scale.
 */
function isSpacingProperty(
  property: string,
): boolean {
  if (
    /^(?:margin|padding)(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?$/.test(
      property,
    )
  ) {
    return true
  }
  if (
    /^scroll-(?:margin|padding)(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?$/.test(
      property,
    )
  ) {
    return true
  }
  if (
    /^inset(?:-(?:block|inline)(?:-start|-end)?)?$/.test(
      property,
    )
  ) {
    return true
  }
  if (
    /^(?:(?:min|max)-)?(?:width|height|inline-size|block-size)$/.test(
      property,
    )
  ) {
    return true
  }
  if (
    /^border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?-width$/.test(
      property,
    )
  ) {
    return true
  }
  switch (property) {
    case 'top':
    case 'right':
    case 'bottom':
    case 'left':
    case 'gap':
    case 'row-gap':
    case 'column-gap':
    case 'flex-basis':
    case 'border-spacing':
    case 'outline-width':
    case 'outline-offset':
    case 'text-decoration-thickness':
    case 'text-underline-offset':
    case 'text-indent':
    case 'translate':
    case 'perspective':
    case 'shape-margin':
    case 'offset-distance':
    case 'stroke-width':
    case 'stroke-dashoffset':
    case 'column-width':
    case 'contain-intrinsic-size':
    case 'contain-intrinsic-width':
    case 'contain-intrinsic-height':
    case 'contain-intrinsic-inline-size':
    case 'contain-intrinsic-block-size':
      return true
    default:
      return false
  }
}
/**
 * Performs lightweight validation for canonical CSS property names.
 *
 * Custom properties are intentionally permissive because their identifier space
 * is author-defined.
 */
function isCssPropertyName(
  property: string,
): boolean {
  if (
    property.startsWith('--')
  ) {
    return property.length > 2
  }
  return /^-?[a-z][a-z0-9-]*$/.test(
    property,
  )
}
