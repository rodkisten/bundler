/**
 * @tool Seiva
 * @global Seiva
 * @package seiva
 * @tags state reactive cells browser
 * @description Tiny reactive state primitives bundled as a standalone browser global.
 */
export type Listener<Value> = (value: Value) => void;
export function cell<Value>(initial: Value) {
  let value = initial;
  const listeners = new Set<Listener<Value>>();
  return {
    get value() { return value; },
    set value(next: Value) { value = next; for (const listener of listeners) listener(value); },
    watch(listener: Listener<Value>) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
export default { cell };
