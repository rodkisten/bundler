/* ============================================================================
 * src/cipo.ts
 * ============================================================================
 */

const STYLE_ID = 'cipo-runtime-style'
const HASH_SEED = 5381
const HASH_MASK = 0xffffffff

type Primitive = string | number | boolean | null | undefined
type CssValue = Primitive | CssArtifact | StyleObject
type CssTemplateValues = readonly CssValue[]

interface StyleObject {
  readonly [property: string]:
    | string
    | number
    | StyleObject
    | null
    | undefined
}

interface RuntimeConfig {
  readonly prefix?: string
  readonly debug?: boolean
  readonly breakpoints?: Record<string, string | null>
}

interface AtomicRule {
  readonly property: string
  readonly value: string
  readonly className: string
  readonly breakpoint?: string
  readonly pseudo?: string
}

interface ScopedRule {
  readonly selector: string
  readonly cssText: string
}

interface CssArtifact {
  readonly kind: 'cipo.css'
  readonly className: string
  readonly atoms: readonly AtomicRule[]
  readonly scopedRules: readonly ScopedRule[]
  readonly rawCss: string
  readonly compiledCss: string

  toString(): string

  [Symbol.toPrimitive](): string

  readonly [Symbol.toStringTag]: string
}

interface ThemeDefinition {
  readonly [key: string]:
    | string
    | number
    | ThemeDefinition
}

interface ParsedDeclaration {
  readonly property: string
  readonly value: string
}

interface ParsedRule {
  readonly selector: string | null
  readonly declarations: readonly ParsedDeclaration[]
  readonly nested: readonly ParsedNestedRule[]
}

interface ParsedNestedRule {
  readonly type: 'media' | 'not-media' | 'selector'
  readonly value: string
  readonly declarations: readonly ParsedDeclaration[]
}

const runtime = {
  config: {
    prefix: 'cipo',
    debug: true,
    breakpoints: {
      base: null,
      sm: null,
      md: '(min-width: 768px)',
      lg: '(min-width: 1024px)',
      xl: '(min-width: 1280px)',
    },
  } satisfies Required<RuntimeConfig>,

  insertedCss: new Set<string>(),
  atomicCache: new Map<string, AtomicRule>(),
  sheet: null as CSSStyleSheet | null,
}

/* ============================================================================
 * Public API
 * ============================================================================
 */

/**
 * Configures the Cipó runtime.
 *
 * @param config - Runtime configuration.
 * @returns Nothing.
 *
 * @example
 * ```css
 * configure({
 *   prefix: 'x',
 * })
 * ```
 */
export function configure(config: RuntimeConfig): void {
  runtime.config = {
    ...runtime.config,
    ...config,
    breakpoints: {
      ...runtime.config.breakpoints,
      ...config.breakpoints,
    },
  }
}

/**
 * Registers theme variables.
 *
 * @param tokens - Theme tokens.
 * @returns Nothing.
 *
 * @example
 * ```css
 * theme({
 *   colors: {
 *     brand: '#bada55',
 *   },
 * })
 * ```
 */
export function theme(tokens: ThemeDefinition): void {
  const declarations = flattenTheme(tokens)
    .map(([name, value]) => {
      return `--${runtime.config.prefix}-${name}:${String(value)};`
    })
    .join('')

  insertCss(`:root{${declarations}}`)
}

/**
 * Creates semantic CSS that compiles into atomic reusable classes.
 *
 * @param strings - Template strings.
 * @param values - Template interpolations.
 * @returns A CSS artifact.
 *
 * @example
 * ```css
 * const button = css`
 *   margin: x:spacing(4);
 *   color: x:alpha($theme.colors.brand / 50%);
 * `
 * ```
 */
export function css(
  strings: TemplateStringsArray,
  ...values: CssTemplateValues
): CssArtifact {
  const rawCss = buildCss(strings, values)
  const expandedCss = transformCss(rawCss)
  const parsed = parseCss(expandedCss)

  const atoms: AtomicRule[] = []
  const scopedRules: ScopedRule[] = []

  for (const rule of parsed) {
    for (const declaration of rule.declarations) {
      atoms.push(createAtomicRule(declaration))
    }

    for (const nested of rule.nested) {
      if (nested.type === 'selector') {
        scopedRules.push({
          selector: nested.value,
          cssText: nested.declarations
            .map(item => `${item.property}:${item.value};`)
            .join(''),
        })

        continue
      }

      for (const declaration of nested.declarations) {
        atoms.push(
          createAtomicRule(declaration, {
            breakpoint:
              nested.type === 'media'
                ? nested.value
                : undefined,
            notBreakpoint:
              nested.type === 'not-media'
                ? nested.value
                : undefined,
          }),
        )
      }
    }
  }

  const className = atoms
    .map(item => item.className)
    .join(' ')

  const compiledCss = buildCompiledCss(atoms, scopedRules)

  insertCss(compiledCss)

  return {
    kind: 'cipo.css',
    className,
    atoms,
    scopedRules,
    rawCss,
    compiledCss,

    toString() {
      return className
    },

    [Symbol.toPrimitive]() {
      return className
    },

    [Symbol.toStringTag]: 'CipoCssArtifact',
  }
}

