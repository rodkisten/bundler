import { registerAlias, registerProperty } from './plugins'
import { runtime } from './runtime'

type BuiltInScale = 'spacing' | 'color' | 'radius' | 'shadow' | 'text' | 'none'

type BuiltInPropertyAlias = readonly [property: string, scale: BuiltInScale]

/**
 * Installs Cipó's built-in property aliases and utility identifiers.
 *
 * @remarks
 * This keeps Cipó close to CSS authoring while borrowing the broad utility
 * coverage idea from Tailwind, Panda CSS utilities, and UnoCSS shortcuts.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * installBuiltInAliases()
 *
 * css`
 *   px: 4;
 *   bg: $brand;
 *   rounded: $xl;
 *   center;
 *   glass;
 * `
 * ```
 *
 * @example Output shape
 * ```css
 * .cipo-a-padding-inline {
 *   padding-inline: calc(var(--cipo-spacing) * 4);
 * }
 *
 * .cipo-a-background {
 *   background: var(--cipo-colors-brand);
 * }
 * ```
 */
export function installBuiltInAliases(): void {
  installPropertyAliases()
  installUtilityAliases()
}

/**
 * Registers property aliases inspired by Tailwind/Panda/UnoCSS coverage.
 *
 * @remarks
 * These aliases do not create Tailwind-like class names. They map Cipó DSL
 * properties to real CSS properties:
 *
 * ```css
 * px: 4;
 * bg: $brand;
 * rounded: $xl;
 * ```
 *
 * This is closer to Panda's configurable utility model and keeps the language
 * readable inside CSS template strings.
 *
 * @returns Nothing.
 *
 * @example Spacing
 * ```ts
 * css`
 *   p: 4;
 *   px: 6;
 *   mt: 2;
 *   gap: 3;
 * `
 * ```
 *
 * @example Layout and flex
 * ```ts
 * css`
 *   d: flex;
 *   direction: column;
 *   items: center;
 *   justify: between;
 *   grow: 1;
 * `
 * ```
 *
 * @example Effects
 * ```ts
 * css`
 *   blur: 12px;
 *   backdrop-blur: 20px;
 *   shadow: $glow;
 * `
 * ```
 */
