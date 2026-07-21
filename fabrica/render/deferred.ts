/**
 * Deferred fragment activation keeps nested component children inert until
 * their owning component actually inserts them into the DOM tree.
 *
 * The registry stores closures instead of renderer-specific descriptors. This
 * deliberately prevents the value renderer from importing the template
 * compiler and keeps the dependency graph acyclic.
 */
const deferredFragmentBindings = new WeakMap<DocumentFragment, () => void>();

/** Registers the one-shot binding activation for a detached fragment. */
export function deferFragmentBindings(
  fragment: DocumentFragment,
  activate: () => void,
): void {
  deferredFragmentBindings.set(fragment, activate);
}

/** Activates and releases bindings registered for a detached fragment. */
export function activateDeferredFragmentBindings(
  fragment: DocumentFragment,
): void {
  const activate = deferredFragmentBindings.get(fragment);
  if (!activate) return;

  deferredFragmentBindings.delete(fragment);
  activate();
}
