export type AnyRecord = Record<string, unknown>;
export type ConsoleLevel = "debug" | "log" | "info" | "warn" | "error" | "table" | "dir" | "result" | "command" | "html";
export type NetworkKind = "fetch" | "xhr" | "websocket" | "resource";
export type NetworkState = "pending" | "complete" | "failed";
export type SourceType = "auto" | "text" | "raw" | "html" | "css" | "javascript" | "json" | "object" | "image" | "iframe";

export interface Position {
  x: number;
  y: number;
}

export interface DevtoolsDefaults {
  transparency?: number;
  displaySize?: number;
  theme?: string;
}

export interface DevtoolsInitOptions {
  container?: HTMLElement;
  tool?: string | readonly string[];
  autoScale?: boolean;
  useShadowDom?: boolean;
  inline?: boolean;
  defaults?: DevtoolsDefaults;
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

export interface NotificationOptions {
  type?: "info" | "success" | "warning" | "error";
  duration?: number;
}

export interface ToolLike {
  readonly name: string;
  readonly title?: string;
  readonly icon?: string;
  active?: boolean;
  init(container: HTMLElement, context: ToolContext): void | Promise<void>;
  show(): void;
  hide(): void;
  destroy(): void;
}

export interface DevtoolsControllerLike {
  show(): DevtoolsControllerLike;
  hide(): DevtoolsControllerLike;
  toggle(): DevtoolsControllerLike;
  add(tool: ToolLike): DevtoolsControllerLike;
  remove(name: string): DevtoolsControllerLike;
  get<T extends ToolLike = ToolLike>(name: string): T | undefined;
  showTool(name: string): DevtoolsControllerLike;
  notify(message: string, options?: NotificationOptions): void;
  getRoot(): HTMLElement;
  isVisible(): boolean;
}

export interface SettingsLike extends ToolLike {
  registerText(text: string): string;
  registerSeparator(): string;
  registerButton(label: string, handler: () => void | Promise<void>): string;
  registerSwitch(config: ConfigLike, key: string, description: string): string;
  registerSelect(config: ConfigLike, key: string, description: string, selections: readonly string[]): string;
  registerRange(config: ConfigLike, key: string, description: string, options?: RangeOptions): string;
  removeSetting(id: string): void;
}

export interface RangeOptions {
  min?: number;
  max?: number;
  step?: number;
}

export interface ConfigLike {
  get<T = unknown>(key: string): T;
  set(key: string, value: unknown): void;
  reset(): void;
  on(event: "change", listener: (key: string, value: unknown, previous: unknown) => void): unknown;
  off(event: "change", listener: (key: string, value: unknown, previous: unknown) => void): unknown;
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
  messages?: Array<{ direction: "sent" | "received"; data: string; timestamp: number }>;
  timing?: Record<string, number>;
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

export interface SourcePayload {
  type: SourceType;
  value: unknown;
  title?: string;
  url?: string;
}

export interface EventListenerRecord {
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
  addedAt: number;
}
