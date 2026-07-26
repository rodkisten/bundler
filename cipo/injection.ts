import { compileRuntimeAtomicStyles } from './engine/atomic/runtime'
import { STYLE_ELEMENT_ID } from './constants'
import { formatCss, getLayerDeclaration } from './format'
import { runtime } from './runtime'
import type { CipoCssArtifact, CipoInjectableStyleArtifact, CipoInjectStyleOptions } from './types'
import { hashString, normalizeCss } from './utils'

export type CipoRuntimeStyleTarget = HTMLElement | ShadowRoot | Document | null

let runtimeStyleTarget: CipoRuntimeStyleTarget | undefined
let staticCssText = ''
let atomicCssText = ''
const replaceableCss = new Map<string, string>()
const atomicArtifacts = new Set<CipoCssArtifact>()

/**
 * Injects non-component CSS into Cipó's single runtime stylesheet sink.
 *
 * @remarks
 * Styled/component artifacts use `registerAtomicArtifact()` instead. Keeping the
 * static and atomic sections separate lets the runtime rebuild only the atomic
 * program when a declaration reaches its CSS-first reuse threshold.
 */
export function insertCss(cssText: string): void {
  if (!cssText || !cssText.trim()) return

  const rules = splitTopLevelRules(cssText)
  let changed = false

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]
    if (!rule) continue

    const normalized = normalizeCss(rule)
    if (!normalized || runtime.insertedCss.has(normalized)) continue

    runtime.insertedCss.add(normalized)
    staticCssText += `${formatCss(rule)}\n`
    changed = true
  }

  if (changed) rebuildRuntimeStylesheet()
}


/**
 * Replaces the CSS owned by one development module.
 *
 * @remarks
 * Vite executes transformed modules again after HMR updates. A stable module
 * key lets Cipó replace stale rules instead of appending another copy on every
 * edit. Passing an empty string removes the module contribution.
 */
export function replaceCss(key: string, cssText: string): void {
  const normalizedKey = key.trim()
  if (!normalizedKey) return

  const nextCss = cssText.trim()
  const previousCss = replaceableCss.get(normalizedKey) ?? ''
  if (previousCss === nextCss) return

  if (nextCss) replaceableCss.set(normalizedKey, nextCss)
  else replaceableCss.delete(normalizedKey)

  rebuildRuntimeStylesheet()
}

/**
 * Registers one runtime Cipó/Fábrica Elements component artifact.
 *
 * Every styled component created through Cipó reaches this collector by default.
 * The collector owns one global atomic program: declarations below
 * `atomic-min-uses` remain scoped, while repeated declarations are emitted once as
 * shared atomic classes.
 */
export function registerAtomicArtifact(artifact: CipoCssArtifact): void {
  const size = atomicArtifacts.size
  atomicArtifacts.add(artifact)
  if (atomicArtifacts.size === size) return
  syncAtomicStylesheet()
}

/** Rebuilds only the shared atomic section from all registered runtime artifacts. */
export function syncAtomicStylesheet(): string {
  const program = compileRuntimeAtomicStyles(Array.from(atomicArtifacts))
  atomicCssText = program.css ? `${program.css.trim()}\n` : ''
  rebuildRuntimeStylesheet()
  return program.css
}

/** Returns a stable snapshot of artifacts contributing to the runtime atomic sheet. */
export function getRegisteredAtomicArtifacts(): readonly CipoCssArtifact[] {
  return Object.freeze(Array.from(atomicArtifacts))
}

/** Clears module-local stylesheet aggregation state. Used by the public reset API. */
export function resetInjectionState(): void {
  staticCssText = ''
  atomicCssText = ''
  atomicArtifacts.clear()
  replaceableCss.clear()
}

export function setRuntimeStyleTarget(target: CipoRuntimeStyleTarget | undefined): HTMLStyleElement | null {
  runtimeStyleTarget = target
  if (!hasDocument()) return null

  removeDocumentStyleWhenRetargeting(target)
  if (target === null) return null

  const style = ensureStyleElement()
  if (style.textContent !== runtime.generatedCssText) style.textContent = runtime.generatedCssText
  return style
}

/**
 * Injects style artifacts into a target.
 *
 * Atomic artifacts are finalized together rather than concatenating each
 * component's fallback CSS. When the target is Cipó's active runtime sink, the
 * artifacts are folded into the existing runtime style element so the page keeps
 * exactly one Cipó stylesheet.
 */
