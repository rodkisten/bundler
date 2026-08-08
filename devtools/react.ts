import { computed, signal } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";
import { ConfigStore } from "@rodkisten/devtools/core/config";
import { ElementHighlighter } from "@rodkisten/devtools/core/highlighter";
import {
  sharedReactCapture,
  type ReactCaptureEvent,
  type ReactFiberLike,
  type ReactRootRecord,
  type ReactScanReport,
} from "@rodkisten/devtools/core/react-capture";
import { renderValue } from "@rodkisten/devtools/core/serialize";
import { html } from "@rodkisten/devtools/core/runtime";
import { Tool } from "@rodkisten/devtools/tool";
import type { Cleanup, ReactConfig, ToolContext } from "@rodkisten/devtools/types";
import { copyText, isDevtoolsNode } from "@rodkisten/devtools/utils";
import {
  collectContexts,
  collectHooks,
  fiberChildren,
  fiberDisplayName,
  fiberKey,
  fiberKind,
  fiberMetadata,
  fiberPath,
  fiberSearchText,
  isDomHostFiber,
  isHostFiber,
  rootCurrent,
  workTagName,
  type ReactContextModel,
  type ReactHookModel,
} from "@rodkisten/devtools/panels/react.functions";
import {
  ReactPanelContext,
  reactStyleArtifacts,
} from "@rodkisten/devtools/panels/react-components";

export { reactStyleArtifacts };
export { sharedReactCapture } from "@rodkisten/devtools/core/react-capture";

export interface ReactPanelConfig extends ReactConfig {}

export type ReactDetailTab = "props" | "state" | "hooks" | "context" | "fiber";

export interface ReactTreeRowModel {
  readonly id: string;
  readonly fiber: ReactFiberLike;
  readonly rootId: string;
  readonly depth: number;
  readonly name: string;
  readonly kind: string;
  readonly workTag: string;
  readonly key: string | null;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly hasDom: boolean;
  readonly changed: boolean;
}

export interface ReactPanelStats {
  readonly renderers: number;
  readonly roots: number;
  readonly fibers: number;
  readonly visible: number;
  readonly hooks: number;
  readonly scanDuration: number | null;
}

export interface ReactSelectedModel {
  readonly id: string;
  readonly fiber: ReactFiberLike;
  readonly name: string;
  readonly kind: string;
  readonly workTag: string;
  readonly key: string | null;
  readonly path: string;
  readonly hasDom: boolean;
  readonly hooks: readonly ReactHookModel[];
  readonly contexts: readonly ReactContextModel[];
  readonly props: unknown;
  readonly state: unknown;
  readonly instance: unknown;
}

export interface ReactPanelContextValue {
  readonly filterValue: () => string;
  readonly rows: () => readonly ReactTreeRowModel[];
  readonly stats: () => ReactPanelStats;
  readonly selected: () => ReactSelectedModel | null;
  readonly detailOpen: () => boolean;
  readonly activeTab: () => ReactDetailTab;
  readonly picking: () => boolean;
  readonly report: () => ReactScanReport | null;
  readonly diagnostics: () => Record<string, unknown>;
  readonly renderValue: (value: unknown) => Node;
  readonly detailFiberMetadata: () => Record<string, unknown>;
  readonly setFilterFromEvent: (event: Event) => void;
  readonly selectById: (id: string) => void;
  readonly toggleById: (id: string) => void;
  readonly setDetailTab: (tab: ReactDetailTab) => void;
  readonly action: (action: string) => void;
}

type FlattenResult = {
  rows: ReactTreeRowModel[];
  totalFibers: number;
};

/**
 * Mobile-first React Fiber inspector.
 *
 * It is intentionally read-only. React's renderer override APIs vary between
 * versions, so mutating state/props from this panel would be much easier to
 * make subtly unsafe than inspection.
 */
export class ReactPanel extends Tool {
  readonly name = "react";
  readonly title = "react";
  readonly icon = "⚛";

