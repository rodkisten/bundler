import { runtime } from './runtime'
import type {
  CipoTheme,
  CipoThemeTypeDefinition,
  CipoThemeTypeValidationContext,
  CipoThemeValidationResult,
  CipoTypedThemeOptions,
  CipoTypedThemeValue,
} from './types'
import { splitTopLevel, toKebabMixed } from './utils'

const LENGTH_UNITS = new Set([
  'cap', 'ch', 'cm', 'cqb', 'cqh', 'cqi', 'cqmax', 'cqmin', 'cqw',
  'dvb', 'dvh', 'dvi', 'dvmax', 'dvmin', 'dvw', 'em', 'ex', 'ic',
  'in', 'lh', 'lvb', 'lvh', 'lvi', 'lvmax', 'lvmin', 'lvw', 'mm',
  'pc', 'pt', 'px', 'q', 'rcap', 'rch', 'rem', 'rex', 'ric', 'rlh',
  'svb', 'svh', 'svi', 'svmax', 'svmin', 'svw', 'vb', 'vh', 'vi',
  'vmax', 'vmin', 'vw',
])

const ANGLE_UNITS = new Set(['deg', 'grad', 'rad', 'turn'])
const TIME_UNITS = new Set(['ms', 's'])
const RESOLUTION_UNITS = new Set(['dpcm', 'dpi', 'dppx', 'x'])
const CSS_WIDE_KEYWORDS = new Set(['inherit', 'initial', 'revert', 'revert-layer', 'unset'])
const SHADOW_COLOR_FUNCTIONS = /^(?:color|color-mix|hsl|hsla|hwb|lab|lch|light-dark|oklab|oklch|rgb|rgba)\(/i
const IMAGE_FUNCTIONS = /^(?:cross-fade|element|image|image-set|linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|conic-gradient|url)\(/i
const TRANSFORM_FUNCTIONS = /^(?:matrix|matrix3d|perspective|rotate|rotate3d|rotateX|rotateY|rotateZ|scale|scale3d|scaleX|scaleY|scaleZ|skew|skewX|skewY|translate|translate3d|translateX|translateY|translateZ)\(/i
const DEFERRED_FUNCTIONS = /\b(?:attr|env|var)\s*\(/i
const MATH_FUNCTIONS = /^(?:calc|clamp|max|min)\(/i

const themeTypeRegistry = new Map<string, CipoThemeTypeDefinition>()

/** Creates a typed theme node for JS-first themes. */
export function typedTheme(
  type: string,
  value: string | number | CipoTheme,
  options: CipoTypedThemeOptions = {},
): CipoTypedThemeValue {
  return {
    kind: 'cipo.theme.typed',
    type: normalizeThemeTypeName(type),
    value,
    register: options.register ?? 'auto',
    inherits: options.inherits,
    initialValue: options.initialValue,
    validation: options.validation,
  }
}

/** Registers or replaces a semantic theme value type. */
export function defineThemeType(name: string, definition: CipoThemeTypeDefinition): void {
  const normalizedName = normalizeThemeTypeName(name)
  if (!normalizedName) throw new TypeError('Cipó theme type names cannot be empty.')

  const normalized: CipoThemeTypeDefinition = {
    ...definition,
    name: normalizedName,
    cssSyntax: definition.cssSyntax?.trim(),
    initialValue: definition.initialValue === undefined ? undefined : String(definition.initialValue),
    registrable: definition.registrable ?? Boolean(definition.cssSyntax),
    inherits: definition.inherits ?? true,
  }

  const previous = themeTypeRegistry.get(normalizedName)
  if (sameThemeTypeDefinition(previous, normalized)) return
  themeTypeRegistry.set(normalizedName, normalized)
  runtime.registryVersion += 1
}

/** Returns one registered semantic theme type. */
export function getThemeType(name: string): CipoThemeTypeDefinition | undefined {
  return themeTypeRegistry.get(normalizeThemeTypeName(name))
}

/** Returns all registered semantic theme type names. */
export function listThemeTypes(): readonly string[] {
  return Array.from(themeTypeRegistry.keys()).sort()
}

/** Validates one raw value against a registered semantic theme type. */
export function validateThemeValue(
  type: string,
  value: string | number,
  context: Partial<CipoThemeTypeValidationContext> = {},
): CipoThemeValidationResult {
  const normalizedType = normalizeThemeTypeName(type)
  const definition = themeTypeRegistry.get(normalizedType)
  const rawValue = String(value).trim()

  if (!definition) {
    return invalid(
      normalizedType,
      rawValue,
      `Unknown Cipó theme type "${normalizedType || type}".`,
      'cipo-theme-type-unknown',
    )
  }

  if (!rawValue) {
    return invalid(normalizedType, rawValue, 'Theme values cannot be empty.', 'cipo-theme-value-empty')
  }

  if (!isBalancedCssValue(rawValue)) {
    return invalid(
      normalizedType,
      rawValue,
      'The CSS value has unbalanced quotes, parentheses or brackets.',
      'cipo-theme-value-unbalanced',
    )
  }

  if (DEFERRED_FUNCTIONS.test(rawValue)) {
    return deferred(
      normalizedType,
      rawValue,
      'The final value depends on var(), env() or attr() and will be resolved by the browser.',
    )
  }

  if (!definition.validate) return valid(normalizedType, rawValue)
  return definition.validate(rawValue, {
    path: context.path ?? '',
    type: normalizedType,
    definition,
  })
}

export function isTypedThemeValue(value: unknown): value is CipoTypedThemeValue {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { readonly kind?: unknown }).kind === 'cipo.theme.typed',
  )
}

export function normalizeThemeTypeName(name: string): string {
  const source = String(name || '').trim().replace(/^<|>$/g, '')
  return toKebabMixed(source)
}

function installBuiltInThemeTypes(): void {
  addBuiltIn('any', { registrable: false, validate: validateAny })
  addBuiltIn('length', {
    cssSyntax: '<length>',
    initialValue: '0px',
    registrable: true,
    validate: value => validateDimension(value, 'length', LENGTH_UNITS, false),
  })
  addBuiltIn('size', {
    cssSyntax: '<length-percentage>',
    initialValue: '0px',
    registrable: true,
    validate: value => validateDimension(value, 'size', LENGTH_UNITS, true),
  })
  addBuiltIn('spacing', {
    cssSyntax: '<length-percentage>',
    initialValue: '0px',
    registrable: true,
    validate: value => validateDimension(value, 'spacing', LENGTH_UNITS, true),
  })
  addBuiltIn('length-percentage', {
    cssSyntax: '<length-percentage>',
    initialValue: '0px',
    registrable: true,
    validate: value => validateDimension(value, 'length-percentage', LENGTH_UNITS, true),
  })
  addBuiltIn('percentage', {
    cssSyntax: '<percentage>',
    initialValue: '0%',
    registrable: true,
    validate: validatePercentage,
  })
  addBuiltIn('percent', {
    cssSyntax: '<percentage>',
    initialValue: '0%',
    registrable: true,
    validate: validatePercentage,
  })
  addBuiltIn('number', {
    cssSyntax: '<number>',
    initialValue: '0',
    registrable: true,
    validate: validateNumber,
  })
  addBuiltIn('integer', {
    cssSyntax: '<integer>',
    initialValue: '0',
    registrable: true,
    validate: validateInteger,
  })
  addBuiltIn('angle', {
    cssSyntax: '<angle>',
    initialValue: '0deg',
    registrable: true,
    validate: value => validateDimension(value, 'angle', ANGLE_UNITS, false),
  })
  addBuiltIn('time', {
    cssSyntax: '<time>',
    initialValue: '0s',
    registrable: true,
    validate: value => validateDimension(value, 'time', TIME_UNITS, false),
  })
  addBuiltIn('resolution', {
    cssSyntax: '<resolution>',
    initialValue: '1dppx',
    registrable: true,
    validate: value => validateDimension(value, 'resolution', RESOLUTION_UNITS, false),
  })
  addBuiltIn('color', {
    cssSyntax: '<color>',
    initialValue: 'transparent',
    registrable: true,
    validate: validateColor,
  })
  addBuiltIn('shadow', {
    initialValue: 'none',
    registrable: false,
    validate: validateShadow,
  })
  addBuiltIn('transform', {
    cssSyntax: '<transform-function>+',
    initialValue: 'translateX(0px)',
    registrable: true,
    validate: validateTransform,
  })
  addBuiltIn('image', {
    cssSyntax: '<image>',
    initialValue: 'none',
    registrable: true,
    validate: validateImage,
  })
  addBuiltIn('gradient', {
    cssSyntax: '<image>',
    initialValue: 'linear-gradient(transparent, transparent)',
    registrable: true,
    validate: validateGradient,
  })
  addBuiltIn('url', {
    cssSyntax: '<url>',
    initialValue: 'url("data:,cipo")',
    registrable: true,
    validate: value => value.startsWith('url(')
      ? valid('url', value)
      : invalid('url', value, 'Expected url(...).', 'cipo-theme-url-invalid'),
  })
  addBuiltIn('custom-ident', {
    cssSyntax: '<custom-ident>',
    initialValue: 'cipo-initial',
    registrable: true,
    validate: validateCustomIdent,
  })
  addBuiltIn('easing', { registrable: false, validate: validateEasing })
  addBuiltIn('border', { registrable: false, validate: validateBorder })
  addBuiltIn('transition', { registrable: false, validate: validateNonEmptyBalanced('transition') })
  addBuiltIn('font', { registrable: false, validate: validateNonEmptyBalanced('font') })
  addBuiltIn('string', { registrable: false, validate: validateAny })
  addBuiltIn('z-index', { registrable: false, validate: validateZIndex })
}

function addBuiltIn(name: string, definition: Omit<CipoThemeTypeDefinition, 'name'>): void {
  const normalizedName = normalizeThemeTypeName(name)
  themeTypeRegistry.set(normalizedName, {
    ...definition,
    name: normalizedName,
    inherits: definition.inherits ?? true,
  })
}

function validateAny(value: string, context: CipoThemeTypeValidationContext): CipoThemeValidationResult {
  return valid(context.type, value)
}

function validateDimension(
  value: string,
  type: string,
  units: ReadonlySet<string>,
  allowPercentage: boolean,
): CipoThemeValidationResult {
  const normalized = value.trim().toLowerCase()
  if (CSS_WIDE_KEYWORDS.has(normalized)) return valid(type, value)
  if (MATH_FUNCTIONS.test(normalized)) return valid(type, value)

  const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(%)?([a-z]+)?$/i.exec(normalized)
  if (!match) {
    return invalid(type, value, `Expected a valid <${type}> CSS value.`, 'cipo-theme-dimension-invalid')
  }

  const number = Number(match[1])
  const percent = match[2]
  const unit = match[3]?.toLowerCase() ?? ''

  if (percent) {
    return allowPercentage
      ? valid(type, value)
      : invalid(type, value, `Percentages are not valid for <${type}>.`, 'cipo-theme-unit-invalid')
  }

  if (!unit) {
    return number === 0
      ? valid(type, value)
      : invalid(type, value, `Non-zero <${type}> values require a CSS unit.`, 'cipo-theme-unit-missing')
  }

  if (!units.has(unit)) {
    return invalid(type, value, `Unknown or unsupported CSS unit "${unit}".`, 'cipo-theme-unit-invalid')
  }

  return valid(type, value)
}

function validatePercentage(value: string): CipoThemeValidationResult {
  const normalized = value.trim().toLowerCase()
  if (CSS_WIDE_KEYWORDS.has(normalized) || MATH_FUNCTIONS.test(normalized)) return valid('percentage', value)
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(normalized)
    ? valid('percentage', value)
    : invalid('percentage', value, 'Expected a percentage such as 40%.', 'cipo-theme-percentage-invalid')
}

function validateNumber(value: string): CipoThemeValidationResult {
  const normalized = value.trim().toLowerCase()
  if (CSS_WIDE_KEYWORDS.has(normalized) || MATH_FUNCTIONS.test(normalized)) return valid('number', value)
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)
    ? valid('number', value)
    : invalid('number', value, 'Expected a unitless CSS number.', 'cipo-theme-number-invalid')
}

function validateInteger(value: string): CipoThemeValidationResult {
  const normalized = value.trim().toLowerCase()
  if (CSS_WIDE_KEYWORDS.has(normalized) || MATH_FUNCTIONS.test(normalized)) return valid('integer', value)
  return /^[+-]?\d+$/.test(normalized)
    ? valid('integer', value)
    : invalid('integer', value, 'Expected a unitless integer.', 'cipo-theme-integer-invalid')
}

function validateColor(value: string): CipoThemeValidationResult {
  const normalized = value.trim()
  const lower = normalized.toLowerCase()
  if (CSS_WIDE_KEYWORDS.has(lower) || lower === 'currentcolor' || lower === 'transparent') return valid('color', value)
  if (/^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(normalized)) return valid('color', value)
  if (SHADOW_COLOR_FUNCTIONS.test(normalized)) return valid('color', value)
  if (/^[a-z][a-z0-9-]*$/i.test(normalized)) return valid('color', value)
  return invalid('color', value, 'Expected a CSS color.', 'cipo-theme-color-invalid')
}

function validateShadow(value: string): CipoThemeValidationResult {
  const normalized = value.trim()
  if (normalized.toLowerCase() === 'none' || CSS_WIDE_KEYWORDS.has(normalized.toLowerCase())) {
    return valid('shadow', value)
  }

  const layers = splitTopLevel(normalized, ',')
  if (layers.length === 0) {
    return invalid('shadow', value, 'Expected one or more shadow layers.', 'cipo-theme-shadow-invalid')
  }

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const tokens = splitTopLevelWhitespace(layers[layerIndex]!)
    let lengthCount = 0
    let colorCount = 0
    let insetCount = 0

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      const token = tokens[tokenIndex]!
      const lower = token.toLowerCase()
      if (lower === 'inset') {
        insetCount += 1
        continue
      }

      const lengthResult = validateDimension(token, 'length', LENGTH_UNITS, false)
      if (lengthResult.status === 'valid') {
        lengthCount += 1
        continue
      }

      const colorResult = validateColor(token)
      if (colorResult.status === 'valid') {
        colorCount += 1
        continue
      }

      return invalid(
        'shadow',
        value,
        `Invalid shadow token "${token}" in layer ${layerIndex + 1}. ${lengthResult.reason}`,
        'cipo-theme-shadow-token-invalid',
      )
    }

    if (lengthCount < 2 || lengthCount > 4 || colorCount > 1 || insetCount > 1) {
      return invalid(
        'shadow',
        value,
        `Shadow layer ${layerIndex + 1} needs 2 to 4 lengths, at most one color and at most one inset keyword.`,
        'cipo-theme-shadow-shape-invalid',
      )
    }
  }

  return valid('shadow', value)
}