export function installPropertyAliases(): void {
  const spacing = 'spacing' as const
  const color = 'color' as const
  const radius = 'radius' as const
  const shadow = 'shadow' as const
  const text = 'text' as const
  const none = 'none' as const

  const aliases: Record<string, BuiltInPropertyAlias> = {
    /************************************************************************************************
     * Layout / Display
     ***********************************************************************************************/

    d: ['display', none],
    display: ['display', none],
    pos: ['position', none],
    position: ['position', none],
    box: ['box-sizing', none],
    float: ['float', none],
    clear: ['clear', none],
    isolate: ['isolation', none],
    isolation: ['isolation', none],
    object: ['object-fit', none],
    objectFit: ['object-fit', none],
    'object-fit': ['object-fit', none],
    objectPosition: ['object-position', none],
    'object-position': ['object-position', none],
    overflow: ['overflow', none],
    overflowX: ['overflow-x', none],
    'overflow-x': ['overflow-x', none],
    overflowY: ['overflow-y', none],
    'overflow-y': ['overflow-y', none],
    overscroll: ['overscroll-behavior', none],
    overscrollX: ['overscroll-behavior-x', none],
    'overscroll-x': ['overscroll-behavior-x', none],
    overscrollY: ['overscroll-behavior-y', none],
    'overscroll-y': ['overscroll-behavior-y', none],

    /************************************************************************************************
     * Positioning
     ***********************************************************************************************/

    inset: ['inset', spacing],
    insetX: ['inset-inline', spacing],
    'inset-x': ['inset-inline', spacing],
    insetY: ['inset-block', spacing],
    'inset-y': ['inset-block', spacing],
    start: ['inset-inline-start', spacing],
    end: ['inset-inline-end', spacing],
    top: ['top', spacing],
    right: ['right', spacing],
    bottom: ['bottom', spacing],
    left: ['left', spacing],
    z: ['z-index', none],
    zIndex: ['z-index', none],
    'z-index': ['z-index', none],

    /************************************************************************************************
     * Spacing
     ***********************************************************************************************/

    p: ['padding', spacing],
    px: ['padding-inline', spacing],
    py: ['padding-block', spacing],
    ps: ['padding-inline-start', spacing],
    pis: ['padding-inline-start', spacing],
    paddingInlineStart: ['padding-inline-start', spacing],
    pe: ['padding-inline-end', spacing],
    pie: ['padding-inline-end', spacing],
    paddingInlineEnd: ['padding-inline-end', spacing],
    pt: ['padding-top', spacing],
    pr: ['padding-right', spacing],
    pb: ['padding-bottom', spacing],
    pl: ['padding-left', spacing],

    m: ['margin', spacing],
    mx: ['margin-inline', spacing],
    my: ['margin-block', spacing],
    ms: ['margin-inline-start', spacing],
    mis: ['margin-inline-start', spacing],
    marginInlineStart: ['margin-inline-start', spacing],
    me: ['margin-inline-end', spacing],
    mie: ['margin-inline-end', spacing],
    marginInlineEnd: ['margin-inline-end', spacing],
    mt: ['margin-top', spacing],
    mr: ['margin-right', spacing],
    mb: ['margin-bottom', spacing],
    ml: ['margin-left', spacing],
    bleed: ['margin', spacing],
    bleedX: ['margin-inline', spacing],
    'bleed-x': ['margin-inline', spacing],
    bleedY: ['margin-block', spacing],
    'bleed-y': ['margin-block', spacing],

    spaceX: ['column-gap', spacing],
    'space-x': ['column-gap', spacing],
    spaceY: ['row-gap', spacing],
    'space-y': ['row-gap', spacing],

    /************************************************************************************************
     * Sizing
     ***********************************************************************************************/

    w: ['width', spacing],
    width: ['width', spacing],
    h: ['height', spacing],
    height: ['height', spacing],
    size: ['inline-size', spacing],
    inlineSize: ['inline-size', spacing],
    'inline-size': ['inline-size', spacing],
    blockSize: ['block-size', spacing],
    'block-size': ['block-size', spacing],

    minw: ['min-width', spacing],
    minW: ['min-width', spacing],
    minWidth: ['min-width', spacing],
    'min-w': ['min-width', spacing],
    minh: ['min-height', spacing],
    minH: ['min-height', spacing],
    minHeight: ['min-height', spacing],
    'min-h': ['min-height', spacing],

    maxw: ['max-width', spacing],
    maxW: ['max-width', spacing],
    maxWidth: ['max-width', spacing],
    'max-w': ['max-width', spacing],
    maxh: ['max-height', spacing],
    maxH: ['max-height', spacing],
    maxHeight: ['max-height', spacing],
    'max-h': ['max-height', spacing],

    aspect: ['aspect-ratio', none],
    aspectRatio: ['aspect-ratio', none],
    'aspect-ratio': ['aspect-ratio', none],

    /************************************************************************************************
     * Flexbox
     ***********************************************************************************************/

    flex: ['flex', none],
    basis: ['flex-basis', spacing],
    grow: ['flex-grow', none],
    shrink: ['flex-shrink', none],
    order: ['order', none],
    direction: ['flex-direction', none],
    flexDirection: ['flex-direction', none],
    'flex-direction': ['flex-direction', none],
    wrap: ['flex-wrap', none],
    flexWrap: ['flex-wrap', none],
    'flex-wrap': ['flex-wrap', none],
    place: ['place-content', none],
    placeContent: ['place-content', none],
    'place-content': ['place-content', none],
    placeItems: ['place-items', none],
    'place-items': ['place-items', none],
    placeSelf: ['place-self', none],
    'place-self': ['place-self', none],
    items: ['align-items', none],
    align: ['align-items', none],
    alignItems: ['align-items', none],
    'align-items': ['align-items', none],
    self: ['align-self', none],
    alignSelf: ['align-self', none],
    'align-self': ['align-self', none],
    content: ['align-content', none],
    alignContent: ['align-content', none],
    'align-content': ['align-content', none],
    justify: ['justify-content', none],
    justifyContent: ['justify-content', none],
    'justify-content': ['justify-content', none],
    justifyItems: ['justify-items', none],
    'justify-items': ['justify-items', none],
    justifySelf: ['justify-self', none],
    'justify-self': ['justify-self', none],

    /************************************************************************************************
     * Grid
     ***********************************************************************************************/

    grid: ['grid-template-columns', none],
    gridCols: ['grid-template-columns', none],
    'grid-cols': ['grid-template-columns', none],
    gridRows: ['grid-template-rows', none],
    'grid-rows': ['grid-template-rows', none],
    autoCols: ['grid-auto-columns', none],
    'auto-cols': ['grid-auto-columns', none],
    autoRows: ['grid-auto-rows', none],
    'auto-rows': ['grid-auto-rows', none],
    autoFlow: ['grid-auto-flow', none],
    'auto-flow': ['grid-auto-flow', none],
    col: ['grid-column', none],
    column: ['grid-column', none],
    colSpan: ['grid-column', none],
    'col-span': ['grid-column', none],
    row: ['grid-row', none],
    rowSpan: ['grid-row', none],
    'row-span': ['grid-row', none],
    gap: ['gap', spacing],
    gapx: ['column-gap', spacing],
    gapX: ['column-gap', spacing],
    'gap-x': ['column-gap', spacing],
    gapy: ['row-gap', spacing],
    gapY: ['row-gap', spacing],
    'gap-y': ['row-gap', spacing],

    /************************************************************************************************
     * Columns
     ***********************************************************************************************/

    columns: ['columns', spacing],
    cols: ['columns', spacing],
    breakAfter: ['break-after', none],
    'break-after': ['break-after', none],
    breakBefore: ['break-before', none],
    'break-before': ['break-before', none],
    breakInside: ['break-inside', none],
    'break-inside': ['break-inside', none],

    /************************************************************************************************
     * Typography
     ***********************************************************************************************/

    font: ['font-family', none],
    fontFamily: ['font-family', none],
    'font-family': ['font-family', none],
    text: ['font-size', text],
    textSize: ['font-size', text],
    'text-size': ['font-size', text],
    fs: ['font-size', text],
    fontSize: ['font-size', text],
    'font-size': ['font-size', text],
    weight: ['font-weight', none],
    fontWeight: ['font-weight', none],
    'font-weight': ['font-weight', none],
    lh: ['line-height', none],
    leading: ['line-height', none],
    lineHeight: ['line-height', none],
    'line-height': ['line-height', none],
    tracking: ['letter-spacing', none],
    letterSpacing: ['letter-spacing', none],
    'letter-spacing': ['letter-spacing', none],
    alignText: ['text-align', none],
    textAlign: ['text-align', none],
    'text-align': ['text-align', none],
    decoration: ['text-decoration-line', none],
    textDecoration: ['text-decoration-line', none],
    'text-decoration': ['text-decoration-line', none],
    decorationColor: ['text-decoration-color', color],
    'decoration-color': ['text-decoration-color', color],
    decorationStyle: ['text-decoration-style', none],
    'decoration-style': ['text-decoration-style', none],
    decorationThickness: ['text-decoration-thickness', spacing],
    'decoration-thickness': ['text-decoration-thickness', spacing],
    underlineOffset: ['text-underline-offset', spacing],
    'underline-offset': ['text-underline-offset', spacing],
    transform: ['text-transform', none],
    textTransform: ['text-transform', none],
    'text-transform': ['text-transform', none],
    indent: ['text-indent', spacing],
    textIndent: ['text-indent', spacing],
    'text-indent': ['text-indent', spacing],
    wrapText: ['text-wrap', none],
    textWrap: ['text-wrap', none],
    'text-wrap': ['text-wrap', none],
    whitespace: ['white-space', none],
    whiteSpace: ['white-space', none],
    'white-space': ['white-space', none],
    wordBreak: ['word-break', none],
    'word-break': ['word-break', none],
    break: ['word-break', none],
    overflowWrap: ['overflow-wrap', none],
    'overflow-wrap': ['overflow-wrap', none],
    hyphens: ['hyphens', none],
    contentVisibility: ['content-visibility', none],
    'content-visibility': ['content-visibility', none],

    /************************************************************************************************
     * Backgrounds / Colors
     ***********************************************************************************************/

    bg: ['background', color],
    background: ['background', color],
    bgColor: ['background-color', color],
    'bg-color': ['background-color', color],
    backgroundColor: ['background-color', color],
    'background-color': ['background-color', color],
    bgImage: ['background-image', color],
    'bg-image': ['background-image', color],
    backgroundImage: ['background-image', color],
    'background-image': ['background-image', color],
    bgSize: ['background-size', none],
    'bg-size': ['background-size', none],
    backgroundSize: ['background-size', none],
    'background-size': ['background-size', none],
    bgPosition: ['background-position', none],
    'bg-position': ['background-position', none],
    backgroundPosition: ['background-position', none],
    'background-position': ['background-position', none],
    bgRepeat: ['background-repeat', none],
    'bg-repeat': ['background-repeat', none],
    backgroundRepeat: ['background-repeat', none],
    'background-repeat': ['background-repeat', none],
    bgClip: ['background-clip', none],
    'bg-clip': ['background-clip', none],
    backgroundClip: ['background-clip', none],
    'background-clip': ['background-clip', none],
    color: ['color', color],
    textColor: ['color', color],
    'text-color': ['color', color],
    fill: ['fill', color],
    stroke: ['stroke', color],
    caret: ['caret-color', color],
    caretColor: ['caret-color', color],
    'caret-color': ['caret-color', color],
    accent: ['accent-color', color],
    accentColor: ['accent-color', color],
    'accent-color': ['accent-color', color],

    /************************************************************************************************
     * Borders / Outline / Ring
     ***********************************************************************************************/

    border: ['border', color],
    borderX: ['border-inline', color],
    'border-x': ['border-inline', color],
    borderY: ['border-block', color],
    'border-y': ['border-block', color],
    borderT: ['border-top', color],
    'border-t': ['border-top', color],
    borderR: ['border-right', color],
    'border-r': ['border-right', color],
    borderB: ['border-bottom', color],
    'border-b': ['border-bottom', color],
    borderL: ['border-left', color],
    'border-l': ['border-left', color],
    borderColor: ['border-color', color],
    'border-color': ['border-color', color],
    borderWidth: ['border-width', spacing],
    'border-width': ['border-width', spacing],
    borderStyle: ['border-style', none],
    'border-style': ['border-style', none],
    rounded: ['border-radius', radius],
    radius: ['border-radius', radius],
    roundedT: ['border-start-start-radius', radius],
    'rounded-t': ['border-start-start-radius', radius],
    roundedR: ['border-start-end-radius', radius],
    'rounded-r': ['border-start-end-radius', radius],
    roundedB: ['border-end-end-radius', radius],
    'rounded-b': ['border-end-end-radius', radius],
    roundedL: ['border-end-start-radius', radius],
    'rounded-l': ['border-end-start-radius', radius],
    outline: ['outline', color],
    outlineColor: ['outline-color', color],
    'outline-color': ['outline-color', color],
    outlineWidth: ['outline-width', spacing],
    'outline-width': ['outline-width', spacing],
    outlineOffset: ['outline-offset', spacing],
    'outline-offset': ['outline-offset', spacing],
    ring: ['box-shadow', shadow],

    /************************************************************************************************
     * Effects
     ***********************************************************************************************/

    shadow: ['box-shadow', shadow],
    boxShadow: ['box-shadow', shadow],
    'box-shadow': ['box-shadow', shadow],
    textShadow: ['text-shadow', shadow],
    'text-shadow': ['text-shadow', shadow],
    opacity: ['opacity', none],
    mixBlend: ['mix-blend-mode', none],
    'mix-blend': ['mix-blend-mode', none],
    bgBlend: ['background-blend-mode', none],
    'bg-blend': ['background-blend-mode', none],

    /************************************************************************************************
     * Filters
     ***********************************************************************************************/

    filter: ['filter', none],
    blur: ['filter', none],
    brightness: ['filter', none],
    contrast: ['filter', none],
    grayscale: ['filter', none],
    hueRotate: ['filter', none],
    'hue-rotate': ['filter', none],
    invert: ['filter', none],
    saturate: ['filter', none],
    sepia: ['filter', none],
    dropShadow: ['filter', shadow],
    'drop-shadow': ['filter', shadow],

    backdrop: ['backdrop-filter', none],
    backdropFilter: ['backdrop-filter', none],
    'backdrop-filter': ['backdrop-filter', none],
    backdropBlur: ['backdrop-filter', none],
    'backdrop-blur': ['backdrop-filter', none],
    backdropBrightness: ['backdrop-filter', none],
    'backdrop-brightness': ['backdrop-filter', none],
    backdropContrast: ['backdrop-filter', none],
    'backdrop-contrast': ['backdrop-filter', none],
    backdropGrayscale: ['backdrop-filter', none],
    'backdrop-grayscale': ['backdrop-filter', none],
    backdropHueRotate: ['backdrop-filter', none],
    'backdrop-hue-rotate': ['backdrop-filter', none],
    backdropInvert: ['backdrop-filter', none],
    'backdrop-invert': ['backdrop-filter', none],
    backdropOpacity: ['backdrop-filter', none],
    'backdrop-opacity': ['backdrop-filter', none],
    backdropSaturate: ['backdrop-filter', none],
    'backdrop-saturate': ['backdrop-filter', none],
    backdropSepia: ['backdrop-filter', none],
    'backdrop-sepia': ['backdrop-filter', none],

    /************************************************************************************************
     * Transforms
     ***********************************************************************************************/

    scale: ['scale', none],
    scaleX: ['scale', none],
    'scale-x': ['scale', none],
    scaleY: ['scale', none],
    'scale-y': ['scale', none],
    rotate: ['rotate', none],
    translate: ['translate', spacing],
    translateX: ['translate', spacing],
    'translate-x': ['translate', spacing],
    translateY: ['translate', spacing],
    'translate-y': ['translate', spacing],
    skew: ['transform', none],
    skewX: ['transform', none],
    'skew-x': ['transform', none],
    skewY: ['transform', none],
    'skew-y': ['transform', none],
    origin: ['transform-origin', none],
    transformOrigin: ['transform-origin', none],
    'transform-origin': ['transform-origin', none],

    /************************************************************************************************
     * Transitions / Animations
     ***********************************************************************************************/

    transition: ['transition', none],
    duration: ['transition-duration', none],
    delay: ['transition-delay', none],
    ease: ['transition-timing-function', none],
    timing: ['transition-timing-function', none],
    animate: ['animation', none],
    animation: ['animation', none],

    /************************************************************************************************
     * Tables / Lists / SVG / Accessibility / Interaction
     ***********************************************************************************************/

    table: ['table-layout', none],
    tableLayout: ['table-layout', none],
    'table-layout': ['table-layout', none],
    caption: ['caption-side', none],
    captionSide: ['caption-side', none],
    'caption-side': ['caption-side', none],
    borderCollapse: ['border-collapse', none],
    'border-collapse': ['border-collapse', none],
    list: ['list-style-type', none],
    listStyle: ['list-style-type', none],
    'list-style': ['list-style-type', none],
    listImage: ['list-style-image', none],
    'list-image': ['list-style-image', none],
    listPosition: ['list-style-position', none],
    'list-position': ['list-style-position', none],
    select: ['user-select', none],
    userSelect: ['user-select', none],
    'user-select': ['user-select', none],
    cursor: ['cursor', none],
    pointer: ['pointer-events', none],
    pointerEvents: ['pointer-events', none],
    'pointer-events': ['pointer-events', none],
    resize: ['resize', none],
    touch: ['touch-action', none],
    touchAction: ['touch-action', none],
    'touch-action': ['touch-action', none],
    scroll: ['scroll-behavior', none],
    scrollBehavior: ['scroll-behavior', none],
    'scroll-behavior': ['scroll-behavior', none],
    snap: ['scroll-snap-type', none],
    scrollSnap: ['scroll-snap-type', none],
    'scroll-snap': ['scroll-snap-type', none],
    snapAlign: ['scroll-snap-align', none],
    'snap-align': ['scroll-snap-align', none],
    snapStop: ['scroll-snap-stop', none],
    'snap-stop': ['scroll-snap-stop', none],
    appearance: ['appearance', none],
    willChange: ['will-change', none],
    'will-change': ['will-change', none],
    scrollbar: ['scrollbar-width', none],
    scrollbarWidth: ['scrollbar-width', none],
    'scrollbar-width': ['scrollbar-width', none],
  }

  for (const [name, [property, scale]] of Object.entries(aliases)) {
    registerProperty(name, { property, scale })
  }
}

