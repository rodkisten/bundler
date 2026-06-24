import { configure } from './config'
import { insertCss } from './injection'
import { registerAlias } from './plugins'
import { property } from './properties'
import { runtime } from './runtime'
import { theme } from './theme'
import { typedTheme } from './theme-types'
import type {
  CipoConfig,
  CipoPropertyDefinition,
  CipoTheme,
  CipoTypedThemeOptions,
  CipoWarning,
} from './types'
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

type PreparedOperation =
  | { readonly kind: 'config'; readonly patch: Partial<Mutable<CipoConfig>> }
  | { readonly kind: 'theme'; readonly patch: CipoTheme }
  | { readonly kind: 'alias'; readonly name: string; readonly cssText: string }
  | { readonly kind: 'property'; readonly name: string; readonly definition: CipoPropertyDefinition }
  | { readonly kind: 'layer'; readonly cssText: string }
  | { readonly kind: 'preset'; readonly name: string }
  | { readonly kind: 'plugin'; readonly name: string }

type PreparedCssConfig = {
  readonly source: string
  readonly operations: readonly PreparedOperation[]
  readonly config: Partial<Mutable<CipoConfig>>
  readonly theme: CipoTheme
  readonly warnings: readonly CipoWarning[]
  readonly appliedAliases: readonly string[]
  readonly appliedProperties: readonly string[]
  readonly appliedPresets: readonly string[]
  readonly appliedPlugins: readonly string[]
}

type AppliedCssConfig = {
  readonly epoch: number
  readonly presetRegistryVersion: number
  readonly pluginRegistryVersion: number
  readonly configVersion: number
  readonly themeVersion: number
  readonly registryVersion: number
  readonly result: CipoCssConfigResult
}

export interface CipoCssConfigResult {
  readonly kind?: never
  readonly config: Partial<CipoConfig>
  readonly theme: CipoTheme
  readonly warnings: readonly CipoWarning[]
  readonly appliedAliases: readonly string[]
  readonly appliedProperties: readonly string[]
  readonly appliedPresets: readonly string[]
  readonly appliedPlugins: readonly string[]
}

const CONFIG_PLAN_CACHE_LIMIT = 128
const presetRegistry = new Map<string, CipoConfigPreset>()
const configPluginRegistry = new Map<string, CipoConfigPlugin>()
const preparedConfigCache = new Map<string, PreparedCssConfig>()
const appliedConfigCache = new Map<string, AppliedCssConfig>()
let applicationEpoch = 0
let presetRegistryVersion = 0
let pluginRegistryVersion = 0

/** Registers a named CSS-first preset. */
export function registerPreset(name: string, preset: CipoConfigPreset): void {
  const key = normalizeName(name)
  if (!key) return
  if (Object.is(presetRegistry.get(key), preset)) return
  presetRegistry.set(key, preset)
  presetRegistryVersion += 1
  appliedConfigCache.clear()
}

/** Registers a named CSS-first plugin callable from `@plugin name;`. */
export function registerConfigPlugin(name: string, plugin: CipoConfigPlugin): void {
  const key = normalizeName(name)
  if (!key) return
  if (Object.is(configPluginRegistry.get(key), plugin)) return
  configPluginRegistry.set(key, plugin)
  pluginRegistryVersion += 1
  appliedConfigCache.clear()
}

/**
 * Invalidates warm CSS-first configuration applications.
 *
 * @remarks
 * Runtime reset uses this to force theme/property CSS reinjection. Benchmarks can
 * additionally clear prepared plans to measure the true parser cold path.
 */
export function invalidateCssConfigApplications(options: { readonly clearPlans?: boolean } = {}): void {
  applicationEpoch += 1
  appliedConfigCache.clear()
  if (options.clearPlans) preparedConfigCache.clear()
}

/**
 * Applies a CSS-first Cipó configuration stylesheet.
 *
 * @remarks
 * Parsing and normalization are cached by exact source shape. Adjacent config
 * directives are merged into one runtime update, and an unchanged source returns
 * its previous result without clearing JIT caches or reinjecting CSS.
 */
