export type DebugLevel = "trace" | "debug" | "info" | "warn" | "error" | "silent";

export interface DebugOptions {
  enabled?: boolean;
  level?: DebugLevel;
}

type DebugMeta = Record<string, unknown>;

const LEVEL_WEIGHT: Record<DebugLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 99,
};

const LEVEL_COLOR: Record<Exclude<DebugLevel, "silent">, string> = {
  trace: "#7c8794",
  debug: "#22d3ee",
  info: "#a3e635",
  warn: "#facc15",
  error: "#fb7185",
};

const originalConsole = {
  trace: console.trace?.bind(console) ?? console.log.bind(console),
  debug: console.debug?.bind(console) ?? console.log.bind(console),
  info: console.info?.bind(console) ?? console.log.bind(console),
  warn: console.warn?.bind(console) ?? console.log.bind(console),
  error: console.error?.bind(console) ?? console.log.bind(console),
};

let enabled = false;
let currentLevel: DebugLevel = "debug";
let sequence = 0;

export function configureDebug(options?: boolean | DebugOptions): void {
  if (typeof options === "boolean") {
    enabled = options;
    if (options) currentLevel = "debug";
    return;
  }
  if (!options) return;
  if (typeof options.enabled === "boolean") enabled = options.enabled;
  if (options.level && options.level in LEVEL_WEIGHT) currentLevel = options.level;
}

export function getDebugConfig(): Required<DebugOptions> {
  return { enabled, level: currentLevel };
}

export function debugTrace(scope: string, message: string, meta?: DebugMeta): void { emit("trace", scope, message, meta); }
export function debugLog(scope: string, message: string, meta?: DebugMeta): void { emit("debug", scope, message, meta); }
export function debugInfo(scope: string, message: string, meta?: DebugMeta): void { emit("info", scope, message, meta); }
export function debugWarn(scope: string, message: string, meta?: DebugMeta): void { emit("warn", scope, message, meta); }
export function debugError(scope: string, message: string, meta?: DebugMeta): void { emit("error", scope, message, meta); }

export function debugGroup(scope: string, message: string, meta?: DebugMeta): () => void {
  const startedAt = now();
  debugInfo(scope, `${message}:start`, meta);
  return () => debugInfo(scope, `${message}:end`, { ...meta, durationMs: round(now() - startedAt) });
}

function emit(level: Exclude<DebugLevel, "silent">, scope: string, message: string, meta?: DebugMeta): void {
  if (!enabled || LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel]) return;
  const color = LEVEL_COLOR[level];
  const label = ` RD ${level.toUpperCase()} `;
  const id = String(++sequence).padStart(4, "0");
  const time = new Date().toLocaleTimeString([], { hour12: false });
  const prefix = [
    `%c${label}`,
    `%c`,
    `%c ${scope} `,
    `%c`,
    `%c ${message} `,
    `%c#${id} ${time}`,
  ].join("");
  const styles = [
    `background:${color};color:#0b1020;font-weight:800;border-radius:4px 0 0 4px`,
    `color:${color};background:#202633`,
    "background:#202633;color:#f8fafc;font-weight:700",
    "color:#202633;background:#111827",
    "background:#111827;color:#e5e7eb",
    "color:#94a3b8",
  ];
  const method = level === "trace" ? "debug" : level;
  if (meta && Object.keys(meta).length) originalConsole[method](prefix, ...styles, meta);
  else originalConsole[method](prefix, ...styles);
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
