import { createFabrica } from "../../fabrica/index";
import { qs } from "../core/dom";

const fabrica = createFabrica({ name: "roderuda-devtools", isolated: true });

const DevtoolsShell = fabrica.component("DevtoolsShell", ({ inline = false }: { inline?: boolean }) => fabrica.html`
  <div class=${`roderuda-container${inline ? " roderuda-inline" : ""}`} data-roderuda-root>
    <button class="roderuda-entry-btn" type="button" aria-label="Open developer tools" title="RodEruda">⌘</button>
    <section class="roderuda-dev-tools" aria-label="Developer tools" aria-hidden="true">
      <div class="roderuda-resizer" role="separator" aria-orientation="horizontal" aria-label="Resize developer tools"></div>
      <nav class="roderuda-tabbar" aria-label="Developer tools panels"></nav>
      <main class="roderuda-tools"></main>
      <div class="roderuda-notifications" aria-live="polite"></div>
      <div class="roderuda-modal-root" role="presentation"></div>
    </section>
  </div>
`);

export interface ShellRefs {
  root: HTMLElement;
  entryButton: HTMLButtonElement;
  devtools: HTMLElement;
  resizer: HTMLElement;
  tabbar: HTMLElement;
  tools: HTMLElement;
  notifications: HTMLElement;
  modalRoot: HTMLElement;
}

export function renderShell(target: HTMLElement | ShadowRoot, inline = false): ShellRefs {
  fabrica.render(target, DevtoolsShell({ inline }));
  const root = qs<HTMLElement>(target, "[data-roderuda-root]");
  return {
    root,
    entryButton: qs<HTMLButtonElement>(root, ".roderuda-entry-btn"),
    devtools: qs<HTMLElement>(root, ".roderuda-dev-tools"),
    resizer: qs<HTMLElement>(root, ".roderuda-resizer"),
    tabbar: qs<HTMLElement>(root, ".roderuda-tabbar"),
    tools: qs<HTMLElement>(root, ".roderuda-tools"),
    notifications: qs<HTMLElement>(root, ".roderuda-notifications"),
    modalRoot: qs<HTMLElement>(root, ".roderuda-modal-root"),
  };
}
