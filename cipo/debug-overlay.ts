import { runtime } from './runtime'
import { getCssText } from './injection'

/** Snapshot returned by Cipó's lightweight debug observatory. */
export interface CipoDebugOverlayStats {
  readonly totalAtoms: number
  readonly insertedRules: number
  readonly promotedAtoms: number
  readonly singleUseFallbacks: number
  readonly reusedAtoms: number
  readonly cssBytes: number
}

/** Returns allocation-light stats for UI panels and tests. */
export function getDebugOverlayStats(): CipoDebugOverlayStats {
  let reusedAtoms = 0
  for (const count of runtime.atomicUsageCounts.values()) if (count > 1) reusedAtoms += 1
  return {
    totalAtoms: runtime.atomicCache.size,
    insertedRules: runtime.insertedCss.size,
    promotedAtoms: Math.max(0, runtime.atomicUsageCounts.size - runtime.atomicSingleUseFallbacks.size),
    singleUseFallbacks: runtime.atomicSingleUseFallbacks.size,
    reusedAtoms,
    cssBytes: getCssText().length,
  }
}

/** Installs or updates a tiny mobile-friendly debug panel. */
export function installDebugOverlay(target: Document | ShadowRoot | HTMLElement = globalThis.document): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const root = target instanceof Document ? target.documentElement : target
  const owner = target instanceof Document ? target : document
  let panel = (root as ParentNode).querySelector?.('[data-cipo-debug-overlay="true"]') as HTMLElement | null
  if (!panel) {
    panel = owner.createElement('aside')
    panel.dataset.cipoDebugOverlay = 'true'
    panel.style.cssText = [
      'position:fixed','z-index:2147483646','right:8px','bottom:8px','max-width:min(320px,calc(100vw - 16px))',
      'padding:10px','border:1px solid rgb(125 211 252 / .35)','border-radius:14px','background:rgb(2 6 23 / .92)',
      'color:#e5e7eb','font:12px/1.35 ui-monospace,monospace','box-shadow:0 18px 50px rgb(0 0 0 / .45)',
      'backdrop-filter:blur(14px)','pointer-events:auto'
    ].join(';')
    ;(root as HTMLElement).appendChild(panel)
  }
  const stats = getDebugOverlayStats()
  panel.innerHTML = `<strong>🌿 Cipó Debug</strong><br>atoms: ${stats.totalAtoms}<br>reused: ${stats.reusedAtoms}<br>promoted: ${stats.promotedAtoms}<br>single-use: ${stats.singleUseFallbacks}<br>css: ${stats.cssBytes} bytes`
  return panel
}