export function injectStyle(
  target: HTMLElement | ShadowRoot | Document,
  styles: CipoInjectableStyleArtifact | readonly CipoInjectableStyleArtifact[],
  options: CipoInjectStyleOptions = {},
): HTMLStyleElement {
  const list = Array.isArray(styles) ? styles : [styles]

  if (target === runtimeStyleTarget) {
    const snapshot = runtime.generatedCssText.trim()
    for (const style of list) {
      if (style.kind === 'cipo.css') {
        registerAtomicArtifact(style)
        continue
      }

      const cssText = style.cssText.trim()
      if (!cssText || cssText === snapshot) continue
      insertCss(cssText)
    }

    const element = ensureStyleElement()
    if (options.nonce) element.nonce = options.nonce
    const parent = target instanceof Document ? target.head : target
    if (options.position === 'prepend' && element.parentNode === parent) parent.prepend(element)
    return element
  }

  const atomic: CipoCssArtifact[] = []
  const chunks: string[] = []

  for (const style of list) {
    if (style.kind === 'cipo.css') atomic.push(style)
    else if (style.cssText) chunks.push(style.cssText)
  }

  if (atomic.length > 0) {
    const atomicCss = compileRuntimeAtomicStyles(atomic).css
    if (atomicCss) chunks.push(atomicCss)
  }

  const cssText = chunks.join('\n')
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

/** Reads the complete generated runtime stylesheet text. */
export function getCssText(): string {
  if (hasDocument()) {
    const style = findStyleElement()
    if (style instanceof HTMLStyleElement) return style.textContent ?? ''
  }

  return runtime.generatedCssText
}

/** Ensures the single runtime style element exists. */
export function ensureStyleElement(): HTMLStyleElement {
  const parent = getRuntimeStyleParent()
  if (!parent) throw new Error('[Cipó] Runtime style target is disabled')

  const existing = findStyleElement(parent)
  if (existing instanceof HTMLStyleElement) {
    if (existing.parentNode && existing.nextSibling) existing.parentNode.appendChild(existing)
    return existing
  }

  const element = document.createElement('style')
  element.id = STYLE_ELEMENT_ID
  element.dataset.cipo = 'runtime'
  element.textContent = runtime.generatedCssText
  parent.appendChild(element)
  return element
}

export function hasDocument(): boolean {
  return typeof document !== 'undefined' && Boolean(document.head)
}

function rebuildRuntimeStylesheet(): void {
  const replaceableCssText = Array.from(replaceableCss.values())
    .map((cssText) => `${formatCss(cssText)}\n`)
    .join('')
  const hasCss = Boolean(staticCssText || replaceableCssText || atomicCssText)
  const header = runtime.config.layers && hasCss ? `${getLayerDeclaration()}\n` : ''
  runtime.layerHeaderInserted = Boolean(header)
  runtime.generatedCssText = `${header}${staticCssText}${replaceableCssText}${atomicCssText}`

  if (!hasDocument() || runtimeStyleTarget === null) return
  const style = ensureStyleElement()
  if (style.textContent !== runtime.generatedCssText) style.textContent = runtime.generatedCssText
}

function getRuntimeStyleParent(): HTMLElement | ShadowRoot | null {
  if (runtimeStyleTarget === null) return null
  if (typeof ShadowRoot !== 'undefined' && runtimeStyleTarget instanceof ShadowRoot) return runtimeStyleTarget
  if (typeof Document !== 'undefined' && runtimeStyleTarget instanceof Document) return runtimeStyleTarget.head
  if (typeof HTMLElement !== 'undefined' && runtimeStyleTarget instanceof HTMLElement) return runtimeStyleTarget
  return document.head
}

function findStyleElement(parent = getRuntimeStyleParent()): HTMLStyleElement | null {
  if (!parent) return null
  if (
    (typeof HTMLElement !== 'undefined' && parent instanceof HTMLElement) ||
    (typeof ShadowRoot !== 'undefined' && parent instanceof ShadowRoot)
  ) {
    const existing = parent.querySelector?.(`#${STYLE_ELEMENT_ID}`)
    return existing instanceof HTMLStyleElement ? existing : null
  }

  const existing = document.getElementById(STYLE_ELEMENT_ID)
  return existing instanceof HTMLStyleElement ? existing : null
}

function removeDocumentStyleWhenRetargeting(target: CipoRuntimeStyleTarget | undefined): void {
  if (target === undefined || (typeof Document !== 'undefined' && target instanceof Document)) return

  const existing = document.getElementById(STYLE_ELEMENT_ID)
  if (existing instanceof HTMLStyleElement && existing.parentElement === document.head) existing.remove()
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