/**
 * Registers standalone identifiers such as `flex;`, `center;`, `glass;`.
 *
 * @remarks
 * This mirrors UnoCSS's shortcut idea: one identifier can expand into many
 * declarations. Unlike UnoCSS class shortcuts, Cipó shortcuts live inside the
 * CSS template itself.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * css`
 *   glass;
 *   cardSurface;
 *   interactive;
 * `
 * ```
 *
 * @example Output shape
 * ```css
 * background: color-mix(...);
 * border: 1px solid color-mix(...);
 * backdrop-filter: blur(18px) saturate(140%);
 * ```
 */
export function installUtilityAliases(): void {
  const aliases: Record<string, string> = {
    /************************************************************************************************
     * Display
     ***********************************************************************************************/

    hidden: 'display:none;',
    block: 'display:block;',
    inline: 'display:inline;',
    'inline-block': 'display:inline-block;',
    flex: 'display:flex;',
    'inline-flex': 'display:inline-flex;',
    grid: 'display:grid;',
    'inline-grid': 'display:inline-grid;',
    contents: 'display:contents;',
    flowRoot: 'display:flow-root;',
    'flow-root': 'display:flow-root;',

    /************************************************************************************************
     * Positioning
     ***********************************************************************************************/

    static: 'position:static;',
    relative: 'position:relative;',
    absolute: 'position:absolute;',
    fixed: 'position:fixed;',
    sticky: 'position:sticky;',
    'absolute-fill': 'position:absolute;inset:0;',
    'fixed-fill': 'position:fixed;inset:0;',
    'absolute-center': 'position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);',
    'fixed-center': 'position:fixed;left:50%;top:50%;transform:translate(-50%, -50%);',

    /************************************************************************************************
     * Flex / Grid
     ***********************************************************************************************/

    row: 'display:flex;flex-direction:row;',
    col: 'display:flex;flex-direction:column;',
    column: 'display:flex;flex-direction:column;',
    wrap: 'flex-wrap:wrap;',
    nowrap: 'flex-wrap:nowrap;',
    center: 'display:flex;align-items:center;justify-content:center;',
    'center-x': 'display:flex;justify-content:center;',
    'center-y': 'display:flex;align-items:center;',
    'items-start': 'align-items:flex-start;',
    'items-center': 'align-items:center;',
    'items-end': 'align-items:flex-end;',
    'items-stretch': 'align-items:stretch;',
    'justify-start': 'justify-content:flex-start;',
    'justify-center': 'justify-content:center;',
    'justify-end': 'justify-content:flex-end;',
    between: 'justify-content:space-between;',
    around: 'justify-content:space-around;',
    evenly: 'justify-content:space-evenly;',
    'place-center': 'place-items:center;',
    'content-center': 'align-content:center;',
    'self-center': 'align-self:center;',
    'minw-0': 'min-width:0;',
    'minh-0': 'min-height:0;',

    /************************************************************************************************
     * Viewport / Safe Area
     ***********************************************************************************************/

    screen: 'min-height:100vh;',
    dvh: 'min-height:100dvh;',
    svh: 'min-height:100svh;',
    lvh: 'min-height:100lvh;',
    'screen-safe': 'min-height:100dvh;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);',
    'safe-top': 'padding-top:env(safe-area-inset-top);',
    'safe-right': 'padding-right:env(safe-area-inset-right);',
    'safe-bottom': 'padding-bottom:env(safe-area-inset-bottom);',
    'safe-left': 'padding-left:env(safe-area-inset-left);',

    /************************************************************************************************
     * Typography
     ***********************************************************************************************/

    truncate: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    balance: 'text-wrap:balance;',
    pretty: 'text-wrap:pretty;',
    antialiased: '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;',
    subpixel: '-webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto;',
    uppercase: 'text-transform:uppercase;',
    lowercase: 'text-transform:lowercase;',
    capitalize: 'text-transform:capitalize;',
    normalCase: 'text-transform:none;',
    'normal-case': 'text-transform:none;',
    underline: 'text-decoration-line:underline;',
    'no-underline': 'text-decoration-line:none;',
    italic: 'font-style:italic;',
    'not-italic': 'font-style:normal;',
    'break-normal': 'overflow-wrap:normal;word-break:normal;',
    'break-words': 'overflow-wrap:break-word;',
    'break-all': 'word-break:break-all;',
    'hyphens-none': 'hyphens:none;',
    'hyphens-manual': 'hyphens:manual;',
    'hyphens-auto': 'hyphens:auto;',

    /************************************************************************************************
     * Effects / Rendering
     ***********************************************************************************************/

    gpu: 'transform:translateZ(0);backface-visibility:hidden;will-change:transform;',
    'preserve-3d': 'transform-style:preserve-3d;',
    'flat-3d': 'transform-style:flat;',
    'backface-hidden': 'backface-visibility:hidden;',
    'backface-visible': 'backface-visibility:visible;',
    invisible: 'visibility:hidden;',
    visible: 'visibility:visible;',
    collapse: 'visibility:collapse;',

    /************************************************************************************************
     * Interactions
     ***********************************************************************************************/

    'select-none': 'user-select:none;',
    'select-text': 'user-select:text;',
    'select-all': 'user-select:all;',
    'select-auto': 'user-select:auto;',
    'pointer-none': 'pointer-events:none;',
    'pointer-auto': 'pointer-events:auto;',
    'resize-none': 'resize:none;',
    'resize-both': 'resize:both;',
    'resize-x': 'resize:horizontal;',
    'resize-y': 'resize:vertical;',
    'touch-auto': 'touch-action:auto;',
    'touch-none': 'touch-action:none;',
    'touch-pan-x': 'touch-action:pan-x;',
    'touch-pan-y': 'touch-action:pan-y;',
    'cursor-pointer': 'cursor:pointer;',
    'cursor-default': 'cursor:default;',
    'cursor-grab': 'cursor:grab;',
    'cursor-grabbing': 'cursor:grabbing;',
    'cursor-not-allowed': 'cursor:not-allowed;',

    /************************************************************************************************
     * Scrolling
     ***********************************************************************************************/

    'scroll-smooth': 'scroll-behavior:smooth;',
    'scroll-auto': 'scroll-behavior:auto;',
    'snap-x': 'scroll-snap-type:x var(--cipo-snap-strictness, mandatory);',
    'snap-y': 'scroll-snap-type:y var(--cipo-snap-strictness, mandatory);',
    'snap-both': 'scroll-snap-type:both var(--cipo-snap-strictness, mandatory);',
    'snap-none': 'scroll-snap-type:none;',
    'snap-start': 'scroll-snap-align:start;',
    'snap-center': 'scroll-snap-align:center;',
    'snap-end': 'scroll-snap-align:end;',
    'snap-always': 'scroll-snap-stop:always;',
    'snap-normal': 'scroll-snap-stop:normal;',

    /************************************************************************************************
     * Accessibility
     ***********************************************************************************************/

    'sr-only': 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;',
    'not-sr-only': 'position:static;width:auto;height:auto;padding:0;margin:0;overflow:visible;clip:auto;white-space:normal;',

    /************************************************************************************************
     * Cipó Semantic Presets
     ***********************************************************************************************/

    glass: 'bg: alpha($panel / 72%);border:1px solid alpha($ink / 12%);backdrop-filter:blur(18px) saturate(140%);',
    'glass-strong': 'bg: alpha($panel / 86%);border:1px solid alpha($ink / 16%);backdrop-filter:blur(26px) saturate(160%);',
    'glass-soft': 'bg: alpha($panel / 48%);border:1px solid alpha($ink / 8%);backdrop-filter:blur(12px) saturate(120%);',
    interactive: 'transition:transform 160ms ease, background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;x:hover{transform:translateY(-1px);}x:active{transform:scale(.985);}',
    focusRing: 'x:focus-visible{outline:2px solid $brand;outline-offset:2px;}',
    buttonBase: 'px:4;py:2;rounded:$md;cursor:pointer;user-select:none;display:inline-flex;align-items:center;justify-content:center;gap:2;',
    iconButton: 'size:10;rounded:$pill;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;',
    cardSurface: 'glass;rounded:$xl;shadow:$panel;',
    glassCard: 'glass;rounded:$xl;shadow:$panel;',
    panelSurface: 'bg:$panel;color:$ink;border:1px solid alpha($ink / 12%);rounded:$xl;shadow:$panel;',
    softSurface: 'bg:alpha($ink / 5%);border:1px solid alpha($ink / 8%);rounded:$lg;',
    heroText: 'text(size:xl,lh:1.05,weight:900,tracking:-0.05em,color:$ink);',
    mutedText: 'color:$muted;',
    linkText: 'color:$brand;text-decoration-line:none;x:hover{text-decoration-line:underline;}',
  }

  for (const [name, value] of Object.entries(aliases)) {
    registerAlias(name, value)
  }

  /**************************************************************************************************
   * Extra aliases installed directly into the registry.
   *
   * @remarks
   * Keeping these direct writes preserves the user's current pattern while the
   * public `registerAlias()` API remains the preferred extension point.
   *************************************************************************************************/

  runtime.aliasRegistry.set('stack', 'display:flex;flex-direction:column;gap:4;')
  runtime.aliasRegistry.set('hstack', 'display:flex;flex-direction:row;align-items:center;gap:4;')
  runtime.aliasRegistry.set('vstack', 'display:flex;flex-direction:column;gap:4;')
  runtime.aliasRegistry.set('cluster', 'display:flex;flex-wrap:wrap;align-items:center;gap:3;')
  runtime.aliasRegistry.set('bento', 'display:grid;gap:4;grid-template-columns:repeat(auto-fit,minmax(min(100%, 16rem),1fr));')
  runtime.aliasRegistry.set('auto-grid', 'display:grid;gap:4;grid-template-columns:repeat(auto-fit,minmax(min(100%, 16rem),1fr));')
}
