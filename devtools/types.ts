import type { Signal, Store } from "@rodkisten/broto";
import type { RenderValue } from "@rodkisten/fabrica";


/**
 * Shared contracts used by more than one DevTools module.
 * Panel-private models stay beside their implementation.
 */

export type Cleanup = () => void;
export type StringKey<Values extends object> = Extract<keyof Values, string>;
export type KeysOfValue<Values extends object, ExpectedValue> = {
  [Key in StringKey<Values>]-?: Values[Key] extends ExpectedValue ? Key : never;
}[StringKey<Values>];
export type ConsoleLevel =
  | "debug"
  | "trace"
  | "log"
  | "info"
  | "warn"
  | "error"
  | "table"
  | "dir"
  | "result"
  | "command"
  | "html";

export type NetworkKind = "fetch" | "xhr" | "websocket" | "resource";
export type NetworkState = "pending" | "complete" | "failed";
export type WebSocketMessageDirection = "sent" | "received";
export type SourceType =
  | "auto"
  | "text"
  | "raw"
  | "html"
  | "css"
  | "javascript"
  | "json"
  | "object"
  | "image"
  | "iframe";
export type DebugLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "silent";
export type NotificationType = "info" | "success" | "warning" | "error";
export type ConsoleFilter =
  | string
  | RegExp
  | ((record: ConsoleRecord) => boolean)
  | null;

export interface Position {
  x: number;
  y: number;
}

export interface DevtoolsDefaults {
  transparency?: number;
  displaySize?: number;
  theme?: string;
  blur?: number;
}

export interface DevtoolsDebugOptions {
  enabled?: boolean;
  level?: DebugLevel;
  chunkMs?: number;
  maxChunkEntries?: number;
}

export interface ConsoleConfig {
  asyncRender: boolean;
  jsExecution: boolean;
  catchGlobalErr: boolean;
  overrideConsole: boolean;
  displayExtraInfo: boolean;
  displayUnenumerable: boolean;
  displayGetterVal: boolean;
  lazyEvaluation: boolean;
  displayIfErr: boolean;
  maxLogNum: string;
  captureWatchdogMs: number;
  captureBridgePageRealm: boolean;
  capturePatchPrototype: boolean;
  captureLockConsole: boolean;
  historyLimit: number;
  hiddenErrorNoticeDelay: number;
  logRowGap: number;
  logRowPadding: number;
  listBottomPadding: number;
  filterMinWidth: number;
  editorMinHeight: number;
  logPreviewLines: number;
}

export interface ElementsConfig {
  overrideEventTarget: boolean;
  observeElement: boolean;
  showWhitespace: boolean;
  wrapLines: boolean;
  highlightDuration: number;
  persistentHighlight: boolean;
  mutationRenderDelay: number;
  detailRenderDelay: number;
  longPressDuration: number;
  longPressMoveTolerance: number;
  contextMenuMargin: number;
  treeBottomPadding: number;
  rowIndent: number;
  maxVisibleChildren: number;
}

export interface NetworkConfig {
  preserveLog: boolean;
  captureResponseBody: boolean;
  filter: string;
  renderDelay: number;
  bodyPreviewLimit: number;
  listBottomPadding: number;
}

export interface ResourcesConfig {
  hideDevtoolsSetting: boolean;
  observeElement: boolean;
  refreshDelay: number;
  jsonEditorLineNumbers: boolean;
  jsonEditorWrapLines: boolean;
  listBottomPadding: number;
}

export interface SourcesConfig {
  showLineNum: boolean;
  formatCode: boolean;
  indentSize: "2" | "4" | "8";
  wrapLines: boolean;
  maxFormatSourceLength: number;
  requestTimeout: number;
  editorFontSize: number;
  editorTabSize: number;
  listBottomPadding: number;
}

export interface DevToolsConfig {
  transparency: number;
  displaySize: number;
  blur: number;
  theme: string;
  panelOrder: string[];
  disabledPanels: string[];
  tabHeight: number;
  tabMinWidth: number;
  compactTabMinWidth: number;
  tabFontSize: number;
  uiFontSize: number;
  entryButtonSize: number;
  safeAreaMinimum: number;
  dockBottomGap: number;
  resizerHeight: number;
  resizerHandleWidth: number;
  resizerHandleHeight: number;
  notificationDuration: number;
  notificationMaxVisible: number;
  notificationWidth: number;
  notificationTop: number;
  modalMaxWidth: number;
  modalMaxHeight: number;
  animationDuration: number;
  panelPadding: number;
  panelGap: number;
}

