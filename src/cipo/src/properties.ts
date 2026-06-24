import { runtime } from './runtime'
import type { CipoPropertyDefinition, CipoPropertyMap, CipoTypedValue } from './types'
import { wrapLayer } from './format'
import { insertCss } from './injection'
import { normalizeValue } from './values'
import { splitTopLevel, toKebabMixed } from './utils'

/**
 * CSS Properties and Values API support for Cipó.
 *
 * @remarks
 * This module is intentionally tiny and runtime-safe. It normalizes `$$token`
 * names to prefixed CSS custom properties, dedupes `@property` registrations,
 * exposes JS-first registration helpers and powers `typed(...)` values inside
 * theme tokens and runtime custom properties.
 *
 * @example Declarative stylesheet usage
 * ```ts
 * sheet.css`
 *   @property $$angle {
 *     syntax: "<angle>"
 *     inherits: false
 *     initial: 0deg
 *   }
 *
 *   .knob { $$angle: 24deg; rotate: var(--cipo-angle); }
 * `
 * ```
 *
 * @example JS-first usage
 * ```ts
 * property('angle', { syntax: '<angle>', inherits: false, initial: '0deg' })
 * properties({ progress: { syntax: '<percentage>', initial: '0%' } })
 * ```
 *
 * @example Typed theme tokens
 * ```ts
 * theme({ knob: { angle: typed.angle('0deg') } })
 * ```
 */

const PROPERTY_SYNTAX_BY_KIND: Record<string, string> = {
  angle: '<angle>',
  number: '<number>',
  length: '<length>',
  percent: '<percentage>',
  percentage: '<percentage>',
  color: '<color>',
  time: '<time>',
  integer: '<integer>',
  transform: '<transform-list>',
  shadow: '<shadow>',
  image: '<image>',
  string: '<string>',
}

/** Registers one typed CSS custom property and injects a deduped `@property` rule. */
export function property(name: string, definition: CipoPropertyDefinition): string {
  const normalizedName = normalizeCustomPropertyName(name)
  const normalized = normalizePropertyDefinition(definition)
  const signature = propertySignature(normalizedName, normalized)

  if (runtime.registeredProperties.get(normalizedName) === signature) {
    return normalizedName
  }

  runtime.registeredProperties.set(normalizedName, signature)
  runtime.propertyDefinitions.set(normalizedName, normalized)
  insertCss(wrapPropertyCss(compilePropertyRule(normalizedName, normalized)))
  runtime.configVersion += 1
  runtime.registryVersion += 1
  return normalizedName
}

/** Registers many typed CSS custom properties. */
export function properties(definitions: CipoPropertyMap): Record<string, string> {
  const output: Record<string, string> = Object.create(null)

  for (const name in definitions) {
    const definition = definitions[name]
    if (!definition) continue
    output[name] = property(name, definition)
  }

  return output
}

/** Creates a typed token value. */
function createTypedValue(syntax: string, initialValue: string | number, inherits = true): CipoTypedValue {
  return {
    kind: 'cipo.typed',
    syntax: String(syntax || '*'),
    initialValue: String(initialValue),
    inherits: Boolean(inherits),
  }
}

const typedHelpers = {
  angle(initialValue: string | number = '0deg', inherits = true) { return createTypedValue('<angle>', initialValue, inherits) },
  number(initialValue: string | number = '0', inherits = true) { return createTypedValue('<number>', initialValue, inherits) },
  length(initialValue: string | number = '0px', inherits = true) { return createTypedValue('<length>', initialValue, inherits) },
  percent(initialValue: string | number = '0%', inherits = true) { return createTypedValue('<percentage>', initialValue, inherits) },
  percentage(initialValue: string | number = '0%', inherits = true) { return createTypedValue('<percentage>', initialValue, inherits) },
  color(initialValue: string | number = 'transparent', inherits = true) { return createTypedValue('<color>', initialValue, inherits) },
  time(initialValue: string | number = '0s', inherits = true) { return createTypedValue('<time>', initialValue, inherits) },
  integer(initialValue: string | number = '0', inherits = true) { return createTypedValue('<integer>', initialValue, inherits) },
  transform(initialValue: string | number = 'none', inherits = true) { return createTypedValue('<transform-list>', initialValue, inherits) },
  shadow(initialValue: string | number = 'none', inherits = true) { return createTypedValue('<shadow>', initialValue, inherits) },
  image(initialValue: string | number = 'none', inherits = true) { return createTypedValue('<image>', initialValue, inherits) },
  string(initialValue: string | number = '', inherits = true) { return createTypedValue('<string>', JSON.stringify(String(initialValue)), inherits) },
}

