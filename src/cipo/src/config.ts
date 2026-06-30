import { DEFAULT_BASE_FONT_SIZE } from './constants'
import { clearJitCaches, runtime } from './runtime'
import type { CipoAtomicPromotionConfig, CipoConfig, CipoDebugConfig, CipoDebugOverlayConfig, CipoJitConfig, CipoRemConfig, CipoScopeConfig, RuntimeConfig } from './types'
import { theme } from './theme'
import { configureCss } from './config-css'

/**
 * Configures the Cipó runtime.
 *
 * @remarks
 * Configuration is a cold-path operation. Reapplying an equivalent patch is a
 * no-op: the runtime object is preserved, versions are not bumped and JIT caches
 * stay warm. Nested rem/JIT/breakpoint objects are only allocated when one of
 * their values actually changes.
 *
 * @param config - Runtime config patch.
 * @returns Nothing.
 */
export function configure(config: CipoConfig): void {
  const current = runtime.config
  const nextDebug = normalizeDebugConfig(config.debug, current.debugOptions)
  const nextRem = normalizeRemConfig(config.rem, config.baseFontSize, current.rem)
  const nextJit = normalizeJitConfig(config.jit, current.jit)
  const nextBreakpoints = mergeBreakpoints(current.breakpoints, config.breakpoints)
  const nextAtomic = normalizeAtomicConfig(config.atomic, current.atomic)
  const nextScope = normalizeScopeConfig(config.scope, current.scope)
  const nextDebugOverlay = normalizeDebugOverlayConfig(config.debugOverlay, current.debugOverlay)

  const next: RuntimeConfig = {
    prefix: config.prefix ?? current.prefix,
    debug: nextDebug.enabled,
    debugOptions: nextDebug,
    important: config.important ?? current.important,
    adapter: config.adapter ?? current.adapter,
    darkSelector: config.darkSelector ?? current.darkSelector,
    themeRootSelector: config.themeRootSelector ?? current.themeRootSelector,
    breakpoints: nextBreakpoints,
    minify: config.minify ?? config.output?.minify ?? current.minify,
    layers: config.layers ?? config.output?.layers ?? current.layers,
    rem: nextRem,
    colorMode: config.colorMode ?? current.colorMode,
    themeValidation: config.themeValidation ?? current.themeValidation,
    registerTypedThemeProperties:
      config.registerTypedThemeProperties ?? current.registerTypedThemeProperties,
    jit: nextJit,
    atomic: nextAtomic,
    scope: nextScope,
    debugOverlay: nextDebugOverlay,
    onWarning: config.onWarning ?? current.onWarning,
  }

  if (!sameRuntimeConfig(current, next)) {
    runtime.config = next
    runtime.configVersion += 1
    clearJitCaches()
  }

  if (config.theme) theme(config.theme)
}

/** Ergonomic alias for configure(). */
Object.assign(configure, { css: configureCss })

export function setup(config: CipoConfig): void {
  configure(config)
}

Object.assign(setup, { css: configureCss })


function normalizeAtomicConfig(
  atomic: boolean | CipoAtomicPromotionConfig | undefined,
  current: Required<CipoAtomicPromotionConfig>,
): Required<CipoAtomicPromotionConfig> {
  if (atomic === undefined) return current
  const minUses = typeof atomic === 'boolean' ? (atomic ? 1 : Number.POSITIVE_INFINITY) : atomic.minUses ?? current.minUses
  const normalized = Number.isFinite(minUses) ? Math.max(1, Math.trunc(minUses)) : Number.POSITIVE_INFINITY
  return normalized === current.minUses ? current : { minUses: normalized }
}

function normalizeScopeConfig(
  scope: string | CipoScopeConfig | undefined,
  current: Required<CipoScopeConfig>,
): Required<CipoScopeConfig> {
  if (scope === undefined) return current
  const selector = typeof scope === 'string' ? scope : scope.selector ?? current.selector
  const strategy = typeof scope === 'string'
    ? inferScopeStrategy(scope)
    : scope.strategy ?? inferScopeStrategy(selector)
  const next = { strategy, selector: selector || '' } as Required<CipoScopeConfig>
  return next.strategy === current.strategy && next.selector === current.selector ? current : next
}

function inferScopeStrategy(selector: string): Required<CipoScopeConfig>['strategy'] {
  const value = String(selector || '').trim()
  if (!value) return 'none'
  if (value === ':host' || value.startsWith(':host')) return 'host'
  if (value.startsWith('#')) return 'id'
  if (value.startsWith('.')) return 'where'
  return 'selector'
}

