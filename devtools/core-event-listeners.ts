import type { EventListenerRecord } from "@rodkisten/devtools/types";

type EventListenerOptionsLike =
  | boolean
  | AddEventListenerOptions
  | EventListenerOptions
  | undefined;

interface InternalEventListenerRecord extends EventListenerRecord {
  capture: boolean;
  wrappedListener?: EventListenerOrEventListenerObject;
  abortCleanup?: () => void;
}

const registry = new WeakMap<
  EventTarget,
  Map<string, InternalEventListenerRecord[]>
>();

let installs = 0;

let originalAdd:
  | typeof EventTarget.prototype.addEventListener
  | null = null;

let originalRemove:
  | typeof EventTarget.prototype.removeEventListener
  | null = null;

/* ******************** */
/* Public API           */
/* ******************** */

export function installEventListenerRegistry(): () => void {
  installs += 1;

  if (installs === 1) {
    patch();
  }

  let active = true;

  return () => {
    if (!active) return;

    active = false;
    installs = Math.max(0, installs - 1);

    if (installs === 0) {
      restore();
    }
  };
}

export function getEventListeners(
  target: EventTarget,
): Readonly<Record<string, readonly EventListenerRecord[]>> {
  const targetMap = registry.get(target);

  if (!targetMap) {
    return {};
  }

  const output: Record<string, readonly EventListenerRecord[]> = {};

  for (const [type, listeners] of targetMap) {
    if (listeners.length === 0) continue;

    output[type] = listeners.map(toPublicRecord);
  }

  return output;
}

/* ******************** */
/* Patch                */
/* ******************** */

function patch(): void {
  if (originalAdd || originalRemove) return;

  originalAdd = EventTarget.prototype.addEventListener;
  originalRemove = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function patchedAddEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (!listener) {
      Reflect.apply(originalAdd!, this, [type, listener, options]);
      return;
    }

    const normalizedType = String(type);
    const normalizedOptions = normalizeOptions(options);

    /*
     * O navegador considera duplicado apenas:
     *
     * - target;
     * - type;
     * - listener;
     * - capture.
     *
     * once, passive e signal não participam da identidade.
     */
    const existing = findListenerRecord(
      this,
      normalizedType,
      listener,
      normalizedOptions.capture,
    );

    if (existing) {
      Reflect.apply(originalAdd!, this, [
        normalizedType,
        existing.wrappedListener ?? listener,
        options,
      ]);

      return;
    }

    if (normalizedOptions.signal?.aborted) {
      /*
       * O navegador não registra um listener quando o signal
       * já se encontra abortado.
       */
      Reflect.apply(originalAdd!, this, [
        normalizedType,
        listener,
        options,
      ]);

      return;
    }

    const record: InternalEventListenerRecord = {
      type: normalizedType,
      listener,
      options,
      capture: normalizedOptions.capture,
      addedAt: Date.now(),
    };

    const effectiveListener = normalizedOptions.once
      ? createOnceListener(this, record)
      : listener;

    record.wrappedListener = effectiveListener;

    addRecord(this, record);

    if (normalizedOptions.signal) {
      record.abortCleanup = registerAbortCleanup(
        this,
        record,
        normalizedOptions.signal,
      );
    }

    try {
      Reflect.apply(originalAdd!, this, [
        normalizedType,
        effectiveListener,
        options,
      ]);
    } catch (error) {
      removeRecord(this, record);
      throw error;
    }
  };

  EventTarget.prototype.removeEventListener =
    function patchedRemoveEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      if (!listener) {
        Reflect.apply(originalRemove!, this, [type, listener, options]);
        return;
      }

      const normalizedType = String(type);
      const capture = getCapture(options);

      const record = findListenerRecord(
        this,
        normalizedType,
        listener,
        capture,
      );

      if (!record) {
        Reflect.apply(originalRemove!, this, [
          normalizedType,
          listener,
          options,
        ]);

        return;
      }

      removeRecord(this, record);

      Reflect.apply(originalRemove!, this, [
        normalizedType,
        record.wrappedListener ?? listener,
        options,
      ]);
    };
}

function restore(): void {
  if (!originalAdd || !originalRemove) return;

  EventTarget.prototype.addEventListener = originalAdd;
  EventTarget.prototype.removeEventListener = originalRemove;

  originalAdd = null;
  originalRemove = null;
}

