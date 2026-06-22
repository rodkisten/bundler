import { configure } from './config'
import { insertCss } from './injection'
import { registerAlias } from './plugins'
import { property } from './properties'
import { runtime } from './runtime'
import { theme } from './theme'
import type { CipoConfig, CipoPropertyDefinition, CipoTheme, CipoWarning } from './types'
import { findMatchingBrace, findTopLevelColon, splitTopLevel, toKebabMixed, warn } from './utils'

export type CipoConfigPreset = string | (() => string | void) | CipoConfig
export type CipoConfigPlugin = (api: CipoCssConfigureApi) => string | void

export interface CipoCssConfigureApi {
  configure(config: CipoConfig): void
  theme(tokens: CipoTheme): void
  alias(name: string, cssText: string): void
  property(name: string, definition: CipoPropertyDefinition): string
  css(cssText: string): void
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

export interface CipoCssConfigResult {
  readonly config: Partial<CipoConfig>
  readonly theme: CipoTheme
  readonly warnings: readonly CipoWarning[]
  readonly appliedAliases: readonly string[]
  readonly appliedProperties: readonly string[]
  readonly appliedPresets: readonly string[]
  readonly appliedPlugins: readonly string[]
}

const presetRegistry = new Map<string, CipoConfigPreset>()
const configPluginRegistry = new Map<string, CipoConfigPlugin>()

/**
 * Registers a named CSS-first preset.
 *
 * @remarks
 * Presets are intentionally tiny: a preset can be another `@cipo` stylesheet, a
 * config object, or a function returning a stylesheet. `@preset name;` applies
 * it before the current sheet continues.
 *
 * @example
 * ```ts
 * registerPreset('alerta', `
 *   @cipo { prefix: ra; layers: true; }
 *   @theme { colors: (brand: #7dd3fc); }
 * `)
 *
 * configure.css`@preset alerta;`
 * ```
 */
export function registerPreset(name: string, preset: CipoConfigPreset): void {
  const key = normalizeName(name)
  if (!key) return
  presetRegistry.set(key, preset)
}

/** Registers a named CSS-first plugin callable from `@plugin name;`. */
export function registerConfigPlugin(name: string, plugin: CipoConfigPlugin): void {
  const key = normalizeName(name)
  if (!key) return
  configPluginRegistry.set(key, plugin)
}

/**
 * Applies a CSS-first Cipó configuration stylesheet.
 *
 * @remarks
 * This is the same engine behind `Cipo.configure.css`, `Cipo.setupFromCss` and
 * `Cipo.configSheet`. It parses bounded top-level directives and lowers them to
 * the existing JS APIs, so no current API behavior changes.
 *
 * Supported directives:
 * - `@cipo { prefix: rod; layers: true; color-mode: oklch; rem: 16px; }`
 * - `@theme { colors: (brand: #f97316); spacing: 0.25rem; }`
 * - `@tokens { ... }` as an alias of `@theme`.
 * - `@breakpoints { md: 768px; wide: (min-width: 1200px); }`
 * - `@alias glass { bg: alpha($colors.panel / 72%); }`
 * - `@helper glass { ... }` as a CSS-only alias/macro.
 * - `@property $$angle { syntax: "<angle>"; inherits: false; initial: 0deg; }`
 * - `@layer tokens, base, components, utilities;`
 * - `@preset name;` and `@plugin name;`.
 */
export function configureFromCss(input: string): CipoCssConfigResult {
  const warnings: CipoWarning[] = []
  const appliedAliases: string[] = []
  const appliedProperties: string[] = []
  const appliedPresets: string[] = []
  const appliedPlugins: string[] = []
  const configPatch: Partial<Mutable<CipoConfig>> = {}
  let themePatch: CipoTheme = {}

  const source = String(input || '')
  let index = 0

  while (index < source.length) {
    const at = findNextAt(source, index)
    if (at < 0) break
    const nameStart = at + 1
    const nameEnd = readIdentifierEnd(source, nameStart)
    const directive = source.slice(nameStart, nameEnd)
    let cursor = skipSpaces(source, nameEnd)

    const namedBlock = readNamedBlock(source, cursor)

    if (source[cursor] === '{' || namedBlock) {
      const open = namedBlock ? namedBlock.open : cursor
      const close = findMatchingBrace(source, open)
      if (close < 0) {
        warn(runtime, warnings, 'cipo-config-unclosed-block', `Unclosed @${directive} block.`)
        break
      }
      const body = source.slice(open + 1, close)

      if (directive === 'cipo' || directive === 'config') {
        Object.assign(configPatch, parseCipoBlock(body))
        configure(configPatch as CipoConfig)
      } else if (directive === 'theme' || directive === 'tokens') {
        themePatch = mergeTheme(themePatch, parseThemeBlock(body))
      } else if (directive === 'breakpoints') {
        configPatch.breakpoints = { ...(configPatch.breakpoints ?? {}), ...parseBreakpointsBlock(body) }
      } else if (directive === 'alias' || directive === 'helper') {
        const aliasName = namedBlock?.name || ''
        if (aliasName) {
          registerAlias(aliasName, body.trim())
          appliedAliases.push(aliasName)
        } else {
          warn(runtime, warnings, 'cipo-config-alias-name-missing', `@${directive} needs a name.`)
        }
      } else if (directive === 'property') {
        const rawName = namedBlock?.name || ''
        if (rawName) {
          appliedProperties.push(property(rawName, parsePropertyDefinition(body)))
        } else {
          warn(runtime, warnings, 'cipo-config-property-name-missing', '@property needs a custom property name.')
        }
      } else {
        warn(runtime, warnings, 'cipo-config-unknown-directive', `Unknown CSS-first directive: @${directive}`)
      }

      index = close + 1
      continue
    }

    const statementEnd = findStatementEnd(source, cursor)
    const args = source.slice(cursor, statementEnd).trim().replace(/;$/, '').trim()

    if (directive === 'preset') {
      applyPreset(args, warnings)
      if (args) appliedPresets.push(args)
    } else if (directive === 'plugin') {
      applyPlugin(args, warnings)
      if (args) appliedPlugins.push(args)
    } else if (directive === 'layer') {
      const cssText = normalizeLayerStatement(args)
      if (cssText) insertCss(cssText)
    }

    index = statementEnd + 1
  }

  if (Object.keys(configPatch).length > 0) configure(configPatch as CipoConfig)
  if (Object.keys(themePatch).length > 0) theme(themePatch)

  return { config: configPatch, theme: themePatch, warnings, appliedAliases, appliedProperties, appliedPresets, appliedPlugins }
}

/** Tagged-template API: `Cipo.configure.css` / `configure.css`. */
export function configureCss(strings: TemplateStringsArray, ...values: readonly unknown[]): CipoCssConfigResult {
  return configureFromCss(buildTemplate(strings, values))
}

export const setupFromCss = configureFromCss
export const configSheet = configureFromCss

function applyPreset(name: string, warnings: CipoWarning[]): void {
  const key = normalizeName(name)
  if (!key) return
  const preset = presetRegistry.get(key)
  if (!preset) {
    warn(runtime, warnings, 'cipo-config-preset-not-found', `Unknown Cipó preset: ${key}`)
    return
  }
  if (typeof preset === 'string') configureFromCss(preset)
  else if (typeof preset === 'function') {
    const result = preset()
    if (typeof result === 'string') configureFromCss(result)
  } else configure(preset)
}

function applyPlugin(name: string, warnings: CipoWarning[]): void {
  const key = normalizeName(name)
  if (!key) return
  const plugin = configPluginRegistry.get(key)
  if (!plugin) {
    warn(runtime, warnings, 'cipo-config-plugin-not-found', `Unknown Cipó config plugin: ${key}`)
    return
  }
  const result = plugin(createConfigureApi())
  if (typeof result === 'string') configureFromCss(result)
}

function createConfigureApi(): CipoCssConfigureApi {
  return {
    configure,
    theme,
    alias: registerAlias,
    property,
    css: insertCss,
  }
}

function parseCipoBlock(body: string): Partial<Mutable<CipoConfig>> {
  const entries = parseFlatDeclarationMap(body)
  const config: Partial<Mutable<CipoConfig>> = {}

  for (const key in entries) {
    const value = entries[key]!
    if (key === 'prefix') config.prefix = stripQuotes(value)
    else if (key === 'layers') config.layers = parseBoolean(value)
    else if (key === 'important') config.important = parseBoolean(value)
    else if (key === 'debug') config.debug = parseBoolean(value)
    else if (key === 'minify') config.minify = parseBoolean(value)
    else if (key === 'color-mode' || key === 'colorMode') config.colorMode = stripQuotes(value) as CipoConfig['colorMode']
    else if (key === 'dark-selector' || key === 'darkSelector') config.darkSelector = stripQuotes(value)
    else if (key === 'theme-root' || key === 'themeRootSelector') config.themeRootSelector = stripQuotes(value)
    else if (key === 'rem') config.rem = { enabled: true, baseFontSize: parseCssNumber(value, 16) }
    else if (key === 'base-font-size' || key === 'baseFontSize') config.baseFontSize = parseCssNumber(value, 16)
  }

  return config
}

function parseThemeBlock(body: string): CipoTheme {
  const entries = parseObjectEntries(body)
  return objectEntriesToTheme(entries)
}

function objectEntriesToTheme(entries: readonly ObjectEntry[]): CipoTheme {
  const output: Record<string, import('./types').CipoThemeValue> = Object.create(null)
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!
    output[entry.key] = Array.isArray(entry.value) ? objectEntriesToTheme(entry.value) : stripTrailingSemicolon(entry.value)
  }
  return output
}

