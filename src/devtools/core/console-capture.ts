import { Emitter } from "./emitter";
import type { ConsoleLevel, ConsoleRecord } from "../types";

interface ConsoleCaptureEvents {
  record: [record: ConsoleRecord];
  clear: [];
}

type ConsoleMethod = keyof Pick<
  Console,
  | "log"
  | "debug"
  | "trace"
  | "info"
  | "warn"
  | "error"
  | "dir"
  | "table"
  | "assert"
  | "count"
  | "countReset"
  | "time"
  | "timeLog"
  | "timeEnd"
  | "group"
  | "groupCollapsed"
  | "groupEnd"
  | "clear"
>;

const methods: readonly ConsoleMethod[] = [
  "log",
  "debug",
  "trace",
  "info",
  "warn",
  "error",
  "dir",
  "table",
  "assert",
  "count",
  "countReset",
  "time",
  "timeLog",
  "timeEnd",
  "group",
  "groupCollapsed",
  "groupEnd",
  "clear",
];

type Fn = (...args: unknown[]) => void;

interface InstallOptions {
  overrideConsole?: boolean;
  catchGlobalErrors?: boolean;

  /**
   * Keeps re-applying wrappers if another script overwrites console methods.
   */
  watchdog?: boolean;

  /**
   * Prevents most later overwrites by patching Object.defineProperty,
   * Reflect.defineProperty and Object.assign for console targets.
   */
  lockConsole?: boolean;

  /**
   * Also patches Console.prototype when available.
   */
  patchPrototype?: boolean;

  /**
   * Watchdog interval in ms.
   */
  watchdogMs?: number;

  /**
   * Installs an additional page-realm bridge. This is useful for userscript
   * sandboxes where the isolated world has a different console object.
   */
  bridgePageRealm?: boolean;
}

const noop: Fn = () => undefined;

function safeBind(value: unknown): Fn {
  if (typeof value !== "function") return noop;

  try {
    return (value as Fn).bind(console);
  } catch {
    return (...args: unknown[]) => {
      try {
        return (value as Fn)(...args);
      } catch {
        return undefined;
      }
    };
  }
}

function isConsoleTarget(target: unknown): boolean {
  return target === console || target === Object.getPrototypeOf(console);
}

export class ConsoleCapture extends Emitter<ConsoleCaptureEvents> {
  private id = 0;
  private groupDepth = 0;
  private installed = false;
  private installing = false;
  private catchErrors = false;

  private readonly original = new Map<ConsoleMethod, Fn>();
  private readonly current = new Map<ConsoleMethod, Fn>();
  private readonly wrappers = new Map<ConsoleMethod, Fn>();
  private readonly descriptors = new Map<ConsoleMethod, PropertyDescriptor | undefined>();
  private readonly prototypeDescriptors = new Map<ConsoleMethod, PropertyDescriptor | undefined>();

  private readonly records: ConsoleRecord[] = [];
  private readonly timers = new Map<string, number>();
  private readonly counters = new Map<string, number>();
  private readonly globals = new Map<string, unknown>();

  private watchdogId: number | null = null;
  private lockInstalled = false;

  private originalDefineProperty: typeof Object.defineProperty | null = null;
  private originalReflectDefineProperty: typeof Reflect.defineProperty | null = null;
  private originalObjectAssign: typeof Object.assign | null = null;
  private originalConsoleDescriptor: PropertyDescriptor | undefined;
  private pageBridgeCleanup: (() => void) | null = null;
  private readonly bridgeEventName = `__roderuda_console_${Math.random().toString(36).slice(2)}`;
  private lastGlobalErrorFingerprint = "";
  private lastGlobalErrorAt = 0;

  install(options: InstallOptions = {}): void {
    if (options.overrideConsole !== false) {
      this.overrideConsole(options);
    }

    if (options.catchGlobalErrors !== false) {
      this.enableGlobalErrors();
    }
  }

  overrideConsole(options: InstallOptions = {}): void {
    if (this.installing) return;

    this.installing = true;

    try {
      if (options.lockConsole === true) {
        this.installConsoleLock();
        this.installConsoleObjectLock();
      }

      for (const method of methods) {
        this.installMethod(method, options);
      }

      if (options.patchPrototype === true) {
        this.patchConsolePrototype();
      }

      this.installed = true;

      if (options.watchdog === true) {
        this.startWatchdog(options.watchdogMs ?? 1000);
      }

      if (options.bridgePageRealm === true) {
        this.installPageRealmBridge();
      }
    } finally {
      this.installing = false;
    }
  }

