import type { ReactFiberLike, ReactFiberRootLike } from "@rodkisten/devtools/core/react-capture";

export const REACT_WORK_TAGS: Readonly<Record<number, string>> = Object.freeze({
  0: "FunctionComponent",
  1: "ClassComponent",
  2: "IndeterminateComponent",
  3: "HostRoot",
  4: "HostPortal",
  5: "HostComponent",
  6: "HostText",
  7: "Fragment",
  8: "Mode",
  9: "ContextConsumer",
  10: "ContextProvider",
  11: "ForwardRef",
  12: "Profiler",
  13: "Suspense",
  14: "MemoComponent",
  15: "SimpleMemoComponent",
  16: "LazyComponent",
  17: "IncompleteClassComponent",
  18: "DehydratedFragment",
  19: "SuspenseList",
  20: "FundamentalComponent",
  21: "ScopeComponent",
  22: "OffscreenComponent",
  23: "LegacyHiddenComponent",
  24: "CacheComponent",
  25: "TracingMarkerComponent",
  26: "HostHoistable",
  27: "HostSingleton",
  28: "IncompleteFunctionComponent",
  29: "Throw",
  30: "ViewTransition",
  31: "Activity",
});

const REACT_SYMBOL_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "react.fragment": "Fragment",
  "react.strict_mode": "StrictMode",
  "react.profiler": "Profiler",
  "react.provider": "Context.Provider",
  "react.context": "Context.Consumer",
  "react.consumer": "Context.Consumer",
  "react.forward_ref": "ForwardRef",
  "react.suspense": "Suspense",
  "react.suspense_list": "SuspenseList",
  "react.memo": "Memo",
  "react.lazy": "Lazy",
  "react.offscreen": "Offscreen",
  "react.scope": "Scope",
  "react.tracing_marker": "TracingMarker",
  "react.view_transition": "ViewTransition",
  "react.activity": "Activity",
});

export interface ReactHookModel {
  readonly index: number;
  readonly kind: string;
  readonly memoizedState: unknown;
  readonly baseState: unknown;
  readonly baseQueue: unknown;
  readonly queue: unknown;
}

export interface ReactContextModel {
  readonly index: number;
  readonly name: string;
  readonly value: unknown;
  readonly context: unknown;
}

export function workTagName(tag: unknown): string {
  return typeof tag === "number" ? REACT_WORK_TAGS[tag] ?? `Tag(${tag})` : "Unknown";
}

export function isHostFiber(fiber: ReactFiberLike): boolean {
  return fiber.tag === 3 || fiber.tag === 4 || fiber.tag === 5 || fiber.tag === 6 || fiber.tag === 26 || fiber.tag === 27;
}

export function isDomHostFiber(fiber: ReactFiberLike): boolean {
  return fiber.tag === 5 || fiber.tag === 6 || fiber.tag === 26 || fiber.tag === 27;
}

export function isFunctionLikeFiber(fiber: ReactFiberLike): boolean {
  return fiber.tag === 0 || fiber.tag === 11 || fiber.tag === 14 || fiber.tag === 15 || fiber.tag === 16 || fiber.tag === 28;
}

export function fiberDisplayName(fiber: ReactFiberLike): string {
  if (fiber.tag === 3) return "Root";
  if (fiber.tag === 6) return "#text";
  if (fiber.tag === 7) return "Fragment";
  if (fiber.tag === 13) return "Suspense";
  if (fiber.tag === 19) return "SuspenseList";
  if (fiber.tag === 22) return "Offscreen";
  if (fiber.tag === 24) return "Cache";
  if (fiber.tag === 29) return "Throw";
  if (fiber.tag === 30) return "ViewTransition";
  if (fiber.tag === 31) return "Activity";

  const typeName = displayNameFromType(fiber.type);
  if (typeName) return typeName;

  const elementTypeName = displayNameFromType(fiber.elementType);
  if (elementTypeName) return elementTypeName;

  if (typeof fiber.type === "string") return fiber.type;
  return workTagName(fiber.tag);
}

