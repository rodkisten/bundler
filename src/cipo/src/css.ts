import { runtime, evictIfNeeded } from './runtime'
import type { CipoAstNode, CipoBlockNode, CipoCssArtifact, CipoCssInterpolation, CipoCssResult, CipoDeclarationNode, CipoStylesheetArtifact, CipoWarning } from './types'
import { buildCss, transformCss } from './transform'
import { parseStylesheet } from './parser'
import { addImportant, collectRules, compileCss, joinClassNames } from './compiler'
import { insertCss } from './injection'
import { hashString } from './utils'

/***************************************************************************************************
 * Public Types
 **************************************************************************************************/

/***************************************************************************************************
 * Public API
 **************************************************************************************************/

/**
 * Main polymorphic CSS tagged template.
 *
 * @remarks
 * This function keeps the old `css`` ` API intact while adding a stylesheet
 * mode.
 *
 * The detection is intentionally conservative:
 *
 * - If the template has top-level declarations, standalone aliases, or
 *   component-scoped selectors, Cipó keeps the old atomic/component behavior.
 * - If the template is made only of full top-level selectors or stylesheet
 *   at-rules, Cipó returns a stylesheet artifact whose string value is the
 *   transformed stylesheet text.
 *
 * This means nested selectors still work in component mode:
 *
 * ```ts
 * const card = css`
 *   px: 4;
 *
 *   .title {
 *     color: $brand;
 *   }
 * `
 * ```
 *
 * And full stylesheets work when the root is a stylesheet:
 *
 * ```ts
 * const sheet = css`
 *   .title {
 *     color: $brand;
 *   }
 * `
 * ```
 *
 * @param strings - Template strings.
 * @param values - Template interpolations.
 * @returns Either an atomic CSS artifact or a stylesheet artifact.
 *
 * @example Atomic/component mode
 * ```ts
 * const card = css`
 *   glass;
 *   px: 4;
 *   py: 3;
 *   bg: $panel;
 *   rounded: $xl;
 *
 *   x:hover {
 *     bg: alpha($brand / 18%);
 *   }
 * `
 *
 * String(card)
 * // "cipo-s-abc cipo-a-def cipo-a-ghi ..."
 * ```
 *
 * @example Stylesheet mode
 * ```ts
 * const sheet = css`
 *   .card {
 *     px: 4;
 *     bg: $panel;
 *
 *     &:hover {
 *       bg: alpha($brand / 18%);
 *     }
 *   }
 * `
 *
 * String(sheet)
 * // ".card { padding-inline: ... } .card:hover { background: ... }"
 * ```
 *
 * @example Explicit global stylesheet
 * ```ts
 * const sheet = css`
 *   :root {
 *     --app-radius: 16px;
 *   }
 *
 *   body {
 *     margin: 0;
 *   }
 * `
 *
 * String(sheet)
 * // ":root { --app-radius: 1rem; } body { margin: 0; }"
 * ```
 */
export function css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssResult {
  return compilePolymorphicCss(strings, values, false)
}

Object.assign(css, {
  withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssResult {
    return compilePolymorphicCss(strings, values, true)
  },
})

/**
 * Explicit atomic CSS namespace.
 *
 * @remarks
 * `atomic.css``...`` ` always returns a class-list artifact and injects generated
 * atomic rules. It skips stylesheet detection for maximum runtime predictability.
 *
 * @example
 * ```ts
 * const card = atomic.css`
 *   px: 4
 *   bg: $brand
 * `
 * String(card)
 * // "cipo-a-..."
 * ```
 */
