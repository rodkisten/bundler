import { Emitter } from "./emitter";
import type { ConfigLike } from "../types";

type ConfigEvents = {
  change: [key: string, value: unknown, previous: unknown];
};

const memoryStorage = new Map<string, string>();

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    const testKey = "__roderuda-storage-test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return localStorage;
  } catch {
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
  }

  get<K extends keyof T>(key: K): T[K];
  get<R = unknown>(key: string): R;
  get(key: string): unknown {
    return (this.values as Record<string, unknown>)[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void;
  set(key: string, value: unknown): void;
  set(key: string, value: unknown): void {
    const previous = (this.values as Record<string, unknown>)[key];
    if (Object.is(previous, value)) return;
    this.values = { ...this.values, [key]: value };
    this.write();
    this.emit("change", key, value, previous);
  }

  patch(values: Partial<T>): void {
    for (const [key, value] of Object.entries(values)) this.set(key, value);
  }

  reset(): void {
    const previous = this.values;
    this.values = { ...this.defaults };
    this.storage.removeItem(this.storageKey);
    for (const [key, value] of Object.entries(this.values)) {
      this.emit("change", key, value, (previous as Record<string, unknown>)[key]);
    }
  }

  snapshot(): Readonly<T> {
    return Object.freeze({ ...this.values });
  }

  private read(): T {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return { ...this.defaults };
      const parsed = JSON.parse(stored) as Partial<T>;
      return { ...this.defaults, ...parsed };
    } catch {
      return { ...this.defaults };
    }
  }

  private write(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.values));
    } catch {
      // Storage failures must never break the debugger.
    }
  }
}
