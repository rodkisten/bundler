/** Runtime debug counters. */
export type DebugSnapshot = {
  enabled: boolean;
  templates: number;
  parts: number;
  effects: number;
  flushes: number;
  updates: number;
  components: number;
  delegatedEvents: number;
  delegatedBindings: number;
  directEventBindings: number;
  delegatedDispatches: number;
  eventHandlerCalls: number;
  reconciliations: number;
  virtualWindows: number;
};

/** Event transport used by the runtime for a debug record. */
export type DebugEventMode = "delegated" | "direct";

/** Lightweight debug event record that never retains detached DOM nodes. */
export type DebugEventRecord = {
  readonly sequence: number;
  readonly timestamp: number;
  readonly kind:
    | "event-binding"
    | "event-dispatch"
    | "event-handler";
  readonly eventName: string;
  readonly mode: DebugEventMode;
  readonly target?: string;
  readonly currentTarget?: string;
};

/** Runtime debug records currently emitted by Fábrica. */
export type DebugRecord = DebugEventRecord;

/** Subscriber invoked synchronously when debug mode emits a record. */
export type DebugListener = (record: DebugRecord) => void;
