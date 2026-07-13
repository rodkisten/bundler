import type { Cleanup } from "../types";

const SECTION_SELECTOR = "[data-section]";
const CANDIDATE_SELECTOR = "[data-section], rodnetworksection, rodresourcessection, rodsettingssection, rodelementsdetailsection";
const HANDLE_SELECTOR = "[data-section-drag-handle]";
const MOVE_TOLERANCE = 6;

type DragState = {
  section: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
};

export function installSectionReordering(root: HTMLElement, storageKey: string): Cleanup {
  let dragging: DragState | null = null;

  const prepare = (): void => {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR));
    candidates.forEach((section, index) => {
      section.dataset.section ||= `${section.tagName.toLowerCase()}-${index}`;
      section.style.userSelect = "none";
      section.style.webkitUserSelect = "none";
      const title = section.querySelector<HTMLElement>(
        ":scope > rodnetworksectiontitle, :scope > rodresourcessectiontitle, :scope > rodsettingssectiontitle, :scope > rodelementssectiontitle, :scope > [data-section-title]",
      );
      if (title && !title.querySelector(HANDLE_SELECTOR)) {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.dataset.sectionDragHandle = "true";
        handle.setAttribute("aria-label", "Reorder section");
        handle.textContent = "⋮⋮";
        handle.style.cssText = "display:inline-grid;place-items:center;min-width:28px;min-height:28px;padding:0;border:0;background:transparent;color:inherit;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;opacity:.72";
        title.prepend(handle);
      }
    });
  };

  const sectionsOf = (parent: HTMLElement): HTMLElement[] =>
    Array.from(parent.children).filter((child): child is HTMLElement =>
      child instanceof HTMLElement && child.matches(SECTION_SELECTOR),
    );

  const restore = (): void => {
    prepare();
    let order: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(parsed)) order = parsed.filter((value): value is string => typeof value === "string");
    } catch {}
    if (!order.length) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(SECTION_SELECTOR));
    const byName = new Map(sections.map((section) => [section.dataset.section ?? "", section]));
    for (const name of order) {
      const section = byName.get(name);
      if (section?.parentElement) section.parentElement.append(section);
    }
  };

  const persist = (parent: HTMLElement): void => {
    const order = sectionsOf(parent)
      .map((section) => section.dataset.section)
      .filter((value): value is string => Boolean(value));
    try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch {}
  };

  const moveAt = (clientY: number): void => {
    if (!dragging?.active) return;
    const parent = dragging.section.parentElement;
    if (!(parent instanceof HTMLElement)) return;
    const sibling = sectionsOf(parent).find((candidate) => {
      if (candidate === dragging?.section) return false;
      const rect = candidate.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    parent.insertBefore(dragging.section, sibling ?? null);
  };

  const finish = (): void => {
    if (!dragging) return;
    const parent = dragging.section.parentElement;
    delete dragging.section.dataset.dragging;
    dragging.section.releasePointerCapture?.(dragging.pointerId);
    dragging = null;
    if (parent instanceof HTMLElement) persist(parent);
  };

  const onPointerDown = (event: PointerEvent): void => {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>(HANDLE_SELECTOR) : null;
    const section = handle?.closest<HTMLElement>(SECTION_SELECTOR) ?? null;
    if (!handle || !section || !root.contains(section)) return;
    event.preventDefault();
    event.stopPropagation();
    handle.setPointerCapture?.(event.pointerId);
    dragging = { section, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false };
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const distance = Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY);
    if (!dragging.active && distance < MOVE_TOLERANCE) return;
    dragging.active = true;
    dragging.section.dataset.dragging = "true";
    event.preventDefault();
    moveAt(event.clientY);
  };

  const onPointerEnd = (event: PointerEvent): void => {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    event.preventDefault();
    finish();
  };

  root.addEventListener("pointerdown", onPointerDown, true);
  root.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
  root.addEventListener("pointerup", onPointerEnd, true);
  root.addEventListener("pointercancel", onPointerEnd, true);
  queueMicrotask(restore);
  const observer = new MutationObserver(prepare);
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    finish();
    observer.disconnect();
    root.removeEventListener("pointerdown", onPointerDown, true);
    root.removeEventListener("pointermove", onPointerMove, true);
    root.removeEventListener("pointerup", onPointerEnd, true);
    root.removeEventListener("pointercancel", onPointerEnd, true);
  };
}
