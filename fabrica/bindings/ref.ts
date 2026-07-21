import { registerCleanup } from "../render/cleanup.js";
import { isRefDirective } from "../guards.js";
import type { RefCallback } from "../types.js";

/** Cleanup returned by a ref binding. */
export type RefBindingCleanup = () => void;

/**
 * Applies a ref and returns a cleanup that fully reverses the binding.
 *
 * This lower-level primitive is used by stateful reconcilers such as spread
 * props, which must dispose an old ref immediately when a new ref replaces it.
 */
export function applyRefBinding(
  element: Element,
  value: unknown,
): RefBindingCleanup | null {
  const resolved = isRefDirective(value) ? value.callback : value;

  if (typeof resolved === "function") {
    const cleanup = (resolved as RefCallback<Element>)(element);
    return typeof cleanup === "function" ? cleanup : null;
  }

  if (!resolved || typeof resolved !== "object" || !("current" in resolved)) {
    return null;
  }

  const objectRef = resolved as { current: Element | null };
  objectRef.current = element;
  return () => {
    if (objectRef.current === element) objectRef.current = null;
  };
}

/**
 * Binds a ref to an element and registers its cleanup with DOM ownership.
 * Every renderer uses this function so callback and object refs share one
 * lifecycle contract.
 */
export function bindRef(element: Element, value: unknown): boolean {
  const cleanup = applyRefBinding(element, value);
  const resolved = isRefDirective(value) ? value.callback : value;
  const recognized =
    typeof resolved === "function" ||
    Boolean(resolved && typeof resolved === "object" && "current" in resolved);

  if (cleanup) registerCleanup(element, cleanup);
  return recognized;
}
