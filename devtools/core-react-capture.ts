/**
 * React Fiber discovery and capture for Rod DevTools.
 *
 * This module deliberately has no React dependency. It observes the public
 * React DevTools hook protocol when available and falls back to DOM/container
 * heuristics when React was already running before DevTools loaded.
 */

export type ReactCaptureSource =
  | "hook"
  | "hook-existing"
  | "dom-fiber"
  | "dom-container"
  | "legacy-root"
  | "renderer-host-instance"
  | "weakmap-host-instance"
  | "react-dom-api"
  | "global-scan"
  | "shadow-root"
  | "iframe";

export interface ReactFiberLike {
  tag?: number;
  key?: null | string;
  elementType?: unknown;
  type?: unknown;
  stateNode?: unknown;
  return?: ReactFiberLike | null;
  child?: ReactFiberLike | null;
  sibling?: ReactFiberLike | null;
  index?: number;
  ref?: unknown;
  refCleanup?: unknown;
  pendingProps?: unknown;
  memoizedProps?: unknown;
  updateQueue?: unknown;
  memoizedState?: unknown;
  dependencies?: unknown;
  mode?: number;
  flags?: number;
  subtreeFlags?: number;
  deletions?: unknown;
  lanes?: number;
  childLanes?: number;
  alternate?: ReactFiberLike | null;
  actualDuration?: number;
  actualStartTime?: number;
  selfBaseDuration?: number;
  treeBaseDuration?: number;
  _debugInfo?: unknown;
  _debugOwner?: ReactFiberLike | null;
  _debugSource?: unknown;
  _debugStack?: unknown;
  [key: string]: unknown;
}

export interface ReactFiberRootLike {
  current: ReactFiberLike;
  containerInfo?: unknown;
  pendingChildren?: unknown;
  pingCache?: unknown;
  finishedWork?: ReactFiberLike | null;
  callbackNode?: unknown;
  pendingLanes?: number;
  suspendedLanes?: number;
  pingedLanes?: number;
  expiredLanes?: number;
  errorRecoveryDisabledLanes?: number;
  shellSuspendCounter?: number;
  identifierPrefix?: string;
  [key: string]: unknown;
}

export interface ReactRendererLike {
  bundleType?: number;
  version?: string;
  rendererPackageName?: string;
  rendererConfig?: unknown;
  currentDispatcherRef?: unknown;
  findFiberByHostInstance?: (node: unknown) => ReactFiberLike | null | undefined;
  findHostInstanceByFiber?: (fiber: ReactFiberLike) => unknown;
  findHostInstancesForRefresh?: (...args: unknown[]) => unknown;
  scheduleRefresh?: (...args: unknown[]) => unknown;
  scheduleRoot?: (...args: unknown[]) => unknown;
  setRefreshHandler?: (...args: unknown[]) => unknown;
  overrideHookState?: (...args: unknown[]) => unknown;
  overrideHookStateDeletePath?: (...args: unknown[]) => unknown;
  overrideHookStateRenamePath?: (...args: unknown[]) => unknown;
  overrideProps?: (...args: unknown[]) => unknown;
  overridePropsDeletePath?: (...args: unknown[]) => unknown;
  overridePropsRenamePath?: (...args: unknown[]) => unknown;
  scheduleUpdate?: (fiber: ReactFiberLike) => unknown;
  [key: string]: unknown;
}

export interface ReactRendererRecord {
  readonly id: number;
  renderer: ReactRendererLike;
  hook: ReactDevtoolsHookLike | null;
  realm: Window | null;
  firstSeenAt: number;
  lastSeenAt: number;
  source: ReactCaptureSource;
}

export interface ReactRootRecord {
  readonly id: string;
  root: ReactFiberRootLike;
  rendererId: number | null;
  realm: Window | null;
  firstSeenAt: number;
  lastSeenAt: number;
  commitCount: number;
  didError: boolean;
  sources: Set<ReactCaptureSource>;
}

export interface ReactScanOptions {
  maxDomNodes?: number;
  maxGlobalProperties?: number;
  scanGlobals?: boolean;
  scanFrames?: boolean;
  scanShadowRoots?: boolean;
}

export interface ReactScanReport {
  readonly startedAt: number;
  readonly durationMs: number;
  readonly domNodesVisited: number;
  readonly globalsVisited: number;
  readonly framesVisited: number;
  readonly shadowRootsVisited: number;
  readonly fibersFound: number;
  readonly rootsFound: number;
  readonly rendererCount: number;
  readonly rootCount: number;
  readonly hookCount: number;
  readonly errors: readonly string[];
  readonly strategies: readonly string[];
}

export interface ReactCaptureEvent {
  readonly type: "renderer" | "commit" | "unmount" | "scan" | "hook";
  readonly rendererId?: number | null;
  readonly root?: ReactRootRecord;
  readonly fiber?: ReactFiberLike;
}

export interface ReactDevtoolsHookLike {
  supportsFiber?: boolean;
  supportsFlight?: boolean;
  isDisabled?: boolean;
  renderers?: Map<number, ReactRendererLike> | Record<string, ReactRendererLike>;
  rendererInterfaces?: Map<number, ReactRendererLike> | Record<string, ReactRendererLike>;
  inject?: (renderer: ReactRendererLike) => number;
  onCommitFiberRoot?: (
    rendererId: number,
    root: ReactFiberRootLike,
    priority?: unknown,
    didError?: boolean,
  ) => unknown;
  onPostCommitFiberRoot?: (rendererId: number, root: ReactFiberRootLike) => unknown;
  onCommitFiberUnmount?: (rendererId: number, fiber: ReactFiberLike) => unknown;
  onScheduleFiberRoot?: (rendererId: number, root: ReactFiberRootLike, children: unknown) => unknown;
  getFiberRoots?: (rendererId: number) => Set<ReactFiberRootLike> | Iterable<ReactFiberRootLike>;
  sub?: (event: string, listener: (...args: unknown[]) => void) => (() => void) | void;
  emit?: (event: string, data?: unknown) => void;
  [key: string]: unknown;
}

type MutableWindow = Window & {
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevtoolsHookLike;
  unsafeWindow?: Window;
  wrappedJSObject?: Window;
  React?: unknown;
  ReactDOM?: unknown;
  ReactDOMClient?: unknown;
  [key: string]: unknown;
};

