import { STYLE_ELEMENT_ID } from './constants'
import { runtime } from './runtime'

let pending = false

export function hydrateDocumentStartStyles(): void {
  if (typeof document === 'undefined') return
  if (hydrate()) return
  if (pending) return
  pending = true

  const onReady = () => {
    if (!hydrate()) return
    pending = false
    document.removeEventListener('readystatechange', onReady)
    document.removeEventListener('DOMContentLoaded', onReady)
  }

  document.addEventListener('readystatechange', onReady)
  document.addEventListener('DOMContentLoaded', onReady, { once: true })
  queueMicrotask(onReady)
}

function hydrate(): boolean {
  if (!document.head || !runtime.generatedCssText) return false
  if (document.getElementById(STYLE_ELEMENT_ID)) return true

  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.dataset.cipo = 'runtime'
  style.textContent = runtime.generatedCssText
  document.head.append(style)
  return true
}
