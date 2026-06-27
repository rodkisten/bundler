import type { ComponentRegistry, FabricaRuntimeContext } from "./types";

let activeRuntime: FabricaRuntimeContext | undefined;
let defaultRuntime: FabricaRuntimeContext | undefined;

/** Sets the singleton fallback used by compatibility exports. */
export function setDefaultFabricaRuntime(runtime: FabricaRuntimeContext): void {
  defaultRuntime = runtime;
}

/** Returns the currently rendering runtime, if any. */
export function getActiveFabricaRuntime(): FabricaRuntimeContext | undefined {
  return activeRuntime;
}

/** Returns the active runtime or the default singleton runtime. */
export function getCurrentFabricaRuntime(): FabricaRuntimeContext {
  const runtime = activeRuntime ?? defaultRuntime;
  if (!runtime) {
    throw new Error("[Fabrica] No runtime is available. Create or import a Fabrica instance first.");
  }
  return runtime;
}

/** Runs synchronous renderer work with an instance-local registry/context. */
export function runWithFabricaRuntime<T>(
  runtime: FabricaRuntimeContext,
  callback: () => T,
): T {
  const previous = activeRuntime;
  activeRuntime = runtime;

  try {
    return callback();
  } finally {
    activeRuntime = previous;
  }
}

/** Uses the active runtime when nested, otherwise enters the default runtime. */
export function runWithCurrentFabricaRuntime<T>(callback: () => T): T {
  if (activeRuntime) return callback();
  return runWithFabricaRuntime(getCurrentFabricaRuntime(), callback);
}

/** Resolves a named component from the active/default registry. */
export function resolveRuntimeComponent(name: string): ReturnType<ComponentRegistry["resolve"]> {
  return getCurrentFabricaRuntime().registry.resolve(name);
}
