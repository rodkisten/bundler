/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { component, html, render, signal } from "@rodkisten/devtools/core/runtime";
import { createRequiredFabricaContext } from "@rodkisten/fabrica";
import { createDevtoolsContextValue, DevtoolsContext } from "@rodkisten/devtools/core/context";

describe("DevTools shared context", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("inherits one application context through the single Fábrica root", () => {
    const host = document.createElement("div");
    const root = document.createElement("div");
    document.body.append(host, root);

    const shared = createDevtoolsContextValue(host, false);

    const Reader = component("DevtoolsContextReader", (_props, ctx) => {
      const state = ctx.requireContext(DevtoolsContext);
      return html`<span data-context-reader>${state.host === host ? "shared" : "missing"}</span>`;
    });

    const dispose = render(root, html`
      <${DevtoolsContext.Provider} .value=${shared}>
        <section>
          <DevtoolsContextReader />
          <div><DevtoolsContextReader /></div>
        </section>
      </${DevtoolsContext.Provider}>
    `);

    const readers = root.querySelectorAll('[data-context-reader]');
    expect(readers).toHaveLength(2);
    expect(Array.from(readers, (node) => node.textContent)).toEqual(["shared", "shared"]);

    dispose();
  });

  it("inherits global and panel contexts while updating signal consumers in place", () => {
    const host = document.createElement("div");
    const root = document.createElement("div");
    document.body.append(host, root);

    const shared = createDevtoolsContextValue(host, false);
    const count = signal(0, { name: "test.panel.count" });
    const PanelContext = createRequiredFabricaContext<{ readonly count: typeof count }>("TestPanelContext");

    const PanelReader = component("DevtoolsPanelContextReader", (_props, ctx) => {
      const app = ctx.requireContext(DevtoolsContext);
      const panel = ctx.requireContext(PanelContext);
      return html`<output>${() => `${app.host === host ? "shared" : "missing"}:${panel.count()}`}</output>`;
    });

    const panelState = { count };
    const dispose = render(root, html`
      <${DevtoolsContext.Provider} .value=${shared}>
        <${PanelContext.Provider} .value=${panelState}>
          <DevtoolsPanelContextReader />
        </${PanelContext.Provider}>
      </${DevtoolsContext.Provider}>
    `);

    const output = root.querySelector("output");
    expect(output?.textContent).toBe("shared:0");

    count.set(1);
    expect(output?.textContent).toBe("shared:1");

    dispose();
  });

});