export function configureFromCss(input: string): CipoCssConfigResult {
  const source = String(input || '')
  const applied = appliedConfigCache.get(source)

  if (
    applied &&
    applied.epoch === applicationEpoch &&
    applied.presetRegistryVersion === presetRegistryVersion &&
    applied.pluginRegistryVersion === pluginRegistryVersion &&
    applied.configVersion === runtime.configVersion &&
    applied.themeVersion === runtime.themeVersion &&
    applied.registryVersion === runtime.registryVersion
  ) {
    return applied.result
  }

  const prepared = getPreparedCssConfig(source)
  const result = applyPreparedCssConfig(prepared)

  appliedConfigCache.set(source, {
    epoch: applicationEpoch,
    presetRegistryVersion,
    pluginRegistryVersion,
    configVersion: runtime.configVersion,
    themeVersion: runtime.themeVersion,
    registryVersion: runtime.registryVersion,
    result,
  })

  return result
}

/** Tagged-template API: `Cipo.configure.css` / `configure.css`. */
export function configureCss(strings: TemplateStringsArray, ...values: readonly unknown[]): CipoCssConfigResult {
  return configureFromCss(buildTemplate(strings, values))
}

export const setupFromCss = configureFromCss
export const configSheet = configureFromCss

function getPreparedCssConfig(source: string): PreparedCssConfig {
  const cached = preparedConfigCache.get(source)
  if (cached) return cached

  const prepared = prepareCssConfig(source)
  preparedConfigCache.set(source, prepared)

  if (preparedConfigCache.size > CONFIG_PLAN_CACHE_LIMIT) {
    const oldest = preparedConfigCache.keys().next().value as string | undefined
    if (oldest !== undefined) preparedConfigCache.delete(oldest)
  }

  return prepared
}

function prepareCssConfig(source: string): PreparedCssConfig {
  const operations: PreparedOperation[] = []
  const warnings: CipoWarning[] = []
  const appliedAliases: string[] = []
  const appliedProperties: string[] = []
  const appliedPresets: string[] = []
  const appliedPlugins: string[] = []
  const configPatch: Partial<Mutable<CipoConfig>> = {}
  let themePatch: CipoTheme = {}
  let index = 0

  while (index < source.length) {
    const at = findNextAt(source, index)
    if (at < 0) break
    const nameStart = at + 1
    const nameEnd = readIdentifierEnd(source, nameStart)
    const directive = source.slice(nameStart, nameEnd)
    const cursor = skipSpaces(source, nameEnd)
    const namedBlock = readNamedBlock(source, cursor)

    if (source[cursor] === '{' || namedBlock) {
      const open = namedBlock ? namedBlock.open : cursor
      const close = findMatchingBrace(source, open)
      if (close < 0) {
        warnings.push(createWarning('cipo-config-unclosed-block', `Unclosed @${directive} block.`))
        break
      }

      const body = source.slice(open + 1, close)

      if (directive === 'cipo' || directive === 'config') {
        const patch = parseCipoBlock(body)
        mergeConfigPatch(configPatch, patch)
        operations.push({ kind: 'config', patch })
      } else if (directive === 'theme' || directive === 'tokens') {
        const patch = parseThemeBlock(body)
        themePatch = mergeTheme(themePatch, patch)
        operations.push({ kind: 'theme', patch })
      } else if (directive === 'breakpoints') {
        const patch: Partial<Mutable<CipoConfig>> = { breakpoints: parseBreakpointsBlock(body) }
        mergeConfigPatch(configPatch, patch)
        operations.push({ kind: 'config', patch })
      } else if (directive === 'alias' || directive === 'helper') {
        const aliasName = namedBlock?.name || ''
        if (aliasName) {
          operations.push({ kind: 'alias', name: aliasName, cssText: body.trim() })
          appliedAliases.push(aliasName)
        } else {
          warnings.push(createWarning('cipo-config-alias-name-missing', `@${directive} needs a name.`))
        }
      } else if (directive === 'property') {
        const rawName = namedBlock?.name || ''
        if (rawName) {
          operations.push({ kind: 'property', name: rawName, definition: parsePropertyDefinition(body) })
          appliedProperties.push(rawName)
        } else {
          warnings.push(createWarning('cipo-config-property-name-missing', '@property needs a custom property name.'))
        }
      } else {
        warnings.push(createWarning('cipo-config-unknown-directive', `Unknown CSS-first directive: @${directive}`))
      }

      index = close + 1
      continue
    }

    const statementEnd = findStatementEnd(source, cursor)
    const args = source.slice(cursor, statementEnd).trim().replace(/;$/, '').trim()

    if (directive === 'preset') {
      operations.push({ kind: 'preset', name: args })
      if (args) appliedPresets.push(args)
    } else if (directive === 'plugin') {
      operations.push({ kind: 'plugin', name: args })
      if (args) appliedPlugins.push(args)
    } else if (directive === 'layer') {
      const cssText = normalizeLayerStatement(args)
      if (cssText) operations.push({ kind: 'layer', cssText })
    }

    index = statementEnd + 1
  }

  return {
    source,
    operations,
    config: configPatch,
    theme: themePatch,
    warnings,
    appliedAliases,
    appliedProperties,
    appliedPresets,
    appliedPlugins,
  }
}