function validateTransform(value: string): CipoThemeValidationResult {
  const normalized = value.trim()
  if (normalized.toLowerCase() === 'none' || CSS_WIDE_KEYWORDS.has(normalized.toLowerCase())) {
    return valid('transform', value)
  }
  const functions = splitTopLevelWhitespace(normalized)
  return functions.length > 0 && functions.every(part => TRANSFORM_FUNCTIONS.test(part))
    ? valid('transform', value)
    : invalid('transform', value, 'Expected a CSS transform function list.', 'cipo-theme-transform-invalid')
}

function validateImage(value: string): CipoThemeValidationResult {
  const normalized = value.trim()
  if (normalized.toLowerCase() === 'none' || CSS_WIDE_KEYWORDS.has(normalized.toLowerCase())) return valid('image', value)
  return IMAGE_FUNCTIONS.test(normalized)
    ? valid('image', value)
    : invalid('image', value, 'Expected a CSS image or gradient function.', 'cipo-theme-image-invalid')
}

function validateGradient(value: string): CipoThemeValidationResult {
  const normalized = value.trim()
  return /^(?:linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient|repeating-conic-gradient|conic-gradient)\(/i.test(normalized)
    ? valid('gradient', value)
    : invalid('gradient', value, 'Expected a CSS gradient function.', 'cipo-theme-gradient-invalid')
}

function validateEasing(value: string): CipoThemeValidationResult {
  const normalized = value.trim().toLowerCase()
  if (['ease', 'ease-in', 'ease-in-out', 'ease-out', 'linear', 'step-end', 'step-start'].includes(normalized)) {
    return valid('easing', value)
  }
  return /^(?:cubic-bezier|linear|steps)\(/.test(normalized)
    ? valid('easing', value)
    : invalid('easing', value, 'Expected a CSS easing function or keyword.', 'cipo-theme-easing-invalid')
}

function validateBorder(value: string): CipoThemeValidationResult {
  const tokens = splitTopLevelWhitespace(value)
  if (tokens.length < 2) {
    return invalid('border', value, 'Expected a border width/style/color combination.', 'cipo-theme-border-invalid')
  }

  const styles = new Set(['dashed', 'dotted', 'double', 'groove', 'hidden', 'inset', 'none', 'outset', 'ridge', 'solid'])
  let hasWidth = false
  let hasStyle = false
  let hasColor = false

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (styles.has(token.toLowerCase())) { hasStyle = true; continue }
    if (validateDimension(token, 'length', LENGTH_UNITS, false).status === 'valid') { hasWidth = true; continue }
    if (validateColor(token).status === 'valid') { hasColor = true; continue }
    return invalid('border', value, `Invalid border token "${token}".`, 'cipo-theme-border-token-invalid')
  }

  return hasStyle && (hasWidth || hasColor)
    ? valid('border', value)
    : invalid('border', value, 'A border token needs a style plus a width or color.', 'cipo-theme-border-shape-invalid')
}

function validateCustomIdent(value: string): CipoThemeValidationResult {
  const normalized = value.trim()
  if (/^(?:--)?[a-z_][a-z0-9_-]*$/i.test(normalized) && !CSS_WIDE_KEYWORDS.has(normalized.toLowerCase())) {
    return valid('custom-ident', value)
  }
  return invalid('custom-ident', value, 'Expected a CSS custom identifier.', 'cipo-theme-ident-invalid')
}

function validateZIndex(value: string): CipoThemeValidationResult {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'auto') return valid('z-index', value)
  const result = validateInteger(value)
  return result.status === 'valid'
    ? valid('z-index', value)
    : invalid('z-index', value, 'Expected auto or an integer z-index.', 'cipo-theme-z-index-invalid')
}

