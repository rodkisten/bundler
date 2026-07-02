import { Emitter } from "./emitter";
import type { ConsoleLevel, ConsoleRecord } from "../types";

interface ConsoleCaptureEvents {
  record: [record: ConsoleRecord];
  clear: [];
}

type ConsoleMethod = keyof Pick<Console,
  "log" | "debug" | "info" | "warn" | "error" | "dir" | "table" | "assert" |
  "count" | "countReset" | "time" | "timeLog" | "timeEnd" | "group" | "groupCollapsed" |
  "groupEnd" | "clear"
>;

const methods: readonly ConsoleMethod[] = [
  "log", "debug", "info", "warn", "error", "dir", "table", "assert", "count", "countReset",
  "time", "timeLog", "timeEnd", "group", "groupCollapsed", "groupEnd", "clear",
];

export class ConsoleCapture extends Emitter<ConsoleCaptureEvents> {
  private id = 0;
  private groupDepth = 0;
  private installed = false;
  private catchErrors = false;
  private readonly original = new Map<ConsoleMethod, (...args: unknown[]) => void>();
  private readonly current = new Map<ConsoleMethod, (...args: unknown[]) => void>();
  private readonly wrappers = new Map<ConsoleMethod, (...args: unknown[]) => void>();
  private readonly records: ConsoleRecord[] = [];
  private readonly timers = new Map<string, number>();
  private readonly counters = new Map<string, number>();
  private readonly globals = new Map<string, unknown>();

  install(options: { overrideConsole?: boolean; catchGlobalErrors?: boolean } = {}): void {
    if (options.overrideConsole !== false) this.overrideConsole();
    if (options.catchGlobalErrors !== false) this.enableGlobalErrors();
  }

  overrideConsole(): void {
    if (this.installed) return;
    this.installed = true;
    for (const method of methods) {
      const original = typeof console[method] === "function"
        ? (console[method] as (...args: unknown[]) => void).bind(console)
        : () => undefined;
      this.original.set(method, original);
      this.current.set(method, original);
      const wrapper = (...args: unknown[]) => {
        if (this.installed) this.handle(method, args);
        const passthrough = this.current.get(method) ?? original;
        if (passthrough !== wrapper) passthrough(...args);
      };
      this.wrappers.set(method, wrapper);
      Object.defineProperty(console, method, {
        configurable: true,
        get: () => wrapper,
        set: (value: unknown) => {
          this.current.set(method, typeof value === "function" && value !== wrapper ? (value as (...args: unknown[]) => void).bind(console) : original);
        },
      });
    }
  }

  restoreConsole(): void {
    if (!this.installed) return;
    for (const [method, original] of this.original) {
      Object.defineProperty(console, method, { configurable: true, writable: true, value: original });
    }
    this.original.clear();
    this.current.clear();
    this.wrappers.clear();
    this.installed = false;
  }

  enableGlobalErrors(): void {
    if (this.catchErrors) return;
    this.catchErrors = true;
    addEventListener("error", this.onError, true);
    addEventListener("unhandledrejection", this.onRejection);
  }

  disableGlobalErrors(): void {
    if (!this.catchErrors) return;
    this.catchErrors = false;
    removeEventListener("error", this.onError, true);
    removeEventListener("unhandledrejection", this.onRejection);
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
    if (this.records.length > 1000) this.records.splice(0, this.records.length - 1000);
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
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    } catch {
      (globalThis as Record<string, unknown>)[name] = value;
    }
  }

  getGlobals(): ReadonlyMap<string, unknown> {
    return this.globals;
  }

  private handle(method: ConsoleMethod, args: unknown[]): void {
    switch (method) {
      case "clear":
        this.clear();
        return;
      case "group":
      case "groupCollapsed":
        this.record("log", args.length ? args : ["console.group"], { collapsed: method === "groupCollapsed" });
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
        if (method === "timeEnd") this.timers.delete(label);
        return;
      }
      case "table":
        this.record("table", args);
        return;
      case "dir":
        this.record("dir", args);
        return;
      default:
        this.record(method, args);
    }
  }

  private readonly onError = (event: ErrorEvent): void => {
    const error = event.error instanceof Error ? event.error : new Error(event.message || "Unknown error");
    this.record("error", [error], { stack: error.stack });
  };

  private readonly onRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    this.record("error", ["Unhandled promise rejection", reason], { stack: reason.stack });
  };
}
