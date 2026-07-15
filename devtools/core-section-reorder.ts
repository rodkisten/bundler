import type { Cleanup } from "@rodkisten/devtools/types";

const SECTION_SELECTOR = "[data-section]";
const CANDIDATE_SELECTOR = "[data-section], rodnetworksection, rodresourcessection, rodsettingssection, rodelementsdetailsection";
const HANDLE_SELECTOR = "[data-section-drag-handle]";

export function installSectionReordering(root: HTMLElement, storageKey: string): Cleanup {
  let dragging: HTMLElement | null = null;
  let pointerId: number | null = null;
  let startY = 0;
  let moved = false;

  const prepare = (): void => {
    Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR)).forEach((section, index) => {
      section.dataset.section ||= `${section.tagName.toLowerCase()}-${index}`;
      section.removeAttribute("draggable");
      const title = section.querySelector<HTMLElement>(
        ":scope > rodnetworksectiontitle, :scope > rodresourcessectiontitle, :scope > rodsettingssectiontitle, :scope > rodelementssectiontitle, :scope > [data-section-title]",
      );
      if (!title || title.querySelector(HANDLE_SELECTOR)) return;
      const handle = document.createElement("button");
      handle.type = "button";
      handle.dataset.sectionDragHandle = "true";
      handle.setAttribute("aria-label", "Reorder section");
      handle.textContent = "⋮⋮";
      handle.style.cssText = "display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0;border:0;background:transparent;color:inherit;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;opacity:.75";
      title.prepend(handle);
    });
  };

  const persist = (parent: HTMLElement): void => {
    const order = Array.from(parent.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(SECTION_SELECTOR))
      .map((section) => section.dataset.section)
      .filter((value): value is string => Boolean(value));
    try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch {}
  };

  const restore = (): void => {
    prepare();
    let order: string[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
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

  const onPointerDown = (event: PointerEvent): void => {
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>(HANDLE_SELECTOR) : null;
    const section = handle?.closest<HTMLElement>(SECTION_SELECTOR) ?? null;
    if (!handle || !section || !root.contains(section)) return;
    event.preventDefault();
    dragging = section;
    pointerId = event.pointerId;
    startY = event.clientY;
    moved = false;
    handle.setPointerCapture?.(event.pointerId);
    section.dataset.dragging = "true";
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    if (!moved && Math.abs(event.clientY - startY) < 5) return;
    moved = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(SECTION_SELECTOR);
    if (!target || target === dragging || target.parentElement !== dragging.parentElement) return;
    const rect = target.getBoundingClientRect();
    target.parentElement?.insertBefore(dragging, event.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
  };

  const finish = (event: PointerEvent): void => {
    if (!dragging || pointerId !== event.pointerId) return;
    const parent = dragging.parentElement;
    delete dragging.dataset.dragging;
    dragging = null;
    pointerId = null;
    if (moved && parent instanceof HTMLElement) persist(parent);
  };

  root.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  queueMicrotask(restore);
  const observer = new MutationObserver(prepare);
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    root.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
  };
}