function parseBreakpointsBlock(body: string): Record<string, string | null> {
  const entries = parseFlatDeclarationMap(body)
  const output: Record<string, string | null> = Object.create(null)
  for (const key in entries) output[key] = normalizeBreakpoint(entries[key]!)
  return output
}

function parsePropertyDefinition(body: string): CipoPropertyDefinition {
  const entries = parseFlatDeclarationMap(body)
  return {
    syntax: stripQuotes(entries.syntax || '*'),
    inherits: entries.inherits === undefined ? true : parseBoolean(entries.inherits),
    initialValue: entries['initial-value'] ?? entries.initial ?? '',
  }
}

function parseFlatDeclarationMap(body: string): Record<string, string> {
  const output: Record<string, string> = Object.create(null)
  const parts = splitTopLevelStatements(body)
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!.trim()
    if (!part) continue
    const colon = findTopLevelColon(part)
    if (colon <= 0) continue
    const key = toCamelSafe(part.slice(0, colon).trim().replace(/^[$]+/, ''))
    output[key] = stripTrailingSemicolon(part.slice(colon + 1).trim())
  }
  return output
}

function parseDeclarationMap(body: string): Record<string, string> {
  const entries = parseObjectEntries(body)
  const output: Record<string, string> = Object.create(null)
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!
    if (Array.isArray(entry.value)) continue
    output[entry.key] = stripTrailingSemicolon(entry.value)
  }
  return output
}

