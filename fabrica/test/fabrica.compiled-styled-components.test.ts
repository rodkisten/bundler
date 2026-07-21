/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFabrica } from "@rodkisten/fabrica";
import { compileFabricaSource } from "@rodkisten/fabrica/compiler";
import { createCompiledTemplate } from "@rodkisten/fabrica/compiler-runtime";
import type { RuntimeCompiledTemplate } from "@rodkisten/fabrica/compiler-runtime";
import { createStyled, getCssText, reset, setup } from "@rodkisten/cipo";
import { setRuntimeStyleTarget } from "@rodkisten/cipo";

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
  it("uses the html tag owning runtime when a compiled template is created before render", () => {
    const fabrica = createFabrica({ name: "compiled-bound-runtime", isolated: true });
    const styled = createStyled({ fabrica });

    styled.textarea("BoundRuntimeField").css`
      resize: vertical;
    `;

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "BoundRuntimeField",
          props: [{ type: "static", name: "aria-label", value: "Bound field" }],
          children: [],
        },
      ],
    };

    // Compiled template expressions execute before render() enters the factory runtime.
    const template = createCompiledTemplate(fabrica.html, definition);
    fabrica.render(host, template);

    expect(host.querySelector("textarea")?.getAttribute("aria-label")).toBe("Bound field");
    expect(host.querySelector("boundruntimefield")).toBeNull();
  });

  it("re-renders compiled styled component tags when reactive props change", () => {
    const fabrica = createFabrica({ name: "compiled-styled-reactive", isolated: true });
    const styled = createStyled({ fabrica });
    const active = fabrica.signal(false);

    styled.div("ReactiveStyledBox").css`
      display: block;
    `;

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "ReactiveStyledBox",
          props: [{ type: "value", name: ":active", index: 0 }],
          children: [],
        },
      ],
    };

    fabrica.run(() =>
      fabrica.render(host, createCompiledTemplate(definition, active)),
    );

    expect(host.querySelector("div")?.dataset.active).toBe("false");

    active.set(true);

    expect(host.querySelector("div")?.dataset.active).toBe("true");
  });

  it("binds reactive function props forwarded through compiled styled payloads", () => {
    const fabrica = createFabrica({ name: "compiled-styled-payload-props", isolated: true });
    const styled = createStyled({ fabrica });
    const active = fabrica.signal(false);

    styled.button("ReactivePayloadButton").css`
      display: block;
    `;

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "ReactivePayloadButton",
          props: [
            { type: "value", name: ":toolTab", index: 0 },
            { type: "value", name: "aria-selected", index: 1 },
            { type: "value", name: "hidden", index: 2 },
          ],
          children: [],
        },
      ],
    };

    fabrica.run(() =>
      fabrica.render(
        host,
        createCompiledTemplate(
          definition,
          () => active() ? "console" : "elements",
          () => String(active()),
          () => !active(),
        ),
      ),
    );

    const button = host.querySelector("button") as HTMLButtonElement;
    expect(button.dataset.toolTab).toBe("elements");
    expect(button.getAttribute("aria-selected")).toBe("false");
    expect(button.hidden).toBe(true);

    active.set(true);

    expect(host.querySelector("button")).toBe(button);
    expect(button.dataset.toolTab).toBe("console");
    expect(button.getAttribute("aria-selected")).toBe("true");
    expect(button.hidden).toBe(false);
  });

  it("assigns arbitrary dot bindings as properties without stringifying objects", () => {
    const payload = { id: 42, nested: { active: true } };
    const callback = vi.fn();
    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement("strong"));

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "div",
          props: [
            { type: "value", name: ".payload", index: 0 },
            { type: "value", name: ".callback", index: 1 },
            { type: "value", name: ".content", index: 2 },
          ],
          children: [],
        },
      ],
    };

    const fabrica = createFabrica({ name: "compiled-generic-properties", isolated: true });
    fabrica.run(() => fabrica.render(host, createCompiledTemplate(definition, payload, callback, fragment)));

    const element = host.querySelector("div") as HTMLDivElement & {
      payload?: unknown;
      callback?: unknown;
      content?: unknown;
    };

    expect(element.payload).toBe(payload);
    expect(element.callback).toBe(callback);
    expect(element.content).toBe(fragment);
    expect(element.hasAttribute("payload")).toBe(false);
    expect(element.hasAttribute("callback")).toBe(false);
    expect(element.hasAttribute("content")).toBe(false);
    expect(host.textContent).not.toContain("[object Object]");
  });

  it("preserves arbitrary dot-bound component props in compiled named tags", () => {
    const fabrica = createFabrica({ name: "compiled-component-properties", isolated: true });
    const received = vi.fn();
    const payload = { nodeType: "model", id: 7 };

    fabrica.component<{ payload: object; onSelect: () => void }>(
      "GenericPropertyProbe",
      (props) => {
        received(props);
        return fabrica.html`<output>${props.payload === payload ? "same" : "different"}</output>`;
      },
    );

    const onSelect = vi.fn();
    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "GenericPropertyProbe",
          props: [
            { type: "value", name: ".payload", index: 0 },
            { type: "value", name: ".onSelect", index: 1 },
          ],
          children: [],
        },
      ],
    };

    fabrica.run(() => fabrica.render(host, createCompiledTemplate(definition, payload, onSelect)));

    const props = received.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.payload).toBe(payload);
    expect(props.onSelect).toBe(onSelect);
    expect(host.querySelector("output")?.textContent).toBe("same");
    expect(host.textContent).not.toContain("[object Object]");
  });

  it("emits runtime instructions for named styled component templates", () => {
    const result = compileFabricaSource(
      'const view = html`<CompiledField .value=${value} @input=${onInput}>${label}</CompiledField>`;',
      { filename: "compiled-field.ts", importPath: "../compiler-runtime" },
    );

    expect(result.changed).toBe(true);
    expect(result.code).toContain("createCompiledTemplate");
    // Production compiler output uses compact tuple opcodes instead of the
    // verbose object AST. Keep the assertion tied to the stable wire format.
    expect(result.code).toContain('[0,"CompiledField"');
    expect(result.code).toContain('[1,".value",0]');
    expect(result.code).toContain('[1,"@input",1]');
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

  it("decodes entities inside compiled styled component children", () => {
    const fabrica = createFabrica({ name: "compiled-styled-entities", isolated: true });
    const styled = createStyled({ fabrica });
    styled.span("EntityLabel").css`color: $brand;`;

    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "EntityLabel",
          props: [],
          children: [{ type: "text", value: "&lt;html&gt; &amp; &amp;gt;" }],
        },
      ],
    };

    fabrica.run(() => fabrica.render(host, createCompiledTemplate(definition)));

    expect(host.textContent).toBe("<html> & &gt;");
    expect(host.textContent).not.toContain("&lt;");
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

  it("keeps nested Fábrica components and directives inside compiled styled elements", () => {
    const fabrica = createFabrica({ name: "compiled-styled-renderables", isolated: true });
    const styled = createStyled({ fabrica });

    styled.div("StyledRenderableHost").css`color: $brand;`;
    fabrica.component<{ label: string }>("NestedRenderable", (props) => (
      fabrica.html`<strong data-nested>${props.label}</strong>`
    ));

    const items = fabrica.signal(["one", "two"]);
    const definition: RuntimeCompiledTemplate = {
      nodes: [
        {
          type: "element",
          tag: "StyledRenderableHost",
          props: [],
          children: [
            { type: "element", tag: "NestedRenderable", props: [{ type: "static", name: "label", value: "ready" }], children: [] },
            { type: "value", index: 0 },
          ],
        },
      ],
    };

    const repeated = fabrica.repeat(
      items,
      (item) => item,
      ({ item }) => fabrica.html`<span data-repeat>${item()}</span>`,
    );

    fabrica.run(() => fabrica.render(host, createCompiledTemplate(definition, repeated)));

    expect(host.querySelector("[data-nested]")?.textContent).toBe("ready");
    expect(Array.from(host.querySelectorAll("[data-repeat]")).map((node) => node.textContent)).toEqual(["one", "two"]);
    expect(host.textContent).not.toContain("[object Object]");
  });

});
