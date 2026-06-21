import { compileAtomicRule } from './compiler'
import { atomic, sheet } from './css'
import { transformCss } from './transform'
import { runtime } from './runtime'
import type { CipoExplainResult } from './types'

/**
 * Explains a generated atomic class.
 *
 * @param className - Generated class name.
 * @returns Explanation object.
 *
 * @example
 * ```ts
 * const card = css`color: red;`
 * explain(String(card).split(' ')[0])
 * // { found: true, atom: { property: 'color', value: 'red' }, css: '...' }
 * ```
 */
export function explain(className: string): CipoExplainResult {
  const atom = runtime.debugAtoms.get(className)
  if (!atom) return { found: false, className }
  return { found: true, className, atom, css: compileAtomicRule(atom) }
}

/**
 * Inspects an element's Cipó classes.
 *
 * @param element - DOM element.
 * @returns Classes and matching atoms.
 *
 * @example
 * ```ts
 * inspect(document.querySelector('button')!)
 * ```
 */
export function inspect(element: Element): { readonly classes: readonly string[]; readonly atoms: readonly NonNullable<CipoExplainResult['atom']>[] } {
  const classes = Array.from(element.classList)
  const atoms = classes.map(className => runtime.debugAtoms.get(className)).filter((atom): atom is NonNullable<CipoExplainResult['atom']> => Boolean(atom))
  return { classes, atoms }
}

export interface CipoValidationIssue {
  readonly code: string
  readonly message: string
  readonly index: number
}

export interface CipoValidationResult {
  readonly valid: boolean
  readonly issues: readonly CipoValidationIssue[]
}

/**
 * Performs a cheap structural validation pass over generated CSS.
 *
 * @remarks
 * This is intentionally not a browser CSS parser. It catches the failures that
 * are expensive to debug in userscripts: unbalanced blocks, unbalanced function
 * parentheses, unterminated comments/strings and duplicate `!important` markers.
 * The scanner is linear and allocation-light so it can be used in debug builds.
 *
 * @param cssText - CSS text to validate.
 * @returns Validation result with issue positions.
 *
 * @example
 * ```ts
 * validateCss('.card { color: red !important !important }')
 * // { valid: false, issues: [{ code: 'duplicate-important', ... }] }
 * ```
 */
export function validateCss(cssText: string): CipoValidationResult {
  const issues: CipoValidationIssue[] = []
  let blockDepth = 0
  let parenDepth = 0
  let quote = ''
  let escaped = false
  let comment = false
  let importantSeenInDeclaration = false

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index]
    const next = cssText[index + 1]

    if (comment) {
      if (char === '*' && next === '/') {
        comment = false
        index += 1
      }
      continue
    }

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) quote = ''
      continue
    }

    if (char === '/' && next === '*') {
      comment = true
      index += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '{') {
      blockDepth += 1
      importantSeenInDeclaration = false
      continue
    }

    if (char === '}') {
      if (blockDepth === 0) pushIssue(issues, 'unexpected-close-brace', 'Unexpected closing brace.', index)
      else blockDepth -= 1
      importantSeenInDeclaration = false
      continue
    }

    if (char === '(') {
      parenDepth += 1
      continue
    }

    if (char === ')') {
      if (parenDepth === 0) pushIssue(issues, 'unexpected-close-paren', 'Unexpected closing parenthesis.', index)
      else parenDepth -= 1
      continue
    }

    if (char === ';') {
      importantSeenInDeclaration = false
      continue
    }

    if (char === '!' && cssText.slice(index, index + 10).toLowerCase() === '!important') {
      if (importantSeenInDeclaration) pushIssue(issues, 'duplicate-important', 'Duplicate !important marker in one declaration.', index)
      importantSeenInDeclaration = true
      index += 9
    }
  }

  if (comment) pushIssue(issues, 'unterminated-comment', 'Unterminated block comment.', cssText.length)
  if (quote) pushIssue(issues, 'unterminated-string', 'Unterminated string literal.', cssText.length)
  if (blockDepth > 0) pushIssue(issues, 'unclosed-block', 'Unclosed CSS block.', cssText.length)
  if (parenDepth > 0) pushIssue(issues, 'unclosed-function', 'Unclosed CSS function.', cssText.length)

  validatePropertyBlocks(cssText, issues)

  return { valid: issues.length === 0, issues }
}


