import { asElement, html } from "../core/runtime";
import { plainText, renderValue } from "../core/serialize";
import { safeStringify } from "../utils";
import type { ConsoleLevel, ConsoleRecord } from "../types";
import {
  ConsoleGroup,
  ConsoleRepeat,
  ConsoleRow,
  ConsoleStack,
  ConsoleTable,
  ConsoleTableCell,
  ConsoleTableHead,
  ConsoleTableWrap,
  ConsoleTime,
} from "./console-components";

const HISTORY_STORAGE_KEY = "roderuda:console-history";

export function renderRecord(record: ConsoleRecord, displayExtraInfo: boolean): HTMLElement {
  const row = asElement<HTMLElement>(html`<ConsoleRow 
    :level=${record.level} 
    :recordId=${record.id}
    style=${`--rd-console-depth: ${record.groupDepth}`}></ConsoleRow>`);

  /*const row = ConsoleRow({
    "data-level": record.level,
    "data-record-id": String(record.id),
    style: `--rd-console-depth: ${record.groupDepth}`,
  }) as HTMLElement;*/

  if ((record.repeat ?? 1) > 1) row.append(ConsoleRepeat({ children: String(record.repeat ?? 1) }) as Node);
  if (record.collapsed != null) row.append(ConsoleGroup({ children: record.collapsed ? "▸" : "▾" }) as Node);

  const output = document.createElement("div");
  output.className = "roderuda-console-output";

  if (record.level === "table") {
    output.append(renderTable(record.args[0]));
  } else {
    appendFormattedConsoleArgs(output, record.args);
  }

  row.append(output);

  if (record.stack) {
    const stack = ConsoleStack() as HTMLElement;
    stack.textContent = record.stack;
    row.append(stack);
  }

  if (displayExtraInfo) row.append(ConsoleTime({ children: new Date(record.timestamp).toLocaleTimeString() }) as Node);
  row.dataset.expanded = "false";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-expanded", "false");

  const toggle = (): void => {
    const expanded = row.dataset.expanded !== "true";
    row.dataset.expanded = String(expanded);
    row.setAttribute("aria-expanded", String(expanded));
  };

  row.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest("details,summary,a,button,input,textarea,select")) return;
    toggle();
  });
  row.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  });
  return row;
}


export function appendFormattedConsoleArgs(container: HTMLElement, args: readonly unknown[]): void {
  if (!args.length) return;
  const [first, ...rest] = args;

  if (typeof first !== "string" || !/%[sdifoOc%]/.test(first)) {
    appendInspectableValue(container, first);
    for (const value of rest) {
      container.append(document.createTextNode(" "));
      appendInspectableValue(container, value);
    }
    return;
  }

  let argIndex = 0;
  let activeStyle = "";
  const parts = first.split(/(%[sdifoOc%])/g).filter(Boolean);

  for (const part of parts) {
    if (!part.startsWith("%") || part === "%%") {
      const text = part === "%%" ? "%" : part;
      const span = document.createElement("span");
      span.textContent = text;
      if (activeStyle) span.setAttribute("style", activeStyle);
      container.append(span);
      continue;
    }

    const value = rest[argIndex++];
    if (part === "%c") {
      activeStyle = typeof value === "string" ? sanitizeConsoleStyle(value) : "";
      continue;
    }
    if (part === "%s") container.append(document.createTextNode(String(value)));
    else if (part === "%d" || part === "%i") container.append(document.createTextNode(String(Number.parseInt(String(value), 10))));
    else if (part === "%f") container.append(document.createTextNode(String(Number.parseFloat(String(value)))));
    else appendInspectableValue(container, value);
  }

  for (; argIndex < rest.length; argIndex += 1) {
    container.append(document.createTextNode(" "));
    appendInspectableValue(container, rest[argIndex]);
  }
}

export function appendInspectableValue(container: HTMLElement, value: unknown): void {
  container.append(renderValue(value, {
    maxDepth: 12,
    maxEntries: 2_000,
    onNodeSelect: (node) => {
      node.dispatchEvent(new CustomEvent("roderuda:inspect-node", { bubbles: true, composed: true, detail: node }));
    },
  }));
}

export function sanitizeConsoleStyle(value: string): string {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => /^(color|background(?:-color)?|font(?:-weight|-style)?|text-decoration|border(?:-color)?|padding|margin)/i.test(entry))
    .join(";");
}