/**
 * Tagged HTML template.
 *
 * @param strings - Template strings.
 * @param values - Template values.
 * @returns HTML string.
 *
 * @example
 * ```html
 * html`
 *   <button class=${button}>
 *     Save
 *   </button>
 * `
 * ```
 */
export function html(
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
): string {
  let output = ''

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index]

    if (index >= values.length) {
      continue
    }

    const value = values[index]

    if (Array.isArray(value)) {
      output += value.join('')
      continue
    }

    output += String(value ?? '')
  }

  return output
}

/**
 * Reads generated CSS.
 *
 * @returns CSS text.
 */
export function getCssText(): string {
  const style = document.getElementById(STYLE_ID)

  if (!(style instanceof HTMLStyleElement)) {
    return ''
  }

  return [
    style.textContent ?? '',
    style.sheet
      ? Array.from(style.sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Clears runtime state.
 *
 * @returns Nothing.
 */
export function reset(): void {
  runtime.insertedCss.clear()
  runtime.atomicCache.clear()
  runtime.sheet = null

  document.getElementById(STYLE_ID)?.remove()
}

/* ============================================================================
 * CSS Compiler
 * ============================================================================
 */

function buildCss(
  strings: TemplateStringsArray,
  values: CssTemplateValues,
): string {
  let output = ''

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index]

    if (index >= values.length) {
      continue
    }

    const value = values[index]

    if (isCssArtifact(value)) {
      output += value.rawCss
      continue
    }

    if (isPlainObject(value)) {
      output += styleObjectToCss(value)
      continue
    }

    output += String(value ?? '')
  }

  return output
}

function transformCss(input: string): string {
  let output = input

  output = replaceThemeTokens(output)
  output = replaceSpacingFunctions(output)
  output = replaceAlphaFunctions(output)
  output = replaceWithDirectives(output)

  return output
}

function replaceThemeTokens(input: string): string {
  return input.replace(
    /\$theme\.([a-zA-Z0-9._-]+)/g,
    (_match, tokenPath: string) => {
      return `var(--${runtime.config.prefix}-${tokenPath.replaceAll('.', '-')})`
    },
  )
}

function replaceSpacingFunctions(input: string): string {
  return input.replace(
    /x:spacing\((.*?)\)/g,
    (_match, value: string) => {
      return `calc(var(--spacing) * ${value.trim()})`
    },
  )
}

function replaceAlphaFunctions(input: string): string {
  return input.replace(
    /x:alpha\((.*?)\s*\/\s*(.*?)\)/g,
    (_match, color: string, alpha: string) => {
      return `color-mix(in oklab, ${color.trim()} ${alpha.trim()}, transparent)`
    },
  )
}

function replaceWithDirectives(input: string): string {
  return input.replace(
    /@with\(([\s\S]*?)\);?/g,
    (_match, content: string) => {
      return expandUtilities(content)
    },
  )
}

function expandUtilities(input: string): string {
  const utilities = splitTopLevel(input, ',')

  return utilities
    .map(utility => {
      const normalized = utility.trim()

      if (!normalized) {
        return ''
      }

      if (normalized.startsWith('bg(')) {
        const value = extractFunctionArguments(normalized)

        return `background:${value};`
      }

      if (normalized.startsWith('color(')) {
        const value = extractFunctionArguments(normalized)

        return `color:${value};`
      }

      if (normalized.startsWith('py(')) {
        const value = extractFunctionArguments(normalized)

        return `padding-block:${value};`
      }

      if (normalized.startsWith('px(')) {
        const value = extractFunctionArguments(normalized)

        return `padding-inline:${value};`
      }

      if (normalized.startsWith('rounded(')) {
        const value = extractFunctionArguments(normalized)

        return `border-radius:${value};`
      }

      if (normalized === 'hidden') {
        return 'display:none;'
      }

      return ''
    })
    .join('')
}

function parseCss(input: string): readonly ParsedRule[] {
  const rules: ParsedRule[] = []

  const declarations: ParsedDeclaration[] = []
  const nested: ParsedNestedRule[] = []

  const blocks = parseBlocks(input)

  for (const block of blocks) {
    if (block.type === 'declaration') {
      declarations.push(block.value)
      continue
    }

    if (block.type === 'media') {
      nested.push({
        type: 'media',
        value: block.name,
        declarations: parseDeclarations(block.body),
      })

      continue
    }

    if (block.type === 'not-media') {
      nested.push({
        type: 'not-media',
        value: block.name,
        declarations: parseDeclarations(block.body),
      })

      continue
    }

    nested.push({
      type: 'selector',
      value: block.name,
      declarations: parseDeclarations(block.body),
    })
  }

  rules.push({
    selector: null,
    declarations,
    nested,
  })

  return rules
}

function parseBlocks(input: string): Array<
  | {
      readonly type: 'declaration'
      readonly value: ParsedDeclaration
    }
  | {
      readonly type: 'media' | 'not-media' | 'selector'
      readonly name: string
      readonly body: string
    }
> {
  const output: Array<
    | {
        readonly type: 'declaration'
        readonly value: ParsedDeclaration
      }
    | {
        readonly type: 'media' | 'not-media' | 'selector'
        readonly name: string
        readonly body: string
      }
  > = []

  let buffer = ''
  let index = 0

  while (index < input.length) {
    const char = input[index]

    if (char !== '{') {
      buffer += char
      index += 1
      continue
    }

    const name = buffer.trim()
    buffer = ''

    const endIndex = findMatchingBrace(input, index)
    const body = input.slice(index + 1, endIndex)

    if (name.startsWith('x:not(')) {
      output.push({
        type: 'not-media',
        name: name
          .replace(/^x:not\(/, '')
          .replace(/\)$/, ''),
        body,
      })
    } else if (name.startsWith('x:')) {
      output.push({
        type: 'media',
        name: name.replace(/^x:/, ''),
        body,
      })
    } else {
      output.push({
        type: 'selector',
        name,
        body,
      })
    }

    index = endIndex + 1
  }

  for (const declaration of parseDeclarations(buffer)) {
    output.push({
      type: 'declaration',
      value: declaration,
    })
  }

  return output
}

function parseDeclarations(input: string): ParsedDeclaration[] {
  return splitTopLevel(input, ';')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const index = findTopLevelColon(item)

      return {
        property: item.slice(0, index).trim(),
        value: item.slice(index + 1).trim(),
      }
    })
    .filter(item => item.property && item.value)
}

