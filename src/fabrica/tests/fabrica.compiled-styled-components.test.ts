/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFabrica } from "../index";
import { compileFabricaSource } from "../compiler-core";
import { createCompiledTemplate } from "../compiler-runtime";
import type { RuntimeCompiledTemplate } from "../compiler-runtime";
import { createStyled, getCssText, reset, setup } from "../../cipo/src/index";
import { setRuntimeStyleTarget } from "../../cipo/src/injection";

describe("compiled templates with styled Fabrica components", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    host = document.createElement("div");
    document.body.append(host);
    reset();
    setup({
      prefix: "compiled",
      minify: true,
      layers: false,
      theme: { colors: { brand: "#38bdf8", ink: "#020617" } },
    });
    setRuntimeStyleTarget(document);
  });

  it("renders named styled component tags from compiled runtime instructions", () => {
    const fabrica = createFabrica({ name: "compiled-styled", isolated: true });
    const styled = createStyled({ fabrica });
    const onInput = vi.fn();
    let inputRef: HTMLInputElement | null = null;

    styled.input("CompiledField").css`
      color: $brand;
      background: $ink;
    `;

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "CompiledField",
          props: [
            { type: "value", name: ".value", index: 0 },
            { type: "value", name: "@input", index: 1 },
            { type: "value", name: "ref", index: 2 },
            { type: "static", name: "aria-label", value: "Compiled field" },
          ],
          children: [],
        },
      ],
    };

    fabrica.run(() => {
      fabrica.render(host, createCompiledTemplate(
        definition,
        "hello",
        onInput,
        fabrica.ref<HTMLInputElement>((node) => {
          inputRef = node;
        }),
      ));
    });

    const input = host.querySelector("input") as HTMLInputElement | null;
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input).toBe(inputRef);
    expect(input?.value).toBe("hello");
    expect(input?.getAttribute("aria-label")).toBe("Compiled field");
    expect(input?.className).toContain("compiled-");
    expect(input?.hasAttribute(".value")).toBe(false);
    expect(input?.hasAttribute("@input")).toBe(false);

    input?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(getCssText()).toContain(input?.className.split(/\s+/)[0] ?? "missing-class");
  });
  it("emits runtime instructions for named styled component templates", () => {
    const result = compileFabricaSource(
      'const view = html`<CompiledField .value=${value} @input=${onInput}>${label}</CompiledField>`;',
      { filename: "compiled-field.ts", importPath: "../compiler-runtime" },
    );

    expect(result.changed).toBe(true);
    expect(result.code).toContain("createCompiledTemplate");
    expect(result.code).toContain('"tag":"CompiledField"');
    expect(result.code).toContain('"name":".value"');
    expect(result.code).toContain('"name":"@input"');
    expect(result.code).not.toContain("html`");
  });

  it("registers Rod-prefixed styled components with a short alias for imported component tags", () => {
    const fabrica = createFabrica({ name: "compiled-styled-alias", isolated: true });
    const styled = createStyled({ fabrica });

    styled.section("RodSettingsSection").css`
      color: $brand;
    `;

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "SettingsSection",
          props: [{ type: "static", name: "data-probe", value: "alias" }],
          children: [{ type: "text", value: "Settings" }],
        },
      ],
    };

    fabrica.run(() => {
      fabrica.render(host, createCompiledTemplate(definition));
    });

    const section = host.querySelector("section[data-probe='alias']");
    expect(section).toBeInstanceOf(HTMLElement);
    expect(section?.textContent).toBe("Settings");
    expect(section?.className).toContain("compiled-");
    expect(host.querySelector("fabrica-component-error")).toBeNull();
  });


  it("decodes HTML entities exactly once in compiled text and static attributes", () => {
    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "div",
          props: [{ type: "static", name: "title", value: "A &gt; B &amp;&amp; C" }],
          children: [{ type: "text", value: "&lt;node&gt; &amp; &amp;gt;" }],
        },
      ],
    };

    const fabrica = createFabrica({ name: "compiled-entities", isolated: true });
    fabrica.run(() => fabrica.render(host, createCompiledTemplate(definition)));

    const div = host.querySelector("div");
    expect(div?.getAttribute("title")).toBe("A > B && C");
    expect(div?.textContent).toBe("<node> & &gt;");
  });

  it("keeps DOM nodes as component children instead of stringifying them", () => {
    const fabrica = createFabrica({ name: "compiled-node-child", isolated: true });
    const styled = createStyled({ fabrica });
    styled.span("NodeChildHost").css`color: $brand;`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-icon", "probe");

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "NodeChildHost",
          props: [],
          children: [{ type: "value", index: 0 }],
        },
      ],
    };

    fabrica.run(() => fabrica.render(host, createCompiledTemplate(definition, svg)));

    expect(host.querySelector("svg[data-icon='probe']")).toBe(svg);
    expect(host.textContent).not.toContain("[object Object]");
  });

});
