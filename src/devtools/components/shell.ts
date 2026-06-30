import { createFabrica } from "../../fabrica/index";
import { create, qs } from "../core/dom";

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
  try {
    fabrica.render(target, DevtoolsShell({ inline }));
  } catch {
    renderShellNative(target, inline);
  }

  try {
    return collectShellRefs(target);
  } catch {
    renderShellNative(target, inline);
    return collectShellRefs(target);
  }
}

function collectShellRefs(target: HTMLElement | ShadowRoot): ShellRefs {
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

function renderShellNative(target: HTMLElement | ShadowRoot, inline = false): void {
  const root = create("div", { className: `roderuda-container${inline ? " roderuda-inline" : ""}`, attrs: { "data-roderuda-root": "" } });
  const entryButton = create("button", {
    className: "roderuda-entry-btn",
    text: "⌘",
    attrs: { type: "button", "aria-label": "Open developer tools", title: "RodEruda" },
  });
  const devtools = create("section", { className: "roderuda-dev-tools", attrs: { "aria-label": "Developer tools", "aria-hidden": "true" } });
  devtools.append(
    create("div", { className: "roderuda-resizer", attrs: { role: "separator", "aria-orientation": "horizontal", "aria-label": "Resize developer tools" } }),
    create("nav", { className: "roderuda-tabbar", attrs: { "aria-label": "Developer tools panels" } }),
    create("main", { className: "roderuda-tools" }),
    create("div", { className: "roderuda-notifications", attrs: { "aria-live": "polite" } }),
    create("div", { className: "roderuda-modal-root", attrs: { role: "presentation" } }),
  );
  root.append(entryButton, devtools);
  target.replaceChildren(root);
}