type ObjectEntry = { key: string; value: string | ObjectEntry[] }

function parseObjectEntries(body: string): ObjectEntry[] {
  const parts = splitTopLevelStatements(body)
  const output: ObjectEntry[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!.trim()
    if (!part) continue
    const colon = findTopLevelColon(part)
    if (colon <= 0) continue
    const key = toCamelSafe(part.slice(0, colon).trim().replace(/^[$]+/, ''))
    let value = stripTrailingSemicolon(part.slice(colon + 1).trim())
    if (value.startsWith('(') && value.endsWith(')')) output.push({ key, value: parseObjectEntries(value.slice(1, -1)) })
    else output.push({ key, value })
  }
  return output
}

function splitTopLevelStatements(input: string): string[] {
  const normalized = input.replace(/\n/g, ';')
  const semiParts = splitTopLevel(normalized, ';')
  const output: string[] = []
  for (let index = 0; index < semiParts.length; index += 1) {
    const part = semiParts[index] || ''
    const commaParts = splitTopLevel(part, ',')
    for (let subIndex = 0; subIndex < commaParts.length; subIndex += 1) {
      if (commaParts[subIndex]?.trim()) output.push(commaParts[subIndex]!)
    }
  }
  return output
}

function readNamedBlock(input: string, start: number): { readonly name: string; readonly open: number } | null {
  const name = readWordAfter(input, start)
  if (!name) return null
  const open = skipSpaces(input, start + name.length)
  return input[open] === '{' ? { name, open } : null
}