function applyPreparedCssConfig(prepared: PreparedCssConfig): CipoCssConfigResult {
  const warnings: CipoWarning[] = []
  const appliedProperties: string[] = []
  const pendingConfig: Partial<Mutable<CipoConfig>> = {}
  let pendingTheme: CipoTheme = {}
  let hasPendingConfig = false
  let hasPendingTheme = false

  const flushConfig = () => {
    if (!hasPendingConfig) return
    configure(pendingConfig as CipoConfig)
    clearObject(pendingConfig)
    hasPendingConfig = false
  }

  const flushTheme = () => {
    if (!hasPendingTheme) return
    theme(pendingTheme, warnings)
    pendingTheme = {}
    hasPendingTheme = false
  }

  for (let index = 0; index < prepared.warnings.length; index += 1) {
    const warning = prepared.warnings[index]!
    warn(runtime, warnings, warning.code, warning.message, warning.context)
  }

  for (let index = 0; index < prepared.operations.length; index += 1) {
    const operation = prepared.operations[index]!

    if (operation.kind === 'config') {
      mergeConfigPatch(pendingConfig, operation.patch)
      hasPendingConfig = true
      continue
    }

    if (operation.kind === 'theme') {
      pendingTheme = mergeTheme(pendingTheme, operation.patch)
      hasPendingTheme = true
      continue
    }

    flushConfig()

    if (operation.kind === 'alias') {
      registerAlias(operation.name, operation.cssText)
    } else if (operation.kind === 'property') {
      appliedProperties.push(property(operation.name, operation.definition))
    } else if (operation.kind === 'layer') {
      insertCss(operation.cssText)
    } else if (operation.kind === 'preset') {
      flushTheme()
      applyPreset(operation.name, warnings)
    } else if (operation.kind === 'plugin') {
      flushTheme()
      applyPlugin(operation.name, warnings)
    }
  }

  flushConfig()
  flushTheme()

  return {
    config: prepared.config,
    theme: prepared.theme,
    warnings,
    appliedAliases: prepared.appliedAliases,
    appliedProperties,
    appliedPresets: prepared.appliedPresets,
    appliedPlugins: prepared.appliedPlugins,
  }
}

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

function mergeConfigPatch(
  target: Partial<Mutable<CipoConfig>>,
  patch: Partial<Mutable<CipoConfig>>,
): void {
  for (const key in patch) {
    const typedKey = key as keyof CipoConfig
    if (typedKey === 'breakpoints') {
      target.breakpoints = { ...(target.breakpoints ?? {}), ...(patch.breakpoints ?? {}) }
      continue
    }
    ;(target as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key]
  }
}

function clearObject(target: object): void {
  const record = target as Record<string, unknown>
  for (const key in record) delete record[key]
}

function createWarning(code: string, message: string): CipoWarning {
  return { code, message }
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
    else if (key === 'color-mode' || key === 'colorMode') config.colorMode = stripQuotes(value) as NonNullable<CipoConfig['colorMode']>
    else if (key === 'dark-selector' || key === 'darkSelector') config.darkSelector = stripQuotes(value)
    else if (key === 'theme-root' || key === 'themeRootSelector') config.themeRootSelector = stripQuotes(value)
    else if (key === 'theme-validation' || key === 'themeValidation') {
      const mode = stripQuotes(value)
      if (mode === 'strict' || mode === 'warn' || mode === 'off') config.themeValidation = mode
    }
    else if (key === 'register-typed-theme-properties' || key === 'registerTypedThemeProperties') {
      config.registerTypedThemeProperties = parseBoolean(value)
    }
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
    const value = Array.isArray(entry.value)
      ? objectEntriesToTheme(entry.value)
      : stripTrailingSemicolon(entry.value)
    output[entry.key] = entry.type
      ? typedTheme(entry.type, value, entry.options)
      : value
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

type ObjectEntry = {
  key: string
  value: string | ObjectEntry[]
  type?: string
  options?: CipoTypedThemeOptions
}

function parseObjectEntries(body: string): ObjectEntry[] {
  const parts = splitTopLevelStatements(body)
  const output: ObjectEntry[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!.trim()
    if (!part) continue
    const colon = findThemeEntryColon(part)
    if (colon <= 0) continue
    const annotation = parseTypedThemeKey(part.slice(0, colon).trim().replace(/^[$]+/, ''))
    let value = stripTrailingSemicolon(part.slice(colon + 1).trim())
    const entry: ObjectEntry = value.startsWith('(') && value.endsWith(')')
      ? { ...annotation, value: parseObjectEntries(value.slice(1, -1)) }
      : { ...annotation, value }
    output.push(entry)
  }
  return output
}

function findThemeEntryColon(input: string): number {
  let structuralDepth = 0
  let annotationDepth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '(' || char === '[') { structuralDepth += 1; continue }
    if (char === ')' || char === ']') { structuralDepth = Math.max(0, structuralDepth - 1); continue }
    if (structuralDepth === 0 && char === '<') { annotationDepth += 1; continue }
    if (structuralDepth === 0 && char === '>') { annotationDepth = Math.max(0, annotationDepth - 1); continue }
    if (char === ':' && structuralDepth === 0 && annotationDepth === 0) return index
  }

  return -1
}

