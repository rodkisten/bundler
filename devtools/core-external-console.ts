import {
  CONSOLE_METHODS,
  ConsoleCapture,
  createConsoleMethodState,
  type ConsoleMethodState,
} from "@rodkisten/devtools/core/console-capture";
import type {
  Cleanup,
  ConsoleLevel,
  ConsoleLike,
  ConsoleMethodName,
  ConsoleRecord,
  ExternalConsoleOrigin,
  ExternalConsoleStream,
  ExternalLogStreamOptions,
} from "@rodkisten/devtools/types";

const DEFAULT_SOURCE = "external";
const DEFAULT_BADGE = "ext";
const MAX_SOURCE_LENGTH = 120;
const MAX_BADGE_LENGTH = 18;

interface PatchedConsoleMethod {
  readonly method: ConsoleMethodName;
  readonly hadOwnProperty: boolean;
  readonly descriptor: PropertyDescriptor | undefined;
  readonly originalValue: unknown;
  readonly wrapper: (...args: unknown[]) => unknown;
}

interface ConsolePatch {
  readonly target: ConsoleLike;
  readonly methods: PatchedConsoleMethod[];
  restored: boolean;
}

interface RodConsoleWrapper extends Function {
  readonly __roderudaCaptureWrapper?: true;
  readonly __roderudaExternalConsoleWrapper?: true;
  readonly __roderudaOriginalConsoleMethod?: (...args: unknown[]) => unknown;
}

/**
 * A console-compatible public stream that writes directly into Rod DevTools.
 *
 * The stream owns isolated group, count and timer state. Passing a console-like
 * object patches its methods in place while preserving the original behavior
 * unless `passthrough` is explicitly disabled.
 */
export class ExternalConsoleStreamImpl implements ExternalConsoleStream {
  readonly source: string;
  readonly badge: string;

  private readonly capture: ConsoleCapture;
  private readonly state: ConsoleMethodState = createConsoleMethodState();
  private readonly origin: ExternalConsoleOrigin;
  private readonly patches = new Map<ConsoleLike, ConsolePatch>();
  private defaultPassthrough: boolean;
  private isDestroyed = false;

  constructor(
    capture: ConsoleCapture,
    options: ExternalLogStreamOptions = {},
  ) {
    this.capture = capture;
    this.source = normalizeSource(options.source);
    this.badge = normalizeBadge(options.badge);
    this.defaultPassthrough = options.passthrough !== false;
    this.origin = Object.freeze({
      kind: "external",
      label: this.badge,
      source: this.source,
    });

    if (options.console) {
      this.intercept(options.console, {
        passthrough: this.defaultPassthrough,
      });
    }
  }

  get destroyed(): boolean {
    return this.isDestroyed;
  }

  append(level: ConsoleLevel, ...args: unknown[]): ConsoleRecord {
    this.assertActive();
    return this.capture.record(level, args, {
      origin: this.origin,
      groupDepth: this.state.groupDepth,
    });
  }

  ingest(method: ConsoleMethodName, ...args: unknown[]): ConsoleRecord | undefined {
    this.assertActive();
    return this.capture.ingest(method, args, { origin: this.origin }, this.state);
  }

  intercept(
    consoleObject: ConsoleLike,
    options: Pick<ExternalLogStreamOptions, "passthrough"> = {},
  ): Cleanup {
    this.assertActive();

    if (!consoleObject || typeof consoleObject !== "object") {
      throw new TypeError("DevTools.ingestLogs expected a console-like object");
    }

    const existing = this.patches.get(consoleObject);
    if (existing && !existing.restored) {
      return () => this.restorePatch(existing);
    }

    const passthrough = options.passthrough ?? this.defaultPassthrough;
    const methods: PatchedConsoleMethod[] = [];

    for (const method of CONSOLE_METHODS) {
      const patch = this.patchMethod(consoleObject, method, passthrough);
      if (patch) methods.push(patch);
    }

    const consolePatch: ConsolePatch = {
      target: consoleObject,
      methods,
      restored: false,
    };

    this.patches.set(consoleObject, consolePatch);
    return () => this.restorePatch(consolePatch);
  }

