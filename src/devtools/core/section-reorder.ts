import type { Cleanup } from "../types";

const SECTION_SELECTOR = "[data-section][draggable='true']";
const CANDIDATE_SELECTOR = "[data-section], rodnetworksection, rodresourcessection, rodsettingssection, rodelementsdetailsection";

export function installSectionReordering(root: HTMLElement, storageKey: string): Cleanup {
  let dragging: HTMLElement | null = null;

  const prepare = (): void => {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR));
    candidates.forEach((section, index) => {
      section.dataset.section ||= `${section.tagName.toLowerCase()}-${index}`;
      section.draggable = true;
      const title = section.querySelector<HTMLElement>(
        ":scope > rodnetworksectiontitle, :scope > rodresourcessectiontitle, :scope > rodsettingssectiontitle, :scope > rodelementssectiontitle, :scope > [data-section-title]",
      );
      if (title && !title.querySelector("[data-section-drag-handle]")) {
        const handle = document.createElement("span");
        handle.dataset.sectionDragHandle = "true";
        handle.setAttribute("aria-label", "Drag section");
        handle.textContent = "⋮⋮";
        handle.style.cssText = "display:inline-grid;place-items:center;min-width:20px;cursor:grab;touch-action:none;opacity:.7";
        title.prepend(handle);
      }
    });
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

  const persist = (parent: HTMLElement): void => {
    const order = Array.from(parent.querySelectorAll<HTMLElement>(`:scope > ${SECTION_SELECTOR}`))
      .map((section) => section.dataset.section)
      .filter((value): value is string => Boolean(value));
    try { localStorage.setItem(storageKey, JSON.stringify(order)); } catch {}
  };

  const onDragStart = (event: DragEvent): void => {
    const section = event.target instanceof Element
      ? event.target.closest<HTMLElement>(SECTION_SELECTOR)
      : null;
    const handle = event.target instanceof Element
      ? event.target.closest("[data-section-drag-handle]")
      : null;
    if (!section || !handle || !root.contains(section)) {
      event.preventDefault();
      return;
    }
    dragging = section;
    section.dataset.dragging = "true";
    event.dataTransfer?.setData("text/plain", section.dataset.section ?? "section");
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (event: DragEvent): void => {
    if (!dragging) return;
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>(SECTION_SELECTOR)
      : null;
    if (!target || target === dragging || target.parentElement !== dragging.parentElement) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const before = event.clientY < rect.top + rect.height / 2;
    target.parentElement?.insertBefore(dragging, before ? target : target.nextSibling);
  };

  const finish = (): void => {
    if (!dragging) return;
    const parent = dragging.parentElement;
    delete dragging.dataset.dragging;
    dragging = null;
    if (parent instanceof HTMLElement) persist(parent);
  };

  root.addEventListener("dragstart", onDragStart);
  root.addEventListener("dragover", onDragOver);
  root.addEventListener("drop", finish);
  root.addEventListener("dragend", finish);
  queueMicrotask(restore);
  const observer = new MutationObserver(() => prepare());
  observer.observe(root, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    root.removeEventListener("dragstart", onDragStart);
    root.removeEventListener("dragover", onDragOver);
    root.removeEventListener("drop", finish);
    root.removeEventListener("dragend", finish);
  };
}