  restoreConsole(): void {
    if (!this.installed) return;

    this.stopWatchdog();
    this.pageBridgeCleanup?.();
    this.pageBridgeCleanup = null;
    this.restoreConsoleLock();

    const prototype = Object.getPrototypeOf(console);
    if (prototype) {
      for (const method of methods) {
        if (!this.prototypeDescriptors.has(method)) continue;
        const descriptor = this.prototypeDescriptors.get(method);
        try {
          if (descriptor) Object.defineProperty(prototype, method, descriptor);
          else delete (prototype as Record<string, unknown>)[method];
        } catch {
          // Prototype restoration is best-effort in hostile browser realms.
        }
      }
    }

    for (const method of methods) {
      const descriptor = this.descriptors.get(method);
      const original = this.original.get(method);

      try {
        if (descriptor) {
          Object.defineProperty(console, method, descriptor);
        } else if (original) {
          Object.defineProperty(console, method, {
            configurable: true,
            writable: true,
            value: original,
          });
        }
      } catch {
        if (original) {
          try {
            (console as unknown as Record<string, Fn>)[method] = original;
          } catch {
            // Nothing else to do.
          }
        }
      }
    }

    this.original.clear();
    this.current.clear();
    this.wrappers.clear();
    this.descriptors.clear();
    this.prototypeDescriptors.clear();
    this.installed = false;
  }

  enableGlobalErrors(): void {
    if (this.catchErrors) return;
    this.catchErrors = true;

    addEventListener("error", this.onError, true);
    addEventListener("unhandledrejection", this.onRejection, true);
  }

  disableGlobalErrors(): void {
    if (!this.catchErrors) return;
    this.catchErrors = false;

    removeEventListener("error", this.onError, true);
    removeEventListener("unhandledrejection", this.onRejection, true);
  }

  destroy(): void {
    this.restoreConsole();
    this.disableGlobalErrors();
    this.records.length = 0;
    this.removeAllListeners();
  }

  record(level: ConsoleLevel, args: unknown[], extra: Partial<ConsoleRecord> = {}): ConsoleRecord {
    const record: ConsoleRecord = {
      id: ++this.id,
      level,
      args,
      timestamp: Date.now(),
      groupDepth: this.groupDepth,
      ...extra,
    };

    this.records.push(record);

    if (this.records.length > 1000) {
      this.records.splice(0, this.records.length - 1000);
    }

    this.emit("record", record);
    return record;
  }

  clear(): void {
    this.records.length = 0;
    this.emit("clear");
  }

  getRecords(): readonly ConsoleRecord[] {
    return this.records;
  }