  restore(): void {
    for (const patch of this.patches.values()) {
      this.restorePatch(patch);
    }
    this.patches.clear();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.restore();
    this.isDestroyed = true;
  }

  readonly log = (...args: unknown[]): void => { this.ingest("log", ...args); };
  readonly debug = (...args: unknown[]): void => { this.ingest("debug", ...args); };
  readonly trace = (...args: unknown[]): void => { this.ingest("trace", ...args); };
  readonly info = (...args: unknown[]): void => { this.ingest("info", ...args); };
  readonly warn = (...args: unknown[]): void => { this.ingest("warn", ...args); };
  readonly error = (...args: unknown[]): void => { this.ingest("error", ...args); };
  readonly dir = (...args: unknown[]): void => { this.ingest("dir", ...args); };
  readonly dirxml = (...args: unknown[]): void => { this.ingest("dirxml", ...args); };
  readonly table = (...args: unknown[]): void => { this.ingest("table", ...args); };
  readonly assert = (...args: unknown[]): void => { this.ingest("assert", ...args); };
  readonly count = (...args: unknown[]): void => { this.ingest("count", ...args); };
  readonly countReset = (...args: unknown[]): void => { this.ingest("countReset", ...args); };
  readonly time = (...args: unknown[]): void => { this.ingest("time", ...args); };
  readonly timeLog = (...args: unknown[]): void => { this.ingest("timeLog", ...args); };
  readonly timeEnd = (...args: unknown[]): void => { this.ingest("timeEnd", ...args); };
  readonly timeStamp = (...args: unknown[]): void => { this.ingest("timeStamp", ...args); };
  readonly group = (...args: unknown[]): void => { this.ingest("group", ...args); };
  readonly groupCollapsed = (...args: unknown[]): void => { this.ingest("groupCollapsed", ...args); };
  readonly groupEnd = (...args: unknown[]): void => { this.ingest("groupEnd", ...args); };
  readonly profile = (...args: unknown[]): void => { this.ingest("profile", ...args); };
  readonly profileEnd = (...args: unknown[]): void => { this.ingest("profileEnd", ...args); };
  readonly exception = (...args: unknown[]): void => { this.ingest("exception", ...args); };
  readonly clear = (...args: unknown[]): void => { this.ingest("clear", ...args); };

  private patchMethod(
    target: ConsoleLike,
    method: ConsoleMethodName,
    passthrough: boolean,
  ): PatchedConsoleMethod | null {
    const record = target as Record<PropertyKey, unknown>;
    const hadOwnProperty = Object.prototype.hasOwnProperty.call(target, method);
    let descriptor: PropertyDescriptor | undefined;
    let originalValue: unknown;

    try {
      descriptor = Object.getOwnPropertyDescriptor(target, method);
    } catch {
      descriptor = undefined;
    }

    try {
      originalValue = Reflect.get(target, method);
    } catch {
      originalValue = descriptor?.value;
    }

    const passthroughMethod = unwrapConsoleMethod(originalValue);
    let invoking = false;
    const wrapper = (...args: unknown[]): unknown => {
      if (invoking) return undefined;
      invoking = true;

      try {
        if (!this.isDestroyed) {
          try {
            this.ingest(method, ...args);
          } catch {
            // Logging must never break the intercepted application.
          }
        }

        if (!passthrough || typeof passthroughMethod !== "function") {
          return undefined;
        }

        try {
          return Reflect.apply(passthroughMethod, target, args);
        } catch {
          try {
            return passthroughMethod(...args);
          } catch {
            return undefined;
          }
        }
      } finally {
        invoking = false;
      }
    };

    try {
      Object.defineProperties(wrapper, {
        name: { configurable: true, value: method },
        __roderudaExternalConsoleWrapper: {
          configurable: false,
          value: true,
        },
        __roderudaOriginalConsoleMethod: {
          configurable: false,
          value: passthroughMethod,
        },
      });
    } catch {
      // Function metadata is optional.
    }

    let installed = false;

    try {
      Object.defineProperty(target, method, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        writable: true,
        value: wrapper,
      });
      installed = Reflect.get(target, method) === wrapper;
    } catch {
      try {
        record[method] = wrapper;
        installed = record[method] === wrapper;
      } catch {
        installed = false;
      }
    }

