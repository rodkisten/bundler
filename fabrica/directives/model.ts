import { effect } from "@rodkisten/broto/reactivity";
import { bindEvent } from "../events.js";
import { registerCleanup } from "../render/cleanup.js";
import type { BindDirective, RenderValue } from "../types.js";

export function bindModelPart(element: Element, rawName: string, directive: BindDirective): void {
  const propertyName = rawName.startsWith('.') || rawName.startsWith('?') || rawName.startsWith(':') ? rawName.slice(1) : rawName;
  const eventName = directive.event || (propertyName === 'checked' ? 'change' : 'input');
  const readElement = directive.from || ((node: Element) => {
    const target = node as HTMLInputElement & { [key: string]: unknown };
    return (propertyName === 'checked' ? Boolean(target.checked) : target[propertyName]) as never;
  });
  const writeElement = directive.to || ((value: unknown) => value);

  const update = () => {
    const next = writeElement(directive.signal());
    const target = element as HTMLElement & { [key: string]: unknown };
    if (!Object.is(target[propertyName], next)) target[propertyName] = next;
  };

  const dispose = effect(update, { name: `fabrica.bind.${propertyName}` });
  const listener = () => directive.signal.set(readElement(element));

  // Two-way bindings are element-local by definition. Keep their listener
  // direct so detached templates and synthetic non-bubbling input/change
  // events update the model without depending on delegated-root propagation.
  const disposeEvent = bindEvent(
    element,
    `${eventName}.direct`,
    listener as unknown as RenderValue,
    false,
  );
  registerCleanup(element, () => {
    dispose();
    disposeEvent();
  });
}