export const atomic = {
  css: Object.assign(
    function atomicCss(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssArtifact {
      return compileAtomicCss(strings, values, false)
    },
    {
      withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssArtifact {
        return compileAtomicCss(strings, values, true)
      },
    },
  ),
}

/**
 * Explicit stylesheet namespace.
 *
 * @remarks
 * `sheet.css``...`` ` compiles a complete stylesheet and returns CSS text. It
 * preserves selectors, supports nesting, expands aliases/helpers/tokens and does
 * not atomize declarations.
 *
 * @example
 * ```ts
 * const styleText = sheet.css`
 *   :root { $$panel: rgb(0 0 0 / .8) }
 *   .card { $glassCard; x:hover { bg: alpha($brand / 20%) } }
 * `
 * String(styleText)
 * // complete transformed CSS
 * ```
 */
export const sheet = {
  css: Object.assign(
    function sheetCss(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
      return compileSheetCss(strings, values, false)
    },
    {
      withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
        return compileSheetCss(strings, values, true)
      },
      insertInto(target: HTMLElement | ShadowRoot | Document) {
        return Object.assign(
          function sheetCssInto(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
            const artifact = compileSheetCss(strings, values, false)
            injectSheetInto(target, artifact.cssText)
            return artifact
          },
          {
            withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
              const artifact = compileSheetCss(strings, values, true)
              injectSheetInto(target, artifact.cssText)
              return artifact
            },
          },
        )
      },
      scoped(selector: string) {
        return Object.assign(
          function scopedSheetCss(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
            return compileScopedSheetCss(selector, strings, values, false)
          },
          {
            withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
              return compileScopedSheetCss(selector, strings, values, true)
            },
          },
        )
      },
      layer(name: string) {
        return Object.assign(
          function layerSheetCss(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
            return wrapSheetLayer(name, compileSheetCss(strings, values, false))
          },
          {
            withImportant(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
              return wrapSheetLayer(name, compileSheetCss(strings, values, true))
            },
          },
        )
      },
      debug(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoStylesheetArtifact {
        const artifact = compileSheetCss(strings, values, false)
        if (runtime.config.debug && typeof console !== 'undefined') console.debug('[Cipo sheet]', artifact.debug)
        return artifact
      },
    },
  ),
}

/**
 * Compiles the legacy polymorphic css`` API.
 *
 * @param strings - Template strings.
 * @param values - Template values.
 * @param important - Whether to force a single !important on every declaration.
 * @returns CSS result.
 */
function compilePolymorphicCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoCssResult {
  const rawCss = buildCss(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'important' : 'auto')
  const cached = getCachedArtifact(cacheKey)

  if (cached) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)

  if (shouldCompileAsStylesheet(rawCss, transformedCss, ast)) {
    const artifact = createStylesheetArtifact(rawCss, transformedCss, ast, warnings, important)
    setCachedArtifact(cacheKey, artifact)
    return artifact
  }

  const artifact = createAtomicArtifact(rawCss, transformedCss, ast, warnings, important)
  insertCss(artifact.compiledCss)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}

/**
 * Compiles explicit atomic CSS.
 *
 * @param strings - Template strings.
 * @param values - Template values.
 * @param important - Whether to force important declarations.
 * @returns Atomic artifact.
 */
function compileAtomicCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoCssArtifact {
  const rawCss = buildCss(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'atomic-important' : 'atomic')
  const cached = getCachedArtifact(cacheKey)

  if (cached && isAtomicCssArtifact(cached)) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createAtomicArtifact(rawCss, transformedCss, ast, warnings, important)

  insertCss(artifact.compiledCss)
  setCachedArtifact(cacheKey, artifact)
  return artifact
}

/**
 * Compiles explicit full stylesheet CSS.
 *
 * @param strings - Template strings.
 * @param values - Template values.
 * @param important - Whether to force important declarations.
 * @returns Stylesheet artifact.
 */
function compileSheetCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoStylesheetArtifact {
  const rawCss = buildCss(strings, values)
  const cacheKey = createArtifactCacheKey(rawCss, important ? 'sheet-important' : 'sheet')
  const cached = getCachedArtifact(cacheKey)

  if (cached && isStylesheetArtifact(cached)) return cached

  const warnings: CipoWarning[] = []
  const transformedCss = transformCss(rawCss, warnings)
  const ast = parseStylesheet(transformedCss, warnings)
  const artifact = createStylesheetArtifact(rawCss, transformedCss, ast, warnings, important)

  setCachedArtifact(cacheKey, artifact)
  return artifact
}