  readonly config = new ConfigStore<ReactPanelConfig>("react", {
    autoRefresh: true,
    searchValues: true,
    hideHostNodes: false,
    maxVisibleFibers: 5_000,
    maxDomScanNodes: 25_000,
    maxGlobalProperties: 4_000,
    commitRefreshDelay: 80,
    highlightDuration: 850,
    fallbackPollMs: 1_500,
  });

  private readonly revision = signal(0, { name: "react.revision" });
  private readonly selectedState = signal<ReactFiberLike | null>(null, { name: "react.selected" });
  private readonly filterState = signal("", { name: "react.filter" });
  private readonly detailOpenState = signal(false, { name: "react.detailOpen" });
  private readonly activeTabState = signal<ReactDetailTab>("props", { name: "react.activeTab" });
  private readonly pickingState = signal(false, { name: "react.picking" });
  private readonly reportState = signal<ReactScanReport | null>(null, { name: "react.report" });

  private readonly expanded = new WeakSet<ReactFiberLike>();
  private readonly fiberIds = new WeakMap<ReactFiberLike, string>();
  private readonly fibersById = new Map<string, WeakRef<ReactFiberLike> | ReactFiberLike>();
  private readonly lastAlternate = new WeakMap<ReactFiberLike, ReactFiberLike | null>();
  private fiberSequence = 0;
  private seededRoots = new WeakSet<object>();

  private highlighter: ElementHighlighter | null = null;
  private cleanup: Cleanup[] = [];
  private pickerCleanup: Cleanup[] = [];
  private refreshTimer = 0;
  private fallbackTimer = 0;
  private mutationTimer = 0;
  private observer: MutationObserver | null = null;

  // Tree flattening and selected-value modelling are the expensive reads in
  // this panel. Broto computed signals make repeated Fábrica bindings reuse the
  // same snapshot until a commit/filter/selection invalidates it.
  private readonly flattenedState = computed(() => this.buildFlatten(), { name: "react.flattened" });
  private readonly selectedModelState = computed(() => this.buildSelectedModel(), { name: "react.selectedModel" });

  private readonly view: ReactPanelContextValue = {
    filterValue: () => this.filterState(),
    rows: () => this.flattenedState().rows,
    stats: () => this.stats(),
    selected: () => this.selectedModelState(),
    detailOpen: () => this.detailOpenState(),
    activeTab: () => this.activeTabState(),
    picking: () => this.pickingState(),
    report: () => this.reportState(),
    diagnostics: () => sharedReactCapture.diagnostics(),
    renderValue: (value) => this.renderInspectorValue(value),
    detailFiberMetadata: () => this.selectedState() ? fiberMetadata(this.selectedState()!) : {},
    setFilterFromEvent: (event) => this.setFilterFromEvent(event),
    selectById: (id) => this.selectById(id),
    toggleById: (id) => this.toggleById(id),
    setDetailTab: (tab) => this.activeTabState.set(tab),
    action: (action) => this.handleAction(action),
  };

  get selectedFiber(): ReactFiberLike | null {
    return this.selectedState.peek();
  }

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    const host = context.shadowRoot?.host instanceof HTMLElement
      ? context.shadowRoot.host
      : context.root.parentElement;
    this.highlighter = new ElementHighlighter(host);

    this.registerSettings(context);
    this.config.on("change", this.onConfigChange);
    this.cleanup.push(sharedReactCapture.subscribe(this.onCaptureEvent));

    const navigation = () => this.scheduleDiscovery(180);
    for (const name of ["pageshow", "popstate", "hashchange"] as const) {
      window.addEventListener(name, navigation, true);
      this.cleanup.push(() => window.removeEventListener(name, navigation, true));
    }

