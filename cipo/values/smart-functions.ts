import { createDeclaration, findTopLevelColon, splitTopLevel } from '../utils'
import type { TextExpander, ValueNormalizer } from './contracts'
import type { SmartNormalizationTools } from './smart-normalization'

/** Creates multi-declaration smart helper expansion without coupling it to property normalization. */
export function createSmartDeclarationExpander(
  normalizeValue: ValueNormalizer,
  expandText: TextExpander,
  normalization: Pick<SmartNormalizationTools, 'normalizeTransitionValue' | 'normalizeAnimationValue'>,
): (name: string, args: readonly string[]) => string {
  return function expandSmartDeclarationFunction(name: string, args: readonly string[]): string {
    const raw = args.join(',')
    if (name === 'h' || name === 'w') return expandSizeFunction(name, raw)
    if (name === 'pos') return expandPositionFunction(raw)
    if (name === 'grid-template') return expandGridTemplateFunction(raw)
    if (name === 'grid-flow') return createDeclaration('grid-auto-flow', normalizeValue('grid-auto-flow', raw || 'row'))
    if (name === 'text') return expandText(raw)
    if (name === 'break') return expandBreakFunction(raw)
    if (name === 'stack') return expandStackFunction(raw)
    if (name === 'cluster') return expandClusterFunction(raw)
    if (name === 'center') return expandCenterFunction(raw)
    if (name === 'cover') return expandCoverFunction(raw)
    if (name === 'sidebar') return expandSidebarFunction(raw)
    if (name === 'scroll') return expandScrollFunction(raw)
    if (name === 'scrollbar') return expandScrollbarFunction(raw)
    if (name === 'snap') return expandSnapFunction(raw)
    if (name === 'snap-item') return expandSnapItemFunction(raw)
    if (name === 'overscroll') return createDeclaration('overscroll-behavior', normalizeAllowedKeyword(raw, 'auto', OVERSCROLL_VALUES))
    if (name === 'tap') return createDeclaration('touch-action', normalizeTapValue(raw))
    if (name === 'select') return createDeclaration('user-select', normalizeAllowedKeyword(raw, 'auto', SELECT_VALUES))
    if (name === 'drag') return expandDragFunction(raw)
    if (name === 'gpu') return expandGpuFunction()
    if (name === 'focus-ring') return expandFocusRingFunction(raw)
    if (name === 'transition') return createDeclaration('transition', normalization.normalizeTransitionValue(raw))
    if (name === 'animate') return createDeclaration('animation', normalization.normalizeAnimationValue(raw))
    return ''
  }

  function expandSizeFunction(kind: string, raw: string): string {
    const parts = splitTopLevel(raw, ',')
    const property = kind === 'h' ? 'height' : 'width'
    const minProperty = kind === 'h' ? 'min-height' : 'min-width'
    const maxProperty = kind === 'h' ? 'max-height' : 'max-width'
    let output = ''
    const positional: string[] = []
    for (const partValue of parts) {
      const part = partValue.trim()
      if (!part) continue
      const colon = findTopLevelColon(part)
      if (colon > 0) {
        const key = part.slice(0, colon).trim()
        const value = part.slice(colon + 1).trim()
        if (key === 'min') output += createDeclaration(minProperty, normalizeValue(minProperty, value, 'spacing'))
        else if (key === 'max') output += createDeclaration(maxProperty, normalizeValue(maxProperty, value, 'spacing'))
        else if (key === 'value' || key === kind || key === property) output += createDeclaration(property, normalizeValue(property, value, 'spacing'))
        continue
      }
      positional.push(part)
    }
    const first = positional[0]
    if (first && first !== 'contain') output = createDeclaration(property, normalizeValue(property, first === 'fill' ? '100%' : first, 'spacing')) + output
    else if (first === 'contain') output = createDeclaration(property, 'auto') + output
    return output
  }

  function expandPositionFunction(raw: string): string {
    const parts = splitTopLevel(raw, ',')
    let output = ''
    let position = (parts[0] || 'relative').trim()
    if (position.includes(':')) position = 'relative'
    output += createDeclaration('position', position)
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]?.trim() || ''
      if (!part || (index === 0 && findTopLevelColon(part) < 0)) continue
      const colon = findTopLevelColon(part)
      if (colon > 0) {
        const key = part.slice(0, colon).trim()
        const value = part.slice(colon + 1).trim()
        const property = POSITION_PROPERTIES[key]
        if (property) output += createDeclaration(property, normalizeValue(property, value, 'spacing'))
      } else if (part === 'top' || part === 'right' || part === 'bottom' || part === 'left') {
        output += createDeclaration(part, '0')
      }
    }
    return output
  }

  function expandGridTemplateFunction(raw: string): string {
    let output = ''
    for (const partValue of splitTopLevel(raw, ',')) {
      const part = partValue.trim()
      const colon = findTopLevelColon(part)
      if (colon <= 0) continue
      const key = part.slice(0, colon).trim()
      const value = part.slice(colon + 1).trim()
      if (key === 'cols' || key === 'columns') output += createDeclaration('grid-template-columns', normalizeValue('grid-template-columns', value))
      else if (key === 'rows') output += createDeclaration('grid-template-rows', normalizeValue('grid-template-rows', value))
      else if (key === 'areas') output += createDeclaration('grid-template-areas', value)
    }
    return output
  }

  function expandBreakFunction(raw: string): string {
    const value = normalizeKeywordArg(raw, 'word')
    if (value === 'anywhere') return createDeclaration('overflow-wrap', 'anywhere')
    if (value === 'word' || value === 'words') return createDeclaration('overflow-wrap', 'break-word')
    if (value === 'all') return createDeclaration('word-break', 'break-all')
    if (value === 'keep') return createDeclaration('word-break', 'keep-all')
    return createDeclaration('word-break', value)
  }

  function expandStackFunction(raw: string): string {
    const values = parseNamedArgs(raw)
    const gap = values.gap || values.space || values.value || '4'
    return createDeclaration('display', 'flex')
      + createDeclaration('flex-direction', values.direction || 'column')
      + createDeclaration('gap', normalizeValue('gap', gap, 'spacing'))
  }

  function expandClusterFunction(raw: string): string {
    const values = parseNamedArgs(raw)
    return createDeclaration('display', 'flex')
      + createDeclaration('flex-wrap', values.wrap || 'wrap')
      + createDeclaration('align-items', values.align || values.items || 'center')
      + createDeclaration('justify-content', values.justify || 'flex-start')
      + createDeclaration('gap', normalizeValue('gap', values.gap || values.value || '3', 'spacing'))
  }

  function expandCenterFunction(raw: string): string {
    const values = parseNamedArgs(raw)
    let output = createDeclaration('box-sizing', 'content-box') + createDeclaration('margin-inline', 'auto')
    const max = values.max || values.value
    if (max) output += createDeclaration('max-width', normalizeValue('max-width', max, 'spacing'))
    if (values.px) output += createDeclaration('padding-inline', normalizeValue('padding-inline', values.px, 'spacing'))
    if (values.text === 'true' || values.text === 'center') output += createDeclaration('text-align', 'center')
    return output
  }

  function expandCoverFunction(raw: string): string {
    const values = parseNamedArgs(raw)
    const rows = [values.header || 'auto', values.main || '1fr', values.footer || 'auto'].join(' ')
    return createDeclaration('display', 'grid')
      + createDeclaration('grid-template-rows', rows)
      + createDeclaration('min-block-size', values.min || values.value || '100dvh')
  }

  function expandSidebarFunction(raw: string): string {
    const values = parseNamedArgs(raw)
    const width = values.width || values.w || values.value || '280px'
    const gap = values.gap || values._1 || '4'
    const normalizedWidth = normalizeValue('width', width, 'spacing')
    const columns = values.side === 'right' ? `minmax(0,1fr) ${normalizedWidth}` : `${normalizedWidth} minmax(0,1fr)`
    return createDeclaration('display', 'grid')
      + createDeclaration('grid-template-columns', columns)
      + createDeclaration('gap', normalizeValue('gap', gap, 'spacing'))
  }

  function expandScrollFunction(raw: string): string {
    const value = normalizeAllowedKeyword(raw, 'smooth', SCROLL_VALUES)
    return value === 'touch'
      ? createDeclaration('-webkit-overflow-scrolling', 'touch')
      : createDeclaration('scroll-behavior', value)
  }

  function expandScrollbarFunction(raw: string): string {
    return createDeclaration('scrollbar-width', normalizeAllowedKeyword(raw, 'thin', SCROLLBAR_VALUES))
  }

  function expandSnapFunction(raw: string): string {
    const parts = splitTopLevel(raw, ',')
    const axis = normalizeAllowedKeyword(parts[0] || '', 'x', SNAP_AXIS_VALUES)
    if (axis === 'none') return createDeclaration('scroll-snap-type', 'none')
    const strictness = normalizeAllowedKeyword(parts[1] || '', 'mandatory', SNAP_STRICTNESS_VALUES)
    return createDeclaration('scroll-snap-type', `${axis} ${strictness}`)
  }

  function expandSnapItemFunction(raw: string): string {
    return createDeclaration('scroll-snap-align', normalizeAllowedKeyword(raw, 'start', SNAP_ALIGN_VALUES))
  }

  function expandDragFunction(raw: string): string {
    const value = normalizeKeywordArg(raw, 'none')
    return value === 'none'
      ? createDeclaration('-webkit-user-drag', 'none') + createDeclaration('user-select', 'none')
      : createDeclaration('-webkit-user-drag', value)
  }

  function expandGpuFunction(): string {
    return createDeclaration('translate', '0 0 0')
      + createDeclaration('backface-visibility', 'hidden')
      + createDeclaration('will-change', 'transform')
  }

  function expandFocusRingFunction(raw: string): string {
    const color = normalizeValue('outline-color', raw.trim() || '$brand', 'color')
    return createDeclaration('outline', `2px solid ${color}`) + createDeclaration('outline-offset', '2px')
  }
}

