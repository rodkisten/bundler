import { DEFAULT_BASE_FONT_SIZE } from './constants'
import { clearJitCaches, runtime } from './runtime'
import type { CipoConfig, CipoJitConfig, CipoRemConfig } from './types'
import { theme } from './theme'

/**
 * Configures the Cipó runtime.
 *
 * @remarks
 * This function preserves the original `configure()` API and adds the new
 * merged `theme` key. It deliberately accepts both flat flags and nested config
 * because userscript usage benefits from ergonomic one-call setup.
 *
 * @param config - Runtime config patch.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * configure({
 *   prefix: 'rod',
 *   minify: false,
 *   layers: true,
 *   rem: { enabled: true, baseFontSize: 16 },
 *   theme: { colors: { brand: '#f97316' } },
 * })
 * ```
 */
export function configure(config: CipoConfig): void {
  const nextRem = normalizeRemConfig(config.rem, config.baseFontSize)
  const nextJit = normalizeJitConfig(config.jit)

  runtime.config = {
    prefix: config.prefix ?? runtime.config.prefix,
    debug: config.debug ?? runtime.config.debug,
    important: config.important ?? runtime.config.important,
    adapter: config.adapter ?? runtime.config.adapter,
    darkSelector: config.darkSelector ?? runtime.config.darkSelector,
    themeRootSelector: config.themeRootSelector ?? runtime.config.themeRootSelector,
    breakpoints: {
      ...runtime.config.breakpoints,
      ...(config.breakpoints ?? {}),
    },
    minify: config.minify ?? config.output?.minify ?? runtime.config.minify,
    layers: config.layers ?? config.output?.layers ?? runtime.config.layers,
    rem: nextRem ?? runtime.config.rem,
    colorMode: config.colorMode ?? runtime.config.colorMode,
    jit: nextJit ?? runtime.config.jit,
    onWarning: config.onWarning ?? runtime.config.onWarning,
  }

  runtime.configVersion += 1
  clearJitCaches()

  if (config.theme) {
    theme(config.theme)
  }
}

/**
 * Ergonomic alias for configure().
 *
 * @param config - Runtime config patch.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * setup({ theme: { spacing: '0.25rem' } })
 * ```
 */
export function setup(config: CipoConfig): void {
  configure(config)
}

function normalizeRemConfig(rem: boolean | CipoRemConfig | undefined, baseFontSize: number | undefined): Required<CipoRemConfig> | null {
  if (rem === undefined && baseFontSize === undefined) return null
  if (typeof rem === 'boolean') return { enabled: rem, baseFontSize: baseFontSize ?? runtime.config.rem.baseFontSize }
  return {
    enabled: rem?.enabled ?? runtime.config.rem.enabled,
    baseFontSize: rem?.baseFontSize ?? baseFontSize ?? runtime.config.rem.baseFontSize ?? DEFAULT_BASE_FONT_SIZE,
  }
}

function normalizeJitConfig(jit: boolean | CipoJitConfig | undefined): Required<CipoJitConfig> | null {
  if (jit === undefined) return null
  if (typeof jit === 'boolean') return { ...runtime.config.jit, enabled: jit }
  return {
    enabled: jit.enabled ?? runtime.config.jit.enabled,
    cache: jit.cache ?? runtime.config.jit.cache,
    maxEntries: jit.maxEntries ?? runtime.config.jit.maxEntries,
    debug: jit.debug ?? runtime.config.jit.debug,
  }
}
