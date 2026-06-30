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
    return this;
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this;
  once(event: string, listener: Listener<any[]>): this;
  once(event: PropertyKey, listener: Listener<any[]>): this {
    const wrapped: Listener<any[]> = (...args) => {
      this.off(event as string, wrapped);
      listener(...args);
    };
    return this.on(event as string, wrapped);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this;
  off(event: string, listener: Listener<any[]>): this;
  off(event: PropertyKey, listener: Listener<any[]>): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): this;
  emit(event: string, ...args: unknown[]): this;
  emit(event: PropertyKey, ...args: unknown[]): this {
    const bucket = this.listeners.get(event);
    if (!bucket) return this;
    for (const listener of [...bucket]) {
      try {
        listener(...args);
      } catch (error) {
        queueMicrotask(() => { throw error; });
      }
    }
    return this;
  }

  removeAllListeners(event?: keyof Events | string): this {
    if (event == null) this.listeners.clear();
    else this.listeners.delete(event);
    return this;
  }
}
