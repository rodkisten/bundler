/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { component, html } from "@rodkisten/devtools/core-runtime";
import { render, setDevtoolsContextOwner } from "@rodkisten/devtools/core-runtime";
import { createDevtoolsContextScope, DevtoolsContext } from "@rodkisten/devtools/core-context";

describe("DevTools shared context", () => {
  afterEach(() => {
    setDevtoolsContextOwner(null);
    document.body.replaceChildren();
  });

  it("shares one context across independent panel render roots", () => {
    const host = document.createElement("div");
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(host, first, second);

    const scope = createDevtoolsContextScope(host, false);
    setDevtoolsContextOwner(scope.owner);

    const Reader = component("DevtoolsContextReader", (_props, ctx) => {
      const state = ctx.requireContext(DevtoolsContext);
      return html`<span>${state.host === host ? "shared" : "missing"}</span>`;
    });

    const disposeFirst = render(first, html`<DevtoolsContextReader />`);
    const disposeSecond = render(second, html`<DevtoolsContextReader />`);

    expect(first.textContent).toBe("shared");
    expect(second.textContent).toBe("shared");

    disposeFirst();
    disposeSecond();
    scope.dispose();
  });
});
