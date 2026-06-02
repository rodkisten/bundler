import { debugState } from "@/debug";
import { registerCleanup } from "@/dom-cleanup";
import { appendValue } from "@/dom";
import { ref } from "@/directives";
import { batch, computed, effect, memo, signal, untrack } from "@/reactivity";
import type { Cleanup, Component, ComponentContext, RenderValue } from "@/types";

let componentId = 0;

/**
 * Creates a reusable component.
 *
 * @remarks
 * Components are plain functions with a small lifecycle context. They do not
 * create classes, proxies, or hidden instances. The returned fragment owns a
 * start boundary comment where cleanups are registered, so removing the
 * component from DOM disposes local effects and lifecycle callbacks.
 *
 * @param factory - Component factory.
 * @returns Branded component function.
 *
 * @example Local state
 * ```ts
 * const Counter = component(() => {
 *   const count = signal(0);
 *
 *   return html`
 *     <button @click=${() => count.update((value) => value + 1)}>
 *       ${count}
 *     </button>
 *   `;
 * });
 * ```
 *
 * @example Lifecycle
 * ```ts
 * const Clock = component((_props, ctx) => {
 *   const now = ctx.signal(Date.now());
 *   ctx.onMount(() => {
 *     const timer = window.setInterval(() => now.set(Date.now()), 1000);
 *     return () => window.clearInterval(timer);
 *   });
 *   return html`<time>${now}</time>`;
 * });
 * ```
 */
export function component<Props extends object = Record<string, never>>(
  factory: (props: Props, context: ComponentContext) => RenderValue,
): Component<Props> {
  const renderComponent = ((props?: Props): RenderValue => {
    const cleanups: Cleanup[] = [];
    const mountCallbacks: Array<() => void | Cleanup> = [];
    const start = document.createComment("fabrica:component:start");
    const end = document.createComment("fabrica:component:end");
    const fragment = document.createDocumentFragment();

    const context: ComponentContext = {
      signal,
      effect(callback, options) {
        const dispose = effect(callback, options);
        cleanups.push(dispose);
        return dispose;
      },
      computed,
      memo,
      batch,
      untrack,
      onMount(callback) {
        mountCallbacks.push(callback);
      },
      onDispose(callback) {
        cleanups.push(callback);
      },
      ref(callback) {
        return ref((node) => {
          const cleanup = callback(node);

          if (typeof cleanup === "function") {
            cleanups.push(cleanup);
          }
        });
      },
      id: `fabrica-${++componentId}`,
    };

    fragment.append(start);
    appendValue(fragment, factory((props ?? {}) as Props, context));
    fragment.append(end);

    registerCleanup(start, () => {
      for (let index = 0; index < cleanups.length; index += 1) {
        cleanups[index]?.();
      }

      cleanups.length = 0;
    });

    queueMicrotask(() => {
      if (!start.isConnected) {
        return;
      }

      for (let index = 0; index < mountCallbacks.length; index += 1) {
        const cleanup = mountCallbacks[index]?.();

        if (typeof cleanup === "function") {
          cleanups.push(cleanup);
        }
      }

      mountCallbacks.length = 0;
    });

    return fragment;
  }) as Component<Props>;

  Object.defineProperty(renderComponent, "__kind", { value: "component", enumerable: false });
  debugState.components += 1;

  return renderComponent;
}