    if (!installed) return null;

    return {
      method,
      hadOwnProperty,
      descriptor,
      originalValue,
      wrapper,
    };
  }

  private restorePatch(patch: ConsolePatch): void {
    if (patch.restored) return;
    patch.restored = true;

    const target = patch.target as Record<PropertyKey, unknown>;

    for (const methodPatch of patch.methods) {
      let current: unknown;
      try {
        current = Reflect.get(patch.target, methodPatch.method);
      } catch {
        current = undefined;
      }

      // Do not erase a newer hook installed after this stream.
      if (current !== methodPatch.wrapper) continue;

      try {
        if (methodPatch.hadOwnProperty && methodPatch.descriptor) {
          Object.defineProperty(
            patch.target,
            methodPatch.method,
            methodPatch.descriptor,
          );
        } else if (methodPatch.hadOwnProperty) {
          target[methodPatch.method] = methodPatch.originalValue;
        } else {
          Reflect.deleteProperty(patch.target, methodPatch.method);
        }
      } catch {
        try {
          if (methodPatch.hadOwnProperty) {
            target[methodPatch.method] = methodPatch.originalValue;
          } else {
            Reflect.deleteProperty(patch.target, methodPatch.method);
          }
        } catch {
          // Restoration is best-effort for frozen or hostile console objects.
        }
      }
    }

    this.patches.delete(patch.target);
  }

  private assertActive(): void {
    if (this.isDestroyed) {
      throw new Error("This external DevTools log stream has been destroyed");
    }
  }
}

export function createExternalConsoleStream(
  capture: ConsoleCapture,
  options: ExternalLogStreamOptions = {},
): ExternalConsoleStream {
  return new ExternalConsoleStreamImpl(capture, options);
}

export function createExternalConsoleOrigin(
  source?: string,
  badge?: string,
): ExternalConsoleOrigin {
  return {
    kind: "external",
    label: normalizeBadge(badge),
    source: normalizeSource(source),
  };
}

export function isConsoleMethodName(value: unknown): value is ConsoleMethodName {
  return typeof value === "string" &&
    (CONSOLE_METHODS as readonly string[]).includes(value);
}

export function isConsoleLike(value: unknown): value is ConsoleLike {
  if (!value || typeof value !== "object") return false;

  for (const method of CONSOLE_METHODS) {
    try {
      if (typeof Reflect.get(value, method) === "function") return true;
    } catch {
      // Keep checking the remaining methods.
    }
  }

  return false;
}

function unwrapConsoleMethod(value: unknown): ((...args: unknown[]) => unknown) | null {
  let current = typeof value === "function"
    ? value as RodConsoleWrapper
    : null;
  const visited = new Set<Function>();

  while (
    current &&
    !visited.has(current) &&
    (current.__roderudaCaptureWrapper || current.__roderudaExternalConsoleWrapper) &&
    typeof current.__roderudaOriginalConsoleMethod === "function"
  ) {
    visited.add(current);
    current = current.__roderudaOriginalConsoleMethod as RodConsoleWrapper;
  }

  return current as ((...args: unknown[]) => unknown) | null;
}

function normalizeSource(value: string | undefined): string {
  const source = String(value ?? DEFAULT_SOURCE).trim() || DEFAULT_SOURCE;
  return source.slice(0, MAX_SOURCE_LENGTH);
}

function normalizeBadge(value: string | undefined): string {
  const badge = String(value ?? DEFAULT_BADGE).trim() || DEFAULT_BADGE;
  return badge.slice(0, MAX_BADGE_LENGTH);
}