/* ============================================================================
 * Atomic CSS
 * ============================================================================
 */

function createAtomicRule(
  declaration: ParsedDeclaration,
  options?: {
    readonly breakpoint?: string
    readonly notBreakpoint?: string
  },
): AtomicRule {
  const normalizedProperty = normalizeCss(declaration.property)
  const normalizedValue = normalizeCss(declaration.value)

  const cacheKey = [
    normalizedProperty,
    normalizedValue,
    options?.breakpoint ?? '',
    options?.notBreakpoint ?? '',
  ].join('|')

  const cached = runtime.atomicCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const className = [
    runtime.config.prefix,
    'a',
    hashString(cacheKey),
  ].join('-')

  const rule: AtomicRule = {
    property: declaration.property,
    value: declaration.value,
    className,
    breakpoint: options?.breakpoint,
  }

  runtime.atomicCache.set(cacheKey, rule)

  return rule
}

function buildCompiledCss(
  atoms: readonly AtomicRule[],
  scopedRules: readonly ScopedRule[],
): string {
  const output: string[] = []

  for (const atom of atoms) {
    const rule = `.${atom.className}{${atom.property}:${atom.value};}`

    if (!atom.breakpoint) {
      output.push(rule)
      continue
    }

    const mediaQuery =
      runtime.config.breakpoints[atom.breakpoint]

    if (!mediaQuery) {
      output.push(rule)
      continue
    }

    output.push(`@media ${mediaQuery}{${rule}}`)
  }

  for (const scopedRule of scopedRules) {
    output.push(`${scopedRule.selector}{${scopedRule.cssText}}`)
  }

  return output.join('\n')
}

/* ============================================================================
 * DOM
 * ============================================================================
 */