function normalizeDebugOverlayConfig(
  debugOverlay: boolean | CipoDebugOverlayConfig | undefined,
  current: RuntimeConfig['debugOverlay'],
): RuntimeConfig['debugOverlay'] {
  if (debugOverlay === undefined) return current
  if (typeof debugOverlay === 'boolean') {
    return debugOverlay === current.enabled ? current : { ...current, enabled: debugOverlay }
  }
  const next = {
    enabled: debugOverlay.enabled ?? current.enabled,
    target: debugOverlay.target ?? current.target,
    position: debugOverlay.position ?? current.position,
  } as Required<CipoDebugOverlayConfig>
  return next.enabled === current.enabled && next.target === current.target && next.position === current.position ? current : next
}

function normalizeDebugConfig(
  debug: boolean | CipoDebugConfig | undefined,
  current: Required<CipoDebugConfig>,
): Required<CipoDebugConfig> {
  if (debug === undefined) return current

  if (typeof debug === 'boolean') {
    const readableClassNames = debug ? true : current.readableClassNames
    if (debug === current.enabled && readableClassNames === current.readableClassNames) return current
    return {
      enabled: debug,
      readableClassNames,
      maxClassLabelLength: current.maxClassLabelLength,
      includeContext: current.includeContext,
    }
  }

  const enabled = debug.enabled ?? current.enabled
  const readableClassNames = debug.readableClassNames ?? (enabled ? true : current.readableClassNames)
  const maxClassLabelLength = clampDebugLabelLength(debug.maxClassLabelLength ?? current.maxClassLabelLength)
  const includeContext = debug.includeContext ?? current.includeContext

  if (
    enabled === current.enabled &&
    readableClassNames === current.readableClassNames &&
    maxClassLabelLength === current.maxClassLabelLength &&
    includeContext === current.includeContext
  ) {
    return current
  }

  return { enabled, readableClassNames, maxClassLabelLength, includeContext }
}

function clampDebugLabelLength(value: number): number {
  if (!Number.isFinite(value)) return 72
  return Math.min(160, Math.max(24, Math.trunc(value)))
}

function normalizeRemConfig(
  rem: boolean | CipoRemConfig | undefined,
  baseFontSize: number | undefined,
  current: Required<CipoRemConfig>,
): Required<CipoRemConfig> {
  if (rem === undefined && baseFontSize === undefined) return current

  const enabled = typeof rem === 'boolean' ? rem : rem?.enabled ?? current.enabled
  const nextBaseFontSize =
    typeof rem === 'object'
      ? rem.baseFontSize ?? baseFontSize ?? current.baseFontSize ?? DEFAULT_BASE_FONT_SIZE
      : baseFontSize ?? current.baseFontSize ?? DEFAULT_BASE_FONT_SIZE

  if (enabled === current.enabled && nextBaseFontSize === current.baseFontSize) return current
  return { enabled, baseFontSize: nextBaseFontSize }
}

function normalizeJitConfig(
  jit: boolean | CipoJitConfig | undefined,
  current: Required<CipoJitConfig>,
): Required<CipoJitConfig> {
  if (jit === undefined) return current

  const enabled = typeof jit === 'boolean' ? jit : jit.enabled ?? current.enabled
  const cache = typeof jit === 'boolean' ? current.cache : jit.cache ?? current.cache
  const maxEntries = typeof jit === 'boolean' ? current.maxEntries : jit.maxEntries ?? current.maxEntries
  const debug = typeof jit === 'boolean' ? current.debug : jit.debug ?? current.debug

  if (
    enabled === current.enabled &&
    cache === current.cache &&
    maxEntries === current.maxEntries &&
    debug === current.debug
  ) {
    return current
  }

  return { enabled, cache, maxEntries, debug }
}

function mergeBreakpoints(
  current: Readonly<Record<string, string | null>>,
  patch: Readonly<Record<string, string | null>> | undefined,
): Readonly<Record<string, string | null>> {
  if (!patch) return current

  let changed = false
  for (const key in patch) {
    if (!Object.is(current[key], patch[key])) {
      changed = true
      break
    }
  }

  return changed ? { ...current, ...patch } : current
}

function sameRuntimeConfig(left: RuntimeConfig, right: RuntimeConfig): boolean {
  return (
    left.prefix === right.prefix &&
    left.debug === right.debug &&
    left.debugOptions === right.debugOptions &&
    left.important === right.important &&
    Object.is(left.adapter, right.adapter) &&
    left.darkSelector === right.darkSelector &&
    left.themeRootSelector === right.themeRootSelector &&
    left.breakpoints === right.breakpoints &&
    left.minify === right.minify &&
    left.layers === right.layers &&
    left.rem === right.rem &&
    left.colorMode === right.colorMode &&
    left.themeValidation === right.themeValidation &&
    left.registerTypedThemeProperties === right.registerTypedThemeProperties &&
    left.jit === right.jit &&
    left.atomic === right.atomic &&
    left.scope === right.scope &&
    left.debugOverlay === right.debugOverlay &&
    left.onWarning === right.onWarning
  )
}