function compileScopedSheetCss(selector: string, strings: TemplateStringsArray, values: readonly CipoCssInterpolation[], important: boolean): CipoStylesheetArtifact {
  const rawCss = buildCss(strings, values);
  const scopedSource = `${selector}{${rawCss}}`;
  const cacheKey = createArtifactCacheKey(scopedSource, important ? 'sheet-scoped-important' : 'sheet-scoped');
  const cached = getCachedArtifact(cacheKey);
  if (cached && isStylesheetArtifact(cached)) return cached;
  const warnings: CipoWarning[] = [];
  const transformedCss = transformCss(scopedSource, warnings);
  const ast = parseStylesheet(transformedCss, warnings);
  const artifact = createStylesheetArtifact(rawCss, transformedCss, ast, warnings, important);
  setCachedArtifact(cacheKey, artifact);
  return artifact;
}

function wrapSheetLayer(name: string, artifact: CipoStylesheetArtifact): CipoStylesheetArtifact {
  const safeName = String(name || 'components').replace(/[^a-zA-Z0-9_.-]/g, '');
  const cssText = `@layer ${safeName}{${artifact.cssText}}`;
  return {
    ...artifact,
    cssText: formatStylesheetText(cssText),
    debug: { ...artifact.debug, mode: 'stylesheet' as const },
    toString: () => formatStylesheetText(cssText),
    [Symbol.toPrimitive]: () => formatStylesheetText(cssText),
  };
}

/**
 * Creates the JIT cache key for a CSS artifact.
 *
 * @remarks
 * The key includes config/theme versions and output settings because the same
 * source can compile differently after theme, prefix, important or minify
 * changes.
 *
 * @param rawCss - Raw source.
 * @returns Stable cache key.
 *
 * @example
 * ```ts
 * createArtifactCacheKey('px: 4;')
 * // "12|3|cipo||pretty|px: 4;"
 * ```
 */
export function createArtifactCacheKey(rawCss: string, mode = ''): string {
  return [
    runtime.configVersion,
    runtime.themeVersion,
    runtime.config.prefix,
    runtime.config.important ? 'important' : '',
    runtime.config.minify ? 'min' : 'pretty',
    mode,
    rawCss,
  ].join('|')
}


/**
 * Checks whether a css`` result is an atomic/class-list artifact.
 *
 * @param artifact - Polymorphic css result.
 * @returns Whether the artifact can be used as a class list.
 *
 * @example
 * ```ts
 * const result = css`px: 4;`
 * if (isAtomicCssArtifact(result)) {
 *   result.className
 * }
 * ```
 */
export function isAtomicCssArtifact(artifact: CipoCssResult): artifact is CipoCssArtifact {
  return artifact.kind === 'cipo.css'
}

/**
 * Asserts that a polymorphic css`` result is safe for styled/component APIs.
 *
 * @remarks
 * Styled APIs require a class-list artifact. Passing a full stylesheet such as
 * `.card { ... }` would not produce a className, so this function throws a clear
 * runtime error instead of failing with `undefined` later.
 *
 * @param artifact - Polymorphic css result.
 * @returns Atomic CSS artifact.
 */
export function assertAtomicCssArtifact(artifact: CipoCssResult): CipoCssArtifact {
  if (isAtomicCssArtifact(artifact)) return artifact

  throw new TypeError('Cipó styled APIs require declaration/component CSS. Full stylesheets return CSS text and cannot be used as className artifacts.')
}

/**
 * Checks whether a css`` result is a stylesheet artifact.
 *
 * @param artifact - Polymorphic css result.
 * @returns Whether the artifact stringifies to stylesheet text.
 */
export function isStylesheetArtifact(artifact: CipoCssResult): artifact is CipoStylesheetArtifact {
  return artifact.kind === 'cipo.stylesheet'
}

/***************************************************************************************************
 * Artifact Creation
 **************************************************************************************************/

/**
 * Creates the legacy atomic/component artifact.
 *
 * @param rawCss - Raw source.
 * @param transformedCss - Transformed source.
 * @param ast - Parsed AST.
 * @param warnings - Compilation warnings.
 * @returns Atomic CSS artifact.
 */