const REACT_HOOK_KEY = "__REACT_DEVTOOLS_GLOBAL_HOOK__";
const DOM_FIBER_PREFIXES = ["__reactFiber$", "__reactInternalInstance$"] as const;
const DOM_CONTAINER_PREFIXES = ["__reactContainer$"] as const;
const DOM_PROPS_PREFIXES = ["__reactProps$"] as const;
const LEGACY_ROOT_KEYS = ["_reactRootContainer", "__reactRootContainer", "reactRootContainer"] as const;
const REACT_GLOBAL_HINT = /react|fiber|root|renderer/i;
const MAX_FIBER_ASCENT = 10_000;
const MAX_FIBER_SEARCH = 80_000;
const REACT_DOM_WALKER_MASK = 1 | 4 | 128; // ELEMENT | TEXT | COMMENT
const WEAKMAP_SET_PROBE_META = "__rodReactCaptureWeakMapSetProbe__";
const WEAKMAP_GET_PROBE_META = "__rodReactCaptureWeakMapGetProbe__";
const REACT_API_WRAP_META = "__rodReactCaptureApiWrap__";

interface WeakMapSetProbeMetadata {
  readonly original: (this: WeakMap<object, unknown>, key: object, value: unknown) => WeakMap<object, unknown>;
  readonly observers: Set<(key: unknown, value: unknown) => void>;
}

interface WeakMapGetProbeMetadata {
  readonly original: (this: WeakMap<object, unknown>, key: object) => unknown;
  readonly observers: Set<(key: unknown, value: unknown) => void>;
}

function now(): number {
  try {
    return performance.now();
  } catch {
    return Date.now();
  }
}