export interface DevtoolsInitPanelConfig {
  readonly console?: Partial<ConsoleConfig>;
  readonly elements?: Partial<ElementsConfig>;
  readonly network?: Partial<NetworkConfig>;
  readonly resources?: Partial<ResourcesConfig>;
  readonly sources?: Partial<SourcesConfig>;
  readonly info?: Record<string, unknown>;
  readonly snippets?: Record<string, unknown>;
  readonly settings?: Record<string, unknown>;
  readonly [panel: string]: object | undefined;
}

export interface DevtoolsInitConfig {
  readonly devtools?: Partial<DevToolsConfig>;
  readonly panels?: DevtoolsInitPanelConfig;
}

/*export interface DevtoolsInitOptions {
  container?: HTMLElement;
  tool?: string | readonly string[];
  autoScale?: boolean;
  useShadowDom?: boolean;
  inline?: boolean;
  defaults?: DevtoolsDefaults;
  config?: DevtoolsInitConfig;
  debug?: boolean | DevtoolsDebugOptions;
}
*/

export interface InitialConsoleEntry {
  readonly level?: ConsoleLevel;
  readonly args?: readonly unknown[];
  readonly message?: unknown;
  readonly timestamp?: number;
  readonly stack?: string;
}

export type InitialConsoleBag = readonly (
  | InitialConsoleEntry
  | Error
  | unknown
)[];

export interface DevtoolsInitOptions {
  container?: HTMLElement;
  tool?: string | readonly string[];
  autoScale?: boolean;
  useShadowDom?: boolean;
  inline?: boolean;
  defaults?: DevtoolsDefaults;
  config?: DevtoolsInitConfig;
  debug?: boolean | DevtoolsDebugOptions;
  /** Logs or errors captured before RodEruda finished mounting. */
  initialLogs?: InitialConsoleBag;
  /** Startup-failure alias. Both bags are merged in insertion order. */
  initialErrors?: InitialConsoleBag;
}

export interface NotificationOptions {
  type?: NotificationType;
  duration?: number;
}

export type ConfigChangeListener<Values extends object> = (
  key: StringKey<Values>,
  value: Values[StringKey<Values>],
  previous: Values[StringKey<Values>],
) => void;

export interface ConfigLike<Values extends object = Record<string, unknown>> {
  get<Key extends StringKey<Values>>(key: Key): Values[Key];
  set<Key extends StringKey<Values>>(key: Key, value: Values[Key]): void;
  patch(values: Partial<Values>): void;
  reset(): void;
  snapshot(): Readonly<Values>;
  on(event: "change", listener: ConfigChangeListener<Values>): unknown;
  off(event: "change", listener: ConfigChangeListener<Values>): unknown;
}

export interface ToolContext {
  readonly root: HTMLElement;
  readonly shadowRoot: ShadowRoot | null;
  readonly container: HTMLElement;
  readonly devtools: DevtoolsControllerLike;
  readonly settings: SettingsLike;
  notify(message: string, options?: NotificationOptions): void;
  prompt(message: string, initialValue?: string): Promise<string | null>;
  confirm(message: string): Promise<boolean>;
}

export interface ToolLike {
  readonly name: string;
  readonly title?: string;
  readonly icon?: Node | string;
  active?: boolean;
  init(container: HTMLElement, context: ToolContext): void | Promise<void>;
  show(): void;
  hide(): void;
  destroy(): void;
  renderView?(): RenderValue;
}

export interface DevtoolsControllerLike {
  show(): DevtoolsControllerLike;
  hide(): DevtoolsControllerLike;
  toggle(): DevtoolsControllerLike;
  add(tool: ToolLike): DevtoolsControllerLike;
  remove(name: string): DevtoolsControllerLike;
  get<RequestedTool extends ToolLike = ToolLike>(
    name: string,
  ): RequestedTool | undefined;
  showTool(name: string): DevtoolsControllerLike;
  notify(message: string, options?: NotificationOptions): void;
  getRoot(): HTMLElement;
  isVisible(): boolean;
  beginResize?(event: PointerEvent): void;
  updateResize?(event: PointerEvent): void;
  endResize?(event: PointerEvent): void;
}