function insertCss(cssText: string): void {
  const normalized = normalizeCss(cssText)

  if (!normalized) {
    return
  }

  if (runtime.insertedCss.has(normalized)) {
    return
  }

  runtime.insertedCss.add(normalized)

  const sheet = getSheet()

  for (const rule of splitTopLevelRules(cssText)) {
    try {
      sheet.insertRule(rule, sheet.cssRules.length)
    } catch {
      ensureStyleElement().appendChild(
        document.createTextNode(`\n${rule}\n`),
      )
    }
  }
}

function getSheet(): CSSStyleSheet {
  if (runtime.sheet) {
    return runtime.sheet
  }

  const style = ensureStyleElement()
  const sheet = style.sheet

  if (!sheet) {
    throw new Error('Unable to create stylesheet.')
  }

  runtime.sheet = sheet

  return sheet
}

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ID)

  if (existing instanceof HTMLStyleElement) {
    return existing
  }

  const style = document.createElement('style')

  style.id = STYLE_ID
  style.dataset.cipo = 'runtime'

  document.head.appendChild(style)

  return style
}

/* ============================================================================
 * Utilities
 * ============================================================================
 */

function flattenTheme(
  tokens: ThemeDefinition,
  path: string[] = [],
): Array<readonly [string, string | number]> {
  return Object.entries(tokens).flatMap(([key, value]) => {
    const nextPath = [...path, key]

    if (isPlainObject(value)) {
      return flattenTheme(
        value as ThemeDefinition,
        nextPath,
      )
    }

    return [[nextPath.join('-'), value]]
  })
}

function styleObjectToCss(styleObject: StyleObject): string {
  return Object.entries(styleObject)
    .flatMap(([key, value]) => {
      if (value === null || value === undefined) {
        return []
      }

      if (isPlainObject(value)) {
        return `${key}{${styleObjectToCss(value as StyleObject)}}`
      }

      return `${toKebabCase(key)}:${String(value)};`
    })
    .join('')
}

function extractFunctionArguments(input: string): string {
  const start = input.indexOf('(')
  const end = input.lastIndexOf(')')

  return input.slice(start + 1, end).trim()
}

function splitTopLevel(
  input: string,
  separator: string,
): string[] {
  const output: string[] = []

  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      buffer += char

      if (
        char === quote &&
        input[index - 1] !== '\\'
      ) {
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }

    if (char === '(' || char === '[') {
      depth += 1
    }

    if (char === ')' || char === ']') {
      depth -= 1
    }

    if (char === separator && depth === 0) {
      output.push(buffer.trim())
      buffer = ''
      continue
    }

    buffer += char
  }

  if (buffer.trim()) {
    output.push(buffer.trim())
  }

  return output
}

function splitTopLevelRules(input: string): string[] {
  const output: string[] = []

  let start = 0
  let depth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1

      if (depth === 0) {
        output.push(
          input.slice(start, index + 1).trim(),
        )

        start = index + 1
      }
    }
  }

  return output.filter(Boolean)
}

function findMatchingBrace(
  input: string,
  startIndex: number,
): number {
  let depth = 0

  for (
    let index = startIndex;
    index < input.length;
    index += 1
  ) {
    const char = input[index]

    if (char === '{') {
      depth += 1
    }

    if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  return input.length
}

function findTopLevelColon(input: string): number {
  let depth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char === '(' || char === '[') {
      depth += 1
    }

    if (char === ')' || char === ']') {
      depth -= 1
    }

    if (char === ':' && depth === 0) {
      return index
    }
  }

  return -1
}

function normalizeCss(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .trim()
}

function hashString(input: string): string {
  let hash = HASH_SEED

  for (let index = 0; index < input.length; index += 1) {
    hash =
      ((hash << 5) + hash + input.charCodeAt(index)) &
      HASH_MASK
  }

  return Math.abs(hash).toString(36)
}

function toKebabCase(input: string): string {
  return input.replace(/[A-Z]/g, match => {
    return `-${match.toLowerCase()}`
  })
}

function isCssArtifact(value: unknown): value is CssArtifact {
  return (
    isPlainObject(value) &&
    value.kind === 'cipo.css'
  )
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}
/**
 * Browser global installer for userscript `@require` usage.
 *
 * @remarks
 * The build can expose this module as `window.FabricaHTML` or any other global
 * name through the BUILD_GLOBAL_NAME environment variable.
 *
 * @example
 * ```ts
 * installBrowserGlobal("MigosDemo");
 * console.log(window.MigosDemo.createGreeting({ name: "Rod" }));
 * ```
 */
export function installBrowserGlobal(globalName = "RodK"): void {
  const target = globalThis as typeof globalThis & Record<string, unknown>;
  target[globalName] = { configure, theme, html, css };
}
