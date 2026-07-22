import { runtime } from '../runtime'
import {
  mapResponsiveValue,
} from '../runtime-dsl/responsive'
import {
  createDeclaration,
  findTopLevelColon,
  parseFunctionCall,
  splitTopLevel,
} from '../utils'
import type { ValueNormalizer } from './contracts'
import { TEXT_SIZE_TOKENS } from './presets'

const TEXT_ALIGN_VALUES = new Set([
  'start',
  'end',
  'left',
  'right',
  'center',
  'justify',
  'match-parent',
])

const TEXT_DECORATION_VALUES = new Set([
  'none',
  'underline',
  'overline',
  'line-through',
  'blink',
])

const TEXT_TRANSFORM_VALUES = new Set([
  'none',
  'capitalize',
  'uppercase',
  'lowercase',
  'full-width',
  'full-size-kana',
])

const TEXT_WRAP_VALUES = new Set([
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'stable',
])

const TEXT_PRESET_FIELDS = [
  'size',
  'lh',
  'weight',
  'family',
  'tracking',
  'color',
] as const

/** Standard CSS named colors accepted by standalone text color shorthand. */
const NAMED_CSS_COLORS = new Set(`
aliceblue antiquewhite aqua aquamarine azure beige bisque black
blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
darkslateblue darkslategray darkslategrey darkturquoise darkviolet
deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
navajowhite navy oldlace olive olivedrab orange orangered orchid
palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff
peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
slateblue slategray slategrey snow springgreen steelblue tan teal thistle
tomato turquoise violet wheat white whitesmoke yellow yellowgreen
`.trim().split(/\s+/))

/** Creates the typography shorthand around the core value normalizer. */
export function createTextExpander(
  normalizeValue: ValueNormalizer,
): (args: string) => string {
  return function expandText(args: string): string {
    const parts = splitTopLevel(args, ',')
    const typed: Record<string, string> = {}
    let output = ''

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? ''
      const token = part.trim()
      const preset = expandTypographyPreset(token)
      if (preset) {
        output += preset
        continue
      }

      const positional = parsePositionalTypography(part)
      if (positional) {
        Object.assign(typed, positional)
        continue
      }

      const call = parseFunctionCall(part)
      const colonIndex = findTopLevelColon(part)

      if (colonIndex > 0 && !call) {
        const key = normalizeTextArgumentName(
          part.slice(0, colonIndex).trim(),
        )
        typed[key] = part.slice(colonIndex + 1).trim()
        continue
      }

      if (!token) continue
      output += expandStandaloneTextToken(token, normalizeValue)
    }

    output += expandTypedTextArguments(typed, normalizeValue)
    return output
  }
}

function parsePositionalTypography(
  input: string,
): Record<string, string> | null {
  const source = input.trim()
  if (!source) return null
  if (findTopLevelColon(source) > 0) return null

  const values = splitTopLevel(source, '/')
  if (values.length > 1) {
    if (values.length > 3) return null
    if (values.some((value) => !value.trim())) return null

    return {
      size: values[0]!.trim(),
      lh: values[1]!.trim(),
      ...(values[2] ? { weight: values[2].trim() } : {}),
    }
  }

  const call = parseFunctionCall(source)
  if (call) {
    const name = call.name.toLowerCase()
    if (name !== 'fluid' && name !== 'var' && name !== 'clamp') {
      return null
    }
    return { size: source }
  }

  return isTextSizeLike(values[0] ?? '')
    ? { size: values[0]!.trim() }
    : null
}

