import { normalizeComponentName } from "../component-registry.js";
import type {
  ComponentLike,
  ComponentPack,
} from "../types.js";

/** Creates a portable named component pack without registering it anywhere. */
export function createComponentPack(
  name: string,
  components:
    | Record<string, ComponentLike>
    | ReadonlyMap<string, ComponentLike>,
): ComponentPack {
  const normalizedName = normalizeComponentName(name);

  if (!normalizedName) {
    throw new Error(
      "[Fabrica] createComponentPack() needs a non-empty name.",
    );
  }

  const entries = components instanceof Map
    ? components
    : new Map(Object.entries(components));

  for (const [componentName, component] of entries) {
    if (
      !normalizeComponentName(componentName) ||
      typeof component !== "function"
    ) {
      throw new TypeError(
        "[Fabrica] Component packs require named function components.",
      );
    }
  }

  return Object.freeze({
    __kind: "componentPack" as const,
    name: normalizedName,
    components: new Map(entries),
  });
}

/** Narrows portable component-pack values without registry side effects. */
export function isComponentPack(value: unknown): value is ComponentPack {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as ComponentPack).__kind === "componentPack"
  );
}