export function displayNameFromType(type: unknown): string | null {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const candidate = type as { displayName?: unknown; name?: unknown };
    if (typeof candidate.displayName === "string" && candidate.displayName) return candidate.displayName;
    if (typeof candidate.name === "string" && candidate.name) return candidate.name;
    return "Anonymous";
  }

  if (typeof type === "symbol") {
    return REACT_SYMBOL_NAMES[type.description ?? Symbol.keyFor(type) ?? ""] ?? type.description ?? String(type);
  }

  if (!type || typeof type !== "object") return null;
  const objectType = type as Record<string, unknown>;

  if (typeof objectType.displayName === "string" && objectType.displayName) return objectType.displayName;
  if (typeof objectType.name === "string" && objectType.name) return objectType.name;

  const symbol = objectType.$$typeof;
  if (typeof symbol === "symbol") {
    const symbolName = symbol.description ?? Symbol.keyFor(symbol) ?? "";
    const known = REACT_SYMBOL_NAMES[symbolName];

    if (symbolName === "react.memo") {
      const inner = displayNameFromType(objectType.type);
      return inner ? `Memo(${inner})` : "Memo";
    }

    if (symbolName === "react.forward_ref") {
      const inner = displayNameFromType(objectType.render);
      return inner ? `ForwardRef(${inner})` : "ForwardRef";
    }

    if (symbolName === "react.lazy") return "Lazy";
    if (known) return known;
  }

  const context = objectType._context as Record<string, unknown> | undefined;
  const contextName = context?.displayName ?? objectType.displayName;
  if (typeof contextName === "string" && contextName) return contextName;

  return null;
}

export function fiberKind(fiber: ReactFiberLike): string {
  const tag = workTagName(fiber.tag);
  if (fiber.tag === 5 || fiber.tag === 26 || fiber.tag === 27) return "DOM";
  if (fiber.tag === 6) return "Text";
  if (fiber.tag === 1 || fiber.tag === 17) return "Class";
  if (isFunctionLikeFiber(fiber)) return "Component";
  if (fiber.tag === 9 || fiber.tag === 10) return "Context";
  if (fiber.tag === 3) return "Root";
  return tag.replace(/Component$/, "");
}

export function fiberKey(fiber: ReactFiberLike): string | null {
  return fiber.key == null ? null : String(fiber.key);
}

export function fiberChildren(fiber: ReactFiberLike): ReactFiberLike[] {
  const output: ReactFiberLike[] = [];
  const seen = new Set<ReactFiberLike>();
  let child = fiber.child ?? null;
  let guard = 0;

  while (child && guard < 50_000 && !seen.has(child)) {
    seen.add(child);
    output.push(child);
    child = child.sibling ?? null;
    guard += 1;
  }

  return output;
}

export function rootCurrent(root: ReactFiberRootLike): ReactFiberLike | null {
  try {
    return root.current && typeof root.current === "object" ? root.current : null;
  } catch {
    return null;
  }
}

export function fiberPath(fiber: ReactFiberLike): string {
  const parts: string[] = [];
  let current: ReactFiberLike | null | undefined = fiber;
  let guard = 0;

  while (current && guard < 512) {
    const name = fiberDisplayName(current);
    const key = fiberKey(current);
    parts.push(key ? `${name}[${JSON.stringify(key)}]` : name);
    current = current.return;
    guard += 1;
  }

  return parts.reverse().join(" > ");
}

export function collectHooks(fiber: ReactFiberLike, maxHooks = 200): ReactHookModel[] {
  if (!isFunctionLikeFiber(fiber)) return [];

  const output: ReactHookModel[] = [];
  const seen = new Set<object>();
  let current = fiber.memoizedState;
  let index = 0;

  while (current && typeof current === "object" && index < maxHooks && !seen.has(current as object)) {
    seen.add(current as object);
    const hook = current as Record<string, unknown>;
    output.push({
      index,
      kind: classifyHook(hook),
      memoizedState: hook.memoizedState,
      baseState: hook.baseState,
      baseQueue: hook.baseQueue,
      queue: hook.queue,
    });
    current = hook.next;
    index += 1;
  }

  return output;
}

function classifyHook(hook: Record<string, unknown>): string {
  const state = hook.memoizedState;
  const queue = hook.queue as Record<string, unknown> | null | undefined;

  if (queue && typeof queue === "object") {
    if (typeof queue.dispatch === "function") {
      if (typeof queue.lastRenderedReducer === "function") {
        const reducerName = (queue.lastRenderedReducer as { name?: string }).name;
        return reducerName && reducerName !== "basicStateReducer" ? "Reducer / State" : "State / Reducer";
      }
      return "State / Reducer";
    }
  }

  if (state && typeof state === "object") {
    const value = state as Record<string, unknown>;
    if ("current" in value && Object.keys(value).length <= 4) return "Ref";
    if (typeof value.create === "function" && ("deps" in value || "tag" in value)) return "Effect";
    if ("inst" in value && "deps" in value) return "Effect Event / Memo";
  }

  if (Array.isArray(state) && state.length === 2 && Array.isArray(state[1])) {
    return typeof state[0] === "function" ? "Callback" : "Memo";
  }

  if (typeof state === "string" && /[«:]r\d/i.test(state)) return "Id";
  if (typeof state === "boolean") return "Transition / Optimistic / State";

  return "Hook";
}

