import { STYLE_ELEMENT_ID } from './constants'
import { formatCss, getLayerDeclaration } from './format'
import { runtime } from './runtime'
import type { CipoCssArtifact, CipoInjectStyleOptions, CipoInlineCssArtifact } from './types'
import { hashString, normalizeCss } from './utils'

/**
 * Injects CSS into the runtime stylesheet sink.
 *
 * @remarks
 * The sink is intentionally dual-mode:
 *
 * - In browsers, rules are appended to the global `<style>` tag.
 * - In Node/Vitest, rules are still recorded in `runtime.generatedCssText` so
 *   `getCssText()` remains deterministic without a DOM environment.
 *
 * This keeps old tests and server-side compile checks working while preserving
 * the browser fast path. The rule splitter is manual and allocation-light: no
 * nested maps, no reduce, no sort, just one scan through the text.
 *
 * @param cssText - CSS to inject.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * insertCss('.cipo-a-x{color:red;}')
 * getCssText()
 * // '.cipo-a-x{color:red;}'
 * ```
 */
export function insertCss(cssText: string): void {
  if (!cssText || !cssText.trim()) return

  const style = hasDocument() ? ensureStyleElement() : null

  if (runtime.config.layers && !runtime.layerHeaderInserted) {
    const header = `${getLayerDeclaration()}\n`
    runtime.generatedCssText += header
    if (style) style.appendChild(document.createTextNode(header))
    runtime.layerHeaderInserted = true
  }

  const rules = splitTopLevelRules(cssText)

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]
    if (!rule) continue

    const normalized = normalizeCss(rule)
    if (!normalized || runtime.insertedCss.has(normalized)) continue

    runtime.insertedCss.add(normalized)

    const formatted = `${formatCss(rule)}\n`
    runtime.generatedCssText += formatted

    if (style) {
      style.appendChild(document.createTextNode(formatted))
    }
  }
}

/**
 * Injects style artifacts into a specific target such as a ShadowRoot.
 *
 * @param target - HTMLElement, ShadowRoot or Document.
 * @param styles - Style artifact(s).
 * @param options - Injection options.
 * @returns Created or reused style element.
 *
 * @example
 * ```ts
 * const shadow = host.attachShadow({ mode: 'open' })
 * injectStyle(shadow, cardStyles)
 * ```
 */
export function injectStyle(target: HTMLElement | ShadowRoot | Document, styles: CipoCssArtifact | CipoInlineCssArtifact | readonly (CipoCssArtifact | CipoInlineCssArtifact)[], options: CipoInjectStyleOptions = {}): HTMLStyleElement {
  const list = Array.isArray(styles) ? styles : [styles]
  let cssText = ''

  for (let index = 0; index < list.length; index += 1) {
    const style = list[index]
    cssText += index > 0 ? '\n' : ''
    cssText += style.kind === 'cipo.inline-css' ? style.cssText : style.compiledCss
  }

  const key = `cipo-style-${hashString(cssText)}`
  const parent = target instanceof Document ? target.head : target

  if (options.dedupe !== false) {
    const existing = parent.querySelector?.(`style[data-cipo-style="${key}"]`)
    if (existing instanceof HTMLStyleElement) return existing
  }

  const element = document.createElement('style')
  element.dataset.cipoStyle = key
  if (options.nonce) element.nonce = options.nonce
  element.textContent = cssText
  if (options.position === 'prepend') parent.prepend(element)
  else parent.append(element)
  return element
}

/**
 * Reads generated runtime CSS text.
 *
 * @remarks
 * In a browser this prefers the live style tag. In DOM-less tests it returns
 * the internal generated CSS buffer populated by `insertCss()`.
 *
 * @returns CSS text.
 */
export function getCssText(): string {
  if (hasDocument()) {
    const style = document.getElementById(STYLE_ELEMENT_ID)
    if (style instanceof HTMLStyleElement) return style.textContent ?? ''
  }

  return runtime.generatedCssText
}

/**
 * Ensures a global style element exists.
 *
 * @returns Style element.
 */
export function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID)
  if (existing instanceof HTMLStyleElement) return existing
  const element = document.createElement('style')
  element.id = STYLE_ELEMENT_ID
  element.dataset.cipo = 'runtime'
  document.head.appendChild(element)
  return element
}

export function hasDocument(): boolean {
  return typeof document !== 'undefined' && Boolean(document.head)
}

function splitTopLevelRules(input: string): string[] {
  const output: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

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

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth < 0) depth = 0

      if (depth === 0) {
        const rule = input.slice(start, index + 1).trim()
        if (rule) output.push(rule)
        start = index + 1
      }
    }
  }

  const tail = input.slice(start).trim()
  if (tail) output.push(tail)

  return output
}
