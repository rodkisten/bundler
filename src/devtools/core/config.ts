import type { ConfigLike } from "../types";
import { debugLog, debugTrace, debugWarn } from "./debug";
import { Emitter } from "./emitter";

type ConfigEvents = {
  change: [key: string, value: unknown, previous: unknown];
};

const memoryStorage = new Map<string, string>();

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    const testKey = "__roderuda-storage-test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    debugTrace("config", "localStorage available");
    return localStorage;
  } catch (error) {
    debugWarn("config", "localStorage fallback", { error: error instanceof Error ? error.message : String(error) });
    return {
      getItem(key: string) {
        return memoryStorage.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        memoryStorage.set(key, value);
      },
      removeItem(key: string) {
        memoryStorage.delete(key);
      },
    };
  }
}

export class ConfigStore<T extends object = Record<string, unknown>>
  extends Emitter<ConfigEvents>
  implements ConfigLike {
  private readonly storage = safeLocalStorage();
  private readonly storageKey: string;
  private values: T;

  constructor(name: string, private readonly defaults: T) {
    super();
    this.storageKey = `roderuda:${name}`;
    this.values = this.read();
    debugLog("config", "created", { name, storageKey: this.storageKey, keys: Object.keys(this.values as Record<string, unknown>) });
  }

  get<K extends keyof T>(key: K): T[K];
  get<R = unknown>(key: string): R;
  get(key: string): unknown {
    const value = (this.values as Record<string, unknown>)[key];
    debugTrace("config", "get", { storageKey: this.storageKey, key, value });
    return value;
  }

  set<K extends keyof T>(key: K, value: T[K]): void;
  set(key: string, value: unknown): void;
  set(key: string, value: unknown): void {
    const previous = (this.values as Record<string, unknown>)[key];
    if (Object.is(previous, value)) {
      debugTrace("config", "set skipped", { storageKey: this.storageKey, key, value });
      return;
    }
    this.values = { ...this.values, [key]: value };
    this.write();
    debugLog("config", "set", { storageKey: this.storageKey, key, value, previous });
    this.emit("change", key, value, previous);
  }

  patch(values: Partial<T>): void {
    debugLog("config", "patch", { storageKey: this.storageKey, keys: Object.keys(values as Record<string, unknown>) });
    for (const [key, value] of Object.entries(values)) this.set(key, value);
  }

  reset(): void {
    const previous = this.values;
    this.values = { ...this.defaults };
    this.storage.removeItem(this.storageKey);
    debugWarn("config", "reset", { storageKey: this.storageKey });
    for (const [key, value] of Object.entries(this.values)) {
      this.emit("change", key, value, (previous as Record<string, unknown>)[key]);
    }
  }

  snapshot(): Readonly<T> {
    debugTrace("config", "snapshot", { storageKey: this.storageKey });
    return Object.freeze({ ...this.values });
  }

  private read(): T {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return { ...this.defaults };
      const parsed = JSON.parse(stored) as Partial<T>;
      debugLog("config", "read stored", { storageKey: this.storageKey, keys: Object.keys(parsed as Record<string, unknown>) });
      return { ...this.defaults, ...parsed };
    } catch (error) {
      debugWarn("config", "read failed", { storageKey: this.storageKey, error: error instanceof Error ? error.message : String(error) });
      return { ...this.defaults };
    }
  }

  private write(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.values));
      debugTrace("config", "write", { storageKey: this.storageKey });
    } catch (error) {
      debugWarn("config", "write failed", { storageKey: this.storageKey, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
