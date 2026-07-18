import { runtime, runWithRuntimeState } from '../runtime'
import type { RuntimeConfig, RuntimeState } from '../types'
import { hashString } from '../utils'
import type { CipoCompilerContext, CreateCipoCompilerContextOptions } from './contracts'

let compilerContextCounter = 0

/** Creates an isolated compiler session cloned from the current runtime baseline. */
export function createCompilerContext(
  options: CreateCipoCompilerContextOptions = {},
): CipoCompilerContext {
  const source = options.source ?? runtime
  const id = options.id ?? `compile-${hashString(`${Date.now()}|${compilerContextCounter += 1}`)}`
  return {
    id,
    state: cloneRuntimeState(source),
    diagnostics: [],
  }
}

/**
 * Executes synchronous compiler work against an isolated runtime snapshot.
 *
 * @remarks
 * The compiler state is selected through the runtime module's live ESM binding; the application's
 * default runtime object is never overwritten. Nested compiler sessions restore their parent session
 * in `finally`, so exceptions cannot leak configuration, registries or caches across compilation units.
 */
export function runInCompilerContext<T>(context: CipoCompilerContext, operation: () => T): T {
  return runWithRuntimeState(context.state, operation)
}

/** Deep-enough clone for compiler isolation while retaining immutable registry values/functions. */
export function cloneRuntimeState(source: RuntimeState): RuntimeState {
  return {
    config: cloneRuntimeConfig(source.config),
    sheet: null,
    // Compiler sessions inherit semantic registries/configuration, never runtime output or warm JIT caches.
    insertedCss: new Set(),
    atomicCache: new Map(),
    artifactCache: new Map(),
    inlineCache: new Map(),
    debugAtoms: new Map(),
    themeKeys: new Set(source.themeKeys),
    shortThemeTokens: new Map(source.shortThemeTokens),
    ambiguousThemeTokens: new Map(source.ambiguousThemeTokens),
    helperRegistry: new Map(source.helperRegistry),
    nativeFunctionRegistry: new Set(source.nativeFunctionRegistry),
    aliasRegistry: new Map(source.aliasRegistry),
    propertyAliasRegistry: new Map(source.propertyAliasRegistry),
    propertyDefinitions: new Map(source.propertyDefinitions),
    registeredProperties: new Map(),
    variantRegistry: new Map(source.variantRegistry),
    warningSink: [],
    generatedCssText: '',
    layerHeaderInserted: false,
    themeVersion: source.themeVersion,
    configVersion: source.configVersion,
    registryVersion: source.registryVersion,
    atomicUsageCounts: new Map(),
    atomicSingleUseFallbacks: new Map(),
  }
}

function cloneRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  return {
    ...config,
    debugOptions: { ...config.debugOptions },
    breakpoints: { ...config.breakpoints },
    rem: { ...config.rem },
    jit: { ...config.jit },
    atomic: { ...config.atomic },
    scope: { ...config.scope },
    debugOverlay: { ...config.debugOverlay },
  }
}