function createAtomicArtifact(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
  warnings: readonly CipoWarning[],
  forceImportant = false,
): CipoCssArtifact {
  const mutableWarnings = [...warnings]
  const scopeClassName = `${runtime.config.prefix}-s-${hashString(transformedCss)}`
  const previousImportant = runtime.config.important
  runtime.config.important = previousImportant || forceImportant
  const { atoms, scopedRules } = collectRules(ast, scopeClassName, mutableWarnings)
  const className = joinClassNames(atoms, scopedRules.length > 0 ? scopeClassName : '')
  const compiledCss = compileCss(atoms, scopedRules)
  runtime.config.important = previousImportant
  const artifactId = `${runtime.config.prefix}-artifact-${hashString(rawCss)}`

  return {
    kind: 'cipo.css',
    className,
    scopeClassName,
    atoms,
    scopedRules,
    rawCss,
    transformedCss,
    compiledCss,
    debug: { id: artifactId, ast, atoms, scopedRules, warnings },
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: 'CipoCssArtifact',
  }
}

/**
 * Creates the new full stylesheet artifact.
 *
 * @remarks
 * Full stylesheet artifacts are not injected automatically by `css`` `.
 * They are string-first so they can be passed to `injectGlobal`,
 * `injectStyle`, a `<style>` tag, or another runtime.
 *
 * @param rawCss - Raw source.
 * @param transformedCss - Transformed source.
 * @param ast - Parsed AST.
 * @param warnings - Compilation warnings.
 * @returns Stylesheet artifact.
 */
function createStylesheetArtifact(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
  warnings: readonly CipoWarning[],
  forceImportant = false,
): CipoStylesheetArtifact {
  const cssText = compileStylesheetText(ast, forceImportant)
  const artifactId = `${runtime.config.prefix}-stylesheet-${hashString(rawCss)}`

  return {
    kind: 'cipo.stylesheet',
    rawCss,
    transformedCss,
    cssText,
    debug: {
      id: artifactId,
      ast,
      warnings,
      mode: 'stylesheet',
    },
    toString: () => cssText,
    [Symbol.toPrimitive]: () => cssText,
    [Symbol.toStringTag]: 'CipoStylesheetArtifact',
  }
}

/***************************************************************************************************
 * Stylesheet Detection
 **************************************************************************************************/

/**
 * Decides whether the source should compile as a full stylesheet.
 *
 * @remarks
 * The rule is intentionally simple and safe:
 *
 * - Top-level declarations or standalone aliases mean component/atomic mode.
 * - A source made only of top-level stylesheet blocks means stylesheet mode.
 * - `x:hover`, `x:md`, `x:dark`, `x:not(md)` and `&:hover` stay in component
 *   mode because they depend on generated classes/scope.
 *
 * This avoids breaking the old API while allowing:
 *
 * ```ts
 * css`
 *   .class {}
 *   #id {}
 * `
 * ```
 *
 * to behave like a stylesheet.
 *
 * @param rawCss - Raw source before transforms.
 * @param transformedCss - Source after transforms.
 * @param ast - Parsed AST.
 * @returns Whether stylesheet mode should be used.
 */
function shouldCompileAsStylesheet(
  rawCss: string,
  transformedCss: string,
  ast: readonly CipoAstNode[],
): boolean {
  const source = transformedCss.trim()

  if (!source) return false

  if (hasTopLevelLooseStatements(rawCss)) return false

  if (ast.length === 0) return false

  for (const node of ast) {
    if (node.type !== 'block') return false
    if (!isStylesheetRootBlock(node)) return false
  }

  return true
}

/**
 * Checks whether the original template has top-level loose statements.
 *
 * @remarks
 * A "loose statement" is anything outside top-level blocks:
 *
 * - `px: 4;`
 * - `glass;`
 * - `color: red;`
 * - `@with(...)`
 *
 * If these are present, we keep legacy component/atomic mode even if there are
 * nested selectors later.
 *
 * @param input - Raw CSS.
 * @returns Whether a top-level loose statement exists.
 */