export interface RangeOptions {
  min?: number;
  max?: number;
  step?: number;
}


export type ConfigSettingDefinition<Values extends object> =
  | {
      readonly kind: "switch";
      readonly key: KeysOfValue<Values, boolean>;
      readonly label: string;
    }
  | {
      readonly kind: "select";
      readonly key: KeysOfValue<Values, string>;
      readonly label: string;
      readonly selections: readonly string[];
    }
  | {
      readonly kind: "range" | "number";
      readonly key: KeysOfValue<Values, number>;
      readonly label: string;
      readonly options?: RangeOptions;
    };

export interface ConfigSettingsGroup<Values extends object> {
  readonly title: string;
  readonly config: ConfigLike<Values>;
  readonly settings: readonly ConfigSettingDefinition<Values>[];
}

export interface SettingsLike extends ToolLike {
  registerText(text: string): string;
  registerConfigGroup<Values extends object>(
    group: ConfigSettingsGroup<Values>,
  ): readonly string[];
  registerSeparator(): string;
  registerButton(label: string, handler: () => void | Promise<void>): string;
  registerSwitch<
    Values extends object,
    Key extends KeysOfValue<Values, boolean>,
  >(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
  ): string;
  registerSelect<
    Values extends object,
    Key extends KeysOfValue<Values, string>,
  >(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
    selections: readonly string[],
  ): string;
  registerRange<Values extends object, Key extends KeysOfValue<Values, number>>(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
    options?: RangeOptions,
  ): string;
  registerNumber<
    Values extends object,
    Key extends KeysOfValue<Values, number>,
  >(
    config: ConfigLike<Values>,
    key: Key,
    description: string,
    options?: RangeOptions,
  ): string;
  removeSetting(id: string): void;
}

export interface ConsoleRecord {
  id: number;
  level: ConsoleLevel;
  args: unknown[];
  timestamp: number;
  groupDepth: number;
  collapsed?: boolean;
  stack?: string;
  repeat?: number;
}

export interface NetworkHeader {
  name: string;
  value: string;
}

export interface WebSocketMessage {
  direction: WebSocketMessageDirection;
  data: string;
  timestamp: number;
}

export interface NetworkTiming {
  total?: number;
  start?: number;
  end?: number;
  dns?: number;
  connect?: number;
  ssl?: number;
  request?: number;
  response?: number;
  [phase: string]: number | undefined;
}

export interface NetworkRecord {
  id: string;
  kind: NetworkKind;
  method: string;
  url: string;
  requestHeaders: NetworkHeader[];
  requestBody?: string;
  responseHeaders: NetworkHeader[];
  responseBody?: string;
  status?: number;
  statusText?: string;
  type?: string;
  mimeType?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  size?: number;
  state: NetworkState;
  error?: string;
  redirected?: boolean;
  fromCache?: boolean;
  messages?: WebSocketMessage[];
  timing?: NetworkTiming;
}

export interface InfoItem {
  name: string;
  value: unknown | (() => unknown);
}

export interface SnippetItem {
  name: string;
  description: string;
  run: () => unknown | Promise<unknown>;
}

export type SourceValueFactory = () => unknown | Promise<unknown>;
export type SourceValue = unknown | SourceValueFactory;

export interface SourcePayload {
  type: SourceType;
  value: SourceValue;
  title?: string;
  url?: string;
}

export interface EventListenerRecord {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
  addedAt: number;
}

/** Reactive view contracts. */

export interface ConsoleState extends Record<string, unknown> {
  records: ConsoleRecord[];
  filterValue: ConsoleFilter;
  filterText: string;
  history: string[];
  historyIndex: number;
  selectedRecordId: number | null;
  enabledLevels: ConsoleLevel[];
  editorExpanded: boolean;
  inputValue: string;
  jsExecution: boolean;
  displayExtraInfo: boolean;
  displayUnenumerable: boolean;
  lazyEvaluation: boolean;
  lastResult: unknown;
}