function mergeTheme(left: CipoTheme, right: CipoTheme): CipoTheme {
  const output: Record<string, import('./types').CipoThemeValue> = { ...left }
  for (const key in right) {
    const value = right[key]
    const previous = output[key]
    if (isThemeObject(previous) && isThemeObject(value)) output[key] = mergeTheme(previous, value)
    else output[key] = value
  }
  return output
}

function isThemeObject(value: unknown): value is CipoTheme {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !(value as { kind?: unknown }).kind)
}

function normalizeBreakpoint(value: string): string | null {
  const text = stripQuotes(value).trim()
  if (!text || text === 'null' || text === 'none' || text === 'base') return null
  if (text.startsWith('(')) return text
  return `(min-width: ${text})`
}

function normalizeLayerStatement(args: string): string {
  const text = String(args || '').trim()
  if (!text) return ''
  return `@layer ${text};`
}

function buildTemplate(strings: TemplateStringsArray, values: readonly unknown[]): string {
  let output = ''
  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index] ?? ''
    if (index < values.length) output += String(values[index] ?? '')
  }
  return output
}

function findNextAt(input: string, start: number): number {
  let quote: '"' | "'" | null = null
  for (let index = start; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '@') return index
  }
  return -1
}

function findStatementEnd(input: string, start: number): number {
  let quote: '"' | "'" | null = null
  for (let index = start; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === ';' || char === '\n' || char === '\r') return index
  }
  return input.length
}

function readWordAfter(input: string, start: number): string {
  let cursor = skipSpaces(input, start)
  const wordStart = cursor
  while (cursor < input.length && /[^\s{;]+/.test(input[cursor] || '')) cursor += 1
  return input.slice(wordStart, cursor).trim()
}

function readIdentifierEnd(input: string, start: number): number {
  let index = start
  while (index < input.length && /[a-zA-Z0-9_-]/.test(input[index] || '')) index += 1
  return index
}

function skipSpaces(input: string, start: number): number {
  let index = start
  while (index < input.length && /\s/.test(input[index] || '')) index += 1
  return index
}

function parseBoolean(value: string): boolean {
  const text = stripQuotes(value).trim().toLowerCase()
  return !(text === 'false' || text === '0' || text === 'no' || text === 'off')
}

function parseCssNumber(value: string, fallback: number): number {
  const match = /-?\d*\.?\d+/.exec(value)
  return match ? Number(match[0]) : fallback
}

function stripQuotes(value: string): string {
  const text = stripTrailingSemicolon(value).trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1)
  return text
}

function stripTrailingSemicolon(value: string): string {
  return String(value || '').trim().replace(/;+$/, '').trim()
}

function normalizeName(name: string): string {
  return String(name || '').trim().replace(/^['"]|['"]$/g, '')
}

function toCamelSafe(value: string): string {
  const text = value.trim()
  if (!text.includes('-')) return text
  return toKebabMixed(text).replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase())
}
