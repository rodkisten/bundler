export const BUILT_IN_UTILITY_ALIASES: Readonly<Record<string, string>> = {
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

/** Semantic layout aliases that historically bypassed registerAlias(). */
export const BUILT_IN_LAYOUT_ALIASES: Readonly<Record<string, string>> = {
  stack: 'display:flex;flex-direction:column;gap:4;',
  hstack: 'display:flex;flex-direction:row;align-items:center;gap:4;',
  vstack: 'display:flex;flex-direction:column;gap:4;',
  cluster: 'display:flex;flex-wrap:wrap;align-items:center;gap:3;',
  bento: 'display:grid;gap:4;grid-template-columns:repeat(auto-fit,minmax(min(100%, 16rem),1fr));',
  'auto-grid': 'display:grid;gap:4;grid-template-columns:repeat(auto-fit,minmax(min(100%, 16rem),1fr));',
}
