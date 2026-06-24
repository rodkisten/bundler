import { DEFAULT_BASE_FONT_SIZE, DEFAULT_PREFIX } from './constants'
import type { RuntimeState } from './types'

/**
 * Central mutable runtime state.
 *
 * @remarks
 * Cipó is a runtime/JIT compiler. Keeping the state centralized makes cache
 * invalidation explicit: config/theme updates bump versions and generated atoms
 * can include those versions in their keys when needed.
 *
 * @example
 * ```ts
 * import { runtime } from './runtime'
 * runtime.config.prefix
 * // 'cipo'
 * ```
 */
export const runtime: RuntimeState = {
  config: {
    prefix: DEFAULT_PREFIX,
    debug: true,
    important: false,
    adapter: 'dom',
    darkSelector: '[data-theme="dark"]',
    themeRootSelector: ':root',
    breakpoints: {
      base: null,
      sm: '(min-width: 640px)',
      md: '(min-width: 768px)',
      lg: '(min-width: 1024px)',
      xl: '(min-width: 1280px)',
      '2xl': '(min-width: 1536px)',
    },
    minify: false,
    layers: true,
    rem: {
      enabled: true,
      baseFontSize: DEFAULT_BASE_FONT_SIZE,
    },
    colorMode: 'oklch',
    jit: {
      enabled: true,
      cache: true,
      maxEntries: 3000,
      debug: false,
    },
  },
  sheet: null,
  insertedCss: new Set(),
  atomicCache: new Map(),
  artifactCache: new Map(),
  inlineCache: new Map(),
  debugAtoms: new Map(),
  themeKeys: new Set(),
  shortThemeTokens: new Map(),
  ambiguousThemeTokens: new Map(),
  helperRegistry: new Map(),
  nativeFunctionRegistry: new Set(),
  aliasRegistry: new Map(),
  propertyAliasRegistry: new Map(),
  propertyDefinitions: new Map(),
  registeredProperties: new Map(),
  variantRegistry: new Map(),
  warningSink: [],
  generatedCssText: '',
  layerHeaderInserted: false,
  themeVersion: 0,
  configVersion: 0,
  registryVersion: 0,
}

/**
 * Clears runtime caches without removing theme knowledge.
 *
 * @remarks
 * This is used when config changes affect generated CSS but not token lookup.
 * Full public reset lives in `index.ts` and also removes the style element.
 *
 * @returns Nothing.
 */
export function clearJitCaches(): void {
  runtime.atomicCache.clear()
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
  runtime.debugAtoms.clear()
}

/**
 * Evicts the oldest inserted cache entry when a JIT map grows too large.
 *
 * @param cache - Any insertion-ordered map.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * evictIfNeeded(runtime.artifactCache)
 * ```
 */
export function evictIfNeeded(cache: Map<string, unknown>): void {
  const maxEntries = runtime.config.jit.maxEntries
  if (cache.size <= maxEntries) return
  const first = cache.keys().next().value as string | undefined
  if (first) cache.delete(first)
}
