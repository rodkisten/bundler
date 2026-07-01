import { debugError, debugTrace } from "./debug";

export type Listener<Args extends unknown[] = unknown[]> = (...args: Args) => void;

export class Emitter<Events extends { [K in keyof Events]: unknown[] } = Record<string, unknown[]>> {
  private readonly listeners = new Map<PropertyKey, Set<Listener<any[]>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this;
  on(event: string, listener: Listener<any[]>): this;
  on(event: PropertyKey, listener: Listener<any[]>): this {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener);
    debugTrace("emitter", "on", { owner: this.constructor.name, event: String(event), count: bucket.size });
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this;
  once(event: string, listener: Listener<any[]>): this;
  once(event: PropertyKey, listener: Listener<any[]>): this {
    const wrapped: Listener<any[]> = (...args) => {
      this.off(event as string, wrapped);
      listener(...args);
    };
    debugTrace("emitter", "once", { owner: this.constructor.name, event: String(event) });
    return this.on(event as string, wrapped);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this;
  off(event: string, listener: Listener<any[]>): this;
  off(event: PropertyKey, listener: Listener<any[]>): this {
    const bucket = this.listeners.get(event);
    bucket?.delete(listener);
    debugTrace("emitter", "off", { owner: this.constructor.name, event: String(event), count: bucket?.size ?? 0 });
    return this;
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): this;
  emit(event: string, ...args: unknown[]): this;
  emit(event: PropertyKey, ...args: unknown[]): this {
    const bucket = this.listeners.get(event);
    debugTrace("emitter", "emit", { owner: this.constructor.name, event: String(event), listeners: bucket?.size ?? 0, args: args.length });
    if (!bucket) return this;
    for (const listener of [...bucket]) {
      try {
        listener(...args);
      } catch (error) {
        debugError("emitter", "listener failed", { owner: this.constructor.name, event: String(event), error: error instanceof Error ? error.message : String(error) });
        queueMicrotask(() => { throw error; });
      }
    }
    return this;
  }

  removeAllListeners(event?: keyof Events | string): this {
    debugTrace("emitter", "removeAllListeners", { owner: this.constructor.name, event: event == null ? "all" : String(event), count: this.listeners.size });
    if (event == null) this.listeners.clear();
    else this.listeners.delete(event);
    return this;
  }
}
