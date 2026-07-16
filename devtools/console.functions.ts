import type { RenderValue } from "@rodkisten/fabrica";
import { component, event, html } from "@rodkisten/devtools/core/runtime";
import { plainText, renderValue } from "@rodkisten/devtools/core/serialize";
import { safeStringify } from "@rodkisten/devtools/utils";
import type { ConsoleLevel, ConsoleRecord } from "@rodkisten/devtools/types";

const HISTORY_STORAGE_KEY = "roderuda:console-history";

const ConsoleRecordView = component<{
  record: ConsoleRecord;
  displayExtraInfo: boolean;
}>("RodConsoleRecordView", function RodConsoleRecordView(props, ctx) {
  const expanded = ctx.signal(false, { name: `console.record.${props.record.id}.expanded` });
  const toggle = (): void => expanded.update((value) => !value);

  return html`
    <RodConsoleRow
      :level=${props.record.level}
      :recordId=${props.record.id}
      :expanded=${expanded}
      style=${`--rd-console-depth: ${props.record.groupDepth}`}
      tabindex="0"
      role="button"
      aria-expanded=${() => String(expanded())}
      @click=${event.click((click) => {
        const target = click.target;
        if (target instanceof Element && target.closest("details,summary,a,button,input,textarea,select")) return;
        toggle();
      })}
      @keydown=${event.keydown((keyboard) => {
        if (keyboard.key !== "Enter" && keyboard.key !== " ") return;
        keyboard.preventDefault();
        toggle();
      })}
    >
      ${(props.record.repeat ?? 1) > 1
        ? html`<RodConsoleRepeat>${String(props.record.repeat ?? 1)}</RodConsoleRepeat>`
        : null}
      ${props.record.collapsed != null
        ? html`<RodConsoleGroup>${props.record.collapsed ? "▸" : "▾"}</RodConsoleGroup>`
        : null}
      <div class="roderuda-console-output">
        ${props.record.level === "table"
          ? tableView(props.record.args[0])
          : formattedConsoleArgs(props.record.args)}
      </div>
      ${props.record.stack ? html`<RodConsoleStack>${props.record.stack}</RodConsoleStack>` : null}
      ${props.displayExtraInfo
        ? html`<RodConsoleTime>${new Date(props.record.timestamp).toLocaleTimeString()}</RodConsoleTime>`
        : null}
    </RodConsoleRow>
  `;
});

export function renderRecord(record: ConsoleRecord, displayExtraInfo: boolean): RenderValue {
  return ConsoleRecordView({ record, displayExtraInfo });
}

function formattedConsoleArgs(args: readonly unknown[]): RenderValue {
  if (!args.length) return null;

  const [first, ...rest] = args;
  if (typeof first !== "string" || !/%[sdifoOc%]/.test(first)) {
    const values: RenderValue[] = [inspectableValue(first)];
    for (const value of rest) values.push(" ", inspectableValue(value));
    return values;
  }

  const values: RenderValue[] = [];
  let argIndex = 0;
  let activeStyle = "";
  const parts = first.split(/(%[sdifoOc%])/g).filter(Boolean);

  for (const part of parts) {
    if (!part.startsWith("%") || part === "%%") {
      const text = part === "%%" ? "%" : part;
      values.push(activeStyle ? html`<span style=${activeStyle}>${text}</span>` : text);
      continue;
    }

    const value = rest[argIndex++];
    if (part === "%c") {
      activeStyle = typeof value === "string" ? sanitizeConsoleStyle(value) : "";
      continue;
    }

    if (part === "%s") values.push(String(value));
    else if (part === "%d" || part === "%i") values.push(String(Number.parseInt(String(value), 10)));
    else if (part === "%f") values.push(String(Number.parseFloat(String(value))));
    else values.push(inspectableValue(value));
  }

  for (; argIndex < rest.length; argIndex += 1) {
    values.push(" ", inspectableValue(rest[argIndex]));
  }

  return values;
}

function inspectableValue(value: unknown): Node {
  return renderValue(value, {
    maxDepth: 12,
    maxEntries: 2_000,
    onNodeSelect: (node) => {
      node.dispatchEvent(new CustomEvent("roderuda:inspect-node", {
        bubbles: true,
        composed: true,
        detail: node,
      }));
    },
  });
}

export function sanitizeConsoleStyle(value: string): string {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => /^(color|background(?:-color)?|font(?:-weight|-style)?|text-decoration|border(?:-color)?|padding|margin)/i.test(entry))
    .join(";");
}

function tableView(value: unknown): RenderValue {
  const data = normalizeTable(value);
  if (!data.rows.length) {
    return html`<RodConsoleTableWrap>${plainText(value)}</RodConsoleTableWrap>`;
  }

  return html`
    <RodConsoleTableWrap>
      <RodConsoleTable>
        <thead>
          <tr>
            ${data.columns.map((column) => html`<RodConsoleTableHead>${column}</RodConsoleTableHead>`)}
          </tr>
        </thead>
        <tbody>
          ${data.rows.map((row) => html`
            <tr>
              ${data.columns.map((column) => html`<RodConsoleTableCell>${stringifyCell(row[column])}</RodConsoleTableCell>`)}
            </tr>
          `)}
        </tbody>
      </RodConsoleTable>
    </RodConsoleTableWrap>
  `;
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
