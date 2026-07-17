// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { flushSync, store } from "@rodkisten/broto";
import { html, render } from "@rodkisten/fabrica";

describe("Fabrica store view bindings", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders Broto store signal leaves directly", () => {
    const state = store({ user: { name: "Rod" } });
    const host = document.createElement("div");
    const dispose = render(host, html`<span>${state.user.name}</span>`);

    expect(host.textContent).toBe("Rod");

    state.user.name.set("Fabrica");
    flushSync();

    expect(host.textContent).toBe("Fabrica");
    dispose();
  });

  it("renders Broto store view paths as synchronous live bindings", () => {
    const state = store({ user: { name: "Rod" } });
    const host = document.createElement("div");
    const dispose = render(host, html`<span>${state.view.user.name}</span>`);

    expect(host.textContent).toBe("Rod");

    state.setPath(["user", "name"], "Cipó");
    flushSync();

    expect(host.textContent).toBe("Cipó");
    dispose();
  });
});
