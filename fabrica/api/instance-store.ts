const INSTANCE_MAP = Symbol.for("rod.fabrica.instances");
const INSTANCE_COUNTER = Symbol.for("rod.fabrica.instance-counter");

type GlobalInstanceState = typeof globalThis &
  Record<PropertyKey, unknown>;

let cachedGlobalInstances: Map<string, unknown> | null = null;

/** Normalizes realm-wide instance keys without allocating for clean strings. */
export function normalizeInstanceKey(key: string): string {
  if (typeof key === "string") {
    const length = key.length;

    if (
      length > 0 &&
      key.charCodeAt(0) > 32 &&
      key.charCodeAt(length - 1) > 32
    ) {
      return key;
    }
  }

  return String(key || "").trim();
}

/** Reads one realm-local named instance without coupling the store to its API. */
export function getNamedInstance<Value>(key: string): Value | undefined {
  return getGlobalInstanceMap().get(key) as Value | undefined;
}

/** Stores one realm-local named instance. */
export function setNamedInstance(key: string, value: unknown): void {
  getGlobalInstanceMap().set(key, value);
}

/** Creates a monotonically increasing debug identifier for an instance. */
export function createInstanceId(name: string): string {
  const target = globalThis as GlobalInstanceState;
  const next = Number(target[INSTANCE_COUNTER] || 0) + 1;
  target[INSTANCE_COUNTER] = next;
  return `fabrica:${name}:${next}`;
}

function getGlobalInstanceMap(): Map<string, unknown> {
  if (cachedGlobalInstances) return cachedGlobalInstances;

  const target = globalThis as GlobalInstanceState;
  let instances = target[INSTANCE_MAP] as Map<string, unknown> | undefined;

  if (!instances) {
    instances = new Map<string, unknown>();
    Object.defineProperty(target, INSTANCE_MAP, {
      configurable: true,
      enumerable: false,
      value: instances,
    });
  }

  cachedGlobalInstances = instances;
  return instances;
}