function isObjectLike(value: unknown): value is Record<PropertyKey, unknown> {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function isNodeLike(value: unknown): value is Node {
  if (!isObjectLike(value)) return false;
  try {
    return typeof value.nodeType === "number" && typeof value.nodeName === "string";
  } catch {
    return false;
  }
}

function isElementLike(value: unknown): value is Element {
  if (!isNodeLike(value)) return false;
  try {
    return value.nodeType === 1 && typeof (value as Element).tagName === "string";
  } catch {
    return false;
  }
}

function isFiberLike(value: unknown): value is ReactFiberLike {
  if (!isObjectLike(value)) return false;

  let tag: unknown;
  try {
    tag = value.tag;
  } catch {
    return false;
  }

  if (typeof tag !== "number" || tag < 0 || tag > 100) return false;

  try {
    return (
      "return" in value ||
      "child" in value ||
      "sibling" in value ||
      "memoizedProps" in value ||
      "memoizedState" in value ||
      tag === 3
    );
  } catch {
    return false;
  }
}

function isRootLike(value: unknown): value is ReactFiberRootLike {
  if (!isObjectLike(value)) return false;
  try {
    return isFiberLike(value.current) && value.current.tag === 3;
  } catch {
    return false;
  }
}

function safeOwnPropertyNames(value: object): string[] {
  try {
    return Object.getOwnPropertyNames(value);
  } catch {
    return [];
  }
}

function safeRead(value: unknown, key: PropertyKey): unknown {
  if (!isObjectLike(value)) return undefined;
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function safeWindow(value: unknown): Window | null {
  if (!value || typeof value !== "object") return null;
  try {
    const candidate = value as Window;
    if (!candidate.document || !candidate.location) return null;
    return candidate;
  } catch {
    return null;
  }
}

function candidateRootFromFiber(fiber: ReactFiberLike | null | undefined): ReactFiberRootLike | null {
  if (!fiber) return null;

  let current: ReactFiberLike | null | undefined = fiber;
  let steps = 0;

  while (current && steps < MAX_FIBER_ASCENT) {
    if (current.tag === 3) {
      const stateNode = current.stateNode;
      if (isRootLike(stateNode)) return stateNode;

      // Some custom renderers expose a HostRoot fiber without the normal
      // FiberRoot state node. A tiny synthetic shell still lets the inspector
      // navigate the tree read-only.
      return { current };
    }

    current = current.return;
    steps += 1;
  }

  return null;
}

function candidateRoot(value: unknown): ReactFiberRootLike | null {
  if (isRootLike(value)) return value;
  if (isFiberLike(value)) return candidateRootFromFiber(value);

  if (!isObjectLike(value)) return null;

  const internalRoot = safeRead(value, "_internalRoot");
  if (isRootLike(internalRoot)) return internalRoot;

  const root = safeRead(value, "root");
  if (isRootLike(root)) return root;

  const current = safeRead(value, "current");
  if (isFiberLike(current)) return candidateRootFromFiber(current);

  return null;
}

function iterableEntries(value: unknown): Array<[number, ReactRendererLike]> {
  if (!value) return [];

  // Cross-realm Maps fail `instanceof Map`, so prefer the iterator protocol.
  if (isObjectLike(value) && typeof safeRead(value, "entries") === "function") {
    try {
      const output: Array<[number, ReactRendererLike]> = [];
      const iterator = (safeRead(value, "entries") as () => Iterable<[unknown, unknown]>).call(value);
      for (const pair of iterator) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const id = pair[0];
        const renderer = pair[1];
        if (typeof id === "number" && isObjectLike(renderer)) {
          output.push([id, renderer as ReactRendererLike]);
        }
      }
      if (output.length) return output;
    } catch {}
  }

  if (typeof value === "object") {
    const output: Array<[number, ReactRendererLike]> = [];
    for (const key of safeOwnPropertyNames(value)) {
      const id = Number(key);
      const renderer = safeRead(value, key);
      if (Number.isFinite(id) && isObjectLike(renderer)) {
        output.push([id, renderer as ReactRendererLike]);
      }
    }
    return output;
  }

  return [];
}

function isDevtoolsHostElement(element: Element): boolean {
  try {
    if (element.id === "roderuda" || element.id.startsWith("__rod-devtools")) return true;
    if (element.classList.contains("__roderuda-host__")) return true;
    return Boolean(element.closest?.("#roderuda, .__roderuda-host__, [data-roderuda-root]"));
  } catch {
    return false;
  }
}

/** Central read-only React capture shared by every React panel instance. */
export class ReactCapture {
  private readonly renderers = new Map<number, ReactRendererRecord>();
  private readonly roots = new Map<string, ReactRootRecord>();
  private readonly rootIds = new WeakMap<object, string>();
  private readonly patchedHooks = new WeakSet<object>();
  private readonly hookInjectFunctions = new WeakMap<object, Function>();
  private readonly hookCommitFunctions = new WeakMap<object, Function>();
  private readonly hookUnmountFunctions = new WeakMap<object, Function>();
  private readonly hookScheduleFunctions = new WeakMap<object, Function>();
  private readonly knownHooks = new Set<ReactDevtoolsHookLike>();
  private readonly listeners = new Set<(event: ReactCaptureEvent) => void>();
  private rootSequence = 0;
  private rendererSequence = 10_000;
  private lastReport: ReactScanReport | null = null;
  private weakMapSetFiberHits = 0;
  private weakMapGetFiberHits = 0;
  private reactDomApiHits = 0;
  private readonly weakMapProbeSets = new WeakMap<object, Function>();
  private readonly weakMapProbeGets = new WeakMap<object, Function>();
  private readonly reactDomResolverFunctions = new WeakSet<Function>();
  private readonly hostFiberResolvers = new Set<(node: unknown) => unknown>();
  private readonly hostNodeResolvers = new Set<(fiber: ReactFiberLike) => unknown>();

  constructor() {
    this.installEarlyHooks();
  }

  /** Installs/patches React hooks in every directly reachable page realm. */
  installEarlyHooks(): void {
    for (const realm of this.realmCandidates()) {
      this.ensureHook(realm);
      this.installWeakMapProbe(realm);
      this.instrumentReactDomGlobals(realm);
    }
  }

  subscribe(listener: (event: ReactCaptureEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  rendererRecords(): readonly ReactRendererRecord[] {
    return Array.from(this.renderers.values()).sort((a, b) => a.id - b.id);
  }

  rootRecords(): readonly ReactRootRecord[] {
    return Array.from(this.roots.values()).sort((a, b) => a.firstSeenAt - b.firstSeenAt);
  }

  getLastReport(): ReactScanReport | null {
    return this.lastReport;
  }

  getKnownHooks(): readonly ReactDevtoolsHookLike[] {
    return Array.from(this.knownHooks);
  }

  diagnostics(): Record<string, unknown> {
    return {
      rendererCount: this.renderers.size,
      rootCount: this.roots.size,
      hookCount: this.knownHooks.size,
      renderers: this.rendererRecords().map((record) => ({
        id: record.id,
        version: record.renderer.version ?? null,
        packageName: record.renderer.rendererPackageName ?? null,
        bundleType: record.renderer.bundleType ?? null,
        source: record.source,
      })),
      roots: this.rootRecords().map((record) => ({
        id: record.id,
        rendererId: record.rendererId,
        commits: record.commitCount,
        sources: Array.from(record.sources),
      })),
      weakMapFiberHits: this.weakMapSetFiberHits + this.weakMapGetFiberHits,
      weakMapSetFiberHits: this.weakMapSetFiberHits,
      weakMapGetFiberHits: this.weakMapGetFiberHits,
      reactDomApiHits: this.reactDomApiHits,
      reactDomFiberResolvers: this.hostFiberResolvers.size,
      reactDomNodeResolvers: this.hostNodeResolvers.size,
      lastScan: this.lastReport,
      realms: this.realmCandidates().length,
    };
  }

  /** Re-patches replaced hooks and harvests renderer/root registries without scanning the DOM. */
  reconcileHooks(): void {
    const errors: string[] = [];
    const strategies = new Set<string>();
    for (const realm of this.realmCandidates()) {
      this.ensureHook(realm);
      this.installWeakMapProbe(realm);
      this.instrumentReactDomGlobals(realm);
      this.harvestHook(realm, errors, strategies);
    }
  }

  /**
   * Exhaustive but bounded discovery pass. Safe to call repeatedly; objects are
   * de-duplicated by identity and commit/root timestamps are refreshed.
   */
  scan(options: ReactScanOptions = {}): ReactScanReport {
    const startedAt = now();
    const maxDomNodes = Math.max(100, options.maxDomNodes ?? 25_000);
    const maxGlobalProperties = Math.max(100, options.maxGlobalProperties ?? 4_000);
    const scanGlobals = options.scanGlobals !== false;
    const scanFrames = options.scanFrames !== false;
    const scanShadowRoots = options.scanShadowRoots !== false;
    const errors: string[] = [];
    const strategies = new Set<string>();

    let domNodesVisited = 0;
    let globalsVisited = 0;
    let framesVisited = 0;
    let shadowRootsVisited = 0;
    let fibersFound = 0;
    const rootsBefore = this.roots.size;

    const realms = this.realmCandidates();
    const seenDocuments = new Set<Document>();
    const documents: Array<{ document: Document; realm: Window | null; source: ReactCaptureSource }> = [];

    for (const realm of realms) {
      this.ensureHook(realm);
      this.installWeakMapProbe(realm);
      this.instrumentReactDomGlobals(realm);
      this.harvestHook(realm, errors, strategies);
      try {
        if (!seenDocuments.has(realm.document)) {
          seenDocuments.add(realm.document);
          documents.push({ document: realm.document, realm, source: "dom-fiber" });
        }
      } catch (error) {
        errors.push(`realm document: ${this.errorMessage(error)}`);
      }
    }

    for (let documentIndex = 0; documentIndex < documents.length; documentIndex += 1) {
      const entry = documents[documentIndex]!;
      const doc = entry.document;
      const realm = entry.realm;

      try {
        const rootElement = doc.documentElement;
        if (!rootElement) continue;

        // React can attach its internal instance to Elements, Text nodes and
        // Suspense comment sentinels. Numeric flags are realm-independent and
        // avoid relying on `window.NodeFilter` across userscript worlds.
        this.inspectDomNode(doc, realm, entry.source, strategies);
        const walker = doc.createTreeWalker(rootElement, REACT_DOM_WALKER_MASK);
        let node: Node | null = rootElement;

        while (node && domNodesVisited < maxDomNodes) {
          domNodesVisited += 1;
          const element = isElementLike(node) ? node : null;

          if (!element || !isDevtoolsHostElement(element)) {
            const found = this.inspectDomNode(node, realm, entry.source, strategies);
            fibersFound += found;

            if (scanShadowRoots && element?.shadowRoot) {
              shadowRootsVisited += 1;
              strategies.add("open shadow roots");
              this.scanShadowRoot(element.shadowRoot, realm, maxDomNodes - domNodesVisited, strategies, (visited, fibers) => {
                domNodesVisited += visited;
                fibersFound += fibers;
              });
            }

            if (scanFrames && element?.tagName?.toLowerCase() === "iframe") {
              try {
                const frameElement = element as HTMLIFrameElement;
                const frameWindow = frameElement.contentWindow;
                const frameDocument = frameElement.contentDocument;
                if (frameWindow && frameDocument && !seenDocuments.has(frameDocument)) {
                  // Accessing href is the same-origin gate.
                  void frameWindow.location.href;
                  framesVisited += 1;
                  seenDocuments.add(frameDocument);
                  documents.push({ document: frameDocument, realm: frameWindow, source: "iframe" });
                  this.ensureHook(frameWindow);
                  strategies.add("same-origin iframes");
                }
              } catch {
                // Cross-origin frames are intentionally inaccessible.
              }
            }
          }

          node = walker.nextNode();
        }
      } catch (error) {
        errors.push(`DOM scan: ${this.errorMessage(error)}`);
      }
    }

    if (scanGlobals) {
      for (const realm of realms) {
        try {
          const names = safeOwnPropertyNames(realm).slice(0, maxGlobalProperties);
          for (const name of names) {
            globalsVisited += 1;
            if (!REACT_GLOBAL_HINT.test(name) && name !== "_reactRootContainer") continue;
            const value = safeRead(realm, name);
            const root = candidateRoot(value);
            if (root) {
              this.recordRoot(root, null, realm, "global-scan");
              strategies.add("window/global root hints");
            }

            if (name === REACT_HOOK_KEY && isObjectLike(value)) {
              this.patchHook(value as ReactDevtoolsHookLike, realm);
            }
          }
        } catch (error) {
          errors.push(`global scan: ${this.errorMessage(error)}`);
        }
      }
    }

    // A DOM scan can discover host fibers even when the hook's root bookkeeping
    // is unavailable. Harvest the hook again afterwards in case a renderer was
    // injected during the scan itself.
    for (const realm of realms) this.harvestHook(realm, errors, strategies);

    const report: ReactScanReport = Object.freeze({
      startedAt,
      durationMs: Math.max(0, Math.round((now() - startedAt) * 10) / 10),
      domNodesVisited,
      globalsVisited,
      framesVisited,
      shadowRootsVisited,
      fibersFound,
      rootsFound: this.roots.size - rootsBefore,
      rendererCount: this.renderers.size,
      rootCount: this.roots.size,
      hookCount: this.knownHooks.size,
      errors: Object.freeze(errors.slice()),
      strategies: Object.freeze(Array.from(strategies)),
    });

    this.lastReport = report;
    this.emit({ type: "scan" });
    return report;
  }

  /** Finds the nearest React Fiber for a DOM node using every available route. */
  fiberFromNode(node: Node | null): ReactFiberLike | null {
    if (!node) return null;

    // 1) React DOM expando keys, including ancestor containers.
    let current: Node | null = node;
    let steps = 0;
    while (current && steps < 256) {
      const direct = this.fiberFromDomExpando(current);
      if (direct) return direct;
      current = current.parentNode;
      steps += 1;
    }

    // 2) Renderer internals exposed through the DevTools hook.
    for (const record of this.renderers.values()) {
      const candidates = [record.renderer, this.rendererInterface(record.hook, record.id)];
      for (const renderer of candidates) {
        if (!renderer || typeof renderer.findFiberByHostInstance !== "function") continue;
        try {
          const fiber = renderer.findFiberByHostInstance(node);
          if (isFiberLike(fiber)) {
            this.recordRoot(candidateRootFromFiber(fiber), record.id, record.realm, "renderer-host-instance");
            return fiber;
          }
        } catch {
          // Try the next renderer/fallback.
        }
      }
    }

    // 3) Legacy/global ReactDOM secret internals. React 16-18 UMD builds often
    // expose an Events tuple containing getInstanceFromNode/getNodeFromInstance.
    for (const resolveFiber of this.hostFiberResolvers) {
      try {
        const fiber = resolveFiber(node);
        if (!isFiberLike(fiber)) continue;
        this.recordRoot(candidateRootFromFiber(fiber), null, null, "react-dom-api");
        return fiber;
      } catch {}
    }

    // 4) Last resort: search captured trees for a host fiber whose stateNode is
    // this DOM node. This is slower but only runs for explicit selections.
    for (const rootRecord of this.roots.values()) {
      const fiber = this.findFiber(rootRecord.root.current, (candidate) => {
        try {
          return candidate.stateNode === node;
        } catch {
          return false;
        }
      });
      if (fiber) return fiber;
    }

    return null;
  }

  /** Resolves a host DOM node for any Fiber, preferring renderer-native APIs. */
  nodeFromFiber(fiber: ReactFiberLike | null): Node | null {
    if (!fiber) return null;

    const direct = fiber.stateNode;
    if (isNodeLike(direct)) return direct;

    for (const record of this.renderers.values()) {
      const candidates = [record.renderer, this.rendererInterface(record.hook, record.id)];
      for (const renderer of candidates) {
        if (!renderer || typeof renderer.findHostInstanceByFiber !== "function") continue;
        try {
          const node = renderer.findHostInstanceByFiber(fiber);
          if (isNodeLike(node)) return node;
        } catch {
          // Continue with structural fallback.
        }
      }
    }

    for (const resolveNode of this.hostNodeResolvers) {
      try {
        const node = resolveNode(fiber);
        if (isNodeLike(node)) return node;
      } catch {}
    }

    const found = this.findFiber(fiber, (candidate) => {
      try {
        return isNodeLike(candidate.stateNode);
      } catch {
        return false;
      }
    });

    return isNodeLike(found?.stateNode) ? found!.stateNode as Node : null;
  }

  rootForFiber(fiber: ReactFiberLike | null): ReactRootRecord | null {
    const root = candidateRootFromFiber(fiber ?? undefined);
    if (!root) return null;
    const id = this.rootIds.get(root as object);
    return id ? this.roots.get(id) ?? null : this.recordRoot(root, null, null, "dom-fiber");
  }

  private realmCandidates(): Window[] {
    const candidates: Window[] = [];
    const seen = new Set<Window>();

    const add = (value: unknown): void => {
      const realm = safeWindow(value);
      if (!realm || seen.has(realm)) return;
      seen.add(realm);
      candidates.push(realm);
    };

    if (typeof window !== "undefined") {
      add(window);
      add((window as unknown as MutableWindow).unsafeWindow);
      add((window as unknown as MutableWindow).wrappedJSObject);

      try { add(window.top); } catch {}
      try { add(window.parent); } catch {}
    }

    if (typeof globalThis !== "undefined") {
      add((globalThis as { unsafeWindow?: unknown }).unsafeWindow);
    }

    return candidates;
  }

  /**
   * React's www/experimental DOM binding may keep host-node -> Fiber links in a
   * private WeakMap instead of `__reactFiber$...` expandos. There is no API to
   * enumerate a WeakMap after the fact, so document-start builds also observe
   * WeakMap#set. The wrapper is tiny, shared across reloads of this bundle, and
   * only performs Fiber checks for DOM-looking keys/values.
   */
  private installWeakMapProbe(realm: Window): void {
    const WeakMapCtor = safeRead(realm, "WeakMap");
    if (typeof WeakMapCtor !== "function") return;

    const prototype = safeRead(WeakMapCtor, "prototype");
    if (!isObjectLike(prototype)) return;

    this.installWeakMapSetProbe(prototype, realm);
    this.installWeakMapGetProbe(prototype, realm);
  }

  private installWeakMapSetProbe(prototype: object, realm: Window): void {
    const currentSet = safeRead(prototype, "set");
    if (typeof currentSet !== "function") return;
    if (this.weakMapProbeSets.get(prototype) === currentSet) return;

    let metadata = safeRead(currentSet, WEAKMAP_SET_PROBE_META) as WeakMapSetProbeMetadata | undefined;
    if (!metadata || !metadata.observers || typeof safeRead(metadata.observers, "add") !== "function") {
      const original = currentSet as WeakMapSetProbeMetadata["original"];
      const observers = new Set<(key: unknown, value: unknown) => void>();
      const wrapped = function rodReactWeakMapSet(
        this: WeakMap<object, unknown>,
        key: object,
        value: unknown,
      ): WeakMap<object, unknown> {
        if (isNodeLike(key) || isNodeLike(value)) {
          for (const observer of observers) {
            try { observer(key, value); } catch {}
          }
        }
        return Reflect.apply(original, this, [key, value]) as WeakMap<object, unknown>;
      };

      metadata = { original, observers };
      try {
        Object.defineProperty(wrapped, WEAKMAP_SET_PROBE_META, {
          configurable: false,
          enumerable: false,
          value: metadata,
        });
        Reflect.set(prototype, "set", wrapped);
      } catch {
        return;
      }
    }

    const capture = this;
    metadata.observers.add((key, value) => {
      let fiber: ReactFiberLike | null = null;
      if (isNodeLike(key) && isFiberLike(value)) fiber = value;
      else if (isFiberLike(key) && isNodeLike(value)) fiber = key;
      if (!fiber) return;
      capture.weakMapSetFiberHits += 1;
      const root = candidateRootFromFiber(fiber);
      if (root) capture.recordRoot(root, null, realm, "weakmap-host-instance");
    });

    const installedSet = safeRead(prototype, "set");
    if (typeof installedSet === "function") this.weakMapProbeSets.set(prototype, installedSet);
  }

  private installWeakMapGetProbe(prototype: object, realm: Window): void {
    const currentGet = safeRead(prototype, "get");
    if (typeof currentGet !== "function") return;
    if (this.weakMapProbeGets.get(prototype) === currentGet) return;

    let metadata = safeRead(currentGet, WEAKMAP_GET_PROBE_META) as WeakMapGetProbeMetadata | undefined;
    if (!metadata || !metadata.observers || typeof safeRead(metadata.observers, "add") !== "function") {
      const original = currentGet as WeakMapGetProbeMetadata["original"];
      const observers = new Set<(key: unknown, value: unknown) => void>();
      const wrapped = function rodReactWeakMapGet(
        this: WeakMap<object, unknown>,
        key: object,
      ): unknown {
        const value = Reflect.apply(original, this, [key]);
        // React's private host-instance map is queried with DOM nodes. Looking
        // at the returned value lets an already-running React tree reveal its
        // Fiber on the next native/user event even when no expando exists.
        if (isNodeLike(key) && isFiberLike(value)) {
          for (const observer of observers) {
            try { observer(key, value); } catch {}
          }
        }
        return value;
      };

      metadata = { original, observers };
      try {
        Object.defineProperty(wrapped, WEAKMAP_GET_PROBE_META, {
          configurable: false,
          enumerable: false,
          value: metadata,
        });
        Reflect.set(prototype, "get", wrapped);
      } catch {
        return;
      }
    }

    const capture = this;
    metadata.observers.add((_key, value) => {
      if (!isFiberLike(value)) return;
      capture.weakMapGetFiberHits += 1;
      const root = candidateRootFromFiber(value);
      if (root) capture.recordRoot(root, null, realm, "weakmap-host-instance");
    });

    const installedGet = safeRead(prototype, "get");
    if (typeof installedGet === "function") this.weakMapProbeGets.set(prototype, installedGet);
  }

  /** Wraps legacy/global ReactDOM root factories when they exist. */
  private instrumentReactDomGlobals(realm: Window): void {
    for (const globalName of ["ReactDOM", "ReactDOMClient"] as const) {
      const api = safeRead(realm, globalName);
      if (!isObjectLike(api)) continue;
      this.harvestReactDomInternals(api);

      for (const methodName of ["createRoot", "hydrateRoot", "render", "hydrate"] as const) {
        const method = safeRead(api, methodName);
        if (typeof method !== "function") continue;
        if (safeRead(method, REACT_API_WRAP_META)) continue;

        const capture = this;
        const wrapped = function rodReactRootFactory(this: unknown, ...args: unknown[]): unknown {
          const result = Reflect.apply(method as (...values: unknown[]) => unknown, this, args);
          try {
            const candidates = [result, args[0], args[1]];
            for (const candidate of candidates) {
              const root = candidateRoot(candidate);
              if (!root) continue;
              capture.reactDomApiHits += 1;
              capture.recordRoot(root, null, realm, "react-dom-api");
              break;
            }
          } catch {}
          return result;
        };
        try {
          Object.defineProperty(wrapped, REACT_API_WRAP_META, { value: true });
          Reflect.set(api, methodName, wrapped);
        } catch {}
      }
    }
  }

  private harvestReactDomInternals(api: Record<PropertyKey, unknown>): void {
    const visited = new Set<object>();
    let budget = 400;

    const rememberFiberResolver = (fn: Function, owner: unknown): void => {
      if (this.reactDomResolverFunctions.has(fn)) return;
      this.reactDomResolverFunctions.add(fn);
      this.hostFiberResolvers.add((node) => Reflect.apply(fn, owner, [node]));
    };

    const rememberNodeResolver = (fn: Function, owner: unknown): void => {
      if (this.reactDomResolverFunctions.has(fn)) return;
      this.reactDomResolverFunctions.add(fn);
      this.hostNodeResolvers.add((fiber) => Reflect.apply(fn, owner, [fiber]));
    };

    const visit = (value: unknown, depth: number, path: string): void => {
      if (budget-- <= 0 || depth > 3 || !isObjectLike(value)) return;
      if (visited.has(value)) return;
      visited.add(value);

      if (Array.isArray(value) && /(?:^|\.)events?$/i.test(path)) {
        const first = value[0];
        const second = value[1];
        if (typeof first === "function") rememberFiberResolver(first, undefined);
        if (typeof second === "function") rememberNodeResolver(second, undefined);
      }

      for (const key of safeOwnPropertyNames(value).slice(0, 100)) {
        const child = safeRead(value, key);
        const nextPath = path ? `${path}.${key}` : key;
        if (typeof child === "function") {
          const name = String(safeRead(child, "name") ?? key);
          if (/(?:get|find).*(?:instance|fiber).*(?:node|host)/i.test(name)) {
            rememberFiberResolver(child, value);
          } else if (/(?:get|find).*(?:node|host).*(?:instance|fiber)/i.test(name)) {
            rememberNodeResolver(child, value);
          }
          continue;
        }

        if (depth < 3 && isObjectLike(child) && (/internal|secret|event/i.test(key) || depth === 0)) {
          visit(child, depth + 1, nextPath);
        }
      }
    };

    visit(api, 0, "");
  }

  private ensureHook(realm: Window): ReactDevtoolsHookLike | null {
    const mutable = realm as unknown as MutableWindow;
    let hook: ReactDevtoolsHookLike | undefined;

    try {
      hook = mutable.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    } catch {
      return null;
    }

    if (!hook) {
      hook = this.createHook(realm);
      try {
        Object.defineProperty(mutable, REACT_HOOK_KEY, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: hook,
        });
      } catch {
        try {
          mutable.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
        } catch {
          return null;
        }
      }
    }

    this.patchHook(hook, realm);
    return hook;
  }

  private createHook(realm: Window): ReactDevtoolsHookLike {
    const renderers = new Map<number, ReactRendererLike>();
    const roots = new Map<number, Set<ReactFiberRootLike>>();
    const subscriptions = new Map<string, Set<(...args: unknown[]) => void>>();
    const capture = this;

    const hook: ReactDevtoolsHookLike = {
      supportsFiber: true,
      supportsFlight: false,
      renderers,
      inject(renderer) {
        const id = ++capture.rendererSequence;
        renderers.set(id, renderer);
        capture.recordRenderer(id, renderer, hook, realm, "hook");
        hook.emit?.("renderer", { id, renderer });
        return id;
      },
      onCommitFiberRoot(rendererId, root, _priority, didError) {
        let rendererRoots = roots.get(rendererId);
        if (!rendererRoots) {
          rendererRoots = new Set();
          roots.set(rendererId, rendererRoots);
        }
        rendererRoots.add(root);
        capture.recordCommit(rendererId, root, realm, Boolean(didError));
      },
      onPostCommitFiberRoot() {},
      onCommitFiberUnmount(rendererId, fiber) {
        capture.emit({ type: "unmount", rendererId, fiber });
      },
      onScheduleFiberRoot(rendererId, root) {
        capture.recordRoot(root, rendererId, realm, "hook");
      },
      getFiberRoots(rendererId) {
        return roots.get(rendererId) ?? new Set();
      },
      sub(event, listener) {
        let bucket = subscriptions.get(event);
        if (!bucket) {
          bucket = new Set();
          subscriptions.set(event, bucket);
        }
        bucket.add(listener);
        return () => bucket?.delete(listener);
      },
      emit(event, data) {
        for (const listener of subscriptions.get(event) ?? []) {
          try { listener(data); } catch {}
        }
      },
    };

    for (const callback of [hook.inject, hook.onCommitFiberRoot, hook.onCommitFiberUnmount, hook.onScheduleFiberRoot]) {
      if (typeof callback !== "function") continue;
      try { Object.defineProperty(callback, "__rodReactCaptureOwner", { value: capture }); } catch {}
    }

    return hook;
  }

  private patchHook(hook: ReactDevtoolsHookLike, realm: Window | null): void {
    if (!isObjectLike(hook)) return;
    this.knownHooks.add(hook);

    const firstPatch = !this.patchedHooks.has(hook);
    if (firstPatch) this.patchedHooks.add(hook);
    this.harvestHookRenderers(hook, realm);

    const capture = this;
    try { hook.supportsFiber = true; } catch {}

    const currentInject = typeof hook.inject === "function" ? hook.inject : null;
    if (currentInject) {
      const owner = safeRead(currentInject, "__rodReactCaptureOwner");
      if (owner === this) {
        this.hookInjectFunctions.set(hook, currentInject);
      } else if (this.hookInjectFunctions.get(hook) !== currentInject) {
        const wrappedInject = function wrappedInject(
          this: ReactDevtoolsHookLike,
          renderer: ReactRendererLike,
        ): number {
          let id: number;
          try {
            id = currentInject.call(this, renderer);
          } catch (error) {
            id = ++capture.rendererSequence;
            try { console.warn("[Rod DevTools React] existing hook.inject failed", error); } catch {}
          }
          if (!Number.isFinite(id)) id = ++capture.rendererSequence;
          capture.recordRenderer(id, renderer, hook, realm, "hook");
          return id;
        };
        try { Object.defineProperty(wrappedInject, "__rodReactCaptureOwner", { value: capture }); } catch {}
        try {
          hook.inject = wrappedInject;
          this.hookInjectFunctions.set(hook, wrappedInject);
        } catch {}
      }
    } else {
      const wrappedInject = function wrappedInject(renderer: ReactRendererLike): number {
        const id = ++capture.rendererSequence;
        capture.recordRenderer(id, renderer, hook, realm, "hook");
        return id;
      };
      try { Object.defineProperty(wrappedInject, "__rodReactCaptureOwner", { value: capture }); } catch {}
      try {
        hook.inject = wrappedInject;
        this.hookInjectFunctions.set(hook, wrappedInject);
      } catch {}
    }

    const currentCommit = typeof hook.onCommitFiberRoot === "function" ? hook.onCommitFiberRoot : null;
    if (currentCommit) {
      const owner = safeRead(currentCommit, "__rodReactCaptureOwner");
      if (owner === this) {
        this.hookCommitFunctions.set(hook, currentCommit);
      } else if (this.hookCommitFunctions.get(hook) !== currentCommit) {
        const wrappedCommit = function wrappedCommit(
          this: ReactDevtoolsHookLike,
          rendererId: number,
          root: ReactFiberRootLike,
          priority?: unknown,
          didError?: boolean,
        ): unknown {
          let result: unknown;
          try {
            result = currentCommit.call(this, rendererId, root, priority, didError);
          } finally {
            capture.recordCommit(rendererId, root, realm, Boolean(didError));
          }
          return result;
        };
        try { Object.defineProperty(wrappedCommit, "__rodReactCaptureOwner", { value: capture }); } catch {}
        try {
          hook.onCommitFiberRoot = wrappedCommit;
          this.hookCommitFunctions.set(hook, wrappedCommit);
        } catch {}
      }
    } else {
      const wrappedCommit = function wrappedCommit(
        rendererId: number,
        root: ReactFiberRootLike,
        _priority?: unknown,
        didError?: boolean,
      ): void {
        capture.recordCommit(rendererId, root, realm, Boolean(didError));
      };
      try { Object.defineProperty(wrappedCommit, "__rodReactCaptureOwner", { value: capture }); } catch {}
      try {
        hook.onCommitFiberRoot = wrappedCommit;
        this.hookCommitFunctions.set(hook, wrappedCommit);
      } catch {}
    }

    const currentUnmount = typeof hook.onCommitFiberUnmount === "function" ? hook.onCommitFiberUnmount : null;
    if (currentUnmount) {
      const owner = safeRead(currentUnmount, "__rodReactCaptureOwner");
      if (owner === this) {
        this.hookUnmountFunctions.set(hook, currentUnmount);
      } else if (this.hookUnmountFunctions.get(hook) !== currentUnmount) {
        const wrappedUnmount = function wrappedUnmount(
          this: ReactDevtoolsHookLike,
          rendererId: number,
          fiber: ReactFiberLike,
        ): unknown {
          let result: unknown;
          try {
            result = currentUnmount.call(this, rendererId, fiber);
          } finally {
            capture.emit({ type: "unmount", rendererId, fiber });
          }
          return result;
        };
        try { Object.defineProperty(wrappedUnmount, "__rodReactCaptureOwner", { value: capture }); } catch {}
        try {
          hook.onCommitFiberUnmount = wrappedUnmount;
          this.hookUnmountFunctions.set(hook, wrappedUnmount);
        } catch {}
      }
    } else {
      const wrappedUnmount = function wrappedUnmount(rendererId: number, fiber: ReactFiberLike): void {
        capture.emit({ type: "unmount", rendererId, fiber });
      };
      try { Object.defineProperty(wrappedUnmount, "__rodReactCaptureOwner", { value: capture }); } catch {}
      try {
        hook.onCommitFiberUnmount = wrappedUnmount;
        this.hookUnmountFunctions.set(hook, wrappedUnmount);
      } catch {}
    }

    const currentSchedule = typeof hook.onScheduleFiberRoot === "function" ? hook.onScheduleFiberRoot : null;
    if (currentSchedule) {
      const owner = safeRead(currentSchedule, "__rodReactCaptureOwner");
      if (owner === this) {
        this.hookScheduleFunctions.set(hook, currentSchedule);
      } else if (this.hookScheduleFunctions.get(hook) !== currentSchedule) {
        const wrappedSchedule = function wrappedSchedule(
          this: ReactDevtoolsHookLike,
          rendererId: number,
          root: ReactFiberRootLike,
          children: unknown,
        ): unknown {
          let result: unknown;
          try {
            result = currentSchedule.call(this, rendererId, root, children);
          } finally {
            capture.recordRoot(root, rendererId, realm, "hook");
          }
          return result;
        };
        try { Object.defineProperty(wrappedSchedule, "__rodReactCaptureOwner", { value: capture }); } catch {}
        try {
          hook.onScheduleFiberRoot = wrappedSchedule;
          this.hookScheduleFunctions.set(hook, wrappedSchedule);
        } catch {}
      }
    } else {
      const wrappedSchedule = function wrappedSchedule(rendererId: number, root: ReactFiberRootLike): void {
        capture.recordRoot(root, rendererId, realm, "hook");
      };
      try { Object.defineProperty(wrappedSchedule, "__rodReactCaptureOwner", { value: capture }); } catch {}
      try {
        hook.onScheduleFiberRoot = wrappedSchedule;
        this.hookScheduleFunctions.set(hook, wrappedSchedule);
      } catch {}
    }

    if (firstPatch) this.emit({ type: "hook" });
  }

  private harvestHook(
    realm: Window,
    errors: string[],
    strategies: Set<string>,
  ): void {
    let hook: ReactDevtoolsHookLike | undefined;
    try {
      hook = (realm as unknown as MutableWindow).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    } catch {
      return;
    }
    if (!hook) return;

    this.patchHook(hook, realm);
    this.harvestHookRenderers(hook, realm);
    strategies.add("__REACT_DEVTOOLS_GLOBAL_HOOK__");

    for (const record of this.renderers.values()) {
      if (record.hook !== hook) continue;
      if (typeof hook.getFiberRoots !== "function") continue;
      try {
        const roots = hook.getFiberRoots(record.id);
        if (!roots) continue;
        for (const root of roots) {
          if (isRootLike(root)) this.recordRoot(root, record.id, realm, "hook-existing");
        }
      } catch (error) {
        errors.push(`hook.getFiberRoots(${record.id}): ${this.errorMessage(error)}`);
      }
    }
  }

  private harvestHookRenderers(hook: ReactDevtoolsHookLike, realm: Window | null): void {
    for (const [id, renderer] of iterableEntries(hook.renderers)) {
      this.recordRenderer(id, renderer, hook, realm, "hook-existing");
    }
    for (const [id, renderer] of iterableEntries(hook.rendererInterfaces)) {
      const existing = this.renderers.get(id);
      if (existing) {
        existing.lastSeenAt = Date.now();
      } else {
        this.recordRenderer(id, renderer, hook, realm, "hook-existing");
      }
    }
  }

  private rendererInterface(hook: ReactDevtoolsHookLike | null, id: number): ReactRendererLike | null {
    if (!hook) return null;
    const entries = iterableEntries(hook.rendererInterfaces);
    for (const [candidateId, renderer] of entries) {
      if (candidateId === id) return renderer;
    }
    return null;
  }

  private inspectDomNode(
    node: Node,
    realm: Window | null,
    inheritedSource: ReactCaptureSource,
    strategies: Set<string>,
  ): number {
    let foundFibers = 0;
    const names = safeOwnPropertyNames(node);

    for (const key of names) {
      if (DOM_FIBER_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        const value = safeRead(node, key);
        if (isFiberLike(value)) {
          foundFibers += 1;
          const root = candidateRootFromFiber(value);
          if (root) this.recordRoot(root, null, realm, inheritedSource === "iframe" ? "iframe" : "dom-fiber");
          strategies.add("DOM __reactFiber$/__reactInternalInstance$");
        }
        continue;
      }

      if (DOM_CONTAINER_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        const value = safeRead(node, key);
        const root = candidateRoot(value);
        if (root) {
          this.recordRoot(root, null, realm, inheritedSource === "iframe" ? "iframe" : "dom-container");
          strategies.add("DOM __reactContainer$");
        }
        continue;
      }

      if (DOM_PROPS_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        strategies.add("DOM __reactProps$ evidence");
      }
    }

    for (const key of LEGACY_ROOT_KEYS) {
      const value = safeRead(node, key);
      const root = candidateRoot(value);
      if (root) {
        this.recordRoot(root, null, realm, "legacy-root");
        strategies.add("legacy _reactRootContainer");
      }
    }

    return foundFibers;
  }

  private scanShadowRoot(
    shadowRoot: ShadowRoot,
    realm: Window | null,
    budget: number,
    strategies: Set<string>,
    report: (visited: number, fibers: number) => void,
  ): void {
    if (budget <= 0) return;
    let visited = 0;
    let fibers = 0;

    fibers += this.inspectDomNode(shadowRoot, realm, "shadow-root", strategies);
    const walker = shadowRoot.ownerDocument.createTreeWalker(shadowRoot, REACT_DOM_WALKER_MASK);
    let node: Node | null = walker.nextNode();
    while (node && visited < budget) {
      visited += 1;
      fibers += this.inspectDomNode(node, realm, "shadow-root", strategies);
      node = walker.nextNode();
    }

    report(visited, fibers);
  }

  private fiberFromDomExpando(node: Node): ReactFiberLike | null {
    for (const key of safeOwnPropertyNames(node)) {
      if (
        DOM_FIBER_PREFIXES.some((prefix) => key.startsWith(prefix)) ||
        DOM_CONTAINER_PREFIXES.some((prefix) => key.startsWith(prefix))
      ) {
        const value = safeRead(node, key);
        if (isFiberLike(value)) return value;
        const root = candidateRoot(value);
        if (root) return root.current;
      }
    }

    for (const key of LEGACY_ROOT_KEYS) {
      const root = candidateRoot(safeRead(node, key));
      if (root) return root.current;
    }

    return null;
  }

  private findFiber(
    start: ReactFiberLike | null | undefined,
    predicate: (fiber: ReactFiberLike) => boolean,
  ): ReactFiberLike | null {
    if (!start) return null;

    const stack: ReactFiberLike[] = [start];
    const seen = new Set<ReactFiberLike>();
    let visited = 0;

    while (stack.length && visited < MAX_FIBER_SEARCH) {
      const fiber = stack.pop()!;
      if (seen.has(fiber)) continue;
      seen.add(fiber);
      visited += 1;

      if (predicate(fiber)) return fiber;
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }

    return null;
  }

  private recordRenderer(
    id: number,
    renderer: ReactRendererLike,
    hook: ReactDevtoolsHookLike | null,
    realm: Window | null,
    source: ReactCaptureSource,
  ): ReactRendererRecord {
    const timestamp = Date.now();
    const existing = this.renderers.get(id);
    if (existing) {
      existing.renderer = renderer;
      existing.hook = hook ?? existing.hook;
      existing.realm = realm ?? existing.realm;
      existing.lastSeenAt = timestamp;
      return existing;
    }

    const record: ReactRendererRecord = {
      id,
      renderer,
      hook,
      realm,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      source,
    };
    this.renderers.set(id, record);
    this.emit({ type: "renderer", rendererId: id });
    return record;
  }

  private recordCommit(
    rendererId: number,
    root: ReactFiberRootLike,
    realm: Window | null,
    didError: boolean,
  ): void {
    const record = this.recordRoot(root, rendererId, realm, "hook");
    if (!record) return;
    record.commitCount += 1;
    record.didError = didError;
    record.lastSeenAt = Date.now();
    this.emit({ type: "commit", rendererId, root: record });
  }

  private recordRoot(
    root: ReactFiberRootLike | null,
    rendererId: number | null,
    realm: Window | null,
    source: ReactCaptureSource,
  ): ReactRootRecord | null {
    if (!root || !isObjectLike(root) || !isFiberLike(root.current)) return null;

    let id = this.rootIds.get(root as object);
    const timestamp = Date.now();

    if (!id) {
      id = `react-root-${++this.rootSequence}`;
      this.rootIds.set(root as object, id);
      const record: ReactRootRecord = {
        id,
        root,
        rendererId,
        realm,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        commitCount: 0,
        didError: false,
        sources: new Set([source]),
      };
      this.roots.set(id, record);
      return record;
    }

    const existing = this.roots.get(id);
    if (!existing) return null;
    existing.root = root;
    if (rendererId != null) existing.rendererId = rendererId;
    if (realm) existing.realm = realm;
    existing.lastSeenAt = timestamp;
    existing.sources.add(source);
    return existing;
  }

  private emit(event: ReactCaptureEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Observers must never be able to disrupt React commits.
      }
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
}

/** Installed at module evaluation time so userscript/document-start builds can catch React injection. */
export const sharedReactCapture = new ReactCapture();
