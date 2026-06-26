/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { buildTemplateSource, compileParts } from "../template";
import type { RenderValue } from "../types";

function source(strings: TemplateStringsArray, ...values: RenderValue[]): string {
  return buildTemplateSource(strings, values);
}

function compile(strings: TemplateStringsArray, ...values: RenderValue[]) {
  const template = document.createElement("template");
  template.innerHTML = buildTemplateSource(strings, values);
  return compileParts(template.content);
}

describe("Fabrica template attribute compiler", () => {
  it("keeps every compound attribute interpolation inside the attribute", () => {
    const output = source`<button class="${"a"} ${"b"}" title="x-${"y"}"></button>`;

    expect(output).not.toContain("<!--fabrica:text:");
    expect(output.match(/__fabrica_attr_\d+__/g)).toHaveLength(3);
  });

  it("compiles compound attribute indexes and static segments", () => {
    const parts = compile`<button class="${"a"} ${"b"}" title="x-${"y"}"></button>`;
    const attributes = parts.filter((part) => part.type === "attribute");

    expect(attributes).toHaveLength(2);
    expect(attributes[0]).toMatchObject({
      type: "attribute",
      name: "class",
      indices: [0, 1],
      strings: ["", " ", ""],
      raw: false,
    });
    expect(attributes[1]).toMatchObject({
      type: "attribute",
      name: "title",
      indices: [2],
      strings: ["x-", ""],
      raw: false,
    });
  });

  it("marks an exact single interpolation as raw", () => {
    const parts = compile`<button data-value=${{ id: 1 }}></button>`;
    const attribute = parts.find((part) => part.type === "attribute");

    expect(attribute).toMatchObject({
      type: "attribute",
      name: "data-value",
      indices: [0],
      strings: ["", ""],
      raw: true,
    });
  });

  it("normalizes a self-closing component with compound props without creating child markers", () => {
    const Component = () => null;
    const output = source`<${Component} className="${"a"} ${"b"}" label="Open ${"Panel"}" />`;

    expect(output).toContain("</template>");
    expect(output).not.toContain("<!--fabrica:text:");
    expect(output).not.toMatch(/<\/template>[\s\S]*__fabrica_attr_/);
  });
});
