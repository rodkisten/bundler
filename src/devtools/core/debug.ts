export type DebugLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "silent";

export interface DebugOptions {
  enabled?: boolean;
  level?: DebugLevel;

  /**
   * Intervalo usado para acumular e agrupar logs repetidos.
   *
   * Logs iguais recebidos durante essa janela serão emitidos
   * como uma única entrada com contador.
   *
   * @default 250
   */
  chunkMs?: number;

  /**
   * Quantidade máxima de logs diferentes mantidos em um chunk.
   *
   * Ao atingir o limite, o chunk atual é emitido imediatamente.
   *
   * @default 100
   */
  maxChunkEntries?: number;
}

type DebugMeta = Record<string, unknown>;
type EmittableDebugLevel = Exclude<DebugLevel, "silent">;

interface BufferedLog {
  level: EmittableDebugLevel;
  scope: string;
  message: string;
  meta?: DebugMeta;

  count: number;
  firstTimestamp: number;
  lastTimestamp: number;
}

const LEVEL_WEIGHT: Record<DebugLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 99,
};

const LEVEL_COLOR: Record<EmittableDebugLevel, string> = {
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

const DEFAULT_CHUNK_MS = 250;
const DEFAULT_MAX_CHUNK_ENTRIES = 100;

let enabled = false;
let currentLevel: DebugLevel = "debug";
let sequence = 0;

let chunkMs = DEFAULT_CHUNK_MS;
let maxChunkEntries = DEFAULT_MAX_CHUNK_ENTRIES;

let flushTimer: ReturnType<typeof setTimeout> | undefined;

const bufferedLogs = new Map<string, BufferedLog>();

export function configureDebug(options?: boolean | DebugOptions): void {
  if (typeof options === "boolean") {
    enabled = options;

    if (options) {
      currentLevel = "debug";
    } else {
      clearBufferedLogs();
    }

    return;
  }

  if (!options) return;

  if (typeof options.enabled === "boolean") {
    enabled = options.enabled;

    if (!enabled) {
      clearBufferedLogs();
    }
  }

  if (options.level && options.level in LEVEL_WEIGHT) {
    currentLevel = options.level;
  }

  if (
    typeof options.chunkMs === "number" &&
    Number.isFinite(options.chunkMs) &&
    options.chunkMs >= 0
  ) {
    chunkMs = options.chunkMs;
  }

  if (
    typeof options.maxChunkEntries === "number" &&
    Number.isFinite(options.maxChunkEntries) &&
    options.maxChunkEntries >= 1
  ) {
    maxChunkEntries = Math.floor(options.maxChunkEntries);
  }
}

export function getDebugConfig(): Required<DebugOptions> {
  return {
    enabled,
    level: currentLevel,
    chunkMs,
    maxChunkEntries,
  };
}

export function debugTrace(
  scope: string,
  message: string,
  meta?: DebugMeta,
): void {
  emit("trace", scope, message, meta);
}

export function debugLog(
  scope: string,
  message: string,
  meta?: DebugMeta,
): void {
  emit("debug", scope, message, meta);
}

export function debugInfo(
  scope: string,
  message: string,
  meta?: DebugMeta,
): void {
  emit("info", scope, message, meta);
}

export function debugWarn(
  scope: string,
  message: string,
  meta?: DebugMeta,
): void {
  emit("warn", scope, message, meta);
}

export function debugError(
  scope: string,
  message: string,
  meta?: DebugMeta,
): void {
  emit("error", scope, message, meta);
}

export function debugGroup(
  scope: string,
  message: string,
  meta?: DebugMeta,
): () => void {
  const startedAt = now();

  debugInfo(scope, `${message}:start`, meta);

  return () => {
    debugInfo(scope, `${message}:end`, {
      ...meta,
      durationMs: round(now() - startedAt),
    });
  };
}

/**
 * Emite imediatamente todos os logs atualmente acumulados.
 *
 * Útil antes de:
 * - lançar um erro;
 * - desmontar a aplicação;
 * - encerrar testes;
 * - trocar de página;
 * - limpar o console.
 */
export function flushDebugLogs(): void {
  cancelFlushTimer();

  if (bufferedLogs.size === 0) return;

  const logs = [...bufferedLogs.values()].sort(
    (left, right) => left.firstTimestamp - right.firstTimestamp,
  );

  bufferedLogs.clear();

  for (const log of logs) {
    printLog(log);
  }
}

/**
 * Descarta os logs ainda não emitidos.
 */
export function clearBufferedLogs(): void {
  cancelFlushTimer();
  bufferedLogs.clear();
}

function emit(
  level: EmittableDebugLevel,
  scope: string,
  message: string,
  meta?: DebugMeta,
): void {
  if (!enabled) return;
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel]) return;

  const normalizedScope = String(scope);
  const normalizedMessage = String(message);
  const timestamp = Date.now();

  /*
   * chunkMs === 0 desabilita a bufferização, mas preserva
   * a mesma formatação da saída.
   */
  if (chunkMs === 0) {
    printLog({
      level,
      scope: normalizedScope,
      message: normalizedMessage,
      meta,
      count: 1,
      firstTimestamp: timestamp,
      lastTimestamp: timestamp,
    });

    return;
  }

  const signature = createLogSignature(
    level,
    normalizedScope,
    normalizedMessage,
    meta,
  );

  const existing = bufferedLogs.get(signature);

  if (existing) {
    existing.count += 1;
    existing.lastTimestamp = timestamp;
    return;
  }

  bufferedLogs.set(signature, {
    level,
    scope: normalizedScope,
    message: normalizedMessage,
    meta,
    count: 1,
    firstTimestamp: timestamp,
    lastTimestamp: timestamp,
  });

  if (bufferedLogs.size >= maxChunkEntries) {
    flushDebugLogs();
    return;
  }

  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer !== undefined) return;

  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    flushDebugLogs();
  }, chunkMs);
}