function hasTopLevelLooseStatements(input: string): boolean {
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (quote) {
      buffer += char

      if (char === quote && input[index - 1] !== '\\') {
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }

    if (char === '{') {
      if (depth === 0 && buffer.trim()) {
        buffer = ''
      }

      depth += 1
      continue
    }

    if (char === '}') {
      depth = Math.max(0, depth - 1)

      if (depth === 0) {
        buffer = ''
      }

      continue
    }

    if (depth === 0) {
      buffer += char

      if (char === ';' && buffer.trim()) {
        return true
      }
    }
  }

  return buffer.trim().length > 0
}

/**
 * Detects full stylesheet root blocks.
 *
 * @param node - Block node.
 * @returns Whether the block is a stylesheet root.
 */
function isStylesheetRootBlock(node: CipoBlockNode): boolean {
  const name = node.name.trim()

  if (!name) return false

  if (name.startsWith('x:')) return false
  if (name.startsWith('&')) return false

  if (isStylesheetAtRule(name)) return true
  if (isRootSelector(name)) return true

  return false
}

/**
 * Detects stylesheet at-rules.
 *
 * @param name - Block name.
 * @returns Whether the block name is a stylesheet at-rule.
 */
function isStylesheetAtRule(name: string): boolean {
  return /^@(media|supports|container|layer|scope|keyframes|font-face|property|page|starting-style)\b/.test(name)
}

/**
 * Detects selectors that make sense as global/full stylesheet roots.
 *
 * @param name - Block name.
 * @returns Whether the block name looks like a selector.
 */
function isRootSelector(name: string): boolean {
  if (name.startsWith('.') || name.startsWith('#') || name.startsWith(':') || name.startsWith('[') || name.startsWith('*')) {
    return true
  }

  if (name.includes(',') || name.includes('>') || name.includes('+') || name.includes('~') || name.includes(' ')) {
    return true
  }

  return /^[a-z][a-z0-9-]*$/i.test(name)
}


/**
 * Detects pseudo names supported by stylesheet runtime context blocks.
 *
 * @param name - Pseudo shorthand without colon.
 * @returns Whether the pseudo is known.
 */
function isStylesheetPseudoName(name: string): boolean {
  return [
    'hover',
    'focus',
    'active',
    'disabled',
    'checked',
    'focus-visible',
    'focus-within',
    'visited',
    'first-child',
    'last-child',
    'before',
    'after',
    'target',
    'open',
  ].includes(name)
}

/***************************************************************************************************
 * Stylesheet Compiler
 **************************************************************************************************/

/**
 * Compiles a parsed full stylesheet AST into CSS text.
 *
 * @remarks
 * This compiler preserves selectors and supports CSS nesting using `&`.
 * It also keeps at-rules as stylesheet constructs instead of turning their
 * declarations into atomic classes.
 *
 * @param ast - Parsed AST.
 * @returns Stylesheet text.
 */
function compileStylesheetText(ast: readonly CipoAstNode[], forceImportant = false): string {
  let cssText = ''

  for (let index = 0; index < ast.length; index += 1) {
    const chunk = compileStylesheetNode(ast[index], [], forceImportant)
    if (!chunk) continue
    cssText += cssText ? `\n${chunk}` : chunk
  }

  return formatStylesheetText(cssText)
}

/**
 * Compiles one stylesheet node.
 *
 * @param node - AST node.
 * @param parentSelectors - Current selector chain.
 * @returns CSS text.
 */
function compileStylesheetNode(node: CipoAstNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  if (node.type === 'declaration') {
    return parentSelectors.length > 0 ? compileStylesheetRule(parentSelectors, [node], forceImportant) : compileDeclaration(node, forceImportant)
  }

  if (node.type === 'directive') {
    return ''
  }

  return compileStylesheetBlock(node, parentSelectors, forceImportant)
}

/**
 * Compiles one stylesheet block.
 *
 * @param block - Block node.
 * @param parentSelectors - Parent selectors.
 * @returns CSS text.
 */