function isTextSizeLike(value: string): boolean {
  const source = value.trim()
  return TEXT_SIZE_TOKENS.has(source)
    || /^(?:var|clamp)\(/i.test(source)
    || /^-?\d*\.?\d+(?:[a-z%]+)?$/i.test(source)
}

function expandStandaloneTextToken(
  token: string,
  normalizeValue: ValueNormalizer,
): string {
  if (token === 'underline') {
    return createDeclaration('text-decoration-line', 'underline')
  }
  if (token === 'no-underline') {
    return createDeclaration('text-decoration-line', 'none')
  }
  if (token === 'nowrap') return createDeclaration('white-space', 'nowrap')
  if (token === 'pre' || token === 'pre-wrap' || token === 'pre-line') {
    return createDeclaration('white-space', token)
  }
  if (token === 'normal') return createDeclaration('white-space', 'normal')
  if (token === 'balance' || token === 'pretty' || token === 'stable') {
    return createDeclaration('text-wrap', token)
  }
  if (
    token === 'uppercase'
    || token === 'lowercase'
    || token === 'capitalize'
  ) {
    return createDeclaration('text-transform', token)
  }
  if (token === 'ellipsis') return expandEllipsis()
  if (token === 'tabular') {
    return createDeclaration('font-variant-numeric', 'tabular-nums')
  }
  if (token === 'slashed-zero') {
    return createDeclaration('font-variant-numeric', 'slashed-zero')
  }
  if (token === 'oldstyle') {
    return createDeclaration('font-variant-numeric', 'oldstyle-nums')
  }
  if (token === 'ligatures') {
    return createDeclaration('font-variant-ligatures', 'normal')
  }
  if (token === 'no-ligatures') {
    return createDeclaration('font-variant-ligatures', 'none')
  }
  if (isColorLike(token)) {
    return createDeclaration(
      'color',
      normalizeValue('color', token, 'color'),
    )
  }

  if (parseFunctionCall(token)?.name.toLowerCase() === 'gradient') {
    return expandTextFill(token, normalizeValue)
  }

  return ''
}

function expandTypedTextArguments(
  typed: Readonly<Record<string, string>>,
  normalizeValue: ValueNormalizer,
): string {
  let output = ''

  if (typed.size) {
    output += createDeclaration(
      'font-size',
      normalizeTextSize(typed.size, normalizeValue),
    )
  }
  if (typed.lh || typed.leading) {
    output += createDeclaration(
      'line-height',
      mapResponsiveValue(
        typed.lh ?? typed.leading ?? '',
        (value) => value,
      ),
    )
  }
  if (typed.weight) {
    output += createDeclaration(
      'font-weight',
      mapResponsiveValue(
        typed.weight,
        (value) => value,
      ),
    )
  }
  if (typed.family) {
    output += createDeclaration(
      'font-family',
      mapResponsiveValue(
        typed.family,
        (value) => normalizeValue('font-family', value),
      ),
    )
  }
  if (typed.color) {
    output += createDeclaration(
      'color',
      mapResponsiveValue(
        typed.color,
        (value) => normalizeValue('color', value, 'color'),
      ),
    )
  }
  if (typed.align && TEXT_ALIGN_VALUES.has(typed.align)) {
    output += createDeclaration('text-align', typed.align)
  }
  if (
    typed.decoration
    && TEXT_DECORATION_VALUES.has(typed.decoration)
  ) {
    output += createDeclaration(
      'text-decoration-line',
      typed.decoration,
    )
  }
  if (typed.shadow) {
    output += createDeclaration(
      'text-shadow',
      normalizeValue('text-shadow', typed.shadow, 'shadow'),
    )
  }
  if (typed.tracking) {
    output += createDeclaration(
      'letter-spacing',
      mapResponsiveValue(
        typed.tracking,
        (value) => normalizeValue('letter-spacing', value),
      ),
    )
  }

  const transform = normalizeTextTransform(
    typed.transform ?? typed.case ?? '',
  )
  if (transform) output += createDeclaration('text-transform', transform)

  if (typed.wrap && TEXT_WRAP_VALUES.has(typed.wrap)) {
    output += typed.wrap === 'nowrap'
      ? createDeclaration('white-space', 'nowrap')
      : createDeclaration('text-wrap', typed.wrap)
  }
  if (typed.fill) output += expandTextFill(typed.fill, normalizeValue)
  if (typed.ellipsis === 'true') output += expandEllipsis()
  if (typed.clamp) output += expandLineClamp(typed.clamp)
  if (typed.numeric) output += expandNumericVariant(typed.numeric)
  if (typed.ligatures) {
    output += createDeclaration(
      'font-variant-ligatures',
      typed.ligatures === 'none' ? 'none' : typed.ligatures,
    )
  }

  return output
}

function normalizeTextSize(
  input: string,
  normalizeValue: ValueNormalizer,
): string {
  return mapResponsiveValue(input, (value) => {
    if (TEXT_SIZE_TOKENS.has(value)) {
      return `var(--${runtime.config.prefix}-text-${value})`
    }
    return normalizeValue('font-size', value)
  })
}

function expandTypographyPreset(token: string): string {
  const path = readTypographyPresetPath(token)
  if (!path) return ''
  const prefix = `text-${path}`
  const keys = new Set(runtime.themeKeys)
  const hasPreset = TEXT_PRESET_FIELDS.some(
    (field) => keys.has(`${prefix}-${field}`),
  )
  if (!hasPreset) return ''

  let output = ''
  for (const field of TEXT_PRESET_FIELDS) {
    const key = `${prefix}-${field}`
    if (!keys.has(key)) continue
    const property = textPresetProperty(field)
    output += createDeclaration(
      property,
      `var(--${runtime.config.prefix}-${key})`,
    )
  }
  return output
}


function readTypographyPresetPath(token: string): string {
  if (token.startsWith('$')) {
    return token
      .slice(1)
      .replace(/^theme\./, '')
      .replace(/^text\./, '')
      .replaceAll('.', '-')
  }

  const prefix = `var(--${runtime.config.prefix}-`
  if (!token.startsWith(prefix) || !token.endsWith(')')) return ''
  const path = token.slice(prefix.length, -1)
  return path.replace(/^text-/, '')
}

function textPresetProperty(
  field: typeof TEXT_PRESET_FIELDS[number],
): string {
  if (field === 'size') return 'font-size'
  if (field === 'lh') return 'line-height'
  if (field === 'weight') return 'font-weight'
  if (field === 'family') return 'font-family'
  if (field === 'tracking') return 'letter-spacing'
  return 'color'
}

function expandEllipsis(): string {
  return [
    createDeclaration('overflow', 'hidden'),
    createDeclaration('text-overflow', 'ellipsis'),
    createDeclaration('white-space', 'nowrap'),
  ].join('')
}

function expandLineClamp(value: string): string {
  const count = value.trim()
  if (!/^\d+$/.test(count) || Number(count) <= 0) return ''
  return [
    createDeclaration('display', '-webkit-box'),
    createDeclaration('overflow', 'hidden'),
    createDeclaration('-webkit-box-orient', 'vertical'),
    createDeclaration('-webkit-line-clamp', count),
  ].join('')
}

function expandNumericVariant(value: string): string {
  const normalized = value.trim().toLowerCase()
  const variants: Record<string, string> = {
    tabular: 'tabular-nums',
    proportional: 'proportional-nums',
    oldstyle: 'oldstyle-nums',
    lining: 'lining-nums',
    'slashed-zero': 'slashed-zero',
  }
  const result = variants[normalized]
  return result
    ? createDeclaration('font-variant-numeric', result)
    : ''
}

function normalizeTextTransform(value: string): string {
  const aliases: Record<string, string> = {
    upper: 'uppercase',
    lower: 'lowercase',
  }
  const normalized = aliases[value] ?? value
  return TEXT_TRANSFORM_VALUES.has(normalized) ? normalized : ''
}

function expandTextFill(
  value: string,
  normalizeValue: ValueNormalizer,
): string {
  return [
    createDeclaration(
      'background-image',
      normalizeValue('background-image', value),
    ),
    createDeclaration('-webkit-background-clip', 'text'),
    createDeclaration('background-clip', 'text'),
    createDeclaration('color', 'transparent'),
  ].join('')
}

function normalizeTextArgumentName(name: string): string {
  const aliases: Record<string, string> = {
    'font-size': 'size',
    'line-height': 'lh',
    'font-weight': 'weight',
    'font-family': 'family',
    'letter-spacing': 'tracking',
  }
  return aliases[name] ?? name
}

function isColorLike(value: string): boolean {
  return (
    value.startsWith('$')
    || value.startsWith('#')
    || value.startsWith('rgb')
    || value.startsWith('hsl')
    || value.startsWith('oklch')
    || value.startsWith('oklab')
    || value === 'transparent'
    || value === 'currentColor'
    || NAMED_CSS_COLORS.has(value.toLowerCase())
  )
}
