import { DEFAULT_BASE_FONT_SIZE } from './constants'
import { clearJitCaches, runtime } from './runtime'
import type { CipoConfig, CipoJitConfig, CipoRemConfig, RuntimeConfig } from './types'
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
  const nextRem = normalizeRemConfig(config.rem, config.baseFontSize, current.rem)
  const nextJit = normalizeJitConfig(config.jit, current.jit)
  const nextBreakpoints = mergeBreakpoints(current.breakpoints, config.breakpoints)

  const next: RuntimeConfig = {
    prefix: config.prefix ?? current.prefix,
    debug: config.debug ?? current.debug,
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
    left.onWarning === right.onWarning
  )
}
