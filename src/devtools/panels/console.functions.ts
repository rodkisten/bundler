const HISTORY_STORAGE_KEY = "";

function sameRecord(left: ConsoleRecord, right: ConsoleRecord): boolean {
  if (left.level !== right.level || left.groupDepth !== right.groupDepth || left.args.length !== right.args.length) return false;
  return left.args.every((value, index) => Object.is(value, right.args[index]));
}

function normalizeTable(value: unknown): { columns: string[]; rows: Array<Record<string, unknown>> } {
  if (Array.isArray(value)) {
    const rows = value.map((item, index) => item && typeof item === "object" ? { "(index)": index, ...(item as Record<string, unknown>) } : { "(index)": index, Value: item });
    return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  if (value && typeof value === "object") {
    const rows = Object.entries(value).map(([key, item]) => item && typeof item === "object" ? { "(index)": key, ...(item as Record<string, unknown>) } : { "(index)": key, Value: item });
    return { columns: [...new Set(rows.flatMap((row) => Object.keys(row)))], rows };
  }
  return { columns: [], rows: [] };
}

async function executeJavaScript(code: string, context: { $_: unknown; $0: unknown; devtools: unknown; globals: ReadonlyMap<string, unknown> }): Promise<unknown> {
  const queryOne = (selector: string, root: ParentNode = document) => root.querySelector(selector);
  const queryAll = (selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll(selector));
  const names = ["$_", "$0", "$", "$$", "devtools", ...context.globals.keys()];
  const values = [context.$_, context.$0, queryOne, queryAll, context.devtools, ...context.globals.values()];
  const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor as new (...args: string[]) => (...functionValues: unknown[]) => Promise<unknown>;
  try {
    const expression = new AsyncFunction(...names, `"use strict"; return await (${code});`);
    return await expression(...values);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const statements = new AsyncFunction(...names, `"use strict"; ${code}`);
    return await statements(...values);
  }
}

function readHistory(limit: number): string[] {
  try {
    const value = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-Math.max(0, limit)) : [];
  } catch {
    return [];
  }
}

function writeHistory(history: readonly string[], limit: number): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limit <= 0 ? [] : history.slice(-limit)));
  } catch {}
}

function appendHistory(history: readonly string[], code: string, limit: number): string[] {
  const trimmed = code.trim();
  if (!trimmed) return [...history];
  const next = history.at(-1) === trimmed ? [...history] : [...history, trimmed];
  return limit <= 0 ? [] : next.slice(-limit);
}

function consoleCompletions(context: { 
    matchBefore(pattern: RegExp): { from: number; text: string } | null }
    ): { from: number; options: Array<{ label: string; type?: string; detail?: string }> } | null {
  const options = new Map<string, { label: string; type?: string; detail?: string }>();
  const word = context.matchBefore(/[$\w.]+$/);
  
  if (!word) return null;
  
  const add = (label: string, type = "variable", detail = "") => { if (label) options.set(label, { label, type, detail }); };
  for (const label of ["$", "$$", "$0", "$_", "window", "document", "console", "localStorage", "sessionStorage", "devtools"]) { 
    add(label, "variable"); 
  }

  const dot = word.text.lastIndexOf(".");
 
  if (dot >= 0) {
    const rootName = word.text.slice(0, dot);
    const prefix = word.text.slice(dot + 1);
    const root = resolveCompletionRoot(rootName);
   
    if (root) {
      for (const key of collectPropertyNames(root, prefix)) add(key, "property", rootName);
      return { from: word.from + dot + 1, options: [...options.values()].filter((item) => item.label.startsWith(prefix)).slice(0, 100) };
    }
  }

  return { from: word.from, options: [...options.values()].filter((item) => item.label.startsWith(word.text)).slice(0, 100) };
}

function resolveCompletionRoot(name: string): unknown {
  if (name === "window") return window;
  if (name === "document") return document;
  if (name === "console") return console;
  if (name === "localStorage") return localStorage;
  if (name === "sessionStorage") return sessionStorage;
  return undefined;
}

function collectPropertyNames(value: unknown, prefix: string): string[] {
  const names = new Set<string>();
  let current = value;
  let depth = 0;
  while (current && depth < 4) {
    try {
      for (const name of Object.getOwnPropertyNames(current)) if (!prefix || name.startsWith(prefix)) names.add(name);
    } catch {}
    current = Object.getPrototypeOf(current);
    depth += 1;
  }
  return [...names].sort();
}

function isInitialConsoleEntry(value: unknown): value is { level?: ConsoleLevel; args?: readonly unknown[]; message?: unknown; timestamp?: number; stack?: string } {
  return value !== null && typeof value === "object" && !(value instanceof Error) && ("args" in value || "message" in value || "level" in value);
