/**
 * Static built-in utility aliases.
 *
 * @remarks
 * This registry intentionally contains only utilities whose CSS output is
 * completely static.
 *
 * Open-ended utility families such as `p-*`, `w-*`, `bg-*`, `text-*`,
 * `grid-cols-*`, arbitrary values and theme-driven utilities belong in the
 * dynamic utility resolver instead of being materialized here.
 */
export type BuiltInUtilityAliasMap =
  Readonly<Record<string, string>>
type MutableUtilityAliasMap =
  Record<string, string>
type UtilityValueMap =
  Readonly<Record<string, string>>
const aliases: MutableUtilityAliasMap =
  Object.create(null) as MutableUtilityAliasMap
/**
 * Registers a utility expansion under one or more names.
 *
 * Camel-case aliases automatically receive a kebab-case equivalent, avoiding
 * pairs such as `flowRoot` + `flow-root` throughout the source.
 */
function defineAlias(
  css: string,
  ...names: readonly string[]
): void {
  for (
    let index = 0;
    index < names.length;
    index += 1
  ) {
    const name = names[index]
    if (!name) continue
    aliases[name] = css
    const kebab =
      toUtilityKebabCase(name)
    if (
      kebab
      && kebab !== name
    ) {
      aliases[kebab] = css
    }
  }
}
/**
 * Registers a family where the utility suffix maps directly to a CSS value.
 *
 * @example
 * ```ts
 * defineValues(
 *   'overflow',
 *   'overflow',
 *   {
 *     auto: 'auto',
 *     hidden: 'hidden',
 *   },
 * )
 *
 * // overflow-auto   -> overflow:auto;
 * // overflow-hidden -> overflow:hidden;
 * ```
 */
function defineValues(
  prefix: string,
  property: string,
  values: UtilityValueMap,
): void {
  for (const name in values) {
    defineAlias(
      `${property}:${values[name]};`,
      `${prefix}-${name}`,
    )
  }
}
/**
 * Registers utilities whose complete utility name is also the value key.
 *
 * @example
 * ```ts
 * defineDirectValues(
 *   'display',
 *   {
 *     block: 'block',
 *     flex: 'flex',
 *   },
 * )
 * ```
 */
