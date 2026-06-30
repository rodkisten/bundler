import type { EventListenerRecord } from "../types";

const registry = new WeakMap<EventTarget, Map<string, EventListenerRecord[]>>();
let installs = 0;
let originalAdd: typeof EventTarget.prototype.addEventListener | null = null;
let originalRemove: typeof EventTarget.prototype.removeEventListener | null = null;

export function installEventListenerRegistry(): () => void {
  installs += 1;
  if (installs === 1) patch();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    installs = Math.max(0, installs - 1);
    if (installs === 0) restore();
  };
}

export function getEventListeners(target: EventTarget): Readonly<Record<string, readonly EventListenerRecord[]>> {
  const targetMap = registry.get(target);
  if (!targetMap) return {};
  const output: Record<string, readonly EventListenerRecord[]> = {};
  for (const [type, listeners] of targetMap) output[type] = [...listeners];
  return output;
}

function patch(): void {
  if (originalAdd) return;
  originalAdd = EventTarget.prototype.addEventListener;
  originalRemove = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function patchedAdd(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener) {
      let targetMap = registry.get(this);
      if (!targetMap) {
        targetMap = new Map();
        registry.set(this, targetMap);
      }
      let listeners = targetMap.get(type);
      if (!listeners) {
        listeners = [];
        targetMap.set(type, listeners);
      }
      const exists = listeners.some((entry) => entry.listener === listener && sameCapture(entry.options, options));
      if (!exists) listeners.push({ type, listener, options, addedAt: Date.now() });
    }
    originalAdd!.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function patchedRemove(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener) {
      const listeners = registry.get(this)?.get(type);
      if (listeners) {
        const index = listeners.findIndex((entry) => entry.listener === listener && sameCapture(entry.options, options));
        if (index >= 0) listeners.splice(index, 1);
      }
    }
    originalRemove!.call(this, type, listener, options);
  };
}

function restore(): void {
  if (!originalAdd || !originalRemove) return;
  EventTarget.prototype.addEventListener = originalAdd;
  EventTarget.prototype.removeEventListener = originalRemove;
  originalAdd = null;
  originalRemove = null;
}

function sameCapture(
  left?: boolean | AddEventListenerOptions,
  right?: boolean | AddEventListenerOptions | EventListenerOptions,
): boolean {
  const leftCapture = typeof left === "boolean" ? left : Boolean(left?.capture);
  const rightCapture = typeof right === "boolean" ? right : Boolean(right?.capture);
  return leftCapture === rightCapture;
}