function compileStylesheetBlock(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  const name = block.name.trim()

  if (isStylesheetAtRule(name)) {
    return compileStylesheetAtRule(block, parentSelectors, forceImportant)
  }

  if (name.startsWith('x:')) {
    return compileStylesheetRuntimeBlock(block, parentSelectors, forceImportant)
  }

  const selectors = resolveNestedSelectors(parentSelectors, splitSelectorList(name))
  const declarations: CipoDeclarationNode[] = []
  let output = ''

  for (let index = 0; index < block.body.length; index += 1) {
    const child = block.body[index]
    if (child.type === 'declaration') {
      declarations.push(child)
      continue
    }

    if (child.type === 'block') {
      if (declarations.length > 0) {
        const rule = compileStylesheetRule(selectors, declarations, forceImportant)
        output += output ? `\n${rule}` : rule
        declarations.length = 0
      }

      const nested = compileStylesheetBlock(child, selectors, forceImportant)
      if (nested) output += output ? `\n${nested}` : nested
    }
  }

  if (declarations.length > 0) {
    const rule = compileStylesheetRule(selectors, declarations, forceImportant)
    output += output ? `\n${rule}` : rule
  }

  return output
}


/**
 * Compiles Cipó runtime context blocks inside full stylesheets.
 *
 * @remarks
 * This lets stylesheet mode support the same runtime contexts as atomic mode:
 *
 * ```css
 * body {
 *   color: $brand
 *
 *   x:md {
 *     px: 6
 *   }
 *
 *   x:hover {
 *     color: $ink
 *   }
 * }
 * ```
 *
 * Output shape:
 *
 * ```css
 * body { color: var(--...); }
 * @media (min-width: 768px) { body { padding-inline: ...; } }
 * body:hover { color: var(--...); }
 * ```
 *
 * @param block - Runtime context block.
 * @param parentSelectors - Current selector chain.
 * @returns CSS text.
 */
