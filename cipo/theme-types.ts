import { runtime } from './runtime'
import type {
  CipoThemeTypeDefinition,
  CipoThemeTypeValidationContext,
  CipoThemeValidationResult,
  CipoTypedThemeValue,
} from './types'

const themeTypeRegistry = new Map<string, CipoThemeTypeDefinition>()

export { typedTheme, normalizeThemeTypeName } from './theme-value'
import { normalizeThemeTypeName } from './theme-value'
import { installBuiltInThemeTypes, validateRegisteredThemeValue } from './theme-types/validation'

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
  return validateRegisteredThemeValue(
    normalizedType,
    value,
    themeTypeRegistry.get(normalizedType),
    context,
  )
}

export function isTypedThemeValue(value: unknown): value is CipoTypedThemeValue {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { readonly kind?: unknown }).kind === 'cipo.theme.typed',
  )
}


function addBuiltInThemeType(name: string, definition: Omit<CipoThemeTypeDefinition, 'name'>): void {
  const normalizedName = normalizeThemeTypeName(name)
  themeTypeRegistry.set(normalizedName, {
    ...definition,
    name: normalizedName,
    inherits: definition.inherits ?? true,
  })
}

installBuiltInThemeTypes(addBuiltInThemeType)

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

