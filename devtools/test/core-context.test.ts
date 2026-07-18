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

    const Reader = component<{ name: string }>(
      "CoreDevtoolsContextReader",
      (props, ctx) => {
        const state = ctx.requireContext(DevtoolsContext);
        return html`
          <span :reader=${props.name}>
            ${state.host === host ? "shared" : "missing"}
          </span>
        `;
      },
    );

    const dispose = render(root, html`
      <${DevtoolsContext.Provider} props=${{ value: shared }}>
        <section data-panel="first"><${Reader} name="first" /></section>
        <section data-panel="second"><${Reader} name="second" /></section>
      </${DevtoolsContext.Provider}>
    `);

    expect(root.querySelector('[data-reader="first"]')?.textContent)
      .toContain("shared");
    expect(root.querySelector('[data-reader="second"]')?.textContent)
      .toContain("shared");

    dispose();
  });
});