export interface ConsoleContextValue {
  readonly state: Store<ConsoleState>;
  setScrollContainer(node: HTMLElement | null): void;
  setInput(node: HTMLTextAreaElement | null): void;
  visibleRecords(): readonly ConsoleRecord[];
  renderRecord(record: ConsoleRecord): RenderValue;
  syncEditorValue(value: string): void;
  clear(): void;
  copy(): void;
  toggleLevel(level: ConsoleLevel): void;
  filter(value: string): void;
  handleInput(event: Event): void;
  handleInputKey(event: KeyboardEvent): void;
  handleInputFocus(): void;
  cancelEditor(): void;
  clearEditor(): void;
  runEditor(): void;
}

export interface ElementsContextValue {
  readonly treeRevision: Signal<number>;
  readonly crumbsRevision: Signal<number>;
  readonly detailRevision: Signal<number>;
  readonly selected: Signal<Element | null>;
  readonly detailsOpen: Signal<boolean>;
  readonly wrapLines: Signal<boolean>;
  setTreeViewport(node: HTMLElement | null): void;
  setCrumbsViewport(node: HTMLElement | null): void;
  onAction(event: Event): void;
  onTreeScroll(): void;
  treeView(): RenderValue;
  crumbsView(): RenderValue;
  detailView(): RenderValue;
  contextMenuView(): RenderValue;
}

export interface InfoModel {
  readonly items: readonly { readonly name: string; readonly value: unknown }[];
}

export interface InfoContextValue {
  model(): InfoModel;
  refresh(): void;
  copyAll(): void;
  copyItem(name: string): void;
  renderValue(value: unknown): RenderValue;
}

export type NetworkDetailTab =
  | "headers"
  | "payload"
  | "response"
  | "timing"
  | "messages";

export interface NetworkContextValue {
  readonly records: Signal<readonly NetworkRecord[]>;
  readonly selectedId: Signal<string | null>;
  readonly detailOpen: Signal<boolean>;
  readonly activeDetailTab: Signal<string>;
  readonly filter: Signal<string>;
  readonly recording: Signal<boolean>;
  captureResponseBody(): boolean;
  bodyPreviewLimit(): number;
  onAction(event: Event): void;
  onFilterInput(event: Event): void;
  openRequest(id: string): void;
  switchDetailTab(tab: string): void;
}

export interface ResourcesContextValue {
  readonly content: Signal<RenderValue>;
  readonly jsonDialog: Signal<RenderValue>;
}

export interface SettingsContextValue {
  readonly entryIds: Signal<readonly string[]>;
  renderEntry(id: string): RenderValue;
}

export interface SnippetsContextValue {
  readonly snippets: Signal<readonly SnippetItem[]>;
  readonly activeNames: Signal<ReadonlySet<string>>;
  add(): void;
  reset(): void;
  run(name: string): void;
  remove(name: string): void;
}

export interface SourcesContextValue {
  readonly title: Signal<string>;
  readonly content: Signal<RenderValue>;
  action(name: string): void;
}

/** Root DevTools context contracts. */

export interface DevtoolsShellRefs {
  root: HTMLElement;
  entryButton: HTMLButtonElement;
  devtools: HTMLElement;
  resizer: HTMLElement;
  tabbar: HTMLElement;
  tools: HTMLElement;
  notifications: HTMLElement;
  modalRoot: HTMLElement;
}

export interface DevtoolsNotificationEntry {
  readonly id: number;
  readonly message: string;
  readonly type: NotificationType;
  readonly active: Signal<boolean>;
  dismiss(): void;
}

export interface DevtoolsToolRegistration {
  readonly name: string;
  readonly title: string;
  readonly icon?: Node | string;
  readonly tool: ToolLike;
  disabled: boolean;
  view(): RenderValue;
  mount(panel: HTMLElement): void;
  activate(): void;
  dragStart(event: DragEvent): void;
  dragOver(event: DragEvent): void;
  drop(event: DragEvent): void;
}

export interface DevtoolsContextValue {
  readonly inline: boolean;
  readonly host: HTMLElement;
  readonly controller: Signal<DevtoolsControllerLike | null>;
  readonly refs: Signal<DevtoolsShellRefs | null>;
  readonly settings: Signal<SettingsLike | null>;
  readonly toolContext: Signal<ToolContext | null>;
  readonly tools: Signal<readonly DevtoolsToolRegistration[]>;
  readonly activePanel: Signal<string>;
  readonly visible: Signal<boolean>;
  readonly notifications: Signal<readonly DevtoolsNotificationEntry[]>;
  readonly modal: Signal<RenderValue | null>;
}

