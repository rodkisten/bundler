import { runtime } from './runtime'
import type { CipoAliasValue, CipoHelper, PropertyAliasDefinition } from './types'

/** Registers a helper and invalidates compiler/runtime caches that depend on helper expansion. */
export function registerHelper(name: string, helper: CipoHelper): void {
  if (Object.is(runtime.helperRegistry.get(name), helper)) return
  runtime.helperRegistry.set(name, helper)
  runtime.registryVersion += 1
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
}

/** Registers a CSS-native function name that must pass through helper resolution unchanged. */
export function registerNativeFunction(name: string): void {
  const value = String(name || '').trim().toLowerCase()
  if (!value || runtime.nativeFunctionRegistry.has(value)) return
  runtime.nativeFunctionRegistry.add(value)
  runtime.registryVersion += 1
}

/** Registers a standalone declaration alias. */
export function registerAlias(name: string, value: CipoAliasValue): void {
  if (Object.is(runtime.aliasRegistry.get(name), value)) return
  runtime.aliasRegistry.set(name, value)
  runtime.registryVersion += 1
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
}

/** Registers or overrides a property alias. */
export function registerProperty(name: string, definition: PropertyAliasDefinition): void {
  if (Object.is(runtime.propertyAliasRegistry.get(name), definition)) return
  runtime.propertyAliasRegistry.set(name, definition)
  runtime.registryVersion += 1
  runtime.artifactCache.clear()
  runtime.inlineCache.clear()
}

/** Registers a selector/context variant. */
export function registerVariant(name: string, selectors: readonly string[]): void {
  if (Object.is(runtime.variantRegistry.get(name), selectors)) return
  runtime.variantRegistry.set(name, selectors)
  runtime.registryVersion += 1
  runtime.artifactCache.clear()
}