/**
 * Callable typed token factory with namespace helpers.
 *
 * @remarks
 * JavaScript functions already own a read-only `length` property, so Cipó exposes
 * `typed.length(...)` through a Proxy getter instead of mutating the function
 * object. That keeps the public API ergonomic without fighting the platform.
 */
export const typed = new Proxy(createTypedValue, {
  get(target, propertyKey, receiver) {
    if (propertyKey in typedHelpers) return typedHelpers[propertyKey as keyof typeof typedHelpers]
    return Reflect.get(target, propertyKey, receiver)
  },
}) as import('./types').CipoTypedFactory

export function isTypedValue(value: unknown): value is CipoTypedValue {
  return Boolean(value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'cipo.typed')
}

export function normalizeCustomPropertyName(name: string): string {
  const source = String(name || '').trim()
  if (!source) return `--${runtime.config.prefix}-property`
  if (source.startsWith('--')) return source
  const stripped = source.startsWith('$$') ? source.slice(2) : source
  return `--${runtime.config.prefix}-${toKebabMixed(stripped.replace(/[._]+/g, '-'))}`
}

export function customPropertyReference(name: string): string {
  return `var(${normalizeCustomPropertyName(name)})`
}

export function compilePropertyRule(name: string, definition: CipoPropertyDefinition): string {
  const normalized = normalizePropertyDefinition(definition)
  return `@property ${normalizeCustomPropertyName(name)}{syntax:${quoteSyntax(normalized.syntax)};inherits:${normalized.inherits ? 'true' : 'false'};initial-value:${normalized.initialValue};}`
}

export function compilePropertyBlock(name: string, declarations: readonly { readonly property: string; readonly value: string }[]): string {
  let syntax = ''
  let inherits = ''
  let initialValue = ''

  for (let index = 0; index < declarations.length; index += 1) {
    const declaration = declarations[index]
    const propertyName = declaration.property === 'initial' ? 'initial-value' : declaration.property
    if (propertyName === 'syntax') syntax = unquote(declaration.value.trim())
    else if (propertyName === 'inherits') inherits = declaration.value.trim()
    else if (propertyName === 'initial-value') initialValue = declaration.value.trim()
  }

  return compilePropertyRule(name, {
    syntax: syntax || '*',
    inherits: inherits ? inherits === 'true' : true,
    initialValue: initialValue || '',
  })
}

export function normalizePropertyAtRuleName(name: string): string {
  return name.replace(/^@property\s+([^\s{]+)/, (_match, rawName) => `@property ${normalizeCustomPropertyName(rawName)}`)
}

export function normalizeTypedCssValue(value: string): CipoTypedValue | null {
  const call = parseTypedCall(value)
  if (!call) return null
  const syntax = resolveTypedSyntax(call.name, call.args[0] || '')
  const initialValue = call.name === 'typed' ? call.args[1] || '' : call.args[0] || ''
  const inheritsRaw = call.name === 'typed' ? call.args[2] : call.args[1]
  return typed(syntax, stripQuotes(initialValue || ''), inheritsRaw === undefined ? true : stripQuotes(inheritsRaw).trim() !== 'false')
}

export function getTypedInitialValue(value: CipoTypedValue): string {
  return normalizeValue('theme-token', value.initialValue)
}

function normalizePropertyDefinition(definition: CipoPropertyDefinition): Required<CipoPropertyDefinition> {
  const initialValue = definition.initialValue ?? definition.initial ?? ''
  return {
    syntax: String(definition.syntax || '*'),
    inherits: definition.inherits !== false,
    initial: String(initialValue),
    initialValue: normalizeValue('theme-token', String(initialValue)),
  }
}

function propertySignature(name: string, definition: Required<CipoPropertyDefinition>): string {
  return `${name}|${definition.syntax}|${definition.inherits ? '1' : '0'}|${definition.initialValue}`
}

function wrapPropertyCss(cssText: string): string {
  return runtime.config.layers ? wrapLayer('tokens', cssText) : cssText
}

function quoteSyntax(value: string): string {
  const text = String(value || '*').trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text
  return JSON.stringify(text)
}

function unquote(value: string): string {
  return stripQuotes(value)
}

function stripQuotes(value: string): string {
  const text = String(value || '').trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1)
  return text
}

function resolveTypedSyntax(name: string, firstArg: string): string {
  if (name === 'typed') return stripQuotes(firstArg || '*')
  return PROPERTY_SYNTAX_BY_KIND[name] || '*'
}

function parseTypedCall(value: string): { readonly name: string; readonly args: readonly string[] } | null {
  const source = String(value || '').trim()
  const open = source.indexOf('(')
  if (open <= 0 || !source.endsWith(')')) return null
  const name = source.slice(0, open).trim()
  if (name !== 'typed' && !(name in PROPERTY_SYNTAX_BY_KIND)) return null
  return { name, args: splitTopLevel(source.slice(open + 1, -1), ',') }
}
