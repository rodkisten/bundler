/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  component,
  html,
  render,
} from "@rodkisten/devtools/core/runtime";
import {
  createDevtoolsContextValue,
  DevtoolsContext,
} from "@rodkisten/devtools/core/context";

describe("DevTools shared context", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("shares one application context across panel subtrees in one root", () => {
    const host = document.createElement("div");
    const root = document.createElement("div");
    document.body.append(host, root);

    const shared = createDevtoolsContextValue(host, false);

    const Reader = component(
      "CoreDevtoolsContextReader",
      (_props, ctx) => {
        const state = ctx.requireContext(DevtoolsContext);
        return html`
          <span data-context-reader>
            ${state.host === host ? "shared" : "missing"}
          </span>
        `;
      },
    );

    const dispose = render(root, html`
      <${DevtoolsContext.Provider} .value=${shared}>
        <section data-panel="first"><CoreDevtoolsContextReader /></section>
        <section data-panel="second"><CoreDevtoolsContextReader /></section>
      </${DevtoolsContext.Provider}>
    `);

    const readers = root.querySelectorAll('[data-context-reader]');
    expect(readers).toHaveLength(2);
    expect(Array.from(readers, (node) => node.textContent?.trim())).toEqual(["shared", "shared"]);

    dispose();
  });
});
