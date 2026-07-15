/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import { createFabrica, signal } from "@rodkisten/fabrica";
import { setup as setupCipo } from "@rodkisten/cipo";

beforeEach(() => {
  document.body.replaceChildren();
  setupCipo({
    theme: {
      colors: { brand: "#7c3aed" },
      spacing: 4,
    },
  });
});

describe("Fabrica special attributes", () => {
  it("renders registered PascalCase self-closing components with normal html", () => {
    const fabrica = createFabrica({ name: "named-components" });
    fabrica.component("NosUnicos", (_props, ctx) => ctx.html`<strong>nós únicos</strong>`);

    const host = document.createElement("div");
    fabrica.render(host, fabrica.html`<NosUnicos />`);

    expect(host.textContent).toBe("nós únicos");
  });

  it("compiles $css and $style through the Cipó inline runtime", () => {
    const fabrica = createFabrica({ name: "cipo-inline" });
    const root = fabrica.html`<div $css=${{ bg: "$brand", px: 2 }}></div>` as HTMLElement;

    expect(root.style.background).toBe("var(--cipo-colors-brand)");
    expect(root.style.paddingInline).toBe("calc(var(--cipo-spacing, 0.25rem) * 2)");

    const direct = fabrica.html`<div $style=${"color: $brand; mt: 2;"}></div>` as HTMLElement;
    expect(direct.style.color).toBe("var(--cipo-colors-brand)");
    expect(direct.style.marginTop).toBe("calc(var(--cipo-spacing, 0.25rem) * 2)");
  });

  it("maps colon attributes to reactive kebab-case data attributes", async () => {
    const fabrica = createFabrica({ name: "data-attributes" });
    const value = signal("first");
    const root = fabrica.html`
      <div :rod :rodCamelCase=${value} :data=${{ objec: 123, laLaLa: () => 1 }}></div>
    ` as HTMLElement;

    expect(root.getAttribute("data-rod")).toBe("");
    expect(root.getAttribute("data-rod-camel-case")).toBe("first");
    expect(root.getAttribute("data-objec")).toBe("123");
    expect(root.getAttribute("data-la-la-la")).toBe("1");

    value.set("second");
    await Promise.resolve();
    expect(root.getAttribute("data-rod-camel-case")).toBe("second");
  });

  it("uses bracket bindings for style.setProperty", async () => {
    const fabrica = createFabrica({ name: "style-properties" });
    const gap = signal("12px");
    const root = fabrica.html`<div [--panel-gap]=${gap} [backgroundColor]=${"red"}></div>` as HTMLElement;

    expect(root.style.getPropertyValue("--panel-gap")).toBe("12px");
    expect(root.style.backgroundColor).toBe("red");

    gap.set("20px");
    await Promise.resolve();
    expect(root.style.getPropertyValue("--panel-gap")).toBe("20px");
  });

  it("supports valueless, literal, cast and removable data attributes", async () => {
    const fabrica = createFabrica({ name: "data-attribute-semantics" });
    const expanded = signal(true);
    const root = fabrica.html`
      <div
        :consoleLog
        :consoleInputWrap=${123}
        :"console-input-wrap"=${false}
        :nullable=${null}
        :expanded=${expanded}
        :data=${{
          activePanel: "sources",
          ":already-kebab": 42,
          ":queroManterCase": "literal",
          disabled: false,
          missing: undefined,
        }}
      ></div>
    ` as HTMLElement;

    expect(root.getAttribute("data-console-log")).toBe("");
    expect(root.getAttribute("data-console-input-wrap")).toBe("false");
    expect(root.hasAttribute("data-nullable")).toBe(false);
    expect(root.getAttribute("data-expanded")).toBe("true");
    expect(root.getAttribute("data-active-panel")).toBe("sources");
    expect(root.getAttribute("data-already-kebab")).toBe("42");
    expect(root.getAttribute("data-queromantercase")).toBe("literal");
    expect(root.getAttribute("data-disabled")).toBe("false");
    expect(root.hasAttribute("data-missing")).toBe(false);

    expanded.set(false);
    await Promise.resolve();
    expect(root.getAttribute("data-expanded")).toBe("false");

    expanded.set(undefined as unknown as boolean);
    await Promise.resolve();
    expect(root.hasAttribute("data-expanded")).toBe(false);
  });

});
