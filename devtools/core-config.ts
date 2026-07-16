import type {
  ConfigChangeListener,
  ConfigLike,
  StringKey,
} from "@rodkisten/devtools/types";
import { debugTrace, debugWarn } from "@rodkisten/devtools/core-debug";
import { Emitter } from "@rodkisten/devtools/core-emitter";
import { objectKeys } from "@rodkisten/nascente";

type ConfigEvents<Values extends object> = {
  change: [
    key: StringKey<Values>,
    value: Values[StringKey<Values>],
    previous: Values[StringKey<Values>],
  ];
};

const memoryStorage = new Map<string, string>();

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    const testKey = "__roderuda-storage-test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return localStorage;
  } catch (error) {
    debugWarn("config", "localStorage fallback", {
      error: error instanceof Error ? error.message : String(error),
    });

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

export class ConfigStore<Values extends object>
  extends Emitter<ConfigEvents<Values>>
  implements ConfigLike<Values> {
  private readonly storage = safeLocalStorage();
  private readonly storageKey: string;
  private values: Values;

  constructor(name: string, private readonly defaults: Values) {
    super();
    this.storageKey = `roderuda:${name}`;
    this.values = this.read();
  }

  get<Key extends StringKey<Values>>(key: Key): Values[Key] {
    return this.values[key];
  }

  set<Key extends StringKey<Values>>(key: Key, value: Values[Key]): void {
    const previous = this.values[key];
    if (Object.is(previous, value)) return;

    this.values = { ...this.values, [key]: value };
    this.write();
    this.emit("change", key, value, previous);
  }

  patch(values: Partial<Values>): void {
    for (const key of objectKeys(values) as StringKey<Values>[]) {
      const value = values[key];
      if (value !== undefined) this.set(key, value as Values[typeof key]);
    }
  }

  reset(): void {
    const previous = this.values;
    this.values = { ...this.defaults };
    this.storage.removeItem(this.storageKey);

    for (const key of objectKeys(this.values) as StringKey<Values>[]) {
      this.emit("change", key, this.values[key], previous[key]);
    }
  }

  snapshot(): Readonly<Values> {
    debugTrace("config", "snapshot", { storageKey: this.storageKey });
    return Object.freeze({ ...this.values });
  }

  override on(event: "change", listener: ConfigChangeListener<Values>): this {
    return super.on(event, listener);
  }

  override off(event: "change", listener: ConfigChangeListener<Values>): this {
    return super.off(event, listener);
  }

  private read(): Values {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return { ...this.defaults };

      const parsed = JSON.parse(stored) as Partial<Values>;
      return { ...this.defaults, ...parsed };
    } catch {
      return { ...this.defaults };
    }
  }

  private write(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.values));
    } catch (error) {
      debugWarn("config", "write failed", {
        storageKey: this.storageKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
