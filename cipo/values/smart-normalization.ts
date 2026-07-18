import { createOklchUtilityColor } from '../runtime-dsl'
import type { AliasScale, CipoDeclarationNode } from '../types'
import { parseFunctionCall, splitTopLevel } from '../utils'
import type { ValueNormalizer } from './contracts'
import { ANIMATION_PRESETS, TRANSITION_PRESETS } from './presets'

export interface SmartNormalizationTools {
  normalizePropertyDeclaration(property: string, rawValue: string): CipoDeclarationNode[] | null
  resolveScale(property: string, rawValue: string, fallback: AliasScale): AliasScale
  normalizePropertyValue(property: string, value: string, scale: AliasScale): string
  normalizeTransitionValue(raw: string): string
  normalizeAnimationValue(raw: string): string
}

/** Creates property/value normalization helpers around the recursive value normalizer. */
export function createSmartNormalizationTools(normalizeValue: ValueNormalizer): SmartNormalizationTools {
  function normalizePropertyDeclaration(property: string, rawValue: string): CipoDeclarationNode[] | null {
    const normalized = property.trim()
    const borderProperty = BORDER_PROPERTY_ALIASES[normalized]
    if (!borderProperty) return null
    return [{
      type: 'declaration',
      property: borderProperty,
      value: normalizeBorderValue(rawValue),
      source: `${property}:${rawValue}`,
    }]
  }

  function resolveScale(property: string, rawValue: string, fallback: AliasScale): AliasScale {
    if (
      property === 'background'
      || property === 'background-image'
      || property === 'color'
      || property.endsWith('color')
    ) return 'color'
    if ((property === 'border' || property.startsWith('border-')) && !/width|radius|style/i.test(property)) return 'color'
    if (/^(?:color|bg)-[a-z]+-[0-9]{1,3}$/.test(rawValue.trim())) return 'color'
    return fallback
  }

  function normalizePropertyValue(property: string, value: string, scale: AliasScale): string {
    const trimmed = value.trim()
    if ((property === 'background' || property === 'background-image') && trimmed.startsWith('image(')) return imageValue(trimmed)
    if ((property === 'background' || property === 'background-image') && trimmed.startsWith('gradient(')) return trimmed
    if ((property === 'background' || property === 'background-image') && /^bg-[a-z]+-[0-9]{1,3}$/.test(trimmed)) return utilityColor(trimmed.slice(3))
    if ((property === 'background' || property === 'background-image') && /^color-[a-z]+-[0-9]{1,3}$/.test(trimmed)) return utilityColor(trimmed.slice(6))
    if ((property === 'color' || property.endsWith('color')) && /^color-[a-z]+-[0-9]{1,3}$/.test(trimmed)) return utilityColor(trimmed.slice(6))
    if (isBorderShorthandProperty(property) && scale === 'color') return normalizeBorderValue(trimmed)
    if (property === 'transition') return normalizeTransitionValue(trimmed)
    if (property === 'animation') return normalizeAnimationValue(trimmed)
    return trimmed
  }

  function normalizeTransitionValue(raw: string): string {
    const parts = splitTopLevel(raw, ',')
    if (parts.length === 1) return TRANSITION_PRESETS[parts[0]?.trim() || ''] || raw
    let output = ''
    for (const part of parts) {
      const value = TRANSITION_PRESETS[part.trim()] || part.trim()
      if (value) output += output ? `, ${value}` : value
    }
    return output || raw
  }

  function normalizeAnimationValue(raw: string): string {
    return ANIMATION_PRESETS[raw.trim()] || raw
  }

  function imageValue(raw: string): string {
    const call = parseFunctionCall(raw)
    const url = call?.args.join(',').trim() || ''
    if (!url) return raw
    if (/^url\(/i.test(url)) return url
    if (/^['"]/.test(url)) return `url(${url})`
    return `url("${url.replace(/"/g, '\\"')}")`
  }

  function utilityColor(value: string): string {
    const [name, shade] = value.split('-')
    return createOklchUtilityColor(name || 'accent', Number(shade || 500))
  }

  function normalizeBorderValue(raw: string): string {
    const parts = splitTopLevel(raw.trim(), ' ')
    let width = ''
    let style = ''
    let color = ''
    for (const partValue of parts) {
      const part = partValue.trim()
      if (!part) continue
      if (!width && (/^-?\d/.test(part) || part === 'thin' || part === 'medium' || part === 'thick')) {
        width = normalizeValue('border-width', part, 'spacing')
        continue
      }
      if (!style && BORDER_STYLES.has(part)) {
        style = part
        continue
      }
      color += color ? ` ${part}` : part
    }
    if (!width) width = '1px'
    if (!style) style = 'solid'
    if (!color) color = 'currentColor'
    return `${width} ${style} ${normalizeValue('border-color', color, 'color')}`
  }

  return {
    normalizePropertyDeclaration,
    resolveScale,
    normalizePropertyValue,
    normalizeTransitionValue,
    normalizeAnimationValue,
  }
}

const BORDER_PROPERTY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  bor: 'border',
  'bor-x': 'border-inline',
  'bor-y': 'border-block',
  'bor-t': 'border-top',
  'bor-r': 'border-right',
  'bor-b': 'border-bottom',
  'bor-l': 'border-left',
})

const BORDER_STYLES = new Set([
  'none', 'hidden', 'dotted', 'dashed', 'solid', 'double',
  'groove', 'ridge', 'inset', 'outset',
])

function isBorderShorthandProperty(property: string): boolean {
  return property === 'border'
    || property === 'border-inline'
    || property === 'border-block'
    || property === 'border-top'
    || property === 'border-right'
    || property === 'border-bottom'
    || property === 'border-left'
}
