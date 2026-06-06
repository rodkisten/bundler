import { registerAlias, registerProperty } from './plugins'
import { runtime } from './runtime'

/**
 * Installs Cipó's built-in property aliases and utility identifiers.
 *
 * @remarks
 * This function is idempotent-ish by overwriting the same registry keys. It is
 * called during module boot so the public API is ready immediately.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * installBuiltInAliases()
 * css`px: 4; center; glass;`
 * ```
 */
export function installBuiltInAliases(): void {
  installPropertyAliases()
  installUtilityAliases()
}

/**
 * Registers Tailwind-inspired property aliases without adopting class-authoring.
 *
 * @returns Nothing.
 */
export function installPropertyAliases(): void {
  const spacing = 'spacing' as const
  const color = 'color' as const
  const radius = 'radius' as const
  const shadow = 'shadow' as const
  const none = 'none' as const

  const aliases = {
    p: ['padding', spacing], px: ['padding-inline', spacing], py: ['padding-block', spacing], ps: ['padding-inline-start', spacing], pe: ['padding-inline-end', spacing], pt: ['padding-top', spacing], pr: ['padding-right', spacing], pb: ['padding-bottom', spacing], pl: ['padding-left', spacing],
    m: ['margin', spacing], mx: ['margin-inline', spacing], my: ['margin-block', spacing], ms: ['margin-inline-start', spacing], me: ['margin-inline-end', spacing], mt: ['margin-top', spacing], mr: ['margin-right', spacing], mb: ['margin-bottom', spacing], ml: ['margin-left', spacing],
    gap: ['gap', spacing], gapx: ['column-gap', spacing], gapy: ['row-gap', spacing],
    w: ['width', spacing], h: ['height', spacing], minw: ['min-width', spacing], minh: ['min-height', spacing], maxw: ['max-width', spacing], maxh: ['max-height', spacing],
    inset: ['inset', spacing], top: ['top', spacing], right: ['right', spacing], bottom: ['bottom', spacing], left: ['left', spacing],
    bg: ['background', color], bgColor: ['background-color', color], 'bg-color': ['background-color', color], color: ['color', color], fill: ['fill', color], stroke: ['stroke', color], caret: ['caret-color', color], accent: ['accent-color', color],
    rounded: ['border-radius', radius], radius: ['border-radius', radius],
    border: ['border', color], borderColor: ['border-color', color], 'border-color': ['border-color', color],
    shadow: ['box-shadow', shadow], textShadow: ['text-shadow', shadow],
    z: ['z-index', none], lh: ['line-height', none], leading: ['line-height', none], tracking: ['letter-spacing', none], opacity: ['opacity', none], flex: ['flex', none], grid: ['grid-template-columns', none], order: ['order', none], grow: ['flex-grow', none], shrink: ['flex-shrink', none], basis: ['flex-basis', spacing],
    scale: ['scale', none], rotate: ['rotate', none], translate: ['translate', spacing], translateX: ['translate', spacing], blur: ['filter', none], backdropBlur: ['backdrop-filter', none],
    select: ['user-select', none], cursor: ['cursor', none], pointer: ['pointer-events', none], resize: ['resize', none], aspect: ['aspect-ratio', none], columns: ['columns', spacing],
  } as const

  for (const [name, [property, scale]] of Object.entries(aliases)) {
    registerProperty(name, { property, scale })
  }
}

/**
 * Registers standalone identifiers such as `flex;`, `center;`, `glass;`.
 *
 * @returns Nothing.
 */
export function installUtilityAliases(): void {
  const aliases: Record<string, string> = {
    hidden: 'display:none;',
    block: 'display:block;',
    flex: 'display:flex;',
    'inline-flex': 'display:inline-flex;',
    grid: 'display:grid;',
    relative: 'position:relative;',
    absolute: 'position:absolute;',
    fixed: 'position:fixed;',
    sticky: 'position:sticky;',
    center: 'display:flex;align-items:center;justify-content:center;',
    'items-center': 'align-items:center;',
    'justify-center': 'justify-content:center;',
    'between': 'justify-content:space-between;',
    'minw-0': 'min-width:0;',
    'minh-0': 'min-height:0;',
    truncate: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    balance: 'text-wrap:balance;',
    pretty: 'text-wrap:pretty;',
    gpu: 'transform:translateZ(0);backface-visibility:hidden;will-change:transform;',
    'absolute-fill': 'position:absolute;inset:0;',
    'absolute-center': 'position:absolute;left:50%;top:50%;transform:translate(-50%, -50%);',
    'screen-safe': 'min-height:100dvh;padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);',
    'sr-only': 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;',
    glass: 'bg: alpha($panel / 72%);border:1px solid alpha($ink / 12%);backdrop-filter:blur(18px) saturate(140%);',
    interactive: 'transition:transform 160ms ease, background 160ms ease, border-color 160ms ease;x:hover{transform:translateY(-1px);}x:active{transform:scale(.985);}',
    focusRing: 'x:focus-visible{outline:2px solid $brand;outline-offset:2px;}',
    buttonBase: 'px:4;py:2;rounded:$md;cursor:pointer;user-select:none;',
  }

  for (const [name, value] of Object.entries(aliases)) {
    registerAlias(name, value)
  }

  runtime.aliasRegistry.set('cardSurface', 'glass;rounded:$xl;shadow:$panel;')
}
