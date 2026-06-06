import { STYLE_ELEMENT_ID } from './constants'
import { formatCss, getLayerDeclaration } from './format'
import { runtime } from './runtime'
import type { CipoCssArtifact, CipoInjectStyleOptions, CipoInlineCssArtifact } from './types'
import { hashString, normalizeCss } from './utils'

/**
 * Injects CSS into the global runtime style tag.
 *
 * @param cssText - CSS to inject.
 * @returns Nothing.
 */
export function insertCss(cssText: string): void {
  if (!hasDocument() || !cssText.trim()) return
  const style = ensureStyleElement()

  if (runtime.config.layers && !runtime.layerHeaderInserted) {
    style.appendChild(document.createTextNode(`${getLayerDeclaration()}\n`))
    runtime.layerHeaderInserted = true
  }

  for (const rule of splitTopLevelRules(cssText)) {
    const normalized = normalizeCss(rule)
    if (!normalized || runtime.insertedCss.has(normalized)) continue
    runtime.insertedCss.add(normalized)
    style.appendChild(document.createTextNode(`${formatCss(rule)}\n`))
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
  const cssText = list.map(style => style.kind === 'cipo.inline-css' ? style.cssText : style.compiledCss).join('\n')
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
 * Reads the generated runtime CSS text.
 *
 * @returns CSS text.
 */
export function getCssText(): string {
  if (!hasDocument()) return ''
  const style = document.getElementById(STYLE_ELEMENT_ID)
  return style instanceof HTMLStyleElement ? style.textContent ?? '' : ''
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
  let quote: '"' | "'" | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quote) { if (char === quote && input[index - 1] !== '\\') quote = null; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '{') depth += 1
    else if (char === '}') depth -= 1
    if (depth === 0 && char === '}') { output.push(input.slice(start, index + 1).trim()); start = index + 1 }
  }

  const tail = input.slice(start).trim()
  if (tail) output.push(tail)
  return output.filter(Boolean)
}