/* ******************** */
/* Records              */
/* ******************** */

function addRecord(
  target: EventTarget,
  record: InternalEventListenerRecord,
): void {
  let targetMap = registry.get(target);

  if (!targetMap) {
    targetMap = new Map();
    registry.set(target, targetMap);
  }

  let listeners = targetMap.get(record.type);

  if (!listeners) {
    listeners = [];
    targetMap.set(record.type, listeners);
  }

  listeners.push(record);
}

function removeRecord(
  target: EventTarget,
  record: InternalEventListenerRecord,
): void {
  const targetMap = registry.get(target);

  if (!targetMap) return;

  const listeners = targetMap.get(record.type);

  if (!listeners) return;

  const index = listeners.indexOf(record);

  if (index < 0) return;

  listeners.splice(index, 1);

  record.abortCleanup?.();
  record.abortCleanup = undefined;

  if (listeners.length === 0) {
    targetMap.delete(record.type);
  }

  if (targetMap.size === 0) {
    registry.delete(target);
  }
}

function findListenerRecord(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  capture: boolean,
): InternalEventListenerRecord | undefined {
  const listeners = registry.get(target)?.get(type);

  if (!listeners) return undefined;

  return listeners.find(
    (entry) =>
      entry.listener === listener &&
      entry.capture === capture,
  );
}

function toPublicRecord(
  record: InternalEventListenerRecord,
): EventListenerRecord {
  return {
    type: record.type,
    listener: record.listener,
    options: record.options,
    addedAt: record.addedAt,
  };
}

/* ******************** */
/* Once                 */
/* ******************** */

function createOnceListener(
  target: EventTarget,
  record: InternalEventListenerRecord,
): EventListener {
  return function onceEventListener(event: Event): void {
    /*
     * O listener precisa desaparecer do registry antes da execução,
     * seguindo o comportamento de listeners nativos com once.
     */
    removeRecord(target, record);

    invokeListener(
      record.listener,
      target,
      event,
    );
  };
}

function invokeListener(
  listener: EventListenerOrEventListenerObject,
  currentTarget: EventTarget,
  event: Event,
): void {
  if (typeof listener === "function") {
    Reflect.apply(listener, currentTarget, [event]);
    return;
  }

  listener.handleEvent(event);
}

/* ******************** */
/* AbortSignal          */
/* ******************** */

function registerAbortCleanup(
  target: EventTarget,
  record: InternalEventListenerRecord,
  signal: AbortSignal,
): () => void {
  const handleAbort = (): void => {
    const effectiveListener =
      record.wrappedListener ?? record.listener;

    removeRecord(target, record);

    /*
     * Usa a implementação original para não passar novamente
     * pelo patch e para remover precisamente o wrapper de once.
     */
    if (originalRemove) {
      Reflect.apply(originalRemove, target, [
        record.type,
        effectiveListener,
        record.capture,
      ]);
    }
  };

  /*
   * Usa a implementação original para que o próprio listener
   * interno do registry não apareça no registry.
   */
  if (originalAdd) {
    Reflect.apply(originalAdd, signal, [
      "abort",
      handleAbort,
      { once: true },
    ]);
  } else {
    signal.addEventListener("abort", handleAbort, {
      once: true,
    });
  }

  return () => {
    if (originalRemove) {
      Reflect.apply(originalRemove, signal, [
        "abort",
        handleAbort,
        false,
      ]);

      return;
    }

    signal.removeEventListener("abort", handleAbort);
  };
}

/* ******************** */
/* Options              */
/* ******************** */

function normalizeOptions(
  options?: boolean | AddEventListenerOptions,
): {
  capture: boolean;
  once: boolean;
  passive: boolean;
  signal?: AbortSignal;
} {
  if (typeof options === "boolean") {
    return {
      capture: options,
      once: false,
      passive: false,
    };
  }

  return {
    capture: Boolean(options?.capture),
    once: Boolean(options?.once),
    passive: Boolean(options?.passive),
    signal: options?.signal ?? undefined,
  };
}

function getCapture(
  options?: EventListenerOptionsLike,
): boolean {
  return typeof options === "boolean"
    ? options
    : Boolean(options?.capture);
}