function defineDirectValues(
  property: string,
  values: UtilityValueMap,
): void {
  for (const name in values) {
    defineAlias(
      `${property}:${values[name]};`,
      name,
    )
  }
}
/** Converts JavaScript-style alias names into utility kebab-case. */
function toUtilityKebabCase(
  value: string,
): string {
  return value
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
/**************************************************************************************************
 * Display
 *************************************************************************************************/
defineDirectValues(
  'display',
  {
    hidden: 'none',
    block: 'block',
    inline: 'inline',
    'inline-block': 'inline-block',
    flex: 'flex',
    'inline-flex': 'inline-flex',
    grid: 'grid',
    'inline-grid': 'inline-grid',
    contents: 'contents',
    'flow-root': 'flow-root',
    table: 'table',
    'inline-table': 'inline-table',
    'table-caption': 'table-caption',
    'table-cell': 'table-cell',
    'table-column': 'table-column',
    'table-column-group':
      'table-column-group',
    'table-footer-group':
      'table-footer-group',
    'table-header-group':
      'table-header-group',
    'table-row-group':
      'table-row-group',
    'table-row': 'table-row',
    'list-item': 'list-item',
  },
)
defineAlias(
  'display:flow-root;',
  'flowRoot',
)
/**************************************************************************************************
 * Positioning
 *************************************************************************************************/
defineDirectValues(
  'position',
  {
    static: 'static',
    relative: 'relative',
    absolute: 'absolute',
    fixed: 'fixed',
    sticky: 'sticky',
  },
)
defineAlias(
  'position:absolute;inset:0;',
  'absolute-fill',
)
defineAlias(
  'position:fixed;inset:0;',
  'fixed-fill',
)
/**
 * Individual translate is preferred here because it composes with `transform`
 * instead of replacing an existing transform chain.
 */
defineAlias(
  'position:absolute;left:50%;top:50%;translate:-50% -50%;',
  'absolute-center',
)
defineAlias(
  'position:fixed;left:50%;top:50%;translate:-50% -50%;',
  'fixed-center',
)
/**************************************************************************************************
 * Box sizing
 *************************************************************************************************/
defineValues(
  'box',
  'box-sizing',
  {
    border: 'border-box',
    content: 'content-box',
  },
)
defineValues(
  'box-decoration',
  'box-decoration-break',
  {
    clone: 'clone',
    slice: 'slice',
  },
)
/**************************************************************************************************
 * Float / Clear
 *************************************************************************************************/
defineValues(
  'float',
  'float',
  {
    left: 'left',
    right: 'right',
    start: 'inline-start',
    end: 'inline-end',
    none: 'none',
  },
)
defineValues(
  'clear',
  'clear',
  {
    left: 'left',
    right: 'right',
    start: 'inline-start',
    end: 'inline-end',
    both: 'both',
    none: 'none',
  },
)
/**************************************************************************************************
 * Isolation
 *************************************************************************************************/
defineAlias(
  'isolation:isolate;',
  'isolate',
)
defineAlias(
  'isolation:auto;',
  'isolation-auto',
)
/**************************************************************************************************
 * Object fit
 *************************************************************************************************/
defineValues(
  'object',
  'object-fit',
  {
    contain: 'contain',
    cover: 'cover',
    fill: 'fill',
    none: 'none',
    'scale-down': 'scale-down',
  },
)
/**************************************************************************************************
 * Object position
 *************************************************************************************************/
defineValues(
  'object',
  'object-position',
  {
    bottom: 'bottom',
    center: 'center',
    left: 'left',
    'left-bottom': 'left bottom',
    'left-top': 'left top',
    right: 'right',
    'right-bottom': 'right bottom',
    'right-top': 'right top',
    top: 'top',
  },
)
/**************************************************************************************************
 * Overflow
 *************************************************************************************************/
defineValues(
  'overflow',
  'overflow',
  {
    auto: 'auto',
    hidden: 'hidden',
    clip: 'clip',
    visible: 'visible',
    scroll: 'scroll',
  },
)
defineValues(
  'overflow-x',
  'overflow-x',
  {
    auto: 'auto',
    hidden: 'hidden',
    clip: 'clip',
    visible: 'visible',
    scroll: 'scroll',
  },
)
defineValues(
  'overflow-y',
  'overflow-y',
  {
    auto: 'auto',
    hidden: 'hidden',
    clip: 'clip',
    visible: 'visible',
    scroll: 'scroll',
  },
)
/**************************************************************************************************
 * Overscroll
 *************************************************************************************************/
defineValues(
  'overscroll',
  'overscroll-behavior',
  {
    auto: 'auto',
    contain: 'contain',
    none: 'none',
  },
)
defineValues(
  'overscroll-x',
  'overscroll-behavior-x',
  {
    auto: 'auto',
    contain: 'contain',
    none: 'none',
  },
)
defineValues(
  'overscroll-y',
  'overscroll-behavior-y',
  {
    auto: 'auto',
    contain: 'contain',
    none: 'none',
  },
)
/**************************************************************************************************
 * Flex direction
 *************************************************************************************************/
defineValues(
  'flex',
  'flex-direction',
  {
    row: 'row',
    'row-reverse': 'row-reverse',
    col: 'column',
    'col-reverse': 'column-reverse',
  },
)
/**
 * Cipó convenience layouts.
 *
 * These intentionally include `display:flex`, unlike Tailwind's
 * `flex-row`/`flex-col` utilities.
 */
defineAlias(
  'display:flex;flex-direction:row;',
  'row',
)
defineAlias(
  'display:flex;flex-direction:column;',
  'col',
  'column',
)
/**************************************************************************************************
 * Flex wrap
 *************************************************************************************************/
defineValues(
  'flex',
  'flex-wrap',
  {
    wrap: 'wrap',
    'wrap-reverse': 'wrap-reverse',
    nowrap: 'nowrap',
  },
)
defineAlias(
  'flex-wrap:wrap;',
  'wrap',
)
defineAlias(
  'flex-wrap:nowrap;',
  'nowrap',
)
/**************************************************************************************************
 * Flex
 *************************************************************************************************/
defineAlias(
  'flex:1 1 0%;',
  'flex-1',
)
defineAlias(
  'flex:1 1 auto;',
  'flex-auto',
)
defineAlias(
  'flex:0 1 auto;',
  'flex-initial',
)
defineAlias(
  'flex:none;',
  'flex-none',
)
defineAlias(
  'flex-grow:1;',
  'grow',
)
defineAlias(
  'flex-grow:0;',
  'grow-0',
)
defineAlias(
  'flex-shrink:1;',
  'shrink',
)
defineAlias(
  'flex-shrink:0;',
  'shrink-0',
)
/**************************************************************************************************
 * Align items
 *************************************************************************************************/
defineValues(
  'items',
  'align-items',
  {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    baseline: 'baseline',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Align self
 *************************************************************************************************/
defineValues(
  'self',
  'align-self',
  {
    auto: 'auto',
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    stretch: 'stretch',
    baseline: 'baseline',
  },
)
/**************************************************************************************************
 * Align content
 *************************************************************************************************/
defineValues(
  'content',
  'align-content',
  {
    normal: 'normal',
    center: 'center',
    start: 'flex-start',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    baseline: 'baseline',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Justify content
 *************************************************************************************************/
defineValues(
  'justify',
  'justify-content',
  {
    normal: 'normal',
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Justify items
 *************************************************************************************************/
defineValues(
  'justify-items',
  'justify-items',
  {
    normal: 'normal',
    start: 'start',
    end: 'end',
    center: 'center',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Justify self
 *************************************************************************************************/
defineValues(
  'justify-self',
  'justify-self',
  {
    auto: 'auto',
    start: 'start',
    end: 'end',
    center: 'center',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Place content
 *************************************************************************************************/
defineValues(
  'place-content',
  'place-content',
  {
    center: 'center',
    start: 'start',
    end: 'end',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Place items
 *************************************************************************************************/
defineValues(
  'place-items',
  'place-items',
  {
    start: 'start',
    end: 'end',
    center: 'center',
    baseline: 'baseline',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Place self
 *************************************************************************************************/
defineValues(
  'place-self',
  'place-self',
  {
    auto: 'auto',
    start: 'start',
    end: 'end',
    center: 'center',
    stretch: 'stretch',
  },
)
/**************************************************************************************************
 * Cipó alignment conveniences
 *************************************************************************************************/
defineAlias(
  'display:flex;align-items:center;justify-content:center;',
  'center',
)
defineAlias(
  'display:flex;justify-content:center;',
  'center-x',
)
defineAlias(
  'display:flex;align-items:center;',
  'center-y',
)
defineAlias(
  'justify-content:space-between;',
  'between',
)
defineAlias(
  'justify-content:space-around;',
  'around',
)
defineAlias(
  'justify-content:space-evenly;',
  'evenly',
)
defineAlias(
  'place-items:center;',
  'place-center',
)
defineAlias(
  'align-content:center;',
  'content-center',
)
defineAlias(
  'align-self:center;',
  'self-center',
)
/**************************************************************************************************
 * Grid flow
 *************************************************************************************************/
defineValues(
  'grid-flow',
  'grid-auto-flow',
  {
    row: 'row',
    col: 'column',
    dense: 'dense',
    'row-dense': 'row dense',
    'col-dense': 'column dense',
  },
)
defineAlias(
  'grid-template-columns:none;',
  'grid-cols-none',
)
defineAlias(
  'grid-template-columns:subgrid;',
  'grid-cols-subgrid',
)
defineAlias(
  'grid-template-rows:none;',
  'grid-rows-none',
)
defineAlias(
  'grid-template-rows:subgrid;',
  'grid-rows-subgrid',
)
defineAlias(
  'grid-column:auto;',
  'col-auto',
)
defineAlias(
  'grid-row:auto;',
  'row-auto',
)
/**************************************************************************************************
 * Minimum sizing reset
 *************************************************************************************************/
defineAlias(
  'min-width:0;',
  'minw-0',
  'minW0',
)
defineAlias(
  'min-height:0;',
  'minh-0',
  'minH0',
)
/**************************************************************************************************
 * Common static sizing utilities
 *************************************************************************************************/
defineAlias(
  'width:auto;',
  'w-auto',
)
defineAlias(
  'width:100%;',
  'w-full',
)
defineAlias(
  'width:min-content;',
  'w-min',
)
defineAlias(
  'width:max-content;',
  'w-max',
)
defineAlias(
  'width:fit-content;',
  'w-fit',
)
defineAlias(
  'width:100vw;',
  'w-screen',
)
defineAlias(
  'height:auto;',
  'h-auto',
)
defineAlias(
  'height:100%;',
  'h-full',
)
defineAlias(
  'height:min-content;',
  'h-min',
)
defineAlias(
  'height:max-content;',
  'h-max',
)
defineAlias(
  'height:fit-content;',
  'h-fit',
)
defineAlias(
  'height:100vh;',
  'h-screen',
)
defineAlias(
  'width:100%;height:100%;',
  'size-full',
)
/**************************************************************************************************
 * Viewport
 *************************************************************************************************/
defineAlias(
  'min-height:100vh;',
  'screen',
)
defineAlias(
  'min-height:100dvh;',
  'dvh',
)
defineAlias(
  'min-height:100svh;',
  'svh',
)
defineAlias(
  'min-height:100lvh;',
  'lvh',
)
/**************************************************************************************************
 * Safe area
 *************************************************************************************************/
defineAlias(
  [
    'min-height:100dvh;',
    'padding-top:env(safe-area-inset-top);',
    'padding-right:env(safe-area-inset-right);',
    'padding-bottom:env(safe-area-inset-bottom);',
    'padding-left:env(safe-area-inset-left);',
  ].join(''),
  'screen-safe',
)
defineAlias(
  'padding-top:env(safe-area-inset-top);',
  'safe-top',
)
defineAlias(
  'padding-right:env(safe-area-inset-right);',
  'safe-right',
)
defineAlias(
  'padding-bottom:env(safe-area-inset-bottom);',
  'safe-bottom',
)
defineAlias(
  'padding-left:env(safe-area-inset-left);',
  'safe-left',
)
/**************************************************************************************************
 * Text alignment
 *************************************************************************************************/
defineValues(
  'text',
  'text-align',
  {
    left: 'left',
    center: 'center',
    right: 'right',
    justify: 'justify',
    start: 'start',
    end: 'end',
  },
)
/**************************************************************************************************
 * Text overflow
 *************************************************************************************************/
defineAlias(
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
  'truncate',
)
defineAlias(
  'text-overflow:ellipsis;',
  'text-ellipsis',
)
defineAlias(
  'text-overflow:clip;',
  'text-clip',
)
/**************************************************************************************************
 * Text wrap
 *************************************************************************************************/
defineAlias(
  'text-wrap:wrap;',
  'text-wrap',
)
defineAlias(
  'text-wrap:nowrap;',
  'text-nowrap',
)
defineAlias(
  'text-wrap:balance;',
  'balance',
  'text-balance',
)
defineAlias(
  'text-wrap:pretty;',
  'pretty',
  'text-pretty',
)
/**************************************************************************************************
 * White space
 *************************************************************************************************/
defineValues(
  'whitespace',
  'white-space',
  {
    normal: 'normal',
    nowrap: 'nowrap',
    pre: 'pre',
    'pre-line': 'pre-line',
    'pre-wrap': 'pre-wrap',
    'break-spaces': 'break-spaces',
  },
)
/**************************************************************************************************
 * Font smoothing
 *************************************************************************************************/
defineAlias(
  '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;',
  'antialiased',
)
defineAlias(
  '-webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto;',
  'subpixel',
  'subpixelAntialiased',
)
/**************************************************************************************************
 * Font style
 *************************************************************************************************/
defineAlias(
  'font-style:italic;',
  'italic',
)
defineAlias(
  'font-style:normal;',
  'not-italic',
)
/**************************************************************************************************
 * Text transform
 *************************************************************************************************/
defineDirectValues(
  'text-transform',
  {
    uppercase: 'uppercase',
    lowercase: 'lowercase',
    capitalize: 'capitalize',
  },
)
defineAlias(
  'text-transform:none;',
  'normalCase',
)
/**************************************************************************************************
 * Text decoration
 *************************************************************************************************/
defineAlias(
  'text-decoration-line:underline;',
  'underline',
)
defineAlias(
  'text-decoration-line:overline;',
  'overline',
)
defineAlias(
  'text-decoration-line:line-through;',
  'line-through',
)
defineAlias(
  'text-decoration-line:none;',
  'no-underline',
)
defineValues(
  'decoration',
  'text-decoration-style',
  {
    solid: 'solid',
    double: 'double',
    dotted: 'dotted',
    dashed: 'dashed',
    wavy: 'wavy',
  },
)
/**************************************************************************************************
 * Word breaking
 *************************************************************************************************/
defineAlias(
  'overflow-wrap:normal;word-break:normal;',
  'break-normal',
)
defineAlias(
  'overflow-wrap:break-word;',
  'break-words',
)
defineAlias(
  'overflow-wrap:anywhere;',
  'break-anywhere',
)
defineAlias(
  'word-break:break-all;',
  'break-all',
)
defineAlias(
  'word-break:keep-all;',
  'break-keep',
)
/**************************************************************************************************
 * Hyphens
 *************************************************************************************************/
defineValues(
  'hyphens',
  'hyphens',
  {
    none: 'none',
    manual: 'manual',
    auto: 'auto',
  },
)
/**************************************************************************************************
 * Visibility
 *************************************************************************************************/
defineAlias(
  'visibility:hidden;',
  'invisible',
)
defineAlias(
  'visibility:visible;',
  'visible',
)
defineAlias(
  'visibility:collapse;',
  'collapse',
)
/**************************************************************************************************
 * Backface visibility
 *************************************************************************************************/
defineValues(
  'backface',
  'backface-visibility',
  {
    hidden: 'hidden',
    visible: 'visible',
  },
)
/**************************************************************************************************
 * Transform style
 *************************************************************************************************/
defineAlias(
  'transform-style:preserve-3d;',
  'preserve-3d',
)
defineAlias(
  'transform-style:flat;',
  'flat-3d',
)
/**************************************************************************************************
 * GPU rendering convenience
 *************************************************************************************************/
defineAlias(
  'transform:translateZ(0);backface-visibility:hidden;will-change:transform;',
  'gpu',
)
/**************************************************************************************************
 * Background attachment
 *************************************************************************************************/
defineValues(
  'bg',
  'background-attachment',
  {
    fixed: 'fixed',
    local: 'local',
    scroll: 'scroll',
  },
)
/**************************************************************************************************
 * Background clip
 *************************************************************************************************/
defineValues(
  'bg',
  'background-clip',
  {
    border: 'border-box',
    padding: 'padding-box',
    content: 'content-box',
    text: 'text',
  },
)
/**************************************************************************************************
 * Background origin
 *************************************************************************************************/
defineValues(
  'bg',
  'background-origin',
  {
    border: 'border-box',
    padding: 'padding-box',
    content: 'content-box',
  },
)
/**************************************************************************************************
 * Background position
 *************************************************************************************************/
defineValues(
  'bg',
  'background-position',
  {
    bottom: 'bottom',
    center: 'center',
    left: 'left',
    'left-bottom': 'left bottom',
    'left-top': 'left top',
    right: 'right',
    'right-bottom': 'right bottom',
    'right-top': 'right top',
    top: 'top',
  },
)
/**************************************************************************************************
 * Background repeat
 *************************************************************************************************/
defineValues(
  'bg',
  'background-repeat',
  {
    repeat: 'repeat',
    'no-repeat': 'no-repeat',
    'repeat-x': 'repeat-x',
    'repeat-y': 'repeat-y',
    round: 'round',
    space: 'space',
  },
)
/**************************************************************************************************
 * Background size
 *************************************************************************************************/
defineValues(
  'bg',
  'background-size',
  {
    auto: 'auto',
    cover: 'cover',
    contain: 'contain',
  },
)
/**************************************************************************************************
 * Border style
 *************************************************************************************************/
defineValues(
  'border',
  'border-style',
  {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
    double: 'double',
    hidden: 'hidden',
    none: 'none',
  },
)
/**************************************************************************************************
 * Radius
 *************************************************************************************************/
defineAlias(
  'border-radius:0;',
  'rounded-none',
)
defineAlias(
  'border-radius:9999px;',
  'rounded-full',
)
/**************************************************************************************************
 * Outline
 *************************************************************************************************/
defineAlias(
  'outline-style:none;',
  'outline-none',
)
defineAlias(
  'outline:2px solid transparent;outline-offset:2px;',
  'outline-hidden',
)
defineValues(
  'outline',
  'outline-style',
  {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
    double: 'double',
  },
)
/**************************************************************************************************
 * Blend modes
 *************************************************************************************************/
const blendModes: UtilityValueMap = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
}
defineValues(
  'mix-blend',
  'mix-blend-mode',
  blendModes,
)
defineValues(
  'bg-blend',
  'background-blend-mode',
  blendModes,
)
/**************************************************************************************************
 * User select
 *************************************************************************************************/
defineValues(
  'select',
  'user-select',
  {
    none: 'none',
    text: 'text',
    all: 'all',
    auto: 'auto',
  },
)
/**************************************************************************************************
 * Pointer events
 *************************************************************************************************/
defineValues(
  'pointer',
  'pointer-events',
  {
    none: 'none',
    auto: 'auto',
  },
)
defineValues(
  'pointer-events',
  'pointer-events',
  {
    none: 'none',
    auto: 'auto',
  },
)
/**************************************************************************************************
 * Resize
 *************************************************************************************************/
defineValues(
  'resize',
  'resize',
  {
    none: 'none',
    both: 'both',
    x: 'horizontal',
    y: 'vertical',
  },
)
/**************************************************************************************************
 * Touch action
 *************************************************************************************************/
defineValues(
  'touch',
  'touch-action',
  {
    auto: 'auto',
    none: 'none',
    manipulation: 'manipulation',
    'pan-x': 'pan-x',
    'pan-y': 'pan-y',
    'pan-left': 'pan-left',
    'pan-right': 'pan-right',
    'pan-up': 'pan-up',
    'pan-down': 'pan-down',
    'pinch-zoom': 'pinch-zoom',
  },
)
/**************************************************************************************************
 * Cursor
 *************************************************************************************************/
defineValues(
  'cursor',
  'cursor',
  {
    auto: 'auto',
    default: 'default',
    pointer: 'pointer',
    wait: 'wait',
    text: 'text',
    move: 'move',
    help: 'help',
    progress: 'progress',
    cell: 'cell',
    crosshair: 'crosshair',
    'not-allowed': 'not-allowed',
    'context-menu': 'context-menu',
    'vertical-text': 'vertical-text',
    alias: 'alias',
    copy: 'copy',
    'no-drop': 'no-drop',
    grab: 'grab',
    grabbing: 'grabbing',
    'all-scroll': 'all-scroll',
    'col-resize': 'col-resize',
    'row-resize': 'row-resize',
    'n-resize': 'n-resize',
    'e-resize': 'e-resize',
    's-resize': 's-resize',
    'w-resize': 'w-resize',
    'ne-resize': 'ne-resize',
    'nw-resize': 'nw-resize',
    'se-resize': 'se-resize',
    'sw-resize': 'sw-resize',
    'ew-resize': 'ew-resize',
    'ns-resize': 'ns-resize',
    'nesw-resize': 'nesw-resize',
    'nwse-resize': 'nwse-resize',
    'zoom-in': 'zoom-in',
    'zoom-out': 'zoom-out',
    none: 'none',
  },
)
/**************************************************************************************************
 * Scroll behavior
 *************************************************************************************************/
defineValues(
  'scroll',
  'scroll-behavior',
  {
    smooth: 'smooth',
    auto: 'auto',
  },
)
/**************************************************************************************************
 * Scroll snap type
 *************************************************************************************************/
defineAlias(
  'scroll-snap-type:x var(--cipo-snap-strictness,mandatory);',
  'snap-x',
)
defineAlias(
  'scroll-snap-type:y var(--cipo-snap-strictness,mandatory);',
  'snap-y',
)
defineAlias(
  'scroll-snap-type:both var(--cipo-snap-strictness,mandatory);',
  'snap-both',
)
defineAlias(
  'scroll-snap-type:none;',
  'snap-none',
)
defineAlias(
  '--cipo-snap-strictness:mandatory;',
  'snap-mandatory',
)
defineAlias(
  '--cipo-snap-strictness:proximity;',
  'snap-proximity',
)
/**************************************************************************************************
 * Scroll snap align
 *************************************************************************************************/
defineValues(
  'snap',
  'scroll-snap-align',
  {
    none: 'none',
    start: 'start',
    center: 'center',
    end: 'end',
  },
)
/**************************************************************************************************
 * Scroll snap stop
 *************************************************************************************************/
defineValues(
  'snap',
  'scroll-snap-stop',
  {
    normal: 'normal',
    always: 'always',
  },
)
/**************************************************************************************************
 * Appearance
 *************************************************************************************************/
defineValues(
  'appearance',
  'appearance',
  {
    auto: 'auto',
    none: 'none',
  },
)
/**************************************************************************************************
 * Field sizing
 *************************************************************************************************/
defineValues(
  'field-sizing',
  'field-sizing',
  {
    content: 'content',
    fixed: 'fixed',
  },
)
/**************************************************************************************************
 * Table layout
 *************************************************************************************************/
defineValues(
  'table',
  'table-layout',
  {
    auto: 'auto',
    fixed: 'fixed',
  },
)
/**************************************************************************************************
 * Border collapse
 *************************************************************************************************/
defineAlias(
  'border-collapse:collapse;',
  'border-collapse',
)
defineAlias(
  'border-collapse:separate;',
  'border-separate',
)
/**************************************************************************************************
 * Caption side
 *************************************************************************************************/
defineValues(
  'caption',
  'caption-side',
  {
    top: 'top',
    bottom: 'bottom',
  },
)
/**************************************************************************************************
 * List style
 *************************************************************************************************/
defineValues(
  'list',
  'list-style-type',
  {
    none: 'none',
    disc: 'disc',
    decimal: 'decimal',
  },
)
defineAlias(
  'list-style-position:inside;',
  'list-inside',
)
defineAlias(
  'list-style-position:outside;',
  'list-outside',
)
/**************************************************************************************************
 * Accessibility
 *************************************************************************************************/
defineAlias(
  [
    'position:absolute;',
    'width:1px;',
    'height:1px;',
    'padding:0;',
    'margin:-1px;',
    'overflow:hidden;',
    'clip:rect(0,0,0,0);',
    'white-space:nowrap;',
    'border-width:0;',
  ].join(''),
  'sr-only',
)
defineAlias(
  [
    'position:static;',
    'width:auto;',
    'height:auto;',
    'padding:0;',
    'margin:0;',
    'overflow:visible;',
    'clip:auto;',
    'white-space:normal;',
  ].join(''),
  'not-sr-only',
)
/**************************************************************************************************
 * Semantic layout aliases
 *************************************************************************************************/
defineAlias(
  'display:flex;flex-direction:column;gap:4;',
  'stack',
)
defineAlias(
  'display:flex;flex-direction:row;align-items:center;gap:4;',
  'hstack',
)
defineAlias(
  'display:flex;flex-direction:column;gap:4;',
  'vstack',
)
defineAlias(
  'display:flex;flex-wrap:wrap;align-items:center;gap:3;',
  'cluster',
)
defineAlias(
  'display:grid;gap:4;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));',
  'bento',
  'autoGrid',
)
/**************************************************************************************************
 * Cipó semantic presets
 *************************************************************************************************/
defineAlias(
  'bg:alpha($panel / 72%);border:1px solid alpha($ink / 12%);backdrop-filter:blur(18px) saturate(140%);',
  'glass',
)
defineAlias(
  'bg:alpha($panel / 86%);border:1px solid alpha($ink / 16%);backdrop-filter:blur(26px) saturate(160%);',
  'glass-strong',
)
defineAlias(
  'bg:alpha($panel / 48%);border:1px solid alpha($ink / 8%);backdrop-filter:blur(12px) saturate(120%);',
  'glass-soft',
)
defineAlias(
  [
    'transition:',
    'transform 160ms ease,',
    'background 160ms ease,',
    'border-color 160ms ease,',
    'box-shadow 160ms ease;',
    'x:hover{transform:translateY(-1px);}',
    'x:active{transform:scale(.985);}',
  ].join(''),
  'interactive',
)
defineAlias(
  'x:focus-visible{outline:2px solid $brand;outline-offset:2px;}',
  'focusRing',
)
defineAlias(
  'px:4;py:2;rounded:$md;cursor:pointer;user-select:none;display:inline-flex;align-items:center;justify-content:center;gap:2;',
  'buttonBase',
)
defineAlias(
  'size:10;rounded:$pill;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;',
  'iconButton',
)
defineAlias(
  'glass;rounded:$xl;shadow:$panel;',
  'cardSurface',
  'glassCard',
)
defineAlias(
  'bg:$panel;color:$ink;border:1px solid alpha($ink / 12%);rounded:$xl;shadow:$panel;',
  'panelSurface',
)
defineAlias(
  'bg:alpha($ink / 5%);border:1px solid alpha($ink / 8%);rounded:$lg;',
  'softSurface',
)
defineAlias(
  'text(size:xl,lh:1.05,weight:900,tracking:-0.05em,color:$ink);',
  'heroText',
)
defineAlias(
  'color:$muted;',
  'mutedText',
)
defineAlias(
  'color:$brand;text-decoration-line:none;x:hover{text-decoration-line:underline;}',
  'linkText',
)
/**************************************************************************************************
 * Public registry
 *************************************************************************************************/
/**
 * Static utility aliases resolved through direct O(1) lookup.
 *
 * Camel-case aliases already include their generated kebab-case equivalents.
 */
export const BUILT_IN_UTILITY_ALIASES:
  BuiltInUtilityAliasMap =
  Object.freeze(aliases)
/**************************************************************************************************
 * Layout compatibility registry
 *************************************************************************************************/
const BUILT_IN_LAYOUT_ALIAS_NAMES = [
  'stack',
  'hstack',
  'vstack',
  'cluster',
  'bento',
  'auto-grid',
] as const
/**
 * Semantic layout aliases kept as a compatibility surface.
 *
 * The definitions are sourced from the primary registry, so layout aliases can
 * no longer drift from aliases installed through the regular alias pipeline.
 */
export const BUILT_IN_LAYOUT_ALIASES:
  BuiltInUtilityAliasMap =
  Object.freeze(
    pickUtilityAliases(
      BUILT_IN_LAYOUT_ALIAS_NAMES,
    ),
  )
/**
 * Resolves one finite built-in utility alias.
 *
 * This resolver accepts both camel-case and kebab-case authoring names.
 */
export function resolveBuiltInUtilityAlias(
  input: string,
): string | undefined {
  const name =
    input.trim()
  if (!name) {
    return undefined
  }
  const direct =
    BUILT_IN_UTILITY_ALIASES[
      name
    ]
  if (direct !== undefined) {
    return direct
  }
  return BUILT_IN_UTILITY_ALIASES[
    toUtilityKebabCase(
      name,
    )
  ]
}
/** Picks a stable subset of aliases from the shared registry. */
function pickUtilityAliases(
  names: readonly string[],
): MutableUtilityAliasMap {
  const output:
    MutableUtilityAliasMap =
    Object.create(null) as MutableUtilityAliasMap
  for (
    let index = 0;
    index < names.length;
    index += 1
  ) {
    const name =
      names[index]!
    const css =
      aliases[name]
    if (
      css !== undefined
    ) {
      output[name] = css
    }
  }
  return output
}