function validatePropertyBlocks(cssText: string, issues: CipoValidationIssue[]): void {
  let index = 0

  while (index < cssText.length) {
    const start = cssText.indexOf('@property', index)
    if (start < 0) return
    const open = cssText.indexOf('{', start)
    if (open < 0) {
      pushIssue(issues, 'property-missing-block', '@property rule is missing a declaration block.', start)
      return
    }
    const close = findMatchingBrace(cssText, open)
    if (close < 0) {
      pushIssue(issues, 'property-unclosed-block', '@property rule has an unclosed declaration block.', start)
      return
    }
    const name = cssText.slice(start + '@property'.length, open).trim()
    const body = cssText.slice(open + 1, close)
    if (!name.startsWith('--')) pushIssue(issues, 'property-invalid-name', '@property name must be a CSS custom property.', start)
    if (!/syntax\s*:/i.test(body)) pushIssue(issues, 'property-missing-syntax', '@property requires a syntax declaration.', open)
    if (!/inherits\s*:\s*(true|false)\s*;/i.test(`${body};`)) pushIssue(issues, 'property-invalid-inherits', '@property inherits must be true or false.', open)
    if (!/initial-value\s*:/i.test(body)) pushIssue(issues, 'property-missing-initial-value', '@property requires an initial-value declaration.', open)
    index = close + 1
  }
}

function findMatchingBrace(input: string, openIndex: number): number {
  let depth = 0
  let quote = ''
  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index]
    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = ''
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    if (depth === 0) return index
  }
  return -1
}

function pushIssue(issues: CipoValidationIssue[], code: string, message: string, index: number): void {
  issues[issues.length] = { code, message, index }
}

export interface CipoSourceExplanation {
  readonly rawCss: string
  readonly transformedCss: string
  readonly cssText: string
  readonly warnings: readonly import('./types').CipoWarning[]
  readonly validation: CipoValidationResult
  readonly mode: 'atomic' | 'stylesheet'
  readonly className?: string
}

/**
 * Explains a CSS source string end-to-end.
 *
 * @remarks
 * `explain()` is class-oriented for generated atoms. `explainCss()` is source-
 * oriented: it compiles without hiding the intermediate transformed text,
 * warnings or validation result. This is the fastest way to debug helpers,
 * tokens, aliases, nesting, media helpers and stylesheet mode in a userscript.
 *
 * @param input - Raw Cipó CSS source.
 * @param mode - Optional explicit mode. Defaults to stylesheet for selector-like input and atomic otherwise.
 * @returns Explanation object.
 *
 * @example
 * ```ts
 * const info = explainCss('.card { bg: alpha($brand / 20%) }', 'stylesheet')
 * console.log(info.transformedCss)
 * ```
 */
export function explainCss(input: string, mode: 'atomic' | 'stylesheet' = input.indexOf('{') >= 0 ? 'stylesheet' : 'atomic'): CipoSourceExplanation {
  const warnings: import('./types').CipoWarning[] = []
  const rawCss = String(input || '')
  const transformedCss = transformCss(rawCss, warnings)
  const validation = validateCss(transformedCss)

  if (mode === 'stylesheet') {
    const artifact = sheet.css([rawCss] as unknown as TemplateStringsArray)
    return { rawCss, transformedCss, cssText: artifact.cssText, warnings, validation, mode }
  }

  const artifact = atomic.css([rawCss] as unknown as TemplateStringsArray)
  return { rawCss, transformedCss, cssText: artifact.compiledCss, warnings, validation, mode, className: artifact.className }
}


export interface CipoDetailedExplanation extends CipoSourceExplanation {
  readonly phases: readonly { readonly name: string; readonly cssText: string }[];
}

/**
 * Explains every major Cipó compilation phase for docs and debugging.
 *
 * @param input - Raw Cipó source.
 * @param mode - Explicit mode.
 * @returns Detailed explanation with phase list.
 *
 * @example
 * ```ts
 * const details = explainDetailed('px: 4', 'atomic');
 * console.table(details.phases);
 * ```
 */
export function explainDetailed(input: string, mode: 'atomic' | 'stylesheet' = input.indexOf('{') >= 0 ? 'stylesheet' : 'atomic'): CipoDetailedExplanation {
  const base = explainCss(input, mode);
  return {
    ...base,
    phases: runtime.propertyDefinitions.size > 0
      ? [
          { name: 'raw', cssText: base.rawCss },
          { name: 'transformed', cssText: base.transformedCss },
          { name: '@property collection', cssText: Array.from(runtime.propertyDefinitions.keys()).join('\n') },
          { name: 'compiled', cssText: base.cssText },
        ]
      : [
          { name: 'raw', cssText: base.rawCss },
          { name: 'transformed', cssText: base.transformedCss },
          { name: 'compiled', cssText: base.cssText },
        ],
  };
}

/**
 * Benchmarks one Cipó compile loop with best-effort high resolution timing.
 *
 * @param input - Source to compile.
 * @param iterations - Number of compiles.
 * @param mode - Compile mode.
 * @returns Timing summary.
 */
export function benchmark(input: string, iterations = 100, mode: 'atomic' | 'stylesheet' = input.indexOf('{') >= 0 ? 'stylesheet' : 'atomic') {
  const count = Math.max(1, Math.floor(iterations));
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  for (let index = 0; index < count; index += 1) explainCss(input, mode);
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { iterations: count, totalMs: end - start, averageMs: (end - start) / count };
}
