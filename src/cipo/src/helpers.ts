import { DEFAULT_SPACING_VALUE } from './constants'
import { registerHelper } from './plugins'
import { runtime } from './runtime'
import type { CipoHelperContext } from './types'
import { splitTopLevel } from './utils'

/**
 * Installs built-in value helpers.
 *
 * @remarks
 * Helpers are used as normal CSS functions, no `x:` prefix required. The `x:`
 * prefix is still accepted for backwards compatibility but the promoted API is:
 * `alpha($brand / 20%)`, `gradient(linear, red, blue)`, `fluid(...)`.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * installBuiltInHelpers()
 * css`bg: alpha($brand / 20%);`
 * ```
 */
export function installBuiltInHelpers(): void {
  registerHelper('spacing', args => `calc(var(--${runtime.config.prefix}-spacing, ${DEFAULT_SPACING_VALUE}) * ${args.trim()})`)
  registerHelper('rem', args => pxToRem(args.trim()))
  registerHelper('fluid', fluidHelper)
  registerHelper('alpha', alphaHelper)
  registerHelper('mix', mixHelper)
  registerHelper('lighten', adjustLightnessHelper('lighten'))
  registerHelper('darken', adjustLightnessHelper('darken'))
  registerHelper('saturate', saturateHelper)
  registerHelper('desaturate', desaturateHelper)
  registerHelper('gradient', gradientHelper)
  registerHelper('shadow', tokenHelper('shadow'))
  registerHelper('radius', tokenHelper('radius'))
  registerHelper('text-size', tokenHelper('text'))
  registerHelper('outlineGlow', (args, context) => `0 0 0 3px ${context.resolveValue(`alpha(${args.trim() || '$brand'} / 28%)`)}`)
  registerHelper('softBorder', (args, context) => `1px solid ${context.resolveValue(args.trim() || 'alpha($ink / 12%)')}`)
}

/**
 * Converts px values to rem using runtime configuration.
 *
 * @param value - A px value.
 * @returns rem value or unchanged input.
 *
 * @example
 * ```ts
 * pxToRem('16px')
 * // '1rem'
 * ```
 */
export function pxToRem(value: string): string {
  const numeric = Number(value.replace('px', '').trim())
  if (!Number.isFinite(numeric)) return value
  const rem = numeric / runtime.config.rem.baseFontSize
  const rounded = Math.round(rem * 10000) / 10000
  return `${String(rounded).replace(/\.0+$/, '')}rem`
}

/**
 * Converts every px token in a value to rem when REM mode is enabled.
 *
 * @param value - CSS value.
 * @returns CSS value with converted px units.
 */
export function normalizePxValues(value: string): string {
  if (!runtime.config.rem.enabled) return value
  return value.replace(/(-?\d*\.?\d+)px\b/g, (_match, amount: string) => pxToRem(`${amount}px`))
}

function fluidHelper(args: string, context: CipoHelperContext): string {
  const parts = splitTopLevel(args, ',')
  const min = context.resolveValue(parts[0]?.trim() || '1rem')
  const max = context.resolveValue(parts[1]?.trim() || '2rem')
  const preferred = context.resolveValue(parts[2]?.trim() || `calc(${min} + 1vw)`)
  return `clamp(${min}, ${preferred}, ${max})`
}

function alphaHelper(args: string, context: CipoHelperContext): string {
  const parts = splitTopLevel(args, '/')
  const color = context.resolveValue(parts[0]?.trim() || 'currentColor', 'color')
  const amount = parts[1]?.trim() || '50%'
  const mode = runtime.config.colorMode
  const space = mode === 'rgba' ? 'srgb' : mode === 'hsl' ? 'hsl' : mode === 'oklab' ? 'oklab' : 'oklch'
  if (mode === 'preserve') return color
  return `color-mix(in ${space}, ${color} ${amount}, transparent)`
}

function mixHelper(args: string, context: CipoHelperContext): string {
  const parts = splitTopLevel(args, ',')
  const colorA = context.resolveValue(parts[0]?.trim() || 'currentColor', 'color')
  const colorB = context.resolveValue(parts[1]?.trim() || 'transparent', 'color')
  const amount = parts[2]?.trim() || '50%'
  const space = runtime.config.colorMode === 'hsl' ? 'hsl' : runtime.config.colorMode === 'rgba' ? 'srgb' : runtime.config.colorMode
  return `color-mix(in ${space === 'preserve' ? 'oklch' : space}, ${colorA} ${amount}, ${colorB})`
}

function adjustLightnessHelper(kind: 'lighten' | 'darken') {
  return (args: string, context: CipoHelperContext): string => {
    const parts = splitTopLevel(args, ',')
    const color = context.resolveValue(parts[0]?.trim() || 'currentColor', 'color')
    const amount = parts[1]?.trim() || '10%'
    const signed = kind === 'darken' ? `-${amount.replace(/^-/, '')}` : amount
    if (runtime.config.colorMode === 'preserve') return color
    return `oklch(from ${color} calc(l + ${signed}) c h)`
  }
}

function saturateHelper(args: string, context: CipoHelperContext): string {
  const parts = splitTopLevel(args, ',')
  const color = context.resolveValue(parts[0]?.trim() || 'currentColor', 'color')
  const amount = parts[1]?.trim() || '10%'
  return `oklch(from ${color} l calc(c + ${amount}) h)`
}

function desaturateHelper(args: string, context: CipoHelperContext): string {
  const parts = splitTopLevel(args, ',')
  const color = context.resolveValue(parts[0]?.trim() || 'currentColor', 'color')
  const amount = parts[1]?.trim() || '10%'
  return `oklch(from ${color} l calc(c - ${amount}) h)`
}

function gradientHelper(args: string, context: CipoHelperContext): string {
  const rawParts = splitTopLevel(args, ',')
  let type = 'linear'
  let startIndex = 0
  if (rawParts.length > 0) {
    const first = (rawParts[0] ?? '').trim()
    if (first === 'linear' || first === 'radial' || first === 'conic') {
      type = first
      startIndex = 1
    }
  }

  let body = ''
  for (let index = startIndex; index < rawParts.length; index += 1) {
    const value = context.resolveValue((rawParts[index] ?? '').trim(), 'color')
    if (!value) continue
    body += body ? `, ${value}` : value
  }

  if (type === 'radial') return `radial-gradient(${body})`
  if (type === 'conic') return `conic-gradient(${body})`
  return `linear-gradient(${body})`
}

function tokenHelper(namespace: string) {
  return (args: string) => `var(--${runtime.config.prefix}-${namespace}-${args.trim()})`
}