function validateNonEmptyBalanced(type: string) {
  return (value: string): CipoThemeValidationResult => value.trim()
    ? valid(type, value)
    : invalid(type, value, `Expected a non-empty ${type} value.`, `cipo-theme-${type}-invalid`)
}

function splitTopLevelWhitespace(input: string): string[] {
  const output: string[] = []
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!
    if (quote) {
      buffer += char
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth = Math.max(0, depth - 1)

    if (/\s/.test(char) && depth === 0) {
      if (buffer.trim()) output.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += char
  }

  if (buffer.trim()) output.push(buffer.trim())
  return output
}

function isBalancedCssValue(value: string): boolean {
  let parenDepth = 0
  let bracketDepth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(') parenDepth += 1
    else if (char === ')') parenDepth -= 1
    else if (char === '[') bracketDepth += 1
    else if (char === ']') bracketDepth -= 1
    if (parenDepth < 0 || bracketDepth < 0) return false
  }

  return quote === null && parenDepth === 0 && bracketDepth === 0
}

function valid(type: string, value: string): CipoThemeValidationResult {
  return { status: 'valid', valid: true, type, value }
}

function deferred(type: string, value: string, reason: string): CipoThemeValidationResult {
  return { status: 'deferred', valid: true, type, value, reason }
}

function invalid(type: string, value: string, reason: string, code: string): CipoThemeValidationResult {
  return { status: 'invalid', valid: false, type, value, reason, code }
}

function sameThemeTypeDefinition(
  left: CipoThemeTypeDefinition | undefined,
  right: CipoThemeTypeDefinition,
): boolean {
  return Boolean(
    left &&
      left.name === right.name &&
      left.cssSyntax === right.cssSyntax &&
      left.registrable === right.registrable &&
      left.initialValue === right.initialValue &&
      left.inherits === right.inherits &&
      left.validate === right.validate,
  )
}

installBuiltInThemeTypes()