export function renderTable(value: unknown): HTMLElement {
  const wrap = ConsoleTableWrap() as HTMLElement;
  const data = normalizeTable(value);
  if (!data.rows.length) {
    wrap.textContent = plainText(value);
    return wrap;
  }
  const table = ConsoleTable() as HTMLTableElement;
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const column of data.columns) {
    const th = ConsoleTableHead() as HTMLTableCellElement;
    th.textContent = column;
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  for (const row of data.rows) {
    const tr = document.createElement("tr");
    for (const column of data.columns) {
      const td = ConsoleTableCell() as HTMLTableCellElement;
      td.textContent = stringifyCell(row[column]);
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

export function stringifyCell(value: unknown): string {
  if (value == null) return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return safeStringify(value, 0);
}

export function normalizeVisibleLevel(level: ConsoleLevel): ConsoleLevel {
  if (level === "trace") return "debug";
  return level === "command" || level === "result" || level === "html" || level === "table" || level === "dir" ? "log" : level;
}



export function sameRecord(left: ConsoleRecord, right: ConsoleRecord): boolean {
  if (left.level !== right.level || left.groupDepth !== right.groupDepth || left.args.length !== right.args.length) return false;
  return left.args.every((value, index) => Object.is(value, right.args[index]));
}

export function normalizeTable(value: unknown): { columns: string[]; rows: Array<Record<string, unknown>> } {
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

/*export async function executeJavaScript(code: string, context: { $_: unknown; $0: unknown; devtools: unknown; globals: ReadonlyMap<string, unknown> }): Promise<unknown> {
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
}*/

  async function executeJavaScript(code, context = {}) {
    // Contexto padrão: fornece atalhos úteis
    const defaultContext = {
      $_: undefined,
      $0: undefined,
      devtools: undefined,
      globals: new Map(),
    };
    const fullContext = { ...defaultContext, ...context };
    const queryOne = (selector, root = document) => root?.querySelector(selector);
    const queryAll = (selector, root = document) => Array.from(root?.querySelectorAll(selector) || []);
    const names = ["$_", "$0", "$", "$$", "devtools", ...fullContext.globals.keys()];
    const values = [fullContext.$_, fullContext.$0, queryOne, queryAll, fullContext.devtools, ...fullContext.globals.values()];

    // Tenta via AsyncFunction (mais rápido)
    const tryAsyncFunction = async () => {
      const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor;
      try {
        const fn = new AsyncFunction(...names, `"use strict"; return await (${code});`);
        return await fn(...values);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        const fn = new AsyncFunction(...names, `"use strict"; ${code}`);
        return await fn(...values);
      }
    };

    // Injeção via Blob URL
    const tryBlob = () => new Promise((resolve, reject) => {
      const callbackId = `__rodDevToolsResult_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      
      // Serializa o contexto para o blob
      let contextScript = '';
      try {
        const ctxObj = {};
        names.forEach((name, i) => { ctxObj[name] = values[i]; });
        contextScript = `const __ctx = ${JSON.stringify(ctxObj, (k, v) => typeof v === 'function' ? v.toString() : v)};`;
      } catch {
        contextScript = names.map((name, i) => {
          const val = values[i];
          return typeof val === 'function' 
            ? `const ${name} = ${val.toString()};` 
            : `const ${name} = ${JSON.stringify(val)};`;
        }).join('\n');
      }

      const blobContent = `
        (function() {
          try {
            ${contextScript}
            const result = (async () => {
              "use strict";
              ${code}
            })();
            result.then(val => {
              window.parent.postMessage({ type: '${callbackId}', result: val }, '*');
            }).catch(err => {
              window.parent.postMessage({ type: '${callbackId}', error: err.message || String(err) }, '*');
            });
          } catch (err) {
            window.parent.postMessage({ type: '${callbackId}', error: err.message || String(err) }, '*');
          }
        })();
      `;

      const blob = new Blob([blobContent], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => { script.remove(); URL.revokeObjectURL(url); };
      script.onerror = () => { script.remove(); URL.revokeObjectURL(url); reject(new Error('Blob script load failed')); };

      const listener = (e) => {
        if (e.data?.type === callbackId) {
          window.removeEventListener('message', listener);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.result);
        }
      };
      window.addEventListener('message', listener);
      document.documentElement.appendChild(script);
    });

    // Fallback: eval no contexto da página (se permitido)
    const tryEval = () => {
      const evalInPage = (window.eval || eval);
      return evalInPage(`(async () => { ${code} })()`);
    };

    // Fallback extremo: document.write (só funciona se a página ainda estiver carregando)
    const tryDocumentWrite = () => new Promise((resolve, reject) => {
      const callbackId = `__rodRiriWrite_${Date.now()}`;
      const scriptContent = `
        window['${callbackId}'] = (async () => { ${code} })();
      `;
      document.write(`<script>${scriptContent}<\/script>`);
      // Espera a execução
      let attempts = 0;
      const check = setInterval(() => {
        if (window[callbackId] !== undefined) {
          clearInterval(check);
          resolve(window[callbackId]);
          delete window[callbackId];
        }
        if (++attempts > 20) { clearInterval(check); reject(new Error('Document.write timeout')); }
      }, 100);
    });

    // Executa em cascata
    try {
      return await tryAsyncFunction();
    } catch (err) {
      if (!(err instanceof EvalError) && !(err.message && (err.message.includes('CSP') || err.message.includes('eval')))) {
        throw err;
      }
    //  log('warn', 'execute.csp.fallback.blob');
      try {
        return await tryBlob();
      } catch {
     //   log('warn', 'execute.csp.fallback.eval');
        try {
          return await tryEval();
        } catch {
    //      log('warn', 'execute.csp.fallback.documentWrite');
          return await tryDocumentWrite();
        }
      }
    }
  }

export function readHistory(limit: number): string[] {
  try {
    const value = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(-Math.max(0, limit)) : [];
  } catch {
    return [];
  }
}

export function writeHistory(history: readonly string[], limit: number): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limit <= 0 ? [] : history.slice(-limit)));
  } catch {}
}

export function appendHistory(history: readonly string[], code: string, limit: number): string[] {
  const trimmed = code.trim();
  if (!trimmed) return [...history];
  const next = history.at(-1) === trimmed ? [...history] : [...history, trimmed];
  return limit <= 0 ? [] : next.slice(-limit);
}

export function consoleCompletions(context: { 
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

export function resolveCompletionRoot(name: string): unknown {
  if (name === "window") return window;
  if (name === "document") return document;
  if (name === "console") return console;
  if (name === "localStorage") return localStorage;
  if (name === "sessionStorage") return sessionStorage;
  return undefined;
}

export function collectPropertyNames(value: unknown, prefix: string): string[] {
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

export function isInitialConsoleEntry(value: unknown): value is { level?: ConsoleLevel; args?: readonly unknown[]; message?: unknown; timestamp?: number; stack?: string } {
  return value !== null && typeof value === "object" && !(value instanceof Error) && ("args" in value || "message" in value || "level" in value);
}
