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

  return { valid: issues.length === 0, issues }
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