function compileStylesheetRuntimeBlock(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  if (parentSelectors.length === 0) return ''

  let selectors = copyStrings(parentSelectors)
  const wrappers: string[] = []
  const name = block.name.trim()

  if (name.startsWith('x:not(')) {
    const breakpoint = name.replace(/^x:not\(/, '').replace(/\)$/, '').trim()
    const query = runtime.config.breakpoints[breakpoint]
    if (query) wrappers.push(`@media not all and ${query}`)
  } else {
    const contextParts = splitRuntimeContextParts(name.slice(2))

    for (const part of contextParts) {
      if (part in runtime.config.breakpoints) {
        const query = runtime.config.breakpoints[part]
        if (query) wrappers.push(`@media ${query}`)
        continue
      }

      if (part === 'dark') {
        selectors = prefixSelectors(runtime.config.darkSelector, selectors)
        continue
      }

      if (part === 'motion-safe') {
        wrappers.push('@media (prefers-reduced-motion: no-preference)')
        continue
      }

      if (part === 'motion-reduce') {
        wrappers.push('@media (prefers-reduced-motion: reduce)')
        continue
      }

      if (isStylesheetPseudoName(part)) {
        selectors = appendPseudoToSelectors(selectors, part)
      }
    }
  }

  let body = ''
  for (let index = 0; index < block.body.length; index += 1) {
    const chunk = compileStylesheetNode(block.body[index], selectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }

  for (let index = wrappers.length - 1; index >= 0; index -= 1) {
    body = `${wrappers[index]}{${body}}`
  }

  return body
}

/**
 * Compiles an at-rule.
 *
 * @remarks
 * At-rules can contain nested selectors. For example:
 *
 * ```css
 * @media (min-width: 768px) {
 *   .card {
 *     px: 6;
 *   }
 * }
 * ```
 *
 * @param block - At-rule block.
 * @param parentSelectors - Parent selectors.
 * @returns CSS text.
 */
function compileStylesheetAtRule(block: CipoBlockNode, parentSelectors: readonly string[], forceImportant: boolean): string {
  let body = ''
  for (let index = 0; index < block.body.length; index += 1) {
    const chunk = compileStylesheetNode(block.body[index], parentSelectors, forceImportant)
    if (chunk) body += body ? `\n${chunk}` : chunk
  }

  if (!body) return ''

  return `${block.name.trim()}{${body}}`
}

/**
 * Compiles selector declarations.
 *
 * @param selectors - Resolved selector list.
 * @param declarations - Declaration nodes.
 * @returns CSS rule.
 */
function compileStylesheetRule(
  selectors: readonly string[],
  declarations: readonly CipoDeclarationNode[],
  forceImportant: boolean,
): string {
  let body = ''
  for (let index = 0; index < declarations.length; index += 1) {
    body += compileDeclaration(declarations[index], forceImportant)
  }

  return `${joinSelectors(selectors)}{${body}}`
}

/**
 * Compiles one declaration.
 *
 * @param declaration - Declaration node.
 * @returns CSS declaration text.
 */
function compileDeclaration(declaration: CipoDeclarationNode, forceImportant: boolean): string {
  const important = runtime.config.important || forceImportant
  return `${declaration.property}:${important ? addImportant(declaration.value) : declaration.value};`
}

/**
 * Resolves nested CSS selectors.
 *
 * @param parents - Parent selector list.
 * @param children - Child selector list.
 * @returns Resolved selectors.
 */
function resolveNestedSelectors(
  parents: readonly string[],
  children: readonly string[],
): readonly string[] {
  if (parents.length === 0) return children

  const output: string[] = []

  for (const parent of parents) {
    for (const child of children) {
      if (child.includes('&')) {
        output.push(child.replaceAll('&', parent))
      } else {
        output.push(`${parent} ${child}`)
      }
    }
  }

  return output
}

/**
 * Splits a selector list by top-level commas.
 *
 * @param selector - Selector list.
 * @returns Individual selectors.
 */
function splitSelectorList(selector: string): readonly string[] {
  const output: string[] = []
  let buffer = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index]

    if (quote) {
      buffer += char

      if (char === quote && selector[index - 1] !== '\\') {
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
    } else if (char === ')' || char === ']') {
      depth -= 1
    }

    if (char === ',' && depth === 0) {
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
 * Formats stylesheet text using the runtime output mode.
 *
 * @param cssText - Raw CSS text.
 * @returns Formatted CSS text.
 */
function formatStylesheetText(cssText: string): string {
  if (runtime.config.minify) {
    return minifyStylesheetText(cssText)
  }

  return prettyStylesheetText(cssText)
}

/**
 * Minifies stylesheet text enough for runtime output.
 *
 * @param cssText - CSS text.
 * @returns Minified CSS.
 */
function minifyStylesheetText(cssText: string): string {
  return cssText.replace(/\s+/g, ' ').replace(/\s*([{}:;,>+~])\s*/g, '$1').trim()
}

/**
 * Pretty-prints stylesheet text.
 *
 * @param cssText - CSS text.
 * @returns Pretty CSS.
 */
function prettyStylesheetText(cssText: string): string {
  let output = ''
  let token = ''
  let depth = 0
  let quote: '"' | "'" | null = null

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index]

    if (quote) {
      token += char

      if (char === quote && cssText[index - 1] !== '\\') {
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      token += char
      continue
    }

    if (char === '{') {
      output += `${indent(depth)}${token.trim()} {\n`
      token = ''
      depth += 1
      continue
    }

    if (char === '}') {
      if (token.trim()) {
        output += `${indent(depth)}${token.trim()}\n`
        token = ''
      }

      depth = Math.max(0, depth - 1)
      output += `${indent(depth)}}\n`
      continue
    }

    if (char === ';') {
      output += `${indent(depth)}${token.trim()};\n`
      token = ''
      continue
    }

    token += char
  }

  if (token.trim()) {
    output += `${indent(depth)}${token.trim()}`
  }

  return output.trim()
}

/**
 * Creates indentation for pretty CSS output.
 *
 * @param depth - Nesting depth.
 * @returns Spaces.
 */
function indent(depth: number): string {
  return '  '.repeat(depth)
}


/**
 * Injects a stylesheet artifact into a target and keeps it as the last style node.
 *
 * @param target - DOM target.
 * @param cssText - CSS text.
 * @returns Created style element.
 */
function injectSheetInto(target: HTMLElement | ShadowRoot | Document, cssText: string): HTMLStyleElement {
  const parent = target instanceof Document ? target.head : target
  const element = document.createElement('style')
  element.dataset.cipoSheet = 'true'
  element.textContent = cssText
  parent.append(element)
  return element
}

/**
 * Copies selector arrays without spreading on hot paths.
 *
 * @param input - Selector list.
 * @returns Mutable copy.
 */
function copyStrings(input: readonly string[]): string[] {
  const output = new Array<string>(input.length)
  for (let index = 0; index < input.length; index += 1) output[index] = input[index]
  return output
}

/**
 * Splits x: runtime context names without allocation-heavy chains.
 *
 * @param input - Runtime context text.
 * @returns Context parts.
 */
function splitRuntimeContextParts(input: string): string[] {
  const output: string[] = []
  let start = 0
  for (let index = 0; index <= input.length; index += 1) {
    if (index < input.length && input[index] !== ':') continue
    const part = input.slice(start, index).trim()
    if (part) output.push(part)
    start = index + 1
  }
  return output
}

/**
 * Prefixes selectors for dark mode.
 *
 * @param prefix - Parent selector prefix.
 * @param selectors - Selector list.
 * @returns New selector list.
 */
function prefixSelectors(prefix: string, selectors: readonly string[]): string[] {
  const output = new Array<string>(selectors.length)
  for (let index = 0; index < selectors.length; index += 1) output[index] = `${prefix} ${selectors[index]}`
  return output
}

/**
 * Appends a pseudo selector to each selector.
 *
 * @param selectors - Selector list.
 * @param pseudo - Pseudo name without colon.
 * @returns New selector list.
 */
function appendPseudoToSelectors(selectors: readonly string[], pseudo: string): string[] {
  const output = new Array<string>(selectors.length)
  for (let index = 0; index < selectors.length; index += 1) output[index] = `${selectors[index]}:${pseudo}`
  return output
}

/**
 * Joins selectors with commas.
 *
 * @param selectors - Selector list.
 * @returns Selector text.
 */
function joinSelectors(selectors: readonly string[]): string {
  let output = ''
  for (let index = 0; index < selectors.length; index += 1) output += output ? `,${selectors[index]}` : selectors[index]
  return output
}

/***************************************************************************************************
 * Cache Helpers
 **************************************************************************************************/

/**
 * Reads a cached CSS result.
 *
 * @param cacheKey - Cache key.
 * @returns Cached artifact or undefined.
 */
function getCachedArtifact(cacheKey: string): CipoCssResult | undefined {
  if (!runtime.config.jit.enabled || !runtime.config.jit.cache) return undefined

  return runtime.artifactCache.get(cacheKey) as CipoCssResult | undefined
}

/**
 * Stores a CSS result in the JIT cache.
 *
 * @param cacheKey - Cache key.
 * @param artifact - Artifact to cache.
 * @returns Nothing.
 */
function setCachedArtifact(cacheKey: string, artifact: CipoCssResult): void {
  if (!runtime.config.jit.enabled || !runtime.config.jit.cache) return

  runtime.artifactCache.set(cacheKey, artifact)
  evictIfNeeded(runtime.artifactCache as Map<string, unknown>)
}

/***************************************************************************************************
 * Type Guards
 **************************************************************************************************/

/**
 * Checks if a node is a declaration node.
 *
 * @param node - AST node.
 * @returns Whether it is a declaration.
 */
function isDeclarationNode(node: CipoAstNode): node is CipoDeclarationNode {
  return node.type === 'declaration'
}

/**
 * Checks if a node is a block node.
 *
 * @param node - AST node.
 * @returns Whether it is a block.
 */
function isBlockNode(node: CipoAstNode): node is CipoBlockNode {
  return node.type === 'block'
}