  setGlobal(name: string, value: unknown): void {
    this.globals.set(name, value);

    try {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value,
      });
    } catch {
      (globalThis as Record<string, unknown>)[name] = value;
    }
  }

  getGlobals(): ReadonlyMap<string, unknown> {
    return this.globals;
  }

  /**
   * Force re-hook. Useful after Eruda, VConsole, React DevTools,
   * page scripts or userscripts have already touched console.
   */
  forceIntercept(): void {
    this.overrideConsole({
      overrideConsole: true,
      catchGlobalErrors: this.catchErrors,
      watchdog: true,
      lockConsole: false,
      patchPrototype: true,
      watchdogMs: 250,
      bridgePageRealm: true,
    });
  }

  private installMethod(method: ConsoleMethod, options: InstallOptions): void {
    const key = method as string;
    const consoleRecord = console as unknown as Record<string, unknown>;

    if (!this.descriptors.has(method)) {
      try {
        this.descriptors.set(method, Object.getOwnPropertyDescriptor(console, method));
      } catch {
        this.descriptors.set(method, undefined);
      }
    }

    const existing = consoleRecord[key];

    if (!this.original.has(method)) {
      this.original.set(method, safeBind(existing));
    }

    const original = this.original.get(method) ?? noop;

    if (!this.current.has(method)) {
      this.current.set(method, safeBind(existing) || original);
    }

    let wrapper = this.wrappers.get(method);

    if (!wrapper) {
      wrapper = (...args: unknown[]) => {
        this.handle(method, args);

        const passthrough = this.current.get(method) ?? original;

        if (passthrough === wrapper) return;

        try {
          passthrough(...args);
        } catch {
          try {
            original(...args);
          } catch {
            // Avoid recursive console failure.
          }
        }
      };

      try {
        Object.defineProperties(wrapper, {
          name: { configurable: true, value: method },
          __roderudaCaptureWrapper: { configurable: false, value: true },
        });
      } catch {
        // Fine.
      }

      this.wrappers.set(method, wrapper);
    }

    const setter = (value: unknown): void => {
      if (value === wrapper) return;

      const next = typeof value === "function" ? safeBind(value) : original;
      this.current.set(method, next);
    };

    const descriptor: PropertyDescriptor = {
      configurable: options.lockConsole !== true,
      enumerable: true,
      get: () => wrapper,
      set: setter,
    };

    try {
      Object.defineProperty(console, method, descriptor);
      return;
    } catch {
      // Some browsers/devtools contexts get spicy. Try direct value mode.
    }

    try {
      Object.defineProperty(console, method, {
        configurable: options.lockConsole !== true,
        enumerable: true,
        writable: options.lockConsole !== true,
        value: wrapper,
      });
      return;
    } catch {
      // Last tiny crowbar.
    }

    try {
      consoleRecord[key] = wrapper;
    } catch {
      // If this fails, watchdog/prototype patch may still catch later.
    }
  }

  private patchConsolePrototype(): void {
    const proto = Object.getPrototypeOf(console);
    if (!proto) return;

    for (const method of methods) {
      const wrapper = this.wrappers.get(method);
      if (!wrapper) continue;

      if (!this.prototypeDescriptors.has(method)) {
        try {
          this.prototypeDescriptors.set(method, Object.getOwnPropertyDescriptor(proto, method));
        } catch {
          this.prototypeDescriptors.set(method, undefined);
        }
      }

      try {
        Object.defineProperty(proto, method, {
          configurable: true,
          enumerable: true,
          get: () => wrapper,
          set: (value: unknown) => {
            if (value !== wrapper && typeof value === "function") {
              this.current.set(method, safeBind(value));
            }
          },
        });
      } catch {
        // Prototype may be locked.
      }
    }
  }

  private startWatchdog(ms: number): void {
    if (this.watchdogId != null) return;

    this.watchdogId = window.setInterval(() => {
      if (this.installing) return;

      for (const method of methods) {
        const wrapper = this.wrappers.get(method);
        if (!wrapper) continue;

        let currentValue: unknown;

        try {
          currentValue = console[method];
        } catch {
          currentValue = undefined;
        }

        if (currentValue !== wrapper) {
          if (typeof currentValue === "function") {
            this.current.set(method, safeBind(currentValue));
          }

          this.installMethod(method, {
            lockConsole: false,
            watchdog: true,
            patchPrototype: false,
          });
        }
      }
    }, ms);
  }

  private stopWatchdog(): void {
    if (this.watchdogId == null) return;

    clearInterval(this.watchdogId);
    this.watchdogId = null;
  }

  private installConsoleLock(): void {
    if (this.lockInstalled) return;

    this.lockInstalled = true;

    this.originalDefineProperty = Object.defineProperty;
    this.originalReflectDefineProperty = Reflect.defineProperty;
    this.originalObjectAssign = Object.assign;

    const capture = this;

 Object.defineProperty = function patchedDefineProperty<T>(
  target: T,
  propertyKey: PropertyKey,
  attributes: PropertyDescriptor & ThisType<unknown>,
): T {
  if (
    isConsoleTarget(target) &&
    methods.includes(propertyKey as ConsoleMethod)
  ) {
    const method = propertyKey as ConsoleMethod;
    const wrapper = capture.wrappers.get(method);

    const incoming =
      "value" in attributes
        ? attributes.value
        : typeof attributes.get === "function"
          ? attributes.get.call(console)
          : undefined;

    if (incoming && incoming !== wrapper) {
      capture.current.set(method, safeBind(incoming));
    }

    if (wrapper) {
      capture.originalDefineProperty!.call(Object, target, propertyKey, {
        configurable: false,
        enumerable: true,
        get: () => wrapper,
        set: (value: unknown) => {
          if (value !== wrapper && typeof value === "function") {
            capture.current.set(method, safeBind(value));
          }
        },
      });

      return target;
    }
  }

  capture.originalDefineProperty!.call(Object, target, propertyKey, attributes);
  return target;
} as typeof Object.defineProperty;
    

    Reflect.defineProperty = function patchedReflectDefineProperty(
      target: object,
      propertyKey: PropertyKey,
      attributes: PropertyDescriptor,
    ): boolean {
      if (
        isConsoleTarget(target) &&
        methods.includes(propertyKey as ConsoleMethod)
      ) {
        try {
          Object.defineProperty(target, propertyKey, attributes);
          return true;
        } catch {
          return false;
        }
      }

      return capture.originalReflectDefineProperty!.call(Reflect, target, propertyKey, attributes);
    };

    Object.assign = function patchedAssign<T extends object, U>(
      target: T,
      source: U,
    ): T & U {
      if (isConsoleTarget(target) && source && typeof source === "object") {
        for (const method of methods) {
          const value = (source as Record<string, unknown>)[method];

          if (typeof value === "function") {
            const wrapper = capture.wrappers.get(method);
            if (value !== wrapper) capture.current.set(method, safeBind(value));
          }
        }

        capture.overrideConsole({
          lockConsole: true,
          watchdog: true,
          patchPrototype: true,
        });

        return target as T & U;
      }

      return capture.originalObjectAssign!.call(Object, target, source);
    } as typeof Object.assign;
  }

  private installConsoleObjectLock(): void {
    if (this.originalConsoleDescriptor) return;

    try {
      this.originalConsoleDescriptor = Object.getOwnPropertyDescriptor(globalThis, "console");
      const capturedConsole = console;
      Object.defineProperty(globalThis, "console", {
        configurable: true,
        enumerable: true,
        get: () => capturedConsole,
        set: (nextConsole: unknown) => {
          if (!nextConsole || typeof nextConsole !== "object") return;
          for (const method of methods) {
            const nextMethod = (nextConsole as Record<string, unknown>)[method];
            if (typeof nextMethod === "function") {
              const wrapper = this.wrappers.get(method);
              if (nextMethod !== wrapper) this.current.set(method, safeBind(nextMethod));
            }
          }
        },
      });
    } catch {
      this.originalConsoleDescriptor = undefined;
    }
  }

  private restoreConsoleObjectLock(): void {
    if (!this.originalConsoleDescriptor) return;
    try {
      Object.defineProperty(globalThis, "console", this.originalConsoleDescriptor);
    } catch {
      // Ignore hostile descriptors. Individual methods are restored separately.
    }
    this.originalConsoleDescriptor = undefined;
  }

  private restoreConsoleLock(): void {
    if (!this.lockInstalled) {
      this.restoreConsoleObjectLock();
      return;
    }

    this.restoreConsoleObjectLock();

    if (this.originalDefineProperty) {
      Object.defineProperty = this.originalDefineProperty;
    }

    if (this.originalReflectDefineProperty) {
      Reflect.defineProperty = this.originalReflectDefineProperty;
    }

    if (this.originalObjectAssign) {
      Object.assign = this.originalObjectAssign;
    }

    this.originalDefineProperty = null;
    this.originalReflectDefineProperty = null;
    this.originalObjectAssign = null;
    this.lockInstalled = false;
  }


  private installPageRealmBridge(): void {
    if (this.pageBridgeCleanup || typeof document === "undefined") return;

    const eventName = this.bridgeEventName;
    const onBridge = (event: Event): void => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { level?: ConsoleLevel; args?: unknown[] } | null;
      if (!detail || typeof detail.level !== "string" || !Array.isArray(detail.args)) return;
      this.record(detail.level, detail.args);
    };

    document.addEventListener(eventName, onBridge as EventListener, true);

    const source = `(() => {
      const EVENT = ${JSON.stringify('${EVENT_NAME}')};
      const KEY = '__roderudaConsoleBridge__';
      if (window[KEY]?.event === EVENT) return;
      const levels = ${JSON.stringify(['log','debug','trace','info','warn','error','dir','table'])};
      const preview = (value) => {
        if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        if (value instanceof Element) return '<' + value.tagName.toLowerCase() + (value.id ? '#' + value.id : '') + '>';
        try { return JSON.parse(JSON.stringify(value)); } catch {}
        try { return String(value); } catch { return '[unserializable]'; }
      };
      const originals = {};
      for (const level of levels) {
        const original = console[level];
        if (typeof original !== 'function' || original.__roderudaCaptureWrapper) continue;
        originals[level] = original;
        const wrapped = function(...args) {
          try { document.dispatchEvent(new CustomEvent(EVENT, { detail: { level, args: args.map(preview) } })); } catch {}
          return Reflect.apply(original, console, args);
        };
        try { Object.defineProperty(console, level, { configurable: true, writable: true, value: wrapped }); }
        catch { try { console[level] = wrapped; } catch {} }
      }
      window[KEY] = { event: EVENT, originals };
    })();`.replace('${EVENT_NAME}', eventName);

    const attempts: Array<() => boolean> = [
      () => {
        const unsafe = (globalThis as { unsafeWindow?: Window }).unsafeWindow;
        if (!unsafe || unsafe === window) return false;
        const evaluator = (unsafe as unknown as { Function?: FunctionConstructor }).Function;
        if (typeof evaluator !== "function") return false;
        evaluator(source);
        return true;
      },
      () => {
        const script = document.createElement("script");
        script.setAttribute("data-roderuda-internal", "console-bridge");
        const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
        if (nonce) script.nonce = nonce;
        script.textContent = source;
        (document.head || document.documentElement).append(script);
        script.remove();
        return true;
      },
      () => {
        const blob = new Blob([source], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const script = document.createElement("script");
        script.setAttribute("data-roderuda-internal", "console-bridge-blob");
        script.src = url;
        script.onload = script.onerror = () => {
          URL.revokeObjectURL(url);
          script.remove();
        };
        (document.head || document.documentElement).append(script);
        return true;
      },
    ];

    for (const attempt of attempts) {
      try {
        if (attempt()) break;
      } catch {
        // Keep trying. CSP and userscript realm restrictions vary by site.
      }
    }

    this.pageBridgeCleanup = () => {
      document.removeEventListener(eventName, onBridge as EventListener, true);
    };
  }
  private handle(method: ConsoleMethod, args: unknown[]): void {
    switch (method) {
      case "clear":
        this.clear();
        return;

      case "group":
      case "groupCollapsed":
        this.record("log", args.length ? args : ["console.group"], {
          collapsed: method === "groupCollapsed",
        });
        this.groupDepth += 1;
        return;

      case "groupEnd":
        this.groupDepth = Math.max(0, this.groupDepth - 1);
        return;

      case "assert":
        if (args[0]) return;
        this.record("error", ["Assertion failed", ...args.slice(1)]);
        return;

      case "count": {
        const label = String(args[0] ?? "default");
        const count = (this.counters.get(label) ?? 0) + 1;
        this.counters.set(label, count);
        this.record("info", [`${label}: ${count}`]);
        return;
      }

      case "countReset": {
        const label = String(args[0] ?? "default");
        this.counters.set(label, 0);
        this.record("info", [`${label}: 0`]);
        return;
      }

      case "time": {
        const label = String(args[0] ?? "default");
        this.timers.set(label, performance.now());
        return;
      }

      case "timeLog":
      case "timeEnd": {
        const label = String(args[0] ?? "default");
        const start = this.timers.get(label);

        if (start == null) {
          this.record("warn", [`Timer '${label}' does not exist`]);
          return;
        }

        const elapsed = performance.now() - start;
        this.record("info", [`${label}: ${elapsed.toFixed(3)} ms`, ...args.slice(1)]);

        if (method === "timeEnd") {
          this.timers.delete(label);
        }

        return;
      }

      case "table":
        this.record("table", args);
        return;

      case "dir":
        this.record("dir", args);
        return;

      case "trace":
        this.record("trace", args.length ? args : ["console.trace"], {
          stack: new Error("console.trace").stack,
        });
        return;

      default:
        this.record(method, args);
    }
  }

  private readonly onError = (event: ErrorEvent): void => {
    const error =
      event.error instanceof Error
        ? event.error
        : new Error(event.message || "Unknown error");

    const location = event.filename
      ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
      : "";
    const fingerprint = `error|${error.name}|${error.message}|${location}|${error.stack ?? ""}`;
    if (this.isDuplicateGlobalError(fingerprint)) return;

    this.record("error", [error, location].filter(Boolean), {
      stack: error.stack,
    });
  };

  private readonly onRejection = (event: PromiseRejectionEvent): void => {
    const reason =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

    const fingerprint = `rejection|${reason.name}|${reason.message}|${reason.stack ?? ""}`;
    if (this.isDuplicateGlobalError(fingerprint)) return;

    this.record("error", ["Unhandled promise rejection", reason], {
      stack: reason.stack,
    });
  };

  private isDuplicateGlobalError(fingerprint: string): boolean {
    const timestamp = Date.now();
    const duplicate =
      fingerprint === this.lastGlobalErrorFingerprint &&
      timestamp - this.lastGlobalErrorAt < 500;

    this.lastGlobalErrorFingerprint = fingerprint;
    this.lastGlobalErrorAt = timestamp;
    return duplicate;
  }
}