function cancelFlushTimer(): void {
  if (flushTimer === undefined) return;

  clearTimeout(flushTimer);
  flushTimer = undefined;
}

function printLog(log: BufferedLog): void {
  const {
    level,
    scope,
    message,
    meta,
    count,
    firstTimestamp,
    lastTimestamp,
  } = log;

  const color = LEVEL_COLOR[level];
  const label = ` RD ${level.toUpperCase()} `;
  const id = String(++sequence).padStart(4, "0");

  const firstTime = formatTimestamp(firstTimestamp);
  const lastTime = formatTimestamp(lastTimestamp);

  const timeLabel =
    count > 1 && firstTime !== lastTime
      ? `${firstTime}–${lastTime}`
      : firstTime;

  const countLabel = count > 1 ? ` ×${formatCount(count)}` : "";

  const prefix = [
    `%c${label}`,
    "%c",
    `%c ${scope} `,
    "%c",
    `%c ${message} `,
    `%c${countLabel}`,
    `%c #${id} ${timeLabel}`,
  ].join("");

  const styles = [
    `background:${color};color:#0b1020;font-weight:800;border-radius:4px 0 0 4px`,
    `color:${color};background:#202633`,
    "background:#202633;color:#f8fafc;font-weight:700",
    "color:#202633;background:#111827",
    "background:#111827;color:#e5e7eb",
    count > 1
      ? `background:${color};color:#0b1020;font-weight:900;padding:0 4px;border-radius:999px`
      : "background:#111827;color:#111827",
    "color:#94a3b8",
  ];

  const method = level === "trace" ? "debug" : level;

  if (meta && Object.keys(meta).length > 0) {
    originalConsole[method](prefix, ...styles, meta);
    return;
  }

  originalConsole[method](prefix, ...styles);
}

function createLogSignature(
  level: EmittableDebugLevel,
  scope: string,
  message: string,
  meta?: DebugMeta,
): string {
  return [
    level,
    scope,
    message,
    stableSerialize(meta),
  ].join("\u001f");
}

/**
 * Serialização determinística para que objetos equivalentes,
 * mesmo criados em momentos diferentes, gerem a mesma assinatura.
 *
 * Também trata referências circulares, Map, Set, Error, DOM nodes
 * e outros valores que JSON.stringify normalmente não representa bem.
 */
function stableSerialize(value: unknown): string {
  const seen = new WeakMap<object, number>();
  let referenceSequence = 0;

  function serialize(current: unknown): string {
    if (current === null) return "null";

    switch (typeof current) {
      case "undefined":
        return "undefined";

      case "string":
        return JSON.stringify(current);

      case "number":
        if (Number.isNaN(current)) return "number:NaN";
        if (current === Infinity) return "number:Infinity";
        if (current === -Infinity) return "number:-Infinity";
        if (Object.is(current, -0)) return "number:-0";

        return `number:${current}`;

      case "bigint":
        return `bigint:${current.toString()}`;

      case "boolean":
        return `boolean:${current}`;

      case "symbol":
        return `symbol:${String(current.description ?? "")}`;

      case "function":
        return `function:${current.name || "anonymous"}`;

      case "object":
        break;

      default:
        return String(current);
    }

    const object = current as object;
    const knownReference = seen.get(object);

    if (knownReference !== undefined) {
      return `reference:${knownReference}`;
    }

    const reference = ++referenceSequence;
    seen.set(object, reference);

    if (current instanceof Date) {
      return Number.isNaN(current.getTime())
        ? "date:invalid"
        : `date:${current.toISOString()}`;
    }

    if (current instanceof RegExp) {
      return `regexp:${current.toString()}`;
    }

    if (current instanceof Error) {
      return [
        "error",
        current.name,
        current.message,
        current.stack ?? "",
      ].join(":");
    }

    if (current instanceof Map) {
      const entries = [...current.entries()]
        .map(([key, item]) => [serialize(key), serialize(item)] as const)
        .sort(([left], [right]) => left.localeCompare(right));

      return `map:{${entries
        .map(([key, item]) => `${key}:${item}`)
        .join(",")}}`;
    }

    if (current instanceof Set) {
      const items = [...current.values()]
        .map(serialize)
        .sort((left, right) => left.localeCompare(right));

      return `set:[${items.join(",")}]`;
    }

    if (Array.isArray(current)) {
      return `array:[${current.map(serialize).join(",")}]`;
    }

    if (isDomNode(current)) {
      return serializeDomNode(current);
    }

    const record = current as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) =>
      left.localeCompare(right),
    );

    return `object:{${keys
      .map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`)
      .join(",")}}`;
  }

  return serialize(value);
}

function serializeDomNode(value: Node): string {
  if (typeof Element !== "undefined" && value instanceof Element) {
    const tagName = value.tagName.toLowerCase();
    const id = value.id ? `#${value.id}` : "";

    const className =
      typeof value.className === "string"
        ? value.className
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .sort()
            .map((name) => `.${name}`)
            .join("")
        : "";

    return `element:${tagName}${id}${className}`;
  }

  return `node:${value.nodeName}:${value.nodeType}`;
}

function isDomNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour12: false,
  });
}

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

function now(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