function parseNamedArgs(raw: string): Record<string, string> {
  const output: Record<string, string> = Object.create(null) as Record<string, string>
  const parts = splitTopLevel(raw, ',')
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]?.trim() || ''
    if (!part) continue
    const colon = findTopLevelColon(part)
    if (colon > 0) output[part.slice(0, colon).trim()] = part.slice(colon + 1).trim()
    else output[index === 0 ? 'value' : `_${index}`] = part
  }
  return output
}

function normalizeKeywordArg(raw: string, fallback: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, '') || fallback
}

function normalizeTapValue(raw: string): string {
  const value = normalizeKeywordArg(raw, 'manipulation')
  if (value === 'none' || value === 'pan-x' || value === 'pan-y' || value === 'pinch-zoom' || value === 'auto' || value === 'manipulation') return value
  return 'manipulation'
}


const POSITION_PROPERTIES: Readonly<Record<string, string>> = Object.freeze({
  x: 'inset-inline',
  y: 'inset-block',
  inset: 'inset',
  'inset-inline': 'inset-inline',
  'inset-block': 'inset-block',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
})
const SCROLL_VALUES = new Set(['smooth', 'auto', 'touch'])
const SCROLLBAR_VALUES = new Set(['auto', 'thin', 'none'])
const OVERSCROLL_VALUES = new Set(['auto', 'contain', 'none'])
const SELECT_VALUES = new Set(['auto', 'none', 'text', 'all'])
const SNAP_AXIS_VALUES = new Set(['x', 'y', 'block', 'inline', 'both', 'none'])
const SNAP_STRICTNESS_VALUES = new Set(['mandatory', 'proximity'])
const SNAP_ALIGN_VALUES = new Set(['none', 'start', 'end', 'center'])

function normalizeAllowedKeyword(raw: string, fallback: string, allowed: ReadonlySet<string>): string {
  const value = normalizeKeywordArg(raw, fallback)
  return allowed.has(value) ? value : fallback
}