function parseTypedThemeKey(source: string): Pick<ObjectEntry, 'key' | 'type' | 'options'> {
  const text = source.trim()
  const open = text.lastIndexOf('<')
  if (open <= 0 || !text.endsWith('>')) return { key: toCamelSafe(text) }

  const rawName = text.slice(0, open).trim()
  const annotation = text.slice(open + 1, -1).trim()
  const parts = splitTopLevel(annotation, ',')
  const type = stripQuotes(parts.shift() || '').trim()
  if (!rawName || !type) return { key: toCamelSafe(text) }

  const options: Mutable<CipoTypedThemeOptions> = {}
  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] || '').trim()
    if (!part) continue
    if (part === 'register') options.register = true
    else if (part === 'no-register' || part === 'noregister') options.register = false
    else if (part === 'auto') options.register = 'auto'
    else {
      const colon = findTopLevelColon(part)
      if (colon <= 0) continue
      const name = toKebabMixed(part.slice(0, colon).trim())
      const value = stripQuotes(part.slice(colon + 1).trim())
      if (name === 'inherits') options.inherits = parseBoolean(value)
      else if (name === 'initial' || name === 'initial-value') options.initialValue = value
      else if (name === 'validation' && (value === 'strict' || value === 'warn' || value === 'off')) {
        options.validation = value
      }
    }
  }

  return {
    key: toCamelSafe(rawName),
    type,
    options,
  }
}

function splitTopLevelStatements(input: string): string[] {
  const output: string[] = []
  let buffer = ''
  let structuralDepth = 0
  let annotationDepth = 0
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

    if (char === '(' || char === '[') structuralDepth += 1
    else if (char === ')' || char === ']') structuralDepth = Math.max(0, structuralDepth - 1)
    else if (char === '<' && structuralDepth === 0) annotationDepth += 1
    else if (char === '>' && structuralDepth === 0) annotationDepth = Math.max(0, annotationDepth - 1)

    const isHardSeparator = char === ';' || char === '\n' || char === '\r'
    const isMapEntryComma = char === ',' && startsObjectEntryAfter(input, index + 1)
    if ((isHardSeparator || isMapEntryComma) && structuralDepth === 0 && annotationDepth === 0) {
      if (buffer.trim()) output.push(buffer.trim())
      buffer = ''
      continue
    }

    buffer += char
  }

  if (buffer.trim()) output.push(buffer.trim())
  return output
}

/**
 * Distinguishes a map separator from a comma that belongs to a CSS value.
 *
 * `md: 14px, lg: 22px` splits, while font stacks, transition lists and other
 * comma-separated CSS values stay intact until a following `name:` entry.
 */
function startsObjectEntryAfter(input: string, start: number): boolean {
  let index = start
  while (index < input.length && /\s/.test(input[index] ?? '')) index += 1
  const candidateStart = index
  let annotationDepth = 0
  let quote: '"' | "'" | null = null

  for (; index < input.length; index += 1) {
    const char = input[index]!
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '<') { annotationDepth += 1; continue }
    if (char === '>') { annotationDepth = Math.max(0, annotationDepth - 1); continue }
    if (annotationDepth > 0) continue

    if (char === ':') {
      const candidate = input.slice(candidateStart, index).trim().replace(/^[$]+/, '')
      return /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*(?:<[^>]+>)?$/.test(candidate)
    }
    if (char === ',' || char === ';' || char === '\n' || char === '\r' || char === ')') {
      return false
    }
  }

  return false
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
    if (value === undefined) continue
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