    sharedReactCapture.installEarlyHooks();
  }

  override renderView(): RenderValue {
    return ReactPanelContext.Provider({
      value: this.view,
      children: () => html`<RodReactPanelView />`,
    });
  }

  override show(): void {
    super.show();
    this.scan();
    this.startFallbacks();
  }

  override hide(): void {
    super.hide();
    this.stopPicker(false);
    this.stopFallbacks();
    this.highlighter?.hide();
  }

  override destroy(): void {
    this.stopPicker(false);
    this.stopFallbacks();
    window.clearTimeout(this.refreshTimer);
    window.clearTimeout(this.mutationTimer);
    this.config.off("change", this.onConfigChange);

    for (const dispose of this.cleanup.splice(0)) dispose();

    this.highlighter?.destroy();
    this.highlighter = null;
    this.selectedState.set(null);
    this.fibersById.clear();
    super.destroy();
  }

  /** Runs every hook/DOM/global discovery fallback and refreshes the tree. */
  scan(): ReactScanReport {
    sharedReactCapture.installEarlyHooks();
    const report = sharedReactCapture.scan({
      maxDomNodes: this.config.get("maxDomScanNodes"),
      maxGlobalProperties: this.config.get("maxGlobalProperties"),
      scanFrames: true,
      scanGlobals: true,
      scanShadowRoots: true,
    });
    this.reportState.set(report);
    this.seedRootExpansion();
    this.invalidate();
    return report;
  }

  /** Selects the nearest React Fiber belonging to a DOM node. */
  selectNode(node: Node | null): ReactFiberLike | null {
    const fiber = sharedReactCapture.fiberFromNode(node);
    if (fiber) this.selectFiber(fiber, true);
    return fiber;
  }

  /** Selects a raw Fiber object captured through the hook or a fallback scan. */
  selectFiber(fiber: ReactFiberLike | null, openDetail = true): ReactFiberLike | null {
    if (!fiber) return null;

    this.selectedState.set(fiber);
    this.expandAncestors(fiber);
    this.registerFiber(fiber);
    this.detailOpenState.set(openDetail);
    this.activeTabState.set(this.defaultTabForFiber(fiber));
    this.publishDollarR(fiber);
    this.invalidate();

    const node = sharedReactCapture.nodeFromFiber(fiber);
    if (this.asElement(node)) {
      this.highlighter?.highlight(node as Element, true, this.config.get("highlightDuration"));
    }

    queueMicrotask(() => {
      this.container
        ?.querySelector<HTMLElement>("[data-react-row][data-selected='true']")
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    return fiber;
  }

  /** Finds fibers by component/tag/key and optionally shallow props/state values. */
  find(query: string): ReactFiberLike[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const matches: ReactFiberLike[] = [];
    const max = this.config.get("maxVisibleFibers") * 4;
    let visited = 0;

    for (const root of sharedReactCapture.rootRecords()) {
      const current = rootCurrent(root.root);
      if (!current) continue;
      const stack: ReactFiberLike[] = [current];
      const seen = new Set<ReactFiberLike>();
      while (stack.length && visited < max) {
        const fiber = stack.pop()!;
        if (seen.has(fiber)) continue;
        seen.add(fiber);
        visited += 1;
        if (fiberSearchText(fiber, this.config.get("searchValues")).includes(normalized)) matches.push(fiber);
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
    }

    return matches;
  }

  diagnostics(): Record<string, unknown> {
    return sharedReactCapture.diagnostics();
  }

  private readonly onCaptureEvent = (event: ReactCaptureEvent): void => {
    if (!this.active || !this.config.get("autoRefresh")) return;
    if (event.type === "commit" || event.type === "renderer" || event.type === "hook" || event.type === "unmount") {
      this.scheduleRefresh();
    }
  };

  private readonly onConfigChange = (key: string): void => {
    if (key === "fallbackPollMs" && this.active) this.startFallbacks();
    if (["hideHostNodes", "searchValues", "maxVisibleFibers"].includes(key)) this.invalidate();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerConfigGroup({
      title: "React",
      config: this.config,
      settings: [
        { kind: "switch", key: "autoRefresh", label: "Refresh on React commits" },
        { kind: "switch", key: "searchValues", label: "Search shallow props/state values" },
        { kind: "switch", key: "hideHostNodes", label: "Hide DOM host Fibers" },
        { kind: "number", key: "maxVisibleFibers", label: "Maximum visible Fibers", options: { min: 250, max: 50_000, step: 250 } },
        { kind: "number", key: "maxDomScanNodes", label: "DOM fallback scan budget", options: { min: 500, max: 150_000, step: 500 } },
        { kind: "number", key: "maxGlobalProperties", label: "Global fallback scan budget", options: { min: 100, max: 20_000, step: 100 } },
        { kind: "number", key: "commitRefreshDelay", label: "Commit refresh batching (ms)", options: { min: 0, max: 2_000, step: 10 } },
        { kind: "number", key: "highlightDuration", label: "DOM highlight duration (ms)", options: { min: 0, max: 10_000, step: 50 } },
        { kind: "number", key: "fallbackPollMs", label: "Fallback retry interval (ms)", options: { min: 500, max: 15_000, step: 250 } },
      ],
    });
  }

  private startFallbacks(): void {
    this.stopFallbacks();

    if (document.documentElement && typeof MutationObserver !== "undefined") {
      this.observer = new MutationObserver(() => {
        if (sharedReactCapture.rootRecords().length > 0) return;
        window.clearTimeout(this.mutationTimer);
        this.mutationTimer = window.setTimeout(() => {
          if (this.active && sharedReactCapture.rootRecords().length === 0) this.scan();
        }, 300);
      });
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    const poll = (): void => {
      if (!this.active) return;
      sharedReactCapture.reconcileHooks();
      if (sharedReactCapture.rootRecords().length === 0) this.scan();
      else this.invalidate();
      this.fallbackTimer = window.setTimeout(poll, this.config.get("fallbackPollMs"));
    };
    this.fallbackTimer = window.setTimeout(poll, this.config.get("fallbackPollMs"));
  }

  private stopFallbacks(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.clearTimeout(this.fallbackTimer);
    window.clearTimeout(this.mutationTimer);
    this.fallbackTimer = 0;
    this.mutationTimer = 0;
  }

  private scheduleDiscovery(delay: number): void {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = 0;
      if (this.active) this.scan();
    }, delay);
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = 0;
      this.seedRootExpansion();
      this.invalidate();
    }, this.config.get("commitRefreshDelay"));
  }

  private invalidate(): void {
    this.revision.update((value) => value + 1);
  }

  private seedRootExpansion(): void {
    for (const record of sharedReactCapture.rootRecords()) {
      const rootObject = record.root as object;
      if (this.seededRoots.has(rootObject)) continue;
      this.seededRoots.add(rootObject);
      const current = rootCurrent(record.root);
      if (!current) continue;
      this.expanded.add(current);

      let child = current.child;
      let depth = 0;
      while (child && depth < 3) {
        this.expanded.add(child);
        child = child.child;
        depth += 1;
      }
    }
  }

  private buildFlatten(): FlattenResult {
    this.revision();
    const roots = sharedReactCapture.rootRecords();
    const selected = this.selectedState();
    const filter = this.filterState().trim().toLowerCase();
    const hideHost = this.config.get("hideHostNodes");
    const maxVisible = this.config.get("maxVisibleFibers");
    const rows: ReactTreeRowModel[] = [];
    let totalFibers = 0;

    const filterVisible = filter ? this.filterVisibility(filter, maxVisible * 8) : null;

    const visit = (fiber: ReactFiberLike, depth: number, rootId: string): void => {
      if (rows.length >= maxVisible) return;
      totalFibers += 1;

      const hiddenHost = hideHost && isDomHostFiber(fiber);
      const isVisibleByFilter = !filterVisible || filterVisible.has(fiber);
      const children = fiberChildren(fiber);
      const expanded = filter ? true : this.expanded.has(fiber);

      if (!hiddenHost && isVisibleByFilter) {
        const id = this.registerFiber(fiber);
        const alternate = fiber.alternate ?? null;
        const previousAlternate = this.lastAlternate.get(fiber);
        const changed = previousAlternate !== undefined && previousAlternate !== alternate;
        this.lastAlternate.set(fiber, alternate);

        rows.push({
          id,
          fiber,
          rootId,
          depth,
          name: fiberDisplayName(fiber),
          kind: fiberKind(fiber),
          workTag: workTagName(fiber.tag),
          key: fiberKey(fiber),
          hasChildren: children.length > 0,
          expanded,
          selected: selected === fiber || selected?.alternate === fiber || fiber.alternate === selected,
          hasDom: Boolean(sharedReactCapture.nodeFromFiber(fiber)),
          changed,
        });
      }

      const shouldVisitChildren = hiddenHost || expanded || Boolean(filter);
      if (!shouldVisitChildren) return;

      const nextDepth = hiddenHost ? depth : depth + 1;
      for (const child of children) {
        if (filterVisible && !filterVisible.has(child)) continue;
        visit(child, nextDepth, rootId);
        if (rows.length >= maxVisible) break;
      }
    };

    for (const record of roots) {
      const current = rootCurrent(record.root);
      if (current) visit(current, 0, record.id);
      if (rows.length >= maxVisible) break;
    }

    return { rows, totalFibers };
  }

  private filterVisibility(filter: string, budget: number): Set<ReactFiberLike> {
    const visible = new Set<ReactFiberLike>();
    const includeValues = this.config.get("searchValues");
    let visited = 0;

    for (const record of sharedReactCapture.rootRecords()) {
      const current = rootCurrent(record.root);
      if (!current) continue;
      const stack: ReactFiberLike[] = [current];
      const seen = new Set<ReactFiberLike>();

      while (stack.length && visited < budget) {
        const fiber = stack.pop()!;
        if (seen.has(fiber)) continue;
        seen.add(fiber);
        visited += 1;

        if (fiberSearchText(fiber, includeValues).includes(filter)) {
          let ancestor: ReactFiberLike | null | undefined = fiber;
          let guard = 0;
          while (ancestor && guard < 512) {
            visible.add(ancestor);
            ancestor = ancestor.return;
            guard += 1;
          }
        }

        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
    }

    return visible;
  }

  private stats(): ReactPanelStats {
    const flattened = this.flattenedState();
    const selected = this.selectedModelState();
    const report = this.reportState();
    return {
      renderers: sharedReactCapture.rendererRecords().length,
      roots: sharedReactCapture.rootRecords().length,
      fibers: flattened.totalFibers,
      visible: flattened.rows.length,
      hooks: selected?.hooks.length ?? 0,
      scanDuration: report?.durationMs ?? null,
    };
  }

  private buildSelectedModel(): ReactSelectedModel | null {
    this.revision();
    const fiber = this.selectedState();
    if (!fiber) return null;

    const hooks = collectHooks(fiber);
    const contexts = collectContexts(fiber);
    const instance = fiber.stateNode;
    let state: unknown = fiber.memoizedState;

    if (fiber.tag === 1 || fiber.tag === 17) {
      try {
        const classState = instance && typeof instance === "object"
          ? (instance as Record<string, unknown>).state
          : undefined;
        if (classState !== undefined) state = classState;
      } catch {}
    }

    return {
      id: this.registerFiber(fiber),
      fiber,
      name: fiberDisplayName(fiber),
      kind: fiberKind(fiber),
      workTag: workTagName(fiber.tag),
      key: fiberKey(fiber),
      path: fiberPath(fiber),
      hasDom: Boolean(sharedReactCapture.nodeFromFiber(fiber)),
      hooks,
      contexts,
      props: fiber.memoizedProps,
      state,
      instance,
    };
  }

  private registerFiber(fiber: ReactFiberLike): string {
    let id = this.fiberIds.get(fiber);
    if (id) return id;
    id = `fiber-${++this.fiberSequence}`;
    this.fiberIds.set(fiber, id);
    this.fibersById.set(id, typeof WeakRef === "function" ? new WeakRef(fiber) : fiber);
    return id;
  }

  private fiberById(id: string): ReactFiberLike | null {
    const stored = this.fibersById.get(id);
    if (!stored) return null;
    if (typeof WeakRef !== "undefined" && stored instanceof WeakRef) {
      const fiber = stored.deref();
      if (!fiber) this.fibersById.delete(id);
      return fiber ?? null;
    }
    return stored as ReactFiberLike;
  }

  private selectById(id: string): void {
    this.selectFiber(this.fiberById(id), true);
  }

  private toggleById(id: string): void {
    const fiber = this.fiberById(id);
    if (!fiber) return;
    if (this.expanded.has(fiber)) this.expanded.delete(fiber);
    else this.expanded.add(fiber);
    this.invalidate();
  }

  private setFilterFromEvent(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : "";
    this.filterState.set(value);
  }

  private expandAncestors(fiber: ReactFiberLike): void {
    let current: ReactFiberLike | null | undefined = fiber;
    let guard = 0;
    while (current && guard < 512) {
      this.expanded.add(current);
      current = current.return;
      guard += 1;
    }
  }

  private expandAll(): void {
    const budget = this.config.get("maxVisibleFibers") * 5;
    let visited = 0;
    for (const root of sharedReactCapture.rootRecords()) {
      const current = rootCurrent(root.root);
      if (!current) continue;
      const stack = [current];
      const seen = new Set<ReactFiberLike>();
      while (stack.length && visited < budget) {
        const fiber = stack.pop()!;
        if (seen.has(fiber)) continue;
        seen.add(fiber);
        visited += 1;
        this.expanded.add(fiber);
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
    }
    this.invalidate();
  }

  private collapseAll(): void {
    this.seededRoots = new WeakSet<object>();
    // WeakSet cannot be cleared, so rebuild the expansion state by replacing
    // roots with only their HostRoot fibers through a fresh object trick.
    for (const record of sharedReactCapture.rootRecords()) {
      const current = rootCurrent(record.root);
      if (!current) continue;
      // delete descendants we can currently traverse
      const stack = fiberChildren(current);
      const seen = new Set<ReactFiberLike>();
      while (stack.length) {
        const fiber = stack.pop()!;
        if (seen.has(fiber)) continue;
        seen.add(fiber);
        this.expanded.delete(fiber);
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
      }
      this.expanded.add(current);
      this.seededRoots.add(record.root as object);
    }
    this.invalidate();
  }

  private defaultTabForFiber(fiber: ReactFiberLike): ReactDetailTab {
    if (collectHooks(fiber, 1).length) return "hooks";
    if (fiber.memoizedProps != null) return "props";
    return "fiber";
  }

  private renderInspectorValue(value: unknown): Node {
    return renderValue(value, {
      maxDepth: 7,
      maxEntries: 500,
      onNodeSelect: (node) => {
        const fiber = sharedReactCapture.fiberFromNode(node);
        if (fiber) this.selectFiber(fiber, true);
        else this.context?.devtools.showTool("elements");
      },
    });
  }

  private publishDollarR(fiber: ReactFiberLike): void {
    const hooks = collectHooks(fiber);
    const value = fiber.tag === 1 || fiber.tag === 5 || fiber.tag === 6 || fiber.tag === 26 || fiber.tag === 27
      ? fiber.stateNode
      : {
          fiber,
          props: fiber.memoizedProps,
          state: fiber.memoizedState,
          hooks,
          context: collectContexts(fiber),
        };

    const targets: unknown[] = [globalThis];
    try { targets.push((globalThis as { unsafeWindow?: unknown }).unsafeWindow); } catch {}
    for (const target of targets) {
      if (!target || (typeof target !== "object" && typeof target !== "function")) continue;
      try { Reflect.set(target as object, "$r", value); } catch {}
    }
  }

  private startPicker(): void {
    if (this.pickingState.peek()) return;
    this.pickingState.set(true);
    this.context?.devtools.hide();
    this.context?.notify("React picker: toque em um elemento da página", { duration: 2_800 });

    let candidate: Element | null = null;

    const pointElement = (event: PointerEvent): Element | null => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element || isDevtoolsNode(element, this.context?.shadowRoot?.host as HTMLElement | undefined)) return null;
      return element;
    };

    const preview = (event: PointerEvent): void => {
      const element = pointElement(event);
      if (!element || element === candidate) return;
      candidate = element;
      const fiber = sharedReactCapture.fiberFromNode(element);
      const node = fiber ? sharedReactCapture.nodeFromFiber(fiber) : element;
      if (this.asElement(node)) this.highlighter?.highlight(node as Element, true, 0);
    };

    const pick = (event: PointerEvent): void => {
      const element = pointElement(event) ?? candidate;
      event.preventDefault();
      event.stopPropagation();
      if (element) {
        const fiber = this.selectNode(element);
        if (!fiber) {
          this.context?.notify("Nenhuma Fiber encontrada nesse nó; executando fallback DOM…", { type: "warning" });
          this.scan();
          this.selectNode(element);
        }
      }
      this.stopPicker(true);
    };

    const keydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") this.stopPicker(true);
    };

    document.addEventListener("pointermove", preview, true);
    document.addEventListener("pointerdown", pick, true);
    window.addEventListener("keydown", keydown, true);
    this.pickerCleanup.push(
      () => document.removeEventListener("pointermove", preview, true),
      () => document.removeEventListener("pointerdown", pick, true),
      () => window.removeEventListener("keydown", keydown, true),
    );
  }

  private stopPicker(reopen: boolean): void {
    for (const cleanup of this.pickerCleanup.splice(0)) cleanup();
    if (!this.pickingState.peek()) return;
    this.pickingState.set(false);
    this.highlighter?.hide();
    if (reopen) {
      this.context?.devtools.show();
      this.context?.devtools.showTool("react");
    }
  }

  private asElement(value: unknown): value is Element {
    if (!value || typeof value !== "object") return false;
    try {
      return (value as Node).nodeType === 1 && typeof (value as Element).tagName === "string";
    } catch {
      return false;
    }
  }

  private handleAction(action: string): void {
    switch (action) {
      case "scan":
      case "refresh":
        this.scan();
        break;
      case "picker":
        if (this.pickingState.peek()) this.stopPicker(true);
        else this.startPicker();
        break;
      case "expand-all":
        this.expandAll();
        break;
      case "collapse-all":
        this.collapseAll();
        break;
      case "toggle-host":
        this.config.set("hideHostNodes", !this.config.get("hideHostNodes"));
        break;
      case "close-detail":
        this.detailOpenState.set(false);
        this.highlighter?.hide();
        break;
      case "highlight": {
        const fiber = this.selectedState.peek();
        const node = sharedReactCapture.nodeFromFiber(fiber);
        if (this.asElement(node)) this.highlighter?.highlight(node as Element, true, this.config.get("highlightDuration"));
        break;
      }
      case "elements": {
        const fiber = this.selectedState.peek();
        const node = sharedReactCapture.nodeFromFiber(fiber);
        if (this.asElement(node)) {
          const elements = this.context?.devtools.get("elements") as { selectNode?: (node: Node) => void } | undefined;
          elements?.selectNode?.(node);
        }
        this.context?.devtools.showTool("elements");
        break;
      }
      case "copy-path": {
        const fiber = this.selectedState.peek();
        if (!fiber) break;
        void copyText(fiberPath(fiber)).then((copied) => {
          this.context?.notify(copied ? "Fiber path copiado" : "Não foi possível copiar", { type: copied ? "success" : "error" });
        });
        break;
      }
      case "copy-diagnostics":
        void copyText(JSON.stringify(sharedReactCapture.diagnostics(), null, 2)).then((copied) => {
          this.context?.notify(copied ? "Diagnóstico React copiado" : "Não foi possível copiar", { type: copied ? "success" : "error" });
        });
        break;
    }
  }
}

/** Backward-friendly class name for consumers expecting `DevTools.React`. */
export { ReactPanel as React };
