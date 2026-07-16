import { finalizeAtomicArtifacts } from '@rodkisten/cipo/compiler-atomic-program'
import { STYLE_ELEMENT_ID } from '@rodkisten/cipo/constants'
import { formatCss, getLayerDeclaration } from '@rodkisten/cipo/format'
import { runtime } from '@rodkisten/cipo/runtime'
import type { CipoCssArtifact, CipoInjectableStyleArtifact, CipoInjectStyleOptions } from '@rodkisten/cipo/types'
import { hashString, normalizeCss } from '@rodkisten/cipo/utils'

export type CipoRuntimeStyleTarget = HTMLElement | ShadowRoot | Document | null

let runtimeStyleTarget: CipoRuntimeStyleTarget | undefined
let staticCssText = ''
let atomicCssText = ''
const atomicArtifacts = new Set<CipoCssArtifact>()

/**
 * Injects non-atomic CSS into the single runtime stylesheet sink.
 *
 * @remarks
 * Component artifacts do not call this path when thresholded atomization is
 * enabled. They are registered through `registerAtomicArtifact()` so Cipó can
 * rebuild only the atomic portion of the same stylesheet when a declaration
 * reaches its promotion threshold.
 */
export function insertCss(cssText: string): void {
  if (!cssText || !cssText.trim()) return
  ensureSharedStateFresh()

  const style = hasDocument() && runtimeStyleTarget !== null ? ensureStyleElement() : null
  if (runtime.config.layers) runtime.layerHeaderInserted = true

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

  if (changed) rebuildRuntimeCss(style)
}

/**
 * Registers a component artifact in the process-wide atomic program.
 *
 * Every Cipó/Fábrica Elements styled component reaches this collector by
 * default. The resulting CSS is recomputed from the complete artifact set, so a
 * second use can replace two scoped fallbacks with one shared atomic rule.
 */
export function registerAtomicArtifact(artifact: CipoCssArtifact): void {
  ensureSharedStateFresh()
  const size = atomicArtifacts.size
  atomicArtifacts.add(artifact)
  if (atomicArtifacts.size === size) return
  syncAtomicStylesheet()
}

/** Rebuilds the shared atomic stylesheet from all currently registered artifacts. */
export function syncAtomicStylesheet(): string {
  ensureSharedStateFresh()
  const program = finalizeAtomicArtifacts(Array.from(atomicArtifacts), runtime.config.atomic.minUses)
  replaceAtomicCss(program.cssText)
  return program.cssText
}

/** Returns a snapshot of artifacts contributing to the shared atomic sheet. */
export function getRegisteredAtomicArtifacts(): readonly CipoCssArtifact[] {
  ensureSharedStateFresh()
  return Object.freeze(Array.from(atomicArtifacts))
}

/** Replaces only the atomic section while preserving theme/global/runtime CSS. */
export function replaceAtomicCss(cssText: string): void {
  ensureSharedStateFresh()
  atomicCssText = cssText.trim() ? `${cssText.trim()}\n` : ''
  if (runtime.config.layers && atomicCssText) runtime.layerHeaderInserted = true
  const style = hasDocument() && runtimeStyleTarget !== null ? ensureStyleElement() : null
  rebuildRuntimeCss(style)
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
 * Injects style artifacts into one target using one stylesheet element.
 *
 * Atomic artifacts are finalized together before insertion. This is the same
 * aggregation used by the runtime registry, which means passing
 * `styled.registry.cssArtifacts` produces a single shared atomic stylesheet
 * instead of concatenating one component stylesheet per `styled` declaration.
 */
export function injectStyle(target: HTMLElement | ShadowRoot | Document, styles: CipoInjectableStyleArtifact | readonly CipoInjectableStyleArtifact[], options: CipoInjectStyleOptions = {}): HTMLStyleElement {
  const list = Array.isArray(styles) ? styles : [styles]
  const atomic: CipoCssArtifact[] = []
  const chunks: string[] = []
  let atomicInsertIndex = -1

  for (let index = 0; index < list.length; index += 1) {
    const style = list[index]
    if (style.kind === 'cipo.css') {
      if (atomicInsertIndex < 0) atomicInsertIndex = chunks.length
      atomic.push(style)
      continue
    }
    chunks.push(style.cssText)
  }

  if (atomic.length > 0) {
    const atomicSheet = finalizeAtomicArtifacts(atomic, runtime.config.atomic.minUses).cssText
    if (atomicSheet) chunks.splice(atomicInsertIndex < 0 ? chunks.length : atomicInsertIndex, 0, atomicSheet)
  }

  const cssText = chunks.filter(Boolean).join('\n')
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
  parent.appendChild(element)
  return element
}

export function hasDocument(): boolean {
  return typeof document !== 'undefined' && Boolean(document.head)
}

function rebuildRuntimeCss(style: HTMLStyleElement | null): void {
  const header = runtime.config.layers && runtime.layerHeaderInserted
    ? `${getLayerDeclaration()}\n`
    : ''
  runtime.generatedCssText = `${header}${staticCssText}${atomicCssText}`
  if (style && style.textContent !== runtime.generatedCssText) style.textContent = runtime.generatedCssText
}

/**
 * Lazily observes the public reset contract without coupling this module back to
 * index.ts. `reset()` clears generatedCssText and insertedCss; the next style
 * operation treats that combination as a fresh stylesheet epoch.
 */
function ensureSharedStateFresh(): void {
  if (runtime.generatedCssText || runtime.insertedCss.size > 0) return
  if (!staticCssText && !atomicCssText && atomicArtifacts.size === 0) return
  staticCssText = ''
  atomicCssText = ''
  atomicArtifacts.clear()
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