export function collectContexts(fiber: ReactFiberLike, maxContexts = 100): ReactContextModel[] {
  const output: ReactContextModel[] = [];
  const dependencies = fiber.dependencies;
  if (!dependencies || typeof dependencies !== "object") return output;

  let current = (dependencies as Record<string, unknown>).firstContext;
  const seen = new Set<object>();
  let index = 0;

  while (current && typeof current === "object" && index < maxContexts && !seen.has(current as object)) {
    seen.add(current as object);
    const dependency = current as Record<string, unknown>;
    const context = dependency.context;
    output.push({
      index,
      name: contextDisplayName(context, index),
      value: dependency.memoizedValue,
      context,
    });
    current = dependency.next;
    index += 1;
  }

  return output;
}

function contextDisplayName(context: unknown, index: number): string {
  if (context && typeof context === "object") {
    const candidate = context as Record<string, unknown>;
    if (typeof candidate.displayName === "string" && candidate.displayName) return candidate.displayName;
    const nested = candidate._context;
    if (nested && typeof nested === "object") {
      const nestedName = (nested as Record<string, unknown>).displayName;
      if (typeof nestedName === "string" && nestedName) return nestedName;
    }
  }
  return `Context ${index + 1}`;
}

export function shallowSearchText(value: unknown, maxEntries = 24): string {
  if (value == null) return String(value);
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean" || type === "bigint") return String(value);
  if (type === "function") {
    const fn = value as { name?: string };
    return fn.name ?? "function";
  }
  if (type !== "object") return "";

  const parts: string[] = [];
  let keys: string[];
  try {
    keys = Object.keys(value as object).slice(0, maxEntries);
  } catch {
    return "";
  }

  for (const key of keys) {
    parts.push(key);
    try {
      const entry = (value as Record<string, unknown>)[key];
      if (entry == null || ["string", "number", "boolean", "bigint"].includes(typeof entry)) {
        parts.push(String(entry));
      } else if (typeof entry === "function") {
        parts.push((entry as { name?: string }).name ?? "function");
      }
    } catch {}
  }

  return parts.join(" ");
}

export function fiberSearchText(fiber: ReactFiberLike, includeValues: boolean): string {
  const base = [
    fiberDisplayName(fiber),
    workTagName(fiber.tag),
    fiberKind(fiber),
    fiberKey(fiber) ?? "",
  ];

  if (includeValues) {
    base.push(shallowSearchText(fiber.memoizedProps));
    base.push(shallowSearchText(fiber.memoizedState));
    const instance = fiber.stateNode;
    if (instance && typeof instance === "object") {
      base.push(shallowSearchText((instance as Record<string, unknown>).state));
    }
  }

  return base.join(" ").toLowerCase();
}

export function formatLaneBits(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return `${value} · 0b${Math.max(0, value >>> 0).toString(2)}`;
}

export function fiberMetadata(fiber: ReactFiberLike): Record<string, unknown> {
  return {
    tag: fiber.tag,
    tagName: workTagName(fiber.tag),
    key: fiber.key,
    index: fiber.index,
    mode: fiber.mode,
    flags: fiber.flags,
    subtreeFlags: fiber.subtreeFlags,
    lanes: formatLaneBits(fiber.lanes),
    childLanes: formatLaneBits(fiber.childLanes),
    ref: fiber.ref,
    refCleanup: fiber.refCleanup,
    actualDuration: fiber.actualDuration,
    actualStartTime: fiber.actualStartTime,
    selfBaseDuration: fiber.selfBaseDuration,
    treeBaseDuration: fiber.treeBaseDuration,
    _debugSource: fiber._debugSource,
    _debugInfo: fiber._debugInfo,
    _debugStack: fiber._debugStack,
    alternate: fiber.alternate,
    return: fiber.return,
    child: fiber.child,
    sibling: fiber.sibling,
    stateNode: fiber.stateNode,
    elementType: fiber.elementType,
    type: fiber.type,
    pendingProps: fiber.pendingProps,
    memoizedProps: fiber.memoizedProps,
    memoizedState: fiber.memoizedState,
    updateQueue: fiber.updateQueue,
    dependencies: fiber.dependencies,
    deletions: fiber.deletions,
  };
}
